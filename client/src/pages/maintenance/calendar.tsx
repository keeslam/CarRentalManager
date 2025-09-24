import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, isSameDay, parseISO, startOfMonth, endOfMonth, getDate, getDay, getMonth, getYear, isSameMonth, addMonths, subMonths, startOfDay, endOfDay, isBefore, isAfter, differenceInDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScheduleMaintenanceDialog } from "@/components/maintenance/schedule-maintenance-dialog";
import { MaintenanceEditDialog } from "@/components/maintenance/maintenance-edit-dialog";
import { formatLicensePlate } from "@/lib/format-utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Calendar, Car, Wrench, AlertTriangle, Clock, Plus, Eye, Edit, Trash2 } from "lucide-react";

// Calendar view options
type CalendarView = "month";

// Calendar configuration
const COLUMNS = 5;

// Type for filters
type MaintenanceFilters = {
  search: string;
  type: string;
  eventType: string;
};

interface MaintenanceEvent {
  id: number;
  vehicleId: number;
  vehicle: Vehicle;
  type: 'apk_due' | 'warranty_expiring' | 'scheduled_maintenance' | 'in_service';
  date: string;
  startDate?: string;
  endDate?: string;
  title: string;
  description: string;
  needsSpareVehicle?: boolean;
  currentReservations?: Reservation[];
}

