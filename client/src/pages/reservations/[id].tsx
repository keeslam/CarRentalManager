import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { Reservation, Vehicle, Customer } from "@shared/schema";
import { differenceInDays, parseISO } from "date-fns";

export default function ReservationDetails() {
  const { id } = useParams();
  const [_, navigate] = useLocation();

  // Fetch reservation details
  const { data: reservation, isLoading, error } = useQuery<Reservation>({
    queryKey: [`/api/reservations/${id}`],
  });

  // Fetch vehicle and customer details if reservation is loaded
  const { data: vehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${reservation?.vehicleId}`],
    enabled: !!reservation?.vehicleId,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${reservation?.customerId}`],
    enabled: !!reservation?.customerId,
  });

  // Calculate rental duration
  const rentalDuration = (() => {
    if (!reservation?.startDate || !reservation?.endDate) return 0;
    return differenceInDays(
      parseISO(reservation.endDate),
      parseISO(reservation.startDate)
    ) + 1; // Include both start and end days
  })();

  // Get status badge style
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-md">
        <h2 className="text-lg font-semibold text-red-800">Error</h2>
        <p className="text-red-600">Failed to load reservation details. {(error as Error)?.message}</p>
        <Button 
          variant="outline"
          className="mt-2"
          onClick={() => navigate("/reservations")}
        >
          Back to Reservations
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reservation Details</h1>
          <p className="text-gray-500">Reservation #{reservation.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/reservations/edit/${id}`}>
            <Button variant="outline">
              Edit Reservation
            </Button>
          </Link>
          <Link href={`/documents/contract/${id}`}>
            <Button>
              View Contract
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Reservation details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Reservation Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status and dates */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <Badge className={`mt-1 ${getStatusStyle(reservation.status)}`}>
                  {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1)}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Rental Period</h3>
                <p className="text-base mt-1">
                  {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {rentalDuration} day{rentalDuration !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Price</h3>
                <p className="text-base font-medium mt-1">
                  {formatCurrency(reservation.totalPrice)}
                </p>
              </div>
            </div>

            <Separator />

            {/* Vehicle details */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Vehicle</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                {vehicle ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {formatLicensePlate(vehicle.licensePlate)} - {vehicle.brand} {vehicle.model}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {vehicle.vehicleType || 'Unknown type'} • {vehicle.fuel || 'Unknown fuel'}
                      </p>
                    </div>
                    <Link href={`/vehicles/${vehicle.id}`}>
                      <Button variant="ghost" size="sm" className="mt-2 sm:mt-0">
                        View Vehicle
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500">Vehicle information unavailable</p>
                )}
              </div>
            </div>

            {/* Customer details */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Customer</h3>
              <div className="bg-gray-50 p-4 rounded-md">
                {customer ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                    <div>
                      <h4 className="font-medium">{customer.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {customer.phone && `☎ ${customer.phone}`}
                        {customer.phone && customer.email && ' • '}
                        {customer.email && `✉ ${customer.email}`}
                      </p>
                      {(customer.city || customer.address) && (
                        <p className="text-sm text-gray-500 mt-1">
                          {customer.address}{customer.address && customer.city && ', '}{customer.city}
                        </p>
                      )}
                    </div>
                    <Link href={`/customers/${customer.id}`}>
                      <Button variant="ghost" size="sm" className="mt-2 sm:mt-0">
                        View Customer
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500">Customer information unavailable</p>
                )}
              </div>
            </div>

            {/* Notes */}
            {reservation.notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{reservation.notes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column - Related info and actions */}
        <Card>
          <CardHeader>
            <CardTitle>Documents & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Damage check document */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Damage Check</h3>
              {reservation.damageCheckPath ? (
                <a 
                  href={`/${reservation.damageCheckPath}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <div className="bg-primary-100 text-primary-800 p-2 rounded-md mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" x2="8" y1="13" y2="13"/>
                      <line x1="16" x2="8" y1="17" y2="17"/>
                      <line x1="10" x2="8" y1="9" y2="9"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm">View Damage Check</p>
                    <p className="text-xs text-gray-500">Click to open document</p>
                  </div>
                </a>
              ) : (
                <div className="p-3 border border-gray-200 border-dashed rounded-md bg-gray-50 text-gray-500 text-sm">
                  No damage check document attached
                </div>
              )}
            </div>

            {/* Related actions */}
            <div className="pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                  Download Contract PDF
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" x2="12" y1="8" y2="16"/>
                    <line x1="8" x2="16" y1="12" y2="12"/>
                  </svg>
                  Create New Expense
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <path d="M3 15h18"/>
                    <path d="M3 9h18"/>
                    <path d="M9 21V3"/>
                    <path d="M15 21V3"/>
                  </svg>
                  Upload Document
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate("/reservations")}
            >
              Back to All Reservations
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}