import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInDays } from "date-fns";
import { 
  AlertTriangle, 
  Shield, 
  Wrench, 
  Car, 
  Calendar,
  Search,
  Eye,
  Edit,
  Plus,
  Clock
} from "lucide-react";
import { Vehicle, Reservation } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatLicensePlate } from "@/lib/format-utils";
import { MaintenanceEditDialog } from "@/components/maintenance/maintenance-edit-dialog";
import { VehicleViewDialog } from "@/components/vehicles/vehicle-view-dialog";

interface MaintenanceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to calculate days until a date
const getDaysUntil = (dateString: string): number => {
  if (!dateString) return 999;
  try {
    const targetDate = parseISO(dateString);
    const today = new Date();
    return differenceInDays(targetDate, today);
  } catch {
    return 999;
  }
};

// Use the shared license plate formatter

// Helper function to get urgency color
const getUrgencyColor = (days: number): string => {
  if (days < 0) return "bg-red-500 text-white"; // Overdue
  if (days <= 14) return "bg-orange-500 text-white"; // Very urgent
  if (days <= 30) return "bg-yellow-500 text-black"; // Urgent
  if (days <= 60) return "bg-blue-500 text-white"; // Soon
  return "bg-gray-200 text-gray-700"; // Future
};

// Helper function to get urgency text
const getUrgencyText = (days: number): string => {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days remaining`;
};

export function MaintenanceListDialog({ open, onOpenChange }: MaintenanceListDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  // State for maintenance edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMaintenanceReservation, setSelectedMaintenanceReservation] = useState<Reservation | null>(null);
  
  // State for vehicle view dialog
  const [vehicleViewDialogOpen, setVehicleViewDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  // Fetch APK expiring vehicles
  const { data: apkVehicles = [], isLoading: apkLoading, error: apkError } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/apk-expiring"],
    enabled: open,
  });

  // Fetch warranty expiring vehicles
  const { data: warrantyVehicles = [], isLoading: warrantyLoading, error: warrantyError } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/warranty-expiring"],
    enabled: open,
  });

  // Fetch scheduled maintenance (maintenance block reservations)
  const { data: allReservations = [], isLoading: reservationsLoading, error: reservationsError } = useQuery<
    (Reservation & {
      vehicle?: Vehicle;
      customer?: { id: number; name: string; firstName?: string; lastName?: string };
    })[]
  >({
    queryKey: ["/api/reservations"],
    enabled: open,
  });

  // Fetch spare vehicle assignments needed
  const { data: spareAssignments = [], isLoading: spareLoading, error: spareError } = useQuery<Reservation[]>({
    queryKey: ["/api/placeholder-reservations/needing-assignment"],
    enabled: open,
  });

  // Filter maintenance reservations
  const maintenanceReservations = allReservations.filter(
    (reservation) => reservation.type === "maintenance_block"
  );

  // Create unified search filter
  const filterItems = (items: any[], searchFields: string[]) => {
    if (!searchTerm) return items;
    
    const search = searchTerm.toLowerCase();
    return items.filter((item) =>
      searchFields.some((field) => {
        const value = field.split('.').reduce((obj, key) => obj?.[key], item);
        return value?.toString().toLowerCase().includes(search);
      })
    );
  };

  // Apply search filters
  const filteredApkVehicles = filterItems(apkVehicles, ['licensePlate', 'brand', 'model']);
  const filteredWarrantyVehicles = filterItems(warrantyVehicles, ['licensePlate', 'brand', 'model']);
  const filteredMaintenanceReservations = filterItems(maintenanceReservations, [
    'vehicle.licensePlate', 
    'vehicle.brand', 
    'vehicle.model', 
    'notes'
  ]);
  const filteredSpareAssignments = filterItems(spareAssignments, [
    'customer.name', 
    'customer.firstName', 
    'customer.lastName'
  ]);

  // Calculate totals
  const totalItems = 
    filteredApkVehicles.length + 
    filteredWarrantyVehicles.length + 
    filteredMaintenanceReservations.length + 
    filteredSpareAssignments.length;

  const isLoading = apkLoading || warrantyLoading || reservationsLoading || spareLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Overview
          </DialogTitle>
          <DialogDescription>
            Comprehensive view of all maintenance-related items and upcoming service requirements
          </DialogDescription>
        </DialogHeader>

        {/* Search and Summary */}
        <div className="flex flex-col sm:flex-row gap-4 pb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search vehicles, license plates, customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-maintenance-search"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="font-medium">Total Items: {totalItems}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="apk" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="apk" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                APK ({filteredApkVehicles.length})
              </TabsTrigger>
              <TabsTrigger value="warranty" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Warranty ({filteredWarrantyVehicles.length})
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduled ({filteredMaintenanceReservations.length})
              </TabsTrigger>
              <TabsTrigger value="spares" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Spares ({filteredSpareAssignments.length})
              </TabsTrigger>
            </TabsList>

            {/* APK Expiring Tab */}
            <TabsContent value="apk" className="flex-1 overflow-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    APK Inspections Due
                  </CardTitle>
                  <CardDescription>
                    Vehicles with APK inspections expiring within 60 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : apkError ? (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        Failed to load APK expiring vehicles. Please try again.
                      </AlertDescription>
                    </Alert>
                  ) : filteredApkVehicles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "No APK expiring vehicles match your search" : "No APK inspections due soon"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>License Plate</TableHead>
                          <TableHead>APK Date</TableHead>
                          <TableHead>Urgency</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredApkVehicles
                          .map(vehicle => ({ 
                            ...vehicle, 
                            daysUntil: getDaysUntil(vehicle.apkDate || '') 
                          }))
                          .sort((a, b) => a.daysUntil - b.daysUntil)
                          .map((vehicle) => (
                            <TableRow key={vehicle.id} data-testid={`row-apk-${vehicle.id}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{vehicle.brand}</div>
                                  <div className="text-sm text-gray-500">{vehicle.model}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {formatLicensePlate(vehicle.licensePlate)}
                                </code>
                              </TableCell>
                              <TableCell>
                                {vehicle.apkDate ? format(parseISO(vehicle.apkDate), "dd MMM yyyy") : "Not set"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getUrgencyColor(vehicle.daysUntil)}>
                                  {getUrgencyText(vehicle.daysUntil)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => {
                                      setSelectedVehicleId(vehicle.id);
                                      setVehicleViewDialogOpen(true);
                                    }}
                                    data-testid={`button-view-${vehicle.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Warranty Expiring Tab */}
            <TabsContent value="warranty" className="flex-1 overflow-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Warranties Expiring
                  </CardTitle>
                  <CardDescription>
                    Vehicles with warranties expiring within 60 days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : warrantyError ? (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        Failed to load warranty expiring vehicles. Please try again.
                      </AlertDescription>
                    </Alert>
                  ) : filteredWarrantyVehicles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "No warranty expiring vehicles match your search" : "No warranties expiring soon"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>License Plate</TableHead>
                          <TableHead>Warranty End Date</TableHead>
                          <TableHead>Urgency</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWarrantyVehicles
                          .map(vehicle => ({ 
                            ...vehicle, 
                            daysUntil: getDaysUntil(vehicle.warrantyEndDate || '') 
                          }))
                          .sort((a, b) => a.daysUntil - b.daysUntil)
                          .map((vehicle) => (
                            <TableRow key={vehicle.id} data-testid={`row-warranty-${vehicle.id}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{vehicle.brand}</div>
                                  <div className="text-sm text-gray-500">{vehicle.model}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {formatLicensePlate(vehicle.licensePlate)}
                                </code>
                              </TableCell>
                              <TableCell>
                                {vehicle.warrantyEndDate ? format(parseISO(vehicle.warrantyEndDate), "dd MMM yyyy") : "Not set"}
                              </TableCell>
                              <TableCell>
                                <Badge className={getUrgencyColor(vehicle.daysUntil)}>
                                  {getUrgencyText(vehicle.daysUntil)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => {
                                      setSelectedVehicleId(vehicle.id);
                                      setVehicleViewDialogOpen(true);
                                    }}
                                    data-testid={`button-view-${vehicle.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scheduled Maintenance Tab */}
            <TabsContent value="scheduled" className="flex-1 overflow-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-500" />
                    Scheduled Maintenance
                  </CardTitle>
                  <CardDescription>
                    Active maintenance blocks and scheduled service appointments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : reservationsError ? (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        Failed to load scheduled maintenance. Please try again.
                      </AlertDescription>
                    </Alert>
                  ) : filteredMaintenanceReservations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "No scheduled maintenance matches your search" : "No scheduled maintenance"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>License Plate</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMaintenanceReservations
                          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                          .map((reservation) => (
                            <TableRow key={reservation.id} data-testid={`row-maintenance-${reservation.id}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{reservation.vehicle?.brand}</div>
                                  <div className="text-sm text-gray-500">{reservation.vehicle?.model}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {formatLicensePlate(reservation.vehicle?.licensePlate || '')}
                                </code>
                              </TableCell>
                              <TableCell>
                                {format(parseISO(reservation.startDate), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell>
                                {reservation.endDate ? format(parseISO(reservation.endDate), "dd MMM yyyy") : "TBD"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={reservation.status === "completed" ? "default" : "secondary"}>
                                  {reservation.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <div className="truncate text-sm">
                                  {reservation.notes?.split('\n')[0] || 'No description'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => {
                                      setSelectedMaintenanceReservation(reservation);
                                      setEditDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-${reservation.id}`}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  {reservation.vehicle && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => {
                                        setSelectedVehicleId(reservation.vehicle.id);
                                        setVehicleViewDialogOpen(true);
                                      }}
                                      data-testid={`button-view-vehicle-${reservation.vehicle.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Vehicle
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Spare Vehicle Assignments Tab */}
            <TabsContent value="spares" className="flex-1 overflow-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-purple-500" />
                    Spare Vehicle Assignments
                  </CardTitle>
                  <CardDescription>
                    Customers needing spare vehicle assignments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : spareError ? (
                    <Alert className="bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-700">
                        Failed to load spare assignments. Please try again.
                      </AlertDescription>
                    </Alert>
                  ) : filteredSpareAssignments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {searchTerm ? "No spare assignments match your search" : "No pending spare vehicle assignments"}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Days Until</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSpareAssignments
                          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                          .map((assignment) => {
                            const daysUntilStart = getDaysUntil(assignment.startDate);
                            const customerName = assignment.customer?.name || 
                              `${assignment.customer?.firstName || ''} ${assignment.customer?.lastName || ''}`.trim() ||
                              `Customer #${assignment.customerId}`;
                            
                            return (
                              <TableRow key={assignment.id} data-testid={`row-spare-${assignment.id}`}>
                                <TableCell>
                                  <div className="font-medium">{customerName}</div>
                                </TableCell>
                                <TableCell>
                                  {format(parseISO(assignment.startDate), "dd MMM yyyy")}
                                </TableCell>
                                <TableCell>
                                  {assignment.endDate ? format(parseISO(assignment.endDate), "dd MMM yyyy") : "TBD"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    Needs Assignment
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={getUrgencyColor(daysUntilStart)}>
                                    {getUrgencyText(daysUntilStart)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" data-testid={`button-assign-${assignment.id}`}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Assign
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Maintenance Edit Dialog */}
      <MaintenanceEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedMaintenanceReservation(null);
          }
        }}
        reservation={selectedMaintenanceReservation}
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
    </Dialog>
  );
}