import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek, endOfWeek, getDay, parseISO } from "date-fns";
import { Vehicle, Reservation } from "@shared/schema";

// Calendar view options
type CalendarView = "day" | "week" | "month";

// Function to format the date range for the header
function formatDateRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "MMMM d")} - ${format(endDate, "d, yyyy")}`;
}

// Days of the week abbreviations
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ReservationCalendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Calculate the start and end of the current week
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  
  // Fetch vehicles
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch reservations for the current week
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/range", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
  });
  
  // Function to navigate to previous/next week
  const navigatePrevious = () => {
    setCurrentDate(prevDate => addDays(prevDate, -7));
  };
  
  const navigateNext = () => {
    setCurrentDate(prevDate => addDays(prevDate, 7));
  };
  
  // Function to check if a vehicle has a reservation on a specific day
  const getReservationForDay = (vehicleId: number, day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return reservations?.find(res => 
      res.vehicleId === vehicleId && 
      (
        format(parseISO(res.startDate), "yyyy-MM-dd") <= dayStr &&
        format(parseISO(res.endDate), "yyyy-MM-dd") >= dayStr
      )
    );
  };
  
  // Function to get reservation color based on status
  const getReservationColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-primary-100 text-primary-800";
      case "pending":
        return "bg-warning-100 text-warning-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Generate days for the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="px-4 py-3 border-b flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-800">Reservation Calendar</CardTitle>
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant={view === "day" ? "default" : "outline"}
            className={`px-3 py-1 text-sm ${view === "day" ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-600"}`}
            onClick={() => setView("day")}
          >
            Day
          </Button>
          <Button
            size="sm"
            variant={view === "week" ? "default" : "outline"}
            className={`px-3 py-1 text-sm ${view === "week" ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-600"}`}
            onClick={() => setView("week")}
          >
            Week
          </Button>
          <Button
            size="sm"
            variant={view === "month" ? "default" : "outline"}
            className={`px-3 py-1 text-sm ${view === "month" ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-600"}`}
            onClick={() => setView("month")}
          >
            Month
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Week Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="ghost" size="icon" onClick={navigatePrevious}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Button>
          <h4 className="text-base font-medium">{formatDateRange(weekStart, weekEnd)}</h4>
          <Button variant="ghost" size="icon" onClick={navigateNext}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </Button>
        </div>
        
        {/* Calendar Header */}
        <div className="grid grid-cols-7 mb-2">
          {daysOfWeek.map((day, index) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Vehicles */}
        <div className="space-y-2">
          {isLoadingVehicles || isLoadingReservations ? (
            <div className="flex justify-center p-8">
              <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : vehicles?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No vehicles available</div>
          ) : (
            vehicles?.map(vehicle => (
              <div key={vehicle.id} className="border rounded-md overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex items-center">
                  <div className="text-sm font-medium text-gray-800">{vehicle.licensePlate}</div>
                  <div className="ml-2 text-xs text-gray-500">{vehicle.brand} {vehicle.model}</div>
                </div>
                <div className="grid grid-cols-7">
                  {/* Each day cell */}
                  {weekDays.map((day, dayIndex) => {
                    const reservation = getReservationForDay(vehicle.id, day);
                    return (
                      <div key={dayIndex} className="relative border border-gray-100 aspect-[1.5] p-1">
                        <div className="text-xs text-gray-500 mb-1">{format(day, "d")}</div>
                        {/* Reservation item */}
                        {reservation && (
                          <div className={`absolute top-6 left-0 right-0 ${getReservationColor(reservation.status)} text-xs p-1 rounded cursor-pointer`} style={{ height: "24px" }}>
                            {reservation.customer?.name || "Reserved"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
