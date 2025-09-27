import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TabsFilter } from "@/components/ui/tabs-filter";
import { Badge } from "@/components/ui/badge";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Reservation, Vehicle } from "@shared/schema";
import { formatDate, formatCurrency, formatLicensePlate, formatReservationStatus } from "@/lib/format-utils";
import { getDuration } from "@/lib/date-utils";
import { format, differenceInDays, addDays, parseISO, startOfToday, endOfToday, isBefore, isAfter, isSameDay, endOfDay } from "date-fns";

interface ReservationListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationListDialog({ open, onOpenChange }: ReservationListDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [vehicleGrouping, setVehicleGrouping] = useState("none");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedViewReservationId, setSelectedViewReservationId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEditReservationId, setSelectedEditReservationId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Get current date
  const today = new Date();
  
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
      // Use unified invalidation system to update all related data
      await invalidateRelatedQueries('reservations');
      
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
  
  // Quick status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiRequest('PATCH', `/api/reservations/${id}`, { status });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update reservation status');
      }
      return await response.json();
    },
    onSuccess: async () => {
      // Use unified invalidation system to update all related data
      await invalidateRelatedQueries('reservations');
      
      toast({
        title: "Status updated",
        description: "The reservation status has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reservation status",
        variant: "destructive"
      });
    }
  });
  
  // Define query key for easier reference
  const reservationsQueryKey = ["/api/reservations"];
  
  // Fetch reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: reservationsQueryKey,
    enabled: open, // Only fetch when dialog is open
  });
  
  // Fetch vehicles to help with filtering
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    enabled: open, // Only fetch when dialog is open
  });
  
  // Extract vehicle types for filter
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    
    // Get unique vehicle types
    const types = Array.from(new Set(vehicles.map(v => v.vehicleType).filter(Boolean))) as string[];
    return types.sort();
  }, [vehicles]);

  // Define table columns
  const columns: ColumnDef<Reservation>[] = useMemo(() => [
    {
      accessorKey: "id",
      header: "ID",
      size: 80,
      cell: ({ row }) => {
        const reservation = row.original;
        return (
          <Link href={`/reservations/${reservation.id}`}>
            <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-800" data-testid={`reservation-link-${reservation.id}`}>
              #{reservation.id}
            </Button>
          </Link>
        );
      },
    },
    {
      accessorKey: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const reservation = row.original;
        const vehicle = reservation.vehicle;
        if (!vehicle) {
          return <span className="text-gray-500">No vehicle</span>;
        }
        return (
          <div className="flex flex-col">
            <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
            <span className="text-sm text-gray-500">{formatLicensePlate(vehicle.licensePlate)}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const reservation = row.original;
        const customer = reservation.customer;
        if (!customer) {
          return <span className="text-gray-500">No customer</span>;
        }
        return (
          <div className="flex flex-col">
            <span className="font-medium">{customer.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => {
        const reservation = row.original;
        return formatDate(reservation.startDate);
      },
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => {
        const reservation = row.original;
        return reservation.endDate ? formatDate(reservation.endDate) : "Open-ended";
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const reservation = row.original;
        return (
          <Badge 
            variant={
              reservation.status === "confirmed" ? "default" :
              reservation.status === "pending" ? "secondary" :
              reservation.status === "cancelled" ? "destructive" :
              reservation.status === "completed" ? "outline" :
              "secondary"
            }
          >
            {formatReservationStatus(reservation.status)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "totalPrice",
      header: "Price",
      cell: ({ row }) => {
        const reservation = row.original;
        return reservation.totalPrice ? formatCurrency(Number(reservation.totalPrice)) : "Not set";
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const reservation = row.original;
        return (
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              data-testid={`view-reservation-${reservation.id}`}
              onClick={() => {
                setSelectedViewReservationId(reservation.id);
                setViewDialogOpen(true);
              }}
            >
              View
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              data-testid={`edit-reservation-${reservation.id}`}
              onClick={() => {
                setSelectedEditReservationId(reservation.id);
                setEditDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`delete-reservation-${reservation.id}`}>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete reservation #{reservation.id}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteReservationMutation.mutate(reservation.id)}
                    disabled={deleteReservationMutation.isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ], [deleteReservationMutation]);

  // Apply filters to reservations
  const filteredReservations = useMemo(() => {
    if (!reservations) return [];

    return reservations.filter((reservation) => {
      // Search filter
      const searchTerm = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        reservation.id.toString().includes(searchTerm) ||
        reservation.vehicle?.licensePlate?.toLowerCase().includes(searchTerm) ||
        reservation.vehicle?.brand?.toLowerCase().includes(searchTerm) ||
        reservation.vehicle?.model?.toLowerCase().includes(searchTerm) ||
        reservation.customer?.name?.toLowerCase().includes(searchTerm);

      // Status filter
      const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;

      // Vehicle type filter
      const matchesVehicleType = vehicleTypeFilter === "all" || 
        reservation.vehicle?.vehicleType === vehicleTypeFilter;

      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter !== "all") {
        const startDate = parseISO(reservation.startDate);
        const endDateStr = reservation.endDate;
        const endDate = endDateStr ? parseISO(endDateStr) : null;

        switch (dateRangeFilter) {
          case "current":
            matchesDateRange = isSameDay(startDate, today) || 
              (endDate && (startDate <= today && today <= endDate)) ||
              (!endDate && startDate <= today);
            break;
          case "upcoming":
            matchesDateRange = isAfter(startDate, today);
            break;
          case "past":
            matchesDateRange = endDate ? isBefore(endOfDay(endDate), today) : false;
            break;
        }
      }

      return matchesSearch && matchesStatus && matchesVehicleType && matchesDateRange;
    });
  }, [reservations, searchQuery, statusFilter, vehicleTypeFilter, dateRangeFilter, today]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto" data-testid="dialog-reservation-list">
          <DialogHeader>
            <DialogTitle>Reservations List</DialogTitle>
            <DialogDescription>
              View and manage all reservations in a detailed table format
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <Input
                placeholder="Search reservations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
                data-testid="input-search-reservations"
              />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {vehicleTypes.length > 0 && (
                <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="select-vehicle-type-filter">
                    <SelectValue placeholder="Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {vehicleTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger className="w-40" data-testid="select-date-range-filter">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Table */}
            <div className="border rounded-lg">
              {isLoadingReservations || isLoadingVehicles ? (
                <div className="p-8 text-center text-gray-500">
                  Loading reservations...
                </div>
              ) : filteredReservations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No reservations found matching your filters.
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredReservations}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        reservationId={selectedReservation?.id || 0}
        initialStatus={selectedReservation?.status || "pending"}
        onStatusChanged={() => {
          // Refresh the data after status change
          queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        }}
      />

      {/* Reservation View Dialog */}
      <ReservationViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        reservationId={selectedViewReservationId}
        onEdit={(reservationId) => {
          setSelectedEditReservationId(reservationId);
          setViewDialogOpen(false);
          setEditDialogOpen(true);
        }}
      />

      {/* Reservation Edit Dialog */}
      <ReservationEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        reservationId={selectedEditReservationId}
        onSuccess={(updatedReservation) => {
          // Refresh the data after successful edit using unified invalidation
          invalidateRelatedQueries('reservations', {
            id: updatedReservation.id,
            vehicleId: updatedReservation.vehicleId,
            customerId: updatedReservation.customerId
          });
          toast({
            title: "Reservation updated",
            description: "The reservation has been successfully updated",
          });
        }}
      />
    </>
  );
}