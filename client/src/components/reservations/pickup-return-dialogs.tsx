import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Reservation } from "@shared/schema";
import { Car, Fuel, Calendar, FileText, ClipboardCheck, ExternalLink, CheckCircle2, Edit, Trash2 } from "lucide-react";
import { MileageOverridePasswordDialog } from "@/components/mileage-override-password-dialog";
import InteractiveDamageCheck from "@/pages/interactive-damage-check";

interface PickupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
  onSuccess?: () => void | Promise<void>;
}

export function PickupDialog({ open, onOpenChange, reservation, onSuccess }: PickupDialogProps) {
  const { toast } = useToast();
  const isTBDSpare = reservation.placeholderSpare && !reservation.vehicleId;
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [pickupMileage, setPickupMileage] = useState(
    reservation.vehicle?.currentMileage?.toString() || ""
  );
  const [fuelLevelPickup, setFuelLevelPickup] = useState(
    reservation.vehicle?.currentFuelLevel || "Full"
  );
  const [pickupDate, setPickupDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [pickupNotes, setPickupNotes] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [isDuplicateContract, setIsDuplicateContract] = useState(false);
  const [isHighContractNumber, setIsHighContractNumber] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [pendingMileage, setPendingMileage] = useState<number | null>(null);
  const [overridePassword, setOverridePassword] = useState<string>("");
  const [damageCheckDialogOpen, setDamageCheckDialogOpen] = useState(false);
  const [editingDamageCheckId, setEditingDamageCheckId] = useState<number | null>(null);

  // Fetch available vehicles for TBD spare selection
  const { data: vehicles } = useQuery<any[]>({
    queryKey: ['/api/vehicles/available'],
    enabled: open && isTBDSpare,
  });

  // Fetch existing damage checks for this reservation
  const { data: damageChecks } = useQuery<any[]>({
    queryKey: ['/api/interactive-damage-checks', 'reservation', reservation.id],
    queryFn: async () => {
      const response = await fetch(`/api/interactive-damage-checks/reservation/${reservation.id}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!reservation.id,
  });

  const pickupDamageChecks = damageChecks?.filter((check: any) => check.checkType === 'pickup') || [];
  
  // Get selected vehicle data
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);

  // Auto-generate contract number when dialog opens
  useEffect(() => {
    async function loadContractNumber() {
      if (open && reservation && !reservation.contractNumber) {
        try {
          const response = await fetch('/api/reservations/next-contract-number', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setContractNumber(data.nextContractNumber);
          }
        } catch (error) {
          console.error('Failed to fetch next contract number:', error);
        }
      }
    }
    loadContractNumber();
  }, [open, reservation]);

  useEffect(() => {
    if (open && reservation) {
      setSelectedVehicleId(null);
      setPickupMileage(reservation.vehicle?.currentMileage?.toString() || selectedVehicle?.currentMileage?.toString() || "");
      setFuelLevelPickup(reservation.vehicle?.currentFuelLevel || selectedVehicle?.currentFuelLevel || "Full");
      setPickupDate(new Date().toISOString().split('T')[0]);
      setPickupNotes("");
      setContractNumber(reservation.contractNumber || "");
      setIsDuplicateContract(false);
      setIsHighContractNumber(false);
      setOverridePassword("");
      setPendingMileage(null);
    }
  }, [open, reservation]);
  
  // Check for duplicate contract numbers and high numbers
  useEffect(() => {
    async function checkContractNumber() {
      if (!contractNumber || contractNumber.trim() === "") {
        setIsDuplicateContract(false);
        setIsHighContractNumber(false);
        return;
      }

      const trimmedNumber = contractNumber.trim();
      
      // Check for duplicates
      try {
        const response = await fetch(`/api/reservations/check-contract-number?number=${encodeURIComponent(trimmedNumber)}&excludeId=${reservation.id}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsDuplicateContract(data.exists);
        }
      } catch (error) {
        console.error('Failed to check contract number:', error);
      }

      // Check if number is unusually high
      const numValue = parseInt(trimmedNumber, 10);
      if (!isNaN(numValue) && numValue > 9999) {
        setIsHighContractNumber(true);
      } else {
        setIsHighContractNumber(false);
      }
    }

    const debounceTimer = setTimeout(checkContractNumber, 300);
    return () => clearTimeout(debounceTimer);
  }, [contractNumber, reservation.id]);

  // Update mileage and fuel when vehicle is selected for TBD spare
  useEffect(() => {
    if (isTBDSpare && selectedVehicle) {
      setPickupMileage(selectedVehicle.currentMileage?.toString() || "");
      setFuelLevelPickup(selectedVehicle.currentFuelLevel || "Full");
    }
  }, [selectedVehicleId, selectedVehicle, isTBDSpare]);

  const pickupMutation = useMutation({
    mutationFn: async (data: {
      contractNumber: string;
      pickupMileage: number;
      fuelLevelPickup: string;
      pickupDate: string;
      pickupNotes?: string;
      allowMileageDecrease?: boolean;
      overridePassword?: string;
    }) => {
      return await apiRequest("POST", `/api/reservations/${reservation.id}/pickup`, data);
    },
    onSuccess: async () => {
      toast({
        title: "Pickup Completed",
        description: "Vehicle picked up successfully. Contract has been generated.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations", reservation.id] });
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/reservation/${reservation.id}`] });
      setOverridePassword("");
      setPendingMileage(null);
      
      // Call the success callback first (to reopen view dialog)
      if (onSuccess) {
        await onSuccess();
      }
      
      // Then close the pickup dialog
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (error.requiresOverride) {
        setPendingMileage(parseInt(pickupMileage));
        setOverrideDialogOpen(true);
        return;
      }
      toast({
        variant: "destructive",
        title: "Pickup Failed",
        description: error.message || "Failed to process pickup. Please try again.",
      });
    },
  });

  const handleOverrideConfirm = async (password: string): Promise<boolean> => {
    try {
      setOverridePassword(password);
      
      if (pendingMileage === null) return false;
      
      pickupMutation.mutate({
        contractNumber: contractNumber.trim(),
        pickupMileage: pendingMileage,
        fuelLevelPickup,
        pickupDate,
        pickupNotes: pickupNotes || undefined,
        allowMileageDecrease: true,
        overridePassword: password,
      });
      
      setOverrideDialogOpen(false);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate contract number
    if (!contractNumber || contractNumber.trim() === "") {
      toast({
        variant: "destructive",
        title: "Contract Number Required",
        description: "Please enter a contract number before completing pickup.",
      });
      return;
    }

    // Check for duplicate contract number
    if (isDuplicateContract) {
      toast({
        variant: "destructive",
        title: "Duplicate Contract Number",
        description: "This contract number already exists. Please use a different number.",
      });
      return;
    }
    
    // Check if TBD spare and no vehicle selected
    if (isTBDSpare && !selectedVehicleId) {
      toast({
        variant: "destructive",
        title: "Vehicle Required",
        description: "Please select a vehicle for this spare reservation.",
      });
      return;
    }
    
    const mileage = parseInt(pickupMileage);
    if (isNaN(mileage) || mileage < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Mileage",
        description: "Please enter a valid mileage value.",
      });
      return;
    }

    // If TBD spare, assign vehicle first
    if (isTBDSpare && selectedVehicleId) {
      try {
        const assignResponse = await apiRequest('PATCH', `/api/reservations/${reservation.id}`, {
          vehicleId: selectedVehicleId
        });
        
        if (!assignResponse.ok) {
          throw new Error('Failed to assign vehicle');
        }
        
        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/reservations", reservation.id] });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Assignment Failed",
          description: "Failed to assign vehicle to reservation.",
        });
        return;
      }
    }

    pickupMutation.mutate({
      contractNumber: contractNumber.trim(),
      pickupMileage: mileage,
      fuelLevelPickup,
      pickupDate,
      pickupNotes: pickupNotes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Start Pickup Process
          </DialogTitle>
          <DialogDescription>
            Enter the vehicle's current mileage and fuel level at pickup. A contract will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* TBD Spare Vehicle Selection */}
          {isTBDSpare ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-yellow-700" />
                  <h3 className="font-medium text-yellow-900">TBD Spare Vehicle - Select Vehicle</h3>
                </div>
                <p className="text-sm text-yellow-800">
                  This is a placeholder spare reservation. Please select the actual vehicle for pickup.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="vehicle-select">Select Vehicle</Label>
                  <VehicleSelector
                    vehicles={vehicles || []}
                    value={selectedVehicleId?.toString() || ""}
                    onChange={(value) => setSelectedVehicleId(parseInt(value))}
                    placeholder="Choose an available vehicle..."
                  />
                </div>
                {selectedVehicle && (
                  <div className="bg-white rounded p-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Current Mileage: {selectedVehicle.currentMileage?.toLocaleString() || 'N/A'} km</span>
                      <span>•</span>
                      <span>Fuel: {selectedVehicle.currentFuelLevel || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Vehicle Information */
            <div className="bg-muted/50 rounded-md p-3">
              <div className="space-y-1">
                <h3 className="font-medium text-sm">Vehicle Information</h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">License:</span>
                    <span className="font-medium">{reservation.vehicle?.licensePlate}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">Vehicle:</span>
                    <span className="font-medium">{reservation.vehicle?.brand} {reservation.vehicle?.model}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">Customer:</span>
                    <span className="font-medium">{reservation.customer?.name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Combined Pickup Details and Fuel Level */}
            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
              <h3 className="font-semibold text-base">Pickup Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">
                    Contract Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contractNumber"
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Auto-generated (editable)"
                    required
                    className={`bg-white ${isDuplicateContract ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    data-testid="input-contract-number"
                  />
                  {isDuplicateContract && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      ⚠️ This contract number already exists!
                    </p>
                  )}
                  {isHighContractNumber && !isDuplicateContract && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      ⚠️ Unusually high number - please verify
                    </p>
                  )}
                  {!isDuplicateContract && !isHighContractNumber && (
                    <p className="text-xs text-muted-foreground">
                      Auto-generated, you can edit if needed
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pickupDate">
                    Pickup Date
                  </Label>
                  <Input
                    id="pickupDate"
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    required
                    className="bg-white"
                    data-testid="input-pickup-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    When the vehicle is being picked up
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickupMileage">
                    Mileage at pickup
                  </Label>
                  <Input
                    id="pickupMileage"
                    type="number"
                    value={pickupMileage}
                    onChange={(e) => setPickupMileage(e.target.value)}
                    placeholder={
                      isTBDSpare && selectedVehicle
                        ? `Current: ${selectedVehicle.currentMileage?.toLocaleString() || 0} km`
                        : reservation.vehicle?.currentMileage 
                        ? `Current: ${reservation.vehicle.currentMileage.toLocaleString()} km` 
                        : "Enter pickup mileage"
                    }
                    required
                    className="bg-white"
                    data-testid="input-pickup-mileage"
                  />
                  <p className="text-xs text-muted-foreground">
                    Odometer reading at pickup
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelLevelPickup">
                    Fuel Level at Pickup
                  </Label>
                  <Select value={fuelLevelPickup} onValueChange={setFuelLevelPickup}>
                    <SelectTrigger className="bg-white" data-testid="select-fuel-level-pickup">
                      <SelectValue placeholder="Select fuel level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="3/4">3/4</SelectItem>
                      <SelectItem value="1/2">1/2</SelectItem>
                      <SelectItem value="1/4">1/4</SelectItem>
                      <SelectItem value="Empty">Empty</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Current fuel level in the tank
                  </p>
                </div>
              </div>
            </div>

            {/* Damage Check Section */}
            <div className="border rounded-lg p-4 bg-green-50 space-y-3">
              <h3 className="font-semibold text-base">Damage Check</h3>
              
              {pickupDamageChecks.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const check = pickupDamageChecks[0]; // Only one check per type
                    return (
                      <div className="bg-white border rounded-md p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm flex-1">
                            <p className="font-medium">
                              Created {new Date(check.createdAt).toLocaleDateString()} at {new Date(check.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {check.createdBy && (
                              <p className="text-xs text-muted-foreground">by {check.createdBy}</p>
                            )}
                            {check.updatedBy && check.updatedBy !== check.createdBy && (
                              <p className="text-xs text-muted-foreground">
                                Last edited by {check.updatedBy}
                              </p>
                            )}
                            {check.pdfPath && (
                              <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                PDF generated
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingDamageCheckId(check.id);
                                setDamageCheckDialogOpen(true);
                              }}
                              title="View/Edit damage check"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {check.pdfPath && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(check.pdfPath, '_blank')}
                                title="View PDF"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                PDF
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (confirm('Delete this pickup damage check? This cannot be undone.')) {
                                  try {
                                    await apiRequest('DELETE', `/api/interactive-damage-checks/${check.id}`, {});
                                    queryClient.invalidateQueries({ queryKey: ['/api/interactive-damage-checks'] });
                                    toast({
                                      title: "Deleted",
                                      description: "Pickup damage check deleted successfully",
                                    });
                                  } catch (error) {
                                    toast({
                                      variant: "destructive",
                                      title: "Error",
                                      description: "Failed to delete damage check",
                                    });
                                  }
                                }
                              }}
                              title="Delete damage check"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Create an interactive damage check to document the vehicle's condition at pickup
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => {
                      setEditingDamageCheckId(null);
                      setDamageCheckDialogOpen(true);
                    }}
                    data-testid="button-open-pickup-damage-check"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Create Pickup Damage Check
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupNotes">Additional Notes (Optional)</Label>
              <Textarea
                id="pickupNotes"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="Any additional notes about the pickup..."
                rows={3}
                data-testid="textarea-pickup-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pickupMutation.isPending}
                data-testid="button-cancel-pickup"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pickupMutation.isPending}
                data-testid="button-confirm-pickup"
              >
                {pickupMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Pickup & Generate Contract
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>

      {/* Mileage Override Dialog */}
      <MileageOverridePasswordDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        onConfirm={handleOverrideConfirm}
        currentMileage={reservation.vehicle?.currentMileage || 0}
        newMileage={pendingMileage || 0}
      />

      {/* Damage Check Dialog */}
      <Dialog open={damageCheckDialogOpen} onOpenChange={setDamageCheckDialogOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Interactive Damage Check - Pickup</DialogTitle>
          <InteractiveDamageCheck
            onClose={() => {
              setDamageCheckDialogOpen(false);
              setEditingDamageCheckId(null);
              queryClient.invalidateQueries({ queryKey: ['/api/interactive-damage-checks'] });
            }}
            editingCheckId={editingDamageCheckId}
            initialVehicleId={isTBDSpare && selectedVehicleId ? selectedVehicleId : reservation.vehicleId}
            initialReservationId={reservation.id}
            initialMileage={pickupMileage}
            initialFuelLevel={fuelLevelPickup}
            initialDate={pickupDate}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
  onSuccess?: () => void | Promise<void>;
}

export function ReturnDialog({ open, onOpenChange, reservation, onSuccess }: ReturnDialogProps) {
  const { toast } = useToast();
  const [returnMileage, setReturnMileage] = useState(
    reservation.pickupMileage?.toString() || reservation.vehicle?.currentMileage?.toString() || ""
  );
  const [fuelLevelReturn, setFuelLevelReturn] = useState("Full");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [returnNotes, setReturnNotes] = useState("");
  const [damageCheckDialogOpen, setDamageCheckDialogOpen] = useState(false);
  const [editingDamageCheckId, setEditingDamageCheckId] = useState<number | null>(null);

  // Fetch existing damage checks for this reservation
  const { data: damageChecks } = useQuery<any[]>({
    queryKey: ['/api/interactive-damage-checks', 'reservation', reservation.id],
    queryFn: async () => {
      const response = await fetch(`/api/interactive-damage-checks/reservation/${reservation.id}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!reservation.id,
  });

  const returnDamageChecks = damageChecks?.filter((check: any) => check.checkType === 'return') || [];

  useEffect(() => {
    if (open && reservation) {
      setReturnMileage(
        reservation.pickupMileage?.toString() || reservation.vehicle?.currentMileage?.toString() || ""
      );
      setFuelLevelReturn("Full");
      setReturnDate(new Date().toISOString().split('T')[0]);
      setReturnNotes("");
    }
  }, [open, reservation]);

  const returnMutation = useMutation({
    mutationFn: async (data: {
      returnMileage: number;
      fuelLevelReturn: string;
      returnDate: string;
      returnNotes?: string;
    }) => {
      return await apiRequest("POST", `/api/reservations/${reservation.id}/return`, data);
    },
    onSuccess: async () => {
      toast({
        title: "Return Completed",
        description: "Vehicle returned successfully. Damage check has been generated.",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/reservations", reservation.id] });
      await queryClient.invalidateQueries({ queryKey: [`/api/documents/reservation/${reservation.id}`] });
      
      // Call the success callback first (to reopen view dialog)
      if (onSuccess) {
        await onSuccess();
      }
      
      // Then close the return dialog
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Return Failed",
        description: error.message || "Failed to process return. Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const mileage = parseInt(returnMileage);
    if (isNaN(mileage) || mileage < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Mileage",
        description: "Please enter a valid mileage value.",
      });
      return;
    }

    if (reservation.pickupMileage && mileage < reservation.pickupMileage) {
      toast({
        variant: "destructive",
        title: "Invalid Mileage",
        description: `Return mileage cannot be less than pickup mileage (${reservation.pickupMileage} km).`,
      });
      return;
    }

    returnMutation.mutate({
      returnMileage: mileage,
      fuelLevelReturn,
      returnDate,
      returnNotes: returnNotes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Start Return Process
          </DialogTitle>
          <DialogDescription>
            Enter the vehicle's current mileage and fuel level at return. A damage check will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vehicle Information */}
          <div className="bg-muted/50 rounded-md p-3">
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Vehicle Information</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">License:</span>
                  <span className="font-medium">{reservation.vehicle?.licensePlate}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">Vehicle:</span>
                  <span className="font-medium">{reservation.vehicle?.brand} {reservation.vehicle?.model}</span>
                </div>
                {reservation.pickupMileage && (
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-1">At pickup:</span>
                    <span className="font-medium">{reservation.pickupMileage.toLocaleString()} km</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Combined Completion Details and Fuel Tracking */}
            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
              <h3 className="font-semibold text-base">Completion Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="returnDate">
                    Return Date
                  </Label>
                  <Input
                    id="returnDate"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                    className="bg-white"
                    data-testid="input-return-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    When the vehicle was actually returned
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="returnMileage">
                    Mileage when returned
                  </Label>
                  <Input
                    id="returnMileage"
                    type="number"
                    value={returnMileage}
                    onChange={(e) => setReturnMileage(e.target.value)}
                    placeholder={reservation.pickupMileage ? `Pickup: ${reservation.pickupMileage.toLocaleString()} km` : "Enter return mileage"}
                    required
                    className="bg-white"
                    data-testid="input-return-mileage"
                  />
                  <p className="text-xs text-muted-foreground">
                    Odometer reading at return
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelLevelReturn">
                    Fuel Level at Return
                  </Label>
                  <Select value={fuelLevelReturn} onValueChange={setFuelLevelReturn}>
                    <SelectTrigger className="bg-white" data-testid="select-fuel-level-return">
                      <SelectValue placeholder="Select fuel level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="3/4">3/4</SelectItem>
                      <SelectItem value="1/2">1/2</SelectItem>
                      <SelectItem value="1/4">1/4</SelectItem>
                      <SelectItem value="Empty">Empty</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Current fuel level in the tank
                    {reservation.fuelLevelPickup && (
                      <span className="block text-blue-700 font-medium mt-0.5">
                        At pickup: {reservation.fuelLevelPickup}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Damage Check Section */}
            <div className="border rounded-lg p-4 bg-green-50 space-y-3">
              <h3 className="font-semibold text-base">Damage Check</h3>
              
              {returnDamageChecks.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const check = returnDamageChecks[0]; // Only one check per type
                    return (
                      <div className="bg-white border rounded-md p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm flex-1">
                            <p className="font-medium">
                              Created {new Date(check.createdAt).toLocaleDateString()} at {new Date(check.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {check.createdBy && (
                              <p className="text-xs text-muted-foreground">by {check.createdBy}</p>
                            )}
                            {check.updatedBy && check.updatedBy !== check.createdBy && (
                              <p className="text-xs text-muted-foreground">
                                Last edited by {check.updatedBy}
                              </p>
                            )}
                            {check.pdfPath && (
                              <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                PDF generated
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingDamageCheckId(check.id);
                                setDamageCheckDialogOpen(true);
                              }}
                              title="View/Edit damage check"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {check.pdfPath && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(check.pdfPath, '_blank')}
                                title="View PDF"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                PDF
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (confirm('Delete this return damage check? This cannot be undone.')) {
                                  try {
                                    await apiRequest('DELETE', `/api/interactive-damage-checks/${check.id}`, {});
                                    queryClient.invalidateQueries({ queryKey: ['/api/interactive-damage-checks'] });
                                    toast({
                                      title: "Deleted",
                                      description: "Return damage check deleted successfully",
                                    });
                                  } catch (error) {
                                    toast({
                                      variant: "destructive",
                                      title: "Error",
                                      description: "Failed to delete damage check",
                                    });
                                  }
                                }
                              }}
                              title="Delete damage check"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Create an interactive damage check to document the vehicle's condition at return
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-white"
                    onClick={() => {
                      setEditingDamageCheckId(null);
                      setDamageCheckDialogOpen(true);
                    }}
                    data-testid="button-open-return-damage-check"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Create Return Damage Check
                  </Button>
                </>
              )}
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="returnNotes">Additional Notes (Optional)</Label>
              <Textarea
                id="returnNotes"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Any additional notes about the return (damage, issues, etc.)..."
                rows={3}
                data-testid="textarea-return-notes"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={returnMutation.isPending}
                data-testid="button-cancel-return"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={returnMutation.isPending}
                data-testid="button-confirm-return"
              >
                {returnMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Return & Generate Damage Check
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>

      {/* Damage Check Dialog */}
      <Dialog open={damageCheckDialogOpen} onOpenChange={setDamageCheckDialogOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Interactive Damage Check - Return</DialogTitle>
          <InteractiveDamageCheck
            onClose={() => {
              setDamageCheckDialogOpen(false);
              setEditingDamageCheckId(null);
              queryClient.invalidateQueries({ queryKey: ['/api/interactive-damage-checks'] });
            }}
            editingCheckId={editingDamageCheckId}
            initialVehicleId={reservation.vehicleId}
            initialReservationId={reservation.id}
            initialCheckType="return"
            compareWithCheckId={damageChecks?.find((check: any) => check.checkType === 'pickup')?.id || null}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
