import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
import { CustomerEditDialog } from "./customer-edit-dialog";
import { DriverDialog } from "./driver-dialog";
import { formatDate, formatCurrency, formatPhoneNumber, formatReservationStatus } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";
import { Customer, Reservation, Driver } from "@shared/schema";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
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
import { useToast } from "@/hooks/use-toast";

interface CustomerDetailsProps {
  customerId: number;
  inDialog?: boolean;
  onClose?: () => void;
}

export function CustomerDetails({ customerId, inDialog = false, onClose }: CustomerDetailsProps) {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [viewReservationId, setViewReservationId] = useState<number | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editReservationId, setEditReservationId] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Define query keys for easier reference
  const customerQueryKey = [`/api/customers/${customerId}`];
  const customerReservationsQueryKey = [`/api/reservations/customer/${customerId}`];
  const customerDriversQueryKey = [`/api/customers/${customerId}/drivers`];
  
  // Fetch customer details with proper caching
  const { 
    data: customer, 
    isLoading: isLoadingCustomer
  } = useQuery<Customer>({
    queryKey: customerQueryKey
  });
  
  // Fetch customer reservations with proper caching
  const { 
    data: reservations, 
    isLoading: isLoadingReservations
  } = useQuery<Reservation[]>({
    queryKey: customerReservationsQueryKey
  });

  // Fetch customer drivers with proper caching
  const { 
    data: drivers, 
    isLoading: isLoadingDrivers
  } = useQuery<Driver[]>({
    queryKey: customerDriversQueryKey
  });
  
  // Handle edit reservation
  const handleEditReservation = (reservationId: number) => {
    console.log('CustomerDetails handleEditReservation called with:', reservationId);
    setEditReservationId(reservationId);
    setIsEditDialogOpen(true);
    setIsViewDialogOpen(false);
  };
  
  // Delete reservation mutation
  const deleteReservationMutation = useMutation({
    mutationFn: async (reservationId: number) => {
      const response = await apiRequest('DELETE', `/api/reservations/${reservationId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete reservation');
      }
      return await response.json();
    },
    onSuccess: async () => {
      // Use the unified invalidation system to update all related data
      await invalidateRelatedQueries('reservations', { customerId });
      
      toast({
        title: "Reservation deleted",
        description: "The reservation has been successfully deleted.",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reservation",
        variant: "destructive"
      });
    }
  });
  
  if (isLoadingCustomer) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  
  if (!customer) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Customer not found</h2>
        <p className="mb-4 text-gray-600">The customer you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/customers")}>Back to Customers</Button>
      </div>
    );
  }
  
  // Calculate some statistics
  const completedReservations = reservations?.filter(r => r.status.toLowerCase() === "completed") || [];
  const activeReservations = reservations?.filter(r => ["confirmed", "pending"].includes(r.status.toLowerCase())) || [];
  const totalSpent = completedReservations.reduce((sum, res) => sum + Number(res.totalPrice || 0), 0);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-gray-600">Customer since {formatDate(customer.createdAt?.toString() || "")}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => inDialog && onClose ? onClose() : navigate("/customers")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            {inDialog ? "Back" : "Back to Customers"}
          </Button>
          <CustomerEditDialog 
            customerId={customerId}
            onSuccess={() => {
              // Refresh customer data after successful edit
              queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
            }}
          />
          <ReservationAddDialog initialCustomerId={customerId.toString()}>
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-plus mr-2">
                <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <line x1="19" x2="19" y1="16" y2="22" />
                <line x1="16" x2="22" y1="19" y2="19" />
              </svg>
              New Reservation
            </Button>
          </ReservationAddDialog>
        </div>
      </div>
      
      {/* Customer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeReservations.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{completedReservations.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-3xl">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
        </TabsList>
        
        {/* Personal Info Tab */}
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
              <CardDescription>Personal information and contact details</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Personal Info Section */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Full Name</h4>
                    <p className="text-base">{customer.name}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Debtor Number</h4>
                    <p className="text-base">{customer.debtorNumber || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">First Name</h4>
                    <p className="text-base">{customer.firstName || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Last Name</h4>
                    <p className="text-base">{customer.lastName || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Driver Name</h4>
                    <p className="text-base">{customer.driverName || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Driver License</h4>
                    <p className="text-base">{customer.driverLicenseNumber || "Not provided"}</p>
                  </div>
                </div>
              </div>
              
              {/* Contact Info Section */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Primary Email</h4>
                    <p className="text-base">{customer.email || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Primary Phone</h4>
                    <p className="text-base">{customer.phone ? formatPhoneNumber(customer.phone) : "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email for MOT</h4>
                    <p className="text-base">{customer.emailForMOT || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email for Invoices</h4>
                    <p className="text-base">{customer.emailForInvoices || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">General Email</h4>
                    <p className="text-base">{customer.emailGeneral || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Driver Phone</h4>
                    <p className="text-base">{customer.driverPhone ? formatPhoneNumber(customer.driverPhone) : "Not provided"}</p>
                  </div>
                </div>
              </div>
              
              {/* Address Section */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium mb-3">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Street Name</h4>
                    <p className="text-base">{customer.streetName || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Address</h4>
                    <p className="text-base">{customer.address || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Postal Code</h4>
                    <p className="text-base">{customer.postalCode || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">City</h4>
                    <p className="text-base">{customer.city || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Country</h4>
                    <p className="text-base">{customer.country || "Nederland"}</p>
                  </div>
                </div>
              </div>
              
              {/* Company Information */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium mb-3">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Company Name</h4>
                    <p className="text-base">{customer.companyName || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Contact Person</h4>
                    <p className="text-base">{customer.contactPerson || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Chamber of Commerce Number (KvK)</h4>
                    <p className="text-base">{customer.chamberOfCommerceNumber || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">VAT Number</h4>
                    <p className="text-base">{customer.vatNumber || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">RSIN</h4>
                    <p className="text-base">{customer.rsin || "Not provided"}</p>
                  </div>
                </div>
              </div>
              
              {/* Additional Information */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium mb-3">Additional Information</h3>
                {customer.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Notes</h4>
                    <p className="text-base">{customer.notes}</p>
                  </div>
                )}
              </div>
              
              {/* Tracking Information */}
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium mb-3">Tracking Information</h3>
                
                {/* Status tracking section */}
                <div className="border-b pb-4 mb-4">
                  <h4 className="text-md font-medium mb-2">Status Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                      <p className="text-base">{customer.status || "Not provided"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Status Date</h4>
                      <p className="text-base">{customer.statusDate ? formatDate(customer.statusDate) : "Not provided"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Status Changed By</h4>
                      <p className="text-base">{customer.statusBy || "Not recorded"}</p>
                    </div>
                  </div>
                </div>
                
                {/* Record tracking section */}
                <div>
                  <h4 className="text-md font-medium mb-2">Record Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Created By</h4>
                      <p className="text-base">{customer.createdBy || "Not recorded"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Created At</h4>
                      <p className="text-base">{customer.createdAt ? new Date(customer.createdAt).toLocaleString() : "Not recorded"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Last Updated By</h4>
                      <p className="text-base">{customer.updatedBy || "Not recorded"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Last Updated At</h4>
                      <p className="text-base">{customer.updatedAt ? new Date(customer.updatedAt).toLocaleString() : "Not recorded"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Drivers Tab */}
        <TabsContent value="drivers" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Authorized Drivers</CardTitle>
                  <CardDescription>Manage drivers authorized to rent vehicles for this customer</CardDescription>
                </div>
                <DriverDialog customerId={customerId}>
                  <Button size="sm" data-testid="button-add-driver">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" x2="19" y1="8" y2="14" />
                      <line x1="22" x2="16" y1="11" y2="11" />
                    </svg>
                    Add Driver
                  </Button>
                </DriverDialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDrivers ? (
                <div className="flex justify-center p-6">
                  <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : drivers?.length === 0 ? (
                <div className="text-center py-8" data-testid="text-no-drivers">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-gray-400">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                  <p className="text-gray-500 mb-4">No drivers added yet</p>
                  <p className="text-sm text-gray-400">Add a driver to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          License
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {drivers?.map((driver) => (
                        <tr key={driver.id} data-testid={`row-driver-${driver.id}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2" data-testid={`text-driver-name-${driver.id}`}>
                                  {driver.displayName}
                                  {driver.isPrimaryDriver && (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">Primary</Badge>
                                  )}
                                </div>
                                {driver.firstName || driver.lastName ? (
                                  <div className="text-xs text-gray-500">
                                    {driver.firstName} {driver.lastName}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {driver.email && <div data-testid={`text-driver-email-${driver.id}`}>{driver.email}</div>}
                              {driver.phone && <div className="text-xs text-gray-500" data-testid={`text-driver-phone-${driver.id}`}>{formatPhoneNumber(driver.phone)}</div>}
                              {!driver.email && !driver.phone && <span className="text-gray-400">—</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {driver.driverLicenseNumber ? (
                                <div>
                                  <div data-testid={`text-driver-license-${driver.id}`}>{driver.driverLicenseNumber}</div>
                                  {driver.licenseExpiry && (
                                    <div className="text-xs text-gray-500">Exp: {formatDate(driver.licenseExpiry)}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge 
                              className={driver.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}
                              data-testid={`badge-driver-status-${driver.id}`}
                            >
                              {driver.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <DriverDialog customerId={customerId} driver={driver}>
                                <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-800" data-testid={`button-edit-driver-${driver.id}`}>
                                  Edit
                                </Button>
                              </DriverDialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-800"
                                    data-testid={`button-delete-driver-${driver.id}`}
                                  >
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Driver</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {driver.displayName}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={async () => {
                                        try {
                                          const response = await apiRequest('DELETE', `/api/drivers/${driver.id}`);
                                          if (!response.ok) {
                                            throw new Error('Failed to delete driver');
                                          }
                                          await queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/drivers`] });
                                          toast({
                                            title: "Driver deleted",
                                            description: "The driver has been successfully deleted.",
                                            variant: "default"
                                          });
                                        } catch (error) {
                                          toast({
                                            title: "Error",
                                            description: "Failed to delete driver",
                                            variant: "destructive"
                                          });
                                        }
                                      }}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reservations Tab */}
        <TabsContent value="reservations" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Reservation History</CardTitle>
                  <CardDescription>All reservations for this customer</CardDescription>
                </div>
                <ReservationAddDialog initialCustomerId={customerId.toString()}>
                  <Button size="sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-plus mr-2">
                      <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                      <line x1="19" x2="19" y1="16" y2="22" />
                      <line x1="16" x2="22" y1="19" y2="19" />
                    </svg>
                    New Reservation
                  </Button>
                </ReservationAddDialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingReservations ? (
                <div className="flex justify-center p-6">
                  <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : reservations?.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No reservations for this customer
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vehicle
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reservations?.map((reservation) => (
                        <tr key={reservation.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">{displayLicensePlate(reservation.vehicle?.licensePlate || '')}</div>
                              <div className="ml-2 text-xs text-gray-500">{reservation.vehicle?.brand} {reservation.vehicle?.model}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <span>{formatDate(reservation.startDate)}</span> - 
                              <span> {reservation.endDate ? formatDate(reservation.endDate) : "TBD"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={reservation.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(Number(reservation.totalPrice || 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary-600 hover:text-primary-800"
                                onClick={() => {
                                  setViewReservationId(reservation.id);
                                  setIsViewDialogOpen(true);
                                }}
                                data-testid={`button-view-reservation-${reservation.id}`}
                              >
                                View
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <svg 
                                      xmlns="http://www.w3.org/2000/svg" 
                                      width="16" 
                                      height="16" 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      strokeWidth="2" 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      className="mr-1"
                                    >
                                      <path d="M3 6h18"></path>
                                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                      <line x1="10" y1="11" x2="10" y2="17"></line>
                                      <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Reservation</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this reservation? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => {
                                        deleteReservationMutation.mutate(reservation.id);
                                      }}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {deleteReservationMutation.isPending ? (
                                        <>
                                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Deleting...
                                        </>
                                      ) : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reservation View Dialog */}
      <ReservationViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        reservationId={viewReservationId}
        onEdit={handleEditReservation}
      />
      
      {/* Reservation Edit Dialog */}
      <ReservationEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        reservationId={editReservationId}
        onSuccess={() => {
          setIsEditDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: customerReservationsQueryKey });
        }}
      />
    </div>
  );
}

// Helper components
function StatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">{formatReservationStatus(status)}</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">{formatReservationStatus(status)}</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200">{formatReservationStatus(status)}</Badge>;
    case "completed":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">{formatReservationStatus(status)}</Badge>;
    default:
      return <Badge variant="outline">{formatReservationStatus(status)}</Badge>;
  }
}
