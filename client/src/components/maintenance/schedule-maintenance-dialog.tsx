import { useState } from "react";
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
import { Loader2, Calendar, AlertTriangle, Wrench, Clock } from "lucide-react";

const scheduleMaintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Please select a vehicle"),
  maintenanceType: z.enum(["apk_inspection", "regular_maintenance", "warranty_service", "emergency_repair"], {
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
}

export function ScheduleMaintenanceDialog({
  open,
  onOpenChange,
  onSuccess,
}: ScheduleMaintenanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all vehicles for selection
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
    enabled: open, // Only fetch when dialog is open
  });

  const form = useForm<ScheduleMaintenanceFormData>({
    resolver: zodResolver(scheduleMaintenanceSchema),
    defaultValues: {
      vehicleId: "",
      maintenanceType: "regular_maintenance",
      scheduledDate: "",
      estimatedDuration: "",
      priority: "medium",
      description: "",
      notes: "",
      needsSpareVehicle: false,
    },
  });

  const scheduleMaintenanceMutation = useMutation({
    mutationFn: async (data: ScheduleMaintenanceFormData) => {
      // Create a maintenance block reservation
      const response = await apiRequest("POST", "/api/reservations", {
        body: JSON.stringify({
          vehicleId: parseInt(data.vehicleId),
          customerId: null, // No customer for maintenance blocks
          startDate: data.scheduledDate,
          endDate: data.scheduledDate, // Same day by default
          status: "confirmed",
          type: "maintenance_block",
          notes: `${data.maintenanceType}: ${data.description || ''}\n${data.notes || ''}`.trim(),
          totalPrice: 0,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to schedule maintenance");
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
        description: "The maintenance event has been scheduled successfully.",
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

  const handleSubmit = (data: ScheduleMaintenanceFormData) => {
    scheduleMaintenanceMutation.mutate(data);
  };

  const getMaintenanceTypeInfo = (type: string) => {
    switch (type) {
      case "apk_inspection":
        return { icon: <AlertTriangle className="w-4 h-4" />, label: "APK Inspection" };
      case "regular_maintenance":
        return { icon: <Wrench className="w-4 h-4" />, label: "Regular Maintenance" };
      case "warranty_service":
        return { icon: <Clock className="w-4 h-4" />, label: "Warranty Service" };
      case "emergency_repair":
        return { icon: <AlertTriangle className="w-4 h-4" />, label: "Emergency Repair" };
      default:
        return { icon: <Wrench className="w-4 h-4" />, label: "Maintenance" };
    }
  };

  const selectedVehicle = vehicles.find(v => v.id.toString() === form.watch('vehicleId'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-schedule-maintenance">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Schedule Maintenance
          </DialogTitle>
          <DialogDescription>
            Schedule APK inspections, regular maintenance, or other services for your vehicles.
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vehicle">
                        <SelectValue placeholder="Select a vehicle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {vehiclesLoading ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">Loading vehicles...</span>
                        </div>
                      ) : vehicles.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">No vehicles available</div>
                      ) : (
                        vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
                              <span className="text-sm text-gray-500">
                                ({formatLicensePlate(vehicle.licensePlate)})
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
                    <SelectContent>
                      <SelectItem value="apk_inspection">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          APK Inspection
                        </div>
                      </SelectItem>
                      <SelectItem value="regular_maintenance">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-blue-500" />
                          Regular Maintenance
                        </div>
                      </SelectItem>
                      <SelectItem value="warranty_service">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          Warranty Service
                        </div>
                      </SelectItem>
                      <SelectItem value="emergency_repair">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          Emergency Repair
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
                    Scheduling...
                  </>
                ) : (
                  "Schedule Maintenance"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}