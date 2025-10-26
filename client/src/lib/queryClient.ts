import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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
      refetchOnWindowFocus: true, // Refetch when window gets focus
      staleTime: 0, // Always refetch to ensure fresh data in multi-user environment
      gcTime: 300000, // Keep unused data for 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
      // Global mutation observer for automatic cache invalidation
      onSuccess: (data, variables, context, mutation) => {
        const mutationKey = mutation.options.mutationKey?.[0] as string;
        if (mutationKey) {
          autoInvalidateCache(mutationKey, data);
        }
      },
    },
  },
});

/**
 * Automatic cache invalidation based on mutation patterns
 * This eliminates the need for manual cache invalidation in most cases
 */
function autoInvalidateCache(mutationKey: string, data?: any) {
  // Extract the API path and method from mutation key
  const apiPath = mutationKey.toLowerCase();
  
  // Smart invalidation based on API patterns
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
  
  // Always invalidate dashboard data for any changes
  invalidateByPrefix('/api/reservations/upcoming');
  invalidateByPrefix('/api/expenses/recent');
  invalidateByPrefix('/api/vehicles/apk-expiring');
  invalidateByPrefix('/api/vehicles/warranty-expiring');
}

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
