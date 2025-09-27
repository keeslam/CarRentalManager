import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { Reservation } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ReservationEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: number | null;
  onSuccess?: (reservation: Reservation) => void;
}

export function ReservationEditDialog({ 
  open, 
  onOpenChange, 
  reservationId,
  onSuccess 
}: ReservationEditDialogProps) {
  const [initialData, setInitialData] = useState<Reservation | null>(null);
  
  // Fetch reservation data
  const { data: reservation, isLoading, error } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${reservationId}`],
    enabled: !!reservationId && open,
  });
  
  useEffect(() => {
    if (reservation) {
      setInitialData(reservation);
    }
  }, [reservation]);

  const handleSuccess = (updatedReservation: Reservation) => {
    onSuccess?.(updatedReservation);
    onOpenChange(false);
  };

  if (!reservationId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-reservation-edit">
        <DialogHeader>
          <DialogTitle>Edit Reservation</DialogTitle>
          <DialogDescription>
            Modify reservation details and save changes
          </DialogDescription>
          <p className="text-gray-500">Reservation #{reservationId}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-3/12" />
            <div className="space-y-3">
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        ) : error || !reservation ? (
          <div className="bg-red-50 border border-red-200 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
            <p className="text-red-600">Failed to load reservation details. {(error as Error)?.message}</p>
          </div>
        ) : (
          initialData && (
            <ReservationForm 
              editMode={true} 
              initialData={initialData}
              onSuccess={handleSuccess}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}