import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertReservationSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { CustomerForm } from "@/components/customers/customer-form";
import { VehicleQuickForm } from "@/components/vehicles/vehicle-quick-form";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
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
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { formatDate, formatLicensePlate } from "@/lib/format-utils";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { Customer, Vehicle, Reservation } from "@shared/schema";
import { PlusCircle, FileCheck, Upload, Check, X, Edit } from "lucide-react";
import { ReadonlyVehicleDisplay } from "@/components/ui/readonly-vehicle-display";

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
  endDate: z.string().optional(),
  isOpenEnded: z.boolean().optional(),
  totalPrice: z.union([
    z.number().optional(),
    z.string().transform(val => val === "" ? undefined : parseFloat(val) || undefined),
  ]).optional(),
  damageCheckFile: z.instanceof(File).optional(),
  departureMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
  startMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
}).refine((data) => {
  // If not open-ended, end date is required
  if (!data.isOpenEnded && (!data.endDate || data.endDate === "")) {
    return false;
  }
  return true;
}, {
  message: "End date is required for non-open-ended rentals",
  path: ["endDate"],
});

interface ReservationFormProps {
  editMode?: boolean;
  initialData?: any;
  initialVehicleId?: string;
  initialCustomerId?: string;
  initialStartDate?: string;
}

