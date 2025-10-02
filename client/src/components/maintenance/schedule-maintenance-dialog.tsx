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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar, AlertTriangle, Wrench, Clock, Car, Filter } from "lucide-react";

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
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date (YYYY-MM-DD)").min(1, "Scheduled date is required"),
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
  initialDate?: string; // Initial date to pre-select when scheduling new maintenance
  initialVehicleId?: number; // Initial vehicle to pre-select
  initialMaintenanceType?: ScheduleMaintenanceFormData["maintenanceType"]; // Initial maintenance type to pre-select
}

export function ScheduleMaintenanceDialog({
  open,
  onOpenChange,
  onSuccess,
  editingReservation,
  initialDate,
  initialVehicleId,
  initialMaintenanceType,
}: ScheduleMaintenanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for spare vehicle selection
  const [showSpareDialog, setShowSpareDialog] = useState(false);
  const [conflictingReservations, setConflictingReservations] = useState<any[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  const [spareVehicleAssignments, setSpareVehicleAssignments] = useState<{[reservationId: number]: number | 'tbd'}>({});
  
  // State for vehicle filtering
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [excludeMaintenanceVehicles, setExcludeMaintenanceVehicles] = useState(false);

  const form = useForm<ScheduleMaintenanceFormData>({
    resolver: zodResolver(scheduleMaintenanceSchema),
    defaultValues: {
      vehicleId: initialVehicleId?.toString() || "",
      maintenanceType: initialMaintenanceType || "breakdown",
      scheduledDate: initialDate || new Date().toISOString().split('T')[0], // Use initialDate if provided, otherwise today
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
        vehicleId: initialVehicleId?.toString() || "",
        maintenanceType: initialMaintenanceType || "breakdown",
        scheduledDate: initialDate || new Date().toISOString().split('T')[0],
        estimatedDuration: "",
        priority: "high",
        description: "",
        notes: "",
        needsSpareVehicle: false,
      });
    }
  }, [editingReservation, initialDate, initialVehicleId, initialMaintenanceType, form]);

  // Get selected date for filtering (after form is defined)
  const scheduledDate = form.watch('scheduledDate');
  
  // Get current vehicle ID to exclude from filters when editing
  const currentVehicleId = editingReservation?.vehicleId || (form.watch('vehicleId') ? parseInt(form.watch('vehicleId')) : undefined);
  
  // Fetch vehicles based on filter settings
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: showAvailableOnly 
      ? ['/api/vehicles/available', { 
          startDate: scheduledDate, 
          endDate: scheduledDate,
          excludeVehicleId: currentVehicleId // Keep current vehicle in list when editing
        }]
      : ['/api/vehicles'],
    enabled: open, // Only fetch when dialog is open
  });

  // Fetch all reservations to filter out vehicles with maintenance (if filter is enabled)
  const { data: allReservations = [] } = useQuery<any[]>({
    queryKey: ['/api/reservations'],
    enabled: open && excludeMaintenanceVehicles, // Only fetch when needed
  });

  // Helper function to check if a date falls within a range
  const dateInRange = (checkDate: string, startDate: string, endDate?: string) => {
    const check = new Date(checkDate);
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    
    // Normalize to date-only comparison
    check.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return check >= start && check <= end;
  };

  // Filter vehicles based on current filters
  const filteredVehicles = vehicles.filter(vehicle => {
    // If excluding maintenance vehicles, check if this vehicle has maintenance that overlaps the scheduled date
    if (excludeMaintenanceVehicles && scheduledDate) {
      const hasMaintenanceConflict = allReservations.some(reservation => 
        reservation.vehicleId === vehicle.id &&
        reservation.type === 'maintenance_block' &&
        reservation.id !== editingReservation?.id && // Don't exclude current editing reservation
        dateInRange(scheduledDate, reservation.startDate, reservation.endDate)
      );
      if (hasMaintenanceConflict) return false;
    }
    return true;
  });

  const scheduleMaintenanceMutation = useMutation({
    mutationFn: async (data: ScheduleMaintenanceFormData) => {
      // Validate and sanitize the scheduled date
      const startDate = data.scheduledDate?.trim();
      if (!startDate || startDate === 'undefined') {
        throw new Error('Please select a valid scheduled date');
      }
      
      const payload = {
        vehicleId: parseInt(data.vehicleId),
        customerId: null, // No customer for maintenance blocks
        startDate: startDate,
        endDate: startDate, // Same day by default - always use startDate, never undefined
        status: "confirmed",
        type: "maintenance_block",
        notes: `${data.maintenanceType}: ${data.description || ''}\n${data.notes || ''}`.trim(),
        totalPrice: 0,
      };
      
      // Final safety check - never send undefined values
      if (payload.endDate === 'undefined' || !payload.endDate) {
        payload.endDate = payload.startDate;
      }
      
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
        console.log('🚗 Spare vehicles needed! Showing spare dialog...', result);
        console.log('Conflicting reservations:', result.conflictingReservations);
        console.log('Maintenance reservation ID:', result.maintenanceReservationId);
        setConflictingReservations(result.conflictingReservations);
        setMaintenanceData({
          ...result.maintenanceData,
          maintenanceId: result.maintenanceReservationId // Store the created maintenance ID
        });
        
        // Close the maintenance dialog before showing spare dialog
        onOpenChange(false);
        
        // Small delay to ensure smooth transition between dialogs
        setTimeout(() => {
          setShowSpareDialog(true);
        }, 100);
        
        return null; // Don't proceed with success yet
      }

      return result;
    },
    onSuccess: (result) => {
      if (result === null) return; // Spare vehicle dialog will handle this
      
      // Use aggressive cache invalidation that catches all query variations
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/vehicles') || 
                 key?.startsWith('/api/reservations') || 
                 key?.startsWith('/api/placeholder-reservations');
        }
      });
      
      // Force immediate refetch of critical data
      queryClient.refetchQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.refetchQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      queryClient.refetchQueries({ queryKey: ['/api/reservations'] });
      queryClient.refetchQueries({ queryKey: ['/api/reservations/range'] });
      
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

  // Mutation for creating placeholder reservations
  const createPlaceholderMutation = useMutation({
    mutationFn: async (data: {
      originalReservationId: number;
      customerId: number;
      startDate: string;
      endDate?: string;
    }) => {
      const response = await apiRequest("POST", "/api/placeholder-reservations", {
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create placeholder reservation");
      }

      return response.json();
    }
  });

  // Mutation for handling spare vehicle assignments (maintenance already created)
  const createMaintenanceWithSpareMutation = useMutation({
    mutationFn: async (data: { 
      maintenanceData: any; 
      conflictingReservations: any[]; 
      spareVehicleAssignments: {[reservationId: number]: number | 'tbd'} 
    }) => {
      // Separate TBD and specific assignments
      const tbdAssignments: any[] = [];
      const specificAssignments: any[] = [];

      Object.entries(data.spareVehicleAssignments).forEach(([reservationId, assignment]) => {
        const reservation = data.conflictingReservations.find(r => r.id.toString() === reservationId);
        if (assignment === 'tbd') {
          tbdAssignments.push({
            reservationId: parseInt(reservationId),
            reservation
          });
        } else {
          specificAssignments.push({
            reservationId: parseInt(reservationId),
            spareVehicleId: assignment
          });
        }
      });

      // Create placeholder reservations for TBD assignments
      for (const tbdAssignment of tbdAssignments) {
        // Validate that we have the reservation data
        if (!tbdAssignment.reservation) {
          console.error('Missing reservation data for TBD assignment:', tbdAssignment);
          continue;
        }
        
        // Validate required fields
        const reservationId = parseInt(tbdAssignment.reservationId);
        const customerId = parseInt(tbdAssignment.reservation.customerId);
        
        if (isNaN(reservationId) || isNaN(customerId)) {
          console.error('Invalid reservation or customer ID:', { reservationId, customerId });
          continue;
        }
        
        // Calculate the overlap between maintenance window and original reservation
        const maintenanceStart = data.maintenanceData.startDate;
        const maintenanceEnd = data.maintenanceData.endDate || data.maintenanceData.startDate;
        const reservationStart = tbdAssignment.reservation.startDate;
        const reservationEnd = tbdAssignment.reservation.endDate;
        
        // Validate dates
        if (!maintenanceStart || !reservationStart) {
          console.error('Missing required dates:', { maintenanceStart, reservationStart });
          continue;
        }
        
        // Check if rental is open-ended (no end date)
        const isOpenEnded = !reservationEnd || reservationEnd === null || reservationEnd === 'undefined';
        
        // Calculate intersection dates (overlap period)
        // For open-ended rentals, the placeholder should cover the entire maintenance period
        const overlapStart = reservationStart > maintenanceStart ? reservationStart : maintenanceStart;
        const overlapEnd = isOpenEnded ? maintenanceEnd : (reservationEnd < maintenanceEnd ? reservationEnd : maintenanceEnd);
        
        // Check if there's any overlap
        // For open-ended rentals: rental must start before or during maintenance
        // For closed rentals: normal overlap check
        const hasOverlap = isOpenEnded 
          ? (reservationStart <= maintenanceEnd) 
          : (overlapStart <= overlapEnd);
        
        if (hasOverlap) {
          console.log('✅ Creating placeholder reservation with data:', {
            originalReservationId: reservationId,
            customerId: customerId,
            startDate: overlapStart,
            endDate: overlapEnd,
            isOpenEnded
          });
          
          await createPlaceholderMutation.mutateAsync({
            originalReservationId: reservationId,
            customerId: customerId,
            startDate: overlapStart,
            endDate: overlapEnd
          });
        } else {
          console.log('⚠️ No overlap detected:', {
            maintenanceStart,
            maintenanceEnd,
            reservationStart,
            reservationEnd,
            isOpenEnded
          });
        }
      }

      // Create specific vehicle assignments if any
      if (specificAssignments.length > 0) {
        const response = await apiRequest("POST", "/api/reservations/maintenance-with-spare", {
          body: JSON.stringify({
            maintenanceId: data.maintenanceData.maintenanceId, // Use existing maintenance ID
            conflictingReservations: data.conflictingReservations.filter(r => 
              specificAssignments.some(sa => sa.reservationId === r.id)
            ),
            spareVehicleAssignments: specificAssignments
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to assign specific spare vehicles");
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      // Show success message first
      toast({
        title: "Maintenance scheduled",
        description: "Maintenance scheduled and spare vehicles assigned to affected reservations.",
      });
      
      // Close dialogs immediately for better UX
      setShowSpareDialog(false);
      setConflictingReservations([]);
      setMaintenanceData(null);
      setSpareVehicleAssignments({});
      onOpenChange(false);
      
      // Call parent onSuccess if provided
      if (onSuccess && typeof onSuccess === 'function') {
        try {
          onSuccess();
        } catch (error) {
          console.warn('Error calling parent onSuccess:', error);
        }
      }
      
      // Reset form safely
      try {
        if (form && typeof form.reset === 'function') {
          form.reset();
        }
      } catch (error) {
        console.warn('Error resetting form:', error);
      }
      
      // Handle cache invalidation asynchronously (don't block dialog closing)
      setTimeout(() => {
        try {
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0] as string;
              return key?.startsWith('/api/vehicles') || 
                     key?.startsWith('/api/reservations') || 
                     key?.startsWith('/api/placeholder-reservations');
            }
          });
          
          queryClient.refetchQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
          queryClient.refetchQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
          queryClient.refetchQueries({ queryKey: ['/api/reservations'] });
          queryClient.refetchQueries({ queryKey: ['/api/reservations/range'] });
          queryClient.refetchQueries({ queryKey: ['/api/placeholder-reservations'] });
        } catch (error) {
          console.warn('Error invalidating cache:', error);
        }
      }, 100);
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

  const selectedVehicle = filteredVehicles.find(v => v.id.toString() === form.watch('vehicleId'));

  // Fetch available vehicles for spare assignment during the maintenance period
  const { data: availableVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/available', {
      startDate: maintenanceData?.startDate,
      endDate: maintenanceData?.endDate || maintenanceData?.startDate, // Use endDate if available, otherwise same day
      excludeVehicleId: maintenanceData?.vehicleId
    }],
    enabled: Boolean(showSpareDialog && maintenanceData?.startDate && maintenanceData?.vehicleId), // Ensure boolean return
  });

  const handleSpareVehicleAssignment = async () => {
    console.log('🎯 Handling spare vehicle assignment...');
    console.log('Spare vehicle assignments:', spareVehicleAssignments);
    console.log('Conflicting reservations:', conflictingReservations);
    console.log('Maintenance data:', maintenanceData);
    
    // Check that all conflicting reservations have either a specific vehicle or TBD assigned
    const missingAssignments = conflictingReservations.filter(r => {
      const assignment = spareVehicleAssignments[r.id];
      return !assignment; // No assignment at all (neither specific vehicle nor TBD)
    });
    
    if (missingAssignments.length > 0) {
      console.log('❌ Missing assignments for reservations:', missingAssignments);
      toast({
        title: "Missing Spare Vehicle Assignments",
        description: "Please choose either a specific vehicle or 'TBD' for all affected reservations.",
        variant: "destructive",
      });
      return;
    }

    // Check if specific vehicle assignments are valid (not just 'specific' radio selected)
    const invalidSpecificAssignments = conflictingReservations.filter(r => {
      const assignment = spareVehicleAssignments[r.id];
      return assignment && assignment !== 'tbd' && (!assignment || isNaN(Number(assignment)));
    });

    if (invalidSpecificAssignments.length > 0) {
      console.log('❌ Invalid specific assignments:', invalidSpecificAssignments);
      toast({
        title: "Invalid Spare Vehicle Assignments",
        description: "Please select a specific vehicle for all reservations marked as 'specific vehicle'.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ All validations passed, creating placeholders...');
    
    try {
      await createMaintenanceWithSpareMutation.mutateAsync({
        maintenanceData,
        conflictingReservations,
        spareVehicleAssignments
      });
      console.log('✅ Mutation completed successfully');
    } catch (error) {
      console.error('❌ Mutation failed:', error);
      // Error is already handled by onError
    }
  };

  const handleSpareVehicleChange = (reservationId: number, spareVehicleId: string) => {
    setSpareVehicleAssignments(prev => ({
      ...prev,
      [reservationId]: spareVehicleId === 'tbd' ? 'tbd' : parseInt(spareVehicleId)
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
                      <div className="space-y-3">
                        {/* Filter Options */}
                        <div className="bg-gray-50 p-3 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Vehicle Filters</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="show-available-only"
                                checked={showAvailableOnly}
                                onCheckedChange={(checked) => setShowAvailableOnly(checked === true)}
                                data-testid="checkbox-available-only"
                              />
                              <label htmlFor="show-available-only" className="text-sm text-gray-600">
                                Show available vehicles only
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="exclude-maintenance"
                                checked={excludeMaintenanceVehicles}
                                onCheckedChange={(checked) => setExcludeMaintenanceVehicles(checked === true)}
                                data-testid="checkbox-exclude-maintenance"
                              />
                              <label htmlFor="exclude-maintenance" className="text-sm text-gray-600">
                                Exclude vehicles with existing maintenance
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        {/* Vehicle Selector */}
                        <div data-testid="select-vehicle">
                          <VehicleSelector
                            vehicles={filteredVehicles}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select a vehicle..."
                          />
                        </div>
                        
                        {/* Results summary */}
                        <div className="text-xs text-gray-500">
                          Showing {filteredVehicles.length} of {vehicles.length} vehicles
                          {showAvailableOnly && ` (available on ${scheduledDate})`}
                          {excludeMaintenanceVehicles && ` (no maintenance conflicts)`}
                        </div>
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
            
            return (
              <div key={reservation.id} className={`p-4 border rounded-lg space-y-3 ${isOpenEnded ? 'bg-blue-50 border-blue-200' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">
                      {reservation.customer?.name || 'Unknown Customer'}
                      {isOpenEnded && <span className="ml-2 text-blue-600 font-medium">(Open-ended Rental)</span>}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Reservation: {reservation.startDate} - {isOpenEnded ? <span className="font-medium text-blue-600">No end date</span> : reservation.endDate}
                    </p>
                    <p className="text-sm text-gray-500">
                      Original vehicle: {reservation.vehicle?.brand} {reservation.vehicle?.model} ({formatLicensePlate(reservation.vehicle?.licensePlate)})
                    </p>
                    {isOpenEnded && (
                      <p className="text-sm text-blue-600 mt-1">
                        💡 Spare vehicle will be assigned for the entire maintenance period
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Select Spare Vehicle:</label>
                  <div className="mt-1 space-y-2">
                    {/* TBD Option */}
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        id={`tbd-${reservation.id}`}
                        name={`spare-option-${reservation.id}`}
                        value="tbd"
                        checked={spareVehicleAssignments[reservation.id] === 'tbd'}
                        onChange={() => handleSpareVehicleChange(reservation.id, 'tbd')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`tbd-${reservation.id}`} className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <div>
                          <div className="font-medium text-orange-700">TBD (To Be Determined)</div>
                          <div className="text-xs text-orange-600">Assign spare vehicle later</div>
                        </div>
                      </label>
                    </div>
                    
                    {/* Specific Vehicle Option */}
                    <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        id={`specific-${reservation.id}`}
                        name={`spare-option-${reservation.id}`}
                        value="specific"
                        checked={Boolean(spareVehicleAssignments[reservation.id] && spareVehicleAssignments[reservation.id] !== 'tbd')}
                        onChange={() => {
                          // If switching to specific vehicle but no vehicle selected, clear the assignment
                          if (spareVehicleAssignments[reservation.id] === 'tbd') {
                            setSpareVehicleAssignments(prev => {
                              const updated = { ...prev };
                              delete updated[reservation.id];
                              return updated;
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600"
                        disabled={availableVehicles.length === 0}
                      />
                      <div className="flex-1">
                        <label htmlFor={`specific-${reservation.id}`} className="text-sm font-medium cursor-pointer">
                          Assign specific vehicle now
                        </label>
                        {availableVehicles.length === 0 && (
                          <div className="text-xs text-gray-500 mt-1">No vehicles available for this date</div>
                        )}
                        {(spareVehicleAssignments[reservation.id] && spareVehicleAssignments[reservation.id] !== 'tbd') && (
                          <div className="mt-1" data-testid={`select-spare-vehicle-${reservation.id}`}>
                            <VehicleSelector
                              vehicles={availableVehicles}
                              value={spareVehicleAssignments[reservation.id]?.toString() || ""}
                              onChange={(value) => handleSpareVehicleChange(reservation.id, value)}
                              placeholder="Choose a spare vehicle..."
                              disabled={availableVehicles.length === 0}
                            />
                          </div>
                        )}
                      </div>
                    </div>
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
            data-testid="button-assign-spare-vehicles"
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