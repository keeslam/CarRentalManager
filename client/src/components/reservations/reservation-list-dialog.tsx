import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
import { Eye, Edit, Trash2, Car, History, User, Calendar, FileText, Fuel, MapPin, Phone, Building, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { Reservation, Vehicle } from "@shared/schema";
import { formatLicensePlate, formatCurrency } from "@/lib/format-utils";
import { format, parseISO, differenceInDays } from "date-fns";

interface ReservationListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewReservation?: (reservation: Reservation) => void;
  onEditReservation?: (reservation: Reservation) => void;
}

export function ReservationListDialog({ open, onOpenChange, onViewReservation, onEditReservation }: ReservationListDialogProps) {
  const [currentSearch, setCurrentSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [currentSort, setCurrentSort] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'pickup', direction: 'asc' });
  const [historySort, setHistorySort] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'return', direction: 'desc' });
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedViewReservationId, setSelectedViewReservationId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEditReservationId, setSelectedEditReservationId] = useState<number | null>(null);
  const { toast } = useToast();
  
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
  
  // Fetch reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
    enabled: open,
  });

  // Split reservations into current and history
  const { currentReservations, historyReservations } = useMemo(() => {
    if (!reservations) return { currentReservations: [], historyReservations: [] };
    
    const current: Reservation[] = [];
    const history: Reservation[] = [];
    
    reservations.forEach(res => {
      if (res.type === 'maintenance_block') return;
      
      if (res.status === 'booked' || res.status === 'picked_up') {
        current.push(res);
      } else if (res.status === 'completed' || res.status === 'returned' || res.status === 'cancelled') {
        history.push(res);
      }
    });
    
    return { currentReservations: current, historyReservations: history };
  }, [reservations]);

  // Toggle sort helper
  const toggleCurrentSort = (column: string) => {
    setCurrentSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleHistorySort = (column: string) => {
    setHistorySort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter and sort current reservations
  const filteredCurrentReservations = useMemo(() => {
    let filtered = currentReservations.filter(res => {
      if (!currentSearch) return true;
      const search = currentSearch.toLowerCase();
      return (
        res.vehicle?.licensePlate?.toLowerCase().includes(search) ||
        res.vehicle?.brand?.toLowerCase().includes(search) ||
        res.vehicle?.model?.toLowerCase().includes(search) ||
        res.customer?.companyName?.toLowerCase().includes(search) ||
        res.customer?.name?.toLowerCase().includes(search) ||
        res.contractNumber?.toLowerCase().includes(search) ||
        res.id.toString().includes(search)
      );
    });

    return filtered.sort((a, b) => {
      const dir = currentSort.direction === 'asc' ? 1 : -1;
      switch (currentSort.column) {
        case 'pickup':
          return dir * (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
        case 'return':
          return dir * (new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime());
        case 'customer':
          return dir * (a.customer?.companyName || a.customer?.name || '').localeCompare(b.customer?.companyName || b.customer?.name || '');
        case 'plate':
          return dir * (a.vehicle?.licensePlate || '').localeCompare(b.vehicle?.licensePlate || '');
        default:
          return dir * (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
      }
    });
  }, [currentReservations, currentSearch, currentSort]);

  // Filter and sort history reservations
  const filteredHistoryReservations = useMemo(() => {
    let filtered = historyReservations.filter(res => {
      if (!historySearch) return true;
      const search = historySearch.toLowerCase();
      return (
        res.vehicle?.licensePlate?.toLowerCase().includes(search) ||
        res.vehicle?.brand?.toLowerCase().includes(search) ||
        res.vehicle?.model?.toLowerCase().includes(search) ||
        res.customer?.companyName?.toLowerCase().includes(search) ||
        res.customer?.name?.toLowerCase().includes(search) ||
        res.contractNumber?.toLowerCase().includes(search) ||
        res.id.toString().includes(search)
      );
    });

    return filtered.sort((a, b) => {
      const dir = historySort.direction === 'asc' ? 1 : -1;
      switch (historySort.column) {
        case 'pickup':
          return dir * (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
        case 'return':
          return dir * (new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime());
        case 'customer':
          return dir * (a.customer?.companyName || a.customer?.name || '').localeCompare(b.customer?.companyName || b.customer?.name || '');
        case 'plate':
          return dir * (a.vehicle?.licensePlate || '').localeCompare(b.vehicle?.licensePlate || '');
        default:
          return dir * (new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime());
      }
    });
  }, [historyReservations, historySearch, historySort]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked':
        return <Badge className="bg-blue-100 text-blue-800">Booked</Badge>;
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800">Picked Up</Badge>;
      case 'returned':
        return <Badge className="bg-yellow-100 text-yellow-800">Returned</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleView = (reservation: Reservation) => {
    if (onViewReservation) {
      onViewReservation(reservation);
    } else {
      setSelectedViewReservationId(reservation.id);
      setViewDialogOpen(true);
    }
  };

  const handleEdit = (reservation: Reservation) => {
    if (onEditReservation) {
      onEditReservation(reservation);
    } else {
      setSelectedEditReservationId(reservation.id);
      setEditDialogOpen(true);
    }
  };

  const handleDelete = (reservation: Reservation) => {
    if (confirm(`Are you sure you want to delete reservation #${reservation.id}?`)) {
      deleteReservationMutation.mutate(reservation.id);
    }
  };

  const getDuration = (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) return null;
    const days = differenceInDays(parseISO(endDate), parseISO(startDate));
    return days === 1 ? '1 day' : `${days} days`;
  };

  // Reservation Card Component
  const ReservationCard = ({ reservation }: { reservation: Reservation }) => {
    const duration = getDuration(reservation.startDate, reservation.endDate);
    
    return (
      <div className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow" data-testid={`reservation-card-${reservation.id}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border-b rounded-t-lg">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg">#{reservation.id}</span>
            {reservation.contractNumber && (
              <span className="text-sm text-gray-600">
                Contract: <span className="font-mono font-semibold">{reservation.contractNumber}</span>
              </span>
            )}
            {getStatusBadge(reservation.status)}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleView(reservation)}
              data-testid={`view-btn-${reservation.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(reservation)}
              data-testid={`edit-btn-${reservation.id}`}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => handleDelete(reservation)}
              data-testid={`delete-btn-${reservation.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-4 grid grid-cols-4 gap-4">
          {/* Vehicle Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Car className="h-4 w-4" />
              Vehicle
            </div>
            <div className="space-y-1">
              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono font-bold inline-block">
                {formatLicensePlate(reservation.vehicle?.licensePlate || '-')}
              </div>
              <div className="text-sm">{reservation.vehicle?.brand} {reservation.vehicle?.model}</div>
              {reservation.vehicle?.vehicleType && (
                <div className="text-xs text-gray-500">{reservation.vehicle.vehicleType}</div>
              )}
            </div>
          </div>

          {/* Customer Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <User className="h-4 w-4" />
              Customer
            </div>
            <div className="space-y-1">
              {reservation.customer?.companyName && (
                <div className="flex items-center gap-1 text-sm">
                  <Building className="h-3 w-3 text-gray-400" />
                  <span className="font-medium">{reservation.customer.companyName}</span>
                </div>
              )}
              <div className="text-sm font-medium">{reservation.customer?.name || '-'}</div>
              {reservation.customer?.phone && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Phone className="h-3 w-3" />
                  {reservation.customer.phone}
                </div>
              )}
              {reservation.driver && (
                <div className="text-xs text-gray-600 mt-1">
                  Driver: {reservation.driver.firstName} {reservation.driver.lastName}
                </div>
              )}
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="h-4 w-4" />
              Rental Period
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Pickup</div>
                  <div className="font-medium">
                    {reservation.startDate ? format(parseISO(reservation.startDate), 'dd MMM yyyy') : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Return</div>
                  <div className="font-medium">
                    {reservation.endDate ? format(parseISO(reservation.endDate), 'dd MMM yyyy') : '-'}
                  </div>
                </div>
              </div>
              {duration && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  {duration}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText className="h-4 w-4" />
              Details
            </div>
            <div className="space-y-1 text-sm">
              {/* Mileage */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500">KM Out</div>
                  <div className="font-mono">{reservation.pickupMileage?.toLocaleString() || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">KM In</div>
                  <div className="font-mono">{reservation.returnMileage?.toLocaleString() || '-'}</div>
                </div>
              </div>
              
              {/* Fuel */}
              {(reservation.fuelLevelPickup || reservation.fuelLevelReturn) && (
                <div className="flex items-center gap-2 mt-1">
                  <Fuel className="h-3 w-3 text-gray-400" />
                  <span className="text-xs">
                    {reservation.fuelLevelPickup || '-'} → {reservation.fuelLevelReturn || '-'}
                  </span>
                </div>
              )}
              
              {/* Price */}
              {reservation.totalPrice && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Total: </span>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(Number(reservation.totalPrice))}
                  </span>
                </div>
              )}

              {/* Delivery */}
              {reservation.deliveryRequired && (
                <div className="flex items-center gap-1 mt-1 text-xs text-orange-600">
                  <MapPin className="h-3 w-3" />
                  Delivery: {reservation.deliveryAddress || 'Yes'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {reservation.notes && (
          <div className="px-4 pb-3">
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 italic">
              {reservation.notes}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] max-h-[90vh]" data-testid="dialog-reservation-list">
          <DialogHeader>
            <DialogTitle>Reservations</DialogTitle>
            <DialogDescription>
              View and manage all reservations
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Current ({currentReservations.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History ({historyReservations.length})
              </TabsTrigger>
            </TabsList>

            {/* Current Reservations Tab */}
            <TabsContent value="current" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search by plate, customer, contract, ID..."
                    value={currentSearch}
                    onChange={(e) => setCurrentSearch(e.target.value)}
                    className="flex-1 h-9"
                    data-testid="input-current-search"
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    Sort:
                    <Button
                      variant={currentSort.column === 'pickup' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleCurrentSort('pickup')}
                    >
                      Pickup {currentSort.column === 'pickup' && (currentSort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button
                      variant={currentSort.column === 'customer' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleCurrentSort('customer')}
                    >
                      Customer {currentSort.column === 'customer' && (currentSort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button
                      variant={currentSort.column === 'plate' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleCurrentSort('plate')}
                    >
                      Plate {currentSort.column === 'plate' && (currentSort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Active reservations ({filteredCurrentReservations.length})
                </p>
                
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {isLoadingReservations ? (
                      <div className="text-center py-8 text-gray-500">
                        Loading reservations...
                      </div>
                    ) : filteredCurrentReservations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No active reservations found
                      </div>
                    ) : (
                      filteredCurrentReservations.map((reservation) => (
                        <ReservationCard key={reservation.id} reservation={reservation} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search by plate, customer, contract, ID..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="flex-1 h-9"
                    data-testid="input-history-search"
                  />
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    Sort:
                    <Button
                      variant={historySort.column === 'return' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleHistorySort('return')}
                    >
                      Return {historySort.column === 'return' && (historySort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button
                      variant={historySort.column === 'customer' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleHistorySort('customer')}
                    >
                      Customer {historySort.column === 'customer' && (historySort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                    <Button
                      variant={historySort.column === 'plate' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleHistorySort('plate')}
                    >
                      Plate {historySort.column === 'plate' && (historySort.direction === 'asc' ? '↑' : '↓')}
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Completed reservations ({filteredHistoryReservations.length})
                </p>
                
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {isLoadingReservations ? (
                      <div className="text-center py-8 text-gray-500">
                        Loading reservations...
                      </div>
                    ) : filteredHistoryReservations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No completed reservations found
                      </div>
                    ) : (
                      filteredHistoryReservations.map((reservation) => (
                        <ReservationCard key={reservation.id} reservation={reservation} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
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
