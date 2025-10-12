import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest, invalidateByPrefix } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertReservationSchemaBase } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { CustomerForm } from "@/components/customers/customer-form";
import { VehicleQuickForm } from "@/components/vehicles/vehicle-quick-form";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { VehicleSelector } from "@/components/ui/vehicle-selector";
import { formatDate, formatLicensePlate } from "@/lib/format-utils";
import { format, addDays, parseISO, differenceInDays } from "date-fns";
import { Customer, Vehicle, Reservation, Document } from "@shared/schema";
import { PlusCircle, FileCheck, Upload, Check, X, Edit, FileText, Eye } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { ReadonlyVehicleDisplay } from "@/components/ui/readonly-vehicle-display";

// Extended schema with validation
const formSchema = insertReservationSchemaBase.extend({
  vehicleId: z.union([
    z.number().min(1, "Please select a vehicle"),
    z.string().min(1, "Please select a vehicle").transform(val => parseInt(val)),
  ]),
  customerId: z.union([
    z.number().min(1, "Please select a customer"),
    z.string().min(1, "Please select a customer").transform(val => parseInt(val)),
  ]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  isOpenEnded: z.boolean().optional(),
  totalPrice: z.union([
    z.number().optional(),
    z.string().transform(val => val === "" ? undefined : parseFloat(val) || undefined),
  ]).optional(),
  damageCheckFile: z.instanceof(File).optional(),
  departureMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
  startMileage: z.union([
    z.number().min(1, "Please enter a valid mileage"),
    z.string().transform(val => parseInt(val) || undefined),
  ]).optional(),
}).refine((data) => {
  // If not open-ended, end date is required
  if (!data.isOpenEnded && (!data.endDate || data.endDate === "")) {
    return false;
  }
  return true;
}, {
  message: "End date is required for non-open-ended rentals",
  path: ["endDate"],
});

interface ReservationFormProps {
  editMode?: boolean;
  initialData?: any;
  initialVehicleId?: string;
  initialCustomerId?: string;
  initialStartDate?: string;
  onSuccess?: (reservation: Reservation) => void;
  onCancel?: () => void;
}

export function ReservationForm({ 
  editMode = false, 
  initialData,
  initialVehicleId,
  initialCustomerId,
  initialStartDate,
  onSuccess,
  onCancel
}: ReservationFormProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  // Extract URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const preSelectedVehicleId = urlParams.get("vehicleId");
  const preSelectedCustomerId = urlParams.get("customerId");
  const preSelectedStartDate = urlParams.get("startDate");
  
  // Form states
  const [selectedStartDate, setSelectedStartDate] = useState<string>(
    initialStartDate || preSelectedStartDate || format(new Date(), "yyyy-MM-dd")
  );
  const [isOpenEnded, setIsOpenEnded] = useState<boolean>(
    initialData?.endDate === null || initialData?.endDate === undefined || false
  );
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [vehicleEditDialogOpen, setVehicleEditDialogOpen] = useState(false);
  const [customerEditDialogOpen, setCustomerEditDialogOpen] = useState(false);
  const [damageFile, setDamageFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(initialData?.status || "pending");
  const [departureMileage, setDepartureMileage] = useState<number | undefined>(
    initialData?.vehicle?.departureMileage || undefined
  );
  const [startMileage, setStartMileage] = useState<number | undefined>(
    initialData?.startMileage || undefined
  );
  const [createdReservationId, setCreatedReservationId] = useState<number | null>(
    editMode && initialData ? initialData.id : null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [showAllVehicles, setShowAllVehicles] = useState<boolean>(false);
  const [contractPreviewToken, setContractPreviewToken] = useState<string | null>(null);
  
  // Document management states
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  
  // Get recent selections from localStorage
  const getRecentSelections = (key: string): string[] => {
    try {
      const recent = localStorage.getItem(key);
      return recent ? JSON.parse(recent) : [];
    } catch {
      return [];
    }
  };
  
  const [recentVehicles, setRecentVehicles] = useState<string[]>(
    getRecentSelections('recentVehicles')
  );
  const [recentCustomers, setRecentCustomers] = useState<string[]>(
    getRecentSelections('recentCustomers')
  );
  
  // Save a selection to recent items
  const saveToRecent = (key: string, value: string) => {
    try {
      const recent = getRecentSelections(key);
      // Add to beginning, remove duplicates, limit to 5 items
      const updated = [value, ...recent.filter(v => v !== value)].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(updated));
      
      if (key === 'recentVehicles') {
        setRecentVehicles(updated);
      } else if (key === 'recentCustomers') {
        setRecentCustomers(updated);
      }
    } catch {
      // Ignore localStorage errors
    }
  };
  
  // Fetch customers for select field
  const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  
  // Fetch vehicles for select field
  const { data: vehicles, isLoading: isLoadingVehicles, refetch: refetchVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  
  // Fetch PDF templates for contract generation
  const { data: pdfTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/pdf-templates"],
  });
  
  // Fetch documents for the reservation (in edit mode or after creation)
  const activeReservationId = createdReservationId || (editMode && initialData?.id);
  const { data: reservationDocuments, refetch: refetchDocuments } = useQuery<Document[]>({
    queryKey: [`/api/documents/reservation/${activeReservationId}`],
    enabled: !!activeReservationId
  });
  
  // Refetch documents when activeReservationId changes
  useEffect(() => {
    if (activeReservationId) {
      console.log('🔄 Refetching documents for reservation:', activeReservationId);
      refetchDocuments();
    }
  }, [activeReservationId, refetchDocuments]);

  // Set default template when templates are loaded
  useEffect(() => {
    if (pdfTemplates && pdfTemplates.length > 0 && selectedTemplateId === null) {
      const defaultTemplate = pdfTemplates.find((template: any) => template.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else {
        // If no default, use the first template
        setSelectedTemplateId(pdfTemplates[0].id);
      }
    }
  }, [pdfTemplates, selectedTemplateId]);
  
  // Fetch selected vehicle details if vehicleId is provided
  const actualVehicleId = initialVehicleId || preSelectedVehicleId;
  const { data: preSelectedVehicle } = useQuery<Vehicle>({
    queryKey: [`/api/vehicles/${actualVehicleId}`],
    enabled: !!actualVehicleId,
  });
  
  // Fetch selected customer details if customerId is provided
  const { data: preSelectedCustomer } = useQuery<Customer>({
    queryKey: [`/api/customers/${preSelectedCustomerId}`],
    enabled: !!preSelectedCustomerId,
  });
  
  // Get today's date in YYYY-MM-DD format
  const today = format(new Date(), "yyyy-MM-dd");
  // Default end date is 3 days from start date (unless open-ended)
  const defaultEndDate = !isOpenEnded ? format(addDays(parseISO(selectedStartDate), 3), "yyyy-MM-dd") : "";
  
  // Setup form with react-hook-form and zod validation
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      vehicleId: initialVehicleId || preSelectedVehicleId || "",
      customerId: initialCustomerId || preSelectedCustomerId || "", 
      startDate: selectedStartDate,
      endDate: defaultEndDate,
      isOpenEnded: isOpenEnded,
      status: "pending",
      totalPrice: 0,
      notes: ""
    },
  });
  
  // Watch for changes to calculate duration
  const startDateWatch = form.watch("startDate");
  const endDateWatch = form.watch("endDate");
  const isOpenEndedWatch = form.watch("isOpenEnded");
  const vehicleIdWatch = form.watch("vehicleId");
  const customerIdWatch = form.watch("customerId");
  const statusWatch = form.watch("status");

  // Reset preview token when critical form fields change
  // This prevents using stale preview data when user edits the form after previewing
  useEffect(() => {
    if (contractPreviewToken && !editMode && !createdReservationId) {
      console.log('🔄 Form field changed, clearing preview token to prevent stale data');
      setContractPreviewToken(null);
      toast({
        title: "Preview Invalidated",
        description: "Form data changed. Please generate a new preview.",
        variant: "default",
      });
    }
  }, [vehicleIdWatch, customerIdWatch, selectedTemplateId, startDateWatch, endDateWatch]);
  
  // Flag to hide duplicate date fields in section 3 (dates are already handled in section 1)
  const SHOW_DUPLICATE_DATES = false;
  
  // Fetch available vehicles based on selected date range (after form watch variables are declared)
  const { data: availableVehicles, isLoading: isLoadingAvailableVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/available", { 
      startDate: startDateWatch, 
      endDate: endDateWatch 
    }],
    enabled: !!startDateWatch && (!isOpenEndedWatch ? !!endDateWatch : true),
  });

  // Determine which vehicles to show based on toggle and date selection
  const vehiclesToShow = useMemo(() => {
    // If user explicitly wants to see all vehicles, show them
    if (showAllVehicles) {
      return vehicles || [];
    }
    
    // If no start date selected yet, show all vehicles (initial state)
    if (!startDateWatch) {
      return vehicles || [];
    }
    
    // Once dates are selected, default to showing only available vehicles
    // For open-ended rentals, use available vehicles with just start date
    if (isOpenEndedWatch) {
      return availableVehicles || [];
    }
    
    // For date-ranged rentals, only show available vehicles if both dates are selected
    if (startDateWatch && endDateWatch) {
      return availableVehicles || [];
    }
    
    // If start date is set but end date isn't (non-open-ended), show all vehicles temporarily
    return vehicles || [];
  }, [vehicles, availableVehicles, showAllVehicles, startDateWatch, endDateWatch, isOpenEndedWatch]);

  // Find the selected vehicle and customer
  const selectedVehicle = useMemo(() => {
    if (!vehicles || !vehicleIdWatch) return null;
    return vehicles.find(v => v.id === Number(vehicleIdWatch)) || null;
  }, [vehicles, vehicleIdWatch]);
  
  const selectedCustomer = useMemo(() => {
    if (!customers || !customerIdWatch) return null;
    return customers.find(c => c.id === Number(customerIdWatch)) || null;
  }, [customers, customerIdWatch]);
  
  // Calculate rental duration
  const rentalDuration = useMemo(() => {
    if (!startDateWatch) return 1;
    if (isOpenEndedWatch) return "Open-ended";
    if (!endDateWatch) return 1;
    const start = parseISO(startDateWatch);
    const end = parseISO(endDateWatch);
    const days = differenceInDays(end, start) + 1; // Include the start day
    return days > 0 ? days : 1;
  }, [startDateWatch, endDateWatch, isOpenEndedWatch]);
  
  // Check for reservation conflicts
  const [hasOverlap, setHasOverlap] = useState(false);
  
  // Watch for status changes
  useEffect(() => {
    // Update currentStatus when status changes in the form
    if (statusWatch) {
      setCurrentStatus(statusWatch);
    }
  }, [statusWatch]);

  // Sync isOpenEnded state with form watch
  useEffect(() => {
    if (isOpenEndedWatch !== isOpenEnded) {
      setIsOpenEnded(!!isOpenEndedWatch);
    }
  }, [isOpenEndedWatch]);

  // Update end date when open-ended status changes
  useEffect(() => {
    if (isOpenEndedWatch) {
      form.setValue("endDate", "");
    } else if (!form.getValues("endDate")) {
      // Set default end date if not open-ended and no end date set
      form.setValue("endDate", format(addDays(parseISO(startDateWatch || selectedStartDate), 3), "yyyy-MM-dd"));
    }
  }, [isOpenEndedWatch, form, startDateWatch, selectedStartDate]);
  
  useEffect(() => {
    if (vehicleIdWatch && startDateWatch) {
      // Skip conflict checking for open-ended rentals
      if (isOpenEndedWatch) {
        setHasOverlap(false);
        return;
      }
      
      if (!endDateWatch) return;
      
      const checkConflicts = async () => {
        try {
          const response = await fetch(
            `/api/reservations/check-conflicts?vehicleId=${vehicleIdWatch}&startDate=${startDateWatch}&endDate=${endDateWatch}${initialData?.id ? `&excludeReservationId=${initialData.id}` : ""}`
          );
          if (response.ok) {
            const conflicts = await response.json();
            setHasOverlap(conflicts.length > 0);
          }
        } catch (error) {
          console.error("Failed to check reservation conflicts:", error);
        }
      };
      
      checkConflicts();
    }
  }, [vehicleIdWatch, startDateWatch, endDateWatch, isOpenEndedWatch, initialData?.id]);
  
  // Format customer options for searchable combobox
  const customerOptions = useMemo(() => {
    if (!customers) return [];
    return customers.map(customer => {
      // Build a detailed description like vehicles show license plate
      const contactInfo = [];
      if (customer.phone) contactInfo.push(customer.phone);
      if (customer.email) contactInfo.push(customer.email);
      
      const locationInfo = [];
      if (customer.city) locationInfo.push(customer.city);
      if (customer.postalCode) locationInfo.push(customer.postalCode);
      
      let description = contactInfo.join(' • ');
      if (locationInfo.length > 0) {
        description += description ? ` • ${locationInfo.join(' ')}` : locationInfo.join(' ');
      }
      
      // Add company name as a tag if available
      const tags = [];
      if (customer.companyName) {
        tags.push(customer.companyName);
      } else if (customer.debtorNumber) {
        tags.push(`#${customer.debtorNumber}`);
      }
      
      return {
        value: customer.id.toString(),
        label: customer.name,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
    });
  }, [customers]);
  
  // Format vehicle options for searchable combobox
  const vehicleOptions = useMemo(() => {
    if (!vehicles) return [];
    
    // Group by vehicle type
    const vehiclesByType = vehicles.reduce((acc, vehicle) => {
      const type = vehicle.vehicleType || "Other";
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        value: vehicle.id.toString(),
        label: `${vehicle.brand} ${vehicle.model}`,
        description: formatLicensePlate(vehicle.licensePlate),
      });
      return acc;
    }, {} as Record<string, Array<{value: string, label: string, description?: string}>>);
    
    // Convert to array of groups
    return Object.entries(vehiclesByType).map(([type, options]) => ({
      label: type,
      options,
    }));
  }, [vehicles]);
  
  // Handle customer creation form
  const handleCustomerCreated = async (data: Customer) => {
    console.log("Customer created in reservation form:", data);
    
    // Refresh customers list first to ensure the new customer is available
    await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    await queryClient.refetchQueries({ queryKey: ["/api/customers"] });
    
    // Update form with a slight delay to ensure the revalidation has completed
    setTimeout(() => {
      // Set the new customer in the form
      if (data && data.id) {
        console.log("Setting customer ID to:", data.id);
        // Set the value and trigger form update
        form.setValue("customerId", data.id, { 
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true
        });
      }
      
      // Close the dialog
      setCustomerDialogOpen(false);
      
      // Show success toast
      toast({
        title: "Customer Created",
        description: `${data.name} has been added and selected for this reservation.`,
      });
    }, 500); // Small delay to ensure state updates
  };
  
  // We no longer need a separate createVehicleMutation as we're using VehicleQuickForm
  // which handles all the vehicle creation logic and calls our callback directly
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDamageFile(file);
      form.setValue("damageCheckFile", file);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setDamageFile(file);
      form.setValue("damageCheckFile", file);
    }
  };
  
  const removeDamageFile = () => {
    setDamageFile(null);
    form.setValue("damageCheckFile", undefined);
  };
  
  // Create or update reservation mutation
  const createReservationMutation = useMutation({
    mutationKey: ["/api/reservations"], // This enables automatic comprehensive cache invalidation
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add all other form data
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "damageCheckFile" && value !== null && value !== undefined) {
          if (key === "contractPreviewToken" && value) {
            console.log('📎 Including contract preview token:', value);
          }
          formData.append(key, String(value));
        }
      });
      
      // Add file if present
      if (data.damageCheckFile) {
        formData.append("damageCheckFile", data.damageCheckFile);
      }
      
      // Use FormData for the request
      const response = await fetch(
        editMode ? `/api/reservations/${initialData?.id}` : "/api/reservations", 
        {
          method: editMode ? "PATCH" : "POST",
          body: formData,
        }
      );
      
      if (!response.ok) {
        // Try to get the error message from the response
        let errorMessage = "Failed to save reservation";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    },
    onSuccess: async (data) => {
      console.log('🎉 onSuccess called with data:', data);
      
      // Set the created reservation ID FIRST to enable contract generation immediately
      if (data && data.id) {
        console.log('✅ Setting createdReservationId to:', data.id);
        setCreatedReservationId(data.id);
        console.log('✅ createdReservationId set successfully');
      } else {
        console.log('⚠️ No data.id in response:', data);
      }
      
      // Save selections to recent items
      if (vehicleIdWatch) {
        saveToRecent('recentVehicles', vehicleIdWatch.toString());
      }
      if (form.watch("customerId")) {
        saveToRecent('recentCustomers', form.watch("customerId").toString());
      }
      
      // Use comprehensive cache invalidation - this will invalidate ALL reservation queries
      // including /api/reservations/range that the calendar uses
      await invalidateByPrefix('/api/reservations');
      await invalidateByPrefix('/api/vehicles');
      
      // Force immediate refetch of critical calendar queries
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/api/reservations/range') || 
                 key?.includes('/api/vehicles/available');
        }
      });
      
      // Show success message
      toast({
        title: `Reservation ${editMode ? "updated" : "created"} successfully`,
        description: `Reservation for ${selectedVehicle?.brand} ${selectedVehicle?.model} has been ${editMode ? "updated" : "created"}.`
      });
      
      // Force refetch if needed
      queryClient.refetchQueries({ queryKey: ["/api/reservations"] });
      
      // If onSuccess callback is provided, use it instead of navigating
      if (onSuccess) {
        onSuccess(data);
      } else {
        // Default navigation behavior when no callback is provided
        if (editMode && initialData?.id) {
          // Navigate to reservation details page
          navigate(`/reservations/${initialData.id}`);
        } else {
          // For new reservations, DON'T navigate away immediately
          // Keep the form open so user can generate and save the contract
          // Only navigate if user clicks Cancel button
          // navigate("/reservations"); // Removed - keep form open
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editMode ? "update" : "create"} reservation: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Update vehicle mileage mutation 
  const updateVehicleMutation = useMutation({
    mutationFn: async (vehicleData: { id: number, departureMileage?: number, currentMileage?: number }) => {
      // Only include properties that are defined
      const updateData: any = {};
      if (vehicleData.departureMileage !== undefined) {
        updateData.departureMileage = vehicleData.departureMileage;
      }
      if (vehicleData.currentMileage !== undefined) {
        updateData.currentMileage = vehicleData.currentMileage;
      }
      
      return await apiRequest("PATCH", `/api/vehicles/${vehicleData.id}`, updateData);
    },
    onSuccess: () => {
      // Invalidate vehicle queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update vehicle mileage: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Generate contract preview mutation (stores token for later finalization)
  const previewContractMutation = useMutation({
    mutationFn: async () => {
      const formData = form.getValues();
      const templateParam = selectedTemplateId ? `?templateId=${selectedTemplateId}` : '';
      const response = await fetch(`/api/contracts/preview${templateParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vehicleId: formData.vehicleId,
          customerId: formData.customerId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate contract preview');
      }
      
      return response.json();
    },
    onSuccess: (data: { token: string, downloadUrl: string }) => {
      console.log('✅ Preview generated, token:', data.token);
      // Store token for reservation creation
      setContractPreviewToken(data.token);
      
      // Open PDF in new tab for viewing
      window.open(data.downloadUrl, '_blank');
      
      toast({
        title: "Preview Generated",
        description: "Contract preview opened in new tab. Create the reservation to save it.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to preview contract: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Generate contract mutation
  const generateContractMutation = useMutation({
    mutationFn: async (reservationId?: number) => {
      if (reservationId) {
        // Generate from saved reservation
        const templateParam = selectedTemplateId ? `?templateId=${selectedTemplateId}` : '';
        const response = await fetch(`/api/contracts/generate/${reservationId}${templateParam}`, {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate contract');
        }
        
        return { blob: await response.blob(), filename: `contract_${reservationId}.pdf` };
      } else {
        // Generate from form data
        const formData = form.getValues();
        const templateParam = selectedTemplateId ? `?templateId=${selectedTemplateId}` : '';
        const response = await fetch(`/api/contracts/preview${templateParam}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            vehicleId: formData.vehicleId,
            customerId: formData.customerId,
            startDate: formData.startDate,
            endDate: formData.endDate,
            notes: formData.notes
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate contract');
        }
        
        return { blob: await response.blob(), filename: 'contract_preview.pdf' };
      }
    },
    onSuccess: ({ blob, filename }) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Contract Generated",
        description: "The contract has been generated and downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to generate contract: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Handle contract preview
  const handleViewContract = () => {
    previewContractMutation.mutate();
  };

  // Handle contract generation
  const handleGenerateContract = () => {
    console.log('handleGenerateContract called, createdReservationId:', createdReservationId);
    console.log('editMode:', editMode);
    console.log('initialData?.id:', initialData?.id);
    
    if (createdReservationId) {
      console.log('Using saved reservation ID:', createdReservationId);
      generateContractMutation.mutate(createdReservationId);
    } else {
      console.log('Using form data (preview mode)');
      generateContractMutation.mutate(undefined);
    }
  };

  // State for preview mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<z.infer<typeof formSchema> | null>(null);

  // Handle preview generation (first step)
  const handlePreviewAndContract = async (data: z.infer<typeof formSchema>) => {
    // Check for overlapping reservations (skip for open-ended rentals)
    if (hasOverlap && !data.isOpenEnded) {
      toast({
        title: "Booking Conflict",
        description: "This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.",
        variant: "destructive",
      });
      return;
    }
    
    // Generate contract preview token
    if (!editMode && selectedTemplateId && data.vehicleId && data.customerId) {
      try {
        const templateParam = selectedTemplateId ? `?templateId=${selectedTemplateId}` : '';
        const response = await fetch(`/api/contracts/preview${templateParam}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            vehicleId: data.vehicleId,
            customerId: data.customerId,
            startDate: data.startDate,
            endDate: data.endDate,
            notes: data.notes
          }),
        });
        
        if (response.ok) {
          const { token } = await response.json();
          console.log('✅ Generated preview token for contract:', token);
          setContractPreviewToken(token);
          setPreviewData(data);
          setIsPreviewMode(true);
          
          // Auto-open the contract in a new tab
          window.open(`/api/contracts/preview/${token}`, '_blank');
          
          toast({
            title: "Preview Generated",
            description: "Contract preview has been generated. Review it and click 'Finalize Reservation' to complete.",
          });
        } else {
          toast({
            title: "Preview Failed",
            description: "Failed to generate contract preview. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Failed to generate contract preview:', error);
        toast({
          title: "Preview Failed",
          description: "Failed to generate contract preview. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Missing Information",
        description: "Please select a vehicle, customer, and contract template.",
        variant: "destructive",
      });
    }
  };

  // Handle final reservation creation (second step)
  const handleFinalizeReservation = async () => {
    if (!previewData) return;
    
    const data = previewData;
    
    // Process data for open-ended rentals
    const submissionData = {
      ...data,
      endDate: data.isOpenEnded ? undefined : data.endDate,
      contractPreviewToken: contractPreviewToken, // Include the preview token
    };
    
    // Remove the isOpenEnded field as it's not part of the backend schema
    delete submissionData.isOpenEnded;
    
    // Update vehicle mileage whenever mileage data is provided
    if (vehicleIdWatch) {
      const vehicleUpdateData: { id: number, departureMileage?: number, currentMileage?: number } = {
        id: Number(vehicleIdWatch)
      };
      
      // Update current mileage if start mileage is provided
      if (submissionData.startMileage) {
        vehicleUpdateData.currentMileage = Number(submissionData.startMileage);
      }
      
      // Update departure mileage if departure mileage is provided  
      if (submissionData.departureMileage) {
        vehicleUpdateData.departureMileage = Number(submissionData.departureMileage);
      }
      
      // Create the reservation with preview token
      createReservationMutation.mutate(submissionData, {
        onSuccess: (reservationResult) => {
          // Then update the vehicle mileage if we have any mileage data
          if (vehicleUpdateData.currentMileage !== undefined || vehicleUpdateData.departureMileage !== undefined) {
            updateVehicleMutation.mutate(vehicleUpdateData);
          }
        }
      });
    } else {
      // No vehicle ID, just create the reservation
      createReservationMutation.mutate(submissionData);
    }
  };

  // Handle reservation form submission (in edit mode only)
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (editMode) {
      // In edit mode, directly update the reservation
      const submissionData = {
        ...data,
        endDate: data.isOpenEnded ? undefined : data.endDate,
      };
      delete submissionData.isOpenEnded;
      
      createReservationMutation.mutate(submissionData);
    } else {
      // In create mode, go to preview
      handlePreviewAndContract(data);
    }
  };
  
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>{editMode ? "Edit Reservation" : "Create New Reservation"}</CardTitle>
        <CardDescription>
          {editMode 
            ? "Update the reservation details below" 
            : "Enter the details for a new reservation"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Date Selection Section - Now First */}
            <div className="space-y-6">
              <div className="text-lg font-medium">1. Select Rental Dates</div>
              <div className="text-sm text-muted-foreground">
                Choose your rental dates first to see only available vehicles and avoid booking conflicts.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Start Date */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e);
                            setSelectedStartDate(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Open-ended rental checkbox */}
                <FormField
                  control={form.control}
                  name="isOpenEnded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          data-testid="checkbox-open-ended-rental"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Open-ended rental
                        </FormLabel>
                        <FormDescription>
                          Check this if the return date is not yet known
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* End Date - only show if not open-ended */}
                {!isOpenEndedWatch && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-end-date"
                            type="date" 
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Duration display */}
              <div className="text-sm text-muted-foreground">
                {startDateWatch && (
                  <div className="flex items-center gap-2">
                    <span>Duration:</span>
                    <Badge variant="outline" className="text-xs">
                      {rentalDuration === "Open-ended" ? "Open-ended" : `${rentalDuration} day${rentalDuration !== 1 ? 's' : ''}`}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <Separator />

            {/* Vehicle and Customer Selection Section - Now Second */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-medium">
                    {actualVehicleId ? "2. Selected Vehicle & Customer" : "2. Select Vehicle and Customer"}
                  </div>
                  {!showAllVehicles && startDateWatch && (
                    <div className="text-sm text-green-600 mt-1">
                      Showing only available vehicles for your selected dates
                    </div>
                  )}
                </div>
                {!actualVehicleId && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      data-testid="checkbox-show-all-vehicles"
                      checked={showAllVehicles}
                      onCheckedChange={(checked) => setShowAllVehicles(checked === true)}
                    />
                    <label htmlFor="show-all-vehicles" className="text-sm text-muted-foreground cursor-pointer">
                      Show all vehicles (for long-term rentals)
                    </label>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle Selection - Show read-only or selection based on preSelectedVehicleId */}
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {actualVehicleId ? (
                        // If vehicle is pre-selected, show as read-only with simple label
                        <>
                          <FormLabel>Vehicle</FormLabel>
                          <ReadonlyVehicleDisplay vehicleId={actualVehicleId} />
                        </>
                      ) : (
                        // Otherwise, show selection UI with buttons inline
                        <>
                          <div className="flex justify-between items-center">
                            <FormLabel>Vehicle</FormLabel>
                            <div className="flex gap-2">
                              {/* Edit Vehicle Button - only show if vehicle is selected */}
                              {vehicleIdWatch && (
                                <Dialog open={vehicleEditDialogOpen} onOpenChange={setVehicleEditDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Edit className="h-3.5 w-3.5 mr-1" />
                                      Edit
                                    </Button>
                                  </DialogTrigger>
                                <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Edit Vehicle</DialogTitle>
                                    <DialogDescription>
                                      Edit the details of the selected vehicle
                                    </DialogDescription>
                                  </DialogHeader>
                                  {selectedVehicle && (
                                    <VehicleForm 
                                      editMode={true}
                                      initialData={selectedVehicle}
                                      redirectToList={false}
                                      onSubmitOverride={async (data) => {
                                        try {
                                          // Update the vehicle using API
                                          const response = await apiRequest("PATCH", `/api/vehicles/${selectedVehicle.id}`, data);
                                          const updatedVehicle = await response.json();
                                          
                                          // Refresh vehicles list to show updated data
                                          await refetchVehicles();
                                          
                                              // The vehicle selector will automatically show updated data after cache refresh
                                          
                                          // Close the dialog
                                          setVehicleEditDialogOpen(false);
                                          
                                          // Show success message
                                          toast({
                                            title: "Vehicle Updated",
                                            description: `${updatedVehicle.brand} ${updatedVehicle.model} has been successfully updated.`,
                                          });
                                        } catch (error) {
                                          console.error("Failed to update vehicle:", error);
                                          toast({
                                            title: "Error",
                                            description: "Failed to update vehicle. Please try again.",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    />
                                  )}
                                </DialogContent>
                              </Dialog>
                            )}
                            
                            <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                  Add New
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Add New Vehicle</DialogTitle>
                                  <DialogDescription>
                                    Create a new vehicle to add to the reservation
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  {/* Import the VehicleQuickForm component */}
                                  <VehicleQuickForm 
                                    onSuccess={async (vehicle) => {
                                      // Refresh the vehicles list to include the new vehicle
                                      await refetchVehicles();
                                      
                                      // Set the new vehicle in the form
                                      form.setValue("vehicleId", vehicle.id);
                                      
                                      // Close the dialog
                                      setVehicleDialogOpen(false);
                                      
                                      // Show success message
                                      toast({
                                        title: "Vehicle Added",
                                        description: `${vehicle.brand} ${vehicle.model} has been added to your fleet and selected for this reservation.`,
                                      });
                                    }}
                                    onCancel={() => setVehicleDialogOpen(false)}
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                            </div>
                          </div>
                          
                          <FormControl>
                            <VehicleSelector
                              vehicles={vehiclesToShow}
                              value={field.value ? field.value.toString() : ''}
                              onChange={(value) => {
                                field.onChange(value);
                                if (value) {
                                  saveToRecent('recentVehicles', value);
                                }
                              }}
                              placeholder="Search and select a vehicle..."
                              recentVehicleIds={recentVehicles}
                            />
                          </FormControl>
                          
                          {selectedVehicle && !actualVehicleId && (
                            <div className="mt-2 text-sm bg-muted p-2 rounded-md">
                              <div className="font-medium flex items-center gap-2">
                                <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-semibold">
                                  {formatLicensePlate(selectedVehicle.licensePlate)}
                                </span>
                                <span>{selectedVehicle.brand} {selectedVehicle.model}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {selectedVehicle.vehicleType && (
                                  <Badge variant="outline" className="text-xs">{selectedVehicle.vehicleType}</Badge>
                                )}
                                {selectedVehicle.fuel && (
                                  <Badge variant="outline" className="text-xs">{selectedVehicle.fuel}</Badge>
                                )}
                                {selectedVehicle.apkDate && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                                    APK: {new Date(selectedVehicle.apkDate).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Customer Selection */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <div className="flex justify-between items-center">
                        <FormLabel>Customer</FormLabel>
                        <div className="flex gap-2">
                          {/* Edit Customer Button - only show if customer is selected */}
                          {customerIdWatch && (
                            <Dialog open={customerEditDialogOpen} onOpenChange={setCustomerEditDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Customer</DialogTitle>
                                  <DialogDescription>
                                    Edit the details of the selected customer
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedCustomer && (
                                  <CustomerForm 
                                    initialData={selectedCustomer}
                                    editMode={true}
                                    redirectToList={false}
                                    onSuccess={async (updatedCustomer) => {
                                      // Refresh customers list to show updated data
                                      await queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                                      await queryClient.refetchQueries({ queryKey: ["/api/customers"] });
                                      
                                      // The customer selector will automatically show updated data after cache refresh
                                      
                                      // Close the dialog
                                      setCustomerEditDialogOpen(false);
                                      
                                      // Show success message
                                      toast({
                                        title: "Customer Updated",
                                        description: `${updatedCustomer.name} has been successfully updated.`,
                                      });
                                    }}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                          )}
                          
                          <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                Add New
                              </Button>
                            </DialogTrigger>
                          <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Add New Customer</DialogTitle>
                              <DialogDescription>
                                Create a new customer to add to the reservation
                              </DialogDescription>
                            </DialogHeader>
                            <CustomerForm 
                              onSuccess={handleCustomerCreated} 
                              redirectToList={false} 
                            />
                          </DialogContent>
                        </Dialog>
                        </div>
                      </div>
                      <FormControl>
                        <SearchableCombobox
                          options={customerOptions}
                          value={field.value ? field.value.toString() : ''}
                          onChange={(value) => {
                            console.log("Customer selected:", value);
                            // Force form update with the new customer ID
                            form.setValue("customerId", parseInt(value), {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true
                            });
                          }}
                          placeholder="Search and select a customer..."
                          searchPlaceholder="Search by name, phone, or city..."
                          groups={false}
                          recentValues={recentCustomers}
                        />
                      </FormControl>
                      <FormMessage />
                      {selectedCustomer && (
                        <div className="mt-2 text-sm bg-muted p-2 rounded-md">
                          {/* Name and Company Information */}
                          <div className="font-medium flex items-center gap-2 mb-1">
                            {selectedCustomer.debtorNumber && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                #{selectedCustomer.debtorNumber}
                              </span>
                            )}
                            <span>{selectedCustomer.name}</span>
                          </div>
                          
                          {selectedCustomer.companyName && (
                            <div className="flex items-center gap-1 mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              <span className="text-muted-foreground">Company:</span>
                              <span>{selectedCustomer.companyName}</span>
                            </div>
                          )}
                          
                          {/* Contact Information */}
                          {selectedCustomer.phone && (
                            <div className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                              </svg>
                              <span>{selectedCustomer.phone}</span>
                            </div>
                          )}
                          {selectedCustomer.email && (
                            <div className="flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                              </svg>
                              <span>{selectedCustomer.email}</span>
                            </div>
                          )}
                          
                          {/* Address Information if available */}
                          {(selectedCustomer.address || selectedCustomer.city) && (
                            <div className="flex items-start gap-1 mt-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mt-0.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              <span>
                                {selectedCustomer.address && <span>{selectedCustomer.address}</span>}
                                {selectedCustomer.address && selectedCustomer.city && <span>, </span>}
                                {selectedCustomer.city && <span>{selectedCustomer.city}</span>}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              <Separator />
            </div>

            {/* Status and Price Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">3. Reservation Details</div>
              {SHOW_DUPLICATE_DATES && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Start Date */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e);
                            setSelectedStartDate(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Open-ended rental checkbox */}
                <FormField
                  control={form.control}
                  name="isOpenEnded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          data-testid="checkbox-open-ended-rental"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Open-ended rental
                        </FormLabel>
                        <FormDescription>
                          Check this if the return date is not yet known
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* End Date - only show if not open-ended */}
                {!isOpenEndedWatch && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input 
                            data-testid="input-end-date"
                            type="date" 
                            min={startDateWatch} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Duration Indicator */}
                <div className="flex flex-col justify-end">
                  <FormLabel className="mb-2 opacity-0">Duration</FormLabel>
                  <div className="border rounded-md h-10 flex items-center px-3 bg-muted">
                    <span className="font-medium">{rentalDuration}</span>
                    {typeof rentalDuration === 'number' && (
                      <span className="ml-1 text-muted-foreground">
                        {rentalDuration === 1 ? "day" : "days"}
                      </span>
                    )}
                  </div>
                </div>
                </div>
              )}
              
              {/* Date Summary - Read-only display of dates selected above */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Rental Period (selected above):</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Start Date:</span> {startDateWatch || 'Not selected'}
                  </div>
                  <div>
                    <span className="font-medium">End Date:</span> {isOpenEndedWatch ? 'Open-ended' : (endDateWatch || 'Not selected')}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {rentalDuration}
                    {typeof rentalDuration === 'number' && (
                      <span className="ml-1">
                        {rentalDuration === 1 ? "day" : "days"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Separator />
            </div>
            
            {/* Status and Price Section */}
            <div className="space-y-6">
              <div className="text-lg font-medium">3. Reservation Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status - Made more prominent */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Reservation Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Booked</SelectItem>
                          <SelectItem value="confirmed">Vehicle picked up</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Vehicle returned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Update the reservation status as needed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Start Mileage field when status is confirmed */}
                {currentStatus === "confirmed" && (
                  <>
                    <div className="col-span-1">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="startMileage" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Mileage When Picked Up
                        </label>
                        <input
                          id="startMileage"
                          type="number"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Enter the starting mileage"
                          value={startMileage || ""}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || undefined;
                            setStartMileage(value);
                            form.setValue("startMileage", value as any);
                          }}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          Enter the vehicle's odometer reading when it was picked up
                        </p>
                      </div>
                    </div>
                    
                    <div className="col-span-1">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="fuelLevelPickup" className="text-sm font-medium leading-none">
                          Fuel Level at Pickup
                        </label>
                        <select
                          id="fuelLevelPickup"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          defaultValue=""
                        >
                          <option value="">Select fuel level</option>
                          <option value="empty">Empty</option>
                          <option value="1/4">1/4</option>
                          <option value="1/2">1/2</option>
                          <option value="3/4">3/4</option>
                          <option value="full">Full</option>
                        </select>
                        <p className="text-[0.8rem] text-muted-foreground">
                          Record the fuel level when vehicle was picked up
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Mileage When Returned field when status is completed */}
                {currentStatus === "completed" && (
                  <>
                    <div className="col-span-1">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="departureMileage" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Mileage When Returned
                        </label>
                        <input
                          id="departureMileage"
                          type="number"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Enter the final mileage"
                          value={departureMileage || ""}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || undefined;
                            setDepartureMileage(value);
                            form.setValue("departureMileage", value as any);
                          }}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          Enter the vehicle's odometer reading when it was returned
                        </p>
                      </div>
                    </div>
                    
                    <div className="col-span-1">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="fuelLevelReturn" className="text-sm font-medium leading-none">
                          Fuel Level at Return
                        </label>
                        <select
                          id="fuelLevelReturn"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          defaultValue=""
                        >
                          <option value="">Select fuel level</option>
                          <option value="empty">Empty</option>
                          <option value="1/4">1/4</option>
                          <option value="1/2">1/2</option>
                          <option value="3/4">3/4</option>
                          <option value="full">Full</option>
                        </select>
                        <p className="text-[0.8rem] text-muted-foreground">
                          Record the fuel level when vehicle was returned
                        </p>
                      </div>
                    </div>
                    
                    <div className="col-span-1">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor="fuelCost" className="text-sm font-medium leading-none">
                          Fuel Cost (€)
                        </label>
                        <input
                          id="fuelCost"
                          type="number"
                          step="0.01"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="0.00"
                          defaultValue=""
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          Fuel cost charged to customer (if applicable)
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Price */}
                <FormField
                  control={form.control}
                  name="totalPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Price (€) <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => {
                            // Allow emptying the field (making it optional)
                            const value = e.target.value === "" 
                              ? undefined 
                              : parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                          value={field.value === undefined || field.value === null ? "" : field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        {typeof rentalDuration === 'number' 
                          ? `Enter the total price for the ${rentalDuration}-day rental`
                          : "Enter the total price for this open-ended rental"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Document Management - Always visible */}
              {form.watch("vehicleId") && (
                <div className="space-y-3 border rounded-lg p-4 bg-blue-50">
                  <label className="text-sm font-semibold text-gray-800">📄 Contract & Documents</label>
                  
                  {/* Quick Upload Buttons */}
                  <div className="flex flex-wrap gap-2 p-3 bg-white rounded-md border border-gray-200">
                    <span className="text-xs text-gray-600 w-full mb-1 font-medium">
                      {!createdReservationId && !editMode ? 'Quick Upload (available after creating reservation):' : 'Quick Upload:'}
                    </span>
                    {[
                      { type: 'Contract (Signed)', accept: '.pdf' },
                      { type: 'Damage Report Photo', accept: '.jpg,.jpeg,.png' },
                      { type: 'Damage Report PDF', accept: '.pdf' },
                      { type: 'Other', accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' }
                    ].map(({ type, accept }) => (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Check if reservation exists (either edit mode with initialData or created)
                          const reservationId = createdReservationId || (editMode && initialData?.id);
                          
                          if (!reservationId) {
                            toast({
                              title: "Create reservation first",
                              description: "Please complete the reservation details and click 'Preview & Generate Contract', then finalize to upload documents.",
                            });
                            return;
                          }

                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = accept;
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            
                            setUploadingDoc(true);
                            const formData = new FormData();
                            formData.append('vehicleId', form.watch("vehicleId").toString());
                            formData.append('reservationId', reservationId.toString());
                            formData.append('documentType', type);
                            formData.append('file', file);

                            try {
                              const response = await fetch('/api/documents', {
                                method: 'POST',
                                body: formData,
                                credentials: 'include',
                              });
                              
                              if (!response.ok) {
                                throw new Error('Upload failed');
                              }
                              
                              queryClient.invalidateQueries({ queryKey: [`/api/documents/reservation/${reservationId}`] });
                              toast({
                                title: "Success",
                                description: `${type} uploaded successfully`,
                              });
                            } catch (error) {
                              console.error('Upload failed:', error);
                              toast({
                                title: "Error",
                                description: "Failed to upload document",
                                variant: "destructive",
                              });
                            } finally {
                              setUploadingDoc(false);
                            }
                          };
                          input.click();
                        }}
                        disabled={uploadingDoc}
                        className="text-xs"
                      >
                        + {type}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Uploaded Documents */}
                  {reservationDocuments && reservationDocuments.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-700">Uploaded Documents:</span>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const contractDocs = reservationDocuments.filter(d => 
                            d.documentType === 'Contract (Unsigned)' || d.documentType === 'Contract (Signed)' || d.documentType === 'Contract'
                          );
                          const damageReportDocs = reservationDocuments.filter(d => 
                            d.documentType === 'Damage Report Photo' || d.documentType === 'Damage Report PDF'
                          );
                          const otherDocs = reservationDocuments.filter(d => 
                            d.documentType !== 'Contract (Unsigned)' && 
                            d.documentType !== 'Contract (Signed)' && 
                            d.documentType !== 'Contract' && 
                            d.documentType !== 'Damage Report Photo' && 
                            d.documentType !== 'Damage Report PDF'
                          );
                          
                          return [...contractDocs, ...damageReportDocs, ...otherDocs];
                        })().map((doc) => {
                          const ext = doc.fileName.split('.').pop()?.toLowerCase();
                          const isPdf = doc.contentType?.includes('pdf') || ext === 'pdf';
                          const isImage = doc.contentType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif'].includes(ext || '');
                          
                          return (
                            <div key={doc.id} className="relative group">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (isPdf) {
                                    window.open(`/${doc.filePath}`, '_blank');
                                  } else {
                                    setPreviewDocument(doc);
                                    setPreviewDialogOpen(true);
                                  }
                                }}
                                className="flex items-center gap-2 pr-8"
                              >
                                {isPdf ? (
                                  <FileText className="h-4 w-4 text-red-600" />
                                ) : isImage ? (
                                  <FileCheck className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <FileText className="h-4 w-4 text-gray-600" />
                                )}
                                <div className="text-left">
                                  <div className="text-xs font-semibold truncate max-w-[150px]">{doc.documentType}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {doc.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                                  </div>
                                </div>
                              </Button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete ${doc.documentType}?`)) {
                                    try {
                                      const response = await fetch(`/api/documents/${doc.id}`, {
                                        method: 'DELETE',
                                        credentials: 'include',
                                      });
                                      
                                      if (!response.ok) {
                                        throw new Error('Delete failed');
                                      }
                                      
                                      queryClient.invalidateQueries({ queryKey: [`/api/documents/reservation/${createdReservationId}`] });
                                      toast({
                                        title: "Success",
                                        description: "Document deleted successfully",
                                      });
                                    } catch (error) {
                                      console.error('Delete failed:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to delete document",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                                title="Delete document"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional notes or requirements..." 
                        className="min-h-[100px]" 
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Success message after creating reservation */}
            {!editMode && createdReservationId && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-800">Reservation Created Successfully!</h4>
                    <p className="text-sm text-green-700 mt-1">
                      The unsigned contract has been generated. You can now upload additional documents using the section above.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Submit Button */}
            <div className="flex flex-col gap-4">
              {/* Template Selector - Show at top when not in preview or created state */}
              {!isPreviewMode && !createdReservationId && !editMode && selectedVehicle && selectedCustomer && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="text-sm font-medium text-gray-700 min-w-fit">Contract Template:</label>
                  <Select value={selectedTemplateId?.toString() || ""} onValueChange={(value) => setSelectedTemplateId(value ? parseInt(value) : null)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pdfTemplates.length === 0 ? (
                        <SelectItem value="no-templates" disabled>
                          No templates available - Create one in Documents
                        </SelectItem>
                      ) : (
                        pdfTemplates.map((template: any) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name} {template.isDefault && "(Default)"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview Mode Banner */}
              {isPreviewMode && !createdReservationId && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Preview Generated</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Review the contract that opened in a new tab. When ready, click "Finalize Reservation" to save.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (onCancel) {
                      onCancel();
                    } else {
                      navigate("/reservations");
                    }
                  }}
                >
                  {createdReservationId ? "Close" : "Cancel"}
                </Button>
                
                {/* Back to Edit button in preview mode */}
                {isPreviewMode && !createdReservationId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsPreviewMode(false);
                      setPreviewData(null);
                      setContractPreviewToken(null);
                      toast({
                        title: "Edit Mode",
                        description: "You can now modify the reservation information.",
                      });
                    }}
                    data-testid="button-back-to-edit"
                  >
                    Back to Edit
                  </Button>
                )}

                {/* Finalize Reservation button in preview mode */}
                {isPreviewMode && !createdReservationId && (
                  <Button
                    type="button"
                    onClick={handleFinalizeReservation}
                    disabled={createReservationMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-finalize-reservation"
                  >
                    {createReservationMutation.isPending ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Finalizing...
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Finalize Reservation
                      </>
                    )}
                  </Button>
                )}
                
                {/* Submit button - Preview in create mode, Update in edit mode, hidden when created/preview */}
                {!createdReservationId && !isPreviewMode && (
                  <Button 
                    type="submit" 
                    disabled={createReservationMutation.isPending || hasOverlap || (!editMode && !selectedTemplateId)}
                  >
                    {createReservationMutation.isPending 
                      ? "Saving..." 
                      : editMode ? "Update Reservation" : (
                        <>
                          <FileText className="mr-2 h-4 w-4" />
                          Preview & Generate Contract
                        </>
                      )
                    }
                  </Button>
                )}

                {/* Generate contract button - only in created/edit state */}
                {(createdReservationId || editMode) && selectedVehicle && selectedCustomer && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleGenerateContract}
                    disabled={generateContractMutation.isPending || !selectedTemplateId}
                    data-testid="button-generate-contract"
                  >
                    {generateContractMutation.isPending ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate & Save Contract
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Booking Conflict Warning */}
            {hasOverlap && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md flex items-center gap-2 text-destructive mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>This vehicle is already reserved for the selected dates. Please choose different dates or another vehicle.</div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
    
    {/* Document Preview Dialog */}
    <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{previewDocument?.documentType || 'Document Preview'}</DialogTitle>
          <DialogDescription>
            {previewDocument?.fileName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-gray-100 rounded-md p-4">
          {previewDocument && (() => {
            const ext = previewDocument.fileName.split('.').pop()?.toLowerCase();
            const isImage = previewDocument.contentType?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');

            if (isImage) {
              return (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={`/${previewDocument.filePath}`}
                    alt={previewDocument.fileName}
                    className="max-w-full max-h-[70vh] object-contain rounded shadow-lg"
                  />
                </div>
              );
            } else {
              return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <p className="text-gray-600">Preview not available for this file type.</p>
                  <Button onClick={() => window.open(`/${previewDocument.filePath}`, '_blank')}>
                    Open File
                  </Button>
                </div>
              );
            }
          })()}
        </div>
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => window.open(`/${previewDocument?.filePath}`, '_blank')}>
            Open in New Tab
          </Button>
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}