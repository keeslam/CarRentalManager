import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateByPrefix } from '@/lib/queryClient';

/**
 * Hook that provides a utility to refresh entity data on demand
 * @returns Functions to refresh specific entity types
 */
export function useDataRefresh() {
  const queryClient = useQueryClient();

  /**
   * Refresh all data for a specific entity type
   * @param entityType The type of entity to refresh (vehicles, customers, reservations, etc.)
   */
  const refreshEntityData = useCallback((entityType: string) => {
    invalidateByPrefix(`/api/${entityType}`);
  }, [queryClient]);

  /**
   * Refresh data for a specific entity by ID
   * @param entityType The type of entity to refresh
   * @param id The ID of the entity
   */
  const refreshEntityById = useCallback((entityType: string, id: number) => {
    invalidateByPrefix(`/api/${entityType}/${id}`);
  }, [queryClient]);

  /**
   * Refresh all data related to a vehicle
   * @param vehicleId The ID of the vehicle
   */
  const refreshVehicleData = useCallback((vehicleId: number) => {
    // Use prefix-based invalidation to catch all vehicle-related queries
    invalidateByPrefix(`/api/vehicles/${vehicleId}`);
    invalidateByPrefix(`/api/reservations/vehicle/${vehicleId}`);
    invalidateByPrefix(`/api/documents/vehicle/${vehicleId}`);
    invalidateByPrefix(`/api/expenses/vehicle/${vehicleId}`);
  }, [queryClient]);

  /**
   * Refresh dashboard data (available vehicles, expiring warranties/APKs, upcoming reservations)
   */
  const refreshDashboard = useCallback(() => {
    // Use prefix-based invalidation for dashboard queries
    invalidateByPrefix('/api/vehicles/available');
    invalidateByPrefix('/api/vehicles/apk-expiring');
    invalidateByPrefix('/api/vehicles/warranty-expiring');
    invalidateByPrefix('/api/reservations/upcoming');
    invalidateByPrefix('/api/expenses/recent');
  }, [queryClient]);

  /**
   * Refresh calendar data
   */
  const refreshCalendar = useCallback(() => {
    invalidateByPrefix('/api/reservations/range');
  }, [queryClient]);

  return {
    refreshEntityData,
    refreshEntityById,
    refreshVehicleData,
    refreshDashboard,
    refreshCalendar
  };
}