import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Trash2, Wrench, CircleDot, AlertTriangle, Hammer, Fuel, Shield, FileText, Sparkles, Package, MoreHorizontal, Disc } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format-utils";
import { Expense, Vehicle } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExpenseAddDialog } from "./expense-add-dialog";

// Function to get expense icon based on category
function getExpenseIcon(category: string) {
  switch (category.toLowerCase()) {
    case "maintenance":
      return <Wrench className="h-4 w-4 text-blue-600" />;
    case "tires":
      return <CircleDot className="h-4 w-4 text-green-600" />;
    case "brakes":
      return <Disc className="h-4 w-4 text-red-600" />;
    case "damage":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case "repair":
      return <Hammer className="h-4 w-4 text-orange-600" />;
    case "fuel":
      return <Fuel className="h-4 w-4 text-purple-600" />;
    case "insurance":
      return <Shield className="h-4 w-4 text-cyan-600" />;
    case "registration":
      return <FileText className="h-4 w-4 text-indigo-600" />;
    case "cleaning":
      return <Sparkles className="h-4 w-4 text-pink-600" />;
    case "accessories":
      return <Package className="h-4 w-4 text-amber-600" />;
    default:
      return <MoreHorizontal className="h-4 w-4 text-gray-600" />;
  }
}

interface ExpenseViewDialogProps {
  vehicleId: number;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function ExpenseViewDialog({ vehicleId, children, onSuccess }: ExpenseViewDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses for this vehicle
  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: [`/api/expenses/vehicle/${vehicleId}`],
    enabled: open,
  });

  // Fetch vehicle details
  const { data: vehicle, isLoading: isLoadingVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${vehicleId}`],
    enabled: open,
  });

  // Delete expense mutation
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
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: [`/api/expenses/vehicle/${vehicleId}`] });
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting expense",
        description: error.message || "Failed to delete expense. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Get unique categories from expenses
  const allCategories = [...new Set(expenses?.map(expense => expense.category) || [])];
  const categories = ["all", ...allCategories];

  // Filter expenses based on search and category
  const filteredExpenses = expenses?.filter((expense) => {
    const searchLower = searchQuery.toLowerCase();
    const description = expense.description || '';
    const category = expense.category || '';
    
    const matchesSearch = 
      description.toLowerCase().includes(searchLower) ||
      category.toLowerCase().includes(searchLower);
    
    const matchesCategory = categoryFilter === "all" || category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  }) || [];

  // Calculate total and category breakdown
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const expensesByCategory = allCategories.map(category => ({
    category,
    amount: expenses?.filter(expense => expense.category === category)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0) || 0,
    count: expenses?.filter(expense => expense.category === category).length || 0
  })).filter(item => item.amount > 0);

  // Custom trigger or default "View All Expenses" button
  const trigger = children || (
    <Button 
      size="sm" 
      variant="outline"
      data-testid={`button-view-expenses-${vehicleId}`}
    >
      <Eye className="mr-2 h-4 w-4" />
      View All Expenses
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            {isLoadingVehicle ? (
              "Vehicle Expenses"
            ) : vehicle ? (
              `${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate}) - Expenses`
            ) : (
              "Vehicle Expenses"
            )}
          </DialogTitle>
          <DialogDescription>
            All expenses recorded for this vehicle
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
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
            <ExpenseAddDialog vehicleId={vehicleId} onSuccess={onSuccess} />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">
                  {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allCategories.length}</div>
                <p className="text-xs text-muted-foreground">
                  Different expense types
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredExpenses.length > 0 ? formatCurrency(totalExpenses / filteredExpenses.length) : formatCurrency(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per expense record
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingExpenses ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {expenses?.length === 0 ? "No expenses recorded for this vehicle" : "No expenses match your search criteria"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getExpenseIcon(expense.category)}
                            <Badge variant="outline">{expense.category}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{expense.description || 'No description'}</p>
                            {expense.receiptUrl && (
                              <p className="text-xs text-muted-foreground">Has receipt</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {expense.receiptUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(expense.receiptUrl, '_blank')}
                                className="h-8 w-8 p-0"
                                title="View receipt"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                  title="Delete expense"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this {expense.category.toLowerCase()} expense of {formatCurrency(expense.amount)}?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteExpenseMutation.mutate(expense.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          {expensesByCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expensesByCategory.map(({ category, amount, count }) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getExpenseIcon(category)}
                        <span className="font-medium">{category}</span>
                        <Badge variant="secondary" className="text-xs">
                          {count} expense{count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}