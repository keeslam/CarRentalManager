import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertExpenseSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vehicle } from "@shared/schema";
import { format } from "date-fns";

// Expense categories
const expenseCategories = [
  "Maintenance",
  "Tires",
  "Front window",
  "Damage",
  "Repair",
  "Other"
];

// Extended schema with validation
const formSchema = insertExpenseSchema.extend({
  vehicleId: z.number({
    required_error: "Please select a vehicle",
    invalid_type_error: "Please select a vehicle",
  }),
  category: z.string().min(1, "Category is required"),
  amount: z.number({
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a number",
  }).min(0, "Amount must be positive"),
  date: z.string().min(1, "Date is required"),
});

interface ExpenseFormProps {
  editMode?: boolean;
  initialData?: any;
}

export function ExpenseForm({ editMode = false, initialData }: ExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [searchParams] = useLocation();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  
  // Get preselected vehicle ID from URL if available
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    
    if (vehicleIdParam) {
      setVehicleId(Number(vehicleIdParam));
    }
  }, [searchParams]);
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Get today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: vehicleId || 0,
      category: "",
      amount: 0,
      date: today,
      description: "",
      receiptUrl: "",
    },
  });
  
  // If vehicleId changes from URL, update the form
  useEffect(() => {
    if (vehicleId && !editMode) {
      form.setValue("vehicleId", vehicleId);
    }
  }, [vehicleId, form, editMode]);
  
  const createExpenseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest(
        editMode ? "PATCH" : "POST", 
        editMode ? `/api/expenses/${initialData?.id}` : "/api/expenses", 
        data
      );
    },
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      
      // Show success message
      toast({
        title: `Expense ${editMode ? "updated" : "recorded"} successfully`,
        description: `The expense has been ${editMode ? "updated" : "added"} to the system.`,
      });
      
      // Navigate back to expenses list or vehicle details
      if (vehicleId) {
        navigate(`/vehicles/${vehicleId}`);
      } else {
        navigate("/expenses");
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "record"} expense: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createExpenseMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Expense" : "Record New Expense"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vehicle Selection */}
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value.toString()}
                      value={field.value.toString()}
                      disabled={!!vehicleId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                            {vehicle.licensePlate} - {vehicle.brand} {vehicle.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Expense Details */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expense category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        placeholder="0.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" max={today} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the expense (e.g. Oil change, New tires, etc.)" 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="receiptUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Receipt URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="URL to receipt image or document" {...field} />
                    </FormControl>
                    <FormDescription>
                      Alternatively, you can upload a receipt document directly from the Documents section.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => vehicleId ? navigate(`/vehicles/${vehicleId}`) : navigate("/expenses")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createExpenseMutation.isPending}
              >
                {createExpenseMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  editMode ? "Update Expense" : "Record Expense"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
