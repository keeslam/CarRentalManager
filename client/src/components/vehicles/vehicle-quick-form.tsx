import { useState } from "react";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Vehicle } from "@shared/schema";

interface VehicleQuickFormProps {
  onSuccess: (vehicle: Vehicle) => void;
  onCancel: () => void;
}

/**
 * A wrapper component that uses the main VehicleForm but in a dialog context
 */
export function VehicleQuickForm({ onSuccess, onCancel }: VehicleQuickFormProps) {
  console.log("VehicleQuickForm mounted - preventing navigation");
  
  const handleVehicleSuccess = (vehicle: any) => {
    console.log("Vehicle created in quick form, calling parent onSuccess with:", vehicle);
    onSuccess(vehicle);
  };
  
  return (
    <div className="max-h-[75vh] overflow-y-auto pr-2">
      <VehicleForm 
        redirectToList={false}
        onSuccess={handleVehicleSuccess}
        customCancelButton={
          <button 
            type="button" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            onClick={onCancel}
          >
            Cancel
          </button>
        }
      />
    </div>
  );
}