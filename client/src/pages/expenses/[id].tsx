import { useQuery, queryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Tag, 
  Truck, 
  FileCheck, 
  Pencil
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { Expense, Vehicle } from "@shared/schema";

export default function ExpenseDetailsPage() {
  // Get expense ID from route parameter
  const [location] = useLocation();
  console.log("Current location:", location);
  
  // Parse the expense ID from the URL directly
  const expenseId = location.match(/\/expenses\/(\d+)/)?.[1] ? 
    parseInt(location.match(/\/expenses\/(\d+)/)?.[1] as string) : 
    null;
  
  console.log("Parsed expense ID:", expenseId);
  
  // Fetch expense details
  const { data: expense, isLoading, error: expenseError } = useQuery<Expense>({
    queryKey: [`/api/expenses/${expenseId}`],
    enabled: !!expenseId,
    retry: 1,
    onSuccess: (data) => console.log("Successfully loaded expense:", data),
    onError: (err) => console.error("Error loading expense:", err)
  });
  
  // Fetch associated vehicle details if expense is loaded
  const { data: vehicle, isLoading: isLoadingVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${expense?.vehicleId}`],
    enabled: !!expense?.vehicleId,
    retry: 1,
  });
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/expenses">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
            </Link>
          </Button>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-6 w-1/4" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!expense) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Expense Not Found</h2>
        <p className="mt-2 text-muted-foreground">
          The expense you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/expenses">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/expenses">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            Expense Details
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/expenses/edit/${expenseId}`}>
            <Pencil className="h-4 w-4 mr-2" /> Edit Expense
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Expense Information</CardTitle>
            <CardDescription>
              Details about this expense record
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-primary" />
                      <span>{formatDate(expense.date)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Category</h3>
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-2 text-primary" />
                      <Badge>{expense.category}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Amount</h3>
                    <div className="text-xl font-bold">
                      {formatCurrency(Number(expense.amount || 0))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Vehicle</h3>
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 mr-2 text-primary" />
                      {isLoadingVehicle ? (
                        <Skeleton className="h-6 w-28" />
                      ) : vehicle ? (
                        <Link href={`/vehicles/${vehicle.id}`} className="text-blue-600 hover:underline">
                          {vehicle.brand} {vehicle.model} ({vehicle.licensePlate})
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Vehicle not found</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                    <div className="flex items-start">
                      <FileText className="h-4 w-4 mr-2 mt-1 text-primary" />
                      <p className="text-sm">
                        {expense.description || "No description provided"}
                      </p>
                    </div>
                  </div>
                  
                  {expense.receiptFilePath && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Receipt</h3>
                      <div className="flex items-center">
                        <FileCheck className="h-4 w-4 mr-2 text-primary" />
                        <a
                          href={`/api/expenses/${expense.id}/receipt`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Receipt
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <div>Created: {expense.createdAt ? formatDate(new Date(expense.createdAt)) : 'N/A'}</div>
                  {expense.createdBy && <div>By: {expense.createdBy}</div>}
                </div>
                {expense.updatedAt && expense.createdAt && expense.updatedAt !== expense.createdAt && (
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <div>Updated: {formatDate(new Date(expense.updatedAt))}</div>
                    {expense.updatedBy && <div>By: {expense.updatedBy}</div>}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vehicle && (
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/expenses/vehicle/${vehicle.id}`}>
                      <Truck className="h-4 w-4 mr-2" />
                      View All Vehicle Expenses
                    </Link>
                  </Button>
                )}
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/expenses/add?vehicleId=${expense.vehicleId}`}>
                    <FileText className="h-4 w-4 mr-2" />
                    Add Another Expense
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}