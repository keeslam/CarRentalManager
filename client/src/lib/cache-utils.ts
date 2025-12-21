import { queryClient } from "./queryClient";

/**
 * Invalidate vehicle-related data.
 * Uses soft invalidation (marks as stale) instead of forced refetch to prevent dialog closures.
 * React Query will refetch in the background when components need fresh data.
 */
export function invalidateVehicleData(vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/vehicles')) return true;
      if (vehicleId && key.includes(`/${vehicleId}`)) return true;
      
      return false;
    },
    refetchType: 'none' // Don't force immediate refetch - let components decide when to refetch
  });
}

/**
 * Invalidate reservation-related data.
 * Uses soft invalidation to prevent UI disruption while keeping data fresh.
 */
export function invalidateReservationData(reservationId?: number, vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/reservations')) return true;
      if (key.startsWith('/api/placeholder-reservations')) return true;
      if (reservationId && key.includes(`/${reservationId}`)) return true;
      if (vehicleId && key.includes(`/${vehicleId}`)) return true;
      
      return false;
    },
    refetchType: 'none' // Soft invalidation only
  });
}

/**
 * Invalidate customer-related data.
 */
export function invalidateCustomerData(customerId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/customers')) return true;
      if (customerId && key.includes(`/${customerId}`)) return true;
      
      return false;
    },
    refetchType: 'none'
  });
}

/**
 * Invalidate expense-related data.
 */
export function invalidateExpenseData(expenseId?: number, vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/expenses')) return true;
      if (expenseId && key.includes(`/${expenseId}`)) return true;
      if (vehicleId && key.includes(`/vehicle/${vehicleId}`)) return true;
      
      return false;
    },
    refetchType: 'none'
  });
}

/**
 * Invalidate document-related data.
 */
export function invalidateDocumentData(documentId?: number, vehicleId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/documents')) return true;
      if (documentId && key.includes(`/${documentId}`)) return true;
      if (vehicleId && key.includes(`/vehicle/${vehicleId}`)) return true;
      
      return false;
    },
    refetchType: 'none'
  });
}

/**
 * Invalidate notification-related data.
 */
export function invalidateNotificationData(notificationId?: number) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      if (key.startsWith('/api/notifications')) return true;
      if (key.startsWith('/api/custom-notifications')) return true;
      if (notificationId && key.includes(`/${notificationId}`)) return true;
      
      return false;
    },
    refetchType: 'none'
  });
}

/**
 * Force refetch of active list queries (for explicit user refresh actions only).
 * This should only be called when user explicitly requests a refresh.
 */
export function forceRefreshLists() {
  queryClient.refetchQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      return key === '/api/vehicles' || 
             key === '/api/reservations' ||
             key === '/api/customers' ||
             key === '/api/expenses';
    },
    type: 'active'
  });
}

/**
 * Invalidate all related data - use sparingly as it can cause UI disruption.
 * Prefer specific invalidation functions instead.
 */
export function invalidateAllRelatedData() {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      
      return key.startsWith('/api/vehicles') || 
             key.startsWith('/api/reservations') ||
             key.startsWith('/api/customers') ||
             key.startsWith('/api/expenses') ||
             key.startsWith('/api/placeholder-reservations');
    },
    refetchType: 'none' // Soft invalidation only
  });
}
