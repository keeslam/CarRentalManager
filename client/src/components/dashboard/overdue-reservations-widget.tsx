import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Car, User, Calendar, Phone } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

interface OverdueReservation {
  id: number;
  endDate: string | null;
  startDate: string;
  status: string;
  vehicle?: { make: string; model: string; licensePlate: string };
  customer?: { name: string; phone?: string | null };
}

export function OverdueReservationsWidget() {
  const { data: overdueReservations = [], isLoading } = useQuery<OverdueReservation[]>({
    queryKey: ['/api/reservations/overdue'],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Overdue Rentals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (overdueReservations.length === 0) {
    return null;
  }

  const today = new Date();

  return (
    <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 animate-pulse" />
          Overdue Rentals ({overdueReservations.length})
        </CardTitle>
        <CardDescription className="text-red-600 dark:text-red-400">
          These vehicles should have been returned but customer still has them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueReservations.map((reservation) => {
          const daysOverdue = reservation.endDate 
            ? differenceInDays(today, parseISO(reservation.endDate))
            : 0;
          
          return (
            <div 
              key={reservation.id}
              className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800"
              data-testid={`overdue-reservation-${reservation.id}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {reservation.vehicle?.make} {reservation.vehicle?.model}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {reservation.vehicle?.licensePlate}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{reservation.customer?.name || "Unknown Customer"}</span>
                  {reservation.customer?.phone && (
                    <>
                      <Phone className="h-3 w-3 ml-2" />
                      <a 
                        href={`tel:${reservation.customer.phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {reservation.customer.phone}
                      </a>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Should have returned: {reservation.endDate ? format(parseISO(reservation.endDate), 'MMM d, yyyy') : 'N/A'}
                  </span>
                </div>
              </div>
              
              <Badge 
                variant="destructive" 
                className="shrink-0"
              >
                {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
