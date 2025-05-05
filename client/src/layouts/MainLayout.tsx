import { useState, ReactNode, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { useAuth } from "@/hooks/use-auth";
import { ScrollToTop } from "@/components/scroll-to-top";
import { NotificationCenter } from "@/components/ui/notification-center";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Car, User, Calendar, X } from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

// Define interfaces for search results
interface SearchResultVehicle {
  id: number;
  licensePlate: string;
  brand: string;
  model: string;
}

interface SearchResultCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface SearchResultReservation {
  id: number;
  vehicleId: number;
  customerId: number;
  startDate: string;
  endDate: string;
  status: string;
  vehicle?: {
    licensePlate: string;
    brand: string;
    model: string;
  };
  customer?: {
    name: string;
  };
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const title = getPageTitle(location);
  
  // Query for vehicles based on search
  const { data: vehicleResults, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["/api/search/vehicles", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/vehicles?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search vehicles");
      return response.json();
    },
    enabled: searchQuery.length >= 2
  });

  // Query for customers based on search
  const { data: customerResults, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/search/customers", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/customers?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search customers");
      return response.json();
    },
    enabled: searchQuery.length >= 2
  });

  // Query for reservations based on search
  const { data: reservationResults, isLoading: reservationsLoading } = useQuery({
    queryKey: ["/api/search/reservations", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/reservations?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search reservations");
      return response.json();
    },
    enabled: searchQuery.length >= 2
  });
  
  // Format license plate to display with dashes
  const formatLicensePlate = (plate: string) => {
    if (!plate) return "";
    
    // Remove any existing dashes
    const sanitized = plate.replace(/-/g, "");
    
    // Apply formatting based on length
    if (sanitized.length === 6) { // Format: XX-XX-XX
      return `${sanitized.substring(0, 2)}-${sanitized.substring(2, 4)}-${sanitized.substring(4, 6)}`;
    } else if (sanitized.length === 8) { // Format: XX-XXX-XX
      return `${sanitized.substring(0, 2)}-${sanitized.substring(2, 5)}-${sanitized.substring(5, 8)}`;
    } else if (sanitized.length === 7) { // Format: X-XXX-XX
      return `${sanitized.substring(0, 1)}-${sanitized.substring(1, 4)}-${sanitized.substring(4, 7)}`;
    }
    
    return sanitized;
  };
  
  // Handle click away from search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchRef]);
  
  // Navigate to result and close search
  const handleResultClick = (path: string) => {
    navigate(path);
    setShowResults(false);
    setSearchQuery("");
  };
  
  // If we're at the auth page or not logged in, render without layout
  const isAuthPage = location === "/auth";
  
  if (isAuthPage || !user) {
    return <>{children}</>;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ScrollToTop component to handle scrolling on route changes */}
      <ScrollToTop />
      
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-md z-30 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-primary-600">Auto Lease LAM</h1>
            <button 
              className="md:hidden text-gray-500"
              onClick={() => setSidebarOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>
        
        <SidebarNav />
      </aside>

      {/* Header */}
      <header className="bg-white shadow-sm md:ml-64">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <button 
              className="md:hidden text-gray-500 mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu">
                <line x1="4" x2="20" y1="12" y2="12"/>
                <line x1="4" x2="20" y1="6" y2="6"/>
                <line x1="4" x2="20" y1="18" y2="18"/>
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative" ref={searchRef}>
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full py-2 pl-10 pr-4 text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    setShowResults(true);
                  } else {
                    setShowResults(false);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.length >= 2) {
                    setShowResults(true);
                  }
                }}
              />
              {searchQuery ? (
                <button 
                  className="absolute right-3 top-2.5 text-gray-500"
                  onClick={() => {
                    setSearchQuery("");
                    setShowResults(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search absolute left-3 top-2.5 text-gray-500">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </svg>
              )}
              
              {/* Search Results Dropdown */}
              {showResults && searchQuery.length >= 2 && (
                <div className="absolute z-50 mt-2 w-96 bg-white rounded-md shadow-lg overflow-hidden">
                  <div className="max-h-[70vh] overflow-y-auto">
                    {/* Loading indicator */}
                    {(vehiclesLoading || customersLoading || reservationsLoading) && (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                        <span>Searching...</span>
                      </div>
                    )}
                    
                    {/* No results */}
                    {!vehiclesLoading && !customersLoading && !reservationsLoading && 
                     (!vehicleResults?.length && !customerResults?.length && !reservationResults?.length) && (
                      <div className="p-4 text-center text-gray-500">
                        No results found for "{searchQuery}"
                      </div>
                    )}
                    
                    {/* Vehicle Results */}
                    {vehicleResults?.length > 0 && (
                      <div className="border-b border-gray-100 p-2">
                        <div className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-500 rounded-sm mb-1">
                          Vehicles
                        </div>
                        <ul className="divide-y divide-gray-100">
                          {vehicleResults.map((vehicle: SearchResultVehicle) => (
                            <li key={`vehicle-${vehicle.id}`} className="hover:bg-gray-50 rounded">
                              <button 
                                className="flex items-center p-2 w-full text-left"
                                onClick={() => handleResultClick(`/vehicles/${vehicle.id}`)}
                              >
                                <Car className="h-4 w-4 text-primary-500 mr-2" />
                                <div>
                                  <div className="font-medium">{vehicle.brand} {vehicle.model}</div>
                                  <div className="text-xs text-gray-500">{formatLicensePlate(vehicle.licensePlate)}</div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Customer Results */}
                    {customerResults?.length > 0 && (
                      <div className="border-b border-gray-100 p-2">
                        <div className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-500 rounded-sm mb-1">
                          Customers
                        </div>
                        <ul className="divide-y divide-gray-100">
                          {customerResults.map((customer: SearchResultCustomer) => (
                            <li key={`customer-${customer.id}`} className="hover:bg-gray-50 rounded">
                              <button 
                                className="flex items-center p-2 w-full text-left"
                                onClick={() => handleResultClick(`/customers/${customer.id}`)}
                              >
                                <User className="h-4 w-4 text-primary-500 mr-2" />
                                <div>
                                  <div className="font-medium">{customer.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {customer.email || customer.phone || "No contact info"}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Reservation Results */}
                    {reservationResults?.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-500 rounded-sm mb-1">
                          Reservations
                        </div>
                        <ul className="divide-y divide-gray-100">
                          {reservationResults.map((reservation: SearchResultReservation) => (
                            <li key={`reservation-${reservation.id}`} className="hover:bg-gray-50 rounded">
                              <button 
                                className="flex items-center p-2 w-full text-left"
                                onClick={() => handleResultClick(`/reservations/${reservation.id}`)}
                              >
                                <Calendar className="h-4 w-4 text-primary-500 mr-2" />
                                <div>
                                  <div className="font-medium">
                                    {reservation.vehicle?.brand} {reservation.vehicle?.model} 
                                    {reservation.vehicle?.licensePlate && ` (${formatLicensePlate(reservation.vehicle.licensePlate)})`}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {reservation.customer?.name || "Unknown Customer"} • {reservation.startDate} to {reservation.endDate}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <NotificationCenter />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-64 pt-4 px-4 pb-12">
        {children}
      </main>
    </div>
  );
}

function getPageTitle(location: string): string {
  if (location === "/") return "Dashboard";
  if (location.startsWith("/vehicles")) return "Vehicles";
  if (location.startsWith("/customers")) return "Customers";
  if (location.startsWith("/reservations")) return "Reservations";
  if (location.startsWith("/expenses")) return "Expenses";
  if (location.startsWith("/documents")) return "Documents";
  if (location.startsWith("/reports")) return "Reports";
  return "Auto Lease LAM";
}