export function ReservationForm({ 
  editMode = false, 
  initialData,
  initialVehicleId,
  initialCustomerId,
  initialStartDate
}: ReservationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  // Extract URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedVehicleId = urlParams.get("vehicleId");
  const preSelectedCustomerId = urlParams.get("customerId");
  const preSelectedStartDate = urlParams.get("startDate");
  
  // Form states
  const [selectedStartDate, setSelectedStartDate] = useState<string>(
    initialStartDate || preSelectedStartDate || format(new Date(), "yyyy-MM-dd")
  );
  const [isOpenEnded, setIsOpenEnded] = useState<boolean>(
    initialData?.endDate === null || initialData?.endDate === undefined || false
  );
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [vehicleEditDialogOpen, setVehicleEditDialogOpen] = useState(false);
  const [customerEditDialogOpen, setCustomerEditDialogOpen] = useState(false);
  const [damageFile, setDamageFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(initialData?.status || "pending");
  const [departureMileage, setDepartureMileage] = useState<number | undefined>(
    initialData?.vehicle?.departureMileage || undefined
  );
  const [startMileage, setStartMileage] = useState<number | undefined>(
    initialData?.startMileage || undefined
  );
  
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
  
  // Fetch customers for select field
  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch selected vehicle details if vehicleId is provided
  const actualVehicleId = initialVehicleId || preSelectedVehicleId;
  const { data: preSelectedVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${actualVehicleId}`],
    enabled: !!actualVehicleId,
  });
  
  // Fetch selected customer details if customerId is provided
  const { data: preSelectedCustomer } = useQuery<Customer>({
    queryKey: [`/api/customers/${preSelectedCustomerId}`],
    enabled: !!preSelectedCustomerId,
  });
  
  // Get today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  // Default end date is 3 days from start date (unless open-ended)
  const defaultEndDate = !isOpenEnded ? format(addDays(parseISO(selectedStartDate), 3), "yyyy-MM-dd") : "";
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: initialVehicleId || preSelectedVehicleId || "",
      customerId: initialCustomerId || preSelectedCustomerId || "", 
      startDate: selectedStartDate,
      endDate: defaultEndDate,
      isOpenEnded: isOpenEnded,
      status: "pending",
      totalPrice: 0,
      notes: ""
    },
  });
  
  // Watch for changes to calculate duration
  const startDateWatch = form.watch("startDate");
  const endDateWatch = form.watch("endDate");
  const isOpenEndedWatch = form.watch("isOpenEnded");
  const vehicleIdWatch = form.watch("vehicleId");
  const customerIdWatch = form.watch("customerId");
  const statusWatch = form.watch("status");
  
  // Find the selected vehicle and customer
  const selectedVehicle = useMemo(() => {
    if (!vehicles || !vehicleIdWatch) return null;
    return vehicles.find(v => v.id === Number(vehicleIdWatch)) || null;
  }, [vehicles, vehicleIdWatch]);
  
  const selectedCustomer = useMemo(() => {
    if (!customers || !customerIdWatch) return null;
    return customers.find(c => c.id === Number(customerIdWatch)) || null;
  }, [customers, customerIdWatch]);
  
  // Calculate rental duration
  const rentalDuration = useMemo(() => {
    if (!startDateWatch) return 1;
    if (isOpenEndedWatch) return "Open-ended";
    if (!endDateWatch) return 1;
    const start = parseISO(startDateWatch);
    const end = parseISO(endDateWatch);
    const days = differenceInDays(end, start) + 1; // Include the start day
    return days > 0 ? days : 1;
  }, [startDateWatch, endDateWatch, isOpenEndedWatch]);
  
  // Check for reservation conflicts
  const [hasOverlap, setHasOverlap] = useState(false);
  
  // Watch for status changes
  useEffect(() => {
    // Update currentStatus when status changes in the form
    if (statusWatch) {
      setCurrentStatus(statusWatch);
    }
  }, [statusWatch]);

  // Sync isOpenEnded state with form watch
  useEffect(() => {
    if (isOpenEndedWatch !== isOpenEnded) {
      setIsOpenEnded(!!isOpenEndedWatch);
    }
  }, [isOpenEndedWatch]);

  // Update end date when open-ended status changes
  useEffect(() => {
    if (isOpenEndedWatch) {
      form.setValue("endDate", "");
    } else if (!form.getValues("endDate")) {
      // Set default end date if not open-ended and no end date set
      form.setValue("endDate", format(addDays(parseISO(startDateWatch || selectedStartDate), 3), "yyyy-MM-dd"));
    }
  }, [isOpenEndedWatch, form, startDateWatch, selectedStartDate]);
  
  useEffect(() => {
    if (vehicleIdWatch && startDateWatch && !editMode) {
      // Skip conflict checking for open-ended rentals
      if (isOpenEndedWatch) {
        setHasOverlap(false);
        return;
      }
      
      if (!endDateWatch) return;
      
      const checkConflicts = async () => {
        try {
          const response = await fetch(
            `/api/reservations/check-conflicts?vehicleId=${vehicleIdWatch}&startDate=${startDateWatch}&endDate=${endDateWatch}${initialData?.id ? `&excludeReservationId=${initialData.id}` : ""}`
          );
          if (response.ok) {
            const conflicts = await response.json();
            setHasOverlap(conflicts.length > 0);
          }
        } catch (error) {
          console.error("Failed to check reservation conflicts:", error);
        }
      };
      
      checkConflicts();
    }
  }, [vehicleIdWatch, startDateWatch, endDateWatch, isOpenEndedWatch, editMode, initialData?.id]);
  
  // Format customer options for searchable combobox
  const customerOptions = useMemo(() => {
    if (!customers) return [];
    return customers.map(customer => ({
      value: customer.id.toString(),
      label: customer.name,
      description: customer.email || customer.phone || undefined,
    }));
  }, [customers]);
  
  // Format vehicle options for searchable combobox
  const vehicleOptions = useMemo(() => {
    if (!vehicles) return [];
    
    // Group by vehicle type
    const vehiclesByType = vehicles.reduce((acc, vehicle) => {
      const type = vehicle.vehicleType || "Other";
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        value: vehicle.id.toString(),
        label: `${vehicle.brand} ${vehicle.model}`,
        description: formatLicensePlate(vehicle.licensePlate),
      });
      return acc;
    }, {} as Record<string, Array<{value: string, label: string, description?: string}>>);
    
    // Convert to array of groups
    return Object.entries(vehiclesByType).map(([type, options]) => ({
      label: type,
      options,
    }));
  }, [vehicles]);
  
  // Handle customer creation form
  const handleCustomerCreated = async (data: Customer) => {
    console.log("Customer created in reservation form:", data);
    
    // Refresh customers list first to ensure the new customer is available
    await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    await queryClient.refetchQueries({ queryKey: ["/api/customers"] });
    
    // Update form with a slight delay to ensure the revalidation has completed
    setTimeout(() => {
      // Set the new customer in the form
      if (data && data.id) {
        console.log("Setting customer ID to:", data.id);
        // Set the value and trigger form update
        form.setValue("customerId", data.id, { 
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true
        });
      }
      
      // Close the dialog
      setCustomerDialogOpen(false);
      
      // Show success toast
      toast({
        title: "Customer Created",
        description: `${data.name} has been added and selected for this reservation.`,
      });
    }, 500); // Small delay to ensure state updates
  };
  
  // We no longer need a separate createVehicleMutation as we're using VehicleQuickForm
  // which handles all the vehicle creation logic and calls our callback directly
  
  // Handle file upload
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
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // If we're in edit mode, make sure we invalidate the specific reservation details
      if (editMode && initialData?.id) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/reservations/${initialData.id}`] 
        });
      }
      
      // Also invalidate vehicle-specific reservation queries
      if (vehicleIdWatch) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/reservations/vehicle/${vehicleIdWatch}`] 
        });
      }
      
      // Show success message
      toast({
        title: `Reservation ${editMode ? "updated" : "created"} successfully`,
        description: `Reservation for ${selectedVehicle?.brand} ${selectedVehicle?.model} has been ${editMode ? "updated" : "created"}.`
      });
      
      // Force refetch if needed
      queryClient.refetchQueries({ queryKey: ["/api/reservations"] });
      
      // If editing, navigate back to the details page, otherwise go to the list
      if (editMode && initialData?.id) {
        // Navigate to reservation details page
        navigate(`/reservations/${initialData.id}`);
      } else {
        // Navigate back to reservations list
        navigate("/reservations");
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
  
  // Update vehicle mileage mutation 
  const updateVehicleMutation = useMutation({
    mutationFn: async (vehicleData: { id: number, departureMileage?: number, currentMileage?: number }) => {
      // Only include properties that are defined
      const updateData: any = {};
      if (vehicleData.departureMileage !== undefined) {
        updateData.departureMileage = vehicleData.departureMileage;
      }
      if (vehicleData.currentMileage !== undefined) {
        updateData.currentMileage = vehicleData.currentMileage;
      }
      
      return await apiRequest(`/api/vehicles/${vehicleData.id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      // Invalidate vehicle queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update vehicle mileage: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Handle reservation form submission
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Check for overlapping reservations (skip for open-ended rentals)
    if (hasOverlap && !data.isOpenEnded) {
      toast({
        title: "Booking Conflict",
        description: "This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.",
        variant: "destructive",
      });
      return;
    }
    
    // Process data for open-ended rentals
    const submissionData = {
      ...data,
      endDate: data.isOpenEnded ? undefined : data.endDate,
    };
    
    // Remove the isOpenEnded field as it's not part of the backend schema
    delete submissionData.isOpenEnded;
    
    try {
      // Update vehicle mileage based on status
      if (vehicleIdWatch) {
        const vehicleUpdateData: { id: number, departureMileage?: number, currentMileage?: number } = {
          id: Number(vehicleIdWatch)
        };
        
        // If status is confirmed and we have start mileage, update current mileage
        if (submissionData.status === "confirmed" && submissionData.startMileage) {
          vehicleUpdateData.currentMileage = Number(submissionData.startMileage);
        }
        
        // If status is completed and we have departure mileage, update departure mileage
        if (submissionData.status === "completed" && submissionData.departureMileage) {
          vehicleUpdateData.departureMileage = Number(submissionData.departureMileage);
        }
        
        // First create/update the reservation
        const reservationResult = await createReservationMutation.mutateAsync(submissionData);
        
        // Then update the vehicle mileage if we have any mileage data
        if (vehicleUpdateData.currentMileage !== undefined || vehicleUpdateData.departureMileage !== undefined) {
          await updateVehicleMutation.mutateAsync(vehicleUpdateData);
        }
        
        return reservationResult;
      } else {
        // No vehicle ID, just create/update the reservation
        return await createReservationMutation.mutateAsync(submissionData);
      }
    } catch (error) {
      console.error("Error submitting reservation:", error);
      throw error;
    }
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
              <div className="text-lg font-medium">
                {actualVehicleId ? "1. Selected Vehicle & Customer" : "1. Select Vehicle and Customer"}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle Selection - Show read-only or selection based on preSelectedVehicleId */}
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Vehicle</FormLabel>
                      
                      {actualVehicleId ? (
                        // If vehicle is pre-selected, show as read-only
                        <ReadonlyVehicleDisplay vehicleId={actualVehicleId} />
                      ) : (
                        // Otherwise, show selection UI
                        <>
                          <div className="flex justify-end mb-2 gap-2">
                            {/* Edit Vehicle Button - only show if vehicle is selected */}
                            {vehicleIdWatch && (
                              <Dialog open={vehicleEditDialogOpen} onOpenChange={setVehicleEditDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Vehicle</DialogTitle>
                                    <DialogDescription>
                                      Edit the details of the selected vehicle
                                    </DialogDescription>
                                  </DialogHeader>
                                  {selectedVehicle && (
                                    <VehicleForm 
                                      editMode={true}
                                      initialData={selectedVehicle}
                                      redirectToList={false}
                                      onSuccess={async (updatedVehicle) => {
                                        // Refresh vehicles list to show updated data
                                        await refetchVehicles();
                                        
                                        // Close the dialog
                                        setVehicleEditDialogOpen(false);
                                        
                                        // Show success message
                                        toast({
                                          title: "Vehicle Updated",
                                          description: `${updatedVehicle.brand} ${updatedVehicle.model} has been successfully updated.`,
                                        });
                                      }}
                                    />
                                  )}
                                </DialogContent>
                              </Dialog>
                            )}
                            
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
                                <div className="py-4">
                                  {/* Import the VehicleQuickForm component */}
                                  <VehicleQuickForm 
                                    onSuccess={async (vehicle) => {
                                      // Refresh the vehicles list to include the new vehicle
                                      await refetchVehicles();
                                      
                                      // Set the new vehicle in the form
                                      form.setValue("vehicleId", vehicle.id);
                                      
                                      // Close the dialog
                                      setVehicleDialogOpen(false);
                                      
                                      // Show success message
                                      toast({
                                        title: "Vehicle Added",
                                        description: `${vehicle.brand} ${vehicle.model} has been added to your fleet and selected for this reservation.`,
                                      });
                                    }}
                                    onCancel={() => setVehicleDialogOpen(false)}
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                          
                          <FormControl>
                            <VehicleSelector
                              vehicles={vehicles || []}
                              value={field.value ? field.value.toString() : ''}
                              onChange={(value) => {
                                field.onChange(value);
                                if (value) {
                                  saveToRecent('recentVehicles', value);
                                }
                              }}
                              placeholder="Search and select a vehicle..."
                              recentVehicleIds={recentVehicles}
                            />
                          </FormControl>
                          
                          {selectedVehicle && !actualVehicleId && (
                            <div className="mt-2 text-sm bg-muted p-2 rounded-md">
                              <div className="font-medium flex items-center gap-2">
                                <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-semibold">
                                  {formatLicensePlate(selectedVehicle.licensePlate)}
                                </span>
                                <span>{selectedVehicle.brand} {selectedVehicle.model}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {selectedVehicle.vehicleType && (
                                  <Badge variant="outline" className="text-xs">{selectedVehicle.vehicleType}</Badge>
                                )}
                                {selectedVehicle.fuel && (
                                  <Badge variant="outline" className="text-xs">{selectedVehicle.fuel}</Badge>
                                )}
                                {selectedVehicle.apkDate && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                                    APK: {new Date(selectedVehicle.apkDate).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      
                      <FormMessage />
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
                        <div className="flex gap-2">
                          {/* Edit Customer Button - only show if customer is selected */}
                          {customerIdWatch && (
                            <Dialog open={customerEditDialogOpen} onOpenChange={setCustomerEditDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Customer</DialogTitle>
                                  <DialogDescription>
                                    Edit the details of the selected customer
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedCustomer && (
                                  <CustomerForm 
                                    initialData={selectedCustomer}
                                    editMode={true}
                                    onSuccess={async (updatedCustomer) => {
                                      // Refresh customers list to show updated data
                                      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                                      await queryClient.refetchQueries({ queryKey: ["/api/customers"] });
                                      
                                      // Close the dialog
                                      setCustomerEditDialogOpen(false);
                                      
                                      // Show success message
                                      toast({
                                        title: "Customer Updated",
                                        description: `${updatedCustomer.name} has been successfully updated.`,
                                      });
                                    }}
                                    redirectToList={false}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                          )}
                          
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
                            <CustomerForm 
                              onSuccess={handleCustomerCreated} 
                              redirectToList={false} 
                            />
                          </DialogContent>
                        </Dialog>
                        </div>
                      </div>
                      <FormControl>
                        <SearchableCombobox
                          options={customerOptions}
                          value={field.value ? field.value.toString() : ''}
                          onChange={(value) => {
                            console.log("Customer selected:", value);
                            // Force form update with the new customer ID
                            form.setValue("customerId", parseInt(value), {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true
                            });
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
                          {/* Name and Company Information */}
                          <div className="font-medium flex items-center gap-2 mb-1">
                            {selectedCustomer.debtorNumber && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                #{selectedCustomer.debtorNumber}
                              </span>
                            )}
                            <span>{selectedCustomer.name}</span>
                          </div>
                          
                          {selectedCustomer.companyName && (
                            <div className="flex items-center gap-1 mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              <span className="text-muted-foreground">Company:</span>
                              <span>{selectedCustomer.companyName}</span>
                            </div>
                          )}
                          
                          {/* Contact Information */}
                          {selectedCustomer.phone && (
                            <div className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                              </svg>
                              <span>{selectedCustomer.phone}</span>
                            </div>
                          )}
                          {selectedCustomer.email && (
                            <div className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                              </svg>
                              <span>{selectedCustomer.email}</span>
                            </div>
                          )}
                          
                          {/* Address Information if available */}
                          {(selectedCustomer.address || selectedCustomer.city) && (
                            <div className="flex items-start gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mt-0.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              <span>
                                {selectedCustomer.address && <span>{selectedCustomer.address}</span>}
                                {selectedCustomer.address && selectedCustomer.city && <span>, </span>}
                                {selectedCustomer.city && <span>{selectedCustomer.city}</span>}
                              </span>
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
                
                {/* Open-ended rental checkbox */}
                <FormField
                  control={form.control}
                  name="isOpenEnded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          data-testid="checkbox-open-ended-rental"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Open-ended rental
                        </FormLabel>
                        <FormDescription>
                          Check this if the return date is not yet known
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* End Date - only show if not open-ended */}
                {!isOpenEndedWatch && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-end-date"
                            type="date" 
                            min={startDateWatch} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Duration Indicator */}
                <div className="flex flex-col justify-end">
                  <FormLabel className="mb-2 opacity-0">Duration</FormLabel>
                  <div className="border rounded-md h-10 flex items-center px-3 bg-muted">
                    <span className="font-medium">{rentalDuration}</span>
                    {typeof rentalDuration === 'number' && (
                      <span className="ml-1 text-muted-foreground">
                        {rentalDuration === 1 ? "day" : "days"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Separator />
            </div>
            
            {/* Status and Price Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">3. Reservation Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status - Made more prominent */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Reservation Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Booked</SelectItem>
                          <SelectItem value="confirmed">Vehicle picked up</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Vehicle returned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Update the reservation status as needed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Start Mileage field when status is confirmed */}
                {currentStatus === "confirmed" && (
                  <div className="col-span-1">
                    <div className="flex flex-col space-y-1.5">
                      <label htmlFor="startMileage" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Mileage When Picked Up
                      </label>
                      <input
                        id="startMileage"
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter the starting mileage"
                        value={startMileage || ""}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || undefined;
                          setStartMileage(value);
                          form.setValue("startMileage", value as any);
                        }}
                      />
                      <p className="text-[0.8rem] text-muted-foreground">
                        Enter the vehicle's odometer reading when it was picked up
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Mileage When Returned field when status is completed */}
                {currentStatus === "completed" && (
                  <div className="col-span-1">
                    <div className="flex flex-col space-y-1.5">
                      <label htmlFor="departureMileage" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Mileage When Returned
                      </label>
                      <input
                        id="departureMileage"
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter the final mileage"
                        value={departureMileage || ""}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || undefined;
                          setDepartureMileage(value);
                          form.setValue("departureMileage", value as any);
                        }}
                      />
                      <p className="text-[0.8rem] text-muted-foreground">
                        Enter the vehicle's odometer reading when it was returned
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Price */}
                <FormField
                  control={form.control}
                  name="totalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Price (€) <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => {
                            // Allow emptying the field (making it optional)
                            const value = e.target.value === "" 
                              ? undefined 
                              : parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                          value={field.value === undefined || field.value === null ? "" : field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {typeof rentalDuration === 'number' 
                          ? `Enter the total price for the ${rentalDuration}-day rental`
                          : "Enter the total price for this open-ended rental"}
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
                  <div className="text-xs text-muted-foreground">Optional</div>
                </div>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragActive 
                      ? "border-primary bg-primary/5" 
                      : damageFile 
                        ? "border-success bg-success/5" 
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {!damageFile ? (
                    <>
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground/70" />
                        <div className="text-sm font-medium">
                          Drag & drop a damage check document here, or click to browse
                        </div>
                        <input
                          type="file"
                          id="damageCheckFile"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileChange}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => document.getElementById("damageCheckFile")?.click()}
                        >
                          Select File
                        </Button>
                        <div className="text-xs text-muted-foreground mt-2">
                          Accepted formats: PDF, JPG, PNG (max 25MB)
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 text-success">
                        <Check className="h-5 w-5" />
                        <span className="font-medium">File uploaded</span>
                      </div>
                      <div className="flex items-center justify-center mt-2">
                        <FileCheck className="h-12 w-12 text-muted-foreground/70 mr-3" />
                        <div className="text-left">
                          <div className="font-medium truncate max-w-[200px]">
                            {damageFile.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(damageFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={removeDamageFile}
                        className="mt-4"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </>
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
                        placeholder="Add any additional notes or requirements..." 
                        className="min-h-[100px]" 
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end gap-4">
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
                {createReservationMutation.isPending 
                  ? "Saving..." 
                  : editMode ? "Update Reservation" : "Create Reservation"
                }
              </Button>
            </div>
            
            {/* Booking Conflict Warning */}
            {hasOverlap && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md flex items-center gap-2 text-destructive mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.</div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}