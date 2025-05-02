import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Vehicle } from "@shared/schema";
import { formatDate } from "@/lib/format-utils";
import { getDaysUntil } from "@/lib/date-utils";

export default function VehiclesIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
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
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("licensePlate")}</div>
      ),
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Vehicle Management</h1>
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
