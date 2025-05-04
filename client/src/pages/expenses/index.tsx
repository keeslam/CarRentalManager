import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Expense } from "@shared/schema";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";

export default function ExpensesIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const queryClient = useQueryClient();
  
  // Define query key for easier reference and consistent usage
  const expensesQueryKey = ["/api/expenses"];
  
  const { 
    data: expenses, 
    isLoading, 
    error,
    refetch: refetchExpenses
  } = useQuery<Expense[]>({
    queryKey: expensesQueryKey,
    retry: 1,
  });
  
  // Get unique categories from expenses
  const categories = expenses 
    ? ["all", ...new Set(expenses.map(expense => expense.category))]
    : ["all"];
  
  // Filter expenses based on search query and category filter
  const filteredExpenses = expenses?.filter(expense => {
    if (!expense) return false;
    
    const searchLower = searchQuery.toLowerCase();
    const licensePlate = expense.vehicle?.licensePlate || '';
    const description = expense.description || '';
    
    const matchesSearch = 
      licensePlate.toLowerCase().includes(searchLower) ||
      description.toLowerCase().includes(searchLower);
    
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  // Calculate total amount for filtered expenses
  const totalAmount = filteredExpenses?.reduce((sum, expense) => 
    sum + Number(expense.amount || 0), 0
  ) || 0;
  
  // Define table columns
  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("date") as string;
        return formatDate(date);
      },
    },
    {
      accessorKey: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const vehicle = row.original.vehicle;
        return vehicle ? (
          <div>
            <div className="font-medium">{displayLicensePlate(vehicle.licensePlate)}</div>
            <div className="text-sm text-gray-500">{vehicle.brand} {vehicle.model}</div>
          </div>
        ) : "—";
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.getValue("category") as string;
        return <Badge variant="outline">{category}</Badge>;
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string;
        return description || "—";
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        return <span className="font-medium">{formatCurrency(amount)}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const expense = row.original;
        
        return (
          <div className="flex justify-end">
            <Link href={`/expenses/${expense.id}`}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Expense Management</h1>
        <Link href="/expenses/add">
          <Button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus mr-2">
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Record Expense
          </Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Expense Records</CardTitle>
            <CardDescription>
              View and manage all vehicle-related expenses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Input
                placeholder="Search by vehicle or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "All Categories" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                data={filteredExpenses || []}
                searchColumn="description"
                searchPlaceholder="Filter by description..."
              />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Expense Summary</CardTitle>
            <CardDescription>Overview of your expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
                <p className="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
              
              {!isLoading && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-500">By Category</h4>
                  {Object.entries(
                    filteredExpenses?.reduce((acc, expense) => {
                      const category = expense.category;
                      acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
                      return acc;
                    }, {} as Record<string, number>) || {}
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span>{category}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
