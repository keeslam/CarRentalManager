import * as React from "react";
import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, CarFront } from "lucide-react";
import { cn, isTrueValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatLicensePlate } from "@/lib/format-utils";
import { Vehicle } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  recentVehicleIds?: string[];
}

export function VehicleSelector({
  vehicles,
  value,
  onChange,
  placeholder = "Select a vehicle...",
  disabled = false,
  className,
  recentVehicleIds = [],
}: VehicleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Get all unique vehicle types
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    const types = new Set<string>();
    vehicles.forEach(vehicle => {
      if (vehicle.vehicleType) {
        types.add(vehicle.vehicleType);
      }
    });
    return Array.from(types);
  }, [vehicles]);

  // Filter vehicles based on search query
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    if (!searchQuery) return vehicles;
    
    const query = searchQuery.toLowerCase().trim();
    const queryWithoutDashes = query.replace(/-/g, '');
    
    return vehicles.filter((vehicle) => {
      // For license plate, handle searching with or without dashes
      const licensePlate = vehicle.licensePlate?.toLowerCase() || '';
      const licensePlateWithoutDashes = licensePlate.replace(/-/g, '');
      
      return vehicle.brand?.toLowerCase().includes(query) ||
        vehicle.model?.toLowerCase().includes(query) ||
        licensePlate.includes(query) ||
        licensePlateWithoutDashes.includes(queryWithoutDashes) ||
        vehicle.vehicleType?.toLowerCase().includes(query);
    });
  }, [vehicles, searchQuery]);

  // Filter vehicles based on active tab
  const displayedVehicles = useMemo(() => {
    if (activeTab === "all") return filteredVehicles;
    if (activeTab === "recent" && recentVehicleIds.length > 0) {
      return filteredVehicles.filter(vehicle => 
        recentVehicleIds.includes(vehicle.id.toString())
      );
    }
    return filteredVehicles.filter(
      vehicle => vehicle.vehicleType === activeTab
    );
  }, [filteredVehicles, activeTab, recentVehicleIds]);

  // Get the selected vehicle for display
  const selectedVehicle = vehicles?.find(v => v.id.toString() === value);

  return (
    <div className="relative w-full">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between",
              !value && "text-muted-foreground",
              className
            )}
            disabled={disabled}
          >
            <div className="flex items-center truncate">
              {selectedVehicle ? (
                <span className="flex items-center gap-2 truncate">
                  <CarFront className="h-4 w-4 shrink-0 opacity-60" />
                  {selectedVehicle.brand} {selectedVehicle.model}
                  <Badge variant="outline" className="ml-1 text-xs font-normal">
                    {formatLicensePlate(selectedVehicle.licensePlate)}
                  </Badge>
                </span>
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[320px] md:w-[550px] max-h-[500px] overflow-auto p-0"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
          sticky="always"
        >
          <div className="p-4">
            <div className="flex items-center px-1 mb-4">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder="Search by license plate, brand, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
            </div>
            
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                {recentVehicleIds.length > 0 && (
                  <TabsTrigger value="recent" className="flex-1">Recent</TabsTrigger>
                )}
                {vehicleTypes.map(type => (
                  <TabsTrigger key={type} value={type} className="flex-1">{type}</TabsTrigger>
                ))}
              </TabsList>
              
              <TabsContent value="all" className="mt-0">
                {displayVehicles()}
              </TabsContent>
              
              <TabsContent value="recent" className="mt-0">
                {displayVehicles()}
              </TabsContent>
              
              {vehicleTypes.map(type => (
                <TabsContent key={type} value={type} className="mt-0">
                  {displayVehicles()}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  
  function displayVehicles() {
    if (displayedVehicles.length === 0) {
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No vehicles found.
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {displayedVehicles.map(vehicle => (
          <div 
            key={vehicle.id}
            className={cn(
              "p-3 rounded-md border cursor-pointer hover:bg-muted transition-colors",
              value === vehicle.id.toString() ? "bg-primary/10 border-primary" : "border-border"
            )}
            onClick={() => {
              onChange(vehicle.id.toString());
              setOpen(false);
              setSearchQuery("");
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CarFront className="h-5 w-5 shrink-0 opacity-70" />
                <div className="font-medium">
                  {vehicle.brand} {vehicle.model}
                </div>
              </div>
              {value === vehicle.id.toString() && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <Badge variant="outline" className="mr-1">
                {formatLicensePlate(vehicle.licensePlate)}
              </Badge>
              <Badge 
                variant="secondary" 
                className="text-xs"
              >
                {vehicle.vehicleType || "Unknown"}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {isTrueValue(vehicle.registeredTo)
                ? <Badge variant="outline" className="bg-blue-50 text-blue-700 py-0.5 px-1.5">Opnaam</Badge>
                : isTrueValue(vehicle.company)
                  ? <Badge variant="outline" className="bg-green-50 text-green-700 py-0.5 px-1.5">BV</Badge>
                  : null
              }
              {vehicle.gps && (
                <Badge variant="outline" className="ml-1 py-0.5 px-1.5">GPS</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }
}