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
    currentMileage?: number;
  };
  onStatusChanged?: () => void;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  reservationId,
  initialStatus,
  vehicle,
  onStatusChanged,
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
    setCurrentStatus(form.watch("status"));
  }, [form.watch("status")]);
  
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
          `/api/reservations/${reservationId}`,
          { status: data.status }
        );
        
        if (!reservationResponse.ok) {
          const errorData = await reservationResponse.json();
          throw new Error(errorData.message || "Failed to update reservation status");
        }
        
        // Then update the vehicle mileage based on status
        const vehicleData: any = { id: vehicle.id };
        
        if (data.status === "confirmed" && data.startMileage) {
          vehicleData.currentMileage = data.startMileage;
        }
        
        if (data.status === "completed" && data.departureMileage) {
          vehicleData.departureMileage = data.departureMileage;
        }
        
        const vehicleResponse = await apiRequest(
          "PATCH",
          `/api/vehicles/${vehicle.id}`,
          vehicleData
        );
        
        if (!vehicleResponse.ok) {
          const errorData = await vehicleResponse.json();
          throw new Error(errorData.message || "Failed to update vehicle mileage");
        }
        
        return await reservationResponse.json();
      } else {
        // Simple status update without mileage
        const response = await apiRequest(
          "PATCH", 
          `/api/reservations/${reservationId}`,
          { status: data.status }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update reservation status");
        }
        
        return await response.json();
      }
    },
    onSuccess: async () => {
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/reservations/${reservationId}`] });
      
      if (vehicle?.id) {
        await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicle.id}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      }
      
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Reservation Status</DialogTitle>
          <DialogDescription>
            Update the status and related information for this reservation.
          </DialogDescription>
        </DialogHeader>
        
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