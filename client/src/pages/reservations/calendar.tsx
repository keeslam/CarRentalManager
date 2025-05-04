import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDate, getDay, getMonth, getYear, isSameMonth, addMonths, startOfDay, endOfDay, isBefore, isAfter, differenceInDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Vehicle, Reservation } from "@shared/schema";
import { displayLicensePlate } from "@/lib/utils";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Calendar view options
type CalendarView = "month";

// Days of the week abbreviations
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Type for vehicle filters
type VehicleFilters = {
  search: string;
  type: string;
  availability: string;
};

export default function ReservationCalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilters>({
    search: "",
    type: "all",
    availability: "all"
  });
  const [displayLimit, setDisplayLimit] = useState(20);
  
  // Calculate date ranges for month view
  const dateRanges = useMemo(() => {
    // Month view calculations
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Get the first Monday before or on the first day of the month
    const firstDay = new Date(start);
    const firstDayOfWeek = getDay(firstDay) || 7; // Convert Sunday (0) to 7
    firstDay.setDate(firstDay.getDate() - ((firstDayOfWeek - 1) || 0));
    
    // Get the last Sunday after or on the last day of the month
    const lastDay = new Date(end);
    const lastDayOfWeek = getDay(lastDay) || 7; // Convert Sunday (0) to 7
    lastDay.setDate(lastDay.getDate() + (7 - lastDayOfWeek));
    
    // Generate all days in the calendar grid
    const dayCount = differenceInDays(lastDay, firstDay) + 1;
    const days = Array.from({ length: dayCount }, (_, i) => addDays(firstDay, i));
    
    const rangeText = format(currentDate, "MMMM yyyy");
    
    return { start, end, days, rangeText };
  }, [currentDate]);
  
  // Fetch vehicles
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch reservations for the current date range
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [
      "/api/reservations/range", 
      {
        startDate: format(dateRanges.start, "yyyy-MM-dd"),
        endDate: format(dateRanges.end, "yyyy-MM-dd")
      }
    ],
  });
  
  // Extract unique vehicle types for filtering
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    const types = Array.from(new Set(vehicles.map(v => v.vehicleType).filter(Boolean))) as string[];
    return types.sort();
  }, [vehicles]);
  
  // Filter vehicles based on search, type, and availability
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    return vehicles.filter(vehicle => {
      // Search filter
      const searchLower = vehicleFilters.search.toLowerCase();
      const matchesSearch = !vehicleFilters.search || 
        vehicle.licensePlate.toLowerCase().includes(searchLower) || 
        vehicle.brand.toLowerCase().includes(searchLower) || 
        vehicle.model.toLowerCase().includes(searchLower);
      
      // Vehicle type filter
      const matchesType = vehicleFilters.type === "all" || 
        vehicle.vehicleType === vehicleFilters.type;
      
      // Availability filter
      let matchesAvailability = true;
      if (vehicleFilters.availability !== "all" && reservations) {
        const hasReservation = reservations.some(res => 
          res.vehicleId === vehicle.id && 
          (vehicleFilters.availability === "reserved" || 
           (vehicleFilters.availability === "available" && 
            res.status.toLowerCase() !== "cancelled"))
        );
        
        matchesAvailability = vehicleFilters.availability === "reserved" ? 
          hasReservation : !hasReservation;
      }
      
      return matchesSearch && matchesType && matchesAvailability;
    })
    // Show limited number initially for better performance
    .slice(0, displayLimit);
  }, [vehicles, vehicleFilters, reservations, displayLimit]);
  
  // Functions to navigate between months
  const navigatePrevious = () => {
    setCurrentDate(prevDate => addMonths(prevDate, -1));
  };
  
  const navigateNext = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };
  
  // Reset to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Function to get reservations for a specific day and vehicle
  const getReservationsForDay = (vehicleId: number, day: Date) => {
    if (!reservations) return [];
    
    return reservations.filter(res => 
      res.vehicleId === vehicleId && 
      isDateInRange(day, parseISO(res.startDate), parseISO(res.endDate))
    );
  };
  
  // This function is no longer used since we only display pickup and return days
  // Keeping it for reference in case we need to revert
  const isDateInRange = (date: Date, start: Date, end: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    return (
      (start <= dayEnd && end >= dayStart) ||
      isSameDay(date, start) ||
      isSameDay(date, end)
    );
  };
  
  // Function to get reservation color and style based on status
  const getReservationStyle = (status: string, isStart: boolean, isEnd: boolean) => {
    let bgColor, textColor, borderColor;
    
    switch (status.toLowerCase()) {
      case "confirmed":
        bgColor = "bg-green-100";
        textColor = "text-green-800";
        borderColor = "border-green-300";
        break;
      case "pending":
        bgColor = "bg-amber-100";
        textColor = "text-amber-800";
        borderColor = "border-amber-300";
        break;
      case "cancelled":
        bgColor = "bg-gray-100";
        textColor = "text-gray-500";
        borderColor = "border-gray-300";
        break;
      case "completed":
        bgColor = "bg-blue-100";
        textColor = "text-blue-800";
        borderColor = "border-blue-300";
        break;
      default:
        bgColor = "bg-gray-100";
        textColor = "text-gray-800";
        borderColor = "border-gray-300";
    }
    
    const roundedLeft = isStart ? "rounded-l-md" : "";
    const roundedRight = isEnd ? "rounded-r-md" : "";
    
    return `${bgColor} ${textColor} ${borderColor} border ${roundedLeft} ${roundedRight}`;
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVehicleFilters({
      ...vehicleFilters,
      search: e.target.value
    });
  };
  
  const handleTypeChange = (value: string) => {
    setVehicleFilters({
      ...vehicleFilters,
      type: value
    });
  };
  
  const handleAvailabilityChange = (value: string) => {
    setVehicleFilters({
      ...vehicleFilters,
      availability: value
    });
  };
  
  // Load more vehicles when user scrolls to bottom
  const loadMoreVehicles = () => {
    setDisplayLimit(prev => prev + 20);
  };
  
  // Generate calendar grid for month view
  const calendarGrid = useMemo(() => {
    const weeks = [];
    const days = dateRanges.days;
    
    // Group days into weeks
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return weeks;
  }, [dateRanges.days]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reservation Calendar</h1>
        <div className="flex gap-2">
          <Link href="/reservations">
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list mr-2">
                <line x1="8" x2="21" y1="6" y2="6" />
                <line x1="8" x2="21" y1="12" y2="12" />
                <line x1="8" x2="21" y1="18" y2="18" />
                <line x1="3" x2="3" y1="6" y2="6" />
                <line x1="3" x2="3" y1="12" y2="12" />
                <line x1="3" x2="3" y1="18" y2="18" />
              </svg>
              List View
            </Button>
          </Link>
          <Link href="/reservations/add">
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              New Reservation
            </Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex-row justify-between items-center space-y-0 pb-2">
          <div>
            <CardTitle>Reservation Schedule</CardTitle>
            <CardDescription>View and manage vehicle reservations</CardDescription>
          </div>
          <div className="flex-shrink-0">
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Top Controls */}
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            {/* Calendar Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={navigatePrevious}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </Button>
              <h4 className="text-base font-medium w-40 text-center">{dateRanges.rangeText}</h4>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            </div>
            
            {/* Vehicle Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search vehicles..."
                value={vehicleFilters.search}
                onChange={handleSearchChange}
                className="w-40 h-9"
              />
              
              {vehicleTypes.length > 0 && (
                <Select value={vehicleFilters.type} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {vehicleTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={vehicleFilters.availability} onValueChange={handleAvailabilityChange}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Month View */}
          <div className="mb-6">
            {/* Calendar Header - Days of Week */}
            <div className="grid grid-cols-7 mb-2">
              {daysOfWeek.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
              {calendarGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 divide-x border-b last:border-b-0">
                  {week.map((day, dayIndex) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    
                    // Only get reservations starting or ending on this day
                    // Filter reservations based on selected vehicles
                    const dayReservations = reservations?.filter(res => 
                      // First filter by date (pickup or return day)
                      (isSameDay(day, parseISO(res.startDate)) || isSameDay(day, parseISO(res.endDate))) &&
                      // Then check if the vehicle is in the filtered vehicles list
                      (vehicleFilters.search === "" && vehicleFilters.type === "all" && vehicleFilters.availability === "all" || 
                       filteredVehicles.some(v => v.id === res.vehicleId))
                    ) || [];
                    
                    return (
                      <div
                        key={dayIndex}
                        className={`min-h-[100px] p-2 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''} relative group cursor-pointer`}
                        onClick={() => {
                          if (isCurrentMonth) {
                            const formattedDate = format(day, "yyyy-MM-dd");
                            window.location.href = `/reservations/add?date=${formattedDate}`;
                          }
                        }}
                      >
                        {/* Quick add button - only shows on hover for current month days */}
                        {isCurrentMonth && (
                          <div className="absolute top-2 right-2 hidden group-hover:block">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-5 w-5 bg-primary/10 hover:bg-primary/20 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                const formattedDate = format(day, "yyyy-MM-dd");
                                window.location.href = `/reservations/add?date=${formattedDate}`;
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus">
                                <path d="M5 12h14"/>
                                <path d="M12 5v14"/>
                              </svg>
                            </Button>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                            {format(day, "d")}
                          </span>
                          {dayReservations.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {dayReservations.length}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Show up to 3 reservations in month view */}
                        <div className="space-y-1">
                          {dayReservations.slice(0, 3).map(res => {
                            const isPickupDay = isSameDay(day, parseISO(res.startDate));
                            const isReturnDay = isSameDay(day, parseISO(res.endDate));
                            
                            return (
                              <div 
                                key={res.id}
                                className={`px-1 py-0.5 text-xs truncate cursor-pointer ${getReservationStyle(res.status, isPickupDay, isReturnDay)}`}
                                title={`${displayLicensePlate(res.vehicle?.licensePlate || '')} - ${res.customer?.name || 'Reserved'} (${isPickupDay ? 'Pickup' : isReturnDay ? 'Return' : 'Reserved'})`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/reservations/${res.id}`;
                                }}
                              >
                                {displayLicensePlate(res.vehicle?.licensePlate || '')}
                                {isPickupDay && 
                                  <span className="ml-1 inline-block bg-green-200 text-green-800 text-[8px] px-1 rounded-sm">out</span>
                                }
                                {isReturnDay && 
                                  <span className="ml-1 inline-block bg-blue-200 text-blue-800 text-[8px] px-1 rounded-sm">in</span>
                                }
                              </div>
                            );
                          })}
                          
                          {dayReservations.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{dayReservations.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* Loading State */}
          {(isLoadingVehicles || isLoadingReservations) && (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}