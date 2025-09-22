import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertReservationSchema } from "@shared/schema";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { format, addDays, parseISO } from "date-fns";
import { Reservation, Vehicle, Customer } from "@shared/schema";
import { Loader2 } from "lucide-react";

// Form schema for maintenance editing - only fields that can be edited
const maintenanceEditSchema = z.object({
  vehicleId: z.union([
    z.number().min(1, "Please select a vehicle"),
    z.string().min(1, "Please select a vehicle").transform(val => parseInt(val)),
  ]),
  startDate: z.string().min(1, "Please select a date"),
  endDate: z.string().min(1, "Please select an end date"),
  notes: z.string().optional(),
});

type MaintenanceEditFormType = z.infer<typeof maintenanceEditSchema>;

interface MaintenanceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
}

export function MaintenanceEditDialog({
  open,
  onOpenChange,
  reservation
}: MaintenanceEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch vehicles for the selector
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Fetch current renter information for this vehicle during maintenance period
  const vehicleId = reservation?.vehicleId;
  const startDate = reservation?.startDate;
  const endDate = reservation?.endDate;

  const { data: currentRenters = [], isLoading: isLoadingRenters } = useQuery<{
    reservation: { id: number; startDate: string; endDate: string };
    customer: { name: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  }[]>({
    queryKey: ["/api/vehicles", vehicleId, "overlaps", startDate, endDate],
    queryFn: () => fetch(`/api/vehicles/${vehicleId}/overlaps?startDate=${startDate}&endDate=${endDate}`).then(res => res.json()),
    enabled: !!(vehicleId && startDate && endDate && open),
  });

  // Parse the maintenance notes to extract structured data
  const parseMaintenanceNotes = (notes: string) => {
    const lines = notes.split('\n');
    const maintenanceType = lines[0]?.split(': ')[0] || '';
    const description = lines[0]?.split(': ')[1] || '';
    const additionalNotes = lines.slice(1).join('\n');
    
    return {
      maintenanceType,
      description,
      notes: additionalNotes
    };
  };

  // Initialize form with reservation data
  const form = useForm<MaintenanceEditFormType>({
    resolver: zodResolver(maintenanceEditSchema),
    defaultValues: {
      vehicleId: reservation?.vehicleId || 0,
      startDate: reservation?.startDate || "",
      endDate: reservation?.endDate || "",
      notes: reservation?.notes || "",
    },
  });

  // Reset form when reservation changes
  useEffect(() => {
    if (reservation && open) {
      const parsed = parseMaintenanceNotes(reservation.notes || '');
      form.reset({
        vehicleId: reservation.vehicleId,
        startDate: reservation.startDate,
        endDate: reservation.endDate || "",
        notes: reservation.notes || "",
      });
    }
  }, [reservation, open, form]);

  // Update mutation using the standard reservations endpoint
  const updateMutation = useMutation({
    mutationFn: async (data: MaintenanceEditFormType) => {
      if (!reservation) throw new Error("No reservation to update");
      
      const response = await apiRequest("PATCH", `/api/reservations/${reservation.id}`, {
        vehicleId: data.vehicleId,
        customerId: null, // Maintenance blocks don't assign customers
        startDate: data.startDate,
        endDate: data.endDate,
        status: "confirmed",
        type: "maintenance_block",
        notes: data.notes || "",
        totalPrice: 0,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Maintenance reservation updated successfully",
      });
      
      // Invalidate all reservation-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations/upcoming"] });
      // Invalidate overlaps query to refresh current renter information
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "overlaps"] });
      
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating maintenance:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update maintenance reservation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MaintenanceEditFormType) => {
    console.log("Submitting maintenance edit:", data);
    updateMutation.mutate(data);
  };

  if (!reservation) {
    return null;
  }

  const parsed = parseMaintenanceNotes(reservation.notes || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Maintenance Reservation</DialogTitle>
          <DialogDescription>
            Update the maintenance details for this reservation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vehicle Selection */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Vehicle</FormLabel>
                    <FormControl>
                      <VehicleSelector
                        vehicles={vehicles}
                        value={field.value?.toString() || ""}
                        onChange={(value: string) => field.onChange(parseInt(value))}
                        placeholder="Select a vehicle"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Maintenance Type - parsed from notes (display only) */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Maintenance Type
                </label>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-md border text-sm" data-testid="display-maintenance-type">
                  {parsed.maintenanceType || 'Not specified'}
                </div>
              </div>

              {/* Scheduled Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-scheduled-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Current Renter Information */}
              <div className="col-span-full" data-testid="section-current-renter">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Customer Currently Renting This Vehicle
                </div>
                {isLoadingRenters ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border" data-testid="loading-current-renter">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Loading current renter information...
                    </div>
                  </div>
                ) : currentRenters.length > 0 ? (
                  <div className="space-y-2">
                    {currentRenters.map((rental: { reservation: { id: number; startDate: string; endDate: string }; customer: { name: string; firstName?: string; lastName?: string; email?: string; phone?: string } }, index: number) => (
                      <div key={index} className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800" data-testid={`current-renter-${index}`}>
                        <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                          Contact Information for Maintenance Updates
                        </div>
                        <div className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                          <div data-testid="text-customer-name"><strong>Customer:</strong> {rental.customer.name} {rental.customer.firstName} {rental.customer.lastName}</div>
                          {rental.customer.email && (
                            <div data-testid="text-customer-email"><strong>Email:</strong> {rental.customer.email}</div>
                          )}
                          {rental.customer.phone && (
                            <div data-testid="text-customer-phone"><strong>Phone:</strong> {rental.customer.phone}</div>
                          )}
                          <div data-testid="text-rental-period"><strong>Rental Period:</strong> {rental.reservation.startDate} to {rental.reservation.endDate}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border" data-testid="no-current-renter">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      No active rental overlaps this maintenance period
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes about this maintenance..."
                      className="min-h-[100px]"
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-update-maintenance"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Maintenance"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}