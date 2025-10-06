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
import { MaintenanceListDialog } from "@/components/maintenance/maintenance-list-dialog";
import { VehicleViewDialog } from "@/components/vehicles/vehicle-view-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { formatLicensePlate } from "@/lib/format-utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ColorCodingDialog } from "@/components/calendar/color-coding-dialog";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { getCustomMaintenanceStyle, getCustomMaintenanceStyleObject } from "@/lib/calendar-styling";
import { ChevronLeft, ChevronRight, Calendar, Car, Wrench, AlertTriangle, Clock, Plus, Eye, Edit, Trash2, Palette } from "lucide-react";

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
  id: string | number;
  vehicleId: number;
  vehicle: Vehicle;
  type: 'apk_due' | 'apk_reminder_2m' | 'apk_reminder_1m' | 'warranty_expiring' | 'warranty_reminder_2m' | 'warranty_reminder_1m' | 'scheduled_maintenance' | 'in_service';
  date: string;
  startDate?: string;
  endDate?: string;
  title: string;
  description: string;
  needsSpareVehicle?: boolean;
  currentReservations?: Reservation[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [selectedVehicleIdForSchedule, setSelectedVehicleIdForSchedule] = useState<number | null>(null);
  const [selectedMaintenanceTypeForSchedule, setSelectedMaintenanceTypeForSchedule] = useState<"breakdown" | "tire_replacement" | "brake_service" | "engine_repair" | "transmission_repair" | "electrical_issue" | "air_conditioning" | "battery_replacement" | "oil_change" | "regular_maintenance" | "apk_inspection" | "warranty_service" | "accident_damage" | "other" | null>(null);
  
  // Day dialog for maintenance events
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);
  
  // Color coding dialog
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  
  // Maintenance list dialog
  const [maintenanceListDialogOpen, setMaintenanceListDialogOpen] = useState(false);
  
  // Vehicle view dialog
  const [vehicleViewDialogOpen, setVehicleViewDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  
  // Maintenance reservation view dialog
  const [maintenanceReservationDialogOpen, setMaintenanceReservationDialogOpen] = useState(false);
  const [selectedMaintenanceReservationId, setSelectedMaintenanceReservationId] = useState<number | null>(null);
  
  // Warranty date dialog
  const [warrantyDateDialogOpen, setWarrantyDateDialogOpen] = useState(false);
  const [warrantyDateInput, setWarrantyDateInput] = useState<string>('');
  const [completingReservation, setCompletingReservation] = useState<any>(null);
  
  // Calculate next APK date based on vehicle type and age
  const calculateNextApkDate = (vehicle: Vehicle, completionDate: Date = new Date()): string => {
    if (!vehicle.productionDate && !vehicle.apkDate) {
      // Default to 1 year if we don't have production date
      const nextDate = new Date(completionDate);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      return format(nextDate, 'yyyy-MM-dd');
    }
    
    // Use apkDate if available for determining current cycle, otherwise use productionDate
    const referenceDate = vehicle.apkDate 
      ? parseISO(vehicle.apkDate) 
      : vehicle.productionDate 
        ? parseISO(vehicle.productionDate) 
        : null;
    
    if (!referenceDate) {
      // Default to 1 year if we can't determine reference date
      const nextDate = new Date(completionDate);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      return format(nextDate, 'yyyy-MM-dd');
    }
    
    // Calculate vehicle age from production date
    const productionDate = vehicle.productionDate ? parseISO(vehicle.productionDate) : null;
    const vehicleAgeYears = productionDate 
      ? differenceInDays(completionDate, productionDate) / 365.25 
      : 0;
    
    const fuel = vehicle.fuel?.toLowerCase() || '';
    const isDieselOrLpg = fuel.includes('diesel') || fuel.includes('lpg');
    const isPetrolOrElectric = fuel.includes('petrol') || fuel.includes('benzine') || fuel.includes('electric');
    
    let yearsToAdd = 1; // Default to annual
    
    if (isDieselOrLpg) {
      // Diesel/LPG: First inspection after 3 years, then annually
      if (vehicleAgeYears < 3) {
        yearsToAdd = 3 - Math.floor(vehicleAgeYears);
      } else {
        yearsToAdd = 1;
      }
    } else if (isPetrolOrElectric) {
      // Petrol/Electric: First inspection after 4 years, then every 2 years until 8 years, then annually
      if (vehicleAgeYears < 4) {
        yearsToAdd = 4 - Math.floor(vehicleAgeYears);
      } else if (vehicleAgeYears < 8) {
        yearsToAdd = 2;
      } else {
        yearsToAdd = 1;
      }
    }
    
    const nextDate = new Date(completionDate);
    nextDate.setFullYear(nextDate.getFullYear() + yearsToAdd);
    return format(nextDate, 'yyyy-MM-dd');
  };
  
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
          startDate: format(dateRanges.days[0], "yyyy-MM-dd"),
          endDate: format(dateRanges.days[dateRanges.days.length - 1], "yyyy-MM-dd")
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
  
  // Function to open schedule dialog from a maintenance event
  const openScheduleFromEvent = (event: { date?: string; startDate?: string; vehicleId: number; type: string }) => {
    const maintenanceTypeMap: Record<string, "apk_inspection" | "warranty_service"> = {
      'apk_due': 'apk_inspection',
      'apk_reminder_2m': 'apk_inspection',
      'apk_reminder_1m': 'apk_inspection',
      'warranty_expiring': 'warranty_service',
      'warranty_reminder_2m': 'warranty_service',
      'warranty_reminder_1m': 'warranty_service',
    };
    
    // Use startDate if available, fallback to date - never pass undefined
    const scheduleDate = event.startDate || event.date;
    if (scheduleDate && scheduleDate !== 'undefined') {
      setSelectedScheduleDate(scheduleDate);
    }
    setSelectedVehicleIdForSchedule(event.vehicleId);
    setSelectedMaintenanceTypeForSchedule(maintenanceTypeMap[event.type] || 'breakdown');
    setIsScheduleDialogOpen(true);
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

  // Fetch scheduled maintenance blocks (reservations with type maintenance_block)
  const { data: maintenanceBlocks = [] } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
    select: (reservations: Reservation[]) => 
      reservations.filter(r => r.type === 'maintenance_block')
  });

  // Helper function to shift weekend dates to next Monday
  const shiftWeekendToMonday = (date: Date): { shiftedDate: Date; wasShifted: boolean } => {
    const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    if (dayOfWeek === 0) { // Sunday -> shift to Monday (+1 day)
      return {
        shiftedDate: addDays(date, 1),
        wasShifted: true
      };
    } else if (dayOfWeek === 6) { // Saturday -> shift to Monday (+2 days)
      return {
        shiftedDate: addDays(date, 2), 
        wasShifted: true
      };
    } else {
      return {
        shiftedDate: date,
        wasShifted: false
      };
    }
  };

  // Helper function to check if maintenance is already scheduled for a vehicle
  const isMaintenanceScheduled = (vehicleId: number, maintenanceType: 'apk_inspection' | 'warranty_service'): boolean => {
    if (!maintenanceBlocks) {
      return false;
    }
    
    const found = maintenanceBlocks.some(block => {
      if (block.vehicleId !== vehicleId) return false;
      
      // For reminder suppression, we want to consider ALL maintenance blocks (past, present, future)
      // The goal is to suppress reminders if maintenance has already been scheduled/completed
      
      // Check maintenance type from reservation notes with comprehensive keyword matching
      const notes = (block.notes?.toLowerCase() || '').trim();
      const searchText = notes.toLowerCase();
      
      let matches = false;
      if (maintenanceType === 'apk_inspection') {
        // APK inspection keywords - using specific terms to avoid false positives
        matches = searchText.includes('apk_inspection') ||
                 searchText.includes('apk') || 
                 searchText.includes('keuring') || 
                 searchText.includes('rdw');
      } else if (maintenanceType === 'warranty_service') {
        // Warranty service keywords - using specific terms only
        matches = searchText.includes('warranty_service') ||
                 searchText.includes('warranty') || 
                 searchText.includes('garantie') || 
                 searchText.includes('garanti') ||
                 searchText.includes('recall');
      }
      
      return matches;
    });
    
    return found;
  };

  // Create maintenance events from vehicle data and scheduled maintenance
  const maintenanceEvents: MaintenanceEvent[] = useMemo(() => {
    const events: MaintenanceEvent[] = [];
    
    // Helper function to add APK events with advance reminders
    const addApkEvents = (vehicle: Vehicle) => {
      if (!vehicle.apkDate) return;
      
      const dueDate = parseISO(vehicle.apkDate);
      const twoMonthsBefore = subMonths(dueDate, 2);
      const oneMonthBefore = subMonths(dueDate, 1);
      const today = startOfDay(new Date());
      
      // Always create 2 months before reminder (show in backlog if past)
      const { shiftedDate: shifted2m, wasShifted: wasShifted2m } = shiftWeekendToMonday(twoMonthsBefore);
      const isOverdue2m = isBefore(shifted2m, today);
      events.push({
        id: `apk_reminder_2m_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'apk_reminder_2m' as const,
        date: format(shifted2m, 'yyyy-MM-dd'),
        title: isOverdue2m ? 'APK Reminder (2 months) - OVERDUE' : 'APK Reminder (2 months)' + (wasShifted2m ? ' (Moved from weekend)' : ''),
        description: isOverdue2m 
          ? `APK inspection reminder was due 2 months ago for ${vehicle.brand} ${vehicle.model}` + (wasShifted2m ? ' (Originally scheduled for weekend)' : '')
          : `APK inspection due in 2 months for ${vehicle.brand} ${vehicle.model}` + (wasShifted2m ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: false,
        priority: isOverdue2m ? 'urgent' : 'low',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
      
      // Always create 1 month before reminder (show in backlog if past)
      const { shiftedDate: shifted1m, wasShifted: wasShifted1m } = shiftWeekendToMonday(oneMonthBefore);
      const isOverdue1m = isBefore(shifted1m, today);
      events.push({
        id: `apk_reminder_1m_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'apk_reminder_1m' as const,
        date: format(shifted1m, 'yyyy-MM-dd'),
        title: isOverdue1m ? 'APK Reminder (1 month) - OVERDUE' : 'APK Reminder (1 month)' + (wasShifted1m ? ' (Moved from weekend)' : ''),
        description: isOverdue1m
          ? `APK inspection reminder was due 1 month ago for ${vehicle.brand} ${vehicle.model}` + (wasShifted1m ? ' (Originally scheduled for weekend)' : '')
          : `APK inspection due in 1 month for ${vehicle.brand} ${vehicle.model}` + (wasShifted1m ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: false,
        priority: isOverdue1m ? 'urgent' : 'medium',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
      
      // Actual due date
      const { shiftedDate: shiftedDue, wasShifted: wasShiftedDue } = shiftWeekendToMonday(dueDate);
      events.push({
        id: `apk_due_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'apk_due' as const,
        date: format(shiftedDue, 'yyyy-MM-dd'),
        title: 'APK Inspection Due' + (wasShiftedDue ? ' (Moved from weekend)' : ''),
        description: `APK inspection required for ${vehicle.brand} ${vehicle.model}` + (wasShiftedDue ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: true,
        priority: 'urgent',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
    };
    
    // Helper function to add warranty events with advance reminders
    const addWarrantyEvents = (vehicle: Vehicle) => {
      if (!vehicle.warrantyEndDate) return;
      
      const dueDate = parseISO(vehicle.warrantyEndDate);
      const twoMonthsBefore = subMonths(dueDate, 2);
      const oneMonthBefore = subMonths(dueDate, 1);
      const today = startOfDay(new Date());
      
      // Always create 2 months before reminder (show in backlog if past)
      const { shiftedDate: shifted2m, wasShifted: wasShifted2m } = shiftWeekendToMonday(twoMonthsBefore);
      const isOverdue2m = isBefore(shifted2m, today);
      events.push({
        id: `warranty_reminder_2m_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'warranty_reminder_2m' as const,
        date: format(shifted2m, 'yyyy-MM-dd'),
        title: isOverdue2m ? 'Warranty Reminder (2 months) - OVERDUE' : 'Warranty Reminder (2 months)' + (wasShifted2m ? ' (Moved from weekend)' : ''),
        description: isOverdue2m
          ? `Warranty reminder was due 2 months ago for ${vehicle.brand} ${vehicle.model}` + (wasShifted2m ? ' (Originally scheduled for weekend)' : '')
          : `Warranty expires in 2 months for ${vehicle.brand} ${vehicle.model}` + (wasShifted2m ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: false,
        priority: isOverdue2m ? 'urgent' : 'low',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
      
      // Always create 1 month before reminder (show in backlog if past)
      const { shiftedDate: shifted1m, wasShifted: wasShifted1m } = shiftWeekendToMonday(oneMonthBefore);
      const isOverdue1m = isBefore(shifted1m, today);
      events.push({
        id: `warranty_reminder_1m_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'warranty_reminder_1m' as const,
        date: format(shifted1m, 'yyyy-MM-dd'),
        title: isOverdue1m ? 'Warranty Reminder (1 month) - OVERDUE' : 'Warranty Reminder (1 month)' + (wasShifted1m ? ' (Moved from weekend)' : ''),
        description: isOverdue1m
          ? `Warranty reminder was due 1 month ago for ${vehicle.brand} ${vehicle.model}` + (wasShifted1m ? ' (Originally scheduled for weekend)' : '')
          : `Warranty expires in 1 month for ${vehicle.brand} ${vehicle.model}` + (wasShifted1m ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: false,
        priority: isOverdue1m ? 'urgent' : 'medium',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
      
      // Actual expiry date
      const { shiftedDate: shiftedExpiry, wasShifted: wasShiftedExpiry } = shiftWeekendToMonday(parseISO(vehicle.warrantyEndDate));
      events.push({
        id: `warranty_expiring_${vehicle.id}`,
        vehicleId: vehicle.id,
        vehicle,
        type: 'warranty_expiring' as const,
        date: format(shiftedExpiry, 'yyyy-MM-dd'),
        title: 'Warranty Expiring' + (wasShiftedExpiry ? ' (Moved from weekend)' : ''),
        description: `Warranty expires for ${vehicle.brand} ${vehicle.model}` + (wasShiftedExpiry ? ' (Moved from weekend to Monday)' : ''),
        needsSpareVehicle: false,
        priority: 'high',
        currentReservations: reservations?.filter((r: Reservation) => r.vehicleId === vehicle.id) || []
      });
    };
    
    // Generate APK and warranty events with advance reminders for ALL vehicles
    // Check every vehicle for APK and warranty dates to create complete reminders
    if (vehicles) {
      vehicles.forEach(vehicle => {
        // Create APK events if vehicle has APK date AND no APK maintenance is scheduled
        if (vehicle.apkDate && !isMaintenanceScheduled(vehicle.id, 'apk_inspection')) {
          addApkEvents(vehicle);
        }
        
        // Create warranty events if vehicle has warranty end date AND no warranty service is scheduled
        if (vehicle.warrantyEndDate && !isMaintenanceScheduled(vehicle.id, 'warranty_service')) {
          addWarrantyEvents(vehicle);
        }
      });
    }
    
    // Scheduled maintenance events (potentially multi-day)
    maintenanceBlocks.forEach(reservation => {
      // Find vehicle from vehicles list instead of relying on embedded object
      const vehicle = vehicles?.find((v: Vehicle) => v.id === reservation.vehicleId);
      if (!vehicle) return; // Skip if vehicle not found
      
      events.push({
        id: `scheduled_maintenance_${reservation.id}`, // Avoid ID conflicts
        vehicleId: reservation.vehicleId!, // Using ! since we already checked vehicle exists
        vehicle,
        type: 'scheduled_maintenance' as const,
        date: reservation.startDate,
        startDate: reservation.startDate,
        endDate: reservation.endDate || undefined,
        title: 'Scheduled Maintenance',
        description: reservation.notes || `Scheduled maintenance for ${vehicle.brand} ${vehicle.model}`,
        needsSpareVehicle: false,
        priority: 'high'
      });
    });
    
    return events;
  }, [apkExpiringVehicles, warrantyExpiringVehicles, maintenanceBlocks, reservations, vehicles]);

  // Helper function to get maintenance events that start, end, or occur on a specific day
  const getMaintenanceEventsForDate = (day: Date): MaintenanceEvent[] => {
    if (!maintenanceEvents) return [];
    
    return maintenanceEvents.filter((event: MaintenanceEvent) => {
      // Handle multi-day events for scheduled maintenance
      if (event.type === 'scheduled_maintenance' && event.startDate) {
        const startDate = safeParseDateISO(event.startDate);
        const endDate = safeParseDateISO(event.endDate);
        
        if (!startDate) return false;
        
        // Only show maintenance that starts or ends on this specific day
        const isStartDay = isSameDay(day, startDate);
        const isEndDay = endDate ? isSameDay(day, endDate) : false;
        
        return isStartDay || isEndDay;
      } else {
        // Single date events (APK due, warranty expiring) - always show
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
    // Use custom styling system first, fallback to default
    return getCustomMaintenanceStyle(type);
  };
  
  // Function to get custom inline styles for maintenance events
  const getMaintenanceStyleObject = (type: string) => {
    return getCustomMaintenanceStyleObject(type);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'apk_due':
        return <AlertTriangle className="w-3 h-3" />;
      case 'apk_reminder_2m':
      case 'apk_reminder_1m':
        return <Calendar className="w-3 h-3" />;
      case 'warranty_expiring':
        return <Clock className="w-3 h-3" />;
      case 'warranty_reminder_2m':
      case 'warranty_reminder_1m':
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
  const eventTypes = ['apk_due', 'apk_reminder_2m', 'apk_reminder_1m', 'warranty_expiring', 'warranty_reminder_2m', 'warranty_reminder_1m', 'scheduled_maintenance', 'in_service'];
  
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
          <Button 
            variant="outline" 
            onClick={() => setMaintenanceListDialogOpen(true)}
            data-testid="button-maintenance-list-view"
          >
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
          <Button onClick={() => {
            setSelectedScheduleDate(null); // No pre-selected date from header button
            setIsScheduleDialogOpen(true);
          }}>
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
                  <SelectItem value="apk_reminder_2m">APK Reminder (2 months)</SelectItem>
                  <SelectItem value="apk_reminder_1m">APK Reminder (1 month)</SelectItem>
                  <SelectItem value="warranty_expiring">Warranty Expiring</SelectItem>
                  <SelectItem value="warranty_reminder_2m">Warranty Reminder (2 months)</SelectItem>
                  <SelectItem value="warranty_reminder_1m">Warranty Reminder (1 month)</SelectItem>
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
                              // If no events, open schedule dialog with selected date
                              const dateStr = safeFormat(day, 'yyyy-MM-dd', '');
                              console.log('Maintenance date box clicked - no events, opening schedule dialog for:', dateStr);
                              setSelectedScheduleDate(dateStr);
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
                                const dateStr = safeFormat(day, 'yyyy-MM-dd', '');
                                setSelectedScheduleDate(dateStr);
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
                                    style={getMaintenanceStyleObject(event.type)}
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
                                        <Button 
                                          size="icon"
                                          variant="ghost"
                                          className="h-4 w-4 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedVehicleId(event.vehicleId);
                                            setVehicleViewDialogOpen(true);
                                          }}
                                          data-testid={`button-view-${event.vehicleId}`}
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
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
                                        {event.type === 'scheduled_maintenance' ? (
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              
                                              // For scheduled maintenance, extract the reservation ID from the event ID
                                              let reservationId: number;
                                              if (typeof event.id === 'string') {
                                                // Extract the number from strings like "scheduled_maintenance_60"
                                                const match = event.id.match(/\d+$/);
                                                reservationId = match ? parseInt(match[0]) : 0;
                                              } else {
                                                reservationId = event.id;
                                              }
                                              
                                              if (reservationId && !isNaN(reservationId) && reservationId > 0) {
                                                setSelectedMaintenanceReservationId(reservationId);
                                                setMaintenanceReservationDialogOpen(true);
                                              } else {
                                                toast({
                                                  title: "Error",
                                                  description: "Cannot find maintenance reservation details",
                                                  variant: "destructive"
                                                });
                                              }
                                            }}
                                            data-testid={`hover-view-maintenance-${event.vehicleId}`}
                                          >
                                            <Wrench className="h-3 w-3 mr-1" />
                                            View Maintenance
                                          </Button>
                                        ) : (
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              openScheduleFromEvent({
                                                date: event.date,
                                                vehicleId: event.vehicleId,
                                                type: event.type
                                              });
                                            }}
                                            data-testid={`hover-schedule-${event.vehicleId}`}
                                          >
                                            <Wrench className="h-3 w-3 mr-1" />
                                            Schedule Maintenance
                                          </Button>
                                        )}
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
          
          {/* Calendar Legend */}
          <CalendarLegend 
            categories={['maintenance-type', 'maintenance-priority']}
            title="Maintenance Calendar Legend"
            compact
          />
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
                            <Badge 
                              className={getEventTypeStyle(event.type)}
                              style={getMaintenanceStyleObject(event.type)}
                            >
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
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
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
                                      // Determine maintenance type from notes or event description
                                      const notes = actualReservation.notes?.toLowerCase() || '';
                                      const isApk = notes.includes('apk');
                                      const isWarranty = notes.includes('warranty') || notes.includes('garantie');
                                      
                                      if (isWarranty) {
                                        // For warranty, prompt user for the new warranty date
                                        setCompletingReservation(actualReservation);
                                        setWarrantyDateInput(format(new Date(), 'yyyy-MM-dd'));
                                        setWarrantyDateDialogOpen(true);
                                      } else {
                                        // For APK or regular maintenance, complete automatically
                                        const today = new Date();
                                        const updates: any = {
                                          maintenanceStatus: 'ok',
                                        };
                                        
                                        if (isApk) {
                                          // Calculate next APK date based on vehicle type and age
                                          updates.apkDate = calculateNextApkDate(event.vehicle, today);
                                        }
                                        
                                        // Update vehicle maintenance tracking
                                        await apiRequest('PATCH', `/api/vehicles/${event.vehicleId}`, updates);
                                        
                                        // Delete the maintenance reservation
                                        await apiRequest('DELETE', `/api/reservations/${actualReservation.id}`);
                                        
                                        // Refresh calendar
                                        queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
                                        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
                                        queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
                                        queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });
                                        
                                        closeDayDialog();
                                        
                                        toast({
                                          title: "Maintenance Completed",
                                          description: `Vehicle maintenance tracking has been updated${isApk ? ' (Next APK date calculated)' : ''}.`,
                                        });
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Failed to complete maintenance:', error);
                                    toast({
                                      title: "Error",
                                      description: "Failed to complete maintenance. Please try again.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                data-testid={`button-complete-${event.id}`}
                              >
                                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Complete
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
                          {(event.type.includes('apk') || event.type.includes('warranty')) && (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => {
                                openScheduleFromEvent({
                                  date: event.date,
                                  startDate: event.startDate,
                                  vehicleId: event.vehicleId,
                                  type: event.type
                                });
                                closeDayDialog();
                              }}
                              data-testid={`button-schedule-${event.type}-${event.vehicleId}`}
                            >
                              <Wrench className="h-4 w-4 mr-1" />
                              Schedule Maintenance
                            </Button>
                          )}
                          {event.type === 'scheduled_maintenance' ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                // Extract the reservation ID from the event ID  
                                let reservationId: number;
                                if (typeof event.id === 'string') {
                                  // Extract the number from strings like "scheduled_maintenance_60"
                                  const match = event.id.match(/\d+$/);
                                  reservationId = match ? parseInt(match[0]) : 0;
                                } else {
                                  reservationId = event.id;
                                }
                                
                                if (reservationId && reservationId > 0) {
                                  setSelectedMaintenanceReservationId(reservationId);
                                  setMaintenanceReservationDialogOpen(true);
                                }
                              }}
                            >
                              <Wrench className="h-4 w-4 mr-1" />
                              View Maintenance
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                openScheduleFromEvent({
                                  date: event.date,
                                  startDate: event.startDate,
                                  vehicleId: event.vehicleId,
                                  type: event.type
                                });
                              }}
                            >
                              <Wrench className="h-4 w-4 mr-1" />
                              Schedule Maintenance
                            </Button>
                          )}
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
                      const dateStr = selectedDay ? safeFormat(selectedDay, 'yyyy-MM-dd', '') : null;
                      setSelectedScheduleDate(dateStr);
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
            setSelectedScheduleDate(null);
            setSelectedVehicleIdForSchedule(null);
            setSelectedMaintenanceTypeForSchedule(null);
          }
        }}
        editingReservation={editingReservation}
        initialDate={selectedScheduleDate || undefined}
        initialVehicleId={selectedVehicleIdForSchedule || undefined}
        initialMaintenanceType={selectedMaintenanceTypeForSchedule || undefined}
        onSuccess={() => {
          // Comprehensive cache invalidation to ensure immediate UI updates
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
          
          // Also invalidate the current range for immediate update
          queryClient.invalidateQueries({ 
            queryKey: ['/api/reservations/range', {
              startDate: format(dateRanges.days[0], "yyyy-MM-dd"),
              endDate: format(dateRanges.days[dateRanges.days.length - 1], "yyyy-MM-dd")
            }]
          });
          
          // Close the day dialog to immediately reflect changes
          closeDayDialog();
          
          // Force calendar to refresh by updating current date
          setCurrentDate(new Date(currentDate));
          setEditingReservation(null);
          
          // Show success message
          toast({
            title: "Maintenance Scheduled",
            description: "The maintenance has been scheduled and reminders have been updated.",
          });
        }}
      />

      {/* Maintenance Edit Dialog */}
      <MaintenanceEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedReservation(null);
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
          }
        }}
        reservation={selectedReservation}
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

      {/* Color Coding Dialog */}
      <ColorCodingDialog
        open={colorDialogOpen}
        onOpenChange={setColorDialogOpen}
      />

      {/* Maintenance List Dialog */}
      <MaintenanceListDialog
        open={maintenanceListDialogOpen}
        onOpenChange={setMaintenanceListDialogOpen}
      />

      {/* Vehicle View Dialog */}
      <VehicleViewDialog
        open={vehicleViewDialogOpen}
        onOpenChange={(open) => {
          setVehicleViewDialogOpen(open);
          if (!open) {
            setSelectedVehicleId(null);
          }
        }}
        vehicleId={selectedVehicleId}
      />

      {/* Maintenance Reservation View Dialog */}
      <ReservationViewDialog
        open={maintenanceReservationDialogOpen}
        onOpenChange={(open) => {
          setMaintenanceReservationDialogOpen(open);
          if (!open) {
            setSelectedMaintenanceReservationId(null);
          }
        }}
        reservationId={selectedMaintenanceReservationId}
      />

      {/* Warranty Date Input Dialog */}
      <Dialog open={warrantyDateDialogOpen} onOpenChange={setWarrantyDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Warranty Maintenance</DialogTitle>
            <DialogDescription>
              Enter the new warranty end date for this vehicle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Warranty End Date</label>
              <Input
                type="date"
                value={warrantyDateInput}
                onChange={(e) => setWarrantyDateInput(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setWarrantyDateDialogOpen(false);
                  setCompletingReservation(null);
                  setWarrantyDateInput('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={async () => {
                  try {
                    if (!completingReservation || !warrantyDateInput) {
                      throw new Error('Missing required data');
                    }

                    // Update vehicle with new warranty date
                    await apiRequest('PATCH', `/api/vehicles/${completingReservation.vehicleId}`, {
                      warrantyEndDate: warrantyDateInput,
                      maintenanceStatus: 'ok',
                    });

                    // Delete the maintenance reservation
                    await apiRequest('DELETE', `/api/reservations/${completingReservation.id}`);

                    // Refresh calendar
                    queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/vehicles/warranty-expiring'] });

                    setWarrantyDateDialogOpen(false);
                    setCompletingReservation(null);
                    setWarrantyDateInput('');
                    closeDayDialog();

                    toast({
                      title: "Warranty Maintenance Completed",
                      description: "Vehicle warranty date has been updated.",
                    });
                  } catch (error) {
                    console.error('Failed to complete warranty maintenance:', error);
                    toast({
                      title: "Error",
                      description: "Failed to complete warranty maintenance. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Complete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}