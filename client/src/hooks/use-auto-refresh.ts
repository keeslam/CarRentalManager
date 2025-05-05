import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_REFRESH_INTERVAL } from '@/lib/queryClient';

type QueryKey = string | readonly unknown[];

/**
 * Hook to enable or disable auto-refresh for specific queries
 * 
 * @param queryKeys Array of query keys to manage auto-refresh for
 * @param enabled Whether auto-refresh should be enabled or disabled
 * @param interval Optional custom refresh interval in milliseconds (defaults to 5 seconds)
 */
export function useAutoRefresh(
  queryKeys: QueryKey[], 
  enabled: boolean = true, 
  interval: number = DEFAULT_REFRESH_INTERVAL
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // For each query key, update the refetch interval
    queryKeys.forEach(queryKey => {
      if (enabled) {
        // Enable auto-refresh for this query
        queryClient.setQueryDefaults(queryKey, {
          refetchInterval: interval,
          staleTime: 0,
          refetchOnWindowFocus: true,
        });
      } else {
        // Disable auto-refresh for this query
        queryClient.setQueryDefaults(queryKey, {
          refetchInterval: false,
          staleTime: Infinity,
          refetchOnWindowFocus: false,
        });
      }
    });

    // Initial refetch when enabled
    if (enabled) {
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
      });
    }

    // Cleanup when unmounting or when parameters change
    return () => {
      // Revert to default settings when the component unmounts
      queryKeys.forEach(queryKey => {
        queryClient.setQueryDefaults(queryKey, {});
      });
    };
  }, [queryClient, enabled, interval, ...queryKeys]);

  // Expose a function to manually trigger a refresh
  const refreshNow = () => {
    queryKeys.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
    });
  };

  return { refreshNow };
}