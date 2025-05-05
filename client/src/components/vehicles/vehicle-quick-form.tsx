import { useState } from "react";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Vehicle } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import z from "zod";
import { formSchema } from "./vehicle-form"; // Reuse the form schema from the main form

interface VehicleQuickFormProps {
  onSuccess: (vehicle: Vehicle) => void;
  onCancel: () => void;
}

/**
 * A standalone wrapper component for vehicle creation in a dialog
 * This bypasses the navigation issues with the main VehicleForm
 */
export function VehicleQuickForm({ onSuccess, onCancel }: VehicleQuickFormProps) {
  console.log("VehicleQuickForm mounted - standalone implementation");
  const { toast } = useToast();
  
  // Use a separate mutation to avoid any potential navigation issues
  const createVehicleMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Quick form sending data:", data);
      const response = await apiRequest("POST", "/api/vehicles", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create vehicle");
      }
      return await response.json();
    },
    onSuccess: (vehicleData) => {
      console.log("Vehicle created successfully in quick form:", vehicleData);
      
      // Show success message
      toast({
        title: "Vehicle created successfully",
        description: "The vehicle has been added to your fleet.",
      });
      
      // Invalidate the vehicles query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Call the parent's onSuccess with the vehicle data
      onSuccess(vehicleData);
    },
    onError: (error: any) => {
      console.error("Failed to create vehicle in quick form:", error);
      toast({
        title: "Error",
        description: `Failed to create vehicle: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Pass our direct submitHandler to the form
  const handleSubmit = (data: any) => {
    // Process the form data before submission (copied from vehicle-form.tsx)
    const formattedData: any = { ...data };
    
    // Handle empty string values for numeric fields
    if (formattedData.departureMileage === "") formattedData.departureMileage = null;
    if (formattedData.returnMileage === "") formattedData.returnMileage = null;
    if (formattedData.monthlyPrice === "") formattedData.monthlyPrice = null;
    if (formattedData.dailyPrice === "") formattedData.dailyPrice = null;
    
    // Convert boolean fields
    const booleanFields = ['winterTires', 'damageCheck', 'roadsideAssistance', 
      'spareKey', 'wokNotification', 'seatcovers', 'backupbeepers', 'gps', 'adBlue'];
    
    // These fields are stored as strings in the database despite being boolean in the UI
    const stringBooleanFields = ['registeredTo', 'company'];
    
    booleanFields.forEach(field => {
      if (field in formattedData) {
        if (formattedData[field] === "" || formattedData[field] === "false" || formattedData[field] === false || formattedData[field] === null || formattedData[field] === undefined) {
          formattedData[field] = false;
        } else {
          formattedData[field] = true;
        }
      } else {
        formattedData[field] = false; 
      }
    });
    
    // Handle string-boolean fields differently - convert to strings "true" or "false"
    stringBooleanFields.forEach(field => {
      if (field in formattedData) {
        if (formattedData[field] === "" || formattedData[field] === "false" || formattedData[field] === false || formattedData[field] === null || formattedData[field] === undefined) {
          formattedData[field] = "false";
        } else {
          formattedData[field] = "true";
        }
      } else {
        formattedData[field] = "false"; 
      }
    });
    
    // Clean up date fields if they're empty strings
    Object.keys(formattedData).forEach(key => {
      if (key.toLowerCase().includes('date') && formattedData[key] === "") {
        formattedData[key] = null;
      }
    });
    
    // Submit the processed data
    createVehicleMutation.mutate(formattedData);
  };
  
  return (
    <div className="max-h-[75vh] overflow-y-auto pr-2">
      <VehicleForm 
        redirectToList={false}
        // Override the form submission to use our local mutation
        onSubmitOverride={handleSubmit}
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