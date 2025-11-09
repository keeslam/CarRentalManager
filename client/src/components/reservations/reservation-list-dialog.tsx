import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsFilter } from "@/components/ui/tabs-filter";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const [expandedVehicles, setExpandedVehicles] = useState<Set<number>>(new Set());
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedViewReservationId, setSelectedViewReservationId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEditReservationId, setSelectedEditReservationId] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Get current date
  const today = new Date();
  
  // Toggle vehicle group expansion
  const toggleVehicleExpansion = (vehicleId: number | undefined) => {
    if (!vehicleId) return;
    setExpandedVehicles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
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

  // Apply filters and create grouped structure
  const groupedReservations = useMemo(() => {
    if (!reservations) return [];

    const filtered = reservations.filter((reservation) => {
      // Exclude maintenance reservations from rental list
      if (reservation.type === 'maintenance_block') {
        return false;
      }

      // Search filter
      const searchTerm = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        reservation.id.toString().includes(searchTerm) ||
        reservation.vehicle?.licensePlate?.toLowerCase().includes(searchTerm) ||
        reservation.vehicle?.brand?.toLowerCase().includes(searchTerm) ||
        reservation.vehicle?.model?.toLowerCase().includes(searchTerm) ||
        reservation.customer?.name?.toLowerCase().includes(searchTerm);

      // Status filter - handle comma-separated values for grouped statuses
      const matchesStatus = statusFilter === "all" || 
        statusFilter.split(',').includes(reservation.status);

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

    // Group by vehicle
    const groupedByVehicle = filtered.reduce((acc, reservation) => {
      const vehicleKey = reservation.vehicleId?.toString() || 'no-vehicle';
      if (!acc[vehicleKey]) {
        acc[vehicleKey] = {
          vehicle: reservation.vehicle,
          reservations: []
        };
      }
      acc[vehicleKey].reservations.push(reservation);
      return acc;
    }, {} as Record<string, { vehicle: typeof filtered[0]['vehicle']; reservations: typeof filtered }>);

    // Sort groups by most recent reservation and return array of groups
    return Object.values(groupedByVehicle)
      .map(group => ({
        vehicle: group.vehicle,
        reservations: group.reservations
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
        totalCount: group.reservations.length
      }))
      .sort((a, b) => {
        const aLatest = Math.max(...a.reservations.map(r => new Date(r.startDate).getTime()));
        const bLatest = Math.max(...b.reservations.map(r => new Date(r.startDate).getTime()));
        return bLatest - aLatest;
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
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
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

            {/* Grouped Reservations List */}
            <div className="border rounded-lg">
              {isLoadingReservations || isLoadingVehicles ? (
                <div className="p-8 text-center text-gray-500">
                  Loading reservations...
                </div>
              ) : groupedReservations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No reservations found matching your filters.
                </div>
              ) : (
                <div className="divide-y">
                  {groupedReservations.map((group, groupIndex) => {
                    const vehicleId = group.vehicle?.id;
                    const isExpanded = vehicleId ? expandedVehicles.has(vehicleId) : false;
                    
                    return (
                      <div key={vehicleId || `no-vehicle-${groupIndex}`} className="p-4">
                        {/* Vehicle Header - Clickable */}
                        <div 
                          className="flex items-center justify-between mb-3 pb-2 border-b-2 border-blue-200 bg-blue-50 -mx-4 px-4 py-2 cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={() => toggleVehicleExpansion(vehicleId)}
                          data-testid={`vehicle-group-header-${vehicleId}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Expand/Collapse Icon */}
                            <div className="text-blue-600">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </div>
                            
                            <div className="font-bold text-lg">
                              {group.vehicle ? (
                                <>
                                  <span className="text-gray-700">{group.vehicle.brand} {group.vehicle.model}</span>
                                  <span className="ml-2 text-sm font-normal text-gray-600">
                                    {formatLicensePlate(group.vehicle.licensePlate)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-500">No Vehicle Assigned</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {group.totalCount > 3 ? (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  Showing 3 of {group.totalCount} reservations
                                </span>
                              ) : (
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {group.totalCount} {group.totalCount === 1 ? 'reservation' : 'reservations'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cascaded Reservation Rows - Show max 3 when expanded */}
                        {isExpanded && (
                          <div className="space-y-2">
                        {group.reservations.slice(0, 3).map((reservation, index) => (
                          <div
                            key={reservation.id}
                            className={`ml-4 pl-4 border-l-4 ${
                              index === 0 ? 'border-blue-400' : 
                              index === 1 ? 'border-blue-300' : 
                              'border-blue-200'
                            } bg-gray-50 p-3 rounded-r hover:bg-gray-100 transition-colors`}
                            data-testid={`reservation-item-${reservation.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 grid grid-cols-5 gap-4">
                                {/* ID */}
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">ID</div>
                                  <Link href={`/reservations/${reservation.id}`}>
                                    <Button 
                                      variant="link" 
                                      className="p-0 h-auto text-blue-600 hover:text-blue-800" 
                                      data-testid={`reservation-link-${reservation.id}`}
                                    >
                                      #{reservation.id}
                                    </Button>
                                  </Link>
                                </div>

                                {/* Customer */}
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Customer</div>
                                  <div className="font-medium">
                                    {reservation.customer?.name || "No customer"}
                                  </div>
                                </div>

                                {/* Dates */}
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Start Date</div>
                                  <div>{formatDate(reservation.startDate)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">End Date</div>
                                  <div>{reservation.endDate ? formatDate(reservation.endDate) : "Open-ended"}</div>
                                </div>

                                {/* Status & Price */}
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">Status</div>
                                    <div>
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        reservation.status === 'booked' ? 'bg-blue-100 text-blue-800' :
                                        reservation.status === 'picked_up' ? 'bg-green-100 text-green-800' :
                                        reservation.status === 'returned' ? 'bg-yellow-100 text-yellow-800' :
                                        reservation.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                        reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1).replace('_', ' ')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedViewReservationId(reservation.id);
                                    setViewDialogOpen(true);
                                  }}
                                  data-testid={`view-reservation-${reservation.id}`}
                                >
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEditReservationId(reservation.id);
                                    setEditDialogOpen(true);
                                  }}
                                  data-testid={`edit-reservation-${reservation.id}`}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete reservation #${reservation.id}?`)) {
                                      deleteReservationMutation.mutate(reservation.id);
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`delete-reservation-${reservation.id}`}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
        initialStatus={selectedReservation?.status || "booked"}
        initialFuelData={selectedReservation ? {
          fuelLevelPickup: selectedReservation.fuelLevelPickup,
          fuelLevelReturn: selectedReservation.fuelLevelReturn,
          fuelCost: selectedReservation.fuelCost ? Number(selectedReservation.fuelCost) : null,
          fuelCardNumber: selectedReservation.fuelCardNumber,
          fuelNotes: selectedReservation.fuelNotes,
        } : undefined}
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
            vehicleId: updatedReservation.vehicleId ?? undefined,
            customerId: updatedReservation.customerId ?? undefined
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