import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Car, LogOut, Calendar, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { ExtensionRequestDialog } from "@/components/customer-portal/extension-request-dialog";
import type { Reservation } from "@shared/schema";

interface CustomerUser {
  id: number;
  customerId: number;
  email: string;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
}

export default function CustomerDashboard() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedRental, setSelectedRental] = useState<Reservation | null>(null);

  // Fetch customer data
  const { data: customerUser, isLoading: isLoadingUser } = useQuery<CustomerUser>({
    queryKey: ["/api/customer/me"],
  });

  // Fetch active rentals
  const { data: rentals, isLoading: isLoadingRentals } = useQuery<Reservation[]>({
    queryKey: ["/api/customer/rentals"],
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer/logout");
      if (!res.ok) throw new Error("Logout failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/customer-portal/login");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (isLoadingUser || isLoadingRentals) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your rentals...</p>
        </div>
      </div>
    );
  }

  if (!customerUser) {
    navigate("/customer-portal/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Car className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Customer Portal
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Welcome, {customerUser.customer.name}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Name:</span>
              <span className="font-medium" data-testid="text-customer-name">
                {customerUser.customer.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Email:</span>
              <span className="font-medium" data-testid="text-customer-email">
                {customerUser.customer.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phone:</span>
              <span className="font-medium" data-testid="text-customer-phone">
                {customerUser.customer.phone}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Active Rentals */}
        <Card>
          <CardHeader>
            <CardTitle>Your Active Rentals</CardTitle>
            <CardDescription>
              View your current rentals and request extensions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!rentals || rentals.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  You don't have any active rentals
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rentals.map((rental) => (
                  <Card key={rental.id} className="border-2" data-testid={`card-rental-${rental.id}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold" data-testid={`text-vehicle-${rental.id}`}>
                              {rental.vehicle?.brand} {rental.vehicle?.model}
                            </h3>
                            <Badge variant={rental.status === 'confirmed' ? 'default' : 'secondary'}>
                              {rental.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            License Plate: {rental.vehicle?.licensePlate}
                          </p>
                        </div>
                        <Button
                          onClick={() => setSelectedRental(rental)}
                          data-testid={`button-request-extension-${rental.id}`}
                        >
                          Request Extension
                        </Button>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                          <span className="font-medium" data-testid={`text-start-date-${rental.id}`}>
                            {format(new Date(rental.startDate), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">End Date:</span>
                          <span className="font-medium" data-testid={`text-end-date-${rental.id}`}>
                            {rental.endDate 
                              ? format(new Date(rental.endDate), 'MMM dd, yyyy')
                              : 'Open-ended'}
                          </span>
                        </div>
                      </div>

                      {rental.notes && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Notes:</span> {rental.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Extension Request Dialog */}
      {selectedRental && (
        <ExtensionRequestDialog
          rental={selectedRental}
          open={!!selectedRental}
          onOpenChange={(open: boolean) => !open && setSelectedRental(null)}
        />
      )}
    </div>
  );
}
