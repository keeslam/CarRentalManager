import { useState, useRef, useCallback } from "react";
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
import { PickupDialog, ReturnDialog } from "@/components/reservations/pickup-return-dialogs";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Reservation } from "@shared/schema";

interface ReservationAddDialogProps {
  initialVehicleId?: string;
  initialCustomerId?: string;
  initialStartDate?: string;
  children?: React.ReactNode;
  onSuccess?: (reservation: any) => void;
  // Optional callback to delegate pickup dialog to parent (page-level)
  // This is needed when this dialog is rendered in a context where it gets unmounted
  // on data refetch (e.g., inside a table row that re-renders after reservation creation)
  onStartPickupFlow?: (reservation: Reservation) => void;
}

export function ReservationAddDialog({ 
  initialVehicleId, 
  initialCustomerId, 
  initialStartDate,
  children,
  onSuccess,
  onStartPickupFlow
}: ReservationAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [isInPreviewMode, setIsInPreviewMode] = useState(false);
  const [isPickupReturnDialogOpen, setIsPickupReturnDialogOpen] = useState(false);
  // Use ref for synchronous access in event handlers (React state updates are async)
  const isPickupReturnDialogOpenRef = useRef(false);
  const { toast } = useToast();
  
  // Lift pickup/return dialog state up to this level to render outside parent Dialog
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [pendingDialogReservation, setPendingDialogReservation] = useState<Reservation | null>(null);
  
  // Use refs to persist values across potential re-renders
  const pendingDialogReservationRef = useRef<Reservation | null>(null);
  const pickupDialogOpenRef = useRef(false);

  const handleOpenChange = (newOpen: boolean) => {
    console.log('📦 ReservationAddDialog handleOpenChange called:', newOpen, 'isPickupReturnDialogOpen:', isPickupReturnDialogOpen, 'ref:', isPickupReturnDialogOpenRef.current);
    
    // Don't close if pickup/return dialog is open (check both state and ref for sync issues)
    if (!newOpen && (isPickupReturnDialogOpen || isPickupReturnDialogOpenRef.current)) {
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
  
  // Handler for pickup/return dialog changes - updates both state and ref
  const handlePickupReturnDialogChange = (isOpen: boolean) => {
    console.log('📦 ReservationAddDialog pickup/return dialog change:', isOpen);
    isPickupReturnDialogOpenRef.current = isOpen;
    setIsPickupReturnDialogOpen(isOpen);
  };
  
  // Handler to trigger pickup dialog from ReservationForm - this receives the reservation data
  // Strategy: If parent provides onStartPickupFlow callback, delegate to it (page-level dialog)
  // Otherwise, try to render pickup dialog locally (works when dialog is stable)
  const handleTriggerPickupDialog = useCallback((reservation: Reservation) => {
    console.log('📦 ReservationAddDialog triggering pickup dialog for reservation:', reservation.id);
    
    // If parent provides a page-level pickup flow handler, use it instead
    // This is more reliable when the component might unmount due to data refetch
    if (onStartPickupFlow) {
      console.log('📦 Delegating pickup to page-level handler');
      // Close this dialog first
      setOpen(false);
      // Then trigger page-level pickup dialog
      onStartPickupFlow(reservation);
      return;
    }
    
    console.log('📦 Setting pendingDialogReservation and pickupDialogOpen to true');
    // Set up ref FIRST for synchronous blocking
    isPickupReturnDialogOpenRef.current = true;
    setIsPickupReturnDialogOpen(true);
    
    // Store in both state and ref for persistence
    pendingDialogReservationRef.current = reservation;
    pickupDialogOpenRef.current = true;
    setPendingDialogReservation(reservation);
    
    // Use setTimeout to ensure state is set before opening dialog
    setTimeout(() => {
      console.log('📦 Opening pickup dialog after state set, ref values:', {
        reservation: pendingDialogReservationRef.current?.id,
        pickupOpen: pickupDialogOpenRef.current
      });
      setPickupDialogOpen(true);
    }, 50);
  }, [onStartPickupFlow]);
  
  // Handler to trigger return dialog from ReservationForm
  const handleTriggerReturnDialog = useCallback((reservation: Reservation) => {
    console.log('📦 ReservationAddDialog triggering return dialog for reservation:', reservation.id);
    isPickupReturnDialogOpenRef.current = true;
    setIsPickupReturnDialogOpen(true);
    setPendingDialogReservation(reservation);
    setReturnDialogOpen(true);
  }, []);

  // Custom trigger or default "New Reservation" button
  const trigger = children || (
    <Button data-testid="button-new-reservation">
      <PlusCircle className="mr-2 h-4 w-4" />
      New Reservation
    </Button>
  );

  return (
    <>
    <Dialog 
      open={open} 
      onOpenChange={handleOpenChange}
      modal={!pickupDialogOpen && !returnDialogOpen}
    >
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking on nested dialog overlays (use ref for sync access)
          if (isPickupReturnDialogOpen || isPickupReturnDialogOpenRef.current) {
            console.log('🛑 Blocking pointer down outside - pickup dialog is open');
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent any interaction outside when pickup dialog is open (use ref for sync access)
          if (isPickupReturnDialogOpen || isPickupReturnDialogOpenRef.current) {
            console.log('🛑 Blocking interact outside - pickup dialog is open');
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent escape closing parent when pickup dialog is open
          if (isPickupReturnDialogOpen || isPickupReturnDialogOpenRef.current) {
            console.log('🛑 Blocking escape key - pickup dialog is open');
            e.preventDefault();
          }
        }}
      >
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
            onPickupReturnDialogChange={handlePickupReturnDialogChange}
            onTriggerPickupDialog={handleTriggerPickupDialog}
            onTriggerReturnDialog={handleTriggerReturnDialog}
            onSuccess={(reservation) => {
              console.log('📦 ReservationAddDialog onSuccess callback called');
              setIsInPreviewMode(false);
              isPickupReturnDialogOpenRef.current = false;
              setIsPickupReturnDialogOpen(false);
              setOpen(false);
              if (onSuccess) {
                onSuccess(reservation);
              }
            }}
            onCancel={() => {
              console.log('📦 ReservationAddDialog onCancel callback called');
              setIsInPreviewMode(false);
              isPickupReturnDialogOpenRef.current = false;
              setIsPickupReturnDialogOpen(false);
              setOpen(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Render pickup/return dialogs OUTSIDE the parent Dialog to avoid focus/portal conflicts */}
    {/* Use ref fallback if state was reset due to component re-render */}
    {(pendingDialogReservation || pendingDialogReservationRef.current) && (pickupDialogOpen || pickupDialogOpenRef.current) && console.log('📦 Rendering PickupDialog with open=', pickupDialogOpen, pickupDialogOpenRef.current, 'reservation=', pendingDialogReservation?.id, pendingDialogReservationRef.current?.id)}
    {(pendingDialogReservation || pendingDialogReservationRef.current) && (
      <PickupDialog
        open={pickupDialogOpen || pickupDialogOpenRef.current}
        onOpenChange={(dialogOpen) => {
          setPickupDialogOpen(dialogOpen);
          pickupDialogOpenRef.current = dialogOpen;
          if (!dialogOpen) {
            // Dialog closed/cancelled
            setPendingDialogReservation(null);
            pendingDialogReservationRef.current = null;
            isPickupReturnDialogOpenRef.current = false;
            setIsPickupReturnDialogOpen(false);
          }
        }}
        reservation={(pendingDialogReservation || pendingDialogReservationRef.current)!}
        onSuccess={async () => {
          console.log('📦 ReservationAddDialog pickup success');
          setPickupDialogOpen(false);
          pickupDialogOpenRef.current = false;
          isPickupReturnDialogOpenRef.current = false;
          setIsPickupReturnDialogOpen(false);
          
          // Close the parent dialog as well - pickup workflow is complete
          setOpen(false);
          
          // Fetch updated reservation and call success callback
          const reservationToUse = pendingDialogReservation || pendingDialogReservationRef.current;
          if (onSuccess && reservationToUse) {
            try {
              const response = await fetch(`/api/reservations/${reservationToUse.id}`, { credentials: 'include' });
              if (response.ok) {
                const updatedReservation = await response.json();
                onSuccess(updatedReservation);
              }
            } catch (e) {
              console.error('Failed to fetch updated reservation:', e);
            }
          }
          
          setPendingDialogReservation(null);
          pendingDialogReservationRef.current = null;
        }}
      />
    )}
    
    {(pendingDialogReservation || pendingDialogReservationRef.current) && (
      <ReturnDialog
        open={returnDialogOpen}
        onOpenChange={(dialogOpen) => {
          setReturnDialogOpen(dialogOpen);
          if (!dialogOpen) {
            // Dialog closed/cancelled
            setPendingDialogReservation(null);
            pendingDialogReservationRef.current = null;
            isPickupReturnDialogOpenRef.current = false;
            setIsPickupReturnDialogOpen(false);
          }
        }}
        reservation={(pendingDialogReservation || pendingDialogReservationRef.current)!}
        onSuccess={async () => {
          console.log('📦 ReservationAddDialog return success');
          setReturnDialogOpen(false);
          isPickupReturnDialogOpenRef.current = false;
          setIsPickupReturnDialogOpen(false);
          
          // Close the parent dialog as well - return workflow is complete
          setOpen(false);
          
          // Fetch updated reservation and call success callback
          const reservationToUse = pendingDialogReservation || pendingDialogReservationRef.current;
          if (onSuccess && reservationToUse) {
            try {
              const response = await fetch(`/api/reservations/${reservationToUse.id}`, { credentials: 'include' });
              if (response.ok) {
                const updatedReservation = await response.json();
                onSuccess(updatedReservation);
              }
            } catch (e) {
              console.error('Failed to fetch updated reservation:', e);
            }
          }
          
          setPendingDialogReservation(null);
          pendingDialogReservationRef.current = null;
        }}
      />
    )}
    </>
  );
}