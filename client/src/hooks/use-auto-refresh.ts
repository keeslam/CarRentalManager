import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
    queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`] });
  }, [queryClient]);

  /**
   * Refresh data for a specific entity by ID
   * @param entityType The type of entity to refresh
   * @param id The ID of the entity
   */
  const refreshEntityById = useCallback((entityType: string, id: number) => {
    queryClient.invalidateQueries({ queryKey: [`/api/${entityType}/${id}`] });
  }, [queryClient]);

  /**
   * Refresh all data related to a vehicle
   * @param vehicleId The ID of the vehicle
   */
  const refreshVehicleData = useCallback((vehicleId: number) => {
    queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/reservations/vehicle/${vehicleId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/expenses/vehicle/${vehicleId}`] });
  }, [queryClient]);

  /**
   * Refresh dashboard data (available vehicles, expiring warranties/APKs, upcoming reservations)
   */
  const refreshDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/vehicles/available'] });
    queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
    queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
    queryClient.invalidateQueries({ queryKey: ['/api/reservations/upcoming'] });
    queryClient.invalidateQueries({ queryKey: ['/api/expenses/recent'] });
  }, [queryClient]);

  /**
   * Refresh calendar data
   */
  const refreshCalendar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/reservations/range'] });
  }, [queryClient]);

  return {
    refreshEntityData,
    refreshEntityById,
    refreshVehicleData,
    refreshDashboard,
    refreshCalendar
  };
}