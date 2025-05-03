import { useState, useEffect } from "react";
import { ReservationForm } from "@/components/reservations/reservation-form-fixed";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Vehicle } from "@shared/schema";

export default function AddReservationPage() {
  // Extract vehicleId from URL parameters
  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get("vehicleId");
  const customerId = params.get("customerId");
  const startDate = params.get("startDate");
  
  // Fetch vehicle details if vehicleId is provided
  const { data: vehicle, isLoading: isLoadingVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
    enabled: !!vehicleId,
  });
  
  // Determine page description based on parameters
  const getDescription = () => {
    if (vehicleId && vehicle) {
      return `Create a reservation for ${vehicle.brand} ${vehicle.model}`;
    } else if (vehicleId && isLoadingVehicle) {
      return "Loading selected vehicle...";
    } else {
      return "Create a new reservation by selecting a vehicle and customer";
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="border-none shadow-none">
        <CardHeader className="px-0">
          <CardTitle className="text-2xl">New Reservation</CardTitle>
          <CardDescription>
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReservationForm 
            initialVehicleId={vehicleId || undefined}
            initialCustomerId={customerId || undefined}
            initialStartDate={startDate || undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}