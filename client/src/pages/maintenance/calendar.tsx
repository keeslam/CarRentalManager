import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Car, Wrench, AlertTriangle, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Vehicle, Reservation } from "@shared/schema";
import { formatLicensePlate } from "@/lib/format-utils";

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
  });

  // Create maintenance events from vehicle data
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
    }))
  ];

  // Filter events for current month and add vehicles currently in service
  const currentMonthEvents = maintenanceEvents.filter(event => {
    if (!event.date) return false;
    const eventDate = new Date(event.date);
    return isSameMonth(eventDate, currentDate);
  });

  // Get calendar days
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEndWeek = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: monthStartWeek, end: monthEndWeek });

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
          <Link href="/vehicles/add">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Maintenance
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar Navigation */}
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
          <div className="grid grid-cols-7 gap-1 mb-4">
            {/* Day headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
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
                    {dayEvents.map(event => (
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {currentMonthEvents.filter(e => e.type === 'apk_due').length}
                </div>
                <div className="text-sm text-gray-600">APK Due This Month</div>
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
                  {currentMonthEvents.filter(e => e.type === 'warranty_expiring').length}
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
                  {currentMonthEvents.filter(e => e.needsSpareVehicle && e.currentReservations && e.currentReservations.length > 0).length}
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
                  {currentMonthEvents.length}
                </div>
                <div className="text-sm text-gray-600">Total Events</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Maintenance List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Maintenance This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {currentMonthEvents.length === 0 ? (
            <p className="text-gray-500">No maintenance events scheduled for this month.</p>
          ) : (
            <div className="space-y-3">
              {currentMonthEvents
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(event => (
                  <div key={`${event.id}-${event.type}`} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getEventIcon(event.type)}
                      <div>
                        <div className="font-medium">
                          {event.vehicle.brand} {event.vehicle.model} ({formatLicensePlate(event.vehicle.licensePlate)})
                        </div>
                        <div className="text-sm text-gray-600">{event.description}</div>
                        <div className="text-sm text-gray-500">Due: {format(new Date(event.date), 'PPP')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.needsSpareVehicle && event.currentReservations && event.currentReservations.length > 0 && (
                        <Badge className="bg-orange-100 text-orange-800">
                          Spare vehicle needed
                        </Badge>
                      )}
                      <Badge className={getEventTypeStyle(event.type)}>
                        {event.title}
                      </Badge>
                      <Link href={`/vehicles/${event.vehicleId}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-vehicle-${event.vehicleId}`}>
                          View Vehicle
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
  );
}