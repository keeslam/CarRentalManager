import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { Reservation } from "@shared/schema";
import { CalendarClock } from "lucide-react";

interface QuickStatusChangeButtonProps {
  vehicleId: number;
}

export function QuickStatusChangeButton({ vehicleId }: QuickStatusChangeButtonProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Query to get active reservations for this vehicle
  const vehicleReservationsQueryKey = [`/api/reservations/vehicle/${vehicleId}`];
  
  const { data: reservations } = useQuery<Reservation[]>({
    queryKey: vehicleReservationsQueryKey,
  });
  
  // Find active reservations (those with pending or confirmed status)
  const activeReservations = reservations?.filter(
    (res) => res.status === "pending" || res.status === "confirmed"
  );
  
  // Sort by nearest start date
  const sortedReservations = activeReservations?.sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return dateA - dateB;
  });
  
  // Take the first active reservation if available
  const nextReservation = sortedReservations && sortedReservations.length > 0 
    ? sortedReservations[0] 
    : null;
  
  // Handle button click to open status dialog with this reservation
  const handleStatusChange = () => {
    if (nextReservation) {
      setSelectedReservation(nextReservation);
      setStatusDialogOpen(true);
    }
  };
  
  // Don't show the button if there are no active reservations
  if (!nextReservation) {
    return null;
  }
  
  return (
    <>
      <Button 
        variant="outline"
        onClick={handleStatusChange}
        className="flex items-center"
      >
        <CalendarClock className="h-4 w-4 mr-2" />
        Change Reservation Status
      </Button>
      
      {selectedReservation && (
        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          reservationId={selectedReservation.id}
          initialStatus={selectedReservation.status || "pending"}
          vehicle={selectedReservation.vehicle}
          customer={selectedReservation.customer}
          initialFuelData={{
            fuelLevelPickup: selectedReservation.fuelLevelPickup,
            fuelLevelReturn: selectedReservation.fuelLevelReturn,
            fuelCost: selectedReservation.fuelCost ? Number(selectedReservation.fuelCost) : null,
            fuelCardNumber: selectedReservation.fuelCardNumber,
            fuelNotes: selectedReservation.fuelNotes,
          }}
          onStatusChanged={() => {
            // This will be called after the status is changed successfully
            setSelectedReservation(null);
          }}
        />
      )}
    </>
  );
}