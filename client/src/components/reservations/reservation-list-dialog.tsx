import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusChangeDialog } from "@/components/reservations/status-change-dialog";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { ReservationViewDialog } from "@/components/reservations/reservation-view-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
import { Eye, Edit, Trash2, Car, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, invalidateRelatedQueries } from "@/lib/queryClient";
import { Reservation, Vehicle } from "@shared/schema";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { format, parseISO } from "date-fns";

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
  
  // Fetch vehicles
  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
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

  // Sort icon helper
  const SortIcon = ({ column, sortState }: { column: string; sortState: { column: string; direction: 'asc' | 'desc' } }) => (
    <span className="ml-1 inline-flex">
      {sortState.column === column ? (
        sortState.direction === 'asc' ? '↑' : '↓'
      ) : (
        <span className="text-gray-300">↕</span>
      )}
    </span>
  );

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
        case 'id':
          return dir * (a.id - b.id);
        case 'plate':
          return dir * (a.vehicle?.licensePlate || '').localeCompare(b.vehicle?.licensePlate || '');
        case 'model':
          return dir * (`${a.vehicle?.brand} ${a.vehicle?.model}` || '').localeCompare(`${b.vehicle?.brand} ${b.vehicle?.model}` || '');
        case 'customer':
          return dir * (a.customer?.companyName || a.customer?.name || '').localeCompare(b.customer?.companyName || b.customer?.name || '');
        case 'contract':
          return dir * (a.contractNumber || '').localeCompare(b.contractNumber || '');
        case 'pickup':
          return dir * (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
        case 'return':
          return dir * (new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime());
        case 'status':
          return dir * (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
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
        case 'id':
          return dir * (a.id - b.id);
        case 'plate':
          return dir * (a.vehicle?.licensePlate || '').localeCompare(b.vehicle?.licensePlate || '');
        case 'model':
          return dir * (`${a.vehicle?.brand} ${a.vehicle?.model}` || '').localeCompare(`${b.vehicle?.brand} ${b.vehicle?.model}` || '');
        case 'customer':
          return dir * (a.customer?.companyName || a.customer?.name || '').localeCompare(b.customer?.companyName || b.customer?.name || '');
        case 'contract':
          return dir * (a.contractNumber || '').localeCompare(b.contractNumber || '');
        case 'pickup':
          return dir * (new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
        case 'return':
          return dir * (new Date(a.endDate || 0).getTime() - new Date(b.endDate || 0).getTime());
        case 'status':
          return dir * (a.status || '').localeCompare(b.status || '');
        default:
          return 0;
      }
    });
  }, [historyReservations, historySearch, historySort]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Booked</Badge>;
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-800 text-xs">Picked Up</Badge>;
      case 'returned':
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Returned</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 text-xs">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
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
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Active reservations ({filteredCurrentReservations.length})
                </p>
                
                <div className="border rounded-md overflow-hidden">
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow className="border-b-2">
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('id')}
                          >
                            ID<SortIcon column="id" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('plate')}
                          >
                            License Plate<SortIcon column="plate" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('model')}
                          >
                            Vehicle<SortIcon column="model" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('customer')}
                          >
                            Customer<SortIcon column="customer" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('contract')}
                          >
                            Contract #<SortIcon column="contract" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('pickup')}
                          >
                            Pickup<SortIcon column="pickup" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('return')}
                          >
                            Return<SortIcon column="return" sortState={currentSort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleCurrentSort('status')}
                          >
                            Status<SortIcon column="status" sortState={currentSort} />
                          </TableHead>
                          <TableHead className="px-2 py-1 font-semibold whitespace-nowrap">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingReservations ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              Loading reservations...
                            </TableCell>
                          </TableRow>
                        ) : filteredCurrentReservations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              No active reservations found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCurrentReservations.map((reservation) => (
                            <TableRow key={reservation.id} className="border-b hover:bg-muted/30" data-testid={`current-reservation-row-${reservation.id}`}>
                              <TableCell className="px-2 py-1 border-r font-mono text-sm whitespace-nowrap">
                                #{reservation.id}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-sm font-mono">
                                  {formatLicensePlate(reservation.vehicle?.licensePlate || '')}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.vehicle?.brand} {reservation.vehicle?.model}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                <span className="font-medium text-sm">{reservation.customer?.companyName || reservation.customer?.name || '-'}</span>
                              </TableCell>
                              <TableCell className="px-2 py-1 font-mono font-semibold border-r whitespace-nowrap">
                                {reservation.contractNumber || '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.startDate ? format(parseISO(reservation.startDate), 'dd MMM yyyy') : '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.endDate ? format(parseISO(reservation.endDate), 'dd MMM yyyy') : '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                {getStatusBadge(reservation.status)}
                              </TableCell>
                              <TableCell className="px-2 py-1 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleView(reservation)}
                                    data-testid={`view-current-${reservation.id}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleEdit(reservation)}
                                    data-testid={`edit-current-${reservation.id}`}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDelete(reservation)}
                                    data-testid={`delete-current-${reservation.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
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
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Completed reservations ({filteredHistoryReservations.length})
                </p>
                
                <div className="border rounded-md overflow-hidden">
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow className="border-b-2">
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('id')}
                          >
                            ID<SortIcon column="id" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('plate')}
                          >
                            License Plate<SortIcon column="plate" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('model')}
                          >
                            Vehicle<SortIcon column="model" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('customer')}
                          >
                            Customer<SortIcon column="customer" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('contract')}
                          >
                            Contract #<SortIcon column="contract" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('pickup')}
                          >
                            Pickup<SortIcon column="pickup" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('return')}
                          >
                            Return<SortIcon column="return" sortState={historySort} />
                          </TableHead>
                          <TableHead 
                            className="px-2 py-1 border-r font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none"
                            onClick={() => toggleHistorySort('status')}
                          >
                            Status<SortIcon column="status" sortState={historySort} />
                          </TableHead>
                          <TableHead className="px-2 py-1 font-semibold whitespace-nowrap">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingReservations ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              Loading reservations...
                            </TableCell>
                          </TableRow>
                        ) : filteredHistoryReservations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              No completed reservations found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredHistoryReservations.map((reservation) => (
                            <TableRow key={reservation.id} className="border-b hover:bg-muted/30" data-testid={`history-reservation-row-${reservation.id}`}>
                              <TableCell className="px-2 py-1 border-r font-mono text-sm whitespace-nowrap">
                                #{reservation.id}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-sm font-mono">
                                  {formatLicensePlate(reservation.vehicle?.licensePlate || '')}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.vehicle?.brand} {reservation.vehicle?.model}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                <span className="font-medium text-sm">{reservation.customer?.companyName || reservation.customer?.name || '-'}</span>
                              </TableCell>
                              <TableCell className="px-2 py-1 font-mono font-semibold border-r whitespace-nowrap">
                                {reservation.contractNumber || '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.startDate ? format(parseISO(reservation.startDate), 'dd MMM yyyy') : '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r text-sm whitespace-nowrap">
                                {reservation.endDate ? format(parseISO(reservation.endDate), 'dd MMM yyyy') : '-'}
                              </TableCell>
                              <TableCell className="px-2 py-1 border-r whitespace-nowrap">
                                {getStatusBadge(reservation.status)}
                              </TableCell>
                              <TableCell className="px-2 py-1 whitespace-nowrap">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleView(reservation)}
                                    data-testid={`view-history-${reservation.id}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => handleEdit(reservation)}
                                    data-testid={`edit-history-${reservation.id}`}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDelete(reservation)}
                                    data-testid={`delete-history-${reservation.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
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
