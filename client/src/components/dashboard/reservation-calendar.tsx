import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
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
  getDay
} from "date-fns";
import { Vehicle, Reservation } from "@shared/schema";
import { displayLicensePlate } from "@/lib/utils";

// Days of the week abbreviations
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ReservationCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

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
        <Link href="/reservations/calendar">
          <Button variant="link" className="text-primary-600 hover:text-primary-700 text-sm font-medium h-8 px-0">
            Full Calendar
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4">
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="ghost" size="icon" onClick={navigatePrevious}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Button>
          <h4 className="text-base font-medium">{dateRanges.rangeText}</h4>
          <Button variant="ghost" size="icon" onClick={navigateNext}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </Button>
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
                  const dayReservations = reservations?.filter(res => 
                    (isSameDay(day, parseISO(res.startDate)) || isSameDay(day, parseISO(res.endDate)))
                  ) || [];
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[85px] p-2 ${isCurrentMonth ? '' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-medium ${isToday ? 'bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                          {format(day, "d")}
                        </span>
                        {dayReservations.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {dayReservations.length}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Show up to 3 reservations */}
                      <div className="space-y-1">
                        {dayReservations && dayReservations.slice(0, 3).map(res => {
                          const isPickupDay = isSameDay(day, parseISO(res.startDate));
                          const isReturnDay = isSameDay(day, parseISO(res.endDate));
                          
                          return (
                            <div 
                              key={res.id}
                              className={`px-1 py-0.5 text-xs truncate ${getReservationStyle(res.status, isPickupDay, isReturnDay)}`}
                              title={`${displayLicensePlate(res.vehicle?.licensePlate || '')} - ${res.customer?.name || 'Reserved'}`}
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
                        
                        {dayReservations && dayReservations.length > 3 && (
                          <div className="text-xs text-gray-500">
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
