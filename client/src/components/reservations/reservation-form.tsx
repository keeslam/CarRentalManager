import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertReservationSchema, insertVehicleSchema, insertCustomerSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchableCombobox, ComboboxOption } from "@/components/ui/searchable-combobox";
import { formatDate } from "@/lib/format-utils";
import { doDateRangesOverlap } from "@/lib/date-utils";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { Customer, Vehicle, Reservation, InsertVehicle, InsertCustomer } from "@shared/schema";
import { PlusCircle, FileCheck, Upload, Check, X } from "lucide-react";
import { formatLicensePlate } from "@/lib/format-utils";

// Extended schema with validation
const formSchema = insertReservationSchema.extend({
  vehicleId: z.union([
    z.number().min(1, "Please select a vehicle"),
    z.string().min(1, "Please select a vehicle").transform(val => parseInt(val)),
  ]),
  customerId: z.union([
    z.number().min(1, "Please select a customer"),
    z.string().min(1, "Please select a customer").transform(val => parseInt(val)),
  ]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalPrice: z.number().optional(),
  damageCheckFile: z.instanceof(File).optional(),
});

// Vehicle form schema
const vehicleFormSchema = insertVehicleSchema.extend({
  licensePlate: z.string().min(1, "License plate is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
});

// Customer form schema
const customerFormSchema = insertCustomerSchema.extend({
  name: z.string().min(1, "Name is required"),
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
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [damageFile, setDamageFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  
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
      setVehicleId(vehicleIdParam);
    }
    
    if (customerIdParam) {
      setCustomerId(customerIdParam);
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
      vehicleId: vehicleId || "",
      customerId: customerId || "", 
      startDate: selectedStartDate,
      endDate: defaultEndDate,
      status: "pending",
      totalPrice: 0,
      notes: ""
    },
  });

  // Setup vehicle form with expanded fields
  const vehicleForm = useForm<z.infer<typeof vehicleFormSchema>>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      licensePlate: "",
      brand: "",
      model: "",
      vehicleType: "sedan",
      chassisNumber: "",
      fuel: "gasoline"
    }
  });

  // Setup customer form with expanded fields
  const customerForm = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      postalCode: "",
      country: "NL",
      driverLicenseNumber: ""
    }
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
    reservation.id.toString() !== (initialData?.id?.toString() || "0") &&
    doDateRangesOverlap(startDateWatch, endDateWatch, reservation.startDate, reservation.endDate)
  );
  
  // Convert vehicles to combobox options with improved search capabilities
  const vehicleOptions: ComboboxOption[] = useMemo(() => {
    if (!vehicles) return [];
    
    return vehicles.map(vehicle => ({
      value: vehicle.id.toString(),
      label: `${formatLicensePlate(vehicle.licensePlate)} - ${vehicle.brand} ${vehicle.model}`,
      // Add search-friendly description with more details
      description: `${vehicle.vehicleType || ''} | ${vehicle.fuel || ''} | ${vehicle.chassisNumber || ''}`,
      group: vehicle.vehicleType || "Other",
      tags: [vehicle.fuel || ""]
    }));
  }, [vehicles]);
  
  // Convert customers to combobox options with improved search capabilities
  const customerOptions: ComboboxOption[] = useMemo(() => {
    if (!customers) return [];
    
    return customers.map(customer => ({
      value: customer.id.toString(),
      label: customer.name,
      // Add contact info for easier searching
      description: [
        customer.phone || '', 
        customer.email || '', 
        customer.city || ''
      ].filter(Boolean).join(' | '),
      group: customer.city || "Other",
      tags: [customer.phone ? "☎" : ""]
    }));
  }, [customers]);
  
  // Get selected vehicle and customer
  const selectedVehicle = vehicles?.find(v => v.id.toString() === vehicleIdWatch?.toString());
  const selectedCustomer = customers?.find(c => c.id.toString() === form.watch("customerId")?.toString());

  // RDW Lookup mutation
  const lookupVehicleMutation = useMutation({
    mutationFn: async (licensePlate: string) => {
      return await fetch(`/api/rdw/vehicle/${licensePlate}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: async (response) => {
      const vehicleData = await response.json();
      
      // Fill form with retrieved data
      Object.keys(vehicleData).forEach((key) => {
        if (vehicleForm.getValues(key as any) !== undefined) {
          vehicleForm.setValue(key as any, vehicleData[key]);
        }
      });
      
      toast({
        title: "Information retrieved",
        description: "Vehicle information has been retrieved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Lookup failed",
        description: `Could not retrieve vehicle information: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLookingUp(false);
    }
  });
  
  // Create vehicle mutation
  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof vehicleFormSchema>) => {
      // Send request and parse response
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create vehicle");
      }
      
      return await response.json();
    },
    onSuccess: async (data) => {
      // Invalidate vehicles query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Set the new vehicle as selected
      form.setValue("vehicleId", data.id.toString());
      
      // Close the dialog
      setVehicleDialogOpen(false);
      
      // Show success message
      toast({
        title: "Vehicle created",
        description: `Vehicle "${formatLicensePlate(data.licensePlate)}" has been created.`,
      });

      // Reset form
      vehicleForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create vehicle: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerFormSchema>) => {
      // Send request and parse response
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create customer");
      }
      
      return await response.json();
    },
    onSuccess: async (data) => {
      // Invalidate customers query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      
      // Set the new customer as selected
      form.setValue("customerId", data.id.toString());
      
      // Close the dialog
      setCustomerDialogOpen(false);
      
      // Show success message
      toast({
        title: "Customer created",
        description: `Customer "${data.name}" has been created.`,
      });

      // Reset form
      customerForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create customer: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // File upload handling for damage check
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDamageFile(file);
      form.setValue("damageCheckFile", file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setDamageFile(file);
      form.setValue("damageCheckFile", file);
    }
  };

  const removeDamageFile = () => {
    setDamageFile(null);
    form.setValue("damageCheckFile", undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // Create or update reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add all other form data
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "damageCheckFile") {
          formData.append(key, String(value));
        }
      });
      
      // Add file if present
      if (data.damageCheckFile) {
        formData.append("damageCheckFile", data.damageCheckFile);
      }
      
      // Use FormData for the request
      return await fetch(
        editMode ? `/api/reservations/${initialData?.id}` : "/api/reservations", 
        {
          method: editMode ? "PATCH" : "POST",
          body: formData,
        }
      ).then(res => {
        if (!res.ok) {
          throw new Error("Failed to save reservation");
        }
        return res.json();
      });
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
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      
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
  
  // Handle license plate lookup 
  const handleLookup = () => {
    const licensePlate = vehicleForm.getValues("licensePlate");
    if (!licensePlate) {
      toast({
        title: "License plate required",
        description: "Please enter a license plate to look up vehicle information.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLookingUp(true);
    lookupVehicleMutation.mutate(licensePlate);
  };

  // Handle vehicle form submission
  const onVehicleSubmit = (data: z.infer<typeof vehicleFormSchema>) => {
    createVehicleMutation.mutate(data);
  };

  // Handle customer form submission
  const onCustomerSubmit = (data: z.infer<typeof customerFormSchema>) => {
    createCustomerMutation.mutate(data);
  };
  
  // Handle reservation form submission
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
                      <div className="flex justify-between items-center">
                        <FormLabel>Vehicle</FormLabel>
                        <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <PlusCircle className="h-3.5 w-3.5 mr-1" />
                              Add New
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Add New Vehicle</DialogTitle>
                              <DialogDescription>
                                Create a new vehicle to add to the reservation
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...vehicleForm}>
                              <form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4">
                                <Tabs defaultValue="general">
                                  <TabsList className="grid grid-cols-3 mb-4">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="technical">Technical</TabsTrigger>
                                    <TabsTrigger value="dates">Important Dates</TabsTrigger>
                                  </TabsList>
                                
                                  <TabsContent value="general" className="space-y-4">
                                    {/* General Information */}
                                    <FormField
                                      control={vehicleForm.control}
                                      name="licensePlate"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>License Plate *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="e.g. AB-123-C" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={vehicleForm.control}
                                        name="brand"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Brand *</FormLabel>
                                            <FormControl>
                                              <Input placeholder="e.g. Toyota" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={vehicleForm.control}
                                        name="model"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Model *</FormLabel>
                                            <FormControl>
                                              <Input placeholder="e.g. Corolla" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={vehicleForm.control}
                                        name="vehicleType"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Vehicle Type</FormLabel>
                                            <Select 
                                              onValueChange={field.onChange} 
                                              defaultValue={field.value || "sedan"}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="sedan">Sedan</SelectItem>
                                                <SelectItem value="suv">SUV</SelectItem>
                                                <SelectItem value="wagon">Wagon</SelectItem>
                                                <SelectItem value="van">Van</SelectItem>
                                                <SelectItem value="truck">Truck</SelectItem>
                                                <SelectItem value="convertible">Convertible</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      {/* Removed constructionYear field that was causing errors */}
                                    </div>
                                  </TabsContent>
                                
                                  <TabsContent value="technical" className="space-y-4">
                                    {/* Technical Information */}
                                    <FormField
                                      control={vehicleForm.control}
                                      name="chassisNumber"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Chassis/VIN Number</FormLabel>
                                          <FormControl>
                                            <Input placeholder="e.g. WBA12345678901234" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={vehicleForm.control}
                                        name="fuel"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Fuel Type</FormLabel>
                                            <Select 
                                              onValueChange={field.onChange} 
                                              defaultValue={field.value || "gasoline"}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select fuel" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="gasoline">Gasoline</SelectItem>
                                                <SelectItem value="diesel">Diesel</SelectItem>
                                                <SelectItem value="electric">Electric</SelectItem>
                                                <SelectItem value="hybrid">Hybrid</SelectItem>
                                                <SelectItem value="plugin_hybrid">Plug-in Hybrid</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={vehicleForm.control}
                                        name="euroZone"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Euro Zone</FormLabel>
                                            <Select 
                                              onValueChange={field.onChange} 
                                              defaultValue={field.value || ""}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="euro0">Euro 0</SelectItem>
                                                <SelectItem value="euro1">Euro 1</SelectItem>
                                                <SelectItem value="euro2">Euro 2</SelectItem>
                                                <SelectItem value="euro3">Euro 3</SelectItem>
                                                <SelectItem value="euro4">Euro 4</SelectItem>
                                                <SelectItem value="euro5">Euro 5</SelectItem>
                                                <SelectItem value="euro6">Euro 6</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      {/* Removed mileage and registrationNumber fields that were causing errors */}
                                    </div>
                                  </TabsContent>
                                
                                  <TabsContent value="dates" className="space-y-4">
                                    {/* Removed APK date field that was causing errors */}
                                    <div className="text-muted-foreground text-sm p-4 bg-secondary/30 rounded-md">
                                      You can set date fields after creating the vehicle.
                                    </div>
                                  </TabsContent>
                                </Tabs>
                                <DialogFooter className="mt-4">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setVehicleDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={createVehicleMutation.isPending}
                                  >
                                    {createVehicleMutation.isPending ? "Creating..." : "Create Vehicle"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl>
                        <SearchableCombobox
                          options={vehicleOptions}
                          value={field.value ? field.value.toString() : ''}
                          onChange={(value) => {
                            console.log("Vehicle selected:", value); 
                            field.onChange(value);
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
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            {selectedVehicle.vehicleType && (
                              <Badge variant="outline">{selectedVehicle.vehicleType}</Badge>
                            )}
                            {selectedVehicle.fuel && (
                              <Badge variant="outline">{selectedVehicle.fuel}</Badge>
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
                      <div className="flex justify-between items-center">
                        <FormLabel>Customer</FormLabel>
                        <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <PlusCircle className="h-3.5 w-3.5 mr-1" />
                              Add New
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Add New Customer</DialogTitle>
                              <DialogDescription>
                                Create a new customer to add to the reservation
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...customerForm}>
                              <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-4">
                                <Tabs defaultValue="basic">
                                  <TabsList className="grid grid-cols-2 mb-4">
                                    <TabsTrigger value="basic">Basic Information</TabsTrigger>
                                    <TabsTrigger value="contact">Contact & Address</TabsTrigger>
                                  </TabsList>
                                  
                                  <TabsContent value="basic" className="space-y-4">
                                    <FormField
                                      control={customerForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Full Name *</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Customer name" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField
                                        control={customerForm.control}
                                        name="phone"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Phone Number</FormLabel>
                                            <FormControl>
                                              <Input placeholder="+31 1234 567890" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={customerForm.control}
                                        name="email"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                              <Input placeholder="customer@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    <FormField
                                      control={customerForm.control}
                                      name="driverLicenseNumber"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Driver License Number</FormLabel>
                                          <FormControl>
                                            <Input placeholder="e.g. D123456789" {...field} />
                                          </FormControl>
                                          <FormDescription>
                                            This is required for vehicle rental verification
                                          </FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </TabsContent>
                                  
                                  <TabsContent value="contact" className="space-y-4">
                                    <FormField
                                      control={customerForm.control}
                                      name="address"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Address</FormLabel>
                                          <FormControl>
                                            <Input placeholder="Street address" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField
                                        control={customerForm.control}
                                        name="city"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                              <Input placeholder="City" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={customerForm.control}
                                        name="postalCode"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Postal Code</FormLabel>
                                            <FormControl>
                                              <Input placeholder="1234 AB" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={customerForm.control}
                                        name="country"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <Select 
                                              onValueChange={field.onChange} 
                                              defaultValue={field.value || "NL"}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select country" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="NL">Netherlands</SelectItem>
                                                <SelectItem value="BE">Belgium</SelectItem>
                                                <SelectItem value="DE">Germany</SelectItem>
                                                <SelectItem value="FR">France</SelectItem>
                                                <SelectItem value="GB">United Kingdom</SelectItem>
                                                <SelectItem value="OTHER">Other</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </TabsContent>
                                </Tabs>
                                <DialogFooter className="mt-4">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setCustomerDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={createCustomerMutation.isPending}
                                  >
                                    {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl>
                        <SearchableCombobox
                          options={customerOptions}
                          value={field.value ? field.value.toString() : ''}
                          onChange={(value) => {
                            console.log("Customer selected:", value);
                            field.onChange(value);
                          }}
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
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Phone:</span>
                              <span>{selectedCustomer.phone}</span>
                            </div>
                          )}
                          {selectedCustomer.email && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Email:</span>
                              <span>{selectedCustomer.email}</span>
                            </div>
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
              
              {/* Damage Check Upload */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel>Upload Damage Check</FormLabel>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <FileCheck className="h-3.5 w-3.5 mr-1" />
                    Will be linked to vehicle documents
                  </div>
                </div>
                
                <div 
                  className={`border-2 border-dashed rounded-md p-6 transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  
                  {damageFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileCheck className="h-8 w-8 mr-2 text-green-500" />
                        <div>
                          <p className="font-medium text-sm">{damageFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(damageFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDamageFile();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Drag & drop or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a damage check document for this reservation (PDF, JPG, PNG)
                      </p>
                    </div>
                  )}
                </div>
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
