import { useQuery } from "@tanstack/react-query";
import { Vehicle } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatLicensePlate } from "@/lib/format-utils";

export interface ReadonlyVehicleDisplayProps {
  vehicleId: string | number;
}

export function ReadonlyVehicleDisplay({ vehicleId }: ReadonlyVehicleDisplayProps) {
  // Fetch vehicle information
  const { data: vehicle, isLoading } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return (
      <div className="p-3 border rounded-md bg-muted/30 flex items-center justify-center">
        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2">Loading vehicle details...</span>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="p-3 border rounded-md bg-muted/30 text-center">
        <p className="text-destructive">Vehicle not found</p>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-md bg-muted/30">
      <div className="font-medium">{vehicle.brand} {vehicle.model}</div>
      <div className="text-sm text-muted-foreground">{formatLicensePlate(vehicle.licensePlate)}</div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
        {vehicle.vehicleType && (
          <Badge variant="outline">{vehicle.vehicleType}</Badge>
        )}
        {vehicle.fuel && (
          <Badge variant="outline">{vehicle.fuel}</Badge>
        )}
      </div>
    </div>
  );
}