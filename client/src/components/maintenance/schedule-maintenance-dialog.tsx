import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Vehicle } from "@shared/schema";
import { formatLicensePlate } from "@/lib/format-utils";

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
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { Loader2, Calendar, AlertTriangle, Wrench, Clock, Car } from "lucide-react";

const scheduleMaintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Please select a vehicle"),
  maintenanceType: z.enum([
    "breakdown", 
    "tire_replacement", 
    "brake_service", 
    "engine_repair", 
    "transmission_repair",
    "electrical_issue",
    "air_conditioning",
    "battery_replacement",
    "oil_change",
    "regular_maintenance", 
    "apk_inspection", 
    "warranty_service",
    "accident_damage",
    "other"
  ], {
    required_error: "Please select a maintenance type",
  }),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  estimatedDuration: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  description: z.string().optional(),
  notes: z.string().optional(),
  needsSpareVehicle: z.boolean().default(false),
});

type ScheduleMaintenanceFormData = z.infer<typeof scheduleMaintenanceSchema>;

interface ScheduleMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingReservation?: any; // Reservation being edited, null for new reservations
}

export function ScheduleMaintenanceDialog({
  open,
  onOpenChange,
  onSuccess,
  editingReservation,
}: ScheduleMaintenanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for spare vehicle selection
  const [showSpareDialog, setShowSpareDialog] = useState(false);
  const [conflictingReservations, setConflictingReservations] = useState<any[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [spareVehicleAssignments, setSpareVehicleAssignments] = useState<{[reservationId: number]: number}>({});

  // Fetch all vehicles for selection
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
    enabled: open, // Only fetch when dialog is open
  });

  const form = useForm<ScheduleMaintenanceFormData>({
    resolver: zodResolver(scheduleMaintenanceSchema),
    defaultValues: {
      vehicleId: "",
      maintenanceType: "breakdown",
      scheduledDate: new Date().toISOString().split('T')[0], // Default to today
      estimatedDuration: "",
      priority: "high", // Default to high priority for unplanned maintenance
      description: "",
      notes: "",
      needsSpareVehicle: false,
    },
  });

  // Reset form when editing reservation changes
  useEffect(() => {
    if (editingReservation) {
      // Parse maintenance data from the reservation
      const noteParts = editingReservation.notes?.split(':') || [];
      const maintenanceType = noteParts[0] || "breakdown";
      const descriptionPart = noteParts[1]?.split('\n')[0]?.trim() || "";
      const notesPart = editingReservation.notes?.split('\n')[1]?.trim() || "";
      
      form.reset({
        vehicleId: editingReservation.vehicleId?.toString() || "",
        maintenanceType,
        scheduledDate: editingReservation.startDate || new Date().toISOString().split('T')[0],
        estimatedDuration: "",
        priority: "high",
        description: descriptionPart,
        notes: notesPart,
        needsSpareVehicle: false,
      });
    } else {
      // Reset to default values for new maintenance
      form.reset({
        vehicleId: "",
        maintenanceType: "breakdown",
        scheduledDate: new Date().toISOString().split('T')[0],
        estimatedDuration: "",
        priority: "high",
        description: "",
        notes: "",
        needsSpareVehicle: false,
      });
    }
  }, [editingReservation, form]);

  const scheduleMaintenanceMutation = useMutation({
    mutationFn: async (data: ScheduleMaintenanceFormData) => {
      const payload = {
        vehicleId: parseInt(data.vehicleId),
        customerId: null, // No customer for maintenance blocks
        startDate: data.scheduledDate,
        endDate: data.scheduledDate, // Same day by default
        status: "confirmed",
        type: "maintenance_block",
        notes: `${data.maintenanceType}: ${data.description || ''}\n${data.notes || ''}`.trim(),
        totalPrice: 0,
      };
      
      console.log('Sending payload:', payload);
      
      // Use PATCH for editing, POST for creating
      const method = editingReservation ? "PATCH" : "POST";
      const url = editingReservation ? `/api/reservations/${editingReservation.id}/basic` : "/api/reservations";
      
      const response = await apiRequest(method, url, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to schedule maintenance");
      }

      const result = await response.json();
      
      // Check if spare vehicles are needed
      if (result.needsSpareVehicle) {
        setConflictingReservations(result.conflictingReservations);
        setMaintenanceData(result.maintenanceData);
        setShowSpareDialog(true);
        return null; // Don't proceed with success yet
      }

      return result;
    },
    onSuccess: (result) => {
      if (result === null) return; // Spare vehicle dialog will handle this
      
      // Invalidate related queries to refresh the calendar
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations/range'] });
      
      toast({
        title: editingReservation ? "Maintenance updated" : "Maintenance scheduled",
        description: editingReservation 
          ? "The maintenance event has been updated successfully."
          : "The maintenance event has been scheduled successfully.",
      });
      onSuccess?.();
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for creating maintenance with spare vehicle assignments
  const createMaintenanceWithSpareMutation = useMutation({
    mutationFn: async (data: { 
      maintenanceData: any; 
      conflictingReservations: any[]; 
      spareVehicleAssignments: {[reservationId: number]: number} 
    }) => {
      const assignmentsArray = Object.entries(data.spareVehicleAssignments).map(([reservationId, spareVehicleId]) => ({
        reservationId: parseInt(reservationId),
        spareVehicleId
      }));

      const response = await apiRequest("POST", "/api/reservations/maintenance-with-spare", {
        body: JSON.stringify({
          maintenanceData: data.maintenanceData,
          conflictingReservations: data.conflictingReservations,
          spareVehicleAssignments: assignmentsArray
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to schedule maintenance with spare vehicles");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries to refresh the calendar
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations/range'] });
      
      toast({
        title: "Maintenance scheduled",
        description: "Maintenance scheduled and spare vehicles assigned to affected reservations.",
      });
      
      // Reset all states
      setShowSpareDialog(false);
      setConflictingReservations([]);
      setMaintenanceData(null);
      setSpareVehicleAssignments({});
      
      onSuccess?.();
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ScheduleMaintenanceFormData) => {
    console.log('Form data:', data);
    
    // Validate required fields before submitting
    if (!data.vehicleId || data.vehicleId === "") {
      toast({
        title: "Validation Error",
        description: "Please select a vehicle",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.scheduledDate) {
      toast({
        title: "Validation Error", 
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }
    
    scheduleMaintenanceMutation.mutate(data);
  };

  const getMaintenanceTypeInfo = (type: string) => {
    switch (type) {
      case "breakdown":
        return { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Vehicle Breakdown", urgent: true };
      case "tire_replacement":
        return { icon: <Car className="w-4 h-4 text-orange-500" />, label: "Tire Replacement", urgent: false };
      case "brake_service":
        return { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Brake Service", urgent: true };
      case "engine_repair":
        return { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Engine Repair", urgent: true };
      case "transmission_repair":
        return { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Transmission Repair", urgent: true };
      case "electrical_issue":
        return { icon: <Wrench className="w-4 h-4 text-yellow-500" />, label: "Electrical Issue", urgent: false };
      case "air_conditioning":
        return { icon: <Wrench className="w-4 h-4 text-blue-500" />, label: "Air Conditioning", urgent: false };
      case "battery_replacement":
        return { icon: <Wrench className="w-4 h-4 text-yellow-500" />, label: "Battery Replacement", urgent: false };
      case "oil_change":
        return { icon: <Wrench className="w-4 h-4 text-blue-500" />, label: "Oil Change", urgent: false };
      case "regular_maintenance":
        return { icon: <Wrench className="w-4 h-4 text-blue-500" />, label: "Regular Maintenance", urgent: false };
      case "apk_inspection":
        return { icon: <Clock className="w-4 h-4 text-green-500" />, label: "APK Inspection", urgent: false };
      case "warranty_service":
        return { icon: <Clock className="w-4 h-4 text-green-500" />, label: "Warranty Service", urgent: false };
      case "accident_damage":
        return { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Accident Damage", urgent: true };
      case "other":
        return { icon: <Wrench className="w-4 h-4 text-gray-500" />, label: "Other", urgent: false };
      default:
        return { icon: <Wrench className="w-4 h-4" />, label: "Maintenance", urgent: false };
    }
  };

  const selectedVehicle = vehicles.find(v => v.id.toString() === form.watch('vehicleId'));

  // Fetch available vehicles for spare assignment during the maintenance period
  const { data: availableVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/available', {
      startDate: maintenanceData?.scheduledDate,
      endDate: maintenanceData?.scheduledDate, // For now, maintenance is single day
      excludeVehicleId: maintenanceData?.vehicleId
    }],
    enabled: showSpareDialog && maintenanceData?.scheduledDate && maintenanceData?.vehicleId, // Only fetch when spare dialog is open and we have maintenance data
  });

  const handleSpareVehicleAssignment = () => {
    // Only check reservations that can actually get spare vehicles (not open-ended ones)
    const reservationsNeedingSpares = conflictingReservations.filter(r => {
      return r.endDate && r.endDate !== "undefined" && r.endDate !== null;
    });
    
    const missingAssignments = reservationsNeedingSpares.filter(r => !spareVehicleAssignments[r.id]);
    
    if (missingAssignments.length > 0) {
      toast({
        title: "Missing Spare Vehicles",
        description: "Please assign spare vehicles to all affected reservations that need them.",
        variant: "destructive",
      });
      return;
    }

    createMaintenanceWithSpareMutation.mutate({
      maintenanceData,
      conflictingReservations,
      spareVehicleAssignments
    });
  };

  const handleSpareVehicleChange = (reservationId: number, spareVehicleId: string) => {
    setSpareVehicleAssignments(prev => ({
      ...prev,
      [reservationId]: parseInt(spareVehicleId)
    }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-schedule-maintenance">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            {editingReservation ? "Edit Maintenance" : "Schedule Maintenance"}
          </DialogTitle>
          <DialogDescription>
            Report breakdowns, schedule repairs, or plan maintenance for your vehicles. Perfect for when a vehicle needs immediate attention or has worn parts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <FormControl>
                    {vehiclesLoading ? (
                      <div className="flex items-center justify-center p-2 border rounded-md">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2">Loading vehicles...</span>
                      </div>
                    ) : (
                      <div data-testid="select-vehicle">
                        <VehicleSelector
                          vehicles={vehicles}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select a vehicle..."
                        />
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maintenanceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maintenance Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-maintenance-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      <SelectItem value="breakdown">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">Vehicle Breakdown</div>
                            <div className="text-xs text-gray-500">Car won't start, engine issues</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="tire_replacement">
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-orange-500" />
                          <div>
                            <div className="font-medium">Tire Replacement</div>
                            <div className="text-xs text-gray-500">Worn tires, punctures</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="brake_service">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">Brake Service</div>
                            <div className="text-xs text-gray-500">Worn brake pads, brake fluid</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="engine_repair">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">Engine Repair</div>
                            <div className="text-xs text-gray-500">Engine problems, overheating</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="transmission_repair">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">Transmission Repair</div>
                            <div className="text-xs text-gray-500">Gear shifting issues</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="electrical_issue">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-yellow-500" />
                          <div>
                            <div className="font-medium">Electrical Issue</div>
                            <div className="text-xs text-gray-500">Lights, sensors, electronics</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="air_conditioning">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">Air Conditioning</div>
                            <div className="text-xs text-gray-500">A/C repair, gas refill</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="battery_replacement">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-yellow-500" />
                          <div>
                            <div className="font-medium">Battery Replacement</div>
                            <div className="text-xs text-gray-500">Dead battery, charging issues</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="oil_change">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">Oil Change</div>
                            <div className="text-xs text-gray-500">Regular oil service</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="regular_maintenance">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">Regular Maintenance</div>
                            <div className="text-xs text-gray-500">Scheduled service</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="apk_inspection">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">APK Inspection</div>
                            <div className="text-xs text-gray-500">Annual vehicle inspection</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="warranty_service">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">Warranty Service</div>
                            <div className="text-xs text-gray-500">Covered repairs</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="accident_damage">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">Accident Damage</div>
                            <div className="text-xs text-gray-500">Collision repairs</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="other">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-gray-500" />
                          <div>
                            <div className="font-medium">Other</div>
                            <div className="text-xs text-gray-500">Custom maintenance</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduledDate"
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
                    <FormDescription>
                      When should this maintenance be performed?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Duration</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 2 hours, 1 day"
                        {...field}
                        data-testid="input-estimated-duration"
                      />
                    </FormControl>
                    <FormDescription>
                      How long will this take?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief description of the maintenance"
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes or special instructions..."
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedVehicle && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
                  <Calendar className="w-4 h-4" />
                  Selected Vehicle
                </div>
                <div className="text-blue-700">
                  {selectedVehicle.brand} {selectedVehicle.model} ({formatLicensePlate(selectedVehicle.licensePlate)})
                </div>
                {selectedVehicle.apkDate && (
                  <div className="text-sm text-blue-600 mt-1">
                    Current APK Date: {selectedVehicle.apkDate}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={scheduleMaintenanceMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={scheduleMaintenanceMutation.isPending}
                data-testid="button-schedule"
              >
                {scheduleMaintenanceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingReservation ? "Updating..." : "Scheduling..."}
                  </>
                ) : (
                  editingReservation ? "Update Maintenance" : "Schedule Maintenance"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Spare Vehicle Selection Dialog */}
    <Dialog open={showSpareDialog} onOpenChange={setShowSpareDialog}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-orange-600" />
            Assign Spare Vehicles
          </DialogTitle>
          <DialogDescription>
            The selected vehicle has active reservations during the maintenance period. Please assign spare vehicles to affected customers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conflictingReservations.map((reservation: any) => {
            // Check if this is an open-ended rental
            const isOpenEnded = !reservation.endDate || reservation.endDate === "undefined" || reservation.endDate === null;
            
            if (isOpenEnded) {
              return (
                <div key={reservation.id} className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <h4 className="font-medium text-yellow-800">
                      {reservation.customer?.name || 'Unknown Customer'} - Open-ended Rental
                    </h4>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    Reservation: {reservation.startDate} - <span className="font-medium">No end date</span>
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    Original vehicle: {reservation.vehicle?.brand} {reservation.vehicle?.model} ({formatLicensePlate(reservation.vehicle?.licensePlate)})
                  </p>
                  <p className="text-sm text-yellow-700 mt-2 font-medium">
                    ⚠️ Cannot assign spare vehicle: Customer already has the vehicle indefinitely. Contact customer directly about maintenance.
                  </p>
                </div>
              );
            }
            
            return (
              <div key={reservation.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">
                      {reservation.customer?.name || 'Unknown Customer'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Reservation: {reservation.startDate} - {reservation.endDate}
                    </p>
                    <p className="text-sm text-gray-500">
                      Original vehicle: {reservation.vehicle?.brand} {reservation.vehicle?.model} ({formatLicensePlate(reservation.vehicle?.licensePlate)})
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Select Spare Vehicle:</label>
                  <div className="mt-1" data-testid={`select-spare-vehicle-${reservation.id}`}>
                    <VehicleSelector
                      vehicles={availableVehicles}
                      value={spareVehicleAssignments[reservation.id]?.toString() || ""}
                      onChange={(value) => handleSpareVehicleChange(reservation.id, value)}
                      placeholder="Choose a spare vehicle..."
                      disabled={availableVehicles.length === 0}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowSpareDialog(false);
              setConflictingReservations([]);
              setMaintenanceData(null);
              setSpareVehicleAssignments({});
            }}
            disabled={createMaintenanceWithSpareMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSpareVehicleAssignment}
            disabled={createMaintenanceWithSpareMutation.isPending}
          >
            {createMaintenanceWithSpareMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Spare Vehicles & Schedule Maintenance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}