import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Wrench, Ban, Key } from "lucide-react";

interface StatusBreakdown {
  available: number;
  needs_fixing: number;
  not_for_rental: number;
  rented: number;
  total: number;
}

export function VehicleAvailabilityWidget() {
  const { data: breakdown, isLoading } = useQuery<StatusBreakdown>({
    queryKey: ["/api/vehicles/status/breakdown"],
  });

  const statusItems = [
    {
      label: "Available",
      count: breakdown?.available || 0,
      color: "bg-green-100 text-green-700 border-green-200",
      icon: Car,
      iconColor: "text-green-600"
    },
    {
      label: "Rented",
      count: breakdown?.rented || 0,
      color: "bg-blue-100 text-blue-700 border-blue-200",
      icon: Key,
      iconColor: "text-blue-600"
    },
    {
      label: "Needs Fixing",
      count: breakdown?.needs_fixing || 0,
      color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      icon: Wrench,
      iconColor: "text-yellow-600"
    },
    {
      label: "Not for Rental",
      count: breakdown?.not_for_rental || 0,
      color: "bg-gray-100 text-gray-700 border-gray-200",
      icon: Ban,
      iconColor: "text-gray-600"
    }
  ];

  return (
    <Card className="overflow-hidden h-full">
      <CardHeader className="bg-primary-600 py-3 px-4 flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-900">Vehicle Status</CardTitle>
        <Car className="w-5 h-5 text-gray-900" />
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center border-b pb-3">
              <div className="text-3xl font-bold text-gray-900">{breakdown?.total || 0}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Vehicles</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {statusItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={item.label} 
                    className={`p-3 rounded-lg border ${item.color} transition-all hover:shadow-md`}
                    data-testid={`status-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${item.iconColor}`} />
                      <span className="text-xl font-bold">{item.count}</span>
                    </div>
                    <div className="text-xs font-medium">{item.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Ready to Rent</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {breakdown?.available || 0}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
