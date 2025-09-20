import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;
    const params = queryKey[1];
    
    // Handle query parameters if they exist
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      
      const queryString = searchParams.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Don't auto-refresh on a timer
      refetchOnWindowFocus: true, // Refetch when window gets focus
      staleTime: 60000, // Data becomes stale after 60 seconds (allows automatic refetching)
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Prefix-based invalidation utility to invalidate all queries with a matching prefix
 */
export function invalidateByPrefix(prefix: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return typeof queryKey?.[0] === 'string' && queryKey[0].startsWith(prefix);
    }
  });
}

/**
 * Comprehensive invalidation system for all entity types and their relationships
 * This ensures changes propagate across all related pages and components
 */
export function invalidateRelatedQueries(entityType: string, entityData?: { id?: number; vehicleId?: number; customerId?: number }) {
  const id = entityData?.id;
  const vehicleId = entityData?.vehicleId;
  const customerId = entityData?.customerId;
  
  // Core invalidation patterns based on entity type
  switch (entityType) {
    case 'vehicles':
      // Invalidate all vehicle-related queries
      invalidateByPrefix('/api/vehicles');
      // Also invalidate related entities that depend on vehicle data
      if (id) {
        invalidateByPrefix(`/api/reservations/vehicle/${id}`);
        invalidateByPrefix(`/api/expenses/vehicle/${id}`);
        invalidateByPrefix(`/api/documents/vehicle/${id}`);
      }
      break;
      
    case 'reservations':
      // Invalidate all reservation-related queries
      invalidateByPrefix('/api/reservations');
      // Also affect vehicle availability
      invalidateByPrefix('/api/vehicles/available');
      // Invalidate related vehicle and customer data if available
      if (vehicleId) {
        invalidateByPrefix(`/api/reservations/vehicle/${vehicleId}`);
        invalidateByPrefix('/api/vehicles'); // Might affect availability
      }
      if (customerId) {
        invalidateByPrefix(`/api/reservations/customer/${customerId}`);
      }
      break;
      
    case 'expenses':
      // Invalidate all expense-related queries including recent expenses and parameterized queries
      invalidateByPrefix('/api/expenses');
      // Invalidate related vehicle data if available
      if (vehicleId) {
        invalidateByPrefix(`/api/expenses/vehicle/${vehicleId}`);
      }
      break;
      
    case 'documents':
      // Invalidate all document-related queries
      invalidateByPrefix('/api/documents');
      // Invalidate related vehicle data if available
      if (vehicleId) {
        invalidateByPrefix(`/api/documents/vehicle/${vehicleId}`);
      }
      break;
      
    case 'customers':
      // Invalidate all customer-related queries
      invalidateByPrefix('/api/customers');
      // Also invalidate reservations that might display customer data
      invalidateByPrefix('/api/reservations');
      if (id) {
        invalidateByPrefix(`/api/reservations/customer/${id}`);
      }
      break;
      
    case 'notifications':
      // Invalidate all notification-related queries
      invalidateByPrefix('/api/custom-notifications');
      break;
      
    default:
      console.warn(`Unknown entity type for invalidation: ${entityType}`);
      break;
  }
}
