import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { formatDate, formatCurrency, formatPhoneNumber } from "@/lib/format-utils";
import { Customer, Reservation } from "@shared/schema";

interface CustomerDetailsProps {
  customerId: number;
}

export function CustomerDetails({ customerId }: CustomerDetailsProps) {
  const [_, navigate] = useLocation();
  
  // Fetch customer details
  const { data: customer, isLoading: isLoadingCustomer } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
  });
  
  // Fetch customer reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/customer/${customerId}`],
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
      <div className="flex mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/customers">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M5 12h14M5 12l4-4M5 12l4 4"/>
            </svg>
            Back to Customers
          </Link>
        </Button>
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-gray-600">Customer since {formatDate(customer.createdAt?.toString() || "")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/customers/${customerId}/edit`}>
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil mr-2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Edit
            </Button>
          </Link>
          <Link href={`/reservations/add?customerId=${customerId}`}>
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
          </Link>
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
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
              <div>
                <h3 className="text-lg font-medium mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                    <p className="text-base">{customer.status || "Not provided"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Status Date</h4>
                    <p className="text-base">{customer.statusDate ? formatDate(customer.statusDate) : "Not provided"}</p>
                  </div>
                </div>
                
                {customer.notes && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Notes</h4>
                    <p className="text-base">{customer.notes}</p>
                  </div>
                )}
              </div>
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
                <Link href={`/reservations/add?customerId=${customerId}`}>
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
                </Link>
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
                              <div className="text-sm font-medium text-gray-900">{reservation.vehicle?.licensePlate}</div>
                              <div className="ml-2 text-xs text-gray-500">{reservation.vehicle?.brand} {reservation.vehicle?.model}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <span>{formatDate(reservation.startDate)}</span> - 
                              <span> {formatDate(reservation.endDate)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={reservation.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(reservation.totalPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/reservations/${reservation.id}`}>
                              <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-800">
                                View
                              </Button>
                            </Link>
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
    </div>
  );
}

// Helper components
function StatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return <Badge className="bg-success-50 text-success-600 hover:bg-success-100">{status}</Badge>;
    case "pending":
      return <Badge className="bg-warning-50 text-warning-600 hover:bg-warning-100">{status}</Badge>;
    case "cancelled":
      return <Badge className="bg-danger-50 text-danger-600 hover:bg-danger-100">{status}</Badge>;
    case "completed":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
