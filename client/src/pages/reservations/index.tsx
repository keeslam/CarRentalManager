import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Reservation } from "@shared/schema";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { getDuration } from "@/lib/date-utils";

export default function ReservationsIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { data: reservations, isLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
  });
  
  // Filter reservations based on search query and status filter
  const filteredReservations = reservations?.filter(reservation => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      (reservation.vehicle?.licensePlate?.toLowerCase().includes(searchLower)) ||
      (reservation.vehicle?.brand?.toLowerCase().includes(searchLower)) ||
      (reservation.vehicle?.model?.toLowerCase().includes(searchLower)) ||
      (reservation.customer?.name?.toLowerCase().includes(searchLower)) ||
      (reservation.customer?.phone?.toLowerCase().includes(searchLower))
    );
    
    const matchesStatus = statusFilter === "all" || reservation.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });
  
  // Define table columns
  const columns: ColumnDef<Reservation>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span>#{row.getValue("id")}</span>,
    },
    {
      accessorKey: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const vehicle = row.original.vehicle;
        return vehicle ? (
          <div>
            <div className="font-medium">{vehicle.licensePlate}</div>
            <div className="text-sm text-gray-500">{vehicle.brand} {vehicle.model}</div>
          </div>
        ) : "—";
      },
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const customer = row.original.customer;
        return customer ? (
          <div>
            <div className="font-medium">{customer.name}</div>
            <div className="text-sm text-gray-500">{customer.phone}</div>
          </div>
        ) : "—";
      },
    },
    {
      accessorKey: "period",
      header: "Period",
      cell: ({ row }) => {
        const startDate = row.original.startDate;
        const endDate = row.original.endDate;
        return (
          <div>
            <div>{formatDate(startDate)} - {formatDate(endDate)}</div>
            <div className="text-sm text-gray-500">{getDuration(startDate, endDate)}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        let badgeClass = "";
        
        switch (status.toLowerCase()) {
          case "confirmed":
            badgeClass = "bg-success-50 text-success-600";
            break;
          case "pending":
            badgeClass = "bg-warning-50 text-warning-600";
            break;
          case "cancelled":
            badgeClass = "bg-danger-50 text-danger-600";
            break;
          case "completed":
            badgeClass = "bg-gray-100 text-gray-800";
            break;
          default:
            badgeClass = "";
        }
        
        return <Badge className={badgeClass}>{status}</Badge>;
      },
    },
    {
      accessorKey: "totalPrice",
      header: "Total",
      cell: ({ row }) => {
        const price = row.getValue("totalPrice") as number;
        return formatCurrency(price);
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const reservation = row.original;
        
        return (
          <div className="flex justify-end gap-2">
            <Link href={`/reservations/${reservation.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
            <Link href={`/documents/contract/${reservation.id}`}>
              <Button variant="outline" size="sm">
                Contract
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
        <h1 className="text-2xl font-bold">Reservation Management</h1>
        <div className="flex gap-2">
          <Link href="/reservations/calendar">
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar mr-2">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              Calendar View
            </Button>
          </Link>
          <Link href="/reservations/add">
            <Button>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              New Reservation
            </Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Reservations</CardTitle>
          <CardDescription>
            Manage all your vehicle reservations and rental contracts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Input
              placeholder="Search by vehicle or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
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
              data={filteredReservations || []}
              searchColumn="id"
              searchPlaceholder="Filter by ID..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
