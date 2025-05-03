import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Vehicle } from "@shared/schema";
import { formatDate, formatLicensePlate } from "@/lib/format-utils";
import { getDaysUntil } from "@/lib/date-utils";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function VehiclesIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      return apiRequest(`/api/vehicles/${vehicleId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Vehicle deleted",
        description: `Vehicle ${vehicleToDelete?.licensePlate} has been successfully deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setVehicleToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete vehicle. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting vehicle:", error);
    },
  });
  
  const handleDeleteClick = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = () => {
    if (vehicleToDelete) {
      deleteVehicleMutation.mutate(vehicleToDelete.id);
    }
    setDeleteDialogOpen(false);
  };
  
  const handleEditClick = (vehicle: Vehicle) => {
    navigate(`/vehicles/edit/${vehicle.id}`);
  };
  
  // Filter vehicles based on search query
  const filteredVehicles = vehicles?.filter(vehicle => {
    const searchLower = searchQuery.toLowerCase();
    return (
      vehicle.licensePlate.toLowerCase().includes(searchLower) ||
      vehicle.brand.toLowerCase().includes(searchLower) ||
      vehicle.model.toLowerCase().includes(searchLower) ||
      (vehicle.vehicleType && vehicle.vehicleType.toLowerCase().includes(searchLower))
    );
  });
  
  // Define table columns
  const columns: ColumnDef<Vehicle>[] = [
    {
      accessorKey: "licensePlate",
      header: "License Plate",
      cell: ({ row }) => {
        const licensePlate = row.getValue("licensePlate") as string;
        // Display without hyphens using formatLicensePlate utility
        return <div className="font-medium">{formatLicensePlate(licensePlate)}</div>;
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
    {
      id: "actions",
      cell: ({ row }) => {
        const vehicle = row.original;
        
        return (
          <div className="flex justify-end gap-2">
            <Link href={`/vehicles/${vehicle.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleEditClick(vehicle)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-500"
              onClick={() => handleDeleteClick(vehicle)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" x2="10" y1="11" y2="17"/>
                <line x1="14" x2="14" y1="11" y2="17"/>
              </svg>
            </Button>
            <Link href={`/reservations/add?vehicleId=${vehicle.id}`}>
              <Button variant="outline" size="sm">
                Reserve
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];
  
  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              {vehicleToDelete && (
                <>
                  This will permanently delete the vehicle <strong>{vehicleToDelete.brand} {vehicleToDelete.model}</strong> with license plate <strong>{formatLicensePlate(vehicleToDelete.licensePlate)}</strong> and all associated data.
                  <br /><br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Vehicle Management</h1>
        <div className="flex space-x-2">
          <Link href="/vehicles/bulk-import">
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download mr-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Bulk Import
            </Button>
          </Link>
          <Link href="/vehicles/add">
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              Add Vehicle
            </Button>
          </Link>
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
          <div className="mb-4">
            <Input
              placeholder="Search by license plate, brand, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredVehicles || []}
              searchColumn="licensePlate"
              searchPlaceholder="Filter by license plate..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
