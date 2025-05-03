import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { ColumnDef } from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { Expense, Vehicle } from "@shared/schema";
import { PlusCircle, ArrowLeft, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function VehicleExpensesPage() {
  // Get vehicle ID from route parameter using pathname directly
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Extract vehicleId from the URL path more reliably
  const pathSegments = location.split('/');
  const vehicleIdStr = pathSegments[pathSegments.length - 1];
  const vehicleId = !isNaN(parseInt(vehicleIdStr)) ? parseInt(vehicleIdStr) : null;
  
  console.log("VehicleExpensesPage - current location:", location);
  console.log("VehicleExpensesPage - path segments:", pathSegments);
  console.log("VehicleExpensesPage - extracted vehicleId:", vehicleId);
  
  // Define query keys for easier reference
  const expenseListQueryKey = ["/api/expenses"];
  const vehicleExpensesQueryKey = vehicleId ? [`/api/expenses/vehicle/${vehicleId}`] : [];
  
  // Fetch expenses for this vehicle
  const { 
    data: expenses, 
    isLoading: isLoadingExpenses, 
    error: expensesError,
    refetch: refetchExpenses 
  } = useQuery<Expense[]>({
    queryKey: vehicleExpensesQueryKey,
    enabled: !!vehicleId,
    retry: 1,
  });
  
  // Define delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      const response = await apiRequest("DELETE", `/api/expenses/${expenseId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete expense');
      }
      return await response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Expense deleted",
        description: "The expense has been successfully deleted."
      });
      
      // Invalidate queries and explicitly force a refetch
      await queryClient.invalidateQueries({ queryKey: expenseListQueryKey });
      await queryClient.invalidateQueries({ queryKey: vehicleExpensesQueryKey });
      
      // Explicitly force a refetch to update the UI
      await refetchExpenses();
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting expense",
        description: error.message || "Failed to delete expense. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Fetch vehicle details
  const { data: vehicle, isLoading: isLoadingVehicle, error: vehicleError } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
    enabled: !!vehicleId,
    retry: 1,
  });
  
  // Log the query results for debugging
  console.log("VehicleExpensesPage - vehicle data:", vehicle);
  console.log("VehicleExpensesPage - expenses data:", expenses);
  console.log("VehicleExpensesPage - errors:", { vehicleError, expensesError });
  
  // Calculate totals
  const totalExpenses = expenses?.reduce((sum, expense) => 
    sum + Number(expense.amount || 0), 0
  ) || 0;
  
  // Group expenses by category
  const expensesByCategory = expenses?.reduce((grouped, expense) => {
    const category = expense.category || "Other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(expense);
    return grouped;
  }, {} as Record<string, Expense[]>) || {};
  
  // Calculate total amount by category
  const totalByCategory = Object.entries(expensesByCategory).map(([category, expenses]) => ({
    category,
    amount: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    count: expenses.length
  })).sort((a, b) => b.amount - a.amount);
  
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
      id: "receiptFile",
      header: "Receipt",
      cell: ({ row }) => {
        const expense = row.original;
        if (expense.receiptFilePath) {
          return (
            <a
              href={`/api/expenses/${expense.id}/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Receipt
            </a>
          );
        }
        return "—";
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const expense = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Link href={`/expenses/${expense.id}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View details">
                <Eye className="h-4 w-4 text-blue-600" />
              </Button>
            </Link>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  disabled={deleteExpenseMutation.isPending}
                  title="Delete expense"
                >
                  {deleteExpenseMutation.isPending && deleteExpenseMutation.variables === expense.id ? (
                    <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-600" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this expense record for {vehicle.brand} {vehicle.model} ({vehicle.licensePlate}).
                    <p className="mt-2 font-medium">
                      {formatCurrency(Number(expense.amount))} - {expense.category} - {formatDate(expense.date)}
                    </p>
                    {expense.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        Description: {expense.description}
                      </p>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={(e) => {
                      e.preventDefault();
                      deleteExpenseMutation.mutate(expense.id);
                    }}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ];
  
  if (isLoadingVehicle || !vehicleId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/expenses">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
              </Link>
            </Button>
            {vehicleId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vehicles/${vehicleId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vehicle
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-6 w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 md:col-span-2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  
  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Vehicle Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The vehicle you are looking for does not exist or has been removed.
        </p>
        <div className="flex space-x-2 mt-6 justify-center">
          <Button variant="outline" asChild>
            <Link href="/expenses">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/vehicles/${vehicleId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vehicle
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/expenses">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/vehicles/${vehicleId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vehicle
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold">
            Expenses for {vehicle.brand} {vehicle.model} ({vehicle.licensePlate})
          </h1>
        </div>
        <Button asChild>
          <Link href={`/expenses/add?vehicleId=${vehicleId}`}>
            <PlusCircle className="h-4 w-4 mr-2" /> Add Expense
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Expense Records</CardTitle>
            <CardDescription>
              {expenses?.length || 0} expense records for this vehicle
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingExpenses ? (
              <div className="flex justify-center p-6">
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : expenses?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No expenses recorded for this vehicle yet
              </div>
            ) : (
              <DataTable columns={columns} data={expenses || []} searchColumn="description" />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Expense Summary</CardTitle>
            <CardDescription>
              Total expenses: <span className="font-bold">{formatCurrency(totalExpenses)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalByCategory.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No expense data available
              </div>
            ) : (
              <div className="space-y-4">
                {totalByCategory.map(({ category, amount, count }) => (
                  <div key={category} className="flex justify-between items-center">
                    <div>
                      <Badge variant="outline" className="mr-2">{category}</Badge>
                      <span className="text-xs text-muted-foreground">({count} items)</span>
                    </div>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}