import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Vehicle, Reservation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-utils";
import { Bell, Calendar, Car, AlertTriangle } from "lucide-react";
import { formatLicensePlate } from "@/lib/format-utils";
import { Link } from "wouter";

export function NotificationCenter() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const today = new Date();

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Fetch upcoming reservations
  const { data: upcomingReservations = [] } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/upcoming"],
  });

  // Calculate notifications
  const apkExpiringItems = vehicles
    .filter(vehicle => {
      if (!vehicle.apkDate) return false;
      const apkDate = new Date(vehicle.apkDate);
      const daysUntil = differenceInDays(apkDate, today);
      return daysUntil >= 0 && daysUntil <= 60; // 2 months
    })
    .sort((a, b) => {
      if (!a.apkDate || !b.apkDate) return 0;
      return new Date(a.apkDate).getTime() - new Date(b.apkDate).getTime();
    });

  const warrantyExpiringItems = vehicles
    .filter(vehicle => {
      if (!vehicle.warrantyEndDate) return false;
      const warrantyDate = new Date(vehicle.warrantyEndDate);
      const daysUntil = differenceInDays(warrantyDate, today);
      return daysUntil >= 0 && daysUntil <= 60; // 2 months
    })
    .sort((a, b) => {
      if (!a.warrantyEndDate || !b.warrantyEndDate) return 0;
      return new Date(a.warrantyEndDate).getTime() - new Date(b.warrantyEndDate).getTime();
    });

  const upcomingReservationItems = upcomingReservations
    .filter(reservation => {
      const startDate = new Date(reservation.startDate);
      const daysUntil = differenceInDays(startDate, today);
      return daysUntil >= 0 && daysUntil <= 2; // Due in next 2 days
    })
    .sort((a, b) => {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  const totalNotifications = 
    apkExpiringItems.length + 
    warrantyExpiringItems.length + 
    upcomingReservationItems.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalNotifications > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {totalNotifications}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <p className="text-xs text-muted-foreground">
            {totalNotifications === 0 
              ? "No new notifications" 
              : `You have ${totalNotifications} new notification${totalNotifications !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 m-2">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="reservations" className="text-xs">
              Reservations
            </TabsTrigger>
            <TabsTrigger value="apk" className="text-xs">
              APK
            </TabsTrigger>
            <TabsTrigger value="warranty" className="text-xs">
              Warranty
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[320px]">
            <TabsContent value="all" className="m-0">
              {totalNotifications === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center p-4">
                  <Bell className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                  <h3 className="font-medium">All caught up!</h3>
                  <p className="text-sm text-muted-foreground">
                    No vehicles or reservations require immediate attention.
                  </p>
                </div>
              ) : (
                <div>
                  {upcomingReservationItems.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50">
                      <h5 className="text-xs font-medium">Upcoming Reservations</h5>
                    </div>
                  )}
                  {upcomingReservationItems.map(reservation => (
                    <div key={`reservation-${reservation.id}`} onClick={() => setOpen(false)}>
                      <NotificationItem
                        icon={<Calendar className="text-blue-500" />}
                        title={`Reservation #${reservation.id} starts tomorrow`}
                        description={`Reservation for ${vehicles.find(v => v.id === reservation.vehicleId)?.brand || "Unknown"} ${vehicles.find(v => v.id === reservation.vehicleId)?.model || ""} starts on ${formatDate(reservation.startDate)}`}
                        date={reservation.startDate}
                        link={`/reservations/${reservation.id}`}
                      />
                    </div>
                  ))}
                  
                  {apkExpiringItems.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50">
                      <h5 className="text-xs font-medium">APK Expiring</h5>
                    </div>
                  )}
                  {apkExpiringItems.map(vehicle => (
                    <div key={`apk-${vehicle.id}`} onClick={() => setOpen(false)}>
                      <NotificationItem
                        icon={<AlertTriangle className="text-amber-500" />}
                        title={`APK expiring for ${formatLicensePlate(vehicle.licensePlate)}`}
                        description={`APK for ${vehicle.brand} ${vehicle.model} expires on ${formatDate(vehicle.apkDate || "")}`}
                        date={vehicle.apkDate || ""}
                        link={`/vehicles/${vehicle.id}`}
                      />
                    </div>
                  ))}
                  
                  {warrantyExpiringItems.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50">
                      <h5 className="text-xs font-medium">Warranty Expiring</h5>
                    </div>
                  )}
                  {warrantyExpiringItems.map(vehicle => (
                    <div key={`warranty-${vehicle.id}`} onClick={() => setOpen(false)}>
                      <NotificationItem
                        icon={<Car className="text-indigo-500" />}
                        title={`Warranty expiring for ${formatLicensePlate(vehicle.licensePlate)}`}
                        description={`Warranty for ${vehicle.brand} ${vehicle.model} expires on ${formatDate(vehicle.warrantyEndDate || "")}`}
                        date={vehicle.warrantyEndDate || ""}
                        link={`/vehicles/${vehicle.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reservations" className="m-0">
              {upcomingReservationItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center p-4">
                  <Calendar className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                  <h3 className="font-medium">No upcoming reservations</h3>
                  <p className="text-sm text-muted-foreground">
                    No reservations are starting in the next 2 days.
                  </p>
                </div>
              ) : (
                upcomingReservationItems.map(reservation => (
                  <div key={`reservation-tab-${reservation.id}`} onClick={() => setOpen(false)}>
                    <NotificationItem
                      icon={<Calendar className="text-blue-500" />}
                      title={`Reservation #${reservation.id} starts soon`}
                      description={`Reservation for ${vehicles.find(v => v.id === reservation.vehicleId)?.brand || "Unknown"} ${vehicles.find(v => v.id === reservation.vehicleId)?.model || ""} starts on ${formatDate(reservation.startDate)}`}
                      date={reservation.startDate}
                      link={`/reservations/${reservation.id}`}
                    />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="apk" className="m-0">
              {apkExpiringItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center p-4">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                  <h3 className="font-medium">No APK expirations</h3>
                  <p className="text-sm text-muted-foreground">
                    No vehicles have APK inspections expiring in the next 2 months.
                  </p>
                </div>
              ) : (
                apkExpiringItems.map(vehicle => (
                  <div key={`apk-tab-${vehicle.id}`} onClick={() => setOpen(false)}>
                    <NotificationItem
                      icon={<AlertTriangle className="text-amber-500" />}
                      title={`APK expiring for ${formatLicensePlate(vehicle.licensePlate)}`}
                      description={`APK for ${vehicle.brand} ${vehicle.model} expires on ${formatDate(vehicle.apkDate || "")}`}
                      date={vehicle.apkDate || ""}
                      link={`/vehicles/${vehicle.id}`}
                    />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="warranty" className="m-0">
              {warrantyExpiringItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center p-4">
                  <Car className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                  <h3 className="font-medium">No warranty expirations</h3>
                  <p className="text-sm text-muted-foreground">
                    No vehicles have warranties expiring in the next 2 months.
                  </p>
                </div>
              ) : (
                warrantyExpiringItems.map(vehicle => (
                  <div key={`warranty-tab-${vehicle.id}`} onClick={() => setOpen(false)}>
                    <NotificationItem
                      icon={<Car className="text-indigo-500" />}
                      title={`Warranty expiring for ${formatLicensePlate(vehicle.licensePlate)}`}
                      description={`Warranty for ${vehicle.brand} ${vehicle.model} expires on ${formatDate(vehicle.warrantyEndDate || "")}`}
                      date={vehicle.warrantyEndDate || ""}
                      link={`/vehicles/${vehicle.id}`}
                    />
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <div className="flex items-center justify-center p-4 border-t">
          <Button variant="outline" size="sm" asChild>
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  date: string;
  link: string;
}

function NotificationItem({ icon, title, description, date, link }: NotificationItemProps) {
  // Calculate days until date
  const today = new Date();
  const itemDate = new Date(date);
  const daysUntil = differenceInDays(itemDate, today);
  
  let timeText = "";
  if (daysUntil < 0) {
    timeText = `${Math.abs(daysUntil)} days ago`;
  } else if (daysUntil === 0) {
    timeText = "Today";
  } else if (daysUntil === 1) {
    timeText = "Tomorrow";
  } else {
    timeText = `In ${daysUntil} days`;
  }

  return (
    <Link href={link}>
      <div className="p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors">
        <div className="flex">
          <div className="mr-3 mt-0.5">
            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
              {icon}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground font-medium">{timeText}</p>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}