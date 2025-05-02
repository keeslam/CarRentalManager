import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { getDaysUntil, getUrgencyColorClass } from "@/lib/date-utils";
import { Vehicle, Expense, Document, Reservation } from "@shared/schema";

interface VehicleDetailsProps {
  vehicleId: number;
}

export function VehicleDetails({ vehicleId }: VehicleDetailsProps) {
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  
  // Fetch vehicle details
  const { data: vehicle, isLoading: isLoadingVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
  });
  
  // Fetch vehicle expenses
  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: [`/api/expenses/vehicle/${vehicleId}`],
  });
  
  // Fetch vehicle documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: [`/api/documents/vehicle/${vehicleId}`],
  });
  
  // Fetch vehicle reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/vehicle/${vehicleId}`],
  });
  
  // Calculate days until APK expiration
  const daysUntilApk = vehicle?.apkDate ? getDaysUntil(vehicle.apkDate) : 0;
  const apkUrgencyClass = getUrgencyColorClass(daysUntilApk);
  
  // Calculate days until warranty expiration
  const daysUntilWarranty = vehicle?.warrantyDate ? getDaysUntil(vehicle.warrantyDate) : 0;
  const warrantyUrgencyClass = getUrgencyColorClass(daysUntilWarranty);
  
  // Calculate total expenses
  const totalExpenses = expenses?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
  
  // Group expenses by category
  const expensesByCategory = expenses?.reduce((grouped, expense) => {
    const category = expense.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(expense);
    return grouped;
  }, {} as Record<string, Expense[]>) || {};
  
  // Calculate total amount by category
  const totalByCategory = Object.entries(expensesByCategory).map(([category, expenses]) => ({
    category,
    amount: expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  })).sort((a, b) => b.amount - a.amount);
  
  if (isLoadingVehicle) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  
  if (!vehicle) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Vehicle not found</h2>
        <p className="mb-4 text-gray-600">The vehicle you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/vehicles")}>Back to Vehicles</Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-lg font-medium text-gray-600">{vehicle.licensePlate}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/vehicles/${vehicleId}/edit`}>
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil mr-2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Edit
            </Button>
          </Link>
          <Link href={`/reservations/add?vehicleId=${vehicleId}`}>
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
      
      {/* Vehicle Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Vehicle Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{vehicle.vehicleType || "N/A"}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">APK Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-semibold">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "N/A"}</p>
              {vehicle.apkDate && (
                <Badge className={apkUrgencyClass}>
                  {daysUntilApk} days
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Warranty Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-semibold">{vehicle.warrantyDate ? formatDate(vehicle.warrantyDate) : "N/A"}</p>
              {vehicle.warrantyDate && (
                <Badge className={warrantyUrgencyClass}>
                  {daysUntilWarranty} days
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-4xl">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>
        
        {/* General Information Tab */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
              <CardDescription>General information about this vehicle</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Brand</h3>
                <p className="text-base">{vehicle.brand}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Model</h3>
                <p className="text-base">{vehicle.model}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">License Plate</h3>
                <p className="text-base">{vehicle.licensePlate}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Vehicle Type</h3>
                <p className="text-base">{vehicle.vehicleType || "N/A"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Chassis Number</h3>
                <p className="text-base">{vehicle.chassisNumber || "N/A"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Fuel Type</h3>
                <p className="text-base">{vehicle.fuel || "N/A"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Euro Zone</h3>
                <p className="text-base">{vehicle.euroZone || "N/A"}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Added On</h3>
                <p className="text-base">{formatDate(vehicle.createdAt?.toString() || "")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Expense History</CardTitle>
                <CardDescription>All expenses related to this vehicle</CardDescription>
                <div className="flex justify-end">
                  <Link href={`/expenses/add?vehicleId=${vehicleId}`}>
                    <Button size="sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                        <line x1="12" x2="12" y1="5" y2="19" />
                        <line x1="5" x2="19" y1="12" y2="12" />
                      </svg>
                      Add Expense
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingExpenses ? (
                  <div className="flex justify-center p-6">
                    <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : expenses?.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No expenses recorded for this vehicle
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses?.map((expense) => (
                      <div key={expense.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <div className="flex items-center mt-1">
                              <Badge variant="outline">{expense.category}</Badge>
                              <span className="text-sm text-gray-500 ml-2">{formatDate(expense.date)}</span>
                            </div>
                          </div>
                          <p className="text-lg font-semibold">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Expense Summary</CardTitle>
                <CardDescription>Total expenses by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
                  <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
                </div>
                
                <div className="space-y-3">
                  {isLoadingExpenses ? (
                    <div className="flex justify-center p-6">
                      <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : totalByCategory.length === 0 ? (
                    <div className="text-center py-2 text-gray-500">
                      No expense data available
                    </div>
                  ) : (
                    totalByCategory.map(({ category, amount }) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm">{category}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Vehicle Documents</CardTitle>
                  <CardDescription>All documents related to this vehicle</CardDescription>
                </div>
                <Link href={`/documents/upload?vehicleId=${vehicleId}`}>
                  <Button size="sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload mr-2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    Upload Document
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDocuments ? (
                <div className="flex justify-center p-6">
                  <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : documents?.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No documents uploaded for this vehicle
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {documents?.map((document) => (
                    <Card key={document.id} className="overflow-hidden">
                      <div className="bg-gray-100 p-6 flex items-center justify-center">
                        <DocumentIcon type={document.contentType} />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium mb-1 truncate" title={document.fileName}>{document.fileName}</h3>
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                          <Badge variant="outline" className="mr-2">{document.documentType}</Badge>
                          <span>{formatDate(document.uploadDate?.toString() || "")}</span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <a 
                            href={`/api/documents/download/${document.id}`} 
                            className="text-primary-600 hover:text-primary-800 text-sm"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                          <button className="text-red-600 hover:text-red-800 text-sm">
                            Delete
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                  <CardDescription>All reservations for this vehicle</CardDescription>
                </div>
                <Link href={`/reservations/add?vehicleId=${vehicleId}`}>
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
                  No reservations for this vehicle
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
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
                            <div className="text-sm text-gray-900">{reservation.customer?.name}</div>
                            <div className="text-xs text-gray-500">{reservation.customer?.phone}</div>
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
        
        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>APK and warranty information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">APK Inspection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Current APK Valid Until</p>
                      <p className="text-lg font-medium">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Days Remaining</p>
                      <div className="flex items-center">
                        <p className="text-lg font-medium mr-2">{daysUntilApk}</p>
                        {vehicle.apkDate && <Badge className={apkUrgencyClass}>{daysUntilApk <= 30 ? "Action needed soon" : "OK"}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button size="sm" variant={daysUntilApk <= 30 ? "default" : "outline"}>
                      Schedule APK Inspection
                    </Button>
                  </div>
                </div>
                
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Warranty Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Warranty Valid Until</p>
                      <p className="text-lg font-medium">{vehicle.warrantyDate ? formatDate(vehicle.warrantyDate) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Days Remaining</p>
                      <div className="flex items-center">
                        <p className="text-lg font-medium mr-2">{daysUntilWarranty}</p>
                        {vehicle.warrantyDate && <Badge className={warrantyUrgencyClass}>{daysUntilWarranty <= 30 ? "Expiring soon" : "Active"}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button size="sm" variant="outline">
                      Update Warranty Information
                    </Button>
                  </div>
                </div>
              </div>
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
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function DocumentIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-gray-600">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  } else if (type === 'application/pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text text-gray-600">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    );
  } else {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file text-gray-600">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
}
