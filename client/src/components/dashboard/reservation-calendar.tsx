import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
  differenceInDays,
  getDay,
  formatISO
} from "date-fns";
import { Vehicle, Reservation, Customer } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { formatLicensePlate } from "@/lib/format-utils";
import { formatReservationStatus } from "@/lib/format-utils";
import { PlusCircle, Edit, Eye, Calendar, User, Car, CreditCard, Clock, MapPin } from "lucide-react";
import { ReservationQuickStatusButton } from "@/components/reservations/reservation-quick-status-button";

// Days of the week abbreviations
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ReservationCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [_, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Safe date parsing and formatting functions to prevent errors
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
  
  // Fetch reservations for the current month view
  const startDate = format(dateRanges.start, "yyyy-MM-dd");
  const endDate = format(dateRanges.end, "yyyy-MM-dd");
  
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations/range", startDate, endDate],
    queryFn: async () => {
      const url = `/api/reservations/range?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Reservation range fetch error:", errorText);
        throw new Error(errorText);
      }
      return response.json();
    }
  });
  
  // Navigation functions
  const navigatePrevious = () => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  };
  
  const navigateNext = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Function to get reservation style
  const getReservationStyle = (status: string, isStart: boolean, isEnd: boolean) => {
    let bgColor, textColor;
    
    switch (status.toLowerCase()) {
      case "confirmed":
        bgColor = "bg-green-100";
        textColor = "text-green-800";
        break;
      case "pending":
        bgColor = "bg-amber-100";
        textColor = "text-amber-800";
        break;
      case "cancelled":
        bgColor = "bg-gray-100";
        textColor = "text-gray-500";
        break;
      case "completed":
        bgColor = "bg-blue-100";
        textColor = "text-blue-800";
        break;
      default:
        bgColor = "bg-gray-100";
        textColor = "text-gray-800";
    }
    
    const roundedLeft = isStart ? "rounded-l-md" : "";
    const roundedRight = isEnd ? "rounded-r-md" : "";
    
    return `${bgColor} ${textColor} border ${roundedLeft} ${roundedRight}`;
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
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="px-4 py-3 border-b flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-800">Reservation Calendar</CardTitle>
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="outline"
            className="h-8 text-xs"
            onClick={() => navigate('/reservations/add')}
          >
            <PlusCircle className="mr-1 h-3 w-3" />
            New Reservation
          </Button>
          <Link href="/reservations/calendar">
            <Button variant="link" className="text-primary-600 hover:text-primary-700 text-sm font-medium h-8 px-0">
              Full Calendar
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={navigatePrevious}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs mx-1">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateNext}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </Button>
          </div>
          <h4 className="text-base font-medium">{dateRanges.rangeText}</h4>
        </div>
        
        {/* Calendar Header */}
        <div className="grid grid-cols-7 mb-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="border rounded-md overflow-hidden">
          {isLoadingReservations ? (
            <div className="flex justify-center p-8">
              <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            calendarGrid.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 divide-x border-b last:border-b-0">
                {week.map((day, dayIndex) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  
                  // Only get reservations starting or ending on this day
                  const dayReservations = reservations?.filter(res => {
                    const startDate = res.startDate ? parseISO(res.startDate) : null;
                    const endDate = res.endDate ? parseISO(res.endDate) : null;
                    return (
                      (startDate && isSameDay(day, startDate)) || 
                      (endDate && isSameDay(day, endDate))
                    );
                  }) || [];
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[85px] p-2 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''} relative group`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                          {safeFormat(day, "d", "?")}
                        </span>
                        {dayReservations.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {dayReservations.length}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Add reservation button - positioned at top center */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute top-1 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Button
                                onClick={() => navigate(`/reservations/add?date=${safeFormat(day, 'yyyy-MM-dd', '1970-01-01')}`)}
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 bg-primary/10 hover:bg-primary/20 rounded-full border border-primary/20 shadow-sm p-0"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Add reservation</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Show up to 3 reservations */}
                      <div className="space-y-1">
                        {dayReservations && dayReservations.slice(0, 3).map(res => {
                          const startDate = safeParseDateISO(res.startDate);
                          const endDate = safeParseDateISO(res.endDate);
                          const isPickupDay = startDate ? isSameDay(day, startDate) : false;
                          const isReturnDay = endDate ? isSameDay(day, endDate) : false;
                          const rentalDuration = startDate && endDate ? 
                            differenceInDays(endDate, startDate) + 1 : 1;
                          
                          return (
                            <HoverCard key={res.id} openDelay={300} closeDelay={200}>
                              <HoverCardTrigger asChild>
                                <div 
                                  className={`px-1 py-0.5 text-xs truncate ${getReservationStyle(res.status, isPickupDay, isReturnDay)} group/res relative cursor-pointer hover:brightness-95`}
                                  onClick={() => navigate(`/reservations/${res.id}`)}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="truncate">
                                      {res.placeholderSpare ? 
                                        <span className="text-orange-700 font-medium">TBD</span> : 
                                        formatLicensePlate(res.vehicle?.licensePlate || '')
                                      }
                                      {isPickupDay && 
                                        <span className="ml-1 inline-block bg-green-200 text-green-800 text-[8px] px-1 rounded-sm">out</span>
                                      }
                                      {isReturnDay && 
                                        <span className="ml-1 inline-block bg-blue-200 text-blue-800 text-[8px] px-1 rounded-sm">in</span>
                                      }
                                    </div>
                                    
                                    {/* Edit button - only visible on hover */}
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent triggering the parent onClick
                                        navigate(`/reservations/edit/${res.id}`);
                                      }}
                                      size="icon"
                                      variant="ghost"
                                      className="h-3 w-3 opacity-0 group-hover/res:opacity-100 transition-opacity p-0"
                                    >
                                      <Edit className="h-2 w-2" />
                                    </Button>
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
                                    <h4 className="font-medium">Reservation Details</h4>
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
                                  
                                  {/* Vehicle details */}
                                  <div className="px-3 py-1 flex items-start space-x-2">
                                    <Car className="h-4 w-4 text-gray-500 mt-0.5" />
                                    <div>
                                      <div className="font-medium text-sm">{res.vehicle?.brand} {res.vehicle?.model}</div>
                                      <div className="text-xs text-gray-600">{formatLicensePlate(res.vehicle?.licensePlate || '')}</div>
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
                                          <span className="text-gray-500">Start:</span> {res.startDate ? safeFormat(safeParseDateISO(res.startDate), 'MMM d, yyyy', 'Invalid date') : 'Not set'}
                                        </div>
                                        <div>
                                          <span className="text-gray-500">End:</span> {res.endDate ? safeFormat(safeParseDateISO(res.endDate), 'MMM d, yyyy', 'Invalid date') : 'Open-ended'}
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
                                      {(res as any).totalPrice ? (
                                        <div>
                                          <span className="text-gray-500">Price:</span> {formatCurrency((res as any).totalPrice)}
                                        </div>
                                      ) : null}
                                      {(res as any).startMileage ? (
                                        <div>
                                          <span className="text-gray-500">Start Mileage:</span> {(res as any).startMileage} km
                                        </div>
                                      ) : null}
                                      {(res as any).departureMileage ? (
                                        <div>
                                          <span className="text-gray-500">Return Mileage:</span> {(res as any).departureMileage} km
                                        </div>
                                      ) : null}
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
                                      onClick={() => navigate(`/reservations/${res.id}`)}
                                    >
                                      <Eye className="mr-1 h-3 w-3" />
                                      View
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => navigate(`/reservations/edit/${res.id}`)}
                                    >
                                      <Edit className="mr-1 h-3 w-3" />
                                      Edit
                                    </Button>
                                    <ReservationQuickStatusButton 
                                      reservation={res}
                                      size="sm"
                                      variant="outline"
                                      withText={true}
                                      className="h-8 text-xs"
                                      onStatusChanged={() => {
                                        // Force refresh of reservations data
                                        queryClient.invalidateQueries({ 
                                          queryKey: ["/api/reservations/range", startDate, endDate]
                                        });
                                      }}
                                    />
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                        
                        {dayReservations && dayReservations.length > 3 && (
                          <div 
                            className="text-xs text-gray-500 cursor-pointer hover:underline"
                            onClick={() => navigate(`/reservations/calendar?date=${safeFormat(day, 'yyyy-MM-dd', '1970-01-01')}`)}
                          >
                            +{dayReservations.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
