import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatReservationStatus } from "@/lib/format-utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MileageOverridePasswordDialog } from "@/components/mileage-override-password-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

// Create the base schema first
const baseStatusChangeSchema = z.object({
  status: z.string().min(1, { message: "Status is required" }),
  startMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
  departureMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
  fuelLevelPickup: z.string().nullish(),
  fuelLevelReturn: z.string().nullish(),
  fuelCost: z.union([
    z.number().nullish(),
    z.string().transform(val => val === "" ? null : parseFloat(val) || null),
  ]).nullish(),
  fuelCardNumber: z.string().nullish(),
  fuelNotes: z.string().nullish(),
});

// Create schema with custom validators
const statusChangeSchema = baseStatusChangeSchema
  // First validation: return mileage >= start mileage
  .refine(
    (data) => {
      // Only validate when we have both values and status is "completed"
      if (data.status === "completed" && data.startMileage && data.departureMileage) {
        return data.departureMileage >= data.startMileage;
      }
      return true; // Skip validation if not relevant
    },
    {
      message: "Return mileage must be greater than or equal to the start mileage",
      path: ["departureMileage"], // This will show the error under the departureMileage field
    }
  )
  /* We'll add vehicle-specific validation at runtime */

type StatusChangeFormType = z.infer<typeof statusChangeSchema>;

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: number;
  initialStatus: string;
  vehicle?: {
    id: number;
    brand: string;
    model: string;
    licensePlate?: string;
    currentMileage?: number;
    departureMileage?: number;
    returnMileage?: number;
  };
  customer?: {
    id: number;
    name?: string;             // Full name field
    firstName?: string;
    lastName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
  };
  initialFuelData?: {
    fuelLevelPickup?: string | null;
    fuelLevelReturn?: string | null;
    fuelCost?: number | null;
    fuelCardNumber?: string | null;
    fuelNotes?: string | null;
  };
  pickupMileage?: number | null;
  onStatusChanged?: () => void;
}

// Function to format license plate for display - removes dashes
const formatDisplayLicensePlate = (licensePlate?: string) => {
  if (!licensePlate) return '';
  // Remove dashes if they exist
  return licensePlate.replace(/-/g, '');
};