export default function MaintenanceCalendar() {
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [maintenanceFilters, setMaintenanceFilters] = useState<MaintenanceFilters>({
    search: "",
    type: "all",
    eventType: "all"
  });
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  
  // Day dialog for maintenance events
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  
  // Dialog handlers
  const handleViewMaintenanceEvent = (reservation: Reservation) => {
    console.log('handleViewMaintenanceEvent called with:', reservation);
    setSelectedReservation(reservation);
    setViewDialogOpen(true);
  };
  
  const handleEditMaintenance = (reservation: Reservation) => {
    console.log('handleEditMaintenance called with:', reservation);
    setSelectedReservation(reservation);
    setEditDialogOpen(true);
    console.log('Edit dialog should be open now');
  };

  const handleDeleteMaintenance = async (reservation: Reservation) => {
    try {
      const response = await apiRequest("DELETE", `/api/reservations/${reservation.id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete maintenance reservation');
      }

      // Create descriptive vehicle info for toast
      const vehicleInfo = reservation.vehicle 
        ? `${reservation.vehicle.brand} ${reservation.vehicle.model} (${displayLicensePlate(reservation.vehicle.licensePlate)})`
        : `Vehicle ${reservation.vehicleId}`;

      // Show success toast
      toast({
        title: "Maintenance deleted",
        description: `Maintenance for ${vehicleInfo} has been deleted successfully.`,
      });

      // Invalidate all relevant queries to refresh the calendar
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reservations/range', {
          startDate: format(dateRanges.start, "yyyy-MM-dd"),
          endDate: format(dateRanges.end, "yyyy-MM-dd")
        }]
      });

      // Close dialogs if open
      setDeleteDialogOpen(false);
      setDayDialogOpen(false);
      setViewDialogOpen(false);
      setEditDialogOpen(false);
      setSelectedReservation(null);
      setReservationToDelete(null);
      
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete maintenance reservation",
        variant: "destructive",
      });
    }
  };
  
  const handleCloseDialogs = () => {
    console.log('Closing all dialogs');
    setViewDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedReservation(null);
  };
  
  // Day dialog handlers
  const openDayDialog = (day: Date) => {
    console.log('Opening maintenance day dialog for:', day);
    setSelectedDay(day);
    setDayDialogOpen(true);
  };
  
  const closeDayDialog = () => {
    console.log('Closing maintenance day dialog');
    setDayDialogOpen(false);
    setSelectedDay(null);
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
    
    // Generate all days in the calendar grid, but only weekdays
    const dayCount = differenceInDays(lastDay, firstDay) + 1;
    const allDays = Array.from({ length: dayCount }, (_, i) => addDays(firstDay, i));
    const days = allDays.filter(day => {
      const dayOfWeek = getDay(day);
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday only
    });
    
    const rangeText = format(currentDate, "MMMM yyyy");
    
    return { start, end, days, rangeText };
  }, [currentDate]);
  
  // Fetch vehicles
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch vehicles with maintenance needs
  const { data: apkExpiringVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/apk-expiring'],
  });

  const { data: warrantyExpiringVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/warranty-expiring'],
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

  // Fetch scheduled maintenance blocks (reservations with type maintenance_block)
  const { data: maintenanceBlocks = [] } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
    select: (reservations: Reservation[]) => 
      reservations.filter(r => r.type === 'maintenance_block')
  });

  // Create maintenance events from vehicle data and scheduled maintenance
  const maintenanceEvents: MaintenanceEvent[] = useMemo(() => {
    const events: MaintenanceEvent[] = [];
    
    // APK due events (single date)
    apkExpiringVehicles.forEach(vehicle => {
      events.push({
        id: vehicle.id,
        vehicleId: vehicle.id,
        vehicle,
        type: 'apk_due' as const,
        date: vehicle.apkDate || '',
        title: 'APK Inspection Due',
        description: `APK inspection required for ${vehicle.brand} ${vehicle.model}`,
        needsSpareVehicle: true,
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
    });
    
    // Warranty expiring events (single date)
    warrantyExpiringVehicles.forEach(vehicle => {
      events.push({
        id: vehicle.id + 10000, // Avoid ID conflicts
        vehicleId: vehicle.id,
        vehicle,
        type: 'warranty_expiring' as const,
        date: vehicle.warrantyEndDate || '',
        title: 'Warranty Expiring',
        description: `Warranty expires for ${vehicle.brand} ${vehicle.model}`,
        needsSpareVehicle: false
      });
    });
    
    // Scheduled maintenance events (potentially multi-day)
    maintenanceBlocks.forEach(reservation => {
      // Find vehicle from vehicles list instead of relying on embedded object
      const vehicle = vehicles?.find((v: Vehicle) => v.id === reservation.vehicleId);
      if (!vehicle) return; // Skip if vehicle not found
      
      events.push({
        id: reservation.id + 20000, // Avoid ID conflicts
        vehicleId: reservation.vehicleId,
        vehicle,
        type: 'scheduled_maintenance' as const,
        date: reservation.startDate,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        title: 'Scheduled Maintenance',
        description: reservation.notes || `Scheduled maintenance for ${vehicle.brand} ${vehicle.model}`,
        needsSpareVehicle: false
      });
    });
    
    return events;
  }, [apkExpiringVehicles, warrantyExpiringVehicles, maintenanceBlocks, reservations, vehicles]);

  // Helper function to get all maintenance events for a specific day
  const getMaintenanceEventsForDate = (day: Date): MaintenanceEvent[] => {
    if (!maintenanceEvents) return [];
    
    return maintenanceEvents.filter((event: MaintenanceEvent) => {
      // Handle multi-day events for scheduled maintenance
      if (event.type === 'scheduled_maintenance' && event.startDate) {
        const startDate = safeParseDateISO(event.startDate);
        const endDate = safeParseDateISO(event.endDate);
        
        if (!startDate) return false;
        
        // Check if this day falls within the maintenance period
        if (endDate) {
          return (isSameDay(day, startDate) || isSameDay(day, endDate) || 
                  (day >= startDate && day <= endDate));
        } else {
          // Open-ended maintenance - check if day is on or after start date
          return isSameDay(day, startDate) || day >= startDate;
        }
      } else {
        // Single date events (APK due, warranty expiring)
        if (!event.date) return false;
        const eventDate = safeParseDateISO(event.date);
        if (!eventDate) return false;
        return isSameDay(day, eventDate);
      }
    }).filter((event: MaintenanceEvent) => {
      // Apply current filters
      const vehicle = event.vehicle;
      if (!vehicle) return false;
      
      // Search filter
      if (maintenanceFilters.search && 
          !vehicle.licensePlate?.toLowerCase().includes(maintenanceFilters.search.toLowerCase()) &&
          !vehicle.brand?.toLowerCase().includes(maintenanceFilters.search.toLowerCase()) &&
          !vehicle.model?.toLowerCase().includes(maintenanceFilters.search.toLowerCase()) &&
          !event.title?.toLowerCase().includes(maintenanceFilters.search.toLowerCase())) {
        return false;
      }
      
      // Vehicle type filter
      if (maintenanceFilters.type !== "all" && vehicle.vehicleType !== maintenanceFilters.type) {
        return false;
      }
      
      // Event type filter
      if (maintenanceFilters.eventType !== "all" && event.type !== maintenanceFilters.eventType) {
        return false;
      }
      
      return true;
    });
  };

  // Get event type styling
  const getEventTypeStyle = (type: string) => {
    switch (type) {
      case 'apk_due':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warranty_expiring':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'scheduled_maintenance':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_service':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'apk_due':
        return <AlertTriangle className="w-3 h-3" />;
      case 'warranty_expiring':
        return <Clock className="w-3 h-3" />;
      case 'scheduled_maintenance':
        return <Wrench className="w-3 h-3" />;
      case 'in_service':
        return <Car className="w-3 h-3" />;
      default:
        return <Calendar className="w-3 h-3" />;
    }
  };
  
  // Extract unique vehicle types for filtering
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    const types = Array.from(new Set(vehicles.map(v => v.vehicleType).filter(Boolean))) as string[];
    return types.sort();
  }, [vehicles]);
  
  // Extract unique event types for filtering
  const eventTypes = ['apk_due', 'warranty_expiring', 'scheduled_maintenance', 'in_service'];
  
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
  
  // Filter handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaintenanceFilters({
      ...maintenanceFilters,
      search: e.target.value
    });
  };
  
  const handleTypeChange = (value: string) => {
    setMaintenanceFilters({
      ...maintenanceFilters,
      type: value
    });
  };
  
  const handleEventTypeChange = (value: string) => {
    setMaintenanceFilters({
      ...maintenanceFilters,
      eventType: value
    });
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
        <h1 className="text-2xl font-bold">Maintenance Calendar</h1>
        <div className="flex gap-2">
          <Link href="/maintenance">
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
          <Button onClick={() => setIsScheduleDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Maintenance
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex-row justify-between items-center space-y-0 pb-2">
          <div>
            <CardTitle>Maintenance Schedule</CardTitle>
            <CardDescription>View and manage vehicle maintenance events</CardDescription>
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
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h4 className="text-base font-medium w-40 text-center">{dateRanges.rangeText}</h4>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            </div>
            
            {/* Maintenance Filters */}
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search vehicles or events..."
                value={maintenanceFilters.search}
                onChange={handleSearchChange}
                className="w-50 h-9"
              />
              
              {vehicleTypes.length > 0 && (
                <Select value={maintenanceFilters.type} onValueChange={handleTypeChange}>
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
              
              <Select value={maintenanceFilters.eventType} onValueChange={handleEventTypeChange}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="apk_due">APK Due</SelectItem>
                  <SelectItem value="warranty_expiring">Warranty Expiring</SelectItem>
                  <SelectItem value="scheduled_maintenance">Scheduled Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Month View */}
          <div className="mb-6">
            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
              {calendarGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-5 divide-x border-b last:border-b-0">
                  {week.map((day, dayIndex) => {
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    
                    // Get maintenance events for this day with filters applied
                    const dayEvents = getMaintenanceEventsForDate(day);
                    
                    return (
                      <div
                        key={dayIndex}
                        className={`min-h-[140px] p-3 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''} relative group cursor-pointer`}
                        onClick={(e) => {
                          if (isCurrentMonth) {
                            const allDayEvents = getMaintenanceEventsForDate(day);
                            if (allDayEvents.length > 0) {
                              // If there are events, show them in dialog
                              console.log('Maintenance date box clicked - opening day dialog for:', safeFormat(day, 'yyyy-MM-dd', 'invalid-date'));
                              openDayDialog(day);
                            } else {
                              // If no events, open schedule dialog
                              console.log('Maintenance date box clicked - no events, opening schedule dialog');
                              setIsScheduleDialogOpen(true);
                            }
                          }
                        }}
                      >
                        {/* Quick add button - only shows on hover for current month days */}
                        {isCurrentMonth && (
                          <div className="absolute top-1 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-5 w-5 bg-primary/10 hover:bg-primary/20 rounded-full border border-primary/20 shadow-sm p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsScheduleDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3 w-3" />
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
                          {dayEvents.length > 0 && (
                            <Badge variant="outline" className="text-sm font-medium">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Events for this day */}
                        <div className="space-y-1">
                          {dayEvents.map(event => {
                            const isMaintenanceBlock = event.type === 'scheduled_maintenance';
                            
                            return (
                              <HoverCard key={`${event.id}-${event.type}`}>
                                <HoverCardTrigger asChild>
                                  <div
                                    className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 border ${getEventTypeStyle(event.type)} group`}
                                    data-testid={`event-${event.id}-${event.type}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {getEventIcon(event.type)}
                                        <span className="truncate">{displayLicensePlate(event.vehicle.licensePlate)}</span>
                                      </div>
                                      
                                      {/* Action buttons - only show on hover */}
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isMaintenanceBlock && (
                                          <Button 
                                            size="icon"
                                            variant="ghost"
                                            className="h-4 w-4 p-0"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const response = await fetch('/api/reservations');
                                                const allReservations = await response.json();
                                                const actualReservation = allReservations.find((r: any) => 
                                                  r.vehicleId === event.vehicleId && 
                                                  r.type === 'maintenance_block' &&
                                                  r.startDate === event.date
                                                );
                                                
                                                if (actualReservation) {
                                                  handleEditMaintenance(actualReservation);
                                                }
                                              } catch (error) {
                                                console.error('Failed to fetch reservation:', error);
                                              }
                                            }}
                                            data-testid={`button-edit-${event.id}`}
                                          >
                                            <Edit className="h-3 w-3" />
                                          </Button>
                                        )}
                                        <Link href={`/vehicles/${event.vehicleId}`}>
                                          <Button 
                                            size="icon"
                                            variant="ghost"
                                            className="h-4 w-4 p-0"
                                            data-testid={`button-view-${event.vehicleId}`}
                                          >
                                            <Eye className="h-3 w-3" />
                                          </Button>
                                        </Link>
                                      </div>
                                    </div>
                                    <div className="truncate mt-1">{event.title}</div>
                                    {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                                      <Badge className="bg-orange-500 text-white text-xs mt-1">
                                        Spare needed
                                      </Badge>
                                    )}
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80">
                                  <div className="flex justify-between space-x-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        {getEventIcon(event.type)}
                                        <h4 className="text-sm font-semibold">{event.title}</h4>
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {event.vehicle.brand} {event.vehicle.model}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {displayLicensePlate(event.vehicle.licensePlate)}
                                      </p>
                                      <p className="text-sm">
                                        {event.description}
                                      </p>
                                      <div className="flex items-center pt-2 gap-2">
                                        {isMaintenanceBlock && (
                                          <Button 
                                            size="sm" 
                                            variant="outline"
                                            onClick={async () => {
                                              try {
                                                const response = await fetch('/api/reservations');
                                                const allReservations = await response.json();
                                                const actualReservation = allReservations.find((r: any) => 
                                                  r.vehicleId === event.vehicleId && 
                                                  r.type === 'maintenance_block' &&
                                                  r.startDate === event.date
                                                );
                                                
                                                if (actualReservation) {
                                                  handleEditMaintenance(actualReservation);
                                                }
                                              } catch (error) {
                                                console.error('Failed to fetch reservation:', error);
                                              }
                                            }}
                                            data-testid={`hover-edit-${event.id}`}
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                        )}
                                        <Link href={`/vehicles/${event.vehicleId}`}>
                                          <Button size="sm" variant="outline" data-testid={`hover-view-${event.vehicleId}`}>
                                            <Eye className="h-3 w-3 mr-1" />
                                            View Vehicle
                                          </Button>
                                        </Link>
                                      </div>
                                    </div>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Day Dialog for viewing maintenance events */}
      <Dialog open={dayDialogOpen} onOpenChange={(open) => { 
        if (!open) closeDayDialog(); 
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maintenance Events - {selectedDay ? safeFormat(selectedDay, 'MMMM d, yyyy', 'Selected Day') : 'Day'}</DialogTitle>
            <DialogDescription>
              View and manage maintenance events for this day
            </DialogDescription>
          </DialogHeader>
          
          {selectedDay && (
            <div className="space-y-4">
              {getMaintenanceEventsForDate(selectedDay).map(event => {
                const isMaintenanceBlock = event.type === 'scheduled_maintenance';
                
                return (
                  <Card key={`${event.id}-${event.type}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getEventIcon(event.type)}
                            <h4 className="font-semibold">{event.title}</h4>
                            <Badge className={getEventTypeStyle(event.type)}>
                              {event.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {event.vehicle.brand} {event.vehicle.model} - {displayLicensePlate(event.vehicle.licensePlate)}
                          </p>
                          <p className="text-sm">{event.description}</p>
                          {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                            <Badge className="bg-orange-100 text-orange-800">
                              Spare vehicle needed
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {isMaintenanceBlock && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const response = await fetch('/api/reservations');
                                    const allReservations = await response.json();
                                    const actualReservation = allReservations.find((r: any) => 
                                      r.vehicleId === event.vehicleId && 
                                      r.type === 'maintenance_block' &&
                                      r.startDate === event.date
                                    );
                                    
                                    if (actualReservation) {
                                      handleEditMaintenance(actualReservation);
                                      closeDayDialog();
                                    }
                                  } catch (error) {
                                    console.error('Failed to fetch reservation:', error);
                                  }
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const response = await fetch('/api/reservations');
                                    const allReservations = await response.json();
                                    const actualReservation = allReservations.find((r: any) => 
                                      r.vehicleId === event.vehicleId && 
                                      r.type === 'maintenance_block' &&
                                      r.startDate === event.date
                                    );
                                    
                                    if (actualReservation) {
                                      setReservationToDelete(actualReservation);
                                      setDeleteDialogOpen(true);
                                    }
                                  } catch (error) {
                                    console.error('Failed to fetch reservation:', error);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${event.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </>
                          )}
                          <Link href={`/vehicles/${event.vehicleId}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-1" />
                              View Vehicle
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {getMaintenanceEventsForDate(selectedDay).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No maintenance events scheduled for this day</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => {
                      closeDayDialog();
                      setIsScheduleDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Maintenance
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Maintenance Dialog */}
      <ScheduleMaintenanceDialog
        open={isScheduleDialogOpen}
        onOpenChange={(open) => {
          setIsScheduleDialogOpen(open);
          if (!open) {
            setEditingReservation(null);
          }
        }}
        editingReservation={editingReservation}
        onSuccess={() => {
          // Invalidate all relevant queries to refresh the calendar
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
          queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
          queryClient.invalidateQueries({ 
            queryKey: ['/api/reservations/range', {
              startDate: format(dateRanges.start, "yyyy-MM-dd"),
              endDate: format(dateRanges.end, "yyyy-MM-dd")
            }]
          });
          setCurrentDate(new Date(currentDate));
          setEditingReservation(null);
        }}
      />

      {/* Maintenance Edit Dialog */}
      <MaintenanceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        reservation={selectedReservation}
        onSuccess={() => {
          // Invalidate all relevant queries to refresh the calendar
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
          queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
          queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
          queryClient.invalidateQueries({ 
            queryKey: ['/api/reservations/range', {
              startDate: format(dateRanges.start, "yyyy-MM-dd"),
              endDate: format(dateRanges.end, "yyyy-MM-dd")
            }]
          });
          setEditDialogOpen(false);
          setSelectedReservation(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maintenance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this maintenance reservation for{' '}
              {reservationToDelete?.vehicle ? (
                <>
                  <strong>
                    {reservationToDelete.vehicle.brand} {reservationToDelete.vehicle.model}
                  </strong>{' '}
                  ({displayLicensePlate(reservationToDelete.vehicle.licensePlate)})
                </>
              ) : (
                <strong>Vehicle {reservationToDelete?.vehicleId}</strong>
              )}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (reservationToDelete) {
                  handleDeleteMaintenance(reservationToDelete);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}