import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDate, getDay, getMonth, getYear, isSameMonth, addMonths, startOfDay, endOfDay, isBefore, isAfter, differenceInDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsFilter } from "@/components/ui/tabs-filter";
import { Link } from "wouter";
import { Vehicle, Reservation } from "@shared/schema";
import { formatLicensePlate } from "@/lib/format-utils";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Calendar view options
type CalendarView = "day" | "week" | "month";

// Days of the week abbreviations
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Type for vehicle filters
type VehicleFilters = {
  search: string;
  type: string;
  availability: string;
};

export default function ReservationCalendarPage() {
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilters>({
    search: "",
    type: "all",
    availability: "all"
  });
  const [displayLimit, setDisplayLimit] = useState(20);
  
  // Calculate date ranges based on the selected view
  const dateRanges = useMemo(() => {
    let start: Date, end: Date, days: Date[], rangeText: string;
    
    switch (view) {
      case "day":
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        days = [currentDate];
        rangeText = format(currentDate, "MMMM d, yyyy");
        break;
        
      case "week":
        // Calculate start and end of the current week (Monday to Sunday)
        start = new Date(currentDate);
        start.setDate(currentDate.getDate() - ((currentDate.getDay() || 7) - 1));
        start = startOfDay(start);
        
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end = endOfDay(end);
        
        // Generate days for the current week
        days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        rangeText = `${format(start, "MMMM d")} - ${format(end, "d, yyyy")}`;
        break;
        
      case "month":
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
        
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
        days = Array.from({ length: dayCount }, (_, i) => addDays(firstDay, i));
        
        rangeText = format(currentDate, "MMMM yyyy");
        break;
        
      default:
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        days = [currentDate];
        rangeText = format(currentDate, "MMMM d, yyyy");
    }
    
    return { start, end, days, rangeText };
  }, [currentDate, view]);
  
  // Fetch vehicles
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch reservations for the current date range
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [
      "/api/reservations/range", 
      format(dateRanges.start, "yyyy-MM-dd"), 
      format(dateRanges.end, "yyyy-MM-dd")
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
  
  // Functions to navigate between dates
  const navigatePrevious = () => {
    if (view === "day") {
      setCurrentDate(prevDate => subDays(prevDate, 1));
    } else if (view === "week") {
      setCurrentDate(prevDate => subDays(prevDate, 7));
    } else if (view === "month") {
      setCurrentDate(prevDate => addMonths(prevDate, -1));
    }
  };
  
  const navigateNext = () => {
    if (view === "day") {
      setCurrentDate(prevDate => addDays(prevDate, 1));
    } else if (view === "week") {
      setCurrentDate(prevDate => addDays(prevDate, 7));
    } else if (view === "month") {
      setCurrentDate(prevDate => addMonths(prevDate, 1));
    }
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
  
  // Helper function to check if a date is within a range
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
    if (view !== "month") return null;
    
    const weeks = [];
    const days = dateRanges.days;
    
    // Group days into weeks
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    
    return weeks;
  }, [view, dateRanges.days]);
  
  // View options for the tabs
  const viewOptions = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" }
  ];
  
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
            <TabsFilter
              tabs={viewOptions}
              activeTab={view}
              onChange={(value) => setView(value as CalendarView)}
            />
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
          {view === "month" && calendarGrid && (
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
                      
                      // Count reservations for this day
                      const dayReservations = reservations?.filter(res => 
                        isDateInRange(day, parseISO(res.startDate), parseISO(res.endDate))
                      ) || [];
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`min-h-[100px] p-2 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''}`}
                        >
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
                            {dayReservations.slice(0, 3).map(res => (
                              <Link key={res.id} href={`/reservations/${res.id}`}>
                                <div 
                                  className={`px-1 py-0.5 text-xs truncate cursor-pointer ${getReservationStyle(res.status, isSameDay(day, parseISO(res.startDate)), isSameDay(day, parseISO(res.endDate)))}`}
                                  title={`${formatLicensePlate(res.vehicle?.licensePlate)} - ${res.customer?.name || 'Reserved'}`}
                                >
                                  {formatLicensePlate(res.vehicle?.licensePlate)} 
                                </div>
                              </Link>
                            ))}
                            
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
          )}
          
          {/* Week/Day View */}
          {(view === "week" || view === "day") && (
            <>
              {/* Day Headers */}
              <div className="grid grid-cols-7 mb-2">
                {dateRanges.days.map((day, index) => (
                  <div 
                    key={index} 
                    className={`text-center py-2 ${isSameDay(day, new Date()) ? 'bg-blue-50 rounded font-medium' : ''}`}
                  >
                    <div className="text-sm font-medium">
                      {daysOfWeek[index % 7]}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(day, "MMM d")}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Loading State */}
              {(isLoadingVehicles || isLoadingReservations) ? (
                <div className="flex justify-center items-center h-64">
                  <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center border rounded-lg p-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-x text-gray-500">
                      <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                      <path d="m17 17 4 4" />
                      <path d="m21 17-4 4" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-lg mb-2">No Vehicles Found</h3>
                  <p className="text-gray-500 max-w-md mb-4">
                    There are no vehicles matching your current filters. Try adjusting your search criteria or add new vehicles to the system.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setVehicleFilters({ search: "", type: "all", availability: "all" })}
                    >
                      Clear Filters
                    </Button>
                    <Link href="/vehicles/add">
                      <Button size="sm">Add Vehicle</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                  {filteredVehicles.map(vehicle => (
                    <div key={vehicle.id} className="border rounded-md overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 flex justify-between items-center">
                        <div className="flex items-center">
                          <Link href={`/vehicles/${vehicle.id}`}>
                            <div className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                              {formatLicensePlate(vehicle.licensePlate)}
                            </div>
                          </Link>
                          <div className="ml-2 text-xs text-gray-500">
                            {vehicle.brand} {vehicle.model}
                            {vehicle.vehicleType && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-800">
                                {vehicle.vehicleType}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link href={`/reservations/add?vehicleId=${vehicle.id}`}>
                          <Button size="sm" variant="ghost">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-1">
                              <line x1="12" x2="12" y1="5" y2="19" />
                              <line x1="5" x2="19" y1="12" y2="12" />
                            </svg>
                            Reserve
                          </Button>
                        </Link>
                      </div>
                      <div className="grid grid-cols-7">
                        {/* Each day cell */}
                        {view === "day" ? (
                          // Single day view - more detailed
                          <div className="col-span-7 p-3">
                            {(() => {
                              const dayReservations = getReservationsForDay(vehicle.id, dateRanges.days[0]);
                              
                              if (dayReservations.length === 0) {
                                return (
                                  <div className="text-center py-2 text-gray-500 text-sm">
                                    No reservations
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="space-y-2">
                                  {dayReservations.map(reservation => (
                                    <Link key={reservation.id} href={`/reservations/${reservation.id}`}>
                                      <div 
                                        className={`p-2 rounded-md cursor-pointer hover:shadow-sm transition-shadow ${
                                          getReservationStyle(
                                            reservation.status, 
                                            isSameDay(dateRanges.days[0], parseISO(reservation.startDate)),
                                            isSameDay(dateRanges.days[0], parseISO(reservation.endDate))
                                          )
                                        }`}
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium">
                                            {reservation.customer?.name || "Reserved"}
                                          </span>
                                          <Badge variant="outline">{reservation.status}</Badge>
                                        </div>
                                        <div className="text-xs">
                                          {format(parseISO(reservation.startDate), "MMM d")} to {format(parseISO(reservation.endDate), "MMM d")}
                                          {reservation.totalPrice && (
                                            <span className="ml-2 font-medium">
                                              €{parseFloat(reservation.totalPrice).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                        {reservation.notes && (
                                          <div className="text-xs mt-1 text-gray-600">
                                            {reservation.notes.length > 100 
                                              ? `${reservation.notes.substring(0, 100)}...` 
                                              : reservation.notes
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          // Week view
                          dateRanges.days.map((day, dayIndex) => {
                            const dayReservations = getReservationsForDay(vehicle.id, day);
                            const isToday = isSameDay(day, new Date());
                            
                            return (
                              <div 
                                key={dayIndex} 
                                className={`relative border border-gray-100 min-h-[60px] p-1 ${
                                  isToday ? 'bg-blue-50' : ''
                                }`}
                              >
                                {/* Day indicator */}
                                <div className="text-xs text-gray-500 mb-1">
                                  {format(day, "d")}
                                </div>
                                
                                {/* Reservation items */}
                                <div className="space-y-1 mt-1">
                                  {dayReservations.map(reservation => {
                                    const isStartDay = isSameDay(day, parseISO(reservation.startDate));
                                    const isEndDay = isSameDay(day, parseISO(reservation.endDate));
                                    
                                    return (
                                      <Link key={reservation.id} href={`/reservations/${reservation.id}`}>
                                        <div 
                                          className={`text-xs p-1 truncate cursor-pointer ${
                                            getReservationStyle(reservation.status, isStartDay, isEndDay)
                                          }`}
                                          title={`${reservation.customer?.name || 'Reserved'} - ${format(parseISO(reservation.startDate), "MMM d")} to ${format(parseISO(reservation.endDate), "MMM d")}`}
                                        >
                                          {reservation.customer?.name || "Reserved"}
                                        </div>
                                      </Link>
                                    );
                                  })}
                                  
                                  {/* Quick add button */}
                                  {dayReservations.length === 0 && (
                                    <Link href={`/reservations/add?vehicleId=${vehicle.id}&startDate=${format(day, "yyyy-MM-dd")}`}>
                                      <div className="text-xs text-blue-600 hover:bg-blue-50 p-1 rounded cursor-pointer text-center">
                                        + Add
                                      </div>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Load more button */}
                  {filteredVehicles.length < (vehicles?.length || 0) && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-4" 
                      onClick={loadMoreVehicles}
                    >
                      Load More Vehicles
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