export function StatusChangeDialog({
  open,
  onOpenChange,
  reservationId,
  initialStatus,
  vehicle,
  onStatusChanged,
  customer, // We'll add this to the props
  initialFuelData,
  pickupMileage,
}: StatusChangeDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [fuelReceiptFile, setFuelReceiptFile] = useState<File | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<StatusChangeFormType | null>(null);
  
  // Create defaultValues object to ensure stable reference
  const defaultValues = {
    status: initialStatus,
    // Use departureMileage if available (it's set when confirming), otherwise use returnMileage
    startMileage: vehicle?.departureMileage !== null && vehicle?.departureMileage !== undefined 
      ? vehicle?.departureMileage 
      : (vehicle?.returnMileage !== null ? vehicle?.returnMileage : undefined),
    departureMileage: undefined,
    fuelLevelPickup: initialFuelData?.fuelLevelPickup ?? undefined,
    fuelLevelReturn: initialFuelData?.fuelLevelReturn ?? undefined,
    fuelCost: initialFuelData?.fuelCost ?? undefined,
    fuelCardNumber: initialFuelData?.fuelCardNumber ?? undefined,
    fuelNotes: initialFuelData?.fuelNotes ?? undefined,
  };
  
  // Form setup with vehicle return mileage as default for start mileage if available
  const form = useForm<StatusChangeFormType>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues,
  });
  
  // Reset form when a new reservation is selected (when reservationId changes)
  useEffect(() => {
    // Reset the form with new default values
    form.reset({
      status: initialStatus,
      // Use departureMileage if available (it's set when confirming), otherwise use returnMileage
      startMileage: vehicle?.departureMileage !== null && vehicle?.departureMileage !== undefined 
        ? vehicle?.departureMileage 
        : (vehicle?.returnMileage !== null ? vehicle?.returnMileage : undefined),
      departureMileage: undefined,
      fuelLevelPickup: initialFuelData?.fuelLevelPickup ?? undefined,
      fuelLevelReturn: initialFuelData?.fuelLevelReturn ?? undefined,
      fuelCost: initialFuelData?.fuelCost ?? undefined,
      fuelCardNumber: initialFuelData?.fuelCardNumber ?? undefined,
      fuelNotes: initialFuelData?.fuelNotes ?? undefined,
    });
    
    // Reset the current status
    setCurrentStatus(initialStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]); // Only reset when reservationId changes to prevent multiple resets
  
  // Update form when status changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.status) {
        setCurrentStatus(value.status);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);
  
  // Status change mutation
  const statusChangeMutation = useMutation({
    mutationFn: async (data: StatusChangeFormType) => {
      // Prepare reservation update data with status, mileage, and fuel tracking
      const reservationUpdateData: any = { 
        status: data.status,
      };
      
      // Add mileage to reservation for historical tracking
      if (data.startMileage !== undefined && data.startMileage !== null) {
        reservationUpdateData.pickupMileage = data.startMileage;
        reservationUpdateData.startMileage = data.startMileage; // Also send as startMileage for backend processing
      }
      if (data.departureMileage !== undefined && data.departureMileage !== null) {
        reservationUpdateData.returnMileage = data.departureMileage;
        reservationUpdateData.departureMileage = data.departureMileage; // Also send as departureMileage for backend processing
      }
      
      // Add fuel tracking fields if present
      if (data.fuelLevelPickup !== undefined && data.fuelLevelPickup !== null) {
        reservationUpdateData.fuelLevelPickup = data.fuelLevelPickup === "not_recorded" ? null : data.fuelLevelPickup;
      }
      if (data.fuelLevelReturn !== undefined && data.fuelLevelReturn !== null) {
        reservationUpdateData.fuelLevelReturn = data.fuelLevelReturn === "not_recorded" ? null : data.fuelLevelReturn;
      }
      if (data.fuelCost !== undefined && data.fuelCost !== null) {
        reservationUpdateData.fuelCost = data.fuelCost;
      }
      if (data.fuelCardNumber !== undefined && data.fuelCardNumber !== null && data.fuelCardNumber !== "") {
        reservationUpdateData.fuelCardNumber = data.fuelCardNumber;
      }
      if (data.fuelNotes !== undefined && data.fuelNotes !== null && data.fuelNotes !== "") {
        reservationUpdateData.fuelNotes = data.fuelNotes;
      }
      
      // We only need to update the vehicle if we have mileage data
      if (
        (data.status === "confirmed" && data.startMileage && vehicle?.id) ||
        (data.status === "completed" && data.departureMileage && vehicle?.id)
      ) {
        // First update the reservation status and fuel tracking
        const reservationResponse = await apiRequest(
          "PATCH", 
          `/api/reservations/${reservationId}/status`,
          reservationUpdateData
        );
        
        if (!reservationResponse.ok) {
          try {
            const errorData = await reservationResponse.json();
            throw new Error(errorData.message || "Failed to update reservation status");
          } catch (e) {
            // Handle non-JSON responses
            const text = await reservationResponse.text();
            console.error("Non-JSON error response:", text);
            throw new Error("Failed to update reservation status. Server returned an invalid response.");
          }
        }
        
        // Then update the vehicle mileage based on status
        const vehicleData: any = {};
        
        // We need to have at least one mileage field to update
        let hasMileageUpdate = false;
        
        if (data.status === "confirmed" && data.startMileage) {
          vehicleData.departureMileage = data.startMileage;
          vehicleData.currentMileage = data.startMileage; // Update current mileage
          hasMileageUpdate = true;
        }
        
        if (data.status === "completed" && data.departureMileage) {
          vehicleData.returnMileage = data.departureMileage;
          vehicleData.currentMileage = data.departureMileage; // Update current mileage
          hasMileageUpdate = true;
        }
        
        // Only make the request if there's at least one mileage field to update
        let vehicleResponse;
        if (hasMileageUpdate) {
          // Don't forget to add the vehicle ID to the data
          vehicleData.id = vehicle.id;
          vehicleResponse = await apiRequest(
            "PATCH",
            `/api/vehicles/${vehicle.id}/mileage`,
            vehicleData
          );
        }
        
        // Only check vehicle response if we actually made the request
        if (hasMileageUpdate && vehicleResponse && !vehicleResponse.ok) {
          try {
            const errorData = await vehicleResponse.json();
            throw new Error(errorData.message || "Failed to update vehicle mileage");
          } catch (e) {
            // Handle non-JSON responses
            const text = await vehicleResponse.text();
            console.error("Non-JSON error response:", text);
            throw new Error("Failed to update vehicle mileage. Server returned an invalid response.");
          }
        }
        
        // Don't try to parse the response - it's already been consumed in error handling
        // Just return an empty object to indicate success
        return {};
      } else {
        // Simple status update without mileage (but with fuel tracking)
        const response = await apiRequest(
          "PATCH", 
          `/api/reservations/${reservationId}/status`,
          reservationUpdateData
        );
        
        if (!response.ok) {
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to update reservation status");
          } catch (e) {
            // Handle non-JSON responses
            const text = await response.text();
            console.error("Non-JSON error response:", text);
            throw new Error("Failed to update reservation status. Server returned an invalid response.");
          }
        }
        
        // Don't try to parse the response - it's already been consumed in error handling
        // Just return an empty object to indicate success
        return {};
      }
    },
    onSuccess: async () => {
      // Upload fuel receipt if one was selected
      if (fuelReceiptFile && vehicle?.id) {
        try {
          const formData = new FormData();
          formData.append('vehicleId', vehicle.id.toString());
          formData.append('reservationId', reservationId.toString());
          formData.append('documentType', 'Fuel Receipt');
          formData.append('file', fuelReceiptFile);
          
          const uploadResponse = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          
          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Failed to upload fuel receipt:', errorText);
            toast({
              title: "Warning",
              description: "Failed to upload fuel receipt. Status updated successfully.",
              variant: "destructive",
            });
          } else {
            // Invalidate documents query
            queryClient.invalidateQueries({ queryKey: [`/api/documents/reservation/${reservationId}`] });
          }
        } catch (error) {
          console.error('Error uploading fuel receipt:', error);
          toast({
            title: "Warning",
            description: "Error uploading fuel receipt. Status updated successfully.",
            variant: "destructive",
          });
        }
      }
      
      // Use unified invalidation system for comprehensive cache updates
      await invalidateRelatedQueries('reservations', { 
        id: reservationId,
        vehicleId: vehicle?.id 
      });
      
      toast({
        title: "Status Updated",
        description: `Reservation status has been changed to ${formatReservationStatus(currentStatus)}.`,
      });
      
      // Reset fuel receipt file
      setFuelReceiptFile(null);
      
      // Close the dialog
      onOpenChange(false);
      
      // Call the callback if provided
      if (onStatusChanged) {
        onStatusChanged();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });
  
  // Function to verify mileage override password
  const verifyMileageOverridePassword = async (password: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const response = await apiRequest("POST", `/api/users/${user.id}/verify-mileage-override`, {
        password
      });
      
      if (!response.ok) {
        return false;
      }
      
      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error("Error verifying mileage override password:", error);
      return false;
    }
  };
  
  // Handle password confirmation for mileage decrease
  const handlePasswordConfirmed = async (password: string): Promise<boolean> => {
    const isValid = await verifyMileageOverridePassword(password);
    
    if (isValid && pendingFormData) {
      // Password is correct, proceed with the mutation
      statusChangeMutation.mutate(pendingFormData);
      setShowPasswordDialog(false);
      setPendingFormData(null);
      return true;
    }
    
    return false;
  };
  
  function onSubmit(data: StatusChangeFormType) {
    console.log("🔍 onSubmit called with data:", data);
    console.log("🚗 Vehicle current mileage:", vehicle?.currentMileage);
    console.log("🚗 Vehicle departure mileage:", vehicle?.departureMileage);
    console.log("🚗 Vehicle return mileage:", vehicle?.returnMileage);
    
    // CHECK FOR MILEAGE DECREASE FIRST (before other validations)
    // This is critical for security - must check before allowing submission
    const currentVehicleMileage = vehicle?.currentMileage || vehicle?.departureMileage || vehicle?.returnMileage || 0;
    
    // Check pickup mileage decrease
    if (data.startMileage !== undefined && data.startMileage !== null) {
      console.log(`🔍 Checking pickup mileage: ${data.startMileage} vs current: ${currentVehicleMileage}`);
      if (data.startMileage < currentVehicleMileage) {
        console.log("⚠️ MILEAGE DECREASE DETECTED - showing password dialog");
        setPendingFormData(data);
        setShowPasswordDialog(true);
        return; // BLOCK SUBMISSION
      }
    }
    
    // Check return mileage decrease (against pickup mileage from this reservation or vehicle mileage)
    if (data.departureMileage !== undefined && data.departureMileage !== null) {
      const baselineForReturn = data.startMileage || pickupMileage || currentVehicleMileage;
      console.log(`🔍 Checking return mileage: ${data.departureMileage} vs baseline: ${baselineForReturn}`);
      if (data.departureMileage < baselineForReturn) {
        console.log("⚠️ RETURN MILEAGE DECREASE DETECTED - showing password dialog");
        setPendingFormData(data);
        setShowPasswordDialog(true);
        return; // BLOCK SUBMISSION
      }
    }
    
    console.log("✅ No mileage decrease detected, proceeding with validations");
    
    // Custom validation - check for start mileage >= return mileage when confirming
    if (data.status === "confirmed" && 
        data.startMileage !== undefined && 
        vehicle?.returnMileage !== undefined && 
        vehicle.returnMileage !== null && 
        data.startMileage < vehicle.returnMileage) {
      form.setError("startMileage", { 
        type: "manual", 
        message: `Start mileage must be at least ${vehicle.returnMileage} km (previous return mileage)` 
      });
      return; // Don't submit
    }
    
    // Require return mileage when status is "completed"
    if (data.status === "completed" && !data.departureMileage) {
      form.setError("departureMileage", { 
        type: "manual", 
        message: "Return mileage is required when completing a reservation" 
      });
      return; // Don't submit
    }
    
    // If status is "completed" and there's a start mileage, ensure return mileage is >= start mileage
    if (data.status === "completed" && 
        data.startMileage !== undefined && 
        data.departureMileage !== undefined && 
        data.departureMileage < data.startMileage) {
      form.setError("departureMileage", { 
        type: "manual", 
        message: "Return mileage must be greater than or equal to start mileage" 
      });
      return; // Don't submit
    }
    
    console.log("✅ All validations passed, calling mutation");
    // Passed all validations, submit the data
    statusChangeMutation.mutate(data);
  }
  
  // Get badge class for status display
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange} key={`dialog-${reservationId}`}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Reservation Status</DialogTitle>
          <DialogDescription>
            Track the current state of this reservation in the rental process.
          </DialogDescription>
        </DialogHeader>
        
        {/* Vehicle and Customer Information */}
        {(vehicle || customer) && (
          <div className="bg-muted/50 rounded-md p-3 mb-4 space-y-2">
            {vehicle && (
              <div className="space-y-1">
                <h3 className="font-medium text-sm">Vehicle Information</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">License:</span>
                    <span className="font-medium">{formatDisplayLicensePlate(vehicle.licensePlate)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">Vehicle:</span>
                    <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
                  </div>
                  {/* Show Pickup Mileage from Reservation */}
                  {pickupMileage !== undefined && pickupMileage !== null && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">At pickup:</span>
                      <span className="font-medium">{pickupMileage.toLocaleString()} km</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {customer && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm">Customer Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {/* Display customer full name from name field or firstName/lastName if available */}
                  {(customer.name || customer.firstName || customer.lastName) && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Name:</span>
                      <span className="font-medium">
                        {customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                  {customer.companyName && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Company:</span>
                      <span className="font-medium">{customer.companyName}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Phone:</span>
                      <span className="font-medium">{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Email:</span>
                      <span className="font-medium">{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Status field */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">Status</FormLabel>
                  <div className="flex items-center gap-2 mb-2">
                    <span>Current status:</span>
                    <Badge className={getStatusBadgeClass(initialStatus)}>
                      {formatReservationStatus(initialStatus)}
                    </Badge>
                  </div>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setCurrentStatus(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Booked</SelectItem>
                      <SelectItem value="confirmed">Vehicle picked up</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Vehicle returned</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the appropriate status based on where the vehicle is in the rental process.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Start Mileage field when status is confirmed */}
            {currentStatus === "confirmed" && vehicle && (
              <FormField
                control={form.control}
                name="startMileage"
                render={({ field }) => {
                  // We no longer make the field readonly, just use form validation instead
                  
                  return (
                    <FormItem>
                      <FormLabel>Mileage when picked up</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder={vehicle.returnMileage !== undefined && vehicle.returnMileage !== null
                              ? `Minimum ${vehicle.returnMileage}` 
                              : (vehicle.currentMileage && vehicle.currentMileage !== null ? vehicle.currentMileage.toString() : "Enter pickup mileage")}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {vehicle.returnMileage !== undefined && vehicle.returnMileage !== null
                          ? `Must be at least ${vehicle.returnMileage} km (previous return mileage)`
                          : "Enter the vehicle's odometer reading when it was picked up"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
            
            {/* Fuel Level at Pickup field when status is confirmed */}
            {currentStatus === "confirmed" && (
              <FormField
                control={form.control}
                name="fuelLevelPickup"
                render={({ field }) => (
                  <FormItem>
                      <FormLabel>Fuel Level at Pickup</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "not_recorded"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fuel level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="not_recorded">Not Recorded</SelectItem>
                          <SelectItem value="empty">Empty</SelectItem>
                          <SelectItem value="1/4">1/4</SelectItem>
                          <SelectItem value="1/2">1/2</SelectItem>
                          <SelectItem value="3/4">3/4</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Record the fuel level when the customer picked up the vehicle
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                )}
              />
            )}
            
            {/* Departure Mileage field when status is completed */}
            {currentStatus === "completed" && vehicle && (
              <FormField
                control={form.control}
                name="departureMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mileage when returned</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={pickupMileage ? `Pickup: ${pickupMileage.toLocaleString()} km` : "Enter return mileage"}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the vehicle's odometer reading when it was returned
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {/* Fuel tracking fields when status is completed */}
            {currentStatus === "completed" && (
              <>
                {/* Show Pickup Fuel Level (read-only) */}
                {initialFuelData?.fuelLevelPickup && initialFuelData.fuelLevelPickup !== "not_recorded" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Fuel at Pickup</h4>
                        <p className="text-xs text-blue-700 mt-0.5">Reference for comparison</p>
                      </div>
                      <Badge variant="outline" className="bg-white text-base font-semibold">
                        {initialFuelData.fuelLevelPickup}
                      </Badge>
                    </div>
                  </div>
                )}
                
                {/* Fuel Level at Return */}
                <FormField
                  control={form.control}
                  name="fuelLevelReturn"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Fuel Level at Return</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "not_recorded"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fuel level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="not_recorded">Not Recorded</SelectItem>
                            <SelectItem value="empty">Empty</SelectItem>
                            <SelectItem value="1/4">1/4</SelectItem>
                            <SelectItem value="1/2">1/2</SelectItem>
                            <SelectItem value="3/4">3/4</SelectItem>
                            <SelectItem value="full">Full</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Record the fuel level when the vehicle was returned
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                />
                
                {/* Fuel Cost */}
                <FormField
                  control={form.control}
                  name="fuelCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Cost (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter fuel cost if applicable"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter any fuel costs charged to the customer
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Fuel Receipt Upload */}
                <FormItem>
                  <FormLabel>Fuel Receipt (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFuelReceiptFile(file);
                          console.log('Fuel receipt selected:', file.name);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {fuelReceiptFile ? `Selected: ${fuelReceiptFile.name}` : 'Upload a receipt if you refilled the vehicle to full'}
                  </FormDescription>
                </FormItem>
                
                {/* Fuel Notes */}
                <FormField
                  control={form.control}
                  name="fuelNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any additional fuel-related notes"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Add any relevant notes about fuel usage or refueling
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={statusChangeMutation.isPending}>
                {statusChangeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    
    {/* Mileage Override Password Dialog */}
    {showPasswordDialog && pendingFormData && (
      <MileageOverridePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={handlePasswordConfirmed}
        currentMileage={vehicle?.currentMileage || vehicle?.departureMileage || 0}
        newMileage={pendingFormData.startMileage || 0}
      />
    )}
    </>
  );
}