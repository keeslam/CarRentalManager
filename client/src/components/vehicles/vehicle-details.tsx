import { useState } from "react";
import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { ReservationAddDialog } from "@/components/reservations/reservation-add-dialog";
import { ReservationEditDialog } from "@/components/reservations/reservation-edit-dialog";
import { ExpenseViewDialog } from "@/components/expenses/expense-view-dialog";
import { ExpenseAddDialog } from "@/components/expenses/expense-add-dialog";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { isTrueValue } from "@/lib/utils";
import { getDaysUntil, getUrgencyColorClass } from "@/lib/date-utils";
import { Vehicle, Expense, Document, Reservation } from "@shared/schema";
import { InlineDocumentUpload } from "@/components/documents/inline-document-upload";
import { QuickStatusChangeButton } from "@/components/vehicles/quick-status-change-button";
import { CustomerViewDialog } from "@/components/customers/customer-view-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Bell, Mail, User, Eye, Edit, Calendar, Plus, Upload, X, FileCheck, Printer, Trash2, Download, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertReservationSchema, insertReservationSchemaBase } from "@shared/schema";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { ApkInspectionDialog } from "@/components/vehicles/apk-inspection-dialog";
import InteractiveDamageCheck from "@/pages/interactive-damage-check";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { format, addDays, parseISO } from "date-fns";
import { useMemo } from "react";

interface VehicleDetailsProps {
  vehicleId: number;
  inDialogContext?: boolean;
  onClose?: () => void;
}

export function VehicleDetails({ vehicleId, inDialogContext = false, onClose }: VehicleDetailsProps) {
  const [_, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  const [isApkReminderOpen, setIsApkReminderOpen] = useState(false);
  const [isApkInspectionOpen, setIsApkInspectionOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [editableEmails, setEditableEmails] = useState<{ [customerId: number]: string }>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);
  const [viewReservationDialogOpen, setViewReservationDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editReservationDialogOpen, setEditReservationDialogOpen] = useState(false);
  const [editReservationId, setEditReservationId] = useState<number | null>(null);
  const [damageFile, setDamageFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isEditVehicleDialogOpen, setIsEditVehicleDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAllScheduledMaintenance, setShowAllScheduledMaintenance] = useState(false);
  const [showAllRepairs, setShowAllRepairs] = useState(false);
  const [interactiveDamageCheckDialogOpen, setInteractiveDamageCheckDialogOpen] = useState(false);
  const [editingCheckId, setEditingCheckId] = useState<number | null>(null);
  const [expenseCategoryPages, setExpenseCategoryPages] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Expense pagination helpers
  const EXPENSE_ITEMS_PER_PAGE = 5;
  const getExpenseCategoryPage = (category: string) => expenseCategoryPages[category] || 1;
  const setExpenseCategoryPage = (category: string, page: number) => {
    setExpenseCategoryPages(prev => ({ ...prev, [category]: page }));
  };
  
  // Delete vehicle mutation
  const deleteVehicleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/vehicles/${vehicleId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete vehicle');
      }
      return await response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Vehicle deleted",
        description: "The vehicle has been successfully deleted."
      });
      
      // Use invalidateRelatedQueries to refresh all affected data
      invalidateRelatedQueries('vehicles');
      invalidateRelatedQueries('dashboard');
      
      // Navigate back to vehicles list
      navigate("/vehicles");
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting vehicle",
        description: error.message || "Failed to delete vehicle. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch vehicle details (MOVED UP to fix hoisting issue)
  const vehicleQueryKey = [`/api/vehicles/${vehicleId}`];
  const { 
    data: vehicle, 
    isLoading: isLoadingVehicle,
    error: vehicleError 
  } = useQuery({
    queryKey: vehicleQueryKey,
    enabled: !!vehicleId
  });

  // Auto-open APK dialog from sessionStorage (from notifications)
  React.useEffect(() => {
    if (!vehicle) return;
    
    // Check sessionStorage for APK dialog flag
    const shouldOpenApkDialog = sessionStorage.getItem('openApkDialog');
    
    console.log('[VehicleDetails] Checking for openApkDialog in sessionStorage:', shouldOpenApkDialog);
    console.log('[VehicleDetails] Vehicle loaded:', vehicle?.id, 'isApkInspectionOpen:', isApkInspectionOpen);
    
    if (shouldOpenApkDialog === 'true' && !isApkInspectionOpen) {
      console.log('[VehicleDetails] Opening APK inspection dialog');
      setIsApkInspectionOpen(true);
      // Clear the sessionStorage after opening
      sessionStorage.removeItem('openApkDialog');
    }
  }, [vehicle, isApkInspectionOpen, vehicleId]);
  
  // Auto-switch to maintenance tab from sessionStorage (from warranty notifications)
  React.useEffect(() => {
    if (!vehicle) return;
    
    // Check sessionStorage for maintenance tab flag
    const shouldOpenMaintenanceTab = sessionStorage.getItem('openMaintenanceTab');
    
    if (shouldOpenMaintenanceTab === 'true') {
      console.log('[VehicleDetails] Switching to maintenance tab from notification');
      setActiveTab('maintenance');
      // Clear the sessionStorage after switching
      sessionStorage.removeItem('openMaintenanceTab');
    }
  }, [vehicle, vehicleId]);

  // Send APK reminder mutation
  const sendApkReminderMutation = useMutation({
    mutationFn: async ({ message, subject, customerEmails }: { 
      message: string; 
      subject: string; 
      customerEmails: { [customerId: number]: string } 
    }) => {
      const response = await apiRequest("POST", "/api/notifications/send", {
        vehicleIds: [vehicleId],
        template: "custom", // Always use custom since we're providing our own content
        customMessage: message,
        customSubject: subject,
        emailFieldSelection: "auto",
        customerEmails: customerEmails // Pass the updated email addresses
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send APK reminder');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "APK reminder sent",
        description: `Successfully sent ${data.sent} reminder(s) to customer(s) with reservations for this vehicle.`
      });
      setIsApkReminderOpen(false);
      setCustomMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending APK reminder",
        description: error.message || "Failed to send APK reminder. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch customers with reservations for this vehicle
  const { data: customersWithReservations = [] } = useQuery({
    queryKey: [`/api/vehicles/${vehicleId}/customers-with-reservations`],
    enabled: isApkReminderOpen, // Only fetch when dialog is open
    queryFn: async () => {
      const response = await fetch(`/api/vehicles/${vehicleId}/customers-with-reservations`);
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    }
  });

  // Fetch all email templates for selection
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['/api/email-templates'],
    enabled: isApkReminderOpen, // Only fetch when dialog is open
    queryFn: async () => {
      const response = await fetch('/api/email-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  // Fetch maintenance history (maintenance_block reservations)
  const { data: maintenanceHistory = [] } = useQuery({
    queryKey: [`/api/reservations/vehicle/${vehicleId}`],
    enabled: !!vehicleId,
    queryFn: async () => {
      const response = await fetch(`/api/reservations/vehicle/${vehicleId}`);
      if (!response.ok) throw new Error('Failed to fetch maintenance history');
      const allReservations = await response.json();
      // Filter for maintenance_block reservations only
      return allReservations.filter((r: any) => r.type === 'maintenance_block');
    }
  });

  // Calculate next service due based on 30,000km or 1 year
  const serviceDueInfo = useMemo(() => {
    if (!vehicle) return null;
    
    const serviceInterval = 30000; // 30,000 km
    const serviceIntervalDays = 365; // 1 year

    let nextServiceByDate = null;
    let nextServiceByMileage = null;
    let daysUntilService = null;
    let kmUntilService = null;

    // Calculate by date (1 year from last service)
    if (vehicle.lastServiceDate) {
      const lastService = parseISO(vehicle.lastServiceDate);
      nextServiceByDate = addDays(lastService, serviceIntervalDays);
      daysUntilService = getDaysUntil(format(nextServiceByDate, 'yyyy-MM-dd'));
    }

    // Calculate by mileage (30,000 km from last service)
    if (vehicle.lastServiceMileage && vehicle.currentMileage) {
      const kmSinceService = vehicle.currentMileage - vehicle.lastServiceMileage;
      kmUntilService = serviceInterval - kmSinceService;
      nextServiceByMileage = vehicle.lastServiceMileage + serviceInterval;
    }

    const isDueByDate = daysUntilService !== null && daysUntilService <= 0;
    const isDueByMileage = kmUntilService !== null && kmUntilService <= 0;

    return {
      nextServiceByDate,
      nextServiceByMileage,
      daysUntilService,
      kmUntilService,
      isDueByDate,
      isDueByMileage,
      isServiceDue: isDueByDate || isDueByMileage,
    };
  }, [vehicle]);

  // Replace placeholders in template text
  const replacePlaceholders = (text: string, customer: any) => {
    if (!vehicle || !text) return text;
    
    const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Customer';
    const expiryDate = vehicle.apkDate ? new Date(vehicle.apkDate).toLocaleDateString('nl-NL') : 'Not set';
    
    return text
      .replace(/\{customerName\}/g, customerName)
      .replace(/\{vehiclePlate\}/g, formatLicensePlate(vehicle.licensePlate) || 'N/A')
      .replace(/\{vehicleBrand\}/g, vehicle.brand || 'N/A')
      .replace(/\{vehicleModel\}/g, vehicle.model || 'N/A')
      .replace(/\{apkDate\}/g, expiryDate)
      .replace(/\{licensePlate\}/g, formatLicensePlate(vehicle.licensePlate) || 'N/A')
      .replace(/\{firstName\}/g, customer?.firstName || 'Customer')
      .replace(/\{lastName\}/g, customer?.lastName || '')
      .replace(/\{email\}/g, customer?.email || 'N/A');
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = emailTemplates.find((t: any) => t.id === parseInt(templateId));
    if (template && vehicle && customersWithReservations.length > 0) {
      const firstCustomer = customersWithReservations[0]?.customer;
      setSelectedTemplateId(template.id);
      setTemplateSubject(replacePlaceholders(template.subject, firstCustomer));
      setTemplateContent(replacePlaceholders(template.content, firstCustomer));
    }
  };

  // Initialize template content and customer emails when dialog opens
  React.useEffect(() => {
    if (isApkReminderOpen && vehicle && customersWithReservations.length > 0) {
      // DO NOT auto-fill emails - let user select manually
      // Only reset to empty if dialog just opened
      setEditableEmails({});
      
      // Auto-select first APK template if available and no template is selected
      if (!selectedTemplateId && emailTemplates.length > 0) {
        const apkTemplate = emailTemplates.find((t: any) => 
          t.category?.toLowerCase() === 'apk' || 
          t.name?.toLowerCase().includes('apk')
        );
        
        if (apkTemplate) {
          const firstCustomer = customersWithReservations[0]?.customer;
          setSelectedTemplateId(apkTemplate.id);
          setTemplateSubject(replacePlaceholders(apkTemplate.subject, firstCustomer));
          setTemplateContent(replacePlaceholders(apkTemplate.content, firstCustomer));
        }
      }
    }
  }, [isApkReminderOpen, vehicle, customersWithReservations, emailTemplates, selectedTemplateId]);

  // New reservation form schema
  const newReservationSchema = insertReservationSchemaBase.extend({
    vehicleId: z.number().min(1, "Vehicle is required"),
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
    damageCheckFile: z.any().optional(),
    departureMileage: z.union([
      z.number().optional(),
      z.string().transform(val => val === "" ? undefined : parseInt(val) || undefined),
    ]).optional(),
    startMileage: z.union([
      z.number().optional(),
      z.string().transform(val => val === "" ? undefined : parseInt(val) || undefined),
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

  // Fetch customers for the form
  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
    enabled: isNewReservationOpen,
  });

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

  // Get today's date for form defaults
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultEndDate = format(addDays(new Date(), 3), "yyyy-MM-dd");

  // New reservation form
  const newReservationForm = useForm<z.infer<typeof newReservationSchema>>({
    resolver: zodResolver(newReservationSchema),
    defaultValues: {
      vehicleId: vehicleId,
      customerId: "",
      startDate: today,
      endDate: defaultEndDate,
      isOpenEnded: false,
      status: "pending",
      totalPrice: 0,
      notes: "",
      damageCheckFile: undefined,
      departureMileage: undefined,
      startMileage: undefined,
    },
  });

  // File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDamageFile(file);
      newReservationForm.setValue("damageCheckFile", file);
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
      newReservationForm.setValue("damageCheckFile", file);
    }
  };

  const removeDamageFile = () => {
    setDamageFile(null);
    newReservationForm.setValue("damageCheckFile", undefined);
  };

  // Create reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof newReservationSchema>) => {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add all other form data
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "damageCheckFile" && value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      
      // Add file if present
      if (damageFile) {
        formData.append("damageCheckFile", damageFile);
      }

      const response = await fetch("/api/reservations", {
        method: "POST", 
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create reservation');
      }
      return await response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Reservation created successfully",
        description: `Reservation for ${vehicle?.brand} ${vehicle?.model} has been created.`
      });
      
      // Refresh related data
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/reservations/vehicle/${vehicleId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      
      // Close dialog and reset form
      setIsNewReservationOpen(false);
      newReservationForm.reset();
      setDamageFile(null);
      setIsDragActive(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating reservation",
        description: error.message || "Failed to create reservation. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Watch form values for validation
  const isOpenEndedWatch = newReservationForm.watch("isOpenEnded");

  // Update end date when open-ended status changes
  React.useEffect(() => {
    if (isOpenEndedWatch) {
      newReservationForm.setValue("endDate", "");
    } else if (!newReservationForm.getValues("endDate")) {
      newReservationForm.setValue("endDate", defaultEndDate);
    }
  }, [isOpenEndedWatch, newReservationForm, defaultEndDate]);
  
  // Fetch vehicle expenses
  const { data: expenses, isLoading: isLoadingExpenses } = useQuery<Expense[]>({
    queryKey: [`/api/expenses/vehicle/${vehicleId}`],
  });
  
  // Fetch vehicle documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: [`/api/documents/vehicle/${vehicleId}`],
  });
  
  // Fetch interactive damage checks for this vehicle
  const { data: interactiveDamageChecks = [], isLoading: isLoadingDamageChecks } = useQuery({
    queryKey: [`/api/interactive-damage-checks/vehicle/${vehicleId}`],
  });
  
  // Normalize document type to standard category
  const normalizeDocumentType = (documentType: string): string => {
    const type = documentType.toLowerCase().trim();
    
    if (type.includes('contract')) return 'Contracts';
    if (type.includes('damage') && (type.includes('report') || type.includes('form'))) return 'Damage Reports';
    if (type.includes('photo') || type.includes('image')) return 'Vehicle Photos';
    if (type.includes('invoice') || type.includes('receipt')) return 'Invoices & Receipts';
    if (type.includes('insurance')) return 'Insurance Documents';
    if (type.includes('registration') || type.includes('title')) return 'Registration Documents';
    if (type.includes('maintenance') || type.includes('service')) return 'Maintenance Records';
    if (type.includes('inspection') || type.includes('apk')) return 'Inspection Reports';
    if (type.includes('other')) return 'Other Documents';
    
    // If no match, return original with proper capitalization
    return documentType.charAt(0).toUpperCase() + documentType.slice(1);
  };
  
  // Group documents by category
  const documentsByCategory = documents?.reduce((grouped, document) => {
    const category = normalizeDocumentType(document.documentType);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(document);
    return grouped;
  }, {} as Record<string, Document[]>) || {};
  
  // Define query keys for easier reference
  const vehicleReservationsQueryKey = [`/api/reservations/vehicle/${vehicleId}`];
  
  // Fetch vehicle reservations
  const { 
    data: reservations, 
    isLoading: isLoadingReservations,
    refetch: refetchReservations 
  } = useQuery<Reservation[]>({
    queryKey: vehicleReservationsQueryKey,
  });
  
  // Delete reservation mutation
  const deleteReservationMutation = useMutation({
    mutationFn: async (reservationId: number) => {
      const response = await apiRequest('DELETE', `/api/reservations/${reservationId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete reservation');
      }
      return await response.json();
    },
    onSuccess: async () => {
      // Use invalidateRelatedQueries to refresh all related data
      invalidateRelatedQueries('reservations');
      invalidateRelatedQueries('vehicles', vehicleId);
      invalidateRelatedQueries('dashboard');
      
      // Explicitly force a refetch to ensure the UI updates immediately
      await refetchReservations();
      
      toast({
        title: "Reservation deleted",
        description: "The reservation has been successfully deleted."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reservation",
        variant: "destructive"
      });
    }
  });
  
  // Calculate days until APK expiration
  const daysUntilApk = vehicle?.apkDate ? getDaysUntil(vehicle.apkDate) : 0;
  const apkUrgencyClass = getUrgencyColorClass(daysUntilApk);
  
  // Calculate days until warranty expiration
  const daysUntilWarranty = vehicle?.warrantyEndDate ? getDaysUntil(vehicle.warrantyEndDate) : 0;
  const warrantyUrgencyClass = getUrgencyColorClass(daysUntilWarranty);
  
  // Calculate total expenses
  const totalExpenses = expenses?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
  
  // Group expenses by category
  const expensesByCategory = expenses?.reduce((grouped, expense) => {
    const category = expense.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(expense);
    return grouped;
  }, {} as Record<string, Expense[]>) || {};
  
  // Calculate total amount by category with sorted expenses
  const totalByCategory = Object.entries(expensesByCategory).map(([category, categoryExpenses]) => {
    const sortedExpenses = categoryExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      category,
      expenses: sortedExpenses,
      amount: sortedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
      count: sortedExpenses.length
    };
  }).sort((a, b) => b.amount - a.amount);
  
  // Find current active RENTAL reservation (not maintenance)
  const activeReservation = reservations?.find(reservation => {
    if (!reservation.startDate || reservation.type !== 'standard') return false;
    const today = new Date();
    const startDate = parseISO(reservation.startDate);
    
    // Check if currently active (rented, confirmed, or pending status)
    const activeStatuses = ['rented', 'confirmed', 'pending'];
    if (activeStatuses.includes(reservation.status) && today >= startDate) {
      // For reservations with an end date, check if we're still within the range
      if (reservation.endDate) {
        const endDate = parseISO(reservation.endDate);
        return today <= endDate;
      }
      // For open-ended reservations (endDate is null), they're active if started
      return true;
    }
    
    return false;
  });
  
  // If no active reservation, find the next upcoming RENTAL reservation (not maintenance)
  const upcomingReservation = !activeReservation ? reservations
    ?.filter(reservation => {
      if (!reservation.startDate || reservation.status === 'cancelled' || reservation.type !== 'standard') return false;
      const today = new Date();
      const startDate = parseISO(reservation.startDate);
      return startDate > today;
    })
    .sort((a, b) => {
      const dateA = parseISO(a.startDate);
      const dateB = parseISO(b.startDate);
      return dateA.getTime() - dateB.getTime();
    })[0] : null;
  
  const displayReservation = activeReservation || upcomingReservation;
  
  if (isLoadingVehicle) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  
  if (!vehicle) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Vehicle not found</h2>
        <p className="mb-4 text-gray-600">The vehicle you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/vehicles")}>Back to Vehicles</Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-lg font-medium text-gray-600">{formatLicensePlate(vehicle.licensePlate)}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => inDialogContext && onClose ? onClose() : navigate("/vehicles")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left mr-2">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            {inDialogContext ? "Back" : "Back to Vehicles"}
          </Button>

          <Dialog open={isEditVehicleDialogOpen} onOpenChange={setIsEditVehicleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-edit-vehicle">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil mr-2">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </svg>
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Vehicle</DialogTitle>
                <DialogDescription>
                  Update the details for {vehicle?.brand} {vehicle?.model} ({formatLicensePlate(vehicle?.licensePlate || "")})
                </DialogDescription>
              </DialogHeader>
              <VehicleForm 
                initialData={vehicle}
                editMode={true}
                redirectToList={false}
                onSuccess={() => {
                  setIsEditVehicleDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                  queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
                }}
                customCancelButton={
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditVehicleDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                }
              />
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline"
            onClick={() => {
              window.open(`/api/vehicles/${vehicleId}/damage-check-pdf`, '_blank');
            }}
            data-testid="button-download-damage-check"
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Download Damage Check
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-600 hover:text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2 mr-2">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" x2="10" y1="11" y2="17"/>
                  <line x1="14" x2="14" y1="11" y2="17"/>
                </svg>
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the vehicle {vehicle.brand} {vehicle.model} ({formatLicensePlate(vehicle.licensePlate)}).
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.preventDefault();
                    deleteVehicleMutation.mutate();
                  }}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isNewReservationOpen} onOpenChange={setIsNewReservationOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-reservation">
                <Calendar className="h-4 w-4 mr-2" />
                New Reservation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Reservation</DialogTitle>
                <DialogDescription>
                  Create a new reservation for {vehicle?.brand} {vehicle?.model} ({formatLicensePlate(vehicle?.licensePlate || "")})
                </DialogDescription>
              </DialogHeader>
              
              <Form {...newReservationForm}>
                <form onSubmit={newReservationForm.handleSubmit((data) => createReservationMutation.mutate(data))} className="space-y-3">
                  {/* Customer Selection */}
                  <FormField
                    control={newReservationForm.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Customer *</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            options={customerOptions}
                            value={field.value ? field.value.toString() : ''}
                            onChange={(value) => {
                              newReservationForm.setValue("customerId", parseInt(value), {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true
                              });
                            }}
                            placeholder="Search and select a customer..."
                            searchPlaceholder="Search by name, phone, or email..."
                            groups={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dates and Status Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={newReservationForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-8" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={newReservationForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">End Date {!isOpenEndedWatch && "*"}</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              disabled={isOpenEndedWatch}
                              placeholder={isOpenEndedWatch ? "Open-ended" : ""}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newReservationForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Open-ended checkbox */}
                  <FormField
                    control={newReservationForm.control}
                    name="isOpenEnded"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 -mt-1">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-xs">Open-ended rental</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            No specific end date
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Price and Mileage Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={newReservationForm.control}
                      name="totalPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Price (€)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newReservationForm.control}
                      name="departureMileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Departure KM</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="Mileage..."
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={newReservationForm.control}
                      name="startMileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Start KM</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="Mileage..."
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Damage Check File Upload */}
                  <FormField
                    control={newReservationForm.control}
                    name="damageCheckFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Damage Check Photo</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {/* File upload area */}
                            <div
                              onDrop={handleDrop}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              className={`
                                border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                                transition-colors duration-200
                                ${isDragActive 
                                  ? 'border-primary bg-primary/10' 
                                  : 'border-muted-foreground/25 hover:border-primary'
                                }
                              `}
                            >
                              <input
                                type="file"
                                onChange={handleFileChange}
                                accept="image/*,.pdf"
                                className="hidden"
                                id="damage-file-upload"
                              />
                              <label htmlFor="damage-file-upload" className="cursor-pointer">
                                <div className="flex flex-col items-center space-y-1">
                                  <Upload className="h-6 w-6 text-muted-foreground" />
                                  <div>
                                    <p className="text-xs">
                                      <span className="font-medium">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Images/PDF up to 25MB
                                    </p>
                                  </div>
                                </div>
                              </label>
                            </div>
                            
                            {/* Selected file display */}
                            {damageFile && (
                              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                                <div className="flex items-center space-x-2">
                                  <FileCheck className="h-3 w-3 text-green-600" />
                                  <span className="text-xs font-medium truncate">{damageFile.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({(damageFile.size / 1024 / 1024).toFixed(1)}MB)
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={removeDamageFile}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={newReservationForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes for this reservation..." 
                            className="h-16 text-sm"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter className="gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsNewReservationOpen(false)}
                      className="h-8"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createReservationMutation.isPending}
                      className="h-8"
                    >
                      {createReservationMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          {/* Quick Status Change Button for Active Reservation */}
          <QuickStatusChangeButton vehicleId={vehicleId} />
        </div>
      </div>
      
      {/* Vehicle Info Cards */}
      <div className={`grid grid-cols-1 gap-4 ${displayReservation ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Vehicle Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{vehicle.vehicleType || "N/A"}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">APK Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-semibold">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "N/A"}</p>
              {vehicle.apkDate && (
                <Badge className={apkUrgencyClass}>
                  {daysUntilApk} days
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Warranty Expiration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-semibold">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "N/A"}</p>
              {vehicle.warrantyEndDate && (
                <Badge className={warrantyUrgencyClass}>
                  {daysUntilWarranty} days
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        {activeReservation && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Current Renter</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerViewDialog customerId={activeReservation.customerId}>
                <p className="text-2xl font-semibold text-blue-900 hover:text-blue-600 cursor-pointer transition-colors">
                  {activeReservation.customer?.name || "N/A"}
                </p>
              </CustomerViewDialog>
              {(activeReservation.customer?.phone || activeReservation.customer?.driverPhone) && (
                <div className="text-sm text-blue-700 mt-1 space-y-0.5">
                  {activeReservation.customer?.phone && (
                    <p>
                      <span className="font-medium">Phone:</span> {activeReservation.customer.phone}
                    </p>
                  )}
                  {activeReservation.customer?.driverPhone && (
                    <p>
                      <span className="font-medium">Driver:</span> {activeReservation.customer.driverPhone}
                    </p>
                  )}
                </div>
              )}
              <div className="text-sm text-blue-700 mt-2 pt-2 border-t border-blue-200">
                <p className="font-medium">Rental Period:</p>
                <p className="text-xs mt-0.5">
                  {formatDate(activeReservation.startDate)} - {activeReservation.endDate ? formatDate(activeReservation.endDate) : "TBD"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {upcomingReservation && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Upcoming Reservation</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerViewDialog customerId={upcomingReservation.customerId}>
                <p className="text-2xl font-semibold text-green-900 hover:text-green-600 cursor-pointer transition-colors">
                  {upcomingReservation.customer?.name || "N/A"}
                </p>
              </CustomerViewDialog>
              {(upcomingReservation.customer?.phone || upcomingReservation.customer?.driverPhone) && (
                <div className="text-sm text-green-700 mt-1 space-y-0.5">
                  {upcomingReservation.customer?.phone && (
                    <p>
                      <span className="font-medium">Phone:</span> {upcomingReservation.customer.phone}
                    </p>
                  )}
                  {upcomingReservation.customer?.driverPhone && (
                    <p>
                      <span className="font-medium">Driver:</span> {upcomingReservation.customer.driverPhone}
                    </p>
                  )}
                </div>
              )}
              <div className="text-sm text-green-700 mt-2 pt-2 border-t border-green-200">
                <p className="font-medium">Rental Period:</p>
                <p className="text-xs mt-0.5">
                  {formatDate(upcomingReservation.startDate)} - {formatDate(upcomingReservation.endDate)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        {/* General Information Tab */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
              <CardDescription>General information about this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle ID</h4>
                    <p className="text-base">{vehicle.id}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">License Plate</h4>
                    <p className="text-base">{formatLicensePlate(vehicle.licensePlate)}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Brand</h4>
                    <p className="text-base">{vehicle.brand}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Model</h4>
                    <p className="text-base">{vehicle.model}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle Type</h4>
                    <p className="text-base">{vehicle.vehicleType || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Chassis Number</h4>
                    <p className="text-base">{vehicle.chassisNumber || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Technical Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Fuel Type</h4>
                    <p className="text-base">{vehicle.fuel || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">🛢️ Recommended Oil</h4>
                    <p className="text-base font-semibold" data-testid="text-recommended-oil">
                      {vehicle.recommendedOil || <span className="text-gray-400 font-normal">Not specified</span>}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">AdBlue</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.adBlue} disabled />
                      <span className="text-sm text-gray-500">{vehicle.adBlue ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Euro Zone</h4>
                    <p className="text-base">{vehicle.euroZone || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Euro Zone End Date</h4>
                    <p className="text-base">{vehicle.euroZoneEndDate ? formatDate(vehicle.euroZoneEndDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Tire Size</h4>
                    <p className="text-base">{vehicle.tireSize || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Winter Tires</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.winterTires} disabled />
                      <span className="text-sm text-gray-500">{vehicle.winterTires ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Registration & Maintenance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">APK Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="APK Inspection"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Upload APK
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <p className="text-base">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Warranty End Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Warranty"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Upload warranty
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <p className="text-base">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Registration Status</h4>
                    <div className="space-y-4 rounded border p-3">
                      <div className="bg-gray-50 p-2 rounded-sm text-gray-700 text-xs mb-2">
                        Note: A vehicle can either be registered to an individual (Opnaam) or to a company (BV), but not both at the same time.
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <Switch checked={isTrueValue(vehicle.registeredTo)} disabled />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Individual Registration (Opnaam): {isTrueValue(vehicle.registeredTo) ? 
                              <span className="text-green-600 font-semibold">Active</span> : 
                              <span className="text-gray-500">Not active</span>}
                          </span>
                          {isTrueValue(vehicle.registeredTo) && vehicle.registeredToDate && (
                            <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-1.5 rounded">
                              <span className="block">
                                Last updated: {formatDate(vehicle.registeredToDate)}
                                {vehicle.registeredToBy && (
                                  <span className="ml-1">by <span className="font-medium">{vehicle.registeredToBy}</span></span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t my-2 border-gray-100"></div>
                      
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <Switch checked={isTrueValue(vehicle.company)} disabled />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium">
                            Company Registration (BV): {isTrueValue(vehicle.company) ? 
                              <span className="text-green-600 font-semibold">Active</span> : 
                              <span className="text-gray-500">Not active</span>}
                          </span>
                          {isTrueValue(vehicle.company) && vehicle.companyDate && (
                            <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-1.5 rounded">
                              <span className="block">
                                Last updated: {formatDate(vehicle.companyDate)}
                                {vehicle.companyBy && (
                                  <span className="ml-1">by <span className="font-medium">{vehicle.companyBy}</span></span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {(isTrueValue(vehicle.registeredTo) && isTrueValue(vehicle.company)) && (
                        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-amber-800 text-xs">
                          <span className="font-semibold">Warning:</span> Both registration types are active, which may cause confusion. 
                          Please edit this vehicle to set only one registration type.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Contract & Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Contract Number</h4>
                    <p className="text-base">{vehicle.contractNumber || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Monthly Price</h4>
                    <p className="text-base">{vehicle.monthlyPrice ? formatCurrency(vehicle.monthlyPrice) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Daily Price</h4>
                    <p className="text-base">{vehicle.dailyPrice ? formatCurrency(vehicle.dailyPrice) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Date In</h4>
                    <p className="text-base">{vehicle.dateIn ? formatDate(vehicle.dateIn) : "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Date Out</h4>
                    <p className="text-base">{vehicle.dateOut ? formatDate(vehicle.dateOut) : "N/A"}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Damage & Safety</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Damage Check</h4>
                    <div className="text-base">
                      {documentsByCategory["Damage Report"]?.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <span>Completed</span>
                        </div>
                      ) : (
                        <span>{vehicle.damageCheck ? "Yes" : "No"}</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Damage Check Date</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Damage Report"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Add report
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <div>
                      {(documentsByCategory["Damage Report"]?.length > 0 || documentsByCategory["Damage Form"]?.length > 0) ? (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          <span>
                            {formatDate(new Date(
                              (documentsByCategory["Damage Report"]?.[0]?.uploadDate || 
                               documentsByCategory["Damage Form"]?.[0]?.uploadDate)
                            ).toISOString().split('T')[0])}
                          </span>
                        </div>
                      ) : (
                        <p className="text-base">{vehicle.damageCheckDate ? formatDate(vehicle.damageCheckDate) : "N/A"}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Vehicle Photos</h4>
                      <InlineDocumentUpload 
                        vehicleId={vehicleId}
                        preselectedType="Vehicle Photos"
                        onSuccess={() => {
                          // Refresh vehicle details after upload
                          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                          queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                        }}
                      >
                        <span className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          + Add photos
                        </span>
                      </InlineDocumentUpload>
                    </div>
                    <div>
                      {documentsByCategory["Vehicle Photos"]?.length > 0 ? (
                        <div className="text-base">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            <span>Vehicle photo attachments</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {documentsByCategory["Vehicle Photos"].length} document(s)
                          </p>
                        </div>
                      ) : (
                        <p className="text-base">No attachments found</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Roadside Assistance</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.roadsideAssistance} disabled />
                      <span className="text-sm text-gray-500">{vehicle.roadsideAssistance ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">GPS</h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Switch checked={!!vehicle.gps} disabled />
                        <span className="text-sm text-gray-500">{vehicle.gps ? "Enabled" : "Disabled"}</span>
                      </div>
                      {vehicle.gps && (
                        <>
                          <p className="text-sm">
                            <span className="font-medium">IMEI:</span> {vehicle.imei || "N/A"}
                          </p>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={`inline-flex items-center gap-1 ${vehicle.gpsSwapped ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                                <path d="M21 3v5h-5"/>
                              </svg>
                              {vehicle.gpsSwapped ? 'Module Swapped' : 'Not Swapped'}
                            </span>
                            <span className={`inline-flex items-center gap-1 ${vehicle.gpsActivated ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {vehicle.gpsActivated ? (
                                  <><polyline points="20 6 9 17 4 12"/></>
                                ) : (
                                  <><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></>
                                )}
                              </svg>
                              {vehicle.gpsActivated ? 'Activated' : 'Not Activated'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">WOK Notification</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.wokNotification} disabled />
                      <span className="text-sm text-gray-500">{vehicle.wokNotification ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Latest Fuel Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(() => {
                    // Get the most recent reservation with fuel data
                    const latestReservationWithFuel = reservations
                      ?.filter(r => r.fuelLevelPickup || r.fuelLevelReturn)
                      ?.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
                    
                    if (!latestReservationWithFuel) {
                      return (
                        <div className="col-span-3 text-center py-4 text-gray-500">
                          No fuel tracking data available
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        {latestReservationWithFuel.fuelLevelPickup && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Last Pickup Level</h4>
                            <p className="text-base font-semibold">{latestReservationWithFuel.fuelLevelPickup}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(latestReservationWithFuel.startDate)}
                            </p>
                          </div>
                        )}
                        
                        {latestReservationWithFuel.fuelLevelReturn && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Last Return Level</h4>
                            <p className="text-base font-semibold">{latestReservationWithFuel.fuelLevelReturn}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {latestReservationWithFuel.endDate ? formatDate(latestReservationWithFuel.endDate) : 'Ongoing'}
                            </p>
                          </div>
                        )}
                        
                        {latestReservationWithFuel.fuelCost && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Last Fuel Cost</h4>
                            <p className="text-base font-semibold">{formatCurrency(Number(latestReservationWithFuel.fuelCost))}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="mb-0">
                <h3 className="text-lg font-semibold border-b pb-2 mb-4">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Departure Mileage</h4>
                    <p className="text-base">{vehicle.departureMileage || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Return Mileage</h4>
                    <p className="text-base">{vehicle.returnMileage || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Spare Key</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.spareKey} disabled />
                      <span className="text-sm text-gray-500">{vehicle.spareKey ? "Available" : "Not Available"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Radio Code</h4>
                    <p className="text-base">{vehicle.radioCode || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Seat Covers</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.seatcovers} disabled />
                      <span className="text-sm text-gray-500">{vehicle.seatcovers ? "Installed" : "Not Installed"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Backup Beepers</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.backupbeepers} disabled />
                      <span className="text-sm text-gray-500">{vehicle.backupbeepers ? "Installed" : "Not Installed"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Spare Tire</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.spareTire} disabled />
                      <span className="text-sm text-gray-500">{vehicle.spareTire ? "Available" : "Not Available"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Onboard Tools & Jack</h4>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!vehicle.toolsAndJack} disabled />
                      <span className="text-sm text-gray-500">{vehicle.toolsAndJack ? "Available" : "Not Available"}</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Internal Appointments</h4>
                    <p className="text-base">{vehicle.internalAppointments || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Remarks</h4>
                    <p className="text-base">{vehicle.remarks || "N/A"}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Created By</h4>
                    <p className="text-base">{vehicle.createdBy || "N/A"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Expense History</CardTitle>
                <CardDescription>All expenses related to this vehicle</CardDescription>
                <div className="flex justify-end space-x-2">
                  <ExpenseViewDialog 
                    vehicleId={vehicleId}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/expenses/vehicle/${vehicleId}`] });
                      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                    }}
                  />
                  <ExpenseAddDialog 
                    vehicleId={vehicleId}
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/expenses/vehicle/${vehicleId}`] });
                      queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingExpenses ? (
                  <div className="flex justify-center p-6">
                    <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : totalByCategory.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No expenses recorded for this vehicle
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={[]} className="w-full">
                    {totalByCategory.map(({ category, expenses: categoryExpenses, amount, count }) => {
                      const currentPage = getExpenseCategoryPage(category);
                      const totalPages = Math.ceil(count / EXPENSE_ITEMS_PER_PAGE);
                      const startIndex = (currentPage - 1) * EXPENSE_ITEMS_PER_PAGE;
                      const endIndex = startIndex + EXPENSE_ITEMS_PER_PAGE;
                      const paginatedExpenses = categoryExpenses.slice(startIndex, endIndex);
                      
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="hover:bg-gray-50 px-4 py-3 rounded-md">
                            <div className="flex justify-between items-center w-full pr-4">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-sm font-medium">
                                  {category}
                                </Badge>
                                <span className="text-gray-500 text-sm">
                                  ({count} expense{count !== 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="font-semibold text-right">
                                {formatCurrency(amount)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pt-2 pb-4 space-y-3">
                              {paginatedExpenses.map((expense) => (
                                <div key={expense.id} className="border-b pb-3 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium">{expense.description}</p>
                                      <div className="flex items-center mt-1">
                                        <span className="text-sm text-gray-500">{formatDate(expense.date)}</span>
                                      </div>
                                    </div>
                                    <p className="text-lg font-semibold">{formatCurrency(Number(expense.amount))}</p>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Pagination Controls */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 px-2 pt-3 border-t">
                                  <p className="text-sm text-muted-foreground">
                                    Showing {startIndex + 1} to {Math.min(endIndex, count)} of {count} expenses
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setExpenseCategoryPage(category, currentPage - 1)}
                                      disabled={currentPage === 1}
                                    >
                                      <ChevronLeft className="h-4 w-4" />
                                      Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <Button
                                          key={page}
                                          variant={currentPage === page ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setExpenseCategoryPage(category, page)}
                                          className="w-8 h-8 p-0"
                                        >
                                          {page}
                                        </Button>
                                      ))}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setExpenseCategoryPage(category, currentPage + 1)}
                                      disabled={currentPage === totalPages}
                                    >
                                      Next
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Expense Summary</CardTitle>
                <CardDescription>Total expenses by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
                  <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
                </div>
                
                <div className="space-y-3">
                  {isLoadingExpenses ? (
                    <div className="flex justify-center p-6">
                      <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : totalByCategory.length === 0 ? (
                    <div className="text-center py-2 text-gray-500">
                      No expense data available
                    </div>
                  ) : (
                    totalByCategory.map(({ category, amount }) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm">{category}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Vehicle Documents</CardTitle>
                  <CardDescription>All documents related to this vehicle</CardDescription>
                </div>
                <InlineDocumentUpload 
                  vehicleId={vehicleId} 
                  onSuccess={() => {
                    // Refresh the documents list after upload
                    queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                    queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Interactive Damage Checks Section */}
              {interactiveDamageChecks && interactiveDamageChecks.length > 0 && (
                <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-blue-900">Interactive Damage Checks</h3>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setEditingCheckId(null);
                        setInteractiveDamageCheckDialogOpen(true);
                      }}
                      data-testid="button-new-damage-check"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Check
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {interactiveDamageChecks.map((check: any) => (
                      <div key={check.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-100">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant={check.checkType === 'pickup' ? 'default' : 'secondary'}>
                                {check.checkType === 'pickup' ? 'Pick-up' : 'Return'}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {new Date(check.checkDate).toLocaleDateString()}
                              </span>
                              {check.completedBy && (
                                <span className="text-sm text-gray-500">by {check.completedBy}</span>
                              )}
                            </div>
                            {check.notes && (
                              <p className="text-sm text-gray-600 mt-1">{check.notes}</p>
                            )}
                            <div className="flex gap-2 text-xs text-gray-500 mt-2">
                              {check.mileage && <span>Mileage: {check.mileage} km</span>}
                              {check.fuelLevel && <span>Fuel: {check.fuelLevel}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/interactive-damage-checks/${check.id}/pdf`, {
                                    credentials: 'include',
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error('Failed to generate PDF');
                                  }
                                  
                                  // Get the PDF blob
                                  const blob = await response.blob();
                                  
                                  // Create a download link
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `damage_check_${check.vehicleId}_${check.checkType}_${new Date(check.checkDate).toISOString().split('T')[0]}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  window.URL.revokeObjectURL(url);
                                  
                                  toast({ 
                                    title: "PDF Generated", 
                                    description: "Damage check PDF downloaded successfully" 
                                  });
                                } catch (error) {
                                  console.error('Error generating PDF:', error);
                                  toast({ 
                                    title: "Error", 
                                    description: "Failed to generate PDF", 
                                    variant: "destructive" 
                                  });
                                }
                              }}
                              data-testid={`button-pdf-${check.id}`}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingCheckId(check.id);
                                setInteractiveDamageCheckDialogOpen(true);
                              }}
                              data-testid={`button-edit-${check.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to delete this ${check.checkType} damage check from ${new Date(check.checkDate).toLocaleDateString()}?`)) {
                                  try {
                                    const response = await fetch(`/api/interactive-damage-checks/${check.id}`, {
                                      method: 'DELETE',
                                      credentials: 'include',
                                    });
                                    
                                    if (!response.ok) {
                                      throw new Error('Failed to delete damage check');
                                    }
                                    
                                    queryClient.invalidateQueries({ queryKey: [`/api/interactive-damage-checks/vehicle/${vehicleId}`] });
                                    queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                                    
                                    toast({ 
                                      title: "Damage Check Deleted", 
                                      description: "The damage check has been deleted successfully" 
                                    });
                                  } catch (error) {
                                    console.error('Error deleting damage check:', error);
                                    toast({ 
                                      title: "Error", 
                                      description: "Failed to delete damage check", 
                                      variant: "destructive" 
                                    });
                                  }
                                }
                              }}
                              data-testid={`button-delete-${check.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Document Categories */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Quick Upload Categories</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId} 
                      preselectedType="APK Inspection"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-blue-500">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 18v-6" />
                          <path d="m9 15 3 3 3-3" />
                        </svg>
                        <span className="block text-sm font-medium">APK Inspection</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Contract"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-orange-500">
                          <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
                          <path d="M9 9h6" />
                          <path d="M9 13h6" />
                          <path d="M9 17h3" />
                          <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
                          <path d="M2 15h6v6H2z" />
                        </svg>
                        <span className="block text-sm font-medium">Contract</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Damage Report"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-red-500">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="block text-sm font-medium">Damage Report</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Vehicle Photos"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-green-500">
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        <span className="block text-sm font-medium">Vehicle Photos</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                  
                  <div className="flex flex-col items-center bg-slate-50 p-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors">
                    <InlineDocumentUpload 
                      vehicleId={vehicleId}
                      preselectedType="Maintenance Record"
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                      }}
                    >
                      <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-purple-500">
                          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                          <line x1="9" x2="15" y1="9" y2="9" />
                          <line x1="9" x2="15" y1="13" y2="13" />
                          <line x1="9" x2="15" y1="17" y2="17" />
                        </svg>
                        <span className="block text-sm font-medium">Maintenance</span>
                      </div>
                    </InlineDocumentUpload>
                  </div>
                </div>
              </div>
            
              {/* Document List */}
              {isLoadingDocuments ? (
                <div className="flex justify-center p-6">
                  <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : documents?.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No documents uploaded for this vehicle
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Document categories */}
                  {Object.entries(documentsByCategory).map(([category, docs]) => {
                    const isExpanded = expandedCategories.has(category);
                    const toggleCategory = () => {
                      setExpandedCategories(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(category)) {
                          newSet.delete(category);
                        } else {
                          newSet.add(category);
                        }
                        return newSet;
                      });
                    };
                    
                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={toggleCategory}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          data-testid={`toggle-category-${category}`}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-600" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-600" />
                            )}
                            <h3 className="text-lg font-medium">{category}</h3>
                          </div>
                          <Badge variant="outline" className="ml-2">
                            {docs.length} {docs.length === 1 ? 'document' : 'documents'}
                          </Badge>
                        </button>
                        
                        {isExpanded && (
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {docs.map((document) => (
                                <Card key={document.id} className="overflow-hidden">
                                  <div className="bg-gray-100 p-6 flex items-center justify-center">
                                    <DocumentIcon type={document.contentType} />
                                  </div>
                                  <CardContent className="p-4">
                                    <h3 className="font-medium mb-1 truncate" title={document.fileName}>{document.fileName}</h3>
                                    <div className="flex items-center text-sm text-gray-500 mb-2">
                                      <Badge variant="outline" className="mr-2">{document.documentType}</Badge>
                                      <span>{formatDate(document.uploadDate?.toString() || "")}</span>
                                    </div>
                                    {document.createdBy && (
                                      <div className="text-xs text-gray-500 mb-2">
                                        Created by: {document.createdBy}
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center gap-2 mt-2">
                                      <button 
                                        onClick={() => window.open(
                                          `/${document.filePath}`,
                                          'Document Preview',
                                          'width=900,height=700,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes'
                                        )}
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                                        data-testid={`button-view-document-${document.id}`}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        View
                                      </button>
                                      
                                      <a 
                                        href={`/api/documents/download/${document.id}`} 
                                        className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1 transition-colors"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid={`link-download-document-${document.id}`}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                      </a>
                                      
                                      <button 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const printWindow = window.open(
                                            `/${document.filePath}`, 
                                            'Print Preview',
                                            'width=900,height=700,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=yes'
                                          );
                                          if (printWindow) {
                                            printWindow.onload = () => {
                                              printWindow.print();
                                            };
                                          }
                                        }}
                                        className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1 transition-colors"
                                        data-testid={`button-print-document-${document.id}`}
                                      >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print
                                      </button>
                                      
                                      <button 
                                        className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 transition-colors"
                                        data-testid={`button-delete-document-${document.id}`}
                                        onClick={async () => {
                                          if (window.confirm(`Are you sure you want to delete the document "${document.fileName}"?`)) {
                                            try {
                                              const response = await fetch(`/api/documents/${document.id}`, {
                                                method: 'DELETE',
                                              });
                                              
                                              if (response.ok) {
                                                queryClient.invalidateQueries({ queryKey: [`/api/documents/vehicle/${vehicleId}`] });
                                                queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}`] });
                                                toast({
                                                  title: "Document deleted",
                                                  description: "The document has been deleted successfully.",
                                                });
                                              } else {
                                                const errorData = await response.json();
                                                throw new Error(errorData.message || "Failed to delete document");
                                              }
                                            } catch (error) {
                                              console.error("Error deleting document:", error);
                                              toast({
                                                title: "Error",
                                                description: error instanceof Error ? error.message : "Failed to delete document",
                                                variant: "destructive",
                                              });
                                            }
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                      </button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reservations Tab */}
        <TabsContent value="reservations" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Reservation History</CardTitle>
                  <CardDescription>All reservations for this vehicle</CardDescription>
                </div>
                <ReservationAddDialog initialVehicleId={vehicleId}>
                  <Button size="sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-plus mr-2">
                      <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                      <line x1="19" x2="19" y1="16" y2="22" />
                      <line x1="16" x2="22" y1="19" y2="19" />
                    </svg>
                    New Reservation
                  </Button>
                </ReservationAddDialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingReservations ? (
                <div className="flex justify-center p-6">
                  <svg className="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : reservations?.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No reservations for this vehicle
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reservations?.map((reservation) => (
                        <tr key={reservation.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{reservation.customer?.name}</div>
                            <div className="text-xs text-gray-500">{reservation.customer?.phone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <span>{formatDate(reservation.startDate)}</span> - 
                              <span> {formatDate(reservation.endDate)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={reservation.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(reservation.totalPrice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary-600 hover:text-primary-800"
                                onClick={() => {
                                  setSelectedReservation(reservation);
                                  setViewReservationDialogOpen(true);
                                }}
                              >
                                View
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:text-blue-800"
                                onClick={() => {
                                  setEditReservationId(reservation.id);
                                  setEditReservationDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-800"
                                    disabled={deleteReservationMutation.isPending}
                                  >
                                    {deleteReservationMutation.isPending ? (
                                      <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                          <path d="M3 6h18"></path>
                                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        </svg>
                                        Delete
                                      </>
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this reservation from {vehicle.brand} {vehicle.model} ({formatLicensePlate(vehicle.licensePlate)}).
                                      <p className="mt-2 font-medium">
                                        {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                                      </p>
                                      <p className="mt-1 text-sm text-gray-500">
                                        Customer: {reservation.customer?.name}
                                      </p>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        deleteReservationMutation.mutate(reservation.id);
                                      }}
                                      className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>APK and warranty information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">APK Inspection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Current APK Valid Until</p>
                      <p className="text-lg font-medium">{vehicle.apkDate ? formatDate(vehicle.apkDate) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Days Remaining</p>
                      <div className="flex items-center">
                        <p className="text-lg font-medium mr-2">{daysUntilApk}</p>
                        {vehicle.apkDate && <Badge className={apkUrgencyClass}>{daysUntilApk <= 30 ? "Action needed soon" : "OK"}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      variant={daysUntilApk <= 30 ? "default" : "outline"}
                      onClick={() => setIsApkInspectionOpen(true)}
                      data-testid="button-schedule-apk-inspection"
                    >
                      Schedule APK Inspection
                    </Button>
                    <Dialog open={isApkReminderOpen} onOpenChange={setIsApkReminderOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex items-center gap-2"
                          data-testid="button-send-apk-reminder"
                        >
                          <Bell className="h-4 w-4" />
                          Send APK Reminder
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Send APK Reminder - {vehicle?.licensePlate}
                          </DialogTitle>
                          <DialogDescription>
                            Send an APK inspection reminder to customers who have rented this vehicle. 
                            Review and edit customer emails, customize the message template, and send personalized reminders.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <ScrollArea className="max-h-[60vh] overflow-y-auto">
                          <div className="grid gap-6 py-4">
                            
                            {/* Customer Email Section */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <h3 className="text-lg font-medium">Customer Email Addresses</h3>
                              </div>
                              
                              {customersWithReservations.length > 0 ? (
                                <div className="space-y-3">
                                  {customersWithReservations.map((item: any, index: number) => {
                                    // Collect all available email addresses for this customer
                                    const customerEmails = [];
                                    if (item.customer?.emailForMOT) customerEmails.push({ label: 'APK/MOT Email', value: item.customer.emailForMOT });
                                    if (item.customer?.email) customerEmails.push({ label: 'Main Email', value: item.customer.email });
                                    if (item.customer?.emailForInvoices) customerEmails.push({ label: 'Invoice Email', value: item.customer.emailForInvoices });
                                    if (item.customer?.emailGeneral) customerEmails.push({ label: 'General Email', value: item.customer.emailGeneral });
                                    
                                    return (
                                      <div key={item.customer?.id || index} className="border rounded-lg p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <Label className="text-sm font-medium">Customer Name</Label>
                                            <p className="text-sm">
                                              {item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : 'Unknown Customer'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              Customer ID: {item.customer?.id || 'N/A'}
                                            </p>
                                          </div>
                                          <div>
                                            <Label htmlFor={`email-${item.customer?.id}`} className="text-sm font-medium">
                                              Email Address
                                            </Label>
                                            
                                            {customerEmails.length > 1 ? (
                                              <div className="space-y-2">
                                                {/* Dropdown to select which email */}
                                                <Select
                                                  value=""
                                                  onValueChange={(value) => 
                                                    setEditableEmails(prev => ({
                                                      ...prev,
                                                      [item.customer?.id]: value
                                                    }))
                                                  }
                                                >
                                                  <SelectTrigger className="mt-1" data-testid={`select-email-${item.customer?.id}`}>
                                                    <SelectValue placeholder={`Select from ${customerEmails.length} emails`} />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {customerEmails.map((emailOption, idx) => (
                                                      <SelectItem key={idx} value={emailOption.value}>
                                                        {emailOption.label}: {emailOption.value}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                
                                                {/* Editable input field */}
                                                <Input
                                                  id={`email-${item.customer?.id}`}
                                                  type="email"
                                                  value={editableEmails[item.customer?.id] || ''}
                                                  onChange={(e) => 
                                                    setEditableEmails(prev => ({
                                                      ...prev,
                                                      [item.customer?.id]: e.target.value
                                                    }))
                                                  }
                                                  placeholder="Type or select email above"
                                                  data-testid={`input-email-${item.customer?.id}`}
                                                />
                                              </div>
                                            ) : (
                                              <Input
                                                id={`email-${item.customer?.id}`}
                                                type="email"
                                                value={editableEmails[item.customer?.id] || ''}
                                                onChange={(e) => 
                                                  setEditableEmails(prev => ({
                                                    ...prev,
                                                    [item.customer?.id]: e.target.value
                                                  }))
                                                }
                                                placeholder="Enter email address"
                                                className="mt-1"
                                                data-testid={`input-email-${item.customer?.id}`}
                                              />
                                            )}
                                          </div>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500">
                                          Reservation: {item.reservation?.startDate} to {item.reservation?.endDate}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="border rounded-lg p-6 text-center text-gray-500">
                                  <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  <p>No customers found for this vehicle.</p>
                                  <p className="text-sm">This vehicle has not been rented yet, or customers don't have email addresses on file.</p>
                                </div>
                              )}
                            </div>

                            <Separator />

                            {/* Template Preview and Editing Section */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                <h3 className="text-lg font-medium">Email Template Selection</h3>
                              </div>
                              
                              <div className="space-y-4">
                                {/* Template Selector */}
                                <div>
                                  <Label htmlFor="template-select" className="text-sm font-medium">
                                    Select Email Template
                                  </Label>
                                  <Select
                                    value={selectedTemplateId?.toString() || ""}
                                    onValueChange={handleTemplateSelect}
                                  >
                                    <SelectTrigger className="mt-1" data-testid="select-email-template">
                                      <SelectValue placeholder="Choose a template from Communications" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {emailTemplates.length > 0 ? (
                                        emailTemplates.map((template: any) => (
                                          <SelectItem key={template.id} value={template.id.toString()}>
                                            {template.name} {template.category ? `(${template.category})` : ''}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="no-templates" disabled>
                                          No templates available
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Select a pre-made template from your Communications page
                                  </p>
                                </div>

                                <Separator />

                                <div>
                                  <Label htmlFor="template-subject" className="text-sm font-medium">
                                    Email Subject
                                  </Label>
                                  <Input
                                    id="template-subject"
                                    value={templateSubject}
                                    onChange={(e) => setTemplateSubject(e.target.value)}
                                    placeholder="Email subject line"
                                    className="mt-1"
                                    data-testid="input-template-subject"
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="template-content" className="text-sm font-medium">
                                    Email Content
                                  </Label>
                                  <Textarea
                                    id="template-content"
                                    value={templateContent}
                                    onChange={(e) => setTemplateContent(e.target.value)}
                                    rows={10}
                                    placeholder="Email message content"
                                    className="mt-1 font-mono text-sm"
                                    data-testid="textarea-template-content"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    You can edit this template to customize the message for this vehicle's APK reminder.
                                  </p>
                                </div>
                              </div>

                              {/* Template Preview Box */}
                              <div className="border rounded-lg p-4 bg-gray-50">
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  Preview
                                </h4>
                                <div className="bg-white border rounded p-3 text-sm">
                                  <div className="font-medium mb-2">Subject: {templateSubject}</div>
                                  <Separator className="my-2" />
                                  <div className="whitespace-pre-wrap">{templateContent}</div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </ScrollArea>
                        
                        <DialogFooter className="mt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsApkReminderOpen(false);
                              setCustomMessage("");
                              setTemplateSubject("");
                              setTemplateContent("");
                              setEditableEmails({});
                              setSelectedTemplateId(null);
                            }}
                            data-testid="button-cancel-reminder"
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => sendApkReminderMutation.mutate({ 
                              message: templateContent,
                              subject: templateSubject,
                              customerEmails: editableEmails
                            })}
                            disabled={
                              sendApkReminderMutation.isPending || 
                              customersWithReservations.length === 0 ||
                              Object.keys(editableEmails).length === 0 ||
                              Object.values(editableEmails).some(email => !email || email.trim() === '')
                            }
                            data-testid="button-send-reminder"
                          >
                            {sendApkReminderMutation.isPending 
                              ? "Sending..." 
                              : Object.keys(editableEmails).length === 0
                              ? "Select email addresses to send"
                              : `Send to ${Object.keys(editableEmails).length} Customer(s)`}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Warranty Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Warranty Valid Until</p>
                      <p className="text-lg font-medium">{vehicle.warrantyEndDate ? formatDate(vehicle.warrantyEndDate) : "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Days Remaining</p>
                      <div className="flex items-center">
                        <p className="text-lg font-medium mr-2">{daysUntilWarranty}</p>
                        {vehicle.warrantyEndDate && <Badge className={warrantyUrgencyClass}>{daysUntilWarranty <= 30 ? "Expiring soon" : "Active"}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button size="sm" variant="outline">
                      Update Warranty Information
                    </Button>
                  </div>
                </div>

                {/* Service Due Alert Section */}
                {serviceDueInfo && (vehicle.lastServiceDate || vehicle.lastServiceMileage) && (
                  <div className={`border p-4 rounded-lg ${serviceDueInfo.isServiceDue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Next Service Due
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {serviceDueInfo.nextServiceByDate && (
                        <div>
                          <p className="text-sm text-gray-500">Service Due By Date</p>
                          <p className="text-lg font-medium">{formatDate(format(serviceDueInfo.nextServiceByDate, 'yyyy-MM-dd'))}</p>
                          <Badge className={serviceDueInfo.isDueByDate ? 'bg-red-600' : 'bg-green-600'}>
                            {serviceDueInfo.isDueByDate ? 'Overdue' : `${serviceDueInfo.daysUntilService} days`}
                          </Badge>
                        </div>
                      )}
                      {serviceDueInfo.nextServiceByMileage && (
                        <div>
                          <p className="text-sm text-gray-500">Service Due At Mileage</p>
                          <p className="text-lg font-medium">{serviceDueInfo.nextServiceByMileage.toLocaleString()} km</p>
                          <Badge className={serviceDueInfo.isDueByMileage ? 'bg-red-600' : 'bg-green-600'}>
                            {serviceDueInfo.isDueByMileage ? 'Overdue' : `${serviceDueInfo.kmUntilService} km remaining`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      <p>Last service: {vehicle.lastServiceDate ? formatDate(vehicle.lastServiceDate) : 'Not recorded'}</p>
                      {vehicle.lastServiceMileage && (
                        <p>Last service mileage: {vehicle.lastServiceMileage.toLocaleString()} km</p>
                      )}
                      {vehicle.currentMileage && (
                        <p>Current mileage: {vehicle.currentMileage.toLocaleString()} km</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Scheduled Maintenance History Section */}
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Scheduled Maintenance History
                  </h3>
                  {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'scheduled_maintenance').length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {maintenanceHistory
                          .filter((m: any) => m.maintenanceCategory === 'scheduled_maintenance')
                          .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                          .slice(0, showAllScheduledMaintenance ? undefined : 5)
                          .map((maintenance: any) => {
                            const maintenanceType = maintenance.notes?.split(':')[0] || 'General Maintenance';
                            const maintenanceDetails = maintenance.notes?.split('\n')?.[1] || '';
                            
                            return (
                              <div key={maintenance.id} className="border rounded-lg p-3 bg-blue-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{maintenanceType}</h4>
                                      {maintenance.maintenanceStatus && (
                                        <Badge variant={
                                          maintenance.maintenanceStatus === 'out' ? 'default' : 
                                          maintenance.maintenanceStatus === 'in' ? 'secondary' : 
                                          'outline'
                                        }>
                                          {maintenance.maintenanceStatus === 'out' ? 'Completed' : 
                                           maintenance.maintenanceStatus === 'in' ? 'In Progress' : 
                                           'Scheduled'}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{formatDate(maintenance.startDate)}</p>
                                    {maintenanceDetails && (
                                      <p className="text-sm mt-2 text-gray-700">{maintenanceDetails}</p>
                                    )}
                                    {maintenance.notes && !maintenanceDetails && (
                                      <p className="text-sm mt-2 text-gray-700">{maintenance.notes}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'scheduled_maintenance').length > 5 && (
                        <Button
                          variant="ghost"
                          className="w-full mt-3"
                          onClick={() => setShowAllScheduledMaintenance(!showAllScheduledMaintenance)}
                        >
                          {showAllScheduledMaintenance ? (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4 mr-2" />
                              Show {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'scheduled_maintenance').length - 5} more
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No scheduled maintenance history yet</p>
                      <p className="text-sm">Oil changes, filters, and routine service will appear here</p>
                    </div>
                  )}
                </div>

                {/* Repair History Section */}
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Repair History
                  </h3>
                  {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'repair').length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {maintenanceHistory
                          .filter((m: any) => m.maintenanceCategory === 'repair')
                          .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                          .slice(0, showAllRepairs ? undefined : 5)
                          .map((maintenance: any) => {
                            const maintenanceType = maintenance.notes?.split(':')[0] || 'Repair';
                            const maintenanceDetails = maintenance.notes?.split('\n')?.[1] || '';
                            
                            return (
                              <div key={maintenance.id} className="border rounded-lg p-3 bg-orange-50">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium">{maintenanceType}</h4>
                                      {maintenance.maintenanceStatus && (
                                        <Badge variant={
                                          maintenance.maintenanceStatus === 'out' ? 'default' : 
                                          maintenance.maintenanceStatus === 'in' ? 'secondary' : 
                                          'outline'
                                        }>
                                          {maintenance.maintenanceStatus === 'out' ? 'Completed' : 
                                           maintenance.maintenanceStatus === 'in' ? 'In Progress' : 
                                           'Scheduled'}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{formatDate(maintenance.startDate)}</p>
                                    {maintenanceDetails && (
                                      <p className="text-sm mt-2 text-gray-700">{maintenanceDetails}</p>
                                    )}
                                    {maintenance.notes && !maintenanceDetails && (
                                      <p className="text-sm mt-2 text-gray-700">{maintenance.notes}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'repair').length > 5 && (
                        <Button
                          variant="ghost"
                          className="w-full mt-3"
                          onClick={() => setShowAllRepairs(!showAllRepairs)}
                        >
                          {showAllRepairs ? (
                            <>
                              <ChevronDown className="h-4 w-4 mr-2" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4 mr-2" />
                              Show {maintenanceHistory.filter((m: any) => m.maintenanceCategory === 'repair').length - 5} more
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No repair history yet</p>
                      <p className="text-sm">Breakdowns, tire replacements, and repairs will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab - User Activity Tracking */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>User activity related to this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Record Creation</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Created by</p>
                        <p className="text-sm text-gray-500">
                          {vehicle.createdBy || "Unknown user"} on {formatDate(vehicle.createdAt.toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Last Update</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-green-100 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">Last modified by</p>
                        <p className="text-sm text-gray-500">
                          {vehicle.updatedBy || "Unknown user"} on {formatDate(vehicle.updatedAt.toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Registration Status Changes */}
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Registration Status Changes</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {vehicle.registeredToDate && (
                      <div className="flex items-start gap-2">
                        <div className="bg-amber-100 p-2 rounded-full mt-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                            <path d="M21.2 8A10 10 0 0 0 12 2v10h10a9.9 9.9 0 0 0-.8-4"></path>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Registration status: Opnaam</p>
                          <div className="text-sm text-gray-500">
                            <p>Changed on {formatDate(vehicle.registeredToDate)}</p>
                            <p>By {vehicle.registeredToBy || "admin"}</p>
                          </div>
                          <div className="mt-1 text-xs py-1 px-2 bg-gray-100 rounded-md inline-block">
                            Last updated: {formatDate(vehicle.registeredToDate || vehicle.updatedAt.toString())}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {vehicle.companyDate && (
                      <div className="flex items-start gap-2">
                        <div className="bg-amber-100 p-2 rounded-full mt-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
                            <path d="M21.2 8A10 10 0 0 0 12 2v10h10a9.9 9.9 0 0 0-.8-4"></path>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Registration status: BV</p>
                          <div className="text-sm text-gray-500">
                            <p>Changed on {formatDate(vehicle.companyDate)}</p>
                            <p>By {vehicle.companyBy || "admin"}</p>
                          </div>
                          <div className="mt-1 text-xs py-1 px-2 bg-gray-100 rounded-md inline-block">
                            Last updated: {formatDate(vehicle.companyDate || vehicle.updatedAt.toString())}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!vehicle.registeredToDate && !vehicle.companyDate && (
                      <p className="text-gray-500">No registration status changes recorded</p>
                    )}
                  </div>
                </div>
                
                {/* Related Documents Timeline */}
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Document Timeline</h3>
                  <div className="space-y-4">
                    {documents && documents.length > 0 ? (
                      documents.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()).map(doc => (
                        <div key={doc.id} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
                          <div className="bg-purple-100 p-2 rounded-full mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-sm">{doc.documentType} uploaded</h4>
                              <span className="text-xs text-gray-500">{formatDate(doc.uploadDate.toString())}</span>
                            </div>
                            <p className="text-sm">{doc.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {doc.createdBy ? `Uploaded by ${doc.createdBy}` : "Uploaded by unknown user"}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No documents uploaded yet</p>
                    )}
                  </div>
                </div>
                
                {/* Expenses Timeline */}
                <div className="border p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-2">Expenses Timeline</h3>
                  <div className="space-y-4">
                    {expenses && expenses.length > 0 ? (
                      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => (
                        <div key={expense.id} className="flex items-start gap-3 pb-4 border-b last:border-b-0">
                          <div className="bg-red-100 p-2 rounded-full mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                              <path d="M9 10V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path>
                              <rect x="1" y="12" width="6" height="8" rx="1"></rect>
                              <rect x="9" y="12" width="6" height="8" rx="1"></rect>
                              <rect x="17" y="12" width="6" height="8" rx="1"></rect>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-sm">{expense.category} expense added</h4>
                              <span className="text-xs text-gray-500">{formatDate(expense.date)}</span>
                            </div>
                            <p className="text-sm">{formatCurrency(Number(expense.amount))}</p>
                            <p className="text-xs text-gray-500">
                              {expense.createdBy ? `Added by ${expense.createdBy}` : "Added by unknown user"}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No expenses recorded yet</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Reservation Dialog */}
      <Dialog open={viewReservationDialogOpen} onOpenChange={setViewReservationDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
            <DialogDescription>
              View complete reservation information
            </DialogDescription>
          </DialogHeader>
          
          {selectedReservation && (
            <div className="space-y-6">
              {/* Reservation Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Reservation ID</Label>
                  <p className="text-sm font-medium">#{selectedReservation.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={selectedReservation.status} />
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Customer</Label>
                <p className="text-sm font-medium">
                  {selectedReservation.customer?.name || 'Unknown Customer'}
                </p>
                {selectedReservation.customer?.email && (
                  <p className="text-xs text-gray-500">{selectedReservation.customer.email}</p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                  <p className="text-sm font-medium">{formatDate(selectedReservation.startDate)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">End Date</Label>
                  <p className="text-sm font-medium">
                    {selectedReservation.endDate && selectedReservation.endDate !== "undefined" 
                      ? formatDate(selectedReservation.endDate) 
                      : "Open-ended"
                    }
                  </p>
                </div>
              </div>

              {/* Price */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Total Price</Label>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(selectedReservation.totalPrice)}
                </p>
              </div>

              {/* Notes */}
              {selectedReservation.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded border">
                    {selectedReservation.notes}
                  </p>
                </div>
              )}

              {/* Reservation Type */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Type</Label>
                <p className="text-sm font-medium capitalize">
                  {selectedReservation.type === 'maintenance_block' ? 'Maintenance' : 
                   selectedReservation.type === 'replacement' ? 'Replacement Vehicle' : 
                   'Standard Rental'}
                </p>
              </div>

              {/* Creation Info */}
              <div className="text-xs text-gray-500 border-t pt-4">
                <p>Created by {selectedReservation.createdBy || 'Unknown'} on {formatDate(selectedReservation.createdAt.toString())}</p>
                {selectedReservation.updatedBy && (
                  <p>Last updated by {selectedReservation.updatedBy} on {formatDate(selectedReservation.updatedAt.toString())}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setViewReservationDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      <ReservationEditDialog
        open={editReservationDialogOpen}
        onOpenChange={setEditReservationDialogOpen}
        reservationId={editReservationId}
        onSuccess={(reservation) => {
          toast({
            title: "Reservation updated",
            description: "The reservation has been successfully updated."
          });
          // Refresh vehicle data and related queries
          queryClient.invalidateQueries({ queryKey: vehicleQueryKey });
          queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
          queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${vehicleId}/reservations`] });
          setEditReservationDialogOpen(false);
          setEditReservationId(null);
        }}
      />

      {/* APK Inspection Scheduling Dialog */}
      {vehicle && (
        <ApkInspectionDialog
          open={isApkInspectionOpen}
          onOpenChange={setIsApkInspectionOpen}
          vehicle={vehicle}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: vehicleQueryKey });
            queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
            queryClient.invalidateQueries({ queryKey: ['/api/vehicles/apk-expiring'] });
          }}
        />
      )}
      
      {/* Interactive Damage Check Dialog */}
      <Dialog open={interactiveDamageCheckDialogOpen} onOpenChange={setInteractiveDamageCheckDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Interactive Damage Check</DialogTitle>
          <div className="h-full overflow-auto">
            <InteractiveDamageCheck 
              onClose={() => {
                setInteractiveDamageCheckDialogOpen(false);
                // Refresh damage checks when dialog closes
                queryClient.invalidateQueries({ queryKey: [`/api/interactive-damage-checks/vehicle/${vehicleId}`] });
              }} 
              editingCheckId={editingCheckId}
              initialVehicleId={vehicleId}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper components
function StatusBadge({ status }: { status: string }) {
  switch (status.toLowerCase()) {
    case "confirmed":
      return <Badge className="bg-success-50 text-success-600 hover:bg-success-100">{status}</Badge>;
    case "pending":
      return <Badge className="bg-warning-50 text-warning-600 hover:bg-warning-100">{status}</Badge>;
    case "cancelled":
      return <Badge className="bg-danger-50 text-danger-600 hover:bg-danger-100">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function DocumentIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-gray-600">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  } else if (type === 'application/pdf') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text text-gray-600">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    );
  } else {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file text-gray-600">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }
}
