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

// Extended schema with validation
const formSchema = insertVehicleSchema.extend({
  licensePlate: z.string().min(1, "License plate is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
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
}

export function VehicleForm({ editMode = false, initialData }: VehicleFormProps) {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      licensePlate: "",
      brand: "",
      model: "",
      vehicleType: "",
      chassisNumber: "",
      fuel: "",
      euroZone: "",
      apkDate: "",
      warrantyDate: "",
    },
  });
  
  const createVehicleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(
        editMode ? "PATCH" : "POST", 
        editMode ? `/api/vehicles/${initialData?.id}` : "/api/vehicles", 
        data
      );
    },
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Show success message
      toast({
        title: `Vehicle ${editMode ? "updated" : "created"} successfully`,
        description: `The vehicle has been ${editMode ? "updated" : "added"} to your fleet.`,
      });
      
      // Navigate back to vehicles list
      navigate("/vehicles");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "create"} vehicle: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const lookupVehicleMutation = useMutation({
    mutationFn: async (licensePlate: string) => {
      return await apiRequest("GET", `/api/rdw/vehicle/${licensePlate}`, undefined);
    },
    onSuccess: async (response) => {
      const vehicleData = await response.json();
      
      // Fill form with retrieved data
      Object.keys(vehicleData).forEach((key) => {
        if (form.getValues(key as any) !== undefined) {
          form.setValue(key as any, vehicleData[key]);
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
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createVehicleMutation.mutate(data);
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
                        Enter the license plate and click "Lookup" to auto-fill vehicle details from RDW.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General Information</TabsTrigger>
                <TabsTrigger value="technical">Technical Details</TabsTrigger>
                <TabsTrigger value="dates">Important Dates</TabsTrigger>
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
                          defaultValue={field.value}
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
                </div>
              </TabsContent>
              
              <TabsContent value="technical" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="chassisNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chassis Number</FormLabel>
                        <FormControl>
                          <Input placeholder="VIN/Chassis number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="fuel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
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
                    name="euroZone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Euro Zone</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select euro zone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {euroZones.map(zone => (
                              <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <Input type="date" {...field} />
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
                    name="warrantyDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiration Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          Date when the warranty expires
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/vehicles")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createVehicleMutation.isPending}
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
