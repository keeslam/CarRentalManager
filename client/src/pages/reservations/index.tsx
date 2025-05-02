import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { TabsFilter } from "@/components/ui/tabs-filter";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Reservation, Vehicle } from "@shared/schema";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { getDuration } from "@/lib/date-utils";
import { format, differenceInDays, addDays, parseISO, startOfToday, endOfToday, isBefore, isAfter } from "date-fns";

export default function ReservationsIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [vehicleGrouping, setVehicleGrouping] = useState("none");
  
  // Get current date
  const today = new Date();
  
  // Fetch reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
  });
  
  // Fetch vehicles to help with filtering
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Extract vehicle types for filter
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    
    // Get unique vehicle types
    const types = Array.from(new Set(vehicles.map(v => v.vehicleType).filter(Boolean))) as string[];
    return types.sort();
  }, [vehicles]);
  
  // Filter reservations based on all filters
  const filteredReservations = useMemo(() => {
    if (!reservations) return [];
    
    return reservations.filter(reservation => {
      const searchLower = searchQuery.toLowerCase();
      const vehicle = reservation.vehicle;
      const customer = reservation.customer;
      
      // Search filter
      const matchesSearch = !searchQuery || (
        (vehicle?.licensePlate?.toLowerCase().includes(searchLower)) ||
        (vehicle?.brand?.toLowerCase().includes(searchLower)) ||
        (vehicle?.model?.toLowerCase().includes(searchLower)) ||
        (customer?.name?.toLowerCase().includes(searchLower)) ||
        (customer?.phone?.toLowerCase().includes(searchLower))
      );
      
      // Status filter
      const matchesStatus = statusFilter === "all" || 
        reservation.status.toLowerCase() === statusFilter.toLowerCase();
      
      // Vehicle type filter
      const matchesVehicleType = vehicleTypeFilter === "all" || 
        vehicle?.vehicleType === vehicleTypeFilter;
      
      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter !== "all") {
        const startDate = parseISO(reservation.startDate);
        const endDate = parseISO(reservation.endDate);
        
        switch (dateRangeFilter) {
          case "today":
            matchesDateRange = (
              isAfter(startDate, startOfToday()) && isBefore(startDate, endOfToday())
            ) || (
              isAfter(endDate, startOfToday()) && isBefore(endDate, endOfToday())
            ) || (
              isBefore(startDate, startOfToday()) && isAfter(endDate, endOfToday())
            );
            break;
          case "week":
            const weekFromNow = addDays(today, 7);
            matchesDateRange = (
              isBefore(startDate, weekFromNow) && 
              isAfter(startDate, startOfToday())
            ) || (
              isAfter(startDate, startOfToday()) && 
              isBefore(endDate, weekFromNow)
            );
            break;
          case "month":
            const monthFromNow = addDays(today, 30);
            matchesDateRange = (
              isBefore(startDate, monthFromNow) && 
              isAfter(startDate, startOfToday())
            ) || (
              isAfter(startDate, startOfToday()) && 
              isBefore(endDate, monthFromNow)
            );
            break;
          case "past":
            matchesDateRange = isBefore(endDate, today);
            break;
          case "future":
            matchesDateRange = isAfter(startDate, today);
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesVehicleType && matchesDateRange;
    });
  }, [reservations, searchQuery, statusFilter, vehicleTypeFilter, dateRangeFilter, today]);
  
  // Create groups based on the selected grouping
  const reservationGroups = useMemo(() => {
    if (vehicleGrouping === "none" || !filteredReservations.length) {
      return { "All Reservations": filteredReservations };
    }
    
    const groups: Record<string, Reservation[]> = {};
    
    filteredReservations.forEach((reservation) => {
      let groupKey: string;
      
      switch (vehicleGrouping) {
        case "vehicleType":
          groupKey = reservation.vehicle?.vehicleType || "Unknown Type";
          break;
        case "status":
          groupKey = reservation.status;
          break;
        case "month":
          groupKey = format(parseISO(reservation.startDate), "MMMM yyyy");
          break;
        default:
          groupKey = "All Reservations";
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      groups[groupKey].push(reservation);
    });
    
    return groups;
  }, [filteredReservations, vehicleGrouping]);
  
  // Helper for status statistics
  const getStatusCounts = useMemo(() => {
    if (!reservations) return { all: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0 };
    
    const counts = {
      all: reservations.length,
      pending: 0,
      confirmed: 0, 
      cancelled: 0,
      completed: 0
    };
    
    reservations.forEach(res => {
      const status = res.status.toLowerCase();
      if (counts[status as keyof typeof counts] !== undefined) {
        counts[status as keyof typeof counts]++;
      }
    });
    
    return counts;
  }, [reservations]);
  
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
            <div className="text-sm text-gray-500">
              {vehicle.brand} {vehicle.model}
              {vehicle.vehicleType && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-100">{vehicle.vehicleType}</span>}
            </div>
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
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        
        // Calculate if this is current, upcoming, or past
        const isPast = isBefore(end, today);
        const isCurrent = isBefore(start, today) && isAfter(end, today);
        const isUpcoming = isAfter(start, today);
        
        let timeIndicator = null;
        if (isPast) {
          timeIndicator = <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">Past</span>;
        } else if (isCurrent) {
          timeIndicator = <span className="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Current</span>;
        } else if (isUpcoming) {
          const daysUntil = differenceInDays(start, today);
          if (daysUntil <= 3) {
            timeIndicator = <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">Soon</span>;
          }
        }
        
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
              {timeIndicator}
            </div>
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
            badgeClass = "bg-green-100 text-green-800 border-green-200";
            break;
          case "pending":
            badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
            break;
          case "cancelled":
            badgeClass = "bg-red-100 text-red-800 border-red-200";
            break;
          case "completed":
            badgeClass = "bg-gray-100 text-gray-800 border-gray-200";
            break;
          default:
            badgeClass = "bg-gray-100 text-gray-800";
        }
        
        return <Badge className={badgeClass}>{status}</Badge>;
      },
    },
    {
      accessorKey: "totalPrice",
      header: "Total",
      cell: ({ row }) => {
        const price = row.getValue("totalPrice") as string;
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
  
  // Status tabs config
  const statusTabs = [
    { id: "all", label: "All", count: getStatusCounts.all },
    { id: "confirmed", label: "Confirmed", count: getStatusCounts.confirmed },
    { id: "pending", label: "Pending", count: getStatusCounts.pending },
    { id: "cancelled", label: "Cancelled", count: getStatusCounts.cancelled },
    { id: "completed", label: "Completed", count: getStatusCounts.completed },
  ];
  
  // Date range tabs
  const dateRangeTabs = [
    { id: "all", label: "All Dates" },
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "future", label: "Future" },
    { id: "past", label: "Past" },
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
          {/* Status Filter Tabs */}
          <div className="mb-6">
            <TabsFilter
              tabs={statusTabs}
              activeTab={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          
          {/* Date Range Filter Tabs */}
          <div className="mb-6">
            <TabsFilter
              tabs={dateRangeTabs}
              activeTab={dateRangeFilter}
              onChange={setDateRangeFilter}
            />
          </div>
          
          {/* Advanced Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[280px]">
              <Input
                placeholder="Search vehicle, license plate, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            {vehicleTypes.length > 0 && (
              <div>
                <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {vehicleTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Select value={vehicleGrouping} onValueChange={setVehicleGrouping}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Group By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="vehicleType">Vehicle Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Loading State */}
          {(isLoadingReservations || isLoadingVehicles) ? (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center border rounded-lg p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-x text-primary-600">
                  <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                  <path d="m17 17 4 4" />
                  <path d="m21 17-4 4" />
                </svg>
              </div>
              <h3 className="font-medium text-lg mb-2">No Reservations Found</h3>
              <p className="text-gray-500 max-w-md mb-4">
                There are no reservations matching your current filters. Try adjusting your search criteria or create a new reservation.
              </p>
              <Link href="/reservations/add">
                <Button size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
                    <line x1="12" x2="12" y1="5" y2="19" />
                    <line x1="5" x2="19" y1="12" y2="12" />
                  </svg>
                  New Reservation
                </Button>
              </Link>
            </div>
          ) : (
            // Display grouped or ungrouped reservations
            <div className="space-y-8">
              {Object.entries(reservationGroups).map(([groupName, groupReservations]) => (
                <div key={groupName} className="space-y-4">
                  {vehicleGrouping !== "none" && (
                    <h3 className="text-lg font-medium">
                      {groupName} <span className="text-gray-500 text-sm">({groupReservations.length})</span>
                    </h3>
                  )}
                  <DataTable
                    columns={columns}
                    data={groupReservations}
                    searchable={false}
                    pagination={vehicleGrouping === "none"}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
