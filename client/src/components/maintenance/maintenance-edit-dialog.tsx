import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Reservation } from "@shared/schema";
import { Loader2 } from "lucide-react";

// Form schema for maintenance editing - simpler than the create form
const maintenanceEditSchema = insertReservationSchema.extend({
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
      customerId: undefined,
      startDate: reservation?.startDate || "",
      endDate: reservation?.endDate || "",
      status: "confirmed",
      type: "maintenance_block",
      notes: reservation?.notes || "",
      totalPrice: 0,
    },
  });

  // Reset form when reservation changes
  useEffect(() => {
    if (reservation && open) {
      const parsed = parseMaintenanceNotes(reservation.notes || '');
      form.reset({
        vehicleId: reservation.vehicleId,
        customerId: undefined,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        status: "confirmed",
        type: "maintenance_block",
        notes: reservation.notes || "",
        totalPrice: 0,
      });
    }
  }, [reservation, open, form]);

  // Update mutation using the standard reservations endpoint
  const updateMutation = useMutation({
    mutationFn: async (data: MaintenanceEditFormType) => {
      if (!reservation) throw new Error("No reservation to update");
      
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update maintenance reservation");
      }
      
      return response.json();
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
                        value={field.value?.toString() || ""}
                        onValueChange={(value: string) => field.onChange(parseInt(value))}
                        placeholder="Select a vehicle"
                        data-testid="input-vehicle"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Maintenance Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Type</FormLabel>
                    <FormControl>
                      <Select value={parsed.maintenanceType} disabled>
                        <SelectTrigger data-testid="select-maintenance-type">
                          <SelectValue placeholder="Maintenance type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="routine_service">Routine Service</SelectItem>
                          <SelectItem value="oil_change">Oil Change</SelectItem>
                          <SelectItem value="tire_change">Tire Change</SelectItem>
                          <SelectItem value="brake_service">Brake Service</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="breakdown">Breakdown</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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