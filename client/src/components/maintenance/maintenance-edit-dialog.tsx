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
  customerId: z.string().optional(), // Optional customer
  startDate: z.string().min(1, "Date when vehicle comes in is required"),
  maintenanceDuration: z.number().min(1, "Duration must be at least 1 day").max(90, "Duration cannot exceed 90 days"),
  maintenanceStatus: z.enum(["scheduled", "in", "out"]).default("scheduled"),
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

  // Fetch customers for optional selection
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['/api/customers'],
    enabled: open,
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
      vehicleId: reservation?.vehicleId || undefined,
      customerId: reservation?.customerId?.toString() || "none",
      startDate: reservation?.startDate || "",
      maintenanceDuration: reservation?.maintenanceDuration || 
        (reservation?.startDate && reservation?.endDate ? 
          Math.max(1, Math.ceil((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1),
      maintenanceStatus: (reservation?.maintenanceStatus === "in" || reservation?.maintenanceStatus === "out") ? reservation.maintenanceStatus : "in",
      notes: reservation?.notes || "",
    },
  });

  // Watch form values for real-time overlap computation  
  const formVehicleId = form.watch("vehicleId");
  const formStartDate = form.watch("startDate");
  const formDuration = form.watch("maintenanceDuration");
  
  // Calculate end date from start date + duration
  const calculateEndDate = (startDate: string, duration: number) => {
    if (!startDate || !duration) return startDate;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + duration - 1); // -1 because start day counts as day 1
    return end.toISOString().split('T')[0];
  };
  
  const formEndDate = formStartDate && formDuration ? calculateEndDate(formStartDate, formDuration) : "";
  
  // Use form values for overlap computation, fall back to reservation values
  const currentVehicleId = formVehicleId || reservation?.vehicleId;
  const currentStartDate = formStartDate || reservation?.startDate;
  const currentEndDate = formEndDate || (reservation?.startDate && reservation?.maintenanceDuration ? 
    calculateEndDate(reservation.startDate, reservation.maintenanceDuration) : reservation?.endDate) || "";

  // Fetch available spare vehicles for the maintenance period
  const { data: availableVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/available", currentStartDate, currentEndDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (currentStartDate) params.set('startDate', currentStartDate);
      if (currentEndDate) params.set('endDate', currentEndDate);
      return fetch(`/api/vehicles/available?${params.toString()}`).then(res => res.json());
    },
    enabled: !!(currentStartDate && currentEndDate && open),
  });

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
      const duration = reservation.maintenanceDuration || 
        (reservation.startDate && reservation.endDate ? 
          Math.max(1, Math.ceil((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1);
      
      form.reset({
        vehicleId: reservation.vehicleId || undefined,
        customerId: reservation.customerId?.toString() || "none",
        startDate: reservation.startDate,
        maintenanceDuration: duration,
        maintenanceStatus: (reservation.maintenanceStatus === "in" || reservation.maintenanceStatus === "out") ? reservation.maintenanceStatus : "in",
        notes: reservation.notes || "",
      });
    }
  }, [reservation, open, form]);

  // Update mutation - single source of truth approach
  const updateMutation = useMutation({
    mutationFn: async (data: MaintenanceEditFormType) => {
      if (!reservation) throw new Error("No reservation to update");
      
      // Calculate end date from start date + duration
      const endDate = calculateEndDate(data.startDate, data.maintenanceDuration);
      
      // If there are spare vehicle assignments, use the maintenance-with-spare endpoint
      if (spareVehicleAssignments.length > 0) {
        // Use maintenance-with-spare endpoint to update existing maintenance with spare assignments
        const response = await apiRequest("POST", "/api/reservations/maintenance-with-spare", {
          maintenanceId: reservation.id, // Reference existing maintenance to update
          maintenanceData: {
            vehicleId: data.vehicleId,
            customerId: (data.customerId && data.customerId !== "none") ? parseInt(data.customerId) : null,
            startDate: data.startDate,
            endDate: endDate,
            status: data.maintenanceStatus,
            type: "maintenance_block",
            notes: data.notes || "",
            totalPrice: 0,
            maintenanceDuration: data.maintenanceDuration,
            maintenanceStatus: data.maintenanceStatus,
          },
          conflictingReservations: overlappingRentals.map(rental => rental.reservation.id), // Send all overlapping rentals (including open-ended)
          spareVehicleAssignments: spareVehicleAssignments,
        });
        return await response.json();
      } else {
        // No spare assignments, just update the maintenance reservation directly
        const response = await apiRequest("PATCH", `/api/reservations/${reservation.id}`, {
          vehicleId: data.vehicleId,
          customerId: (data.customerId && data.customerId !== "none") ? parseInt(data.customerId) : null,
          startDate: data.startDate,
          endDate: endDate,
          status: data.maintenanceStatus,
          type: "maintenance_block",
          notes: data.notes || "",
          totalPrice: 0,
          maintenanceDuration: data.maintenanceDuration,
          maintenanceStatus: data.maintenanceStatus,
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

              {/* Customer (Optional) */}
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-customer">
                          <SelectValue placeholder="Select customer (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">None (no customer)</SelectItem>
                        {customers.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Who is bringing the vehicle in for maintenance?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration (days) */}
              <FormField
                control={form.control}
                name="maintenanceDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        placeholder="Number of days"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        value={field.value}
                        data-testid="input-maintenance-duration"
                      />
                    </FormControl>
                    <FormDescription>
                      How long will the maintenance take?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="maintenanceStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-maintenance-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled (vehicle not yet arrived)</SelectItem>
                        <SelectItem value="in">In (vehicle is in maintenance)</SelectItem>
                        <SelectItem value="out">Out (maintenance completed)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Current status of the maintenance
                    </FormDescription>
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
                                  // Add a "TBD" option for placeholder assignment
                                  { id: -1, licensePlate: "TBD-SPARE", brand: "TBD - Vehicle", model: "placeholder", vehicleType: "TBD" } as Vehicle,
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