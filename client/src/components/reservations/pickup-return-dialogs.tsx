import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Reservation } from "@shared/schema";
import { Car, Fuel, Calendar, FileText, ClipboardCheck } from "lucide-react";
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
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [pendingMileage, setPendingMileage] = useState<number | null>(null);
  const [overridePassword, setOverridePassword] = useState<string>("");
  const [damageCheckDialogOpen, setDamageCheckDialogOpen] = useState(false);

  useEffect(() => {
    if (open && reservation) {
      setPickupMileage(reservation.vehicle?.currentMileage?.toString() || "");
      setFuelLevelPickup(reservation.vehicle?.currentFuelLevel || "Full");
      setPickupDate(new Date().toISOString().split('T')[0]);
      setPickupNotes("");
      setOverridePassword("");
      setPendingMileage(null);
    }
  }, [open, reservation]);

  const pickupMutation = useMutation({
    mutationFn: async (data: {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const mileage = parseInt(pickupMileage);
    if (isNaN(mileage) || mileage < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Mileage",
        description: "Please enter a valid mileage value.",
      });
      return;
    }

    pickupMutation.mutate({
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
                <div className="flex items-center">
                  <span className="text-muted-foreground mr-1">Customer:</span>
                  <span className="font-medium">{reservation.customer?.name}</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Pickup Details */}
            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
              <h3 className="font-semibold text-base">Pickup Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder={reservation.vehicle?.currentMileage ? `Current: ${reservation.vehicle.currentMileage.toLocaleString()} km` : "Enter pickup mileage"}
                    required
                    className="bg-white"
                    data-testid="input-pickup-mileage"
                  />
                  <p className="text-xs text-muted-foreground">
                    Odometer reading at pickup
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Fuel Level */}
            <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
              <h3 className="font-semibold text-base">Fuel Level</h3>
              
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

            {/* Damage Check Section */}
            <div className="border rounded-lg p-4 bg-green-50 space-y-3">
              <h3 className="font-semibold text-base">Damage Check</h3>
              <p className="text-sm text-muted-foreground">
                Create an interactive damage check to document the vehicle's condition at pickup
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={() => setDamageCheckDialogOpen(true)}
                data-testid="button-open-pickup-damage-check"
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Create Pickup Damage Check
              </Button>
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
            onClose={() => setDamageCheckDialogOpen(false)}
            initialVehicleId={reservation.vehicleId}
            initialReservationId={reservation.id}
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
            {/* Section 1: Completion Details */}
            <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
              <h3 className="font-semibold text-base">Completion Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </div>

            {/* Section 2: Fuel Tracking */}
            <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
              <h3 className="font-semibold text-base">Fuel Tracking</h3>
              
              {/* Show Pickup Fuel Level Reference */}
              {reservation.fuelLevelPickup && (
                <div className="bg-white border border-blue-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Fuel at Pickup</h4>
                      <p className="text-xs text-blue-700 mt-0.5">Reference for comparison</p>
                    </div>
                    <span className="text-base font-semibold text-blue-900">
                      {reservation.fuelLevelPickup}
                    </span>
                  </div>
                </div>
              )}

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
                </p>
              </div>
            </div>

            {/* Damage Check Section */}
            <div className="border rounded-lg p-4 bg-green-50 space-y-3">
              <h3 className="font-semibold text-base">Damage Check</h3>
              <p className="text-sm text-muted-foreground">
                Create an interactive damage check to document the vehicle's condition at return
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white"
                onClick={() => setDamageCheckDialogOpen(true)}
                data-testid="button-open-return-damage-check"
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Create Return Damage Check
              </Button>
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
            onClose={() => setDamageCheckDialogOpen(false)}
            initialVehicleId={reservation.vehicleId}
            initialReservationId={reservation.id}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
