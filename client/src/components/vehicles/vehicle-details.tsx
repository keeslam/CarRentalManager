import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { getDaysUntil, getUrgencyColorClass } from "@/lib/date-utils";
import { Vehicle, Expense, Document, Reservation } from "@shared/schema";
import { InlineDocumentUpload } from "@/components/documents/inline-document-upload";
import { useToast } from "@/hooks/use-toast";

interface VehicleDetailsProps {
  vehicleId: number;
}

export function VehicleDetails({ vehicleId }: VehicleDetailsProps) {
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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
  
  // Group documents by category
  const documentsByCategory = documents?.reduce((grouped, document) => {
    const category = document.documentType;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(document);
    return grouped;
  }, {} as Record<string, Document[]>) || {};
  
  // Fetch vehicle reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/vehicle/${vehicleId}`],
  });
  
  // Calculate days until APK expiration
  const daysUntilApk = vehicle?.apkDate ? getDaysUntil(vehicle.apkDate) : 0;
  const apkUrgencyClass = getUrgencyColorClass(daysUntilApk);
  
  // Calculate days until warranty expiration
  const daysUntilWarranty = vehicle?.warrantyEndDate ? getDaysUntil(vehicle.warrantyEndDate) : 0;
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
          <p className="text-lg font-medium text-gray-600">{formatLicensePlate(vehicle.licensePlate)}</p>
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
              <p className="text-2xl font-semibold">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "N/A"}</p>
              {vehicle.warrantyEndDate && (
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
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle ID</h4>
                    <p className="text-base">{vehicle.id}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">License Plate</h4>
                    <p className="text-base">{formatLicensePlate(vehicle.licensePlate)}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Brand</h4>
                    <p className="text-base">{vehicle.brand}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Model</h4>
                    <p className="text-base">{vehicle.model}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle Type</h4>
                    <p className="text-base">{vehicle.vehicleType || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Chassis Number</h4>
                    <p className="text-base">{vehicle.chassisNumber || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Technical Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Fuel Type</h4>
                    <p className="text-base">{vehicle.fuel || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">AdBlue</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.adBlue} disabled />
                      <span className="text-sm text-gray-500">{vehicle.adBlue ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Euro Zone</h4>
                    <p className="text-base">{vehicle.euroZone || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Euro Zone End Date</h4>
                    <p className="text-base">{vehicle.euroZoneEndDate ? formatDate(vehicle.euroZoneEndDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Tire Size</h4>
                    <p className="text-base">{vehicle.tireSize || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Winter Tires</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.winterTires} disabled />
                      <span className="text-sm text-gray-500">{vehicle.winterTires ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Registration & Maintenance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">APK Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="APK Inspection"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Upload APK
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <p className="text-base">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Warranty End Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Warranty"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Upload warranty
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <p className="text-base">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Registered To Person</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={vehicle.registeredTo === true || vehicle.registeredTo === "true"} disabled />
                      <span className="text-sm text-gray-500">
                        {vehicle.registeredTo === true || vehicle.registeredTo === "true" ? "Yes" : "No"}
                      </span>
                    </div>
                    {(vehicle.registeredTo === true || vehicle.registeredTo === "true") && vehicle.registeredToDate && (
                      <p className="text-xs text-gray-500 mt-1">Last updated: {formatDate(vehicle.registeredToDate)}</p>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Registered To Company</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={vehicle.company === true || vehicle.company === "true"} disabled />
                      <span className="text-sm text-gray-500">
                        {vehicle.company === true || vehicle.company === "true" ? "Yes" : "No"}
                      </span>
                    </div>
                    {(vehicle.company === true || vehicle.company === "true") && vehicle.companyDate && (
                      <p className="text-xs text-gray-500 mt-1">Last updated: {formatDate(vehicle.companyDate)}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Contract & Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Contract Number</h4>
                    <p className="text-base">{vehicle.contractNumber || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Monthly Price</h4>
                    <p className="text-base">{vehicle.monthlyPrice ? formatCurrency(vehicle.monthlyPrice) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Daily Price</h4>
                    <p className="text-base">{vehicle.dailyPrice ? formatCurrency(vehicle.dailyPrice) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Date In</h4>
                    <p className="text-base">{vehicle.dateIn ? formatDate(vehicle.dateIn) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Date Out</h4>
                    <p className="text-base">{vehicle.dateOut ? formatDate(vehicle.dateOut) : "N/A"}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Damage & Safety</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Damage Check</h4>
                    <div className="text-base">
                      {documentsByCategory["Damage Report"]?.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <span>Completed</span>
                        </div>
                      ) : (
                        <span>{vehicle.damageCheck ? "Yes" : "No"}</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Damage Check Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Damage Report"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Add report
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <div>
                      {documentsByCategory["Damage Report"]?.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <span>{formatDate(new Date(documentsByCategory["Damage Report"][0].uploadDate).toISOString().split('T')[0])}</span>
                        </div>
                      ) : (
                        <p className="text-base">{vehicle.damageCheckDate ? formatDate(vehicle.damageCheckDate) : "N/A"}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle Photos</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Vehicle Photos"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Add photos
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <div>
                      {documentsByCategory["Vehicle Photos"]?.length > 0 ? (
                        <div className="text-base">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            <span>Vehicle photo attachments</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {documentsByCategory["Vehicle Photos"].length} document(s)
                          </p>
                        </div>
                      ) : (
                        <p className="text-base">No attachments found</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Roadside Assistance</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.roadsideAssistance} disabled />
                      <span className="text-sm text-gray-500">{vehicle.roadsideAssistance ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">GPS</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.gps} disabled />
                      <span className="text-sm text-gray-500">{vehicle.gps ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">WOK Notification</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.wokNotification} disabled />
                      <span className="text-sm text-gray-500">{vehicle.wokNotification ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-0">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Departure Mileage</h4>
                    <p className="text-base">{vehicle.departureMileage || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Return Mileage</h4>
                    <p className="text-base">{vehicle.returnMileage || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Spare Key</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.spareKey} disabled />
                      <span className="text-sm text-gray-500">{vehicle.spareKey ? "Available" : "Not Available"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Radio Code</h4>
                    <p className="text-base">{vehicle.radioCode || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Seat Covers</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.seatcovers} disabled />
                      <span className="text-sm text-gray-500">{vehicle.seatcovers ? "Installed" : "Not Installed"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Backup Beepers</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.backupbeepers} disabled />
                      <span className="text-sm text-gray-500">{vehicle.backupbeepers ? "Installed" : "Not Installed"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Internal Appointments</h4>
                    <p className="text-base">{vehicle.internalAppointments || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Remarks</h4>
                    <p className="text-base">{vehicle.remarks || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Created By</h4>
                    <p className="text-base">{vehicle.createdBy || "N/A"}</p>
                  </div>
                </div>
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
                <InlineDocumentUpload 
                  vehicleId={vehicleId} 
                  onSuccess={() => {
                    // Refresh the documents list after upload
                    queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Document Categories */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Quick Upload Categories</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId} 
                      preselectedType="APK Inspection"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-blue-500">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 18v-6" />
                          <path d="m9 15 3 3 3-3" />
                        </svg>
                        <span className="block text-sm font-medium">APK Inspection</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Damage Report"
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-red-500">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="block text-sm font-medium">Damage Report</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Vehicle Picture"
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-green-500">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="block text-sm font-medium">Vehicle Picture</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Maintenance Record"
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-purple-500">
                          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                          <line x1="9" x2="15" y1="9" y2="9" />
                          <line x1="9" x2="15" y1="13" y2="13" />
                          <line x1="9" x2="15" y1="17" y2="17" />
                        </svg>
                        <span className="block text-sm font-medium">Maintenance</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                </div>
              </div>
            
              {/* Document List */}
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
                <div className="space-y-6">
                  {/* Document categories */}
                  {Object.entries(documentsByCategory).map(([category, docs]) => (
                    <div key={category} className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">{category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {docs.map((document) => (
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
                              {document.createdBy && (
                                <div className="text-xs text-gray-500 mb-2">
                                  Created by: {document.createdBy}
                                </div>
                              )}
                              <div className="flex justify-between mt-2">
                                <div className="flex space-x-2">
                                  <a 
                                    href={`/api/documents/download/${document.id}`} 
                                    className="text-primary-600 hover:text-primary-800 text-sm"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Download
                                  </a>
                                  <a 
                                    href={`/api/documents/download/${document.id}`} 
                                    className="text-primary-600 hover:text-primary-800 text-sm"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      window.open(`/api/documents/download/${document.id}`, '_blank');
                                      setTimeout(() => { window.print(); }, 1000);
                                    }}
                                  >
                                    Print
                                  </a>
                                </div>
                                <button 
                                  className="text-red-600 hover:text-red-800 text-sm"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to delete the document "${document.fileName}"?`)) {
                                      try {
                                        const response = await fetch(`/api/documents/${document.id}`, {
                                          method: 'DELETE',
                                        });
                                        
                                        if (response.ok) {
                                          // Refresh document list after successful deletion
                                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                                          toast({
                                            title: "Document deleted",
                                            description: "The document has been deleted successfully.",
                                          });
                                        } else {
                                          const errorData = await response.json();
                                          throw new Error(errorData.message || "Failed to delete document");
                                        }
                                      } catch (error) {
                                        console.error("Error deleting document:", error);
                                        toast({
                                          title: "Error",
                                          description: error instanceof Error ? error.message : "Failed to delete document",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
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
                      <p className="text-lg font-medium">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Days Remaining</p>
                      <div className="flex items-center">
                        <p className="text-lg font-medium mr-2">{daysUntilWarranty}</p>
                        {vehicle.warrantyEndDate && <Badge className={warrantyUrgencyClass}>{daysUntilWarranty <= 30 ? "Expiring soon" : "Active"}</Badge>}
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
