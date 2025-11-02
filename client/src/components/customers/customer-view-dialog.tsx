import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import { CustomerDetails } from "./customer-details";

interface CustomerViewDialogProps {
  customerId: number;
  children?: React.ReactNode;
}

export function CustomerViewDialog({ customerId, children }: CustomerViewDialogProps) {
  const [open, setOpen] = useState(false);
  const ignoreCloseUntil = useRef<number>(0);

  // Custom trigger or default "View" button
  const trigger = children || (
    <Button variant="ghost" size="sm" data-testid={`button-view-customer-${customerId}`}>
      <Eye className="mr-2 h-4 w-4" />
      View
    </Button>
  );

  // Handle dialog open/close state changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Check if we should ignore this close request (e.g., from a child dialog closing)
      if (Date.now() < ignoreCloseUntil.current) {
        // Ignore this close request - it's from a child dialog
        return;
      }
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  // Called by child components to prevent parent from closing when they close
  const preventParentClose = () => {
    ignoreCloseUntil.current = Date.now() + 300; // Ignore close requests for 300ms
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking on nested dialogs
          const target = e.target as HTMLElement;
          const allDialogs = document.querySelectorAll('[role="dialog"]');
          // If there are multiple dialogs, prevent closing the parent
          if (allDialogs.length > 1) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing when interacting with nested dialogs
          const target = e.target as HTMLElement;
          const allDialogs = document.querySelectorAll('[role="dialog"]');
          // If there are multiple dialogs, prevent closing the parent
          if (allDialogs.length > 1) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
          <DialogDescription>
            View customer information and reservation history
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CustomerDetails 
            customerId={customerId} 
            inDialog={true}
            onClose={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}