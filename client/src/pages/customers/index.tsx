import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { CustomerAddDialog } from "@/components/customers/customer-add-dialog";
import { CustomerViewDialog } from "@/components/customers/customer-view-dialog";
import { CustomerDeleteDialog } from "@/components/customers/customer-delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Customer } from "@shared/schema";
import { formatPhoneNumber } from "@/lib/format-utils";

export default function CustomersIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const handleCustomerAdded = () => {
    // Refresh the customers list when a new customer is added
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };
  
  // Filter customers based on search query
  const filteredCustomers = customers?.filter(customer => {
    const searchLower = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchLower)) ||
      (customer.city && customer.city.toLowerCase().includes(searchLower))
    );
  });
  
  // Define table columns
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string;
        return email || "—";
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string;
        return phone ? formatPhoneNumber(phone) : "—";
      },
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => {
        const city = row.getValue("city") as string;
        return city || "—";
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original;
        
        return (
          <div className="flex justify-end gap-2">
            <CustomerViewDialog customerId={customer.id}>
              <Button variant="ghost" size="sm" data-testid={`button-view-customer-${customer.id}`}>
                View
              </Button>
            </CustomerViewDialog>
            <ReservationAddDialog initialCustomerId={customer.id.toString()}>
              <Button variant="outline" size="sm">
                New Reservation
              </Button>
            </ReservationAddDialog>
            <CustomerDeleteDialog 
              customerId={customer.id} 
              customerName={customer.name}
              onSuccess={handleCustomerAdded}
            >
              <Button variant="destructive" size="sm" data-testid={`button-delete-customer-${customer.id}`}>
                Delete
              </Button>
            </CustomerDeleteDialog>
          </div>
        );
      },
    },
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <CustomerAddDialog onSuccess={handleCustomerAdded} />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Customer Database</CardTitle>
          <CardDescription>
            Manage your customers, view details, and create reservations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredCustomers || []}
              searchColumn="name"
              searchPlaceholder="Filter by name..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
