import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateByPrefix } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-utils";
import { formatLicensePlate } from "@/lib/format-utils";
import { useLocation } from "wouter";
import { Vehicle } from "@shared/schema";
import { useTranslation } from 'react-i18next';

// Function to get days until a date
function getDaysUntil(dateStr: string): number {
  const targetDate = new Date(dateStr);
  const currentDate = new Date();
  
  // Reset time part to compare just the dates
  currentDate.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - currentDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Function to get the urgency class based on days until expiration
function getUrgencyClass(days: number): string {
  if (days <= 14) return "bg-danger-50 text-danger-500"; // Within 2 weeks
  if (days <= 30) return "bg-warning-50 text-warning-500"; // Within 1 month
  return "bg-primary-100 text-primary-600"; // More than 1 month
}

export function ApkExpirationWidget() {
  const { t } = useTranslation();
  const [_, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/apk-expiring"],
  });
  
  // Add daysUntilExpiration to each vehicle
  const vehiclesWithDays = vehicles?.map(vehicle => ({
    ...vehicle,
    daysUntilExpiration: getDaysUntil(vehicle.apkDate || '')
  })).sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  
  // Function to handle clicking on a vehicle to view its details
  const handleViewClick = (vehicle: Vehicle) => {
    // Use prefix-based invalidation to ensure fresh data
    invalidateByPrefix(`/api/vehicles/${vehicle.id}`);
    // Navigate to the vehicle details page
    navigate(`/vehicles/${vehicle.id}`);
  };
  
  return (
    <Card className="overflow-hidden h-full">
      <CardHeader className="bg-warning-500 py-3 px-4 flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-900">{t('vehicles.apkExpiry')}</CardTitle>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle text-gray-900">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="text-xl font-semibold">{isLoading ? "-" : vehiclesWithDays?.length || 0}</div>
          <p className="text-xs text-gray-500">Vehicles with APK expiring within 2 months</p>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <svg className="animate-spin h-5 w-5 text-warning-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : vehiclesWithDays?.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No APK expiring soon</div>
          ) : (
            vehiclesWithDays?.map(vehicle => (
              <div key={vehicle.id} className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-md ${getUrgencyClass(vehicle.daysUntilExpiration)}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-timer">
                    <line x1="10" x2="14" y1="2" y2="2" />
                    <line x1="12" x2="15" y1="14" y2="11" />
                    <circle cx="12" cy="14" r="8" />
                  </svg>
                </div>
                <div className="ml-3 flex-grow">
                  <div className="text-sm font-medium text-gray-900">{formatLicensePlate(vehicle.licensePlate)}</div>
                  <div className="flex items-center">
                    <div className="text-xs text-gray-500">{formatDate(vehicle.apkDate || '')}</div>
                    <div className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${getUrgencyClass(vehicle.daysUntilExpiration)}`}>
                      {vehicle.daysUntilExpiration} days
                    </div>
                  </div>
                </div>
                <div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-warning-600 hover:bg-warning-50 rounded"
                    onClick={() => handleViewClick(vehicle)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
