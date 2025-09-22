import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Car, Wrench, AlertTriangle, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Vehicle, Reservation } from "@shared/schema";
import { formatLicensePlate } from "@/lib/format-utils";
import { ScheduleMaintenanceDialog } from "@/components/maintenance/schedule-maintenance-dialog";
import { MaintenanceEditDialog } from "@/components/maintenance/maintenance-edit-dialog";

interface MaintenanceEvent {
  id: number;
  vehicleId: number;
  vehicle: Vehicle;
  type: 'apk_due' | 'warranty_expiring' | 'scheduled_maintenance' | 'in_service';
  date: string;
  title: string;
  description: string;
  needsSpareVehicle?: boolean;
  currentReservations?: Reservation[];
}

export default function MaintenanceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Edit handler following reservations calendar pattern
  const handleEditMaintenance = (reservation: Reservation) => {
    console.log('handleEditMaintenance called with:', reservation);
    setSelectedReservation(reservation);
    setEditDialogOpen(true);
    console.log('Edit dialog should be open now');
  };
  
  // Fetch vehicles with maintenance needs
  const { data: apkExpiringVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/apk-expiring'],
  });

  const { data: warrantyExpiringVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/warranty-expiring'],
  });

  // Fetch reservations for the current month to check for conflicts
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  const { data: monthReservations = [] } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations/range', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');
      const response = await fetch(`/api/reservations/range?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reservations');
      }
      return response.json();
    },
  });

  // Fetch scheduled maintenance blocks (reservations with type maintenance_block)
  const { data: maintenanceBlocks = [] } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
    select: (reservations: Reservation[]) => 
      reservations.filter(r => r.type === 'maintenance_block')
  });

  // Create maintenance events from vehicle data and scheduled maintenance
  const maintenanceEvents: MaintenanceEvent[] = [
    ...apkExpiringVehicles.map(vehicle => ({
      id: vehicle.id,
      vehicleId: vehicle.id,
      vehicle,
      type: 'apk_due' as const,
      date: vehicle.apkDate || '',
      title: 'APK Inspection Due',
      description: `APK inspection required for ${vehicle.brand} ${vehicle.model}`,
      needsSpareVehicle: true,
      currentReservations: monthReservations.filter(r => r.vehicleId === vehicle.id)
    })),
    ...warrantyExpiringVehicles.map(vehicle => ({
      id: vehicle.id + 10000, // Avoid ID conflicts
      vehicleId: vehicle.id,
      vehicle,
      type: 'warranty_expiring' as const,
      date: vehicle.warrantyEndDate || '',
      title: 'Warranty Expiring',
      description: `Warranty expires for ${vehicle.brand} ${vehicle.model}`,
      needsSpareVehicle: false
    })),
    ...maintenanceBlocks.map(reservation => ({
      id: reservation.id + 20000, // Avoid ID conflicts
      vehicleId: reservation.vehicleId,
      vehicle: reservation.vehicle!,
      type: 'scheduled_maintenance' as const,
      date: reservation.startDate,
      title: 'Scheduled Maintenance',
      description: reservation.notes || `Scheduled maintenance for ${reservation.vehicle?.brand} ${reservation.vehicle?.model}`,
      needsSpareVehicle: false
    }))
  ];

  // Filter events for current month and next 2 months (3 month view)
  const threeMonthsOut = addMonths(currentDate, 2);
  const currentMonthEvents = maintenanceEvents.filter(event => {
    if (!event.date) return false;
    const eventDate = new Date(event.date);
    const isCurrentMonth = isSameMonth(eventDate, currentDate);
    // Also include events if they're within the next 3 months for better planning
    const isWithinThreeMonths = eventDate >= startOfMonth(currentDate) && eventDate <= endOfMonth(threeMonthsOut);
    return isCurrentMonth;
  });
  
  // Get all upcoming events (within next 6 months) for the list view
  const sixMonthsOut = addMonths(new Date(), 6);
  const upcomingEvents = maintenanceEvents.filter(event => {
    if (!event.date) return false;
    const eventDate = new Date(event.date);
    const now = new Date();
    return eventDate >= now && eventDate <= sixMonthsOut;
  });

  // Get calendar days (weekdays only - Monday to Friday)
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEndWeek = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: monthStartWeek, end: monthEndWeek });
  // Filter to only show weekdays (Monday = 1, Friday = 5)
  const calendarDays = allDays.filter(day => {
    const dayOfWeek = day.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday only
  });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return currentMonthEvents.filter(event => {
      if (!event.date) return false;
      return isSameDay(new Date(event.date), day);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Calendar</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsScheduleDialogOpen(true)}
            data-testid="button-schedule-maintenance"
          >
            <Plus className="mr-2 h-4 w-4" />
            Schedule Maintenance
          </Button>
          <div className="text-sm text-gray-600">
            {currentMonthEvents.length} events this month • {upcomingEvents.length} upcoming
          </div>
        </div>
      </div>

      {/* Main Content Grid - Calendar and Upcoming List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(currentDate, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar Grid */}
              <div className="grid grid-cols-5 gap-1 mb-4">
                {/* Day headers */}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {calendarDays.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 min-h-[120px] border border-gray-200 ${
                        isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                      } ${isToday ? 'bg-blue-50' : ''}`}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      } ${isToday ? 'text-blue-600' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      
                      {/* Events for this day */}
                      <div className="space-y-1">
                        {dayEvents.map(event => {
                          // Check if this is a maintenance block (scheduled maintenance)
                          const isMaintenanceBlock = event.type === 'scheduled_maintenance';
                          
                          if (isMaintenanceBlock) {
                            // For maintenance blocks, make them clickable to edit
                            return (
                              <div
                                key={`${event.id}-${event.type}`}
                                className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getEventTypeStyle(event.type)}`}
                                data-testid={`event-${event.id}-${event.type}`}
                                onClick={async () => {
                                  // Get the actual reservation data by finding it in the reservations
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
                              >
                                <div className="flex items-center gap-1">
                                  {getEventIcon(event.type)}
                                  <span className="truncate">{formatLicensePlate(event.vehicle.licensePlate)}</span>
                                </div>
                                <div className="truncate">{event.title}</div>
                                {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                                  <Badge className="bg-orange-500 text-white text-xs mt-1">
                                    Spare needed
                                  </Badge>
                                )}
                              </div>
                            );
                          } else {
                            // For other events (APK, warranty), keep the original link behavior
                            return (
                              <Link key={`${event.id}-${event.type}`} href={`/vehicles/${event.vehicleId}`}>
                                <div
                                  className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getEventTypeStyle(event.type)}`}
                                  data-testid={`event-${event.id}-${event.type}`}
                                >
                                  <div className="flex items-center gap-1">
                                    {getEventIcon(event.type)}
                                    <span className="truncate">{formatLicensePlate(event.vehicle.licensePlate)}</span>
                                  </div>
                                  <div className="truncate">{event.title}</div>
                                  {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                                    <Badge className="bg-orange-500 text-white text-xs mt-1">
                                      Spare needed
                                    </Badge>
                                  )}
                                </div>
                              </Link>
                            );
                          }
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Maintenance List - Right Side */}
        <div className="lg:col-span-1">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">No maintenance events scheduled in the next 6 months.</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {upcomingEvents
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(event => (
                      <div key={`${event.id}-${event.type}`} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-start gap-2 mb-2">
                          {getEventIcon(event.type)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {event.vehicle.brand} {event.vehicle.model}
                            </div>
                            <div className="text-xs text-gray-500">
                              ({formatLicensePlate(event.vehicle.licensePlate)})
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Due: {format(new Date(event.date), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge className={`${getEventTypeStyle(event.type)} text-xs`}>
                            {event.title}
                          </Badge>
                          {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              Spare needed
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setIsScheduleDialogOpen(true)}
                            data-testid={`button-schedule-${event.vehicleId}`}
                          >
                            Schedule
                          </Button>
                          <Link href={`/vehicles/${event.vehicleId}`}>
                            <Button variant="outline" size="sm" className="text-xs h-7" data-testid={`button-view-vehicle-${event.vehicleId}`}>
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Maintenance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {upcomingEvents.filter(e => e.type === 'apk_due').length}
                </div>
                <div className="text-sm text-gray-600">APK Due (6 months)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {upcomingEvents.filter(e => e.type === 'warranty_expiring').length}
                </div>
                <div className="text-sm text-gray-600">Warranties Expiring</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {upcomingEvents.filter(e => e.needsSpareVehicle && e.currentReservations && e.currentReservations.length > 0).length}
                </div>
                <div className="text-sm text-gray-600">Spare Vehicles Needed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {upcomingEvents.length}
                </div>
                <div className="text-sm text-gray-600">Total Upcoming</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* All Maintenance Reservations List */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              All Scheduled Maintenance
            </CardTitle>
            <CardDescription>
              Complete list of all maintenance reservations and service appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaintenanceReservationsList 
              onEditReservation={handleEditMaintenance}
            />
          </CardContent>
        </Card>
      </div>

      {/* Schedule Maintenance Dialog */}
      <ScheduleMaintenanceDialog
        open={isScheduleDialogOpen}
        onOpenChange={(open) => {
          setIsScheduleDialogOpen(open);
          if (!open) {
            setEditingReservation(null); // Clear editing state when dialog closes
          }
        }}
        editingReservation={editingReservation}
        onSuccess={() => {
          // Refresh the calendar data
          setCurrentDate(new Date(currentDate)); // Force re-render
          setEditingReservation(null); // Clear editing state
        }}
      />

      {/* New Simple Edit Dialog */}
      <MaintenanceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        reservation={selectedReservation}
      />
    </div>
  );
}

// Component to display all maintenance reservations
function MaintenanceReservationsList({ onEditReservation }: { onEditReservation: (reservation: Reservation) => void }) {
  // Fetch all reservations and filter for maintenance blocks
  const { data: allReservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['/api/reservations'],
  });

  // Filter for maintenance blocks only
  const maintenanceReservations = allReservations.filter(r => r.type === 'maintenance_block');

  // Sort by date (newest first)
  const sortedReservations = maintenanceReservations.sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading maintenance reservations...</span>
        </div>
      </div>
    );
  }

  if (maintenanceReservations.length === 0) {
    return (
      <div className="text-center py-8">
        <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No maintenance scheduled</h3>
        <p className="text-gray-500">No maintenance appointments have been scheduled yet.</p>
      </div>
    );
  }

  // Extract maintenance type from notes
  const getMaintenanceType = (notes: string) => {
    if (!notes) return 'maintenance';
    const match = notes.match(/^([^:]+):/);
    return match ? match[1] : 'maintenance';
  };

  // Get maintenance description from notes
  const getMaintenanceDescription = (notes: string) => {
    if (!notes) return '';
    const match = notes.match(/^[^:]+:\s*(.+?)(\n|$)/);
    return match ? match[1] : notes.split('\n')[0];
  };

  // Get icon for maintenance type
  const getMaintenanceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'breakdown':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'apk_inspection':
        return <Clock className="w-4 h-4 text-green-500" />;
      case 'tire_replacement':
        return <Car className="w-4 h-4 text-orange-500" />;
      default:
        return <Wrench className="w-4 h-4 text-blue-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {sortedReservations.map((reservation) => {
        const maintenanceType = getMaintenanceType(reservation.notes || '');
        const description = getMaintenanceDescription(reservation.notes || '');
        
        return (
          <div
            key={reservation.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getMaintenanceIcon(maintenanceType)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">
                      {reservation.vehicle?.brand} {reservation.vehicle?.model}
                    </h4>
                    <span className="text-sm text-gray-500">
                      ({formatLicensePlate(reservation.vehicle?.licensePlate || '')})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(new Date(reservation.startDate), 'MMM d, yyyy')}
                        {reservation.endDate && reservation.endDate !== reservation.startDate && (
                          <span> - {format(new Date(reservation.endDate), 'MMM d, yyyy')}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium capitalize">{maintenanceType.replace('_', ' ')}</span>
                    </div>
                  </div>
                  
                  {description && (
                    <p className="text-sm text-gray-700 mb-2">{description}</p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getStatusColor(reservation.status)}`}>
                      {reservation.status}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Scheduled {format(new Date(reservation.createdAt || ''), 'MMM d, yyyy')}
                    </span>
                    {reservation.createdBy && (
                      <span className="text-xs text-gray-500">
                        by {reservation.createdBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEditReservation(reservation)}
                >
                  Edit
                </Button>
                <Link href={`/vehicles/${reservation.vehicleId}`}>
                  <Button variant="outline" size="sm">
                    View Vehicle
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}