import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { invokeSessionExpired } from "./session-expiry";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle session expiration (401)
    if (res.status === 401) {
      // Try to parse response to check for expiry flag
      try {
        const data = await res.clone().json();
        if (data.expired || data.message === "Session expired due to inactivity") {
          // Session expired - trigger logout
          await invokeSessionExpired();
        }
      } catch (e) {
        // If we can't parse JSON, still invoke expiry for any 401
        await invokeSessionExpired();
      }
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Add Content-Type for requests with data
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing requests
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
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
      refetchOnWindowFocus: false, // Disabled - prevents dialogs from closing when switching tabs. Real-time updates come via WebSocket instead.
      refetchOnReconnect: false, // Disabled - prevents refetch on network reconnect which can close dialogs
      staleTime: 30000, // Cache data for 30 seconds to reduce refetches while maintaining freshness
      gcTime: 300000, // Keep unused data for 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Automatic cache invalidation based on mutation patterns.
 * Uses soft invalidation to prevent dialogs from closing unexpectedly.
 * Data is marked as stale but not force-refetched.
 */
function autoInvalidateCache(mutationKey: string, data?: any) {
  // Extract the API path and method from mutation key
  const apiPath = mutationKey.toLowerCase();
  
  // Smart invalidation based on API patterns - uses soft invalidation
  if (apiPath.includes('users')) {
    invalidateByPrefix('/api/users');
  } else if (apiPath.includes('vehicles')) {
    invalidateRelatedQueries('vehicles', data);
  } else if (apiPath.includes('customers')) {
    invalidateRelatedQueries('customers', data);
  } else if (apiPath.includes('reservations')) {
    invalidateRelatedQueries('reservations', data);
  } else if (apiPath.includes('expenses')) {
    invalidateRelatedQueries('expenses', data);
  } else if (apiPath.includes('documents')) {
    invalidateRelatedQueries('documents', data);
  } else if (apiPath.includes('notifications')) {
    invalidateRelatedQueries('notifications', data);
  }
  
  // Soft invalidate dashboard data - they will refetch when visible
  invalidateByPrefix('/api/reservations/upcoming');
  invalidateByPrefix('/api/expenses/recent');
  invalidateByPrefix('/api/vehicles/apk-expiring');
  invalidateByPrefix('/api/vehicles/warranty-expiring');
}

/**
 * Prefix-based invalidation utility to invalidate all queries with a matching prefix.
 * Uses soft invalidation (refetchType: 'none') to prevent dialogs from closing.
 * Data is marked stale and will be refetched when components need it.
 */
export function invalidateByPrefix(prefix: string) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return typeof queryKey?.[0] === 'string' && queryKey[0].startsWith(prefix);
    },
    refetchType: 'none' // Soft invalidation - prevents dialog closures
  });
}

/**
 * Enhanced API request function that supports automatic cache invalidation
 * Pass a mutationKey to enable automatic cache refresh on success
 */
export async function apiRequestWithCache(
  method: string,
  url: string,
  data?: unknown,
  mutationKey?: string
): Promise<Response> {
  const response = await apiRequest(method, url, data);
  
  // Trigger automatic cache invalidation if mutationKey is provided
  if (mutationKey) {
    autoInvalidateCache(mutationKey, data);
  }
  
  return response;
}

/**
 * Disable automatic cache invalidation for specific mutations
 * Use this when you want to handle cache invalidation manually
 */
export const createMutationWithoutAutoCache = (options: any) => ({
  ...options,
  mutationKey: undefined, // Prevents automatic cache invalidation
});

/**
 * Comprehensive soft invalidation system for all entity types and their relationships.
 * Uses refetchType: 'none' throughout to prevent dialogs from closing unexpectedly.
 * Data is marked as stale and will be refetched when components actively need it.
 * 
 * This ensures real-time updates are reflected without disrupting user interactions.
 */
export function invalidateRelatedQueries(entityType: string, entityData?: { id?: number; vehicleId?: number; customerId?: number }) {
  const id = entityData?.id;
  const vehicleId = entityData?.vehicleId;
  const customerId = entityData?.customerId;
  
  // All invalidations use soft mode (refetchType: 'none') via invalidateByPrefix
  switch (entityType) {
    case 'vehicles':
      invalidateByPrefix('/api/vehicles');
      if (id) {
        invalidateByPrefix(`/api/reservations/vehicle/${id}`);
        invalidateByPrefix(`/api/expenses/vehicle/${id}`);
        invalidateByPrefix(`/api/documents/vehicle/${id}`);
      }
      break;
      
    case 'reservations':
      invalidateByPrefix('/api/reservations');
      invalidateByPrefix('/api/vehicles/available');
      invalidateByPrefix('/api/placeholder-reservations');
      if (vehicleId) {
        invalidateByPrefix(`/api/reservations/vehicle/${vehicleId}`);
      }
      if (customerId) {
        invalidateByPrefix(`/api/reservations/customer/${customerId}`);
      }
      break;
      
    case 'expenses':
      invalidateByPrefix('/api/expenses');
      if (vehicleId) {
        invalidateByPrefix(`/api/expenses/vehicle/${vehicleId}`);
      }
      break;
      
    case 'documents':
      invalidateByPrefix('/api/documents');
      if (vehicleId) {
        invalidateByPrefix(`/api/documents/vehicle/${vehicleId}`);
      }
      break;
      
    case 'customers':
      invalidateByPrefix('/api/customers');
      if (id) {
        invalidateByPrefix(`/api/reservations/customer/${id}`);
      }
      break;
      
    case 'notifications':
      invalidateByPrefix('/api/custom-notifications');
      invalidateByPrefix('/api/notifications');
      break;
      
    default:
      console.warn(`Unknown entity type for invalidation: ${entityType}`);
      break;
  }
}
