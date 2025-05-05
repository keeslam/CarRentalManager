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
      staleTime: Infinity, // Keep data fresh until explicitly invalidated
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Helper function to invalidate related queries after a mutation
 * Call this after any data modification to ensure all related views are updated
 */
export function invalidateRelatedQueries(entityType: string, id?: number) {
  // Always invalidate the list query
  queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`] });
  
  // If we have an ID, invalidate the specific entity query
  if (id !== undefined) {
    queryClient.invalidateQueries({ queryKey: [`/api/${entityType}/${id}`] });
  }
  
  // Invalidate related entities based on type
  switch (entityType) {
    case 'vehicles':
      // When a vehicle changes, invalidate related data
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/available'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: [`/api/reservations/vehicle/${id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/expenses/vehicle/${id}`] });
      }
      break;
    case 'reservations':
      // When a reservation changes, invalidate calendar & upcoming
      queryClient.invalidateQueries({ queryKey: ['/api/reservations/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations/range'] });
      if (id) {
        const reservation = queryClient.getQueryData<any>([`/api/reservations/${id}`]);
        if (reservation?.vehicleId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/reservations/vehicle/${reservation.vehicleId}`] 
          });
        }
        if (reservation?.customerId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/reservations/customer/${reservation.customerId}`] 
          });
        }
      }
      break;
    case 'documents':
      // When a document changes, invalidate vehicle documents
      if (id) {
        const document = queryClient.getQueryData<any>([`/api/documents/${id}`]);
        if (document?.vehicleId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/documents/vehicle/${document.vehicleId}`] 
          });
        }
      }
      break;
    case 'expenses':
      // When an expense changes, invalidate recent expenses
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/recent'] });
      if (id) {
        const expense = queryClient.getQueryData<any>([`/api/expenses/${id}`]);
        if (expense?.vehicleId) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/expenses/vehicle/${expense.vehicleId}`] 
          });
        }
      }
      break;
  }
}
