import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import React, { useState } from "react";
import { Reservation, Vehicle } from "@shared/schema";
import { Check, RotateCw, Search, CalendarClock } from "lucide-react";
import { displayLicensePlate, isTrueValue } from "@/lib/utils";
import { formatDate } from "@/lib/format-utils";
import { SearchableCombobox, type ComboboxOption } from "@/components/ui/searchable-combobox";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { VehicleReservationsStatusDialog } from "@/components/reservations/vehicle-reservations-status-dialog";
import { VehicleSelector } from "@/components/ui/vehicle-selector";

interface ActionIconProps {
  name: string;
  className?: string;
}

function ActionIcon({ name, className = "" }: ActionIconProps) {
  switch (name) {
    case "calendar-clock":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-calendar-clock ${className}`}
        >
          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
          <circle cx="18" cy="18" r="4" />
          <path d="M18 16.5v1.5h1.5" />
        </svg>
      );
    case "calendar-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-calendar-plus ${className}`}
        >
          <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
          <line x1="19" x2="19" y1="16" y2="22" />
          <line x1="16" x2="22" y1="19" y2="19" />
        </svg>
      );
    case "car":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-car ${className}`}
        >
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
          <circle cx="6.5" cy="16.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      );
    case "user-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-user-plus ${className}`}
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      );
    case "upload":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-upload ${className}`}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-alert-triangle ${className}`}
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "receipt":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-receipt ${className}`}
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      );
    case "refresh-cw":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-refresh-cw ${className}`}
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      );
    case "hammer":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-hammer ${className}`}
        >
          <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
          <path d="M17.64 15 22 10.64" />
          <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" />
        </svg>
      );
    default:
      return null;
  }
}

// Define quick actions for the dashboard
interface QuickAction {
  label: string;
  href?: string;
  icon: string;
  dialog?: string;
  primary?: boolean;
}

const quickActions: QuickAction[] = [
  {
    label: "New Reservation",
    href: "/reservations/add",
    icon: "calendar-plus",
    primary: false,
  },
  {
    label: "Add Vehicle",
    href: "/vehicles/add",
    icon: "car",
    primary: false,
  },
  {
    label: "Add Customer",
    href: "/customers/add",
    icon: "user-plus",
    primary: false,
  },
  {
    label: "Upload Document",
    href: "/documents/upload",
    icon: "upload",
    primary: false,
  },
  {
    label: "Log Expense",
    href: "/expenses/add",
    icon: "receipt",
    primary: false,
  },
  {
    label: "Change Reservation Status",
    icon: "calendar-clock",
    dialog: "reservation-status",
    primary: false,
  },
  {
    label: "Change Status by Vehicle",
    icon: "car",
    dialog: "vehicle-reservation-status",
    primary: false,
  },
  {
    label: "Change Registration",
    icon: "refresh-cw",
    dialog: "registration",
    primary: false,
  },
  {
    label: "Upload Damage Form",
    icon: "hammer",
    dialog: "damage-form",
    primary: false,
  },
];

export function QuickActions() {
  // State for the vehicle registration dialog
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [registrationStatus, setRegistrationStatus] = useState<"opnaam" | "bv">("opnaam");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDamageVehicle, setSelectedDamageVehicle] = useState<Vehicle | null>(null);
  const [damageFormFile, setDamageFormFile] = useState<File | null>(null);
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [damageFormSearchQuery, setDamageFormSearchQuery] = useState<string>("");
  const [isDamageUploading, setIsDamageUploading] = useState(false);
  
  // State for the reservation status dialogs
  const [selectedReservation, setSelectedReservation] = useState<number | null>(null);
  const [reservationStatusDialogOpen, setReservationStatusDialogOpen] = useState(false);
  const [vehicleReservationDialogOpen, setVehicleReservationDialogOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Get queryClient for cache invalidation
  const queryClient = useQueryClient();
  
  // Fetch all vehicles for the selection list
  const { data: vehicles, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch upcoming reservations
  const { data: upcomingReservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/upcoming"],
  });
  
  // Handler for changing a single vehicle's registration
  const handleChangeVehicleRegistration = async (vehicleId: number, newStatus: "opnaam" | "bv") => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/toggle-registration`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update registration status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  };
  
  // Handler for batch changing multiple vehicles' registration
  const handleChangeRegistration = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one vehicle",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    // Track results for reporting
    const results = {
      success: 0,
      failed: 0,
      vehicles: [] as { id: number; licensePlate: string; success: boolean }[]
    };
    
    try {
      // Process each vehicle in sequence
      for (const vehicleIdStr of selectedVehicles) {
        const vehicleId = parseInt(vehicleIdStr);
        try {
          const updatedVehicle = await handleChangeVehicleRegistration(vehicleId, registrationStatus);
          results.success++;
          results.vehicles.push({ 
            id: vehicleId, 
            licensePlate: updatedVehicle.licensePlate, 
            success: true 
          });
        } catch (error) {
          results.failed++;
          const vehicle = vehicles?.find(v => v.id === vehicleId);
          results.vehicles.push({ 
            id: vehicleId, 
            licensePlate: vehicle?.licensePlate || `ID: ${vehicleId}`, 
            success: false 
          });
        }
      }
      
      // Determine appropriate message based on results
      if (results.success > 0 && results.failed === 0) {
        toast({
          title: "Success",
          description: `Registration updated to ${registrationStatus === "opnaam" ? "Opnaam" : "BV"} for ${results.success} vehicle${results.success > 1 ? 's' : ''}`,
        });
      } else if (results.success > 0 && results.failed > 0) {
        toast({
          title: "Partial Success",
          description: `Updated ${results.success} vehicle${results.success > 1 ? 's' : ''}, but failed for ${results.failed} vehicle${results.failed > 1 ? 's' : ''}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed",
          description: `Failed to update registration for all ${results.failed} selected vehicles`,
          variant: "destructive",
        });
      }
      
      // Refresh the vehicle list
      refetchVehicles();
      
      // Reset selection
      setSelectedVehicles([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update registration status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reference for dialog closing
  const damageDialogCloseRef = React.useRef(null);
  
  // Handler for uploading damage form and photos
  const handleDamageFormUpload = async () => {
    if (!selectedDamageVehicle) {
      toast({
        title: "Error",
        description: "Please select a vehicle",
        variant: "destructive",
      });
      return;
    }
    
    if (!damageFormFile && damagePhotos.length === 0) {
      toast({
        title: "Error",
        description: "Please upload at least a damage form or damage photos",
        variant: "destructive",
      });
      return;
    }
    
    setIsDamageUploading(true);
    
    try {
      // Upload each document (form and photos) with proper document type
      let uploadCount = 0;
      let errorCount = 0;
      
      // Helper function to upload a document
      const uploadDocument = async (file: File, documentType: string, notes?: string) => {
        const formData = new FormData();
        formData.append("vehicleId", selectedDamageVehicle.id.toString());
        formData.append("documentType", documentType);
        formData.append("file", file);
        
        // Set the appropriate category based on document type - always use damage_checks for consistency
        if (documentType === "Damage Form" || documentType === "Damage Report") {
          formData.append("category", "damage_checks");
        } else if (documentType === "Damage Photo") {
          formData.append("category", "damage_checks");
        }
        
        if (notes) {
          formData.append("notes", notes);
        }
        
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${documentType}: ${response.status}`);
        }
        
        return await response.json();
      };
      
      // Upload damage form if provided
      if (damageFormFile) {
        const document = await uploadDocument(damageFormFile, "Damage Report", "Damage report uploaded from dashboard");
        uploadCount++;
        
        // Update vehicle's damage check status
        try {
          // First get the current vehicle data
          const vehicleResponse = await fetch(`/api/vehicles/${selectedDamageVehicle.id}`);
          if (!vehicleResponse.ok) {
            throw new Error(`Failed to get vehicle data: ${vehicleResponse.status}`);
          }
          
          const vehicleData = await vehicleResponse.json();
          const currentDate = new Date().toISOString().split('T')[0];
          
          // Then send the update with all required fields
          const response = await fetch(`/api/vehicles/${selectedDamageVehicle.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              ...vehicleData, // Include all existing data
              damageCheck: "true", // Then override with our updates
              damageCheckDate: currentDate,
              damageCheckAttachment: document.id.toString(),
              damageCheckAttachmentDate: currentDate
            })
          });
          
          if (!response.ok) {
            console.error("Failed to update vehicle damage check status:", response.status);
          } else {
            // Invalidate cache for this vehicle and for the documents
            queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedDamageVehicle.id] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents/vehicle", selectedDamageVehicle.id] });
          }
        } catch (error) {
          console.error("Error updating vehicle damage check status:", error);
        }
      }
      
      // Upload damage photos if provided
      for (const photo of damagePhotos) {
        try {
          await uploadDocument(photo, "Damage Photo", "Damage photo uploaded from dashboard");
          uploadCount++;
        } catch (error) {
          console.error("Error uploading damage photo:", error);
          errorCount++;
        }
      }
      
      // Invalidate queries to refresh UI
      if (uploadCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents/vehicle", selectedDamageVehicle.id] });
      }
      
      // Show success message
      toast({
        title: uploadCount > 0 ? "Upload Successful" : "Upload Failed",
        description: uploadCount > 0 
          ? `Successfully uploaded ${uploadCount} document${uploadCount > 1 ? 's' : ''}${errorCount > 0 ? `, but ${errorCount} failed` : ''} for ${selectedDamageVehicle.licensePlate}`
          : "Failed to upload any documents",
        variant: uploadCount > 0 ? "default" : "destructive",
      });
      
      // Reset form
      setSelectedDamageVehicle(null);
      setDamageFormFile(null);
      setDamagePhotos([]);
      setDamageFormSearchQuery("");
      
      // Auto-close dialog if successful
      if (uploadCount > 0 && damageDialogCloseRef.current) {
        (damageDialogCloseRef.current as HTMLButtonElement).click();
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload damage documents",
        variant: "destructive",
      });
    } finally {
      setIsDamageUploading(false);
    }
  };
  
  // Handler for when a reservation status has been updated
  const handleReservationStatusUpdated = () => {
    // Refetch upcoming reservations to update the list
    queryClient.invalidateQueries({ queryKey: ["/api/reservations/upcoming"] });
    // Reset the selected reservation
    setSelectedReservation(null);
    // Show a success toast
    toast({
      title: "Success",
      description: "Reservation status updated successfully",
    });
  };
  
  return (
    <>
      {/* Display StatusChangeDialog when a reservation is selected */}
      {selectedReservation && (
        <StatusChangeDialog
          reservationId={selectedReservation}
          open={true}
          onOpenChange={() => setSelectedReservation(null)}
          onStatusChanged={handleReservationStatusUpdated}
          initialStatus=""
        />
      )}
      
      {/* Vehicle-based Reservation Status Dialog */}
      <VehicleReservationsStatusDialog
        open={vehicleReservationDialogOpen}
        onOpenChange={setVehicleReservationDialogOpen}
        onStatusChanged={handleReservationStatusUpdated}
      />
      
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium text-gray-800">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            // For vehicle-based reservation status dialog
            if (action.dialog === "vehicle-reservation-status") {
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                  size="sm"
                  onClick={() => setVehicleReservationDialogOpen(true)}
                >
                  <ActionIcon name={action.icon || "car"} className="mr-1 h-4 w-4" />
                  {action.label}
                </Button>
              );
            }
            
            // For reservation status change dialog
            if (action.dialog === "reservation-status") {
              return (
                <Dialog
                  key={action.label}
                  open={reservationStatusDialogOpen}
                  onOpenChange={setReservationStatusDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                      size="sm"
                    >
                      <ActionIcon name={action.icon || "calendar-clock"} className="mr-1 h-4 w-4" />
                      {action.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Reservation Status</DialogTitle>
                      <DialogDescription>
                        Select a reservation to change its status.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {isLoadingReservations ? (
                        <div className="flex items-center justify-center py-4">
                          <RotateCw className="h-5 w-5 animate-spin text-primary-600" />
                          <span className="ml-2">Loading reservations...</span>
                        </div>
                      ) : !upcomingReservations || upcomingReservations.length === 0 ? (
                        <div className="py-4 text-center text-gray-500">
                          <p>No upcoming reservations found.</p>
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white">
                              <tr className="border-b">
                                <th className="px-2 py-2 text-left">ID</th>
                                <th className="px-2 py-2 text-left">Vehicle</th>
                                <th className="px-2 py-2 text-left">Customer</th>
                                <th className="px-2 py-2 text-left">Status</th>
                                <th className="px-2 py-2 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {upcomingReservations.map((reservation) => {
                                return (
                                  <tr 
                                    key={reservation.id} 
                                    className="border-b hover:bg-gray-50"
                                  >
                                    <td className="px-2 py-2">#{reservation.id}</td>
                                    <td className="px-2 py-2">
                                      {displayLicensePlate(reservation.vehicleLicensePlate || reservation.vehicle?.licensePlate)}
                                    </td>
                                    <td className="px-2 py-2">
                                      {reservation.customerName || reservation.customer?.name}
                                    </td>
                                    <td className="px-2 py-2">
                                      <span className={`
                                        inline-block rounded-full px-2 py-1 text-xs
                                        ${reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                                        ${reservation.status === 'ongoing' ? 'bg-amber-100 text-amber-800' : ''}
                                        ${reservation.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                                        ${reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                                        ${reservation.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
                                      `}>
                                        {reservation.status?.charAt(0).toUpperCase() + reservation.status?.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedReservation(reservation.id);
                                          setReservationStatusDialogOpen(false);
                                        }}
                                      >
                                        <CalendarClock className="mr-1 h-3 w-3" />
                                        Change
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              );
            }
            
            // For damage form upload action, render a Dialog
            if (action.dialog === "damage-form") {
              return (
                <Dialog key={action.label}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                      size="sm"
                    >
                      <ActionIcon name={action.icon || "hammer"} className="mr-1 h-4 w-4" />
                      {action.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upload Damage Report</DialogTitle>
                      <DialogDescription>
                        Select a vehicle and upload damage report and/or photos.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Vehicle search */}
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">
                          Select Vehicle
                        </label>
                        
                        {vehicles && vehicles.length > 0 ? (
                          <>
                            <VehicleSelector 
                              vehicles={vehicles}
                              value={selectedDamageVehicle ? selectedDamageVehicle.id.toString() : ""}
                              onChange={(value) => {
                                const vehicle = vehicles.find(v => v.id.toString() === value);
                                setSelectedDamageVehicle(vehicle || null);
                              }}
                            />
                            
                            {selectedDamageVehicle && (
                              <div className="mt-2 p-3 bg-muted/30 border rounded-md">
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">{displayLicensePlate(selectedDamageVehicle.licensePlate)}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {selectedDamageVehicle.brand} {selectedDamageVehicle.model}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex justify-center items-center h-full">
                            <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {/* File Uploads */}
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="damageForm" className="text-sm font-medium">
                            Damage Report (PDF/Image)
                          </label>
                          <div className="mt-1 flex items-center">
                            <input
                              id="damageForm"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setDamageFormFile(e.target.files[0]);
                                }
                              }}
                              className="w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                cursor-pointer"
                            />
                          </div>
                          {damageFormFile && (
                            <div className="mt-2 flex items-center space-x-2 text-sm">
                              <Check className="h-4 w-4 text-green-500" />
                              <span>{damageFormFile.name}</span>
                              <button
                                type="button"
                                onClick={() => setDamageFormFile(null)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <label htmlFor="damagePhotos" className="text-sm font-medium">
                            Damage Photos (Optional)
                          </label>
                          <div className="mt-1 flex items-center">
                            <input
                              id="damagePhotos"
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              multiple
                              onChange={(e) => {
                                if (e.target.files) {
                                  const newPhotos = Array.from(e.target.files);
                                  setDamagePhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
                                }
                              }}
                              className="w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-primary-50 file:text-primary-700
                                hover:file:bg-primary-100
                                cursor-pointer"
                            />
                          </div>
                          {damagePhotos.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="text-sm font-medium">
                                Selected Photos ({damagePhotos.length})
                              </div>
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-2">
                                {damagePhotos.map((photo, index) => (
                                  <div key={index} className="flex items-center space-x-2 text-xs">
                                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                                    <span className="truncate flex-1">{photo.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDamagePhotos(prevPhotos => 
                                          prevPhotos.filter((_, i) => i !== index)
                                        );
                                      }}
                                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                              {damagePhotos.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setDamagePhotos([])}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  Remove All Photos
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <DialogClose ref={damageDialogCloseRef} asChild>
                        <Button variant="outline" type="button">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button 
                        type="button"
                        onClick={handleDamageFormUpload}
                        disabled={!selectedDamageVehicle || (!damageFormFile && damagePhotos.length === 0) || isDamageUploading}
                      >
                        {isDamageUploading && (
                          <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Upload
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            }
            
            // For registration change dialog, render a Dialog
            if (action.dialog === "registration") {
              return (
                <Dialog key={action.label}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                      size="sm"
                    >
                      <ActionIcon name={action.icon} className="mr-1 h-4 w-4" />
                      {action.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Vehicle Registration</DialogTitle>
                      <DialogDescription>
                        Select vehicles and change their registration status to either "Opnaam" or "BV".
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Search and select vehicles */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Select Vehicles
                        </label>
                        
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by license plate, brand or model"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                            className="mb-2 pl-8"
                          />
                          {searchQuery && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="absolute right-0 top-0 h-full px-3" 
                              onClick={() => setSearchQuery("")}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                        
                        <div className="border rounded h-[200px] overflow-y-auto p-1">
                          {vehicles ? (
                            (() => {
                              // Apply filtering based on search
                              const filteredVehicles = searchQuery
                                ? vehicles.filter(v => {
                                    // Format license plates with and without dashes for flexible searching
                                    const formattedLicensePlate = (v.licensePlate || '').replace(/-/g, '').toLowerCase();
                                    const formattedQuery = searchQuery.replace(/-/g, '').toLowerCase();
                                    
                                    return formattedLicensePlate.includes(formattedQuery) || 
                                      (v.brand?.toLowerCase() || '').includes(searchQuery) || 
                                      (v.model?.toLowerCase() || '').includes(searchQuery);
                                  })
                                : vehicles;
                              
                              // Group by registration status
                              const vehicleGroups: Record<string, Vehicle[]> = {
                                "Opnaam": [],
                                "BV": [],
                                "Unspecified": []
                              };
                              
                              filteredVehicles.forEach(vehicle => {
                                if (!vehicle.registeredTo && !vehicle.company) {
                                  vehicleGroups["Unspecified"].push(vehicle);
                                } else if (isTrueValue(vehicle.registeredTo)) {
                                  vehicleGroups["Opnaam"].push(vehicle);
                                } else if (isTrueValue(vehicle.company)) {
                                  vehicleGroups["BV"].push(vehicle);
                                } else {
                                  vehicleGroups["Unspecified"].push(vehicle);
                                }
                              });
                              
                              return filteredVehicles.length === 0 ? (
                                <div className="p-2 text-center text-sm text-muted-foreground">
                                  No vehicles match your search
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {Object.entries(vehicleGroups).map(([status, vehicles]) => {
                                    // Skip empty groups
                                    if (vehicles.length === 0) return null;
                                    
                                    return (
                                      <div key={status} className="space-y-1">
                                        <div className="sticky top-0 z-10 bg-background px-2 py-1 text-xs font-semibold border-b">
                                          {status} ({vehicles.length})
                                        </div>
                                        <div>
                                          {vehicles.map(vehicle => (
                                            <div 
                                              key={vehicle.id}
                                              className="flex items-center py-1 px-2 text-xs hover:bg-accent rounded"
                                            >
                                              <input
                                                type="checkbox"
                                                id={`vehicle-${vehicle.id}`}
                                                value={vehicle.id}
                                                checked={selectedVehicles.includes(vehicle.id.toString())}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedVehicles([...selectedVehicles, vehicle.id.toString()]);
                                                  } else {
                                                    setSelectedVehicles(selectedVehicles.filter(id => id !== vehicle.id.toString()));
                                                  }
                                                }}
                                                className="mr-2"
                                              />
                                              <label 
                                                htmlFor={`vehicle-${vehicle.id}`}
                                                className="flex items-center cursor-pointer flex-1"
                                              >
                                                <span className="font-medium">{displayLicensePlate(vehicle.licensePlate)}</span>
                                                <span className="ml-1 text-muted-foreground">
                                                  {vehicle.brand} {vehicle.model}
                                                </span>
                                              </label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex justify-center items-center h-full">
                              <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <div>
                            Selected: {selectedVehicles.length} vehicle{selectedVehicles.length !== 1 && 's'}
                          </div>
                          {selectedVehicles.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedVehicles([])}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Registration Status */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Registration Status
                        </label>
                        <Select
                          value={registrationStatus}
                          onValueChange={(value) => setRegistrationStatus(value as "opnaam" | "bv")}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="opnaam">Opnaam</SelectItem>
                            <SelectItem value="bv">BV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => {}}>
                        Cancel
                      </Button>
                      <Button 
                        type="button"
                        onClick={handleChangeRegistration}
                        disabled={selectedVehicles.length === 0 || isLoading}
                      >
                        {isLoading && (
                          <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Apply Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            }
            
            // For actions with href, render a Link
            if (action.href) {
              return (
                <Button
                  key={action.label}
                  variant="outline"
                  className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                  size="sm"
                  asChild
                >
                  <Link to={action.href}>
                    <ActionIcon name={action.icon} className="mr-1 h-4 w-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            }
            
            // Fallback for any other action types
            return (
              <Button
                key={action.label}
                variant="outline"
                className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                size="sm"
              >
                <ActionIcon name={action.icon} className="mr-1 h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}