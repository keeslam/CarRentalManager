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
import { Car, Fuel, Calendar, FileText } from "lucide-react";
import { MileageOverridePasswordDialog } from "@/components/mileage-override-password-dialog";

interface PickupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
}

export function PickupDialog({ open, onOpenChange, reservation }: PickupDialogProps) {
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
    onSuccess: () => {
      toast({
        title: "Pickup Completed",
        description: "Vehicle picked up successfully. Contract has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations", reservation.id] });
      setOverridePassword("");
      setPendingMileage(null);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Start Pickup Process
          </DialogTitle>
          <DialogDescription>
            Enter the vehicle's current mileage and fuel level at pickup. A contract will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Vehicle</p>
              <p className="text-sm text-muted-foreground">
                {reservation.vehicle?.brand} {reservation.vehicle?.model}
              </p>
              <p className="text-xs text-muted-foreground">{reservation.vehicle?.licensePlate}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Customer</p>
              <p className="text-sm text-muted-foreground">{reservation.customer?.name}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupMileage" className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Pickup Mileage (km)
                </Label>
                <Input
                  id="pickupMileage"
                  type="number"
                  value={pickupMileage}
                  onChange={(e) => setPickupMileage(e.target.value)}
                  placeholder="Enter current mileage"
                  required
                  data-testid="input-pickup-mileage"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {reservation.vehicle?.currentMileage || "Unknown"} km
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelLevelPickup" className="flex items-center gap-2">
                  <Fuel className="h-4 w-4" />
                  Fuel Level at Pickup
                </Label>
                <Select value={fuelLevelPickup} onValueChange={setFuelLevelPickup}>
                  <SelectTrigger data-testid="select-fuel-level-pickup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">Full</SelectItem>
                    <SelectItem value="3/4">3/4</SelectItem>
                    <SelectItem value="1/2">1/2</SelectItem>
                    <SelectItem value="1/4">1/4</SelectItem>
                    <SelectItem value="Empty">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Pickup Date
              </Label>
              <Input
                id="pickupDate"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                required
                data-testid="input-pickup-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupNotes">Notes (Optional)</Label>
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
    </Dialog>
  );
}

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
}

export function ReturnDialog({ open, onOpenChange, reservation }: ReturnDialogProps) {
  const { toast } = useToast();
  const [returnMileage, setReturnMileage] = useState(
    reservation.pickupMileage?.toString() || reservation.vehicle?.currentMileage?.toString() || ""
  );
  const [fuelLevelReturn, setFuelLevelReturn] = useState("Full");
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [returnNotes, setReturnNotes] = useState("");

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
    onSuccess: () => {
      toast({
        title: "Return Completed",
        description: "Vehicle returned successfully. Damage check has been generated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations", reservation.id] });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Start Return Process
          </DialogTitle>
          <DialogDescription>
            Enter the vehicle's current mileage and fuel level at return. A damage check will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Vehicle</p>
              <p className="text-sm text-muted-foreground">
                {reservation.vehicle?.brand} {reservation.vehicle?.model}
              </p>
              <p className="text-xs text-muted-foreground">{reservation.vehicle?.licensePlate}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Pickup Info</p>
              <p className="text-sm text-muted-foreground">
                Mileage: {reservation.pickupMileage || "N/A"} km
              </p>
              <p className="text-sm text-muted-foreground">
                Fuel: {reservation.fuelLevelPickup || "N/A"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="returnMileage" className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Return Mileage (km)
                </Label>
                <Input
                  id="returnMileage"
                  type="number"
                  value={returnMileage}
                  onChange={(e) => setReturnMileage(e.target.value)}
                  placeholder="Enter current mileage"
                  required
                  data-testid="input-return-mileage"
                />
                <p className="text-xs text-muted-foreground">
                  At pickup: {reservation.pickupMileage || "Unknown"} km
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelLevelReturn" className="flex items-center gap-2">
                  <Fuel className="h-4 w-4" />
                  Fuel Level at Return
                </Label>
                <Select value={fuelLevelReturn} onValueChange={setFuelLevelReturn}>
                  <SelectTrigger data-testid="select-fuel-level-return">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full">Full</SelectItem>
                    <SelectItem value="3/4">3/4</SelectItem>
                    <SelectItem value="1/2">1/2</SelectItem>
                    <SelectItem value="1/4">1/4</SelectItem>
                    <SelectItem value="Empty">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Return Date
              </Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                data-testid="input-return-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnNotes">Notes (Optional)</Label>
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
    </Dialog>
  );
}
