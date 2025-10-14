import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Reservation, Vehicle, Customer, Driver } from "@shared/schema";
import { 
  Calendar, 
  Car, 
  User, 
  Phone, 
  Mail, 
  Wrench,
  Edit,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { displayLicensePlate } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

interface MaintenanceViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: number | null;
  onEdit?: (reservation: Reservation) => void;
}

export function MaintenanceViewDialog({
  open,
  onOpenChange,
  reservationId,
  onEdit,
}: MaintenanceViewDialogProps) {
  const queryClient = useQueryClient();

  // Fetch reservation data
  const { data: reservation, isLoading } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${reservationId}`],
    enabled: !!reservationId && open,
  });

  // Fetch vehicle data
  const { data: vehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${reservation?.vehicleId}`],
    enabled: !!reservation?.vehicleId && open,
  });

  // Fetch customer data if available
  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${reservation?.customerId}`],
    enabled: !!reservation?.customerId && open,
  });

  // Fetch driver data if available
  const { data: driver } = useQuery<Driver>({
    queryKey: [`/api/drivers/${reservation?.driverId}`],
    enabled: !!reservation?.driverId && open,
  });

  // Fetch documents for this reservation
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: [`/api/documents/reservation/${reservationId}`],
    enabled: !!reservationId && open,
  });

  // Parse maintenance notes
  const parseMaintenanceNotes = (notes: string) => {
    const lines = notes.split('\n');
    const firstLine = lines[0] || '';
    const maintenanceType = firstLine.split(': ')[0] || '';
    const description = firstLine.split(': ')[1] || '';
    
    // Extract contact phone if present
    const contactPhoneLine = lines.find(line => line.startsWith('Contact Phone:'));
    const contactPhone = contactPhoneLine ? contactPhoneLine.replace('Contact Phone:', '').trim() : '';
    
    // Get additional notes (everything except first line and contact phone)
    const additionalNotes = lines
      .slice(1)
      .filter(line => !line.startsWith('Contact Phone:'))
      .join('\n')
      .trim();
    
    return {
      maintenanceType,
      description,
      contactPhone,
      notes: additionalNotes
    };
  };

  const parsed = reservation ? parseMaintenanceNotes(reservation.notes || '') : null;

  // Format maintenance type for display
  const formatMaintenanceType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'in':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><Wrench className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'out':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!reservation || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            Loading maintenance details...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Wrench className="h-6 w-6 text-orange-600" />
                Maintenance Details
              </DialogTitle>
              <DialogDescription>
                {vehicle && (
                  <span className="font-medium">
                    {vehicle.brand} {vehicle.model} ({displayLicensePlate(vehicle.licensePlate)})
                  </span>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(reservation.maintenanceStatus || 'scheduled')}
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(reservation)}
                  data-testid="button-edit-maintenance"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Maintenance Information */}
          <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Maintenance Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-orange-700 dark:text-orange-300">Type</label>
                <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mt-1">
                  {parsed?.maintenanceType ? formatMaintenanceType(parsed.maintenanceType) : 'Not specified'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-orange-700 dark:text-orange-300">Description</label>
                <div className="text-sm text-orange-900 dark:text-orange-100 mt-1">
                  {parsed?.description || 'No description provided'}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Information */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <div className="text-sm font-medium mt-1">
                  {format(new Date(reservation.startDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">End Date</label>
                <div className="text-sm font-medium mt-1">
                  {reservation.endDate ? format(new Date(reservation.endDate), 'MMM dd, yyyy') : 'Not set'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Duration</label>
                <div className="text-sm font-medium mt-1">
                  {reservation.maintenanceDuration || 1} day{reservation.maintenanceDuration !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Vehicle Information */}
          {vehicle && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">License Plate</label>
                    <div className="font-medium">{displayLicensePlate(vehicle.licensePlate)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Brand</label>
                    <div className="font-medium">{vehicle.brand}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Model</label>
                    <div className="font-medium">{vehicle.model}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <div className="font-medium">{vehicle.vehicleType || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer/Driver Information - Compact */}
          {(customer || driver || parsed?.contactPhone) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                      <label className="text-xs text-muted-foreground">Customer</label>
                      <div className="font-medium text-sm mt-1">{customer.name}</div>
                      {customer.phone && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  )}
                  {driver && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                      <label className="text-xs text-muted-foreground">Driver</label>
                      <div className="font-medium text-sm mt-1">{driver.displayName}</div>
                      {driver.phone && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </div>
                      )}
                    </div>
                  )}
                  {parsed?.contactPhone && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                      <label className="text-xs text-muted-foreground">Contact Phone</label>
                      <div className="font-medium text-sm mt-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {parsed.contactPhone}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Additional Notes */}
          {parsed?.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border text-sm whitespace-pre-wrap">
                  {parsed.notes}
                </div>
              </div>
            </>
          )}

          {/* Service Documentation */}
          <Separator />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Service Documentation
            </h3>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{doc.documentType}</div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground">{doc.description}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No service documentation uploaded</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
