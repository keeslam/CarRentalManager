import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { VehicleViewDialog } from "@/components/vehicles/vehicle-view-dialog";
import { VehicleEditDialog } from "@/components/vehicles/vehicle-edit-dialog";
import { VehicleDeleteDialog } from "@/components/vehicles/vehicle-delete-dialog";
import { VehicleAddDialog } from "@/components/vehicles/vehicle-add-dialog";
import { VehicleBulkImportDialog } from "@/components/vehicles/vehicle-bulk-import-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { Vehicle } from "@shared/schema";
import { formatDate, formatLicensePlate } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";
import { isTrueValue } from "@/lib/utils";
import { getDaysUntil } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";

export default function VehiclesIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("default");
  const [vehicleViewDialogOpen, setVehicleViewDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const vehiclesPerPage = 10; // Show 10 vehicles per page
  const queryClient = useQueryClient();
  
  // Debounce search query to prevent excessive filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const { data: vehicles, isLoading, refetch } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Dialog handlers
  const handleViewClick = (vehicleId: number) => {
    setSelectedVehicleId(vehicleId);
    setVehicleViewDialogOpen(true);
  };
  
  // Handle successful operations from dialogs
  const handleDialogSuccess = () => {
    // Refresh the vehicles list after any dialog operation
    queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
  };
  
  // Pagination functions
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = (totalPages: number) => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToLastPage = (totalPages: number) => setCurrentPage(totalPages);
  
  // Custom filtering logic that works regardless of length
  const filteredVehicles = vehicles?.filter(vehicle => {
    // If search query is empty, return all vehicles
    if (!debouncedSearchQuery || debouncedSearchQuery.trim() === '') return true;
    
    // Convert search query to lowercase for case-insensitive matching
    const searchLower = debouncedSearchQuery.toLowerCase().trim();
    
    // Convert license plate to a format without dashes for comparison
    const formattedLicensePlate = vehicle.licensePlate?.replace(/-/g, '')?.toLowerCase() || '';
    const formattedSearchQuery = searchLower.replace(/-/g, '');
    
    // Check if any of these fields contain the search string
    return (
      formattedLicensePlate.includes(formattedSearchQuery) ||
      (vehicle.brand?.toLowerCase().includes(searchLower) || false) ||
      (vehicle.model?.toLowerCase().includes(searchLower) || false) ||
      (vehicle.vehicleType?.toLowerCase().includes(searchLower) || false)
    );
  }).sort((a, b) => {
    // Apply sorting based on selected option
    switch (sortBy) {
      case "apk-asc":
        // Sort by APK date ascending (earliest first)
        if (!a.apkDate) return 1; // No APK date comes last
        if (!b.apkDate) return -1; // No APK date comes last
        return new Date(a.apkDate).getTime() - new Date(b.apkDate).getTime();
      
      case "apk-desc":
        // Sort by APK date descending (latest first)
        if (!a.apkDate) return 1; // No APK date comes last
        if (!b.apkDate) return -1; // No APK date comes last
        return new Date(b.apkDate).getTime() - new Date(a.apkDate).getTime();
      
      case "availability-asc":
        // Sort by availability - use dateOut as an indicator
        // A vehicle is considered "out" if it has a dateOut value but no dateIn
        const aIsOut = Boolean(a.dateOut) && !a.dateIn;
        const bIsOut = Boolean(b.dateOut) && !b.dateIn;
        if (!aIsOut && bIsOut) return -1; // Available vehicles first
        if (aIsOut && !bIsOut) return 1;
        return 0;
        
      case "availability-desc":
        // Sort by availability - use dateOut as an indicator
        // A vehicle is considered "out" if it has a dateOut value but no dateIn
        const aIsOut2 = Boolean(a.dateOut) && !a.dateIn;
        const bIsOut2 = Boolean(b.dateOut) && !b.dateIn;
        if (!aIsOut2 && bIsOut2) return 1; // Put "out" vehicles first
        if (aIsOut2 && !bIsOut2) return -1;
        return 0;
      
      case "brand":
        // Sort by brand name alphabetically
        return a.brand.localeCompare(b.brand);
      
      case "license":
        // Sort by license plate alphabetically
        return a.licensePlate.localeCompare(b.licensePlate);
      
      default:
        // Default sort by ID
        return a.id - b.id;
    }
  });
  
  // Define table columns
  const columns: ColumnDef<Vehicle>[] = [
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const vehicle = row.original;
        
        return (
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleViewClick(vehicle.id)}
              data-testid={`button-view-vehicle-${vehicle.id}`}
            >
              View
            </Button>
            <VehicleEditDialog 
              vehicleId={vehicle.id}
              onSuccess={handleDialogSuccess}
            />
            <VehicleDeleteDialog 
              vehicleId={vehicle.id}
              vehicleBrand={vehicle.brand}
              vehicleModel={vehicle.model}
              vehicleLicensePlate={vehicle.licensePlate}
              onSuccess={handleDialogSuccess}
            />
            <ReservationAddDialog initialVehicleId={vehicle.id.toString()}>
              <Button 
                variant="outline" 
                size="sm"
                data-testid={`button-reserve-vehicle-${vehicle.id}`}
              >
                Reserve
              </Button>
            </ReservationAddDialog>
          </div>
        );
      },
    },
    {
      accessorKey: "licensePlate",
      header: "License Plate",
      cell: ({ row }) => {
        const licensePlate = row.getValue("licensePlate") as string;
        // Display formatted license plate consistently across the app
        return (
          <div className="font-medium whitespace-nowrap bg-primary-50 text-primary-700 px-2 py-1 rounded inline-block">
            {formatLicensePlate(licensePlate)}
          </div>
        );
      },
    },
    {
      accessorKey: "brand",
      header: "Brand",
    },
    {
      accessorKey: "model",
      header: "Model",
    },
    {
      accessorKey: "vehicleType",
      header: "Type",
      cell: ({ row }) => {
        const vehicleType = row.getValue("vehicleType") as string;
        return vehicleType || "N/A";
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const vehicle = row.original;
        const isOut = Boolean(vehicle.dateOut) && !vehicle.dateIn;
        
        return (
          <Badge 
            className={isOut 
              ? "bg-warning-50 text-warning-600" 
              : "bg-success-50 text-success-600"
            }
          >
            {isOut ? "Reserved" : "Available"}
          </Badge>
        );
      },
    },
    {
      id: "registration",
      header: "Registration",
      cell: ({ row }) => {
        const vehicle = row.original;
        // Use utility function for consistent boolean/string checks
        const isRegisteredToPerson = isTrueValue(vehicle.registeredTo);
        const isRegisteredToCompany = isTrueValue(vehicle.company);
        
        return (
          <div className="flex flex-col">
            {isRegisteredToPerson ? (
              <>
                <Badge className="bg-blue-50 text-blue-700 py-0.5 px-1.5">Opnaam</Badge>
                {vehicle.registeredToDate && (
                  <span className="text-xs text-gray-500 mt-1">Since: {formatDate(vehicle.registeredToDate)}</span>
                )}
              </>
            ) : isRegisteredToCompany ? (
              <>
                <Badge className="bg-green-50 text-green-700 py-0.5 px-1.5">BV</Badge>
                {vehicle.companyDate && (
                  <span className="text-xs text-gray-500 mt-1">Since: {formatDate(vehicle.companyDate)}</span>
                )}
              </>
            ) : (
              <span className="text-gray-500">Not specified</span>
            )}
          </div>
        );
      },
    },
    {
      id: "gps",
      header: "GPS",
      cell: ({ row }) => {
        const vehicle = row.original;
        return vehicle.gps ? 
          <Badge className="bg-blue-50 text-blue-700">Yes</Badge> : 
          <span className="text-gray-400">No</span>;
      },
    },
    {
      id: "radioCode",
      header: "Radio Code",
      cell: ({ row }) => {
        const vehicle = row.original;
        return vehicle.radioCode ? 
          <span className="font-medium text-purple-700">{vehicle.radioCode}</span> : 
          <span className="text-gray-400">N/A</span>;
      },
    },
    {
      id: "tireSize",
      header: "Tire Size",
      cell: ({ row }) => {
        const vehicle = row.original;
        return vehicle.tireSize ? 
          <span className="font-medium">{vehicle.tireSize}</span> : 
          <span className="text-gray-400">N/A</span>;
      },
    },
    {
      accessorKey: "apkDate",
      header: "APK Expires",
      cell: ({ row }) => {
        const apkDate = row.getValue("apkDate") as string;
        if (!apkDate) return <span className="text-gray-500">Not set</span>;
        
        const daysUntil = getDaysUntil(apkDate);
        let badgeClass = "bg-primary-100 text-primary-600";
        
        if (daysUntil <= 14) {
          badgeClass = "bg-danger-50 text-danger-500";
        } else if (daysUntil <= 30) {
          badgeClass = "bg-warning-50 text-warning-500";
        }
        
        return (
          <div className="flex items-center">
            <span className="mr-2">{formatDate(apkDate)}</span>
            <Badge className={badgeClass}>{daysUntil} days</Badge>
          </div>
        );
      },
    },

  ];
  
  return (
    <div className="space-y-6">
      {/* Vehicle View Dialog */}
      <VehicleViewDialog 
        open={vehicleViewDialogOpen}
        onOpenChange={setVehicleViewDialogOpen}
        vehicleId={selectedVehicleId}
      />
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Vehicle Management</h1>
        <div className="flex space-x-2">
          <VehicleBulkImportDialog onSuccess={handleDialogSuccess} />
          <VehicleAddDialog onSuccess={handleDialogSuccess} />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Fleet</CardTitle>
          <CardDescription>
            Manage your vehicle fleet, view details, and create reservations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4 items-center">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by license plate, brand, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full"
                autoFocus
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-0 top-0 h-full px-3" 
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </Button>
              )}
            </div>
            <div className="flex items-center">
              <label htmlFor="sortBy" className="mr-2 text-sm font-medium">Sort by:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (ID)</SelectItem>
                  <SelectItem value="license">License Plate</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="apk-asc">APK Date (earliest first)</SelectItem>
                  <SelectItem value="apk-desc">APK Date (latest first)</SelectItem>
                  <SelectItem value="availability-asc">Availability (available first)</SelectItem>
                  <SelectItem value="availability-desc">Availability (reserved first)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <>
              {/* Calculate current data slice */}
              {(() => {
                if (!filteredVehicles) return null;
                
                const indexOfLastVehicle = currentPage * vehiclesPerPage;
                const indexOfFirstVehicle = indexOfLastVehicle - vehiclesPerPage;
                const currentVehicles = filteredVehicles.slice(indexOfFirstVehicle, indexOfLastVehicle);
                const totalPages = Math.ceil(filteredVehicles.length / vehiclesPerPage);
                
                return (
                  <>
                    <DataTable
                      columns={columns}
                      data={currentVehicles}
                      // Remove the DataTable's built-in search since we're using our own search input
                    />
                    
                    {/* Pagination controls */}
                    {filteredVehicles.length > 0 && (
                      <div className="mt-4 flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          Showing {indexOfFirstVehicle + 1} to {Math.min(indexOfLastVehicle, filteredVehicles.length)} of {filteredVehicles.length} vehicles
                        </div>
                        
                        <div className="flex space-x-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => goToFirstPage()}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => goToPreviousPage()}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          
                          {/* Page number buttons */}
                          {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                            let pageNumber: number;
                            
                            // Logic to show the current page in the middle when possible
                            if (totalPages <= 5) {
                              pageNumber = index + 1;
                            } else if (currentPage <= 3) {
                              pageNumber = index + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNumber = totalPages - 4 + index;
                            } else {
                              pageNumber = currentPage - 2 + index;
                            }
                            
                            return (
                              <Button 
                                key={pageNumber}
                                variant={currentPage === pageNumber ? "default" : "outline"} 
                                size="sm"
                                onClick={() => paginate(pageNumber)}
                                className="h-8 w-8 p-0"
                              >
                                {pageNumber}
                              </Button>
                            );
                          })}
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => goToNextPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => goToLastPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
