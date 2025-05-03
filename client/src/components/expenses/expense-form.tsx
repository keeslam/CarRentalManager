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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Vehicle } from "@shared/schema";
import { format } from "date-fns";
import { formatFileSize } from "@/lib/format-utils";

// Expense categories
const expenseCategories = [
  "Maintenance",
  "Tires",
  "Front window",
  "Damage",
  "Repair",
  "Other"
];

// Maximum file size (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif"
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
  receiptFile: z
    .instanceof(File)
    .optional()
    .refine((file) => {
      if (!file) return true;
      return file.size <= MAX_FILE_SIZE;
    }, {
      message: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}.`,
    })
    .refine((file) => {
      if (!file) return true;
      return ACCEPTED_FILE_TYPES.includes(file.type);
    }, {
      message: "File type not supported.",
    }),
});

interface ExpenseFormProps {
  editMode?: boolean;
  initialData?: any;
  preselectedVehicleId?: number | null;
}

export function ExpenseForm({ editMode = false, initialData, preselectedVehicleId }: ExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const [searchParams] = useLocation();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [receiptTab, setReceiptTab] = useState<string>("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Get today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  
  // Get preselected vehicle ID from URL if available
  useEffect(() => {
    const urlParams = new URLSearchParams(searchParams);
    const vehicleIdParam = urlParams.get("vehicleId");
    
    if (vehicleIdParam) {
      const parsedId = Number(vehicleIdParam);
      setVehicleId(parsedId);
      
      // If form is already initialized, update the vehicleId field
      if (formInitialized && !editMode) {
        form.setValue("vehicleId", parsedId);
      }
    }
  }, [searchParams, formInitialized, editMode]);
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: 0, // Will be updated after initialization
      category: "",
      amount: 0,
      date: today,
      description: "",
      receiptUrl: "",
    },
  });
  
  // When the form is first created, update with the vehicleId from URL parameter or preselectedVehicleId prop
  useEffect(() => {
    // Only run this once after the form is initialized
    if (!formInitialized) {
      // First check if vehicleId is set from URL query parameters
      if (vehicleId && !editMode) {
        form.setValue("vehicleId", vehicleId);
        setFormInitialized(true);
      } 
      // Then check if preselectedVehicleId prop is provided
      else if (preselectedVehicleId && !editMode) {
        setVehicleId(preselectedVehicleId);
        form.setValue("vehicleId", preselectedVehicleId);
        setFormInitialized(true);
      }
      // Otherwise, just mark as initialized
      else {
        setFormInitialized(true);
      }
    }
  }, [vehicleId, preselectedVehicleId, form, editMode, formInitialized]);
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      setSelectedFile(file);
      form.setValue("receiptFile", file);
    }
  };
  
  const createExpenseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // If we have a file, we need to use FormData instead of JSON
      if (selectedFile && receiptTab === "upload") {
        const formData = new FormData();
        
        // Add all the regular fields
        formData.append("vehicleId", data.vehicleId.toString());
        formData.append("category", data.category);
        formData.append("amount", data.amount.toString());
        formData.append("date", data.date);
        
        if (data.description) {
          formData.append("description", data.description);
        }
        
        // Add the file
        formData.append("receiptFile", selectedFile);
        
        // Use fetch directly instead of apiRequest which is JSON-only
        const response = await fetch(
          editMode ? `/api/expenses/${initialData?.id}/with-receipt` : "/api/expenses/with-receipt", 
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to upload receipt");
        }
        
        return await response.json();
      } else {
        // Regular JSON request for URL-based receipts
        return await apiRequest(
          editMode ? "PATCH" : "POST", 
          editMode ? `/api/expenses/${initialData?.id}` : "/api/expenses", 
          data
        );
      }
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
                      defaultValue={field.value > 0 ? field.value.toString() : undefined}
                      value={field.value > 0 ? field.value.toString() : undefined}
                      disabled={vehicleId !== null}
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
              
              <div className="md:col-span-2">
                <FormLabel className="mb-2 block">Receipt</FormLabel>
                <Tabs defaultValue="url" value={receiptTab} onValueChange={setReceiptTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="url">URL</TabsTrigger>
                    <TabsTrigger value="upload">Upload File</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url">
                    <FormField
                      control={form.control}
                      name="receiptUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input placeholder="URL to receipt image or document" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter a URL to an online receipt or invoice
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  <TabsContent value="upload">
                    <div className="space-y-4">
                      <div className="flex items-center justify-center w-full">
                        <label 
                          htmlFor="receipt-file-upload" 
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <svg className="w-8 h-8 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                            </svg>
                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PDF, PNG, JPG or GIF (max. 5MB)</p>
                          </div>
                          <input 
                            id="receipt-file-upload" 
                            type="file" 
                            className="hidden" 
                            accept=".pdf,.png,.jpg,.jpeg,.gif"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                      
                      {selectedFile && (
                        <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <div className="text-sm">
                              <div className="font-medium truncate max-w-[150px] sm:max-w-[300px]">{selectedFile.name}</div>
                              <div className="text-muted-foreground text-xs">{formatFileSize(selectedFile.size)}</div>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedFile(null);
                              form.setValue("receiptFile", undefined as any);
                            }}
                          >
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </Button>
                        </div>
                      )}
                      
                      <FormDescription>
                        Upload a PDF receipt or invoice directly. The file will be stored securely.
                      </FormDescription>
                      {form.formState.errors.receiptFile && (
                        <p className="text-sm font-medium text-destructive">
                          {form.formState.errors.receiptFile.message}
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
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
