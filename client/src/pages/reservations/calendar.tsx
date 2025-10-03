import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDate, getDay, getMonth, getYear, isSameMonth, addMonths, startOfDay, endOfDay, isBefore, isAfter, differenceInDays, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Vehicle, Reservation } from "@shared/schema";
import { displayLicensePlate } from "@/lib/utils";
import { formatLicensePlate } from "@/lib/format-utils";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationListDialog } from "@/components/reservations/reservation-list-dialog";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { ColorCodingDialog } from "@/components/calendar/color-coding-dialog";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { formatReservationStatus } from "@/lib/format-utils";
import { formatCurrency } from "@/lib/utils";
import { getCustomReservationStyle, getCustomReservationStyleObject, getCustomIndicatorStyle, getCustomTBDStyle } from "@/lib/calendar-styling";
import { Calendar, User, Car, CreditCard, Edit, Eye, ClipboardEdit, Palette, Trash2, Wrench } from "lucide-react";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Calendar view options
type CalendarView = "month";

// Calendar configuration
const COLUMNS = 5;

// Type for vehicle filters
type VehicleFilters = {
  search: string;
  type: string;
  availability: string;
};

export default function ReservationCalendarPage() {
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Navigation
  const [_, navigate] = useLocation();
  
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilters>({
    search: "",
    type: "all",
    availability: "all"
  });
  const [displayLimit, setDisplayLimit] = useState(20);
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  // Day reservations dialog
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
  // New reservation dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // List view dialog
  const [listDialogOpen, setListDialogOpen] = useState(false);
  
  // Color coding dialog
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  
  // Dialog handlers
  const handleViewReservation = (reservation: Reservation) => {
    console.log('handleViewReservation called with:', reservation);
    setSelectedReservation(reservation);
    setViewDialogOpen(true);
    console.log('View dialog should be open now');
  };
  
  const handleEditReservation = (reservation: Reservation) => {
    console.log('handleEditReservation called with:', reservation);
    setSelectedReservation(reservation);
    setEditDialogOpen(true);
    console.log('Edit dialog should be open now');
  };
  
  const handleStatusChange = (reservation: Reservation) => {
    console.log('handleStatusChange called with:', reservation);
    setSelectedReservation(reservation);
    setStatusDialogOpen(true);
    console.log('Status dialog should be open now');
  };
  
  const handleCloseDialogs = () => {
    console.log('Closing all dialogs');
    setViewDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedReservation(null);
  };
  
  // Delete mutation
  const deleteReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/reservations/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete reservation');
      }
      return response.json();
    },
    onSuccess: async () => {
      // Force reset ALL reservation caches to clear stale data
      await queryClient.resetQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('reservations');
        }
      });
      
      toast({
        title: "Reservation deleted",
        description: "The reservation has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleDeleteReservation = (reservation: Reservation) => {
    if (window.confirm(`Are you sure you want to delete this reservation for ${reservation.customer?.name || 'this customer'}?`)) {
      deleteReservationMutation.mutate(reservation.id);
    }
  };
  
  // Day dialog handlers
  const openDayDialog = (day: Date) => {
    console.log('Opening day dialog for:', day);
    setSelectedDay(day);
    setDayDialogOpen(true);
  };
  
  const closeDayDialog = () => {
    console.log('Closing day dialog');
    setDayDialogOpen(false);
    setSelectedDay(null);
  };
  
  // Helper function to get reservations that start or end on a specific day
  const getReservationsForDate = (day: Date): Reservation[] => {
    if (!reservations) return [];
    
    return reservations.filter((reservation: Reservation) => {
      const startDate = safeParseDateISO(reservation.startDate);
      const endDate = safeParseDateISO(reservation.endDate);
      
      if (!startDate) return false;
      
      // Only show reservations that start or end on this specific day
      const isStartDay = isSameDay(day, startDate);
      const isEndDay = endDate ? isSameDay(day, endDate) : false;
      
      return isStartDay || isEndDay;
    }).filter((reservation: Reservation) => {
      // Apply current vehicle filters
      const vehicle = vehicles?.find((v: Vehicle) => v.id === reservation.vehicleId);
      if (!vehicle) return false;
      
      // Search filter
      if (vehicleFilters.search && 
          !vehicle.licensePlate?.toLowerCase().includes(vehicleFilters.search.toLowerCase()) &&
          !vehicle.brand?.toLowerCase().includes(vehicleFilters.search.toLowerCase()) &&
          !vehicle.model?.toLowerCase().includes(vehicleFilters.search.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (vehicleFilters.type !== "all" && vehicle.vehicleType !== vehicleFilters.type) {
        return false;
      }
      
      return true;
    });
  };
  
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
  
  // Fetch reservations for the full calendar view (including adjacent month dates)
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [
      "/api/reservations/range", 
      {
        startDate: format(dateRanges.days[0], "yyyy-MM-dd"),
        endDate: format(dateRanges.days[dateRanges.days.length - 1], "yyyy-MM-dd")
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
  
  // Safe date parsing function to prevent invalid date errors
  const safeParseDateISO = (dateString: string | null | undefined): Date | null => {
    if (!dateString || dateString === 'undefined' || dateString === 'null') {
      return null;
    }
    try {
      const parsed = parseISO(dateString);
      // Check if the parsed date is valid
      if (isNaN(parsed.getTime())) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  // Safe format function to prevent format errors with invalid dates
  const safeFormat = (date: Date | null | undefined, formatString: string, fallback: string = ''): string => {
    if (!date) return fallback;
    try {
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return fallback;
      }
      return format(date, formatString);
    } catch {
      return fallback;
    }
  };

  // Function to get reservations for a specific day and vehicle
  const getReservationsForDay = (vehicleId: number, day: Date) => {
    if (!reservations) return [];
    
    return reservations.filter(res => {
      const startDate = safeParseDateISO(res.startDate);
      const endDate = safeParseDateISO(res.endDate);
      
      if (!startDate) return false;
      // For open-ended reservations, endDate might be null
      const actualEndDate = endDate || startDate;
      
      return res.vehicleId === vehicleId && isDateInRange(day, startDate, actualEndDate);
    });
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
  
  // Function to get reservation color and style based on status and type
  const getReservationStyle = (status: string, isStart: boolean, isEnd: boolean, reservationType?: string) => {
    // Use custom styling system first, fallback to default
    const customClass = getCustomReservationStyle(status, isStart, isEnd, reservationType);
    
    const roundedLeft = isStart ? "rounded-l-md" : "";
    const roundedRight = isEnd ? "rounded-r-md" : "";
    
    return `${customClass} ${roundedLeft} ${roundedRight}`;
  };
  
  // Function to get custom inline styles for reservations
  const getReservationStyleObject = (status: string, reservationType?: string) => {
    return getCustomReservationStyleObject(status, reservationType);
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
    const rows: Date[][] = [];
    const days = dateRanges.days;
    
    // Group days into rows of 5 columns
    for (let i = 0; i < days.length; i += COLUMNS) {
      rows.push(days.slice(i, i + COLUMNS));
    }
    
    return rows;
  }, [dateRanges.days]);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Reservation Calendar</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setListDialogOpen(true)} data-testid="button-list-view">
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
          <ReservationAddDialog>
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              New Reservation
            </Button>
          </ReservationAddDialog>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex-row justify-between items-center space-y-0 pb-2">
          <div>
            <CardTitle>Reservation Schedule</CardTitle>
            <CardDescription>View and manage vehicle reservations</CardDescription>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setColorDialogOpen(true)}>
              <Palette className="h-4 w-4 mr-1" />
              Colors
            </Button>
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
            {/* Calendar Header - Hidden in 5-column mode for better alignment */}
            
            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
              {calendarGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-5 divide-x border-b last:border-b-0">
                  {week.map((day, dayIndex) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    
                    // Only get reservations starting or ending on this day
                    // Filter reservations based on selected vehicles
                    const dayReservations = reservations?.filter(res => {
                      const startDate = safeParseDateISO(res.startDate);
                      const endDate = safeParseDateISO(res.endDate);
                      
                      if (!startDate) return false;
                      
                      // Check if this day is a pickup or return day (only if endDate is valid)
                      const isPickupDay = isSameDay(day, startDate);
                      const isReturnDay = endDate ? isSameDay(day, endDate) : false;
                      
                      // First filter by date (pickup or return day)
                      const matchesDate = isPickupDay || isReturnDay;
                      
                      // Then check if the vehicle is in the filtered vehicles list
                      const matchesFilter = vehicleFilters.search === "" && vehicleFilters.type === "all" && vehicleFilters.availability === "all" || 
                                           filteredVehicles.some(v => v.id === res.vehicleId);
                                           
                      return matchesDate && matchesFilter;
                    }) || [];
                    
                    return (
                      <div
                        key={dayIndex}
                        className={`min-h-[140px] p-3 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''} relative group cursor-pointer`}
                        onClick={(e) => {
                          if (isCurrentMonth) {
                            const allDayReservations = getReservationsForDate(day);
                            if (allDayReservations.length > 0) {
                              // If there are reservations, show them in dialog
                              console.log('Date box clicked - opening day dialog for:', safeFormat(day, 'yyyy-MM-dd', 'invalid-date'));
                              openDayDialog(day);
                            } else {
                              // If no reservations, open new reservation dialog
                              const formattedDate = safeFormat(day, "yyyy-MM-dd", '1970-01-01');
                              console.log('Date box clicked - no reservations, opening add dialog');
                              setSelectedDate(formattedDate);
                              setAddDialogOpen(true);
                            }
                          }
                        }}
                      >
                        {/* Quick add button - only shows on hover for current month days, positioned at top center */}
                        {isCurrentMonth && (
                          <div className="absolute top-1 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-5 w-5 bg-primary/10 hover:bg-primary/20 rounded-full border border-primary/20 shadow-sm p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const formattedDate = safeFormat(day, "yyyy-MM-dd", '1970-01-01');
                                setSelectedDate(formattedDate);
                                setAddDialogOpen(true);
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus">
                                <path d="M5 12h14"/>
                                <path d="M12 5v14"/>
                              </svg>
                            </Button>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 font-medium">
                              {safeFormat(day, "EEE", "???")}
                            </span>
                            <span className={`text-base font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                              {safeFormat(day, "d", "?")}
                            </span>
                          </div>
                          {dayReservations.length > 0 && (
                            <Badge variant="outline" className="text-sm font-medium">
                              {dayReservations.length}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Show up to 5 reservations in month view */}
                        <div className="space-y-2">
                          {dayReservations.slice(0, 5).map(res => {
                            try {
                              const startDate = safeParseDateISO(res.startDate);
                              const endDate = safeParseDateISO(res.endDate);
                              
                              if (!startDate) return null;
                              
                              const isPickupDay = isSameDay(day, startDate);
                              const isReturnDay = endDate ? isSameDay(day, endDate) : false;
                              
                              // Calculate rental duration only if both dates are valid
                              const rentalDuration = endDate ? differenceInDays(endDate, startDate) + 1 : 1;
                            
                            return (
                              <HoverCard key={res.id} openDelay={300} closeDelay={200}>
                                <HoverCardTrigger asChild>
                                  <div 
                                    className={`px-2 py-1.5 text-sm truncate cursor-pointer group/res relative ${getReservationStyle(res.status, isPickupDay, isReturnDay, res.type)}`}
                                    style={getReservationStyleObject(res.status, res.type)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Main reservation item clicked for:', res.id);
                                      handleViewReservation(res);
                                    }}
                                    data-testid={`reservation-item-${res.id}`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <div className="truncate flex items-center">
                                          <span 
                                            className={`px-1.5 py-0.5 rounded text-xs font-semibold mr-1 ${res.placeholderSpare ? 'bg-orange-100 text-orange-800' : 'bg-primary-100 text-primary-800'}`}
                                            style={res.placeholderSpare ? getCustomTBDStyle() : {}}
                                          >
                                            {res.placeholderSpare ? 'TBD' : formatLicensePlate(res.vehicle?.licensePlate || '')}
                                          </span>
                                          {res.type === 'maintenance_block' && (
                                            <span className="ml-1 inline-flex items-center gap-1 bg-purple-300 text-purple-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-purple-400">
                                              <Wrench className="w-2.5 h-2.5" />
                                              MAINTENANCE
                                            </span>
                                          )}
                                          {res.type === 'replacement' && (
                                            <span className="ml-1 inline-block bg-orange-300 text-orange-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-orange-400">
                                              🚗 SPARE
                                            </span>
                                          )}
                                          {isPickupDay && 
                                            <span 
                                              className="ml-1 inline-block bg-green-200 text-green-800 text-[10px] px-1 rounded-sm font-medium"
                                              style={getCustomIndicatorStyle('pickup')}
                                            >
                                              out
                                            </span>
                                          }
                                          {isReturnDay && 
                                            <span 
                                              className="ml-1 inline-block bg-blue-200 text-blue-800 text-[10px] px-1 rounded-sm font-medium"
                                              style={getCustomIndicatorStyle('return')}
                                            >
                                              in
                                            </span>
                                          }
                                        </div>
                                      
                                      {/* Edit button - only visible on hover */}
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent triggering the parent onClick
                                          console.log('Small edit button clicked for:', res.id);
                                          handleEditReservation(res);
                                        }}
                                        size="icon"
                                        variant="ghost"
                                        className="h-3 w-3 opacity-0 group-hover/res:opacity-100 transition-opacity p-0"
                                      >
                                        <Edit className="h-2 w-2" />
                                      </Button>
                                      </div>
                                      
                                      {/* Customer information and status */}
                                      <div className="flex justify-between items-center">
                                        <div className="text-sm text-gray-600 truncate font-medium">
                                          {res.type === 'maintenance_block' ? (
                                            <span className="flex items-center gap-1">
                                              <Wrench className="w-3 h-3 text-purple-600" />
                                              Maintenance Service
                                            </span>
                                          ) : (
                                            res.customer?.name || 'No customer'
                                          )}
                                        </div>
                                        {res.type === 'maintenance_block' && (
                                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-200 px-1 py-0.5 rounded border border-purple-300">
                                            {formatReservationStatus(res.status).toUpperCase()}
                                          </span>
                                        )}
                                        {res.type === 'replacement' && (
                                          <span className="text-[10px] font-semibold text-orange-700 bg-orange-200 px-1 py-0.5 rounded border border-orange-300">
                                            {formatReservationStatus(res.status).toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent 
                                  className="w-80 p-0 shadow-lg" 
                                  side="right"
                                  align="start"
                                >
                                  {/* Reservation Preview Card */}
                                  <div className="space-y-2">
                                    {/* Header with status badge */}
                                    <div className="flex items-center justify-between border-b p-3">
                                      <h4 className="font-medium">
                                        {res.type === 'maintenance_block' ? 'Maintenance Service' : 
                                         res.type === 'replacement' ? 'Spare Vehicle Assignment' : 'Reservation Details'}
                                      </h4>
                                      <div className="flex gap-2">
                                        {res.type === 'maintenance_block' && (
                                          <Badge className="bg-purple-100 text-purple-800 border-purple-200" variant="outline">
                                            <Wrench className="w-3 h-3 mr-1" />
                                            MAINTENANCE
                                          </Badge>
                                        )}
                                        {res.type === 'replacement' && (
                                          <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="outline">
                                            SPARE CAR
                                          </Badge>
                                        )}
                                        <Badge 
                                          className={`${
                                            res.status?.toLowerCase() === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' : 
                                            res.status?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200' :
                                            res.status?.toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' :
                                            res.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' :
                                            'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                                          }`}
                                          variant="outline"
                                        >
                                          {formatReservationStatus(res.status)}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {/* Vehicle details */}
                                    <div className="px-3 py-1 flex items-start space-x-2">
                                      <Car className="h-4 w-4 text-gray-500 mt-0.5" />
                                      <div>
                                        {res.placeholderSpare ? (
                                          <>
                                            <div className="font-medium text-sm text-orange-700">TBD Spare Vehicle</div>
                                            <div className="text-xs text-gray-600">
                                              <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs font-semibold">
                                                Awaiting assignment
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="font-medium text-sm">{res.vehicle?.brand} {res.vehicle?.model}</div>
                                            <div className="text-xs text-gray-600">
                                              <span className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded text-xs font-semibold">
                                                {formatLicensePlate(res.vehicle?.licensePlate || '')}
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Customer details */}
                                    <div className="px-3 py-1 flex items-start space-x-2">
                                      <User className="h-4 w-4 text-gray-500 mt-0.5" />
                                      <div>
                                        <div className="font-medium text-sm">{res.customer?.name}</div>
                                        <div className="text-xs text-gray-600">{res.customer?.email || 'No email provided'}</div>
                                        {res.customer?.phone && <div className="text-xs text-gray-600">{res.customer?.phone}</div>}
                                      </div>
                                    </div>
                                    
                                    {/* Dates */}
                                    <div className="px-3 py-1 flex items-start space-x-2">
                                      <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                                      <div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-gray-500">Start:</span> {startDate ? format(startDate, 'MMM d, yyyy') : 'Invalid date'}
                                          </div>
                                          <div>
                                            <span className="text-gray-500">End:</span> {endDate ? format(endDate, 'MMM d, yyyy') : 'Open-ended'}
                                          </div>
                                          <div className="col-span-2">
                                            <span className="text-gray-500">Duration:</span> {rentalDuration} {rentalDuration === 1 ? 'day' : 'days'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Price and mileage */}
                                    <div className="px-3 py-1 flex items-start space-x-2">
                                      <CreditCard className="h-4 w-4 text-gray-500 mt-0.5" />
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {res.totalPrice && (
                                          <div>
                                            <span className="text-gray-500">Price:</span> {formatCurrency(Number(res.totalPrice))}
                                          </div>
                                        )}
                                        <div>
                                          <span className="text-gray-500">Status:</span>
                                          <Badge className="ml-1 text-xs">{formatReservationStatus(res.status)}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Notes if available */}
                                    {res.notes && (
                                      <div className="px-3 py-1 flex items-start space-x-2">
                                        <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 w-full">
                                          {res.notes}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Action buttons */}
                                    <div className="border-t p-3 flex justify-end space-x-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('View clicked for reservation:', res.id);
                                          handleViewReservation(res);
                                        }}
                                      >
                                        <Eye className="mr-1 h-3 w-3" />
                                        View
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('Status change clicked for reservation:', res.id);
                                          handleStatusChange(res);
                                        }}
                                      >
                                        <ClipboardEdit className="mr-1 h-3 w-3" />
                                        Status
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('Edit clicked for reservation:', res.id);
                                          handleEditReservation(res);
                                        }}
                                      >
                                        <Edit className="mr-1 h-3 w-3" />
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                              );
                            } catch (error) {
                              console.error('Error rendering reservation:', error, res);
                              return (
                                <div key={res.id} className="text-xs text-red-500 p-1 border border-red-200 rounded">
                                  Error displaying reservation
                                </div>
                              );
                            }
                          })}
                          
                          {dayReservations.length > 5 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('More button clicked for day:', safeFormat(day, 'yyyy-MM-dd', 'invalid-date'));
                                openDayDialog(day);
                              }}
                              data-testid={`button-more-${safeFormat(day, 'yyyy-MM-dd', 'invalid-date')}`}
                            >
                              +{dayReservations.length - 5} more
                            </Button>
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
          
          {/* Calendar Legend */}
          <CalendarLegend 
            categories={['reservation-status', 'reservation-type', 'indicators']}
            title="Reservation Calendar Legend"
            compact
          />
        </CardContent>
      </Card>
      
      {/* View Reservation Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => {
          console.log('View dialog open change:', open);
          setViewDialogOpen(open);
          if (!open) {
            setSelectedReservation(null);
          }
        }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReservation?.type === 'replacement' ? 'Spare Vehicle Assignment' : 'Reservation Details'}
              {selectedReservation?.type === 'replacement' && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200" variant="outline">
                  SPARE CAR
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedReservation ? `Reservation #${selectedReservation.id} - ${selectedReservation.customer?.name || 'No customer'}` : 'View detailed reservation information'}
            </DialogDescription>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-6">
              {/* Status and type badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge 
                  className={`${
                    selectedReservation.status?.toLowerCase() === 'confirmed' ? 'bg-green-100 text-green-800 border-green-200' : 
                    selectedReservation.status?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    selectedReservation.status?.toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    selectedReservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                  variant="outline"
                >
                  {formatReservationStatus(selectedReservation.status)}
                </Badge>
                {selectedReservation.type === 'replacement' && selectedReservation.replacementForReservationId && (
                  <Badge className="bg-orange-50 text-orange-800 border-orange-200" variant="outline">
                    {(() => {
                      // Try to find the original reservation to get vehicle details
                      const originalReservation = reservations?.find(r => r.id === selectedReservation.replacementForReservationId);
                      const originalVehicle = originalReservation?.vehicle || vehicles?.find(v => v.id === originalReservation?.vehicleId);
                      
                      if (originalVehicle) {
                        return `Spare for ${formatLicensePlate(originalVehicle.licensePlate)} (${originalVehicle.brand} ${originalVehicle.model})`;
                      }
                      
                      return `Spare for #${selectedReservation.replacementForReservationId}`;
                    })()}
                  </Badge>
                )}
              </div>

              {/* Vehicle Details */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Information
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedReservation.placeholderSpare ? (
                      <>
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-semibold">
                          TBD
                        </span>
                        <span className="font-medium text-orange-700">Spare Vehicle</span>
                        <span className="text-sm text-gray-600">Awaiting assignment</span>
                      </>
                    ) : (
                      <>
                        <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-semibold">
                          {formatLicensePlate(selectedReservation.vehicle?.licensePlate || '')}
                        </span>
                        <span className="font-medium">{selectedReservation.vehicle?.brand} {selectedReservation.vehicle?.model}</span>
                      </>
                    )}
                    {selectedReservation.type === 'replacement' && (
                      <span className="bg-orange-200 text-orange-900 text-xs px-2 py-1 rounded font-bold">
                        🚗 SPARE
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedReservation.vehicle?.vehicleType || 'Unknown type'} • {selectedReservation.vehicle?.fuel || 'Unknown fuel'}
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="space-y-2">
                  <div className="font-medium">{selectedReservation.customer?.name || 'No customer specified'}</div>
                  {selectedReservation.customer?.email && (
                    <div className="text-sm text-gray-600">{selectedReservation.customer.email}</div>
                  )}
                  {selectedReservation.customer?.phone && (
                    <div className="text-sm text-gray-600">{selectedReservation.customer.phone}</div>
                  )}
                </div>
              </div>

              {/* Dates and Duration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Start Date</label>
                  <p className="text-sm font-medium">{safeParseDateISO(selectedReservation.startDate) ? format(safeParseDateISO(selectedReservation.startDate)!, 'PPP') : 'Invalid date'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">End Date</label>
                  <p className="text-sm font-medium">{selectedReservation.endDate ? (safeParseDateISO(selectedReservation.endDate) ? format(safeParseDateISO(selectedReservation.endDate)!, 'PPP') : 'Invalid date') : 'Open-ended'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <p className="text-sm font-medium">
                    {(() => {
                      if (!selectedReservation.startDate || !selectedReservation.endDate) return 'Open-ended';
                      const startDate = safeParseDateISO(selectedReservation.startDate);
                      const endDate = safeParseDateISO(selectedReservation.endDate);
                      if (!startDate || !endDate) return 'Invalid dates';
                      const duration = differenceInDays(endDate, startDate) + 1;
                      return `${duration} ${duration === 1 ? 'day' : 'days'}`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-sm font-medium text-gray-500">Total Price</label>
                <p className="text-lg font-semibold">{selectedReservation.totalPrice ? formatCurrency(Number(selectedReservation.totalPrice)) : 'Not set'}</p>
              </div>

              {/* Notes */}
              {selectedReservation.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <div className="bg-gray-50 p-3 rounded-md mt-1">
                    <p className="text-sm whitespace-pre-wrap">{selectedReservation.notes}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleEditReservation(selectedReservation);
                  }}
                  data-testid="button-edit-reservation-dialog"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Reservation
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleStatusChange(selectedReservation);
                  }}
                  data-testid="button-change-status-dialog"
                >
                  <ClipboardEdit className="mr-2 h-4 w-4" />
                  Change Status
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleDeleteReservation(selectedReservation);
                  }}
                  data-testid="button-delete-reservation-dialog"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Reservation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
          console.log('Edit dialog open change:', open);
          setEditDialogOpen(open);
          if (!open) {
            setSelectedReservation(null);
          }
        }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
            <DialogDescription>
              Modify reservation details including dates, customer information, vehicle selection, and pricing.
            </DialogDescription>
          </DialogHeader>
          {selectedReservation && (
            <ReservationForm 
              editMode={true} 
              initialData={selectedReservation}
              onSuccess={() => {
                // Close the edit dialog and stay on calendar
                setEditDialogOpen(false);
                setSelectedReservation(null);
                // Refresh calendar data
                queryClient.invalidateQueries({ queryKey: ["/api/reservations/range"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      {selectedReservation && (
        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          reservationId={selectedReservation.id}
          initialStatus={selectedReservation.status || "pending"}
          vehicle={selectedReservation.vehicle ? {
            ...selectedReservation.vehicle,
            departureMileage: selectedReservation.vehicle.departureMileage ?? undefined,
            returnMileage: selectedReservation.vehicle.returnMileage ?? undefined
          } : undefined}
          customer={selectedReservation.customer ? {
            ...selectedReservation.customer,
            firstName: selectedReservation.customer.firstName ?? undefined,
            lastName: selectedReservation.customer.lastName ?? undefined,
            companyName: selectedReservation.customer.companyName ?? undefined,
            phone: selectedReservation.customer.phone ?? undefined,
            email: selectedReservation.customer.email ?? undefined
          } : undefined}
          onStatusChanged={async () => {
            // Close the dialog and refresh calendar data
            setStatusDialogOpen(false);
            setSelectedReservation(null);
            // Refresh calendar data
            queryClient.invalidateQueries({ queryKey: ["/api/reservations/range"] });
          }}
        />
      )}
      
      {/* Day Reservations Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={(open) => {
          console.log('Day dialog open change:', open);
          if (!open) {
            closeDayDialog();
          }
        }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Reservations for {selectedDay ? format(selectedDay, 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedDay ? 
                `${getReservationsForDate(selectedDay).length} reservations scheduled for this day.` :
                'View all reservations for the selected day.'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-3" data-testid="dialog-day-reservations">
              {getReservationsForDate(selectedDay).map((reservation) => {
                const startDate = safeParseDateISO(reservation.startDate);
                const endDate = safeParseDateISO(reservation.endDate);
                const vehicle = vehicles?.find((v: Vehicle) => v.id === reservation.vehicleId);
                const customer = reservation.customer;
                
                return (
                  <div 
                    key={reservation.id} 
                    className="border rounded-lg p-4 space-y-3 bg-white hover:bg-gray-50"
                    data-testid={`list-row-${reservation.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold mr-1 ${reservation.placeholderSpare ? 'bg-orange-100 text-orange-800' : 'bg-primary-100 text-primary-800'}`}>
                            {reservation.placeholderSpare ? 'TBD' : formatLicensePlate(vehicle?.licensePlate || '')}
                          </span>
                          {reservation.type === 'replacement' && (
                            <span className="inline-block bg-orange-300 text-orange-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-orange-400">
                              🚗 SPARE
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {vehicle?.brand} {vehicle?.model}
                        </div>
                        <Badge 
                          className={`text-xs ${
                            reservation.type === 'replacement' 
                              ? (reservation.status?.toLowerCase() === 'confirmed' ? 'bg-orange-100 text-orange-800 border-orange-200' : 
                                 reservation.status?.toLowerCase() === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                 reservation.status?.toLowerCase() === 'completed' ? 'bg-orange-200 text-orange-900 border-orange-300' :
                                 reservation.status?.toLowerCase() === 'cancelled' ? 'bg-orange-50 text-orange-400 border-orange-200' :
                                 'bg-orange-50 text-orange-600 border-orange-200')
                              : (reservation.status?.toLowerCase() === 'confirmed' ? 'bg-blue-100 text-blue-800' : 
                                 reservation.status?.toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-800' :
                                 reservation.status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                                 reservation.status?.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                                 'bg-gray-100 text-gray-800')
                          }`}
                          variant="outline"
                        >
                          {formatReservationStatus(reservation.status)}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            handleViewReservation(reservation);
                            closeDayDialog();
                          }}
                          data-testid={`button-view-${reservation.id}`}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            handleEditReservation(reservation);
                            closeDayDialog();
                          }}
                          data-testid={`button-edit-${reservation.id}`}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            handleDeleteReservation(reservation);
                            closeDayDialog();
                          }}
                          data-testid={`button-delete-${reservation.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Customer:</span> {customer?.name || 'Not specified'}
                      </div>
                      <div>
                        <span className="font-medium">Period:</span> {startDate ? format(startDate, 'MMM d') : 'Invalid'} → {endDate ? format(endDate, 'MMM d') : 'Open'}
                      </div>
                      <div>
                        <span className="font-medium">Price:</span> {reservation.totalPrice ? formatCurrency(Number(reservation.totalPrice)) : 'Not set'}
                      </div>
                    </div>
                    {reservation.notes && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">Notes:</span> {reservation.notes}
                      </div>
                    )}
                  </div>
                );
              })}
              {getReservationsForDate(selectedDay).length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No reservations found for this day.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Reservation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
            <DialogDescription>
              Create a new reservation for {selectedDate ? format(parseISO(selectedDate), 'MMMM d, yyyy') : 'the selected date'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ReservationForm 
              initialStartDate={selectedDate || undefined}
              onSuccess={() => {
                // Close dialog on successful creation
                setAddDialogOpen(false);
                setSelectedDate(null);
                // Refresh the calendar data
                queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
                queryClient.invalidateQueries({ 
                  queryKey: ['/api/reservations/range', {
                    startDate: format(dateRanges.start, "yyyy-MM-dd"),
                    endDate: format(dateRanges.end, "yyyy-MM-dd")
                  }]
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Reservation List Dialog */}
      <ReservationListDialog
        open={listDialogOpen}
        onOpenChange={setListDialogOpen}
      />


      {/* Color Coding Dialog */}
      <ColorCodingDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
      />
    </div>
  );
}