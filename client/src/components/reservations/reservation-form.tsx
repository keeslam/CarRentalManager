import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertReservationSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format-utils";
import { doDateRangesOverlap } from "@/lib/date-utils";
import { format, addDays } from "date-fns";
import { Customer, Vehicle, Reservation } from "@shared/schema";

// Extended schema with validation
const formSchema = insertReservationSchema.extend({
  vehicleId: z.number({
    required_error: "Please select a vehicle",
    invalid_type_error: "Please select a vehicle",
  }),
  customerId: z.number({
    required_error: "Please select a customer",
    invalid_type_error: "Please select a customer",
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalPrice: z.number().optional(),
});

interface ReservationFormProps {
  editMode?: boolean;
  initialData?: any;
}

export function ReservationForm({ editMode = false, initialData }: ReservationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [searchParams] = useLocation();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  
  // Get preselected IDs from URL if available
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    const customerIdParam = urlParams.get("customerId");
    
    if (vehicleIdParam) {
      setVehicleId(Number(vehicleIdParam));
    }
    
    if (customerIdParam) {
      setCustomerId(Number(customerIdParam));
    }
  }, [searchParams]);
  
  // Fetch customers for select field
  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Get today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  // Default end date is 3 days from today
  const defaultEndDate = format(addDays(new Date(), 3), "yyyy-MM-dd");
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: vehicleId || 0,
      customerId: customerId || 0,
      startDate: today,
      endDate: defaultEndDate,
      status: "pending",
      totalPrice: 0,
      notes: ""
    },
  });
  
  // If vehicleId or customerId changes from URL, update the form
  useEffect(() => {
    if (vehicleId && !editMode) {
      form.setValue("vehicleId", vehicleId);
    }
    
    if (customerId && !editMode) {
      form.setValue("customerId", customerId);
    }
  }, [vehicleId, customerId, form, editMode]);
  
  // Check for overlapping reservations when vehicle or dates change
  const vehicleIdWatch = form.watch("vehicleId");
  const startDateWatch = form.watch("startDate");
  const endDateWatch = form.watch("endDate");
  
  const { data: overlappingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/check-availability", vehicleIdWatch, startDateWatch, endDateWatch],
    enabled: !!vehicleIdWatch && !!startDateWatch && !!endDateWatch,
  });
  
  const hasOverlap = overlappingReservations?.some(reservation => 
    reservation.id !== (initialData?.id || 0) &&
    doDateRangesOverlap(startDateWatch, endDateWatch, reservation.startDate, reservation.endDate)
  );
  
  const createReservationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(
        editMode ? "PATCH" : "POST", 
        editMode ? `/api/reservations/${initialData?.id}` : "/api/reservations", 
        data
      );
    },
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      // Show success message
      toast({
        title: `Reservation ${editMode ? "updated" : "created"} successfully`,
        description: `The reservation has been ${editMode ? "updated" : "created"}.`,
      });
      
      // Navigate back to reservations list
      navigate("/reservations");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "create"} reservation: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Check for overlapping reservations
    if (hasOverlap) {
      toast({
        title: "Booking Conflict",
        description: "This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.",
        variant: "destructive",
      });
      return;
    }
    
    createReservationMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Reservation" : "Create New Reservation"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vehicle and Customer Selection */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value.toString()}
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {vehicle.licensePlate} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value.toString()}
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name} {customer.phone ? `- ${customer.phone}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Reservation Dates */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={today} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={startDateWatch} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Status and Price */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
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
              
              <FormField
                control={form.control}
                name="totalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Price (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        placeholder="0.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Additional Information */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this reservation" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Warning if there's an overlap */}
            {hasOverlap && (
              <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm">
                <strong>Warning:</strong> This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/reservations")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createReservationMutation.isPending || hasOverlap}
              >
                {createReservationMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  editMode ? "Update Reservation" : "Create Reservation"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
