import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Expense } from "@shared/schema";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { displayLicensePlate } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronUp, 
  PlusCircle, 
  Wrench, 
  Disc, 
  SquareAsterisk,
  ShieldAlert,
  Hammer,
  FileQuestion
} from "lucide-react";

export default function ExpensesIndex() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const queryClient = useQueryClient();
  
  // Define query key for easier reference and consistent usage
  const expensesQueryKey = ["/api/expenses"];
  
  // State to track if component has mounted for auto-refresh
  const [hasMounted, setHasMounted] = useState(false);
  
  // Force refresh on component mount to ensure we have latest data
  useEffect(() => {
    if (!hasMounted) {
      console.log("Forcing a refresh of the expenses list on initial mount");
      // Force a refetch of expenses when component first mounts
      queryClient.invalidateQueries({ queryKey: expensesQueryKey });
      queryClient.refetchQueries({ queryKey: expensesQueryKey });
      setHasMounted(true);
    }
  }, [hasMounted, queryClient, expensesQueryKey]);
  
  const { 
    data: expenses, 
    isLoading, 
    error,
    refetch: refetchExpenses
  } = useQuery<Expense[]>({
    queryKey: expensesQueryKey,
    retry: 1,
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 0, // Consider data always stale to force refetch
  });
  
  // Get unique categories from expenses
  const allCategories = expenses
    ? Array.from(new Set(expenses.map(expense => expense.category || "Unknown")))
    : [];
  const categories = ["all", ...allCategories];
  
  // Function to get category icon
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'maintenance':
        return <Wrench className="h-5 w-5 text-blue-500" />;
      case 'tires':
        return <Disc className="h-5 w-5 text-green-500" />;
      case 'front window':
        return <SquareAsterisk className="h-5 w-5 text-purple-500" />;
      case 'damage':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'repair':
        return <Hammer className="h-5 w-5 text-orange-500" />;
      default:
        return <FileQuestion className="h-5 w-5 text-gray-500" />;
    }
  };

  // Filter expenses based on search query and category filter
  const filteredExpenses = expenses?.filter(expense => {
    if (!expense) return false;
    
    const searchLower = searchQuery.toLowerCase();
    const licensePlate = expense.vehicle?.licensePlate || '';
    const description = expense.description || '';
    const category = expense.category || '';
    
    // Remove any dashes from license plate for search
    const normalizedLicensePlate = licensePlate.replace(/-/g, '').toLowerCase();
    const searchWithoutDashes = searchLower.replace(/-/g, '');
    
    const matchesSearch = 
      // Search with original format
      licensePlate.toLowerCase().includes(searchLower) ||
      // Search with normalized format (no dashes)
      normalizedLicensePlate.includes(searchWithoutDashes) ||
      description.toLowerCase().includes(searchLower) ||
      category.toLowerCase().includes(searchLower);
    
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
                placeholder="Search by license plate, category or description..."
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
              <>
                {!filteredExpenses?.length ? (
                  <div className="text-center p-10 border rounded-md bg-gray-50">
                    <p className="text-gray-500">No expenses found matching your search criteria.</p>
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={allCategories} className="w-full">
                    {allCategories.map(category => {
                      // Filter expenses for this category
                      const categoryExpenses = filteredExpenses.filter(
                        expense => expense.category === category
                      );
                      
                      // Skip if no expenses in this category after filtering
                      if (categoryExpenses.length === 0) return null;
                      
                      // Calculate total for this category
                      const categoryTotal = categoryExpenses.reduce(
                        (sum, expense) => sum + Number(expense.amount || 0), 0
                      );
                      
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="hover:bg-gray-50 px-4 py-3 rounded-md">
                            <div className="flex justify-between items-center w-full">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(category)}
                                  <Badge variant="outline" className="text-sm font-medium">
                                    {category}
                                  </Badge>
                                </div>
                                <span className="text-gray-500 text-sm">
                                  ({categoryExpenses.length} {categoryExpenses.length === 1 ? 'expense' : 'expenses'})
                                </span>
                              </div>
                              <div className="font-semibold text-right">
                                {formatCurrency(categoryTotal)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pt-2 pb-4">
                              <DataTable
                                columns={columns}
                                data={categoryExpenses}
                                searchColumn="description"
                                searchPlaceholder="Filter by description..."
                                pagination={false}
                              />
                              <div className="mt-2 flex justify-end">
                                <Link href={`/expenses/add?category=${encodeURIComponent(category)}`}>
                                  <Button size="sm" variant="outline" className="gap-1">
                                    <PlusCircle size={16} />
                                    Add {category} Expense
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </>
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
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category)}
                          <span>{category}</span>
                        </div>
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
