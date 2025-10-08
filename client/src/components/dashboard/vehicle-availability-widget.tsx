import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLicensePlate } from "@/lib/format-utils";
import { Link } from "wouter";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { Vehicle } from "@shared/schema";
import { useTranslation } from 'react-i18next';

export function VehicleAvailabilityWidget() {
  const [vehicleType, setVehicleType] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/available"],
  });
  
  const filteredVehicles = vehicles?.filter(vehicle => {
    return (
      (vehicleType === "all" || vehicle.vehicleType === vehicleType) &&
      (brand === "all" || vehicle.brand === brand)
    );
  });
  
  const vehicleTypes = vehicles ? [...new Set(vehicles.map(v => v.vehicleType))].filter(Boolean) : [];
  const brands = vehicles ? [...new Set(vehicles.map(v => v.brand))].filter(Boolean) : [];
  
  return (
    <Card className="overflow-hidden h-full">
      <CardHeader className="bg-primary-600 py-3 px-4 flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-900">Available Vehicles</CardTitle>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-car text-gray-900">
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
          <circle cx="6.5" cy="16.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-3 flex justify-between items-center">
          <div className="text-xl font-semibold">
            {isLoading ? "-" : filteredVehicles?.length || 0}
          </div>
          <div className="flex space-x-2">
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger className="h-8 text-xs w-[100px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="all">All Types</SelectItem>
                {vehicleTypes.map(type => (
                  <SelectItem key={type} value={type || ''}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger className="h-8 text-xs w-[100px]">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : filteredVehicles?.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No available vehicles</div>
          ) : (
            filteredVehicles?.map(vehicle => (
              <div key={vehicle.id} className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-md flex items-center justify-center text-primary-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-car">
                    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
                    <circle cx="6.5" cy="16.5" r="2.5" />
                    <circle cx="16.5" cy="16.5" r="2.5" />
                  </svg>
                </div>
                <div className="ml-3 flex-grow">
                  <div className="text-sm font-medium text-gray-900">{formatLicensePlate(vehicle.licensePlate)}</div>
                  <div className="text-xs text-gray-500">{vehicle.brand} {vehicle.model}</div>
                </div>
                <div>
                  <ReservationAddDialog initialVehicleId={vehicle.id.toString()}>
                    <Button variant="ghost" size="icon" className="text-primary-600 hover:bg-primary-50 rounded">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-plus">
                        <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                        <line x1="19" x2="19" y1="16" y2="22" />
                        <line x1="16" x2="22" y1="19" y2="19" />
                      </svg>
                    </Button>
                  </ReservationAddDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
