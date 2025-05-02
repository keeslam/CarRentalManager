import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertReservationSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { formatDate } from "@/lib/format-utils";
import { doDateRangesOverlap } from "@/lib/date-utils";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
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
  const [selectedStartDate, setSelectedStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  
  // Get recent selections from localStorage
  const getRecentSelections = (key: string): string[] => {
    try {
      const recent = localStorage.getItem(key);
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  };
  
  const [recentVehicles, setRecentVehicles] = useState<string[]>(
    getRecentSelections('recentVehicles')
  );
  const [recentCustomers, setRecentCustomers] = useState<string[]>(
    getRecentSelections('recentCustomers')
  );
  
  // Save a selection to recent items
  const saveToRecent = (key: string, value: string) => {
    try {
      const recent = getRecentSelections(key);
      // Add to beginning, remove duplicates, limit to 5 items
      const updated = [value, ...recent.filter(v => v !== value)].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(updated));
      
      if (key === 'recentVehicles') {
        setRecentVehicles(updated);
      } else if (key === 'recentCustomers') {
        setRecentCustomers(updated);
      }
    } catch {
      // Ignore localStorage errors
    }
  };
  
  // Get preselected IDs and dates from URL if available
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    const customerIdParam = urlParams.get("customerId");
    const startDateParam = urlParams.get("startDate");
    
    if (vehicleIdParam) {
      setVehicleId(Number(vehicleIdParam));
    }
    
    if (customerIdParam) {
      setCustomerId(Number(customerIdParam));
    }
    
    if (startDateParam) {
      setSelectedStartDate(startDateParam);
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
  const defaultEndDate = format(addDays(parseISO(selectedStartDate), 3), "yyyy-MM-dd");
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: vehicleId || 0,
      customerId: customerId || 0,
      startDate: selectedStartDate,
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
    
    if (selectedStartDate) {
      form.setValue("startDate", selectedStartDate);
      form.setValue("endDate", format(addDays(parseISO(selectedStartDate), 3), "yyyy-MM-dd"));
    }
  }, [vehicleId, customerId, selectedStartDate, form, editMode]);
  
  // Check for overlapping reservations when vehicle or dates change
  const vehicleIdWatch = form.watch("vehicleId");
  const startDateWatch = form.watch("startDate");
  const endDateWatch = form.watch("endDate");
  
  // Update rental duration (days) on date change
  const rentalDuration = useMemo(() => {
    if (!startDateWatch || !endDateWatch) return 0;
    try {
      const start = parseISO(startDateWatch);
      const end = parseISO(endDateWatch);
      return differenceInDays(end, start) + 1; // Include both start and end date
    } catch {
      return 0;
    }
  }, [startDateWatch, endDateWatch]);
  
  const { data: overlappingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/check-availability", vehicleIdWatch, startDateWatch, endDateWatch],
    enabled: !!vehicleIdWatch && !!startDateWatch && !!endDateWatch,
  });
  
  const hasOverlap = overlappingReservations?.some(reservation => 
    reservation.id !== (initialData?.id || 0) &&
    doDateRangesOverlap(startDateWatch, endDateWatch, reservation.startDate, reservation.endDate)
  );
  
  // Convert vehicles to combobox options
  const vehicleOptions: ComboboxOption[] = useMemo(() => {
    if (!vehicles) return [];
    
    return vehicles.map(vehicle => ({
      value: vehicle.id.toString(),
      label: `${vehicle.licensePlate} - ${vehicle.brand} ${vehicle.model}`,
      description: vehicle.vehicleType || undefined,
      group: vehicle.vehicleType || "Other",
      tags: [vehicle.fuel || ""]
    }));
  }, [vehicles]);
  
  // Convert customers to combobox options
  const customerOptions: ComboboxOption[] = useMemo(() => {
    if (!customers) return [];
    
    return customers.map(customer => ({
      value: customer.id.toString(),
      label: customer.name,
      description: customer.phone || undefined,
      tags: [customer.city || ""]
    }));
  }, [customers]);
  
  // Get selected vehicle and customer
  const selectedVehicle = vehicles?.find(v => v.id === vehicleIdWatch);
  const selectedCustomer = customers?.find(c => c.id === form.watch("customerId"));
  
  const createReservationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(
        editMode ? "PATCH" : "POST", 
        editMode ? `/api/reservations/${initialData?.id}` : "/api/reservations", 
        data
      );
    },
    onSuccess: async (data) => {
      // Save selections to recent items
      if (vehicleIdWatch) {
        saveToRecent('recentVehicles', vehicleIdWatch.toString());
      }
      if (form.watch("customerId")) {
        saveToRecent('recentCustomers', form.watch("customerId").toString());
      }
      
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      // Show success message
      toast({
        title: `Reservation ${editMode ? "updated" : "created"} successfully`,
        description: `The reservation has been ${editMode ? "updated" : "created"}.`,
      });
      
      // Navigate to reservation view or back to list
      if (editMode) {
        navigate("/reservations");
      } else {
        navigate(`/reservations/${data.id}`);
      }
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
        <CardDescription>
          {editMode 
            ? "Update the reservation details below" 
            : "Enter the details for a new reservation"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Vehicle and Customer Selection Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">1. Select Vehicle and Customer</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle Selection */}
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Vehicle</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          options={vehicleOptions}
                          value={field.value.toString()}
                          onChange={(value) => {
                            field.onChange(parseInt(value));
                            // If switching vehicles, check for conflicts
                            if (parseInt(value) !== vehicleIdWatch) {
                              // Logic already handled via watch
                            }
                          }}
                          placeholder="Search and select a vehicle..."
                          searchPlaceholder="Search by license plate, brand, or model..."
                          groups={true}
                          recentValues={recentVehicles}
                        />
                      </FormControl>
                      <FormMessage />
                      {selectedVehicle && (
                        <div className="mt-2 text-sm bg-muted p-2 rounded-md">
                          <div className="font-medium">{selectedVehicle.brand} {selectedVehicle.model}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {selectedVehicle.vehicleType && (
                              <span className="mr-2">{selectedVehicle.vehicleType}</span>
                            )}
                            {selectedVehicle.fuel && (
                              <span>{selectedVehicle.fuel}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
                
                {/* Customer Selection */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Customer</FormLabel>
                      <FormControl>
                        <SearchableCombobox
                          options={customerOptions}
                          value={field.value.toString()}
                          onChange={(value) => field.onChange(parseInt(value))}
                          placeholder="Search and select a customer..."
                          searchPlaceholder="Search by name, phone, or city..."
                          groups={false}
                          recentValues={recentCustomers}
                        />
                      </FormControl>
                      <FormMessage />
                      {selectedCustomer && (
                        <div className="mt-2 text-sm bg-muted p-2 rounded-md">
                          {selectedCustomer.phone && (
                            <div>Phone: {selectedCustomer.phone}</div>
                          )}
                          {selectedCustomer.email && (
                            <div>Email: {selectedCustomer.email}</div>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              <Separator />
            </div>

            {/* Date and Duration Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">2. Select Dates</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Start Date */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          min={today} 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e);
                            setSelectedStartDate(e.target.value);
                          }}
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
                        <Input type="date" min={startDateWatch} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Duration Indicator */}
                <div className="flex flex-col justify-end">
                  <FormLabel className="mb-2 opacity-0">Duration</FormLabel>
                  <div className="border rounded-md h-10 flex items-center px-3 bg-muted">
                    <span className="font-medium">{rentalDuration}</span>
                    <span className="ml-1 text-muted-foreground">
                      {rentalDuration === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>
              </div>
              <Separator />
            </div>
            
            {/* Status and Price Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">3. Reservation Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status */}
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
                
                {/* Price */}
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
                      <FormDescription>
                        Enter the total price for the {rentalDuration}-day rental
                      </FormDescription>
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
                  <FormItem className="col-span-full">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes about this reservation" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Add any special instructions or comments for this reservation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Warning if there's an overlap */}
            {hasOverlap && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm">
                <div className="flex gap-2 items-center mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <strong>Booking Conflict Detected</strong>
                </div>
                <p>This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.</p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
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
