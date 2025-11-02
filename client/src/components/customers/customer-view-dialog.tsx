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
import { Eye } from "lucide-react";
import { CustomerDetails } from "./customer-details";

interface CustomerViewDialogProps {
  customerId: number;
  children?: React.ReactNode;
}

export function CustomerViewDialog({ customerId, children }: CustomerViewDialogProps) {
  const [open, setOpen] = useState(false);

  // Custom trigger or default "View" button
  const trigger = children || (
    <Button variant="ghost" size="sm" data-testid={`button-view-customer-${customerId}`}>
      <Eye className="mr-2 h-4 w-4" />
      View
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking on nested dialogs
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing when interacting with nested dialogs
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]')) {
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