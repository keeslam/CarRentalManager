import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { Reservation, Customer, Vehicle } from "@shared/schema";
import { Truck, MapPin, Clock, CheckCircle, Package, Navigation } from "lucide-react";
import { differenceInDays } from "date-fns";

export default function DeliveryDashboard() {
  // Fetch reservations with delivery service
  const { data: reservations = [], isLoading: reservationsLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Filter reservations that have delivery service
  const deliveryReservations = reservations.filter(r => r.deliveryRequired);

  // Categorize by delivery status
  const pendingDeliveries = deliveryReservations.filter(r => 
    !r.deliveryStatus || r.deliveryStatus === 'pending'
  );
  const scheduledDeliveries = deliveryReservations.filter(r => 
    r.deliveryStatus === 'scheduled'
  );
  const enRouteDeliveries = deliveryReservations.filter(r => 
    r.deliveryStatus === 'en_route'
  );
  const completedDeliveries = deliveryReservations.filter(r => 
    r.deliveryStatus === 'delivered' || r.deliveryStatus === 'completed'
  );

  const getCustomerName = (customerId: number) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  const getVehicleInfo = (vehicleId: number) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate})` : 'Unknown';
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" data-testid={`badge-status-pending`}>Pending</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800" data-testid={`badge-status-scheduled`}>Scheduled</Badge>;
      case 'en_route':
        return <Badge className="bg-amber-100 text-amber-800" data-testid={`badge-status-en-route`}>En Route</Badge>;
      case 'delivered':
      case 'completed':
        return <Badge className="bg-green-100 text-green-800" data-testid={`badge-status-completed`}>Delivered</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-unknown`}>Unknown</Badge>;
    }
  };

  const renderDeliveryTable = (deliveries: Reservation[], testIdPrefix: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reservation</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Vehicle</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Delivery Date</TableHead>
          <TableHead>Fee</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-4">
              No deliveries in this category
            </TableCell>
          </TableRow>
        ) : (
          deliveries.map((reservation) => (
            <TableRow key={reservation.id} data-testid={`${testIdPrefix}-row-${reservation.id}`}>
              <TableCell className="font-medium">#{reservation.id}</TableCell>
              <TableCell>{getCustomerName(reservation.customerId)}</TableCell>
              <TableCell>{getVehicleInfo(reservation.vehicleId)}</TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{reservation.deliveryAddress}</div>
                  {reservation.deliveryCity && (
                    <div className="text-muted-foreground">
                      {reservation.deliveryPostalCode} {reservation.deliveryCity}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatDate(reservation.startDate)}</TableCell>
              <TableCell>{reservation.deliveryFee ? formatCurrency(parseFloat(reservation.deliveryFee.toString())) : '-'}</TableCell>
              <TableCell>{getStatusBadge(reservation.deliveryStatus || 'pending')}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" data-testid={`button-view-${reservation.id}`}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Delivery Dashboard</h1>
          <p className="text-muted-foreground">Manage vehicle delivery and pickup services</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-route-optimization">
            <Navigation className="h-4 w-4 mr-2" />
            Route Optimization
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending">{pendingDeliveries.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting schedule</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-scheduled">{scheduledDeliveries.length}</div>
            <p className="text-xs text-muted-foreground">Ready for delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Route</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-enroute">{enRouteDeliveries.length}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed">
              {completedDeliveries.filter(d => {
                const today = new Date();
                const deliveryDate = new Date(d.startDate);
                return differenceInDays(today, deliveryDate) === 0;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Deliveries completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Scheduled ({scheduledDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="enroute" data-testid="tab-enroute">
            En Route ({enRouteDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedDeliveries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Deliveries</CardTitle>
              <CardDescription>Deliveries awaiting scheduling</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDeliveryTable(pendingDeliveries, 'pending')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Deliveries</CardTitle>
              <CardDescription>Deliveries ready to begin</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDeliveryTable(scheduledDeliveries, 'scheduled')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enroute" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>En Route Deliveries</CardTitle>
              <CardDescription>Deliveries currently in progress</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDeliveryTable(enRouteDeliveries, 'enroute')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Deliveries</CardTitle>
              <CardDescription>Successfully delivered vehicles</CardDescription>
            </CardHeader>
            <CardContent>
              {renderDeliveryTable(completedDeliveries, 'completed')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
