import { useQuery } from '@tanstack/react-query';
import { useGlobalDialog } from '@/contexts/GlobalDialogContext';
import { ReservationViewDialog } from '@/components/reservations/reservation-view-dialog';
import { SpareVehicleDialog } from '@/components/reservations/spare-vehicle-dialog';
import { ApkInspectionDialog } from '@/components/vehicles/apk-inspection-dialog';
import { Vehicle, Reservation } from '@shared/schema';

export function GlobalDialogs() {
  const {
    dialogState,
    closeReservationDialog,
    closeSpareAssignmentDialog,
    closeAPKDialog,
    closeMaintenanceDialog,
  } = useGlobalDialog();

  // Fetch reservation data when dialog is open
  const { data: reservation } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${dialogState.reservation.id}`],
    enabled: dialogState.reservation.open && !!dialogState.reservation.id,
  });

  // Fetch placeholder reservation data for spare assignment
  const { data: placeholderReservation } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${dialogState.spareAssignment.id}`],
    enabled: dialogState.spareAssignment.open && !!dialogState.spareAssignment.id,
  });

  // Fetch vehicle data for APK dialog
  const { data: apkVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${dialogState.apk.vehicleId}`],
    enabled: dialogState.apk.open && !!dialogState.apk.vehicleId,
  });

  // Fetch vehicle data for maintenance dialog
  const { data: maintenanceVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${dialogState.maintenance.vehicleId}`],
    enabled: dialogState.maintenance.open && !!dialogState.maintenance.vehicleId,
  });

  return (
    <>
      {/* Reservation Details Dialog */}
      <ReservationViewDialog
        open={dialogState.reservation.open}
        onOpenChange={closeReservationDialog}
        reservationId={dialogState.reservation.id}
      />

      {/* Spare Assignment Dialog */}
      {placeholderReservation && (
        <SpareVehicleDialog
          open={dialogState.spareAssignment.open}
          onOpenChange={closeSpareAssignmentDialog}
          originalReservation={placeholderReservation}
          onSuccess={() => {
            closeSpareAssignmentDialog();
          }}
        />
      )}

      {/* APK Dialog */}
      {apkVehicle && (
        <ApkInspectionDialog
          open={dialogState.apk.open}
          onOpenChange={closeAPKDialog}
          vehicle={apkVehicle}
          onSuccess={() => {
            closeAPKDialog();
          }}
        />
      )}

      {/* Maintenance/Warranty Dialog - Opens vehicle maintenance tab */}
      {maintenanceVehicle && (
        <ApkInspectionDialog
          open={dialogState.maintenance.open}
          onOpenChange={closeMaintenanceDialog}
          vehicle={maintenanceVehicle}
          onSuccess={() => {
            closeMaintenanceDialog();
          }}
        />
      )}
    </>
  );
}
