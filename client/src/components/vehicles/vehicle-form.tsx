import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertVehicleSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import { useLocation } from "wouter";

// Utility function to handle null values for form inputs
const handleFieldValue = (value: any): string => {
  return value === null || value === undefined ? '' : String(value);
};

// Extended schema with validation
export const formSchema = insertVehicleSchema.extend({
  licensePlate: z.string().min(1, "License plate is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  // Make these fields truly optional
  registeredTo: z.boolean().optional(),
  company: z.boolean().optional(),
  // Make mileage fields optional
  departureMileage: z.union([
    z.string().optional(),
    z.number().optional(),
    z.null()
  ]).optional().transform(val => val === '' ? null : val === null ? null : Number(val)),
  returnMileage: z.union([
    z.string().optional(),
    z.number().optional(),
    z.null()
  ]).optional().transform(val => val === '' ? null : val === null ? null : Number(val)),
});

// Vehicle types
const vehicleTypes = ["Sedan", "SUV", "Van", "Hatchback", "Coupe", "Truck", "Other"];

// Fuel types
const fuelTypes = ["Gasoline", "Diesel", "Electric", "Hybrid", "LPG", "CNG"];

// Euro zone classifications
const euroZones = ["Euro 3", "Euro 4", "Euro 5", "Euro 6", "Euro 6d"];

interface VehicleFormProps {
  editMode?: boolean;
  initialData?: any;
  redirectToList?: boolean;
  onSuccess?: (vehicle: any) => void;
  onSubmitOverride?: (data: any) => void; // Optional override for form submission
  customCancelButton?: React.ReactNode;
}

export function VehicleForm({ 
  editMode = false, 
  initialData,
  redirectToList = true,
  onSuccess,
  onSubmitOverride,
  customCancelButton
}: VehicleFormProps) {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  // Process initial data to ensure boolean fields are properly formatted
  const processedInitialData = initialData ? {
    ...initialData,
    // For regular boolean fields
    adBlue: Boolean(initialData.adBlue),
    gps: Boolean(initialData.gps),
    damageCheck: Boolean(initialData.damageCheck),
    roadsideAssistance: Boolean(initialData.roadsideAssistance),
    spareKey: Boolean(initialData.spareKey),
    winterTires: Boolean(initialData.winterTires),
    wokNotification: Boolean(initialData.wokNotification),
    seatcovers: Boolean(initialData.seatcovers),
    backupbeepers: Boolean(initialData.backupbeepers),
    
    // For string-boolean fields, convert to actual boolean for UI
    registeredTo: initialData.registeredTo === "true" || initialData.registeredTo === true,
    company: initialData.company === "true" || initialData.company === true,
  } : null;

  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: processedInitialData || {
      licensePlate: "",
      brand: "",
      model: "",
      vehicleType: "",
      chassisNumber: "",
      fuel: "",
      adBlue: false,
      euroZone: "",
      euroZoneEndDate: "",
      apkDate: "",
      warrantyEndDate: "",
      registeredTo: false,
      registeredToDate: "",
      productionDate: "",
      company: false,
      companyDate: "",
      gps: false,
      monthlyPrice: "",
      dailyPrice: "",
      dateIn: "",
      dateOut: "",
      contractNumber: "",
      damageCheck: false,  // Changed from empty string to false
      damageCheckDate: "",
      damageCheckAttachment: "",
      damageCheckAttachmentDate: "",
      roadsideAssistance: false,
      spareKey: false,
      remarks: "",
      winterTires: false,
      tireSize: "",
      wokNotification: false,
      radioCode: "",
      seatcovers: false,
      backupbeepers: false,
      internalAppointments: "",
      departureMileage: "",
      returnMileage: "",
      createdBy: "",
    },
  });
  
  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      console.log("Vehicle data being sent:", JSON.stringify(data));
      
      const url = editMode ? `/api/vehicles/${initialData?.id}` : "/api/vehicles";
      console.log(`Sending request to ${url}`);
      
      try {
        const response = await apiRequest(
          editMode ? "PATCH" : "POST", 
          url, 
          data
        );
        
        console.log("Response received:", response);
        // Parse the response to see if there's a more detailed error message
        if (!response.ok) {
          const errorData = await response.json();
          console.error("API error:", errorData);
          throw new Error(errorData.message || "Failed to save vehicle data");
        }
        
        return response;
      } catch (error) {
        console.error("Request failed:", error);
        throw error;
      }
    },
    onSuccess: async (response) => {
      console.log("Vehicle saved successfully");
      
      // Parse the response to get the created/updated vehicle data
      let vehicleData;
      try {
        // Clone the response before parsing it to avoid the "body already read" error
        const clonedResponse = response.clone();
        vehicleData = await response.json();
        console.log("Successfully parsed vehicle data:", vehicleData);
      } catch (e) {
        console.error("Failed to parse response JSON:", e);
        vehicleData = { id: initialData?.id };
      }
      
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Also invalidate the specific vehicle query if we're in edit mode
      if (editMode && initialData?.id) {
        await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${initialData.id}`] });
      }
      
      // Show success message
      toast({
        title: `Vehicle ${editMode ? "updated" : "created"} successfully`,
        description: `The vehicle has been ${editMode ? "updated" : "added"} to your fleet.`,
      });
      
      console.log("onSuccess callback exists:", !!onSuccess);
      console.log("redirectToList value:", redirectToList);
      
      // If a success callback was provided, call it with the vehicle data
      if (onSuccess && typeof onSuccess === 'function') {
        console.log("Calling onSuccess callback with vehicle data");
        onSuccess(vehicleData);
        // When a callback is provided, we assume it will handle navigation
        return;
      } 
      
      // Only navigate if redirectToList is true and we didn't call onSuccess
      if (redirectToList) {
        console.log("Navigating based on redirectToList flag");
        if (editMode && initialData?.id) {
          // Navigate to vehicle details page when updating
          navigate(`/vehicles/${initialData.id}`);
        } else {
          // Navigate to vehicles list for new vehicles
          navigate("/vehicles");
        }
      } else {
        console.log("Not navigating because redirectToList is false");
      }
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      
      // Handle specific error types based on status code or error content
      let title = "Error";
      let description = `Failed to ${editMode ? "update" : "create"} vehicle: ${error.message}`;
      
      // Check for duplicate license plate error (409 status or specific message)
      if (error.status === 409 || error.message?.includes("license plate already exists")) {
        title = "Duplicate License Plate";
        description = "A vehicle with this license plate already exists. Please use a different license plate or edit the existing vehicle.";
        
        // Highlight the license plate field
        form.setError("licensePlate", {
          type: "duplicate",
          message: "This license plate is already in use"
        });
      } else if (error.message?.includes("required")) {
        title = "Missing Information";
        description = "Please fill in all required fields: License Plate, Brand, and Model.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });
  
  const lookupVehicleMutation = useMutation({
    mutationFn: async (licensePlate: string) => {
      const response = await fetch(`/api/rdw/vehicle/${licensePlate}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      // Check if the response is OK before parsing
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        const error = new Error(errorData.message || "Failed to lookup vehicle");
        (error as any).status = response.status;
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (vehicleData) => {
      // Fill form with retrieved data, converting null values to empty strings
      Object.keys(vehicleData).forEach((key) => {
        if (form.getValues(key as any) !== undefined) {
          // Convert null values to empty strings for form compatibility
          const value = vehicleData[key] === null ? "" : vehicleData[key];
          form.setValue(key as any, value);
        }
      });
      
      toast({
        title: "Vehicle information found",
        description: "Successfully retrieved vehicle information from RDW database.",
      });
    },
    onError: (error: any) => {
      console.error("RDW lookup error:", error);
      
      // Handle specific error types based on status code
      let title = "Lookup failed";
      let description = "Could not retrieve vehicle information";
      
      if (error.status === 404) {
        title = "Vehicle not found";
        description = "No vehicle found with this license plate in the RDW database. Please check the plate number and try again.";
      } else if (error.status === 504) {
        title = "Service timeout";
        description = "The RDW service is taking too long to respond. Please try again later.";
      } else if (error.status === 502) {
        title = "Service unavailable";
        description = "The RDW service is currently unavailable. Please try again later.";
      } else {
        description = error.message || description;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLookingUp(false);
    }
  });
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Process the form data before submission
    const formattedData: any = { ...data };
    
    // Remove all registration tracking fields from the form data
    // as these should only be modified by the server-side tracking endpoints
    delete formattedData.registeredToBy;
    delete formattedData.companyBy;
    delete formattedData.registeredToDate;
    delete formattedData.companyDate;
    
    console.log("Original form data:", data);
    
    // Handle empty string values for numeric fields
    if (formattedData.departureMileage === "") formattedData.departureMileage = null;
    if (formattedData.returnMileage === "") formattedData.returnMileage = null;
    if (formattedData.monthlyPrice === "") formattedData.monthlyPrice = null;
    if (formattedData.dailyPrice === "") formattedData.dailyPrice = null;
    
    // Convert boolean values to match the database schema expectations
    // Force boolean values for registeredTo
    if ('registeredTo' in formattedData) {
      if (formattedData.registeredTo === "" || formattedData.registeredTo === "false" || 
          formattedData.registeredTo === false || formattedData.registeredTo === null || 
          formattedData.registeredTo === undefined) {
        formattedData.registeredTo = false;
      } else {
        formattedData.registeredTo = true;
      }
    } else {
      formattedData.registeredTo = false;
    }
    
    // Force boolean values for company
    if ('company' in formattedData) {
      if (formattedData.company === "" || formattedData.company === "false" || 
          formattedData.company === false || formattedData.company === null || 
          formattedData.company === undefined) {
        formattedData.company = false;
      } else {
        formattedData.company = true;
      }
    } else {
      formattedData.company = false;
    }
    
    // Separate normal boolean fields from string-boolean fields
    const booleanFields = ['winterTires', 'damageCheck', 'roadsideAssistance', 
      'spareKey', 'wokNotification', 'seatcovers', 'backupbeepers', 'gps', 'adBlue'];
    
    // These fields are stored as strings in the database despite being boolean in the UI
    const stringBooleanFields = ['registeredTo', 'company'];
    
    booleanFields.forEach(field => {
      // Convert any value to a proper boolean
      if (field in formattedData) {
        if (formattedData[field] === "" || formattedData[field] === "false" || formattedData[field] === false || formattedData[field] === null || formattedData[field] === undefined) {
          formattedData[field] = false;
        } else {
          formattedData[field] = true;
        }
      } else {
        // If field is missing, set it to false
        formattedData[field] = false; 
      }
    });
    
    // Handle string-boolean fields differently - convert to strings "true" or "false"
    stringBooleanFields.forEach(field => {
      // Convert any value to a string representation of boolean
      if (field in formattedData) {
        if (formattedData[field] === "" || formattedData[field] === "false" || formattedData[field] === false || formattedData[field] === null || formattedData[field] === undefined) {
          formattedData[field] = "false";
        } else {
          formattedData[field] = "true";
        }
      } else {
        // If field is missing, set it to "false"
        formattedData[field] = "false"; 
      }
    });
    
    // Clean up date fields if they're empty strings
    Object.keys(formattedData).forEach(key => {
      if (key.toLowerCase().includes('date') && formattedData[key] === "") {
        formattedData[key] = null;
      }
    });
    
    console.log("Processed vehicle data:", formattedData);
    
    // If a submission override was provided, use that instead of our default flow
    if (onSubmitOverride && typeof onSubmitOverride === 'function') {
      console.log("Using submission override function");
      return onSubmitOverride(formattedData);
    }
    
    try {
      // First, check if we're making a registration status change
      const previousData = initialData || {};
      
      // Convert string "true"/"false" to actual booleans for comparison
      const prevRegisteredTo = previousData.registeredTo === "true" || previousData.registeredTo === true;
      const prevCompany = previousData.company === "true" || previousData.company === true;
      const newRegisteredTo = formattedData.registeredTo === "true" || formattedData.registeredTo === true;
      const newCompany = formattedData.company === "true" || formattedData.company === true;
      
      // Check if there's an actual change in registration status
      const isRegStatusChange = editMode && (
        (prevRegisteredTo !== newRegisteredTo) || 
        (prevCompany !== newCompany)
      );
      
      console.log("Previous registration status:", {
        registeredTo: prevRegisteredTo,
        company: prevCompany
      });
      
      console.log("New registration status:", {
        registeredTo: newRegisteredTo,
        company: newCompany
      });
      
      console.log("Registration status change detected:", isRegStatusChange);
      
      // Track the response data
      let responseData;
      
      // If we're changing registration status, use the dedicated endpoint first
      if (isRegStatusChange && editMode) {
        console.log("Using dedicated registration toggle endpoint");
        
        // Determine which status we're changing to based on new values
        // We now have 4 possible toggles:
        // - opnaam: Set registeredTo to true
        // - not-opnaam: Set registeredTo to false
        // - bv: Set company to true
        // - not-bv: Set company to false
        
        // Important: When toggling one status, automatically turn off the other
        // to maintain the business rule that a car can't be both Opnaam and BV
        let toggleStatus = null;
        
        // Check which status was actually changed by the user
        if (newRegisteredTo !== prevRegisteredTo) {
          if (newRegisteredTo) {
            toggleStatus = "opnaam"; // Setting to "opnaam"
            
            // Auto-disable company status if enabling registeredTo
            if (prevCompany) {
              console.log("Automatically disabling BV status because Opnaam is being activated");
              formattedData.company = "false";
            }
          } else {
            toggleStatus = "not-opnaam"; // Removing "opnaam"
          }
        } else if (newCompany !== prevCompany) {
          if (newCompany) {
            toggleStatus = "bv"; // Setting to "bv"
            
            // Auto-disable registeredTo status if enabling company
            if (prevRegisteredTo) {
              console.log("Automatically disabling Opnaam status because BV is being activated");
              formattedData.registeredTo = "false";
            }
          } else {
            toggleStatus = "not-bv"; // Removing "bv"
          }
        }
        
        console.log(`Selected toggle status: ${toggleStatus}`);
        
        // Call toggle endpoint if we've determined which status to change to
        if (toggleStatus) {
          console.log(`Sending toggle registration request with status: ${toggleStatus}`);
          
          const toggleResponse = await apiRequest(
            "PATCH",
            `/api/vehicles/${initialData.id}/toggle-registration`,
            { status: toggleStatus }
          );
          
          if (!toggleResponse.ok) {
            const errorData = await toggleResponse.json();
            console.error("Registration toggle error:", errorData);
            throw new Error(errorData.message || "Failed to update registration status");
          }
          
          // Remove ALL registration-related fields from the main update since we already handled them
          // This ensures we don't accidentally update registration tracking fields through the vehicle update
          delete formattedData.registeredTo;
          delete formattedData.company;
          delete formattedData.registeredToDate;
          delete formattedData.companyDate;
          delete formattedData.registeredToBy;
          delete formattedData.companyBy;
          // This is very important - we need to ensure that when using the dedicated endpoint,
          // we don't update any registration fields through the regular update endpoint
          
          // Get the initial response data
          responseData = await toggleResponse.json();
          console.log("Registration toggle response:", responseData);
        } else {
          console.warn("Could not determine appropriate toggle status, skipping dedicated endpoint");
        }
      }
      
      // If there are still fields to update OR we're creating a new vehicle, make the standard request
      if (Object.keys(formattedData).length > 0 || !editMode) {
        // Use apiRequest helper instead of raw fetch to ensure consistency
        const url = editMode ? `/api/vehicles/${initialData?.id}` : "/api/vehicles";
        console.log(`Sending API request to ${url}`);
        
        const response = await apiRequest(
          editMode ? "PATCH" : "POST", 
          url, 
          formattedData
        );
        
        console.log("API response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("API error:", errorData);
          throw new Error(errorData.message || "Failed to save vehicle data");
        }
        
        responseData = await response.json();
        console.log("API response data:", responseData);
      }
      
      // Force more aggressive cache invalidation
      
      // First invalidate all vehicle-related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Invalidate dashboard queries that might show vehicle data
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      // Also invalidate the specific vehicle query if we're in edit mode with a refetchType of "all"
      if (editMode && initialData?.id) {
        await queryClient.invalidateQueries({ 
          queryKey: [`/api/vehicles/${initialData.id}`],
          refetchType: "all" 
        });
      }
      
      toast({
        title: `Vehicle ${editMode ? "updated" : "created"} successfully`,
        description: `The vehicle has been ${editMode ? "updated" : "added"} to your fleet.`,
      });
      
      // Navigate to the appropriate page
      if (editMode && initialData?.id) {
        // Navigate to vehicle details page when updating
        navigate(`/vehicles/${initialData.id}`);
      } else {
        // Navigate to vehicles list for new vehicles
        navigate("/vehicles");
      }
    } catch (error: any) {
      console.error("API request failed:", error);
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "create"} vehicle: ${error.message}`,
        variant: "destructive",
      });
    }
  };
  
  const handleLookup = () => {
    const licensePlate = form.getValues("licensePlate");
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

  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Vehicle" : "Add New Vehicle"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Plate</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="AB-123-C" {...field} />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleLookup}
                          disabled={isLookingUp || lookupVehicleMutation.isPending}
                          data-testid="button-lookup"
                        >
                          {isLookingUp ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Looking up...
                            </span>
                          ) : (
                            "Lookup"
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Enter the license plate and click "Lookup" to automatically fill vehicle information from the Dutch RDW database.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
                <TabsTrigger value="dates">Dates</TabsTrigger>
                <TabsTrigger value="contract">Contract</TabsTrigger>
                <TabsTrigger value="additional">Additional</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input placeholder="Volkswagen" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Golf" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={handleFieldValue(field.value) || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vehicleTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="chassisNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chassis Number</FormLabel>
                        <FormControl>
                          <Input placeholder="VIN/Chassis number" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="technical" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fuel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={handleFieldValue(field.value) || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {fuelTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="adBlue"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>AdBlue</FormLabel>
                          <FormDescription>
                            Vehicle uses AdBlue
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="gps"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>GPS</FormLabel>
                          <FormDescription>
                            Vehicle has GPS tracking
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('gps') && (
                    <FormField
                      control={form.control}
                      name="imei"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IMEI Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter GPS device IMEI number" {...field} value={handleFieldValue(field.value)} />
                          </FormControl>
                          <FormDescription>
                            IMEI number for GPS device tracking
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="roadsideAssistance"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Roadside Assistance</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="spareKey"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Spare Key</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="winterTires"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Winter Tires</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="wokNotification"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>WOK Notification</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="seatcovers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Seat Covers</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="backupbeepers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Backup Beepers</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value as boolean}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                
                  <FormField
                    control={form.control}
                    name="tireSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tire Size</FormLabel>
                        <FormControl>
                          <Input placeholder="Tire size" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="radioCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Radio Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Radio code" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                </div>
              </TabsContent>
              
              <TabsContent value="dates" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="apkDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>APK Expiration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormDescription>
                          Date when the APK (inspection) expires
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="warrantyEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormDescription>
                          Date when the warranty expires
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="productionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Build Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="col-span-2 mb-4">
                    <h3 className="text-sm font-medium mb-2">Registration Status (select one or none)</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="registeredTo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Registration: Opnaam</FormLabel>
                          <FormDescription>
                            Vehicle is registered to a person (Opnaam)
                          </FormDescription>
                          {field.value && (
                            <FormDescription className="text-xs text-muted-foreground">
                              Last updated: {form.getValues().registeredToDate || 'Not set'}
                            </FormDescription>
                          )}
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={(checked) => {
                              // Store as boolean in form for UI consistency
                              field.onChange(checked);
                              if (checked) {
                                // If registeredTo is turned on, turn off company (as boolean for UI)
                                form.setValue('company', false);
                                // Update registeredToDate with current date
                                form.setValue('registeredToDate', new Date().toISOString().split('T')[0]);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="registeredToDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormDescription>
                          Date when the vehicle was registered to a person
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Registration: BV</FormLabel>
                          <FormDescription>
                            Vehicle is registered to a company (BV)
                          </FormDescription>
                          {field.value && (
                            <FormDescription className="text-xs text-muted-foreground">
                              Last updated: {form.getValues().companyDate || 'Not set'}
                            </FormDescription>
                          )}
                        </div>
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={(checked) => {
                              // Store as boolean in form for UI consistency
                              field.onChange(checked);
                              if (checked) {
                                // If company is turned on, turn off registeredTo (as boolean for UI)
                                form.setValue('registeredTo', false);
                                // Update companyDate with current date
                                form.setValue('companyDate', new Date().toISOString().split('T')[0]);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="companyDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Registration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormDescription>
                          Date when the vehicle was registered to the company
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="euroZone"
                    render={({ field }) => {
                      return (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked ? 'Euro 6' : '');
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Euro Zone
                            </FormLabel>
                            <FormDescription>
                              Enable this if the vehicle has a Euro classification
                            </FormDescription>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  
                  <FormField
                    control={form.control}
                    name="euroZoneEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Euro Zone End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormDescription>
                          Date when the Euro Zone classification expires
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  

                </div>
              </TabsContent>
              
              <TabsContent value="contract" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Price (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="dailyPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily Price (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="contractNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Contract number" {...field} value={handleFieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="returnMileage"
                    render={({ field: { onChange, ...restField } }) => (
                      <FormItem>
                        <FormLabel>Return Mileage (km) <span className="text-sm font-normal text-muted-foreground">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...restField} 
                            value={restField.value ?? ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? '' : e.target.value;
                              onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter return mileage if known
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="additional" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="internalAppointments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Internal Appointments</FormLabel>
                          <FormControl>
                            <textarea 
                              className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Internal appointments and notes" 
                              {...field} 
                              value={handleFieldValue(field.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Remarks</FormLabel>
                          <FormControl>
                            <textarea 
                              className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Additional remarks" 
                              {...field} 
                              value={handleFieldValue(field.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end space-x-2">
              {customCancelButton ? (
                customCancelButton
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/vehicles")}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="button" 
                disabled={createVehicleMutation.isPending}
                onClick={() => {
                  // Get form values manually
                  if (form.formState.isValid) {
                    const data = form.getValues();
                    onSubmit(data);
                  } else {
                    // Trigger form validation
                    form.handleSubmit(onSubmit)();
                    
                    // Show validation errors
                    console.error("Form validation errors:", form.formState.errors);
                    toast({
                      title: "Validation Error",
                      description: "Please check the form for errors",
                      variant: "destructive",
                    });
                  }
                }}
              >
                {createVehicleMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  editMode ? "Update Vehicle" : "Add Vehicle"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
