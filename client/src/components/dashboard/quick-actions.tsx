import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Vehicle } from "@shared/schema";
import { Check, RotateCw } from "lucide-react";

interface ActionIconProps {
  name: string;
  className?: string;
}

function ActionIcon({ name, className = "" }: ActionIconProps) {
  switch (name) {
    case "calendar-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-calendar-plus ${className}`}
        >
          <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
          <line x1="19" x2="19" y1="16" y2="22" />
          <line x1="16" x2="22" y1="19" y2="19" />
        </svg>
      );
    case "car":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-car ${className}`}
        >
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
          <circle cx="6.5" cy="16.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      );
    case "user-plus":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-user-plus ${className}`}
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      );
    case "upload":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-upload ${className}`}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-alert-triangle ${className}`}
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "receipt":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-receipt ${className}`}
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
          <path d="M12 17.5v-11" />
        </svg>
      );
    case "refresh-cw":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`lucide lucide-refresh-cw ${className}`}
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      );
    default:
      return null;
  }
}

// Define quick actions for the dashboard
interface QuickAction {
  label: string;
  href?: string;
  icon: string;
  dialog?: string;
  primary?: boolean;
}

const quickActions: QuickAction[] = [
  {
    label: "New Reservation",
    href: "/reservations/add",
    icon: "calendar-plus",
    primary: false,
  },
  {
    label: "Add Vehicle",
    href: "/vehicles/add",
    icon: "car",
    primary: false,
  },
  {
    label: "Add Customer",
    href: "/customers/add",
    icon: "user-plus",
    primary: false,
  },
  {
    label: "Upload Document",
    href: "/documents/upload",
    icon: "upload",
    primary: false,
  },
  {
    label: "Log Expense",
    href: "/expenses/add",
    icon: "receipt",
    primary: false,
  },
  {
    label: "Change Registration",
    icon: "refresh-cw",
    dialog: "registration",
    primary: false,
  },
];

export function QuickActions() {
  // State for the vehicle registration dialog
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [registrationStatus, setRegistrationStatus] = useState<"opnaam" | "bv">("opnaam");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();
  
  // Fetch all vehicles for the selection list
  const { data: vehicles, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Helper function to format license plates nicely
  const formatLicensePlate = (plate: string) => {
    return plate.replace(/([A-Za-z]{2})([A-Za-z0-9]{2})([A-Za-z0-9]{2})/, '$1-$2-$3');
  };
  
  // Handler for changing a single vehicle's registration
  const handleChangeVehicleRegistration = async (vehicleId: number, newStatus: "opnaam" | "bv") => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/toggle-registration`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update registration status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  };
  
  // Handler for batch changing multiple vehicles' registration
  const handleChangeRegistration = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one vehicle",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    // Track results for reporting
    const results = {
      success: 0,
      failed: 0,
      vehicles: [] as { id: number; licensePlate: string; success: boolean }[]
    };
    
    try {
      // Process each vehicle in sequence
      for (const vehicleIdStr of selectedVehicles) {
        const vehicleId = parseInt(vehicleIdStr);
        try {
          const updatedVehicle = await handleChangeVehicleRegistration(vehicleId, registrationStatus);
          results.success++;
          results.vehicles.push({ 
            id: vehicleId, 
            licensePlate: updatedVehicle.licensePlate, 
            success: true 
          });
        } catch (error) {
          results.failed++;
          const vehicle = vehicles?.find(v => v.id === vehicleId);
          results.vehicles.push({ 
            id: vehicleId, 
            licensePlate: vehicle?.licensePlate || `ID: ${vehicleId}`, 
            success: false 
          });
        }
      }
      
      // Determine appropriate message based on results
      if (results.success > 0 && results.failed === 0) {
        toast({
          title: "Success",
          description: `Registration updated to ${registrationStatus === "opnaam" ? "Opnaam" : "BV"} for ${results.success} vehicle${results.success > 1 ? 's' : ''}`,
        });
      } else if (results.success > 0 && results.failed > 0) {
        toast({
          title: "Partial Success",
          description: `Updated ${results.success} vehicle${results.success > 1 ? 's' : ''}, but failed for ${results.failed} vehicle${results.failed > 1 ? 's' : ''}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed",
          description: `Failed to update registration for all ${results.failed} selected vehicles`,
          variant: "destructive",
        });
      }
      
      // Refresh the vehicle list
      refetchVehicles();
      
      // Reset selection
      setSelectedVehicles([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update registration status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium text-gray-800">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            // For registration action, render a Dialog
            if (action.dialog === "registration") {
              return (
                <Dialog key={action.label}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-primary-50 text-primary-600 hover:bg-primary-100"
                      size="sm"
                    >
                      <ActionIcon name={action.icon || "refresh-cw"} className="mr-1 h-4 w-4" />
                      {action.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Change Vehicle Registration Status</DialogTitle>
                      <DialogDescription>
                        Select vehicles to change registration status to "Opnaam" (Person) or "BV" (Company).
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Search and selection area */}
                      <div className="grid gap-2">
                        <div className="flex justify-between items-center mb-2">
                          <label htmlFor="search" className="text-sm font-medium">
                            Find Vehicles
                          </label>
                          <span className="text-xs text-muted-foreground">
                            {selectedVehicles.length} selected
                          </span>
                        </div>
                        
                        <Input
                          id="search"
                          placeholder="Search by license plate, brand or model"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
                          className="mb-2"
                        />
                        
                        <div className="border rounded-md h-[250px] overflow-y-auto p-1">
                          {vehicles && vehicles.length > 0 ? (
                            (() => {
                              // Filter vehicles based on search query
                              const filteredVehicles = searchQuery 
                                ? vehicles.filter(v => 
                                    v.licensePlate.toLowerCase().includes(searchQuery) || 
                                    (v.brand?.toLowerCase() || '').includes(searchQuery) || 
                                    (v.model?.toLowerCase() || '').includes(searchQuery)
                                  )
                                : vehicles;
                              
                              // Group vehicles by registration status and then by brand
                              const vehicleGroups: Record<string, Record<string, Vehicle[]>> = {
                                'Opnaam (Person)': {},
                                'BV (Company)': {},
                                'Other': {}
                              };
                              
                              filteredVehicles.forEach(vehicle => {
                                let statusGroup = 'Other';
                                if (vehicle.registeredTo) statusGroup = 'Opnaam (Person)';
                                else if (vehicle.company) statusGroup = 'BV (Company)';
                                
                                const brand = vehicle.brand || 'Other';
                                if (!vehicleGroups[statusGroup][brand]) vehicleGroups[statusGroup][brand] = [];
                                vehicleGroups[statusGroup][brand].push(vehicle);
                              });
                              
                              return filteredVehicles.length === 0 ? (
                                <div className="p-2 text-center text-sm text-muted-foreground">
                                  No vehicles match your search
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {Object.entries(vehicleGroups).map(([status, brands]) => {
                                    const hasVehicles = Object.values(brands).some(vehicles => vehicles.length > 0);
                                    if (!hasVehicles) return null;
                                    
                                    return (
                                      <div key={status} className="space-y-2">
                                        <div className="sticky top-0 z-10 bg-background px-2 py-1 text-sm font-semibold border-b">
                                          {status}
                                        </div>
                                        {Object.entries(brands).map(([brand, brandVehicles]) => {
                                          if (brandVehicles.length === 0) return null;
                                          
                                          return (
                                            <div key={brand} className="pl-2 space-y-1">
                                              <div className="text-xs font-medium text-muted-foreground">{brand}</div>
                                              <div className="space-y-1">
                                                {brandVehicles.map(vehicle => (
                                                  <label 
                                                    key={vehicle.id} 
                                                    className="flex items-center space-x-2 p-1 rounded hover:bg-accent cursor-pointer text-sm"
                                                  >
                                                    <input 
                                                      type="checkbox"
                                                      className="rounded"
                                                      checked={selectedVehicles.includes(vehicle.id.toString())}
                                                      onChange={(e) => {
                                                        if (e.target.checked) {
                                                          setSelectedVehicles([...selectedVehicles, vehicle.id.toString()]);
                                                        } else {
                                                          setSelectedVehicles(selectedVehicles.filter(id => id !== vehicle.id.toString()));
                                                        }
                                                      }}
                                                    />
                                                    <span className="flex flex-col">
                                                      <span className="flex items-center gap-2">
                                                        {formatLicensePlate(vehicle.licensePlate)} - {vehicle.model}
                                                        {vehicle.registeredTo && (
                                                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                                                            Opnaam
                                                          </span>
                                                        )}
                                                        {vehicle.company && (
                                                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200">
                                                            BV
                                                          </span>
                                                        )}
                                                      </span>
                                                      <span className="text-xs text-muted-foreground">
                                                        {vehicle.registeredToDate && vehicle.registeredTo ? 
                                                          `Registered since: ${new Date(vehicle.registeredToDate).toLocaleDateString()}` : 
                                                          vehicle.company ? 
                                                            vehicle.companyDate ? 
                                                              `In BV since: ${new Date(vehicle.companyDate).toLocaleDateString()}` : 
                                                              'In BV (date unknown)' 
                                                            : 'Not registered'}
                                                      </span>
                                                    </span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="p-2 text-center text-sm text-muted-foreground">
                              No vehicles available
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Registration type selection */}
                      <div className="grid gap-2">
                        <label htmlFor="registration" className="text-sm font-medium">
                          New Registration Status
                        </label>
                        <Select value={registrationStatus} onValueChange={(value: "opnaam" | "bv") => setRegistrationStatus(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="opnaam">Opnaam (Person)</SelectItem>
                            <SelectItem value="bv">BV (Company)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button 
                        onClick={handleChangeRegistration} 
                        disabled={isLoading || selectedVehicles.length === 0}
                      >
                        {isLoading 
                          ? <><RotateCw className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                          : <><Check className="mr-2 h-4 w-4" /> Update {selectedVehicles.length} vehicle{selectedVehicles.length !== 1 ? 's' : ''}</>
                        }
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            }
            
            // For actions with hrefs, render a Link
            if (action.href) {
              return (
                <Link key={action.label} href={action.href || ""}>
                  <Button
                    variant={action.primary ? "default" : "outline"}
                    className={
                      action.primary
                        ? "bg-primary-600 text-white hover:bg-primary-700"
                        : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                    }
                    size="sm"
                  >
                    <ActionIcon name={action.icon || ""} className="mr-1 h-4 w-4" />
                    {action.label}
                  </Button>
                </Link>
              );
            }
            
            return null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}