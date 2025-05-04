import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const statusChangeSchema = z.object({
  status: z.string().min(1, { message: "Status is required" }),
  startMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
  departureMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
});

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
}: StatusChangeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  
  // Form setup
  const form = useForm<StatusChangeFormType>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: {
      status: initialStatus,
      startMileage: undefined,
      departureMileage: undefined,
    },
  });
  
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
      // We only need to update the vehicle if we have mileage data
      if (
        (data.status === "confirmed" && data.startMileage && vehicle?.id) ||
        (data.status === "completed" && data.departureMileage && vehicle?.id)
      ) {
        // First update the reservation status
        const reservationResponse = await apiRequest(
          "PATCH", 
          `/api/reservations/${reservationId}/status`,
          { status: data.status }
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
          // Use departureMileage for the start mileage since schema doesn't have currentMileage
          vehicleData.departureMileage = data.startMileage;
          hasMileageUpdate = true;
        }
        
        if (data.status === "completed" && data.departureMileage) {
          // Use returnMileage for the completed status (which is stored in departureMileage field)
          vehicleData.returnMileage = data.departureMileage;
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
        // Simple status update without mileage
        const response = await apiRequest(
          "PATCH", 
          `/api/reservations/${reservationId}/status`,
          { status: data.status }
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
      // Force refresh with immediate refetch after invalidation
      // First, invalidate all relevant queries
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/reservations"],
        refetchType: 'all'
      });
      
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/reservations/${reservationId}`],
        refetchType: 'all'
      });
      
      if (vehicle?.id) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/vehicles/${vehicle.id}`],
          refetchType: 'all'
        });
        
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/vehicles"],
          refetchType: 'all'
        });
      }
      
      // Force an immediate refetch of the data
      await queryClient.refetchQueries({ 
        queryKey: ["/api/reservations"],
        type: 'all' 
      });
      
      toast({
        title: "Status Updated",
        description: `Reservation status has been changed to ${currentStatus}.`,
      });
      
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
  
  function onSubmit(data: StatusChangeFormType) {
    statusChangeMutation.mutate(data);
  }
  
  // Get badge class for status display
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Reservation Status</DialogTitle>
          <DialogDescription>
            Update the status and related information for this reservation.
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
                  {vehicle.currentMileage !== undefined && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Current Mileage:</span>
                      <span className="font-medium">{vehicle.currentMileage.toLocaleString()} km</span>
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
                      {initialStatus}
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Start Mileage field when status is confirmed */}
            {currentStatus === "confirmed" && vehicle && (
              <FormField
                control={form.control}
                name="startMileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Mileage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={vehicle.currentMileage ? vehicle.currentMileage.toString() : "Enter starting mileage"}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the vehicle's odometer reading at the start of the reservation
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
                    <FormLabel>Mileage When Returned</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter final mileage"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the vehicle's odometer reading at the end of the reservation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
  );
}