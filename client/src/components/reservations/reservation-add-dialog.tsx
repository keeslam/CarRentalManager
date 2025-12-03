import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReservationAddDialogProps {
  initialVehicleId?: string;
  initialCustomerId?: string;
  initialStartDate?: string;
  children?: React.ReactNode;
  onSuccess?: (reservation: any) => void;
}

export function ReservationAddDialog({ 
  initialVehicleId, 
  initialCustomerId, 
  initialStartDate,
  children,
  onSuccess
}: ReservationAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [isInPreviewMode, setIsInPreviewMode] = useState(false);
  const [isPickupReturnDialogOpen, setIsPickupReturnDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (newOpen: boolean) => {
    console.log('📦 ReservationAddDialog handleOpenChange called:', newOpen, 'isPickupReturnDialogOpen:', isPickupReturnDialogOpen);
    
    // Don't close if pickup/return dialog is open
    if (!newOpen && isPickupReturnDialogOpen) {
      console.log('🛑 Blocking close - pickup/return dialog is open');
      return;
    }
    
    if (!newOpen && isInPreviewMode) {
      toast({
        title: "Preview in Progress",
        description: "Please finalize the reservation or click 'Back to Edit' before closing.",
        variant: "default",
      });
      return;
    }
    
    console.log('✅ Allowing dialog state change to:', newOpen);
    setOpen(newOpen);
    
    if (!newOpen) {
      setIsInPreviewMode(false);
    }
  };

  // Custom trigger or default "New Reservation" button
  const trigger = children || (
    <Button data-testid="button-new-reservation">
      <PlusCircle className="mr-2 h-4 w-4" />
      New Reservation
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
          <DialogDescription>
            Create a new reservation by selecting a vehicle and customer
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <ReservationForm 
            initialVehicleId={initialVehicleId}
            initialCustomerId={initialCustomerId}
            initialStartDate={initialStartDate}
            onPreviewModeChange={setIsInPreviewMode}
            onPickupReturnDialogChange={setIsPickupReturnDialogOpen}
            onSuccess={(reservation) => {
              setIsInPreviewMode(false);
              setIsPickupReturnDialogOpen(false);
              setOpen(false);
              if (onSuccess) {
                onSuccess(reservation);
              }
            }}
            onCancel={() => {
              setIsInPreviewMode(false);
              setIsPickupReturnDialogOpen(false);
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}