import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { Expense } from "@shared/schema";
import { MoreVertical, Eye, Pencil, Printer, Calendar, Tag, Truck, FileText, FileCheck } from "lucide-react";
import { ExpenseForm } from "@/components/expenses/expense-form";

// Function to get expense icon based on category
function getExpenseIcon(category: string) {
  switch (category.toLowerCase()) {
    case "maintenance":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wrench">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
    case "tires":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-dot">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="1"/>
        </svg>
      );
    case "front window":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-top">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <line x1="3" x2="21" y1="9" y2="9"/>
        </svg>
      );
    case "damage":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" x2="12" y1="9" y2="13"/>
          <line x1="12" x2="12.01" y1="17" y2="17"/>
        </svg>
      );
    case "repair":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-hammer">
          <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/>
          <path d="M17.64 15 22 10.64"/>
          <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-more-horizontal">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
          <circle cx="5" cy="12" r="1"/>
        </svg>
      );
  }
}

export function RecentExpenses() {
  const { t } = useTranslation();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const queryClient = useQueryClient();
  
  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses/recent", { limit: 10 }],
  });
  
  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setViewDialogOpen(true);
  };
  
  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditDialogOpen(true);
  };
  
  const handleEditComplete = () => {
    setEditDialogOpen(false);
    setSelectedExpense(null);
    // The new unified invalidation system in the expense form will handle cache updates automatically
  };
  
  return (
    <Card>
      <CardHeader className="px-4 py-3 border-b flex-row justify-between items-center space-y-0">
        <CardTitle className="text-base font-medium text-gray-800">{t('dashboard.recentExpenses')}</CardTitle>
        <Link href="/expenses">
          <Button variant="link" className="text-primary-600 hover:text-primary-700 text-sm font-medium h-8 px-0">
            {t('common.view')}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : expenses?.length === 0 ? (
          <div className="text-center py-4 text-gray-500">{t('expenses.noExpenses')}</div>
        ) : (
          <div className="max-h-[265px] overflow-y-auto pr-1 space-y-3">
            {expenses?.slice(0, 10).map((expense, index) => (
              <div key={expense.id} className={`${index < (expenses?.length ?? 0) - 1 ? 'border-b pb-3' : ''}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                      {getExpenseIcon(expense.category)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{formatLicensePlate(expense.vehicle?.licensePlate || '')} - {expense.description}</div>
                      <div className="text-xs text-gray-500">{formatDate(expense.date)} • {expense.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">{formatCurrency(Number(expense.amount || 0))}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewExpense(expense)}>
                          <Eye className="h-3 w-3 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditExpense(expense)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {expense.receiptFilePath && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`/api/expenses/${expense.id}/receipt`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center cursor-pointer"
                            >
                              <Printer className="h-3 w-3 mr-2" />
                              View Receipt
                            </a>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Date</h3>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-primary" />
                      <span>{formatDate(selectedExpense.date)}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Category</h3>
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-2 text-primary" />
                      <Badge>{selectedExpense.category}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Amount</h3>
                    <div className="text-xl font-bold">
                      {formatCurrency(Number(selectedExpense.amount || 0))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Vehicle</h3>
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 mr-2 text-primary" />
                      <span>
                        {selectedExpense.vehicle ? (
                          `${selectedExpense.vehicle.brand} ${selectedExpense.vehicle.model} (${formatLicensePlate(selectedExpense.vehicle.licensePlate)})`
                        ) : (
                          'Vehicle not found'
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                    <div className="flex items-start">
                      <FileText className="h-4 w-4 mr-2 mt-1 text-primary" />
                      <p className="text-sm">
                        {selectedExpense.description || "No description provided"}
                      </p>
                    </div>
                  </div>
                  
                  {selectedExpense.receiptFilePath && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Receipt</h3>
                      <div className="flex items-center">
                        <FileCheck className="h-4 w-4 mr-2 text-primary" />
                        <a
                          href={`/api/expenses/${selectedExpense.id}/receipt`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View Receipt
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <ExpenseForm
              editMode={true}
              initialData={selectedExpense}
              onSuccess={handleEditComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
