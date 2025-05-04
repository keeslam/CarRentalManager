import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { Reservation } from "@shared/schema";
import { ClipboardEdit } from "lucide-react";

interface ReservationQuickStatusButtonProps {
  reservation: Reservation;
  size?: "sm" | "icon" | "default";
  variant?: "outline" | "ghost" | "default";
  withText?: boolean;
  className?: string;
  onStatusChanged?: () => void;
}

export function ReservationQuickStatusButton({
  reservation,
  size = "icon", 
  variant = "ghost",
  withText = false,
  className = "",
  onStatusChanged,
}: ReservationQuickStatusButtonProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  // Extract the necessary information
  const { id, status, vehicle, customer } = reservation;
  
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setStatusDialogOpen(true)}
        className={`text-primary-600 hover:text-primary-800 ${className}`}
      >
        <ClipboardEdit className="h-4 w-4" />
        {withText && <span className="ml-2">Change Status</span>}
      </Button>
      
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        reservationId={id}
        initialStatus={status || "pending"}
        vehicle={vehicle}
        customer={customer}
        onStatusChanged={onStatusChanged}
      />
    </>
  );
}