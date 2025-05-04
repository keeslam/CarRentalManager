import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Vehicle, Reservation } from "@shared/schema";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { formatDate } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, RotateCw } from "lucide-react";

interface VehicleReservationsStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChanged?: () => void;
}

export function VehicleReservationsStatusDialog({
  open,
  onOpenChange,
  onStatusChanged,
}: VehicleReservationsStatusDialogProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "all" | "past">("upcoming");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset vehicle selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedVehicleId("");
      setSelectedReservationId(null);
    }
  }, [open]);
  
  // Fetch all vehicles
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    enabled: open, // Only fetch when dialog is open
  });
  
  // Fetch reservations for the selected vehicle
  const { data: vehicleReservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/vehicle/${selectedVehicleId}`],
    enabled: !!selectedVehicleId && open, // Only fetch when a vehicle is selected and dialog is open
  });
  
  // Filter reservations based on active tab
  const filteredReservations = React.useMemo(() => {
    if (!vehicleReservations) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Make sure we have proper Date objects
    const reservationsWithDates = vehicleReservations.map(res => ({
      ...res,
      startDateObj: res.startDate ? new Date(res.startDate) : null,
      endDateObj: res.endDate ? new Date(res.endDate) : null,
    }));
    
    switch (activeTab) {
      case "upcoming":
        return reservationsWithDates.filter(res => 
          (res.status === "pending" || res.status === "confirmed") &&
          (res.startDateObj === null || res.startDateObj >= today)
        );
      case "past":
        return reservationsWithDates.filter(res => 
          res.endDateObj !== null && res.endDateObj < today
        );
      case "all":
      default:
        return reservationsWithDates;
    }
  }, [vehicleReservations, activeTab]);
  
  // Handle reservation status change success
  const handleReservationStatusChanged = () => {
    // Invalidate all relevant queries
    queryClient.invalidateQueries({
      queryKey: [`/api/reservations/vehicle/${selectedVehicleId}`],
    });
    
    // Set selected reservation ID to null
    setSelectedReservationId(null);
    
    // Show success toast
    toast({
      title: "Status Updated",
      description: "Reservation status has been updated successfully.",
    });
    
    // Call the callback if provided
    if (onStatusChanged) {
      onStatusChanged();
    }
  };
  
  // Find the selected vehicle and reservation objects
  const selectedVehicle = vehicles?.find(v => v.id.toString() === selectedVehicleId);
  const selectedReservation = vehicleReservations?.find(r => r.id === selectedReservationId);
  
  // Get customer for the selected reservation
  const customer = selectedReservation?.customer;
  
  return (
    <>
      {selectedReservationId && selectedReservation && (
        <StatusChangeDialog
          reservationId={selectedReservationId}
          open={!!selectedReservationId}
          onOpenChange={(open) => {
            if (!open) setSelectedReservationId(null);
          }}
          initialStatus={selectedReservation.status || ""}
          vehicle={selectedVehicle}
          customer={customer}
          onStatusChanged={handleReservationStatusChanged}
        />
      )}
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Change Reservation Status by Vehicle</DialogTitle>
            <DialogDescription>
              First select a vehicle, then choose a reservation to change its status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Vehicle Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Vehicle</label>
              {isLoadingVehicles ? (
                <div className="flex items-center justify-center p-4">
                  <RotateCw className="h-5 w-5 animate-spin text-primary-600 mr-2" />
                  <span>Loading vehicles...</span>
                </div>
              ) : (
                <VehicleSelector
                  vehicles={vehicles || []}
                  value={selectedVehicleId}
                  onChange={setSelectedVehicleId}
                  placeholder="Select a vehicle to view its reservations"
                />
              )}
            </div>
            
            {/* Reservations List */}
            {selectedVehicleId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Reservations</h3>
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upcoming" | "all" | "past")}>
                    <TabsList className="grid w-auto grid-cols-3">
                      <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="past">Past</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                {isLoadingReservations ? (
                  <div className="flex items-center justify-center p-8">
                    <RotateCw className="h-5 w-5 animate-spin text-primary-600 mr-2" />
                    <span>Loading reservations...</span>
                  </div>
                ) : filteredReservations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-muted-foreground mb-2">No {activeTab} reservations found for this vehicle.</div>
                    {activeTab !== "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("all")}
                      >
                        View all reservations
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">ID</th>
                          <th className="px-4 py-3 text-left font-medium">Customer</th>
                          <th className="px-4 py-3 text-left font-medium">Period</th>
                          <th className="px-4 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-center font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReservations.map((reservation) => (
                          <tr key={reservation.id} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-3">#{reservation.id}</td>
                            <td className="px-4 py-3">
                              {reservation.customer?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3">
                              {reservation.startDate && reservation.endDate ? (
                                <>
                                  {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                                </>
                              ) : (
                                <span className="text-muted-foreground">No dates specified</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`
                                inline-block rounded-full px-2 py-1 text-xs
                                ${reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : ''}
                                ${reservation.status === 'ongoing' ? 'bg-amber-100 text-amber-800' : ''}
                                ${reservation.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                                ${reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                                ${reservation.status === 'pending' ? 'bg-gray-100 text-gray-800' : ''}
                              `}>
                                {reservation.status?.charAt(0).toUpperCase() + reservation.status?.slice(1) || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedReservationId(reservation.id)}
                              >
                                <CalendarClock className="mr-1 h-3 w-3" />
                                Change Status
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}