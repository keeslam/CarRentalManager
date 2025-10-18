import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Vehicle, Reservation, CustomNotification } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-utils";
// Import each component individually to ensure they're properly loaded
import { Bell } from "lucide-react";
import { Calendar } from "lucide-react";
import { Car } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Info } from "lucide-react";
import { ClipboardCheck } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { UserPlus } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { formatLicensePlate } from "@/lib/format-utils";
import { Link, useLocation } from "wouter";

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
  
  // Fetch custom notifications (unread only)
  const { data: customNotifications = [] } = useQuery<CustomNotification[]>({
    queryKey: ["/api/custom-notifications/unread"],
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
    upcomingReservationItems.length + 
    customNotifications.length;

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
          <TabsList className="grid grid-cols-5 m-2">
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
            <TabsTrigger value="custom" className="text-xs">
              Custom
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
                        link={`/reservations/calendar?openReservation=${reservation.id}`}
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
                        link={`/vehicles/${vehicle.id}?openApkDialog=true`}
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
                  
                  {customNotifications.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50">
                      <h5 className="text-xs font-medium">Custom Notifications</h5>
                    </div>
                  )}
                  {customNotifications.map(notification => {
                    // Determine icon based on notification.icon field
                    let iconComponent;
                    switch (notification.icon) {
                      case 'Info':
                        iconComponent = <Info className="text-blue-500" />;
                        break;
                      case 'AlertTriangle':
                        iconComponent = <AlertTriangle className="text-amber-500" />;
                        break;
                      case 'Calendar':
                        iconComponent = <Calendar className="text-green-500" />;
                        break;
                      case 'Car':
                        iconComponent = <Car className="text-indigo-500" />;
                        break;
                      case 'ClipboardCheck':
                        iconComponent = <ClipboardCheck className="text-purple-500" />;
                        break;
                      default:
                        iconComponent = <Bell className="text-slate-500" />;
                    }
                    
                    return (
                      <div key={`custom-all-${notification.id}`}>
                        <NotificationItem
                          icon={iconComponent}
                          title={notification.title}
                          description={notification.description}
                          date={notification.date}
                          link={notification.link || '/notifications/custom'}
                          id={notification.id}
                          isCustom={true}
                          onClick={() => setOpen(false)}
                        />
                      </div>
                    );
                  })}
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
                      link={`/reservations?openReservation=${reservation.id}`}
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
                      link={`/vehicles/${vehicle.id}?openApkDialog=true`}
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
            
            <TabsContent value="custom" className="m-0">
              {customNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center p-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                  <h3 className="font-medium">No custom notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    No custom notifications have been created.
                  </p>
                </div>
              ) : (
                customNotifications.map(notification => {
                  // Determine icon based on notification.icon field
                  let iconComponent;
                  switch (notification.icon) {
                    case 'Info':
                      iconComponent = <Info className="text-blue-500" />;
                      break;
                    case 'AlertTriangle':
                      iconComponent = <AlertTriangle className="text-amber-500" />;
                      break;
                    case 'Calendar':
                      iconComponent = <Calendar className="text-green-500" />;
                      break;
                    case 'Car':
                      iconComponent = <Car className="text-indigo-500" />;
                      break;
                    case 'ClipboardCheck':
                      iconComponent = <ClipboardCheck className="text-purple-500" />;
                      break;
                    default:
                      iconComponent = <Bell className="text-slate-500" />;
                  }
                  
                  return (
                    <div key={`custom-notification-${notification.id}`}>
                      <NotificationItem
                        icon={iconComponent}
                        title={notification.title}
                        description={notification.description}
                        date={notification.date}
                        link={notification.link || '/notifications/custom'}
                        id={notification.id}
                        isCustom={true}
                        onClick={() => setOpen(false)}
                      />
                    </div>
                  );
                })
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <div className="flex items-center justify-center p-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} asChild>
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
  id?: number; // Optional ID for custom notifications
  isCustom?: boolean; // Flag to identify custom notifications
  onClick?: () => void; // Optional click handler to close the popover
}

function NotificationItem({ 
  icon, 
  title, 
  description, 
  date, 
  link, 
  id, 
  isCustom = false,
  onClick
}: NotificationItemProps) {
  const navigate = useLocation()[1];
  const queryClient = useQueryClient();
  
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

  // Check if this is a portal access request
  const isPortalRequest = title === "Portal Access Request";
  const isExistingCustomer = description.includes("✅ Customer exists");
  const isNewCustomer = description.includes("⚠️ New customer");

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // No longer automatically mark notification as read when clicked
    // Users will now manually mark notifications as read/unread
    
    // If onClick callback is provided, execute it (closes the popover)
    if (onClick) {
      onClick();
    }
    
    // Parse the link to separate path and query parameters
    const [path, queryString] = link.split('?');
    
    // If there are query parameters, store them in sessionStorage
    // so the destination page can read them
    if (queryString) {
      const params = new URLSearchParams(queryString);
      const openReservation = params.get('openReservation');
      const openApkDialog = params.get('openApkDialog');
      
      if (openReservation) {
        sessionStorage.setItem('openReservation', openReservation);
      }
      if (openApkDialog) {
        sessionStorage.setItem('openApkDialog', openApkDialog);
      }
    }
    
    // Navigate to the path
    navigate(path);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
    navigate(link);
  };

  return (
    <div className="cursor-pointer" onClick={handleClick}>
      <div className={`p-4 border-b hover:bg-gray-50 transition-colors ${isPortalRequest ? 'bg-blue-50/50' : ''}`}>
        <div className="flex">
          <div className="mr-3 mt-0.5">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${isPortalRequest ? 'bg-blue-100' : 'bg-gray-100'}`}>
              {icon}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground font-medium">{timeText}</p>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{description}</p>
            {isPortalRequest && (
              <Button 
                size="sm" 
                onClick={handleActionClick}
                className="w-full mt-2"
                variant={isExistingCustomer ? "default" : "secondary"}
                data-testid="button-portal-action"
              >
                {isExistingCustomer ? (
                  <>
                    <UserPlus className="mr-2 h-3 w-3" />
                    Enable Portal Access
                  </>
                ) : isNewCustomer ? (
                  <>
                    <UserPlus className="mr-2 h-3 w-3" />
                    Add New Customer
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-3 w-3" />
                    Take Action
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}