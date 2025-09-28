import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import { VehicleForm } from "./vehicle-form";
import { Vehicle } from "@shared/schema";

interface VehicleEditDialogProps {
  vehicleId: number;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function VehicleEditDialog({ vehicleId, children, onSuccess }: VehicleEditDialogProps) {
  const [open, setOpen] = useState(false);

  // Fetch vehicle data for editing
  const { data: vehicle, isLoading } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
    enabled: open, // Only fetch when dialog is open
  });

  const handleSuccess = (data: any) => {
    setOpen(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  // Custom trigger or default "Edit" button
  const trigger = children || (
    <Button variant="ghost" size="sm" data-testid={`button-edit-vehicle-${vehicleId}`}>
      <Edit className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vehicle</DialogTitle>
          <DialogDescription>
            Update vehicle information and details
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : vehicle ? (
            <VehicleForm 
              editMode={true}
              initialData={vehicle}
              onSuccess={handleSuccess}
              redirectToList={false}
              customCancelButton={
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              }
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load vehicle data
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}