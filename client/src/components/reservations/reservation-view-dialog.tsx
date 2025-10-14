import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { Reservation, Vehicle, Customer, Driver } from "@shared/schema";
import { differenceInDays, parseISO } from "date-fns";
import { Wrench, Car, ArrowRightLeft, Trash2, Edit, FileText, Upload } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UploadContractButton } from "@/components/documents/contract-upload-button";
import { SpareVehicleDialog } from "@/components/reservations/spare-vehicle-dialog";
import { ServiceVehicleDialog } from "@/components/reservations/service-vehicle-dialog";
import { ReturnFromServiceDialog } from "@/components/reservations/return-from-service-dialog";
import { ExpenseAddDialog } from "@/components/expenses/expense-add-dialog";
import { CustomerViewDialog } from "@/components/customers/customer-view-dialog";
import { VehicleViewDialog } from "@/components/vehicles/vehicle-view-dialog";
import { ReservationDocumentsDialog } from "@/components/reservations/reservation-documents-dialog";

interface ReservationViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: number | null;
  onEdit?: (reservationId: number) => void;
}

export function ReservationViewDialog({ 
  open, 
  onOpenChange, 
  reservationId,
  onEdit 
}: ReservationViewDialogProps) {
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isSpareDialogOpen, setIsSpareDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [viewVehicleId, setViewVehicleId] = useState<number | null>(null);
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch reservation details
  const { data: reservation, isLoading, error } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${reservationId}`],
    enabled: !!reservationId && open,
  });
  
  // Delete reservation mutation
  const deleteReservationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/reservations/${reservationId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete reservation');
      }
      return true;
    },
    onSuccess: async () => {
      // Use comprehensive cache invalidation for reservations
      invalidateRelatedQueries('reservations', {
        id: reservationId!,
        vehicleId: reservation?.vehicleId || undefined,
        customerId: reservation?.customerId || undefined
      });
      
      toast({
        title: "Reservation deleted",
        description: "The reservation has been successfully deleted",
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Fetch vehicle and customer details if reservation is loaded
  const { data: vehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${reservation?.vehicleId}`],
    enabled: !!reservation?.vehicleId && open,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${reservation?.customerId}`],
    enabled: !!reservation?.customerId && open,
  });

  // Fetch driver details if there's a driverId
  const { data: driver } = useQuery<Driver>({
    queryKey: [`/api/drivers/${reservation?.driverId}`],
    enabled: !!reservation?.driverId && open,
  });

  // For maintenance blocks, fetch active rentals for the vehicle to find the customer
  const { data: vehicleReservations } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/vehicle/${reservation?.vehicleId}`],
    enabled: !!reservation?.vehicleId && reservation?.type === 'maintenance_block' && open,
  });

  // Find active open-ended rental for this vehicle (for maintenance blocks)
  const activeRentalCustomerId = (() => {
    if (reservation?.type !== 'maintenance_block' || !vehicleReservations) return null;
    
    const activeRental = vehicleReservations.find(
      r => r.type === 'standard' && 
      (r.status === 'confirmed' || r.status === 'pending') && 
      !r.endDate // Open-ended rental
    );
    
    return activeRental?.customerId || null;
  })();

  // Fetch the customer from active rental (for maintenance blocks)
  const { data: rentalCustomer } = useQuery<Customer>({
    queryKey: [`/api/customers/${activeRentalCustomerId}`],
    enabled: !!activeRentalCustomerId && open,
  });

  // Use rental customer for maintenance blocks if available, otherwise use direct customer
  const displayCustomer = reservation?.type === 'maintenance_block' && rentalCustomer ? rentalCustomer : customer;

  // Fetch active replacement reservation if this is an original reservation
  const { data: activeReplacement } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${reservationId}/active-replacement`],
    enabled: !!reservation && reservation.type === 'standard' && open,
  });

  // Fetch original reservation if this is a replacement
  const { data: originalReservation } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${reservation?.replacementForReservationId}`],
    enabled: !!reservation?.replacementForReservationId && open,
  });

  // Calculate rental duration
  const rentalDuration = (() => {
    if (!reservation?.startDate || !reservation?.endDate) return 0;
    return differenceInDays(
      parseISO(reservation.endDate),
      parseISO(reservation.startDate)
    ) + 1; // Include both start and end days
  })();

  // Get status badge style
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Get reservation type badge style and text
  const getReservationTypeInfo = (type: string) => {
    switch (type) {
      case "replacement":
        return {
          text: "Replacement Vehicle",
          className: "bg-orange-100 text-orange-800 border-orange-200",
          icon: <ArrowRightLeft className="w-3 h-3" />
        };
      case "maintenance_block":
        return {
          text: "Maintenance Block",
          className: "bg-purple-100 text-purple-800 border-purple-200",
          icon: <Wrench className="w-3 h-3" />
        };
      default:
        return null;
    }
  };

  if (!reservationId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-reservation-view">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
            <p className="text-gray-500">Reservation #{reservationId}</p>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error || !reservation ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-red-800">Error</h3>
              <p className="text-red-600">Failed to load reservation details. {(error as Error)?.message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status and basic info */}
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="flex gap-2 mt-1">
                    <Badge className={`${getStatusStyle(reservation.status)}`}>
                      {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                    </Badge>
                    {reservation.type && reservation.type !== 'standard' && (() => {
                      const typeInfo = getReservationTypeInfo(reservation.type);
                      return typeInfo ? (
                        <Badge className={`flex items-center gap-1 ${typeInfo.className}`} data-testid={`badge-${reservation.type}`}>
                          {typeInfo.icon}
                          {typeInfo.text}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Rental Period</h3>
                  <p className="text-base mt-1">
                    {formatDate(reservation.startDate)} - {reservation.endDate ? formatDate(reservation.endDate) : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {rentalDuration} day{rentalDuration !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Total Price</h3>
                  <p className="text-base font-medium mt-1">
                    {reservation.totalPrice ? formatCurrency(Number(reservation.totalPrice)) : 'N/A'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Vehicle details */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Vehicle</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  {vehicle ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm font-semibold">
                            {formatLicensePlate(vehicle.licensePlate)}
                          </span>
                          {vehicle.brand} {vehicle.model}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {vehicle.vehicleType || 'Unknown type'} • {vehicle.fuel || 'Unknown fuel'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {vehicle.apkDate && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 font-medium">
                              APK Expiry: {formatDate(vehicle.apkDate)}
                            </Badge>
                          )}
                          {vehicle.departureMileage && (
                            <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200">
                              Departure Mileage: {vehicle.departureMileage.toLocaleString()} km
                            </Badge>
                          )}
                          {vehicle.maintenanceStatus && vehicle.maintenanceStatus !== 'ok' && (
                            <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 font-medium">
                              <Wrench className="w-3 h-3 mr-1" />
                              {vehicle.maintenanceStatus === 'needs_service' ? 'Needs Service' : 'In Service'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 sm:mt-0"
                        onClick={() => {
                          setViewVehicleId(vehicle.id);
                          setIsVehicleDialogOpen(true);
                        }}
                        data-testid="button-view-vehicle"
                      >
                        View Vehicle
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-500">Vehicle information unavailable</p>
                  )}
                </div>
              </div>

              {/* Customer details */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Customer
                  {reservation.type === 'maintenance_block' && displayCustomer && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(from active rental)</span>
                  )}
                </h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  {displayCustomer ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          {displayCustomer.debtorNumber && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              {displayCustomer.debtorNumber}
                            </span>
                          )}
                          <span>{displayCustomer.name}</span>
                          {displayCustomer.companyName && (
                            <span className="text-gray-500 text-sm font-normal">
                              ({displayCustomer.companyName})
                            </span>
                          )}
                        </h4>
                        
                        <div className="mt-2 grid grid-cols-1 gap-1">
                          {/* Contact information */}
                          {(displayCustomer.phone || displayCustomer.email) && (
                            <div className="flex flex-col text-sm">
                              {displayCustomer.phone && (
                                <div className="flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                  </svg>
                                  <span>{displayCustomer.phone}</span>
                                </div>
                              )}
                              {displayCustomer.email && (
                                <div className="flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                  </svg>
                                  <span>{displayCustomer.email}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Address information */}
                          {(displayCustomer.address || displayCustomer.city || displayCustomer.postalCode || displayCustomer.country) && (
                            <div className="flex items-start gap-1 text-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mt-0.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              <span>
                                {displayCustomer.address && <span>{displayCustomer.address}</span>}
                                {displayCustomer.address && (displayCustomer.postalCode || displayCustomer.city) && <span>, </span>}
                                {displayCustomer.postalCode && <span>{displayCustomer.postalCode} </span>}
                                {displayCustomer.city && <span>{displayCustomer.city}</span>}
                                {(displayCustomer.address || displayCustomer.postalCode || displayCustomer.city) && displayCustomer.country && <span>, </span>}
                                {displayCustomer.country && <span>{displayCustomer.country}</span>}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <CustomerViewDialog customerId={displayCustomer.id}>
                        <Button variant="ghost" size="sm" className="mt-2 sm:mt-0" data-testid="button-view-customer">
                          View Customer
                        </Button>
                      </CustomerViewDialog>
                    </div>
                  ) : (
                    <p className="text-gray-500">No customer assigned to this reservation</p>
                  )}
                </div>
              </div>

              {/* Driver details */}
              {driver && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Driver</h3>
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                    <div>
                      <h4 className="font-medium text-blue-900 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {driver.displayName}
                        {driver.isPrimaryDriver && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">Primary</Badge>
                        )}
                      </h4>
                      
                      <div className="mt-2 grid grid-cols-1 gap-1">
                        {/* Contact information */}
                        {(driver.phone || driver.email) && (
                          <div className="flex flex-col text-sm text-blue-800">
                            {driver.phone && (
                              <div className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                </svg>
                                <span>{driver.phone}</span>
                              </div>
                            )}
                            {driver.email && (
                              <div className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                  <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                <span>{driver.email}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* License information */}
                        {driver.driverLicenseNumber && (
                          <div className="flex items-center gap-1 text-sm text-blue-800 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                              <rect width="20" height="14" x="2" y="5" rx="2"/>
                              <line x1="2" x2="22" y1="10" y2="10"/>
                            </svg>
                            <span>License: {driver.driverLicenseNumber}</span>
                            {driver.licenseExpiry && (
                              <span className="text-blue-600">(Exp: {formatDate(driver.licenseExpiry)})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contract and Document Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  {reservation.type === 'maintenance_block' ? 'Expenses & Documentation' : 'Documents'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {reservation.type !== 'maintenance_block' && (
                    <>
                      <Link href={`/documents/contract/${reservationId}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="mr-2 h-4 w-4" />
                          View Contract
                        </Button>
                      </Link>
                      {reservation.vehicleId && (
                        <UploadContractButton 
                          vehicleId={reservation.vehicleId} 
                          reservationId={reservation.id}
                        />
                      )}
                    </>
                  )}
                  {reservation.type === 'maintenance_block' && reservation.vehicleId && (
                    <ExpenseAddDialog 
                      vehicleId={reservation.vehicleId}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${reservation.vehicleId}`] });
                      }}
                    >
                      <Button variant="outline" size="sm">
                        <FileText className="mr-2 h-4 w-4" />
                        Add Expense
                      </Button>
                    </ExpenseAddDialog>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (reservation.vehicleId) {
                        setViewVehicleId(reservation.vehicleId);
                        setIsDocumentsDialogOpen(true);
                      }
                    }}
                    data-testid="button-view-vehicle-documents"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {reservation.type === 'maintenance_block' ? 'Upload Damage Photos' : 'All Vehicle Documents'}
                  </Button>
                </div>
              </div>

              {/* Spare Vehicle Management */}
              {reservation.type === 'standard' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Vehicle Service</h3>
                  <div className="space-y-2">
                    {!activeReplacement && vehicle?.maintenanceStatus === 'ok' && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        size="sm"
                        onClick={() => setIsServiceDialogOpen(true)}
                        data-testid="button-mark-for-service"
                      >
                        <Wrench className="mr-2 h-4 w-4" />
                        Mark Vehicle for Service
                      </Button>
                    )}
                    
                    {(vehicle?.maintenanceStatus === 'in_service' || vehicle?.maintenanceStatus === 'needs_service') && !activeReplacement && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        size="sm"
                        onClick={() => setIsSpareDialogOpen(true)}
                        data-testid="button-assign-spare"
                      >
                        <Car className="mr-2 h-4 w-4" />
                        Assign Spare Vehicle
                      </Button>
                    )}
                    
                    {activeReplacement && (
                      <div className="space-y-2">
                        <div className="p-3 border border-orange-200 bg-orange-50 rounded-md">
                          <p className="text-sm font-medium text-orange-800">Spare vehicle assigned</p>
                          <p className="text-xs text-orange-600 mt-1">
                            Vehicle is currently being serviced
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start" 
                          size="sm"
                          onClick={() => setIsReturnDialogOpen(true)}
                          data-testid="button-return-from-service"
                        >
                          <Car className="mr-2 h-4 w-4" />
                          Return from Service
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => onEdit?.(reservationId)}
              data-testid="button-edit-reservation"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-reservation">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete reservation #{reservationId}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteReservationMutation.mutate()}
                    disabled={deleteReservationMutation.isPending}
                  >
                    {deleteReservationMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service-related dialogs */}
      <ServiceVehicleDialog
        open={isServiceDialogOpen}
        onOpenChange={setIsServiceDialogOpen}
        reservationId={reservationId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${reservation?.vehicleId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/reservations/${reservationId}`] });
        }}
      />

      <SpareVehicleDialog
        open={isSpareDialogOpen}
        onOpenChange={setIsSpareDialogOpen}
        originalReservation={reservation}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/reservations/${reservationId}/active-replacement`] });
          queryClient.invalidateQueries({ queryKey: [`/api/reservations`] });
        }}
      />

      <ReturnFromServiceDialog
        open={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        originalReservation={reservation}
        replacementReservation={activeReplacement}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${reservation?.vehicleId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/reservations/${reservationId}/active-replacement`] });
          queryClient.invalidateQueries({ queryKey: [`/api/reservations`] });
        }}
      />

      {/* Vehicle View Dialog */}
      <VehicleViewDialog
        open={isVehicleDialogOpen}
        onOpenChange={setIsVehicleDialogOpen}
        vehicleId={viewVehicleId}
      />

      {/* Reservation Documents Dialog */}
      <ReservationDocumentsDialog
        open={isDocumentsDialogOpen}
        onOpenChange={setIsDocumentsDialogOpen}
        reservationId={reservationId}
        vehicleId={viewVehicleId}
      />
    </>
  );
}