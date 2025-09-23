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

// Spare vehicle assignment state
type SpareVehicleAssignment = {
  reservationId: number;
  spareVehicleId: number;
};

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
  
  // State for spare vehicle assignments
  const [spareVehicleAssignments, setSpareVehicleAssignments] = useState<SpareVehicleAssignment[]>([]);

  // Fetch vehicles for the selector
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Fetch available spare vehicles (basic query for now)
  const { data: availableVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/available"],
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

  // Watch form values for real-time overlap computation  
  const formVehicleId = form.watch("vehicleId");
  const formStartDate = form.watch("startDate");
  const formEndDate = form.watch("endDate");
  
  // Use form values for overlap computation, fall back to reservation values
  const currentVehicleId = formVehicleId || reservation?.vehicleId;
  const currentStartDate = formStartDate || reservation?.startDate;
  const currentEndDate = formEndDate || reservation?.endDate;

  const { data: overlappingRentals = [], isLoading: isLoadingRentals } = useQuery<{
    reservation: { id: number; startDate: string; endDate: string; status: string; type: string };
    customer: { name: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  }[]>({
    queryKey: ["/api/vehicles", currentVehicleId, "overlaps", currentStartDate, currentEndDate],
    queryFn: () => fetch(`/api/vehicles/${currentVehicleId}/overlaps?startDate=${currentStartDate}&endDate=${currentEndDate}`).then(res => res.json()),
    enabled: !!(currentVehicleId && currentStartDate && currentEndDate && open),
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

  // Update mutation - single source of truth approach
  const updateMutation = useMutation({
    mutationFn: async (data: MaintenanceEditFormType) => {
      if (!reservation) throw new Error("No reservation to update");
      
      // If there are spare vehicle assignments, use the maintenance-with-spare endpoint
      if (spareVehicleAssignments.length > 0) {
        // Use maintenance-with-spare endpoint to update existing maintenance with spare assignments
        const response = await apiRequest("POST", "/api/reservations/maintenance-with-spare", {
          maintenanceId: reservation.id, // Reference existing maintenance to update
          maintenanceData: {
            vehicleId: data.vehicleId,
            customerId: null,
            startDate: data.startDate,
            endDate: data.endDate,
            status: "confirmed",
            type: "maintenance_block",
            notes: data.notes || "",
            totalPrice: 0,
          },
          conflictingReservations: overlappingRentals.map(rental => rental.reservation.id), // Send all overlapping rentals (including open-ended)
          spareVehicleAssignments: spareVehicleAssignments,
        });
        return await response.json();
      } else {
        // No spare assignments, just update the maintenance reservation directly
        const response = await apiRequest("PATCH", `/api/reservations/${reservation.id}`, {
          vehicleId: data.vehicleId,
          customerId: null,
          startDate: data.startDate,
          endDate: data.endDate,
          status: "confirmed",
          type: "maintenance_block",
          notes: data.notes || "",
          totalPrice: 0,
        });
        return await response.json();
      }
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
      
      // Invalidate vehicle availability cache
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles/available"] });
      
      // Invalidate overlaps for both original and current form values
      const originalVehicleId = reservation?.vehicleId;
      const originalStartDate = reservation?.startDate;
      const originalEndDate = reservation?.endDate;
      
      // Invalidate original overlaps
      if (originalVehicleId) {
        queryClient.invalidateQueries({ queryKey: ["/api/vehicles", originalVehicleId, "overlaps", originalStartDate, originalEndDate] });
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key[0] === "/api/vehicles" && key[1] === originalVehicleId && key[2] === "overlaps";
          }
        });
      }
      
      // Invalidate current form values overlaps (if different)
      if (currentVehicleId && currentVehicleId !== originalVehicleId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key[0] === "/api/vehicles" && key[1] === currentVehicleId && key[2] === "overlaps";
          }
        });
      }
      
      // Invalidate vehicle caches for all spare vehicles assigned
      spareVehicleAssignments.forEach(assignment => {
        const spareVehicleId = assignment.spareVehicleId;
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key[0] === "/api/vehicles" && key[1] === spareVehicleId;
          }
        });
      });
      
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
    // No validation required - spare vehicle assignment is optional
    // Customers can choose to use spare vehicles or manage without them
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

              {/* Spare Vehicle Assignment for Overlapping Rentals */}
              <div className="col-span-full" data-testid="section-spare-vehicles">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Spare Vehicle Assignment
                </div>
                {isLoadingRentals ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border" data-testid="loading-rentals">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Loading rental information...
                    </div>
                  </div>
                ) : overlappingRentals.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">
                        Active rentals during maintenance (spare vehicle assignment is optional):
                      </div>
                      {overlappingRentals.map((rental: { reservation: { id: number; startDate: string; endDate: string; status: string; type: string }; customer: { name: string; firstName?: string; lastName?: string; email?: string; phone?: string } }, index: number) => (
                        <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-lg border mb-2" data-testid={`overlapping-rental-${index}`}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {rental.customer.firstName || rental.customer.name} {rental.customer.lastName || ''}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Rental: {rental.reservation.startDate} to {rental.reservation.endDate}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Status: {rental.reservation.status}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Assign Spare Vehicle (Optional):
                              </label>
                              <VehicleSelector
                                vehicles={[
                                  // Add a "no vehicle" option by creating a dummy vehicle
                                  { id: 0, licensePlate: "NO-SPARE", brand: "No spare vehicle", model: "needed", vehicleType: "None" } as Vehicle,
                                  ...availableVehicles
                                ]}
                                value={spareVehicleAssignments.find(a => a.reservationId === rental.reservation.id)?.spareVehicleId?.toString() || "0"}
                                onChange={(value) => {
                                  const spareVehicleId = parseInt(value);
                                  if (spareVehicleId && spareVehicleId !== 0) {
                                    setSpareVehicleAssignments(prev => [
                                      ...prev.filter(a => a.reservationId !== rental.reservation.id),
                                      { reservationId: rental.reservation.id, spareVehicleId }
                                    ]);
                                  } else {
                                    setSpareVehicleAssignments(prev => 
                                      prev.filter(a => a.reservationId !== rental.reservation.id)
                                    );
                                  }
                                }}
                                placeholder="Select spare vehicle..."
                                disabled={availableVehicles.length === 0}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border" data-testid="no-overlapping-rentals">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      No active rentals overlap this maintenance period
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