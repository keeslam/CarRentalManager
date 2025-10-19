import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
 Mail,
  Settings as SettingsIcon,
  Key,
  Server,
  Edit,
  Plus,
  Building2,
  Bell,
  FileText,
  Calendar as CalendarIcon,
  DollarSign,
  Clock,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailSetting {
  id: number;
  key: string;
  value: {
    fromEmail?: string;
    fromName?: string;
    apiKey?: string;
    smtpHost?: string;
    smtpPort?: string;
    smtpUser?: string;
    smtpPassword?: string;
    provider?: string;
    purpose?: 'apk' | 'maintenance' | 'gps' | 'custom' | 'default';
  };
  category: string;
  description?: string;
}

interface AppSetting {
  id: number;
  key: string;
  value: any;
  category: string;
  description?: string;
}

const EMAIL_PURPOSES = [
  { value: 'apk', label: 'APK Reminders', description: 'For sending APK inspection reminders' },
  { value: 'maintenance', label: 'Maintenance Alerts', description: 'For maintenance notifications' },
  { value: 'gps', label: 'GPS/IEI Information', description: 'For sending GPS and IEI numbers' },
  { value: 'custom', label: 'Custom Messages', description: 'For custom email communications' },
  { value: 'default', label: 'Default/General', description: 'Default email for all other purposes' },
] as const;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("business");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailSetting | null>(null);
  
  // Email form state
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [provider, setProvider] = useState("mailersend");
  const [purpose, setPurpose] = useState<'apk' | 'maintenance' | 'gps' | 'custom' | 'default'>('default');
  
  // GPS settings state
  const [gpsRecipientEmail, setGpsRecipientEmail] = useState("");
  const [gpsActivationSubject, setGpsActivationSubject] = useState("");
  const [gpsActivationMessage, setGpsActivationMessage] = useState("");
  const [gpsSwapSubject, setGpsSwapSubject] = useState("");
  const [gpsSwapMessage, setGpsSwapMessage] = useState("");
  
  // Business Rules state
  const [defaultRentalDuration, setDefaultRentalDuration] = useState("7");
  const [minRentalPeriod, setMinRentalPeriod] = useState("1");
  const [maxRentalPeriod, setMaxRentalPeriod] = useState("365");
  const [defaultFuelPolicy, setDefaultFuelPolicy] = useState("full-to-full");
  const [lateReturnFee, setLateReturnFee] = useState("50");
  const [securityDeposit, setSecurityDeposit] = useState("500");
  
  // Notification Preferences state
  const [apkReminderDays, setApkReminderDays] = useState("60");
  const [warrantyReminderDays, setWarrantyReminderDays] = useState("30");
  const [maintenanceReminderDays, setMaintenanceReminderDays] = useState("7");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [realtimeSoundEnabled, setRealtimeSoundEnabled] = useState(false);
  const [notifyOnNewReservation, setNotifyOnNewReservation] = useState(true);
  const [notifyOnVehicleReturn, setNotifyOnVehicleReturn] = useState(true);
  const [notifyOnMaintenanceDue, setNotifyOnMaintenanceDue] = useState(true);
  
  // Document Settings state
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState("INV-{YEAR}-{NUMBER}");
  const [invoiceStartingNumber, setInvoiceStartingNumber] = useState("1001");
  const [contractTerms, setContractTerms] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [autoGenerateContract, setAutoGenerateContract] = useState(true);
  const [autoGenerateInvoice, setAutoGenerateInvoice] = useState(false);
  
  // Calendar Settings state  
  const [holidays, setHolidays] = useState<Array<{date: string, name: string}>>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  
  // WhatsApp Settings state
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [whatsappAutoNotifications, setWhatsappAutoNotifications] = useState(false);
  const [whatsappNotifyOnReservationCreated, setWhatsappNotifyOnReservationCreated] = useState(false);
  const [whatsappNotifyOnPickupReminder, setWhatsappNotifyOnPickupReminder] = useState(false);
  const [whatsappNotifyOnReturnReminder, setWhatsappNotifyOnReturnReminder] = useState(false);
  const [whatsappNotifyOnPaymentDue, setWhatsappNotifyOnPaymentDue] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [blockedDates, setBlockedDates] = useState<Array<{startDate: string, endDate: string, reason: string}>>([]);
  const [newBlockedStart, setNewBlockedStart] = useState("");
  const [newBlockedEnd, setNewBlockedEnd] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  const [defaultMaintenanceDuration, setDefaultMaintenanceDuration] = useState("1");
  const [reservationReminderHours, setReservationReminderHours] = useState("24");

  // Fetch all app settings
  const { data: appSettings, isLoading: loadingSettings } = useQuery<AppSetting[]>({
    queryKey: ['/api/app-settings'],
  });
  
  // Fetch email settings
  const { data: emailSettings, isLoading: loadingEmail } = useQuery<EmailSetting[]>({
    queryKey: ['/api/app-settings/email'],
  });

  // Load settings into state when data arrives
  useEffect(() => {
    if (!appSettings) return;
    
    // Business Rules
    const businessRules = appSettings.find(s => s.key === 'business_rules');
    if (businessRules?.value) {
      setDefaultRentalDuration(businessRules.value.defaultRentalDuration || "7");
      setMinRentalPeriod(businessRules.value.minRentalPeriod || "1");
      setMaxRentalPeriod(businessRules.value.maxRentalPeriod || "365");
      setDefaultFuelPolicy(businessRules.value.defaultFuelPolicy || "full-to-full");
      setLateReturnFee(businessRules.value.lateReturnFee || "50");
      setSecurityDeposit(businessRules.value.securityDeposit || "500");
    }
    
    // Notification Preferences
    const notifPrefs = appSettings.find(s => s.key === 'notification_preferences');
    if (notifPrefs?.value) {
      setApkReminderDays(notifPrefs.value.apkReminderDays || "60");
      setWarrantyReminderDays(notifPrefs.value.warrantyReminderDays || "30");
      setMaintenanceReminderDays(notifPrefs.value.maintenanceReminderDays || "7");
      setEmailNotificationsEnabled(notifPrefs.value.emailNotificationsEnabled ?? true);
      setRealtimeSoundEnabled(notifPrefs.value.realtimeSoundEnabled ?? false);
      setNotifyOnNewReservation(notifPrefs.value.notifyOnNewReservation ?? true);
      setNotifyOnVehicleReturn(notifPrefs.value.notifyOnVehicleReturn ?? true);
      setNotifyOnMaintenanceDue(notifPrefs.value.notifyOnMaintenanceDue ?? true);
    }
    
    // Document Settings
    const docSettings = appSettings.find(s => s.key === 'document_settings');
    if (docSettings?.value) {
      setInvoiceNumberFormat(docSettings.value.invoiceNumberFormat || "INV-{YEAR}-{NUMBER}");
      setInvoiceStartingNumber(docSettings.value.invoiceStartingNumber || "1001");
      setContractTerms(docSettings.value.contractTerms || "");
      setInvoiceFooter(docSettings.value.invoiceFooter || "");
      setAutoGenerateContract(docSettings.value.autoGenerateContract ?? true);
      setAutoGenerateInvoice(docSettings.value.autoGenerateInvoice ?? false);
    }
    
    // Calendar Settings
    const calSettings = appSettings.find(s => s.key === 'calendar_settings');
    if (calSettings?.value) {
      setHolidays(calSettings.value.holidays || []);
      setBlockedDates(calSettings.value.blockedDates || []);
      setDefaultMaintenanceDuration(calSettings.value.defaultMaintenanceDuration || "1");
      setReservationReminderHours(calSettings.value.reservationReminderHours || "24");
    }
    
    // GPS Settings
    const gpsRecipient = appSettings.find(s => s.key === 'gps_recipient');
    if (gpsRecipient?.value?.email) {
      setGpsRecipientEmail(gpsRecipient.value.email);
    }
    
    const gpsTemplates = appSettings.find(s => s.key === 'gps_email_templates');
    if (gpsTemplates?.value) {
      setGpsActivationSubject(gpsTemplates.value.activationSubject || "");
      setGpsActivationMessage(gpsTemplates.value.activationMessage || "");
      setGpsSwapSubject(gpsTemplates.value.swapSubject || "");
      setGpsSwapMessage(gpsTemplates.value.swapMessage || "");
    }
  }, [appSettings]);

  // Save settings mutations
  const saveBusinessRules = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'business_rules',
        category: 'business',
        value: {
          defaultRentalDuration,
          minRentalPeriod,
          maxRentalPeriod,
          defaultFuelPolicy,
          lateReturnFee,
          securityDeposit,
        }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Business rules saved successfully" });
    },
  });

  const saveNotificationPrefs = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'notification_preferences',
        category: 'notifications',
        value: {
          apkReminderDays,
          warrantyReminderDays,
          maintenanceReminderDays,
          emailNotificationsEnabled,
          realtimeSoundEnabled,
          notifyOnNewReservation,
          notifyOnVehicleReturn,
          notifyOnMaintenanceDue,
        }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Notification preferences saved successfully" });
    },
  });

  const saveDocumentSettings = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'document_settings',
        category: 'documents',
        value: {
          invoiceNumberFormat,
          invoiceStartingNumber,
          contractTerms,
          invoiceFooter,
          autoGenerateContract,
          autoGenerateInvoice,
        }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Document settings saved successfully" });
    },
  });

  const saveCalendarSettings = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'calendar_settings',
        category: 'calendar',
        value: {
          holidays,
          blockedDates,
          defaultMaintenanceDuration,
          reservationReminderHours,
        }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Calendar settings saved successfully" });
    },
  });

  // GPS settings mutations (keep existing)
  const saveGpsRecipient = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'gps_recipient',
        category: 'gps',
        value: { email: gpsRecipientEmail }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "GPS recipient email saved successfully" });
    },
  });

  const saveGpsTemplates = useMutation({
    mutationFn: async () => {
      const data = {
        key: 'gps_email_templates',
        category: 'gps',
        value: {
          activationSubject: gpsActivationSubject,
          activationMessage: gpsActivationMessage,
          swapSubject: gpsSwapSubject,
          swapMessage: gpsSwapMessage,
        }
      };
      await apiRequest('POST', '/api/app-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "GPS email templates saved successfully" });
    },
  });

  // Email settings mutations (keep existing)
  const saveEmailSetting = useMutation({
    mutationFn: async (emailData: any) => {
      const url = editingEmail
        ? `/api/app-settings/${editingEmail.id}`
        : '/api/app-settings';
      const method = editingEmail ? 'PUT' : 'POST';
      await apiRequest(method, url, emailData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings/email'] });
      toast({
        title: "Success",
        description: editingEmail ? "Email configuration updated successfully" : "Email configuration saved successfully",
      });
      setIsEmailDialogOpen(false);
      resetEmailForm();
    },
  });

  const resetEmailForm = () => {
    setEditingEmail(null);
    setFromEmail("");
    setFromName("");
    setApiKey("");
    setSmtpHost("");
    setSmtpPort("");
    setSmtpUser("");
    setSmtpPassword("");
    setProvider("mailersend");
    setPurpose('default');
  };

  const handleOpenEmailDialog = (email?: EmailSetting) => {
    if (email) {
      setEditingEmail(email);
      setFromEmail(email.value.fromEmail || "");
      setFromName(email.value.fromName || "");
      setApiKey(email.value.apiKey || "");
      setSmtpHost(email.value.smtpHost || "");
      setSmtpPort(email.value.smtpPort || "");
      setSmtpUser(email.value.smtpUser || "");
      setSmtpPassword(email.value.smtpPassword || "");
      setProvider(email.value.provider || "mailersend");
      setPurpose(email.value.purpose || 'default');
    } else {
      resetEmailForm();
    }
    setIsEmailDialogOpen(true);
  };

  const handleSaveEmail = () => {
    const emailData = {
      key: `email_${purpose}_${provider}`,
      category: 'email',
      value: {
        fromEmail,
        fromName,
        provider,
        purpose,
        ...(provider === 'smtp' ? {
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassword,
        } : {
          apiKey,
        }),
      },
    };
    
    saveEmailSetting.mutate(emailData);
  };

  // Holiday management
  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) {
      toast({ title: "Error", description: "Please enter both date and name", variant: "destructive" });
      return;
    }
    setHolidays([...holidays, { date: newHolidayDate, name: newHolidayName }]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (index: number) => {
    setHolidays(holidays.filter((_, i) => i !== index));
  };

  // Blocked dates management
  const handleAddBlockedDate = () => {
    if (!newBlockedStart || !newBlockedEnd || !newBlockedReason) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    setBlockedDates([...blockedDates, { 
      startDate: newBlockedStart, 
      endDate: newBlockedEnd,
      reason: newBlockedReason 
    }]);
    setNewBlockedStart("");
    setNewBlockedEnd("");
    setNewBlockedReason("");
  };

  const handleRemoveBlockedDate = (index: number) => {
    setBlockedDates(blockedDates.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Application Settings
        </h1>
        <p className="text-gray-500 mt-2">Manage your car rental system configuration</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Business Rules</span>
            <span className="sm:hidden">Business</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Notifs</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
            <span className="sm:hidden">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email & GPS</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
        </TabsList>

        {/* Business Rules Tab */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Rental Defaults & Policies
              </CardTitle>
              <CardDescription>
                Set default values and business rules for rentals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="defaultDuration">Default Rental Duration (days)</Label>
                  <Input
                    id="defaultDuration"
                    type="number"
                    min="1"
                    value={defaultRentalDuration}
                    onChange={(e) => setDefaultRentalDuration(e.target.value)}
                    data-testid="input-default-rental-duration"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default duration when creating new rentals</p>
                </div>
                <div>
                  <Label htmlFor="minPeriod">Minimum Rental Period (days)</Label>
                  <Input
                    id="minPeriod"
                    type="number"
                    min="1"
                    value={minRentalPeriod}
                    onChange={(e) => setMinRentalPeriod(e.target.value)}
                    data-testid="input-min-rental-period"
                  />
                  <p className="text-xs text-gray-500 mt-1">Shortest allowed rental period</p>
                </div>
                <div>
                  <Label htmlFor="maxPeriod">Maximum Rental Period (days)</Label>
                  <Input
                    id="maxPeriod"
                    type="number"
                    min="1"
                    value={maxRentalPeriod}
                    onChange={(e) => setMaxRentalPeriod(e.target.value)}
                    data-testid="input-max-rental-period"
                  />
                  <p className="text-xs text-gray-500 mt-1">Longest allowed rental period</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fuelPolicy">Default Fuel Policy</Label>
                  <select
                    id="fuelPolicy"
                    value={defaultFuelPolicy}
                    onChange={(e) => setDefaultFuelPolicy(e.target.value)}
                    className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    data-testid="select-fuel-policy"
                  >
                    <option value="full-to-full">Full to Full</option>
                    <option value="same-to-same">Same to Same</option>
                    <option value="prepaid">Prepaid Full Tank</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Standard fuel return policy</p>
                </div>
                <div>
                  <Label htmlFor="lateReturnFee">Late Return Fee (€)</Label>
                  <Input
                    id="lateReturnFee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lateReturnFee}
                    onChange={(e) => setLateReturnFee(e.target.value)}
                    data-testid="input-late-return-fee"
                  />
                  <p className="text-xs text-gray-500 mt-1">Fee charged for late vehicle returns</p>
                </div>
                <div>
                  <Label htmlFor="securityDeposit">Security Deposit (€)</Label>
                  <Input
                    id="securityDeposit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(e.target.value)}
                    data-testid="input-security-deposit"
                  />
                  <p className="text-xs text-gray-500 mt-1">Standard security deposit amount</p>
                </div>
              </div>

              <Button 
                onClick={() => saveBusinessRules.mutate()}
                disabled={saveBusinessRules.isPending}
                className="w-full md:w-auto"
                data-testid="button-save-business-rules"
              >
                {saveBusinessRules.isPending ? "Saving..." : "Save Business Rules"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reminder Timing
              </CardTitle>
              <CardDescription>
                Configure when reminders are sent for upcoming events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="apkReminder">APK Expiration Reminder (days before)</Label>
                  <Input
                    id="apkReminder"
                    type="number"
                    min="1"
                    value={apkReminderDays}
                    onChange={(e) => setApkReminderDays(e.target.value)}
                    data-testid="input-apk-reminder-days"
                  />
                  <p className="text-xs text-gray-500 mt-1">Send reminder this many days before APK expires</p>
                </div>
                <div>
                  <Label htmlFor="warrantyReminder">Warranty Expiration Reminder (days before)</Label>
                  <Input
                    id="warrantyReminder"
                    type="number"
                    min="1"
                    value={warrantyReminderDays}
                    onChange={(e) => setWarrantyReminderDays(e.target.value)}
                    data-testid="input-warranty-reminder-days"
                  />
                  <p className="text-xs text-gray-500 mt-1">Send reminder this many days before warranty expires</p>
                </div>
                <div>
                  <Label htmlFor="maintenanceReminder">Maintenance Due Reminder (days before)</Label>
                  <Input
                    id="maintenanceReminder"
                    type="number"
                    min="1"
                    value={maintenanceReminderDays}
                    onChange={(e) => setMaintenanceReminderDays(e.target.value)}
                    data-testid="input-maintenance-reminder-days"
                  />
                  <p className="text-xs text-gray-500 mt-1">Send reminder this many days before maintenance is due</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Control which notifications you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <Switch
                  checked={emailNotificationsEnabled}
                  onCheckedChange={setEmailNotificationsEnabled}
                  data-testid="switch-email-notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Real-time Sound Alerts</Label>
                  <p className="text-sm text-gray-500">Play sound for real-time notifications</p>
                </div>
                <Switch
                  checked={realtimeSoundEnabled}
                  onCheckedChange={setRealtimeSoundEnabled}
                  data-testid="switch-realtime-sound"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Reservation Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when a new reservation is created</p>
                </div>
                <Switch
                  checked={notifyOnNewReservation}
                  onCheckedChange={setNotifyOnNewReservation}
                  data-testid="switch-notify-new-reservation"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Vehicle Return Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when a vehicle is returned</p>
                </div>
                <Switch
                  checked={notifyOnVehicleReturn}
                  onCheckedChange={setNotifyOnVehicleReturn}
                  data-testid="switch-notify-vehicle-return"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Due Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when maintenance is due</p>
                </div>
                <Switch
                  checked={notifyOnMaintenanceDue}
                  onCheckedChange={setNotifyOnMaintenanceDue}
                  data-testid="switch-notify-maintenance-due"
                />
              </div>

              <Button 
                onClick={() => saveNotificationPrefs.mutate()}
                disabled={saveNotificationPrefs.isPending}
                className="w-full md:w-auto"
                data-testid="button-save-notification-prefs"
              >
                {saveNotificationPrefs.isPending ? "Saving..." : "Save Notification Preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice & Contract Settings
              </CardTitle>
              <CardDescription>
                Configure document numbering and auto-generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoiceFormat">Invoice Number Format</Label>
                  <Input
                    id="invoiceFormat"
                    value={invoiceNumberFormat}
                    onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                    placeholder="INV-{YEAR}-{NUMBER}"
                    data-testid="input-invoice-format"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{YEAR}'}, {'{MONTH}'}, {'{NUMBER}'} as placeholders
                  </p>
                </div>
                <div>
                  <Label htmlFor="invoiceStartNumber">Starting Invoice Number</Label>
                  <Input
                    id="invoiceStartNumber"
                    type="number"
                    min="1"
                    value={invoiceStartingNumber}
                    onChange={(e) => setInvoiceStartingNumber(e.target.value)}
                    data-testid="input-invoice-start-number"
                  />
                  <p className="text-xs text-gray-500 mt-1">First invoice number to use</p>
                </div>
              </div>

              <div>
                <Label htmlFor="contractTerms">Contract Terms & Conditions</Label>
                <Textarea
                  id="contractTerms"
                  value={contractTerms}
                  onChange={(e) => setContractTerms(e.target.value)}
                  rows={8}
                  placeholder="Enter standard contract terms and conditions..."
                  data-testid="textarea-contract-terms"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">These terms will appear in rental contracts</p>
              </div>

              <div>
                <Label htmlFor="invoiceFooter">Invoice Footer Text</Label>
                <Textarea
                  id="invoiceFooter"
                  value={invoiceFooter}
                  onChange={(e) => setInvoiceFooter(e.target.value)}
                  rows={4}
                  placeholder="Enter invoice footer (payment terms, bank details, etc.)..."
                  data-testid="textarea-invoice-footer"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">This appears at the bottom of all invoices</p>
              </div>

              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-sm">Auto-generation Options</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-generate Contracts</Label>
                    <p className="text-sm text-gray-500">Automatically create contract when reservation confirmed</p>
                  </div>
                  <Switch
                    checked={autoGenerateContract}
                    onCheckedChange={setAutoGenerateContract}
                    data-testid="switch-auto-generate-contract"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-generate Invoices</Label>
                    <p className="text-sm text-gray-500">Automatically create invoice when rental completed</p>
                  </div>
                  <Switch
                    checked={autoGenerateInvoice}
                    onCheckedChange={setAutoGenerateInvoice}
                    data-testid="switch-auto-generate-invoice"
                  />
                </div>
              </div>

              <Button 
                onClick={() => saveDocumentSettings.mutate()}
                disabled={saveDocumentSettings.isPending}
                className="w-full md:w-auto"
                data-testid="button-save-document-settings"
              >
                {saveDocumentSettings.isPending ? "Saving..." : "Save Document Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Holidays & Blocked Dates
              </CardTitle>
              <CardDescription>
                Manage company holidays and closure periods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Holidays */}
              <div>
                <h4 className="font-medium text-sm mb-3">Public Holidays</h4>
                <div className="space-y-2 mb-4">
                  {holidays.map((holiday, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{holiday.name}</p>
                        <p className="text-sm text-gray-500">{new Date(holiday.date).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveHoliday(index)}
                        data-testid={`button-remove-holiday-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {holidays.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No holidays defined</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    placeholder="Date"
                    data-testid="input-new-holiday-date"
                  />
                  <Input
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder="Holiday name"
                    data-testid="input-new-holiday-name"
                  />
                  <Button onClick={handleAddHoliday} data-testid="button-add-holiday">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Holiday
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium text-sm mb-3">Blocked Dates (Company Closures)</h4>
                <div className="space-y-2 mb-4">
                  {blockedDates.map((blocked, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-red-50">
                      <div>
                        <p className="font-medium">{blocked.reason}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(blocked.startDate).toLocaleDateString()} - {new Date(blocked.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBlockedDate(index)}
                        data-testid={`button-remove-blocked-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {blockedDates.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No blocked dates defined</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input
                    type="date"
                    value={newBlockedStart}
                    onChange={(e) => setNewBlockedStart(e.target.value)}
                    placeholder="Start date"
                    data-testid="input-new-blocked-start"
                  />
                  <Input
                    type="date"
                    value={newBlockedEnd}
                    onChange={(e) => setNewBlockedEnd(e.target.value)}
                    placeholder="End date"
                    data-testid="input-new-blocked-end"
                  />
                  <Input
                    value={newBlockedReason}
                    onChange={(e) => setNewBlockedReason(e.target.value)}
                    placeholder="Reason"
                    data-testid="input-new-blocked-reason"
                  />
                  <Button onClick={handleAddBlockedDate} data-testid="button-add-blocked">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Closure
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium text-sm mb-3">Default Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="defaultMaintenanceDuration">Default Maintenance Duration (days)</Label>
                    <Input
                      id="defaultMaintenanceDuration"
                      type="number"
                      min="1"
                      value={defaultMaintenanceDuration}
                      onChange={(e) => setDefaultMaintenanceDuration(e.target.value)}
                      data-testid="input-default-maintenance-duration"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default duration for maintenance appointments</p>
                  </div>
                  <div>
                    <Label htmlFor="reservationReminder">Reservation Reminder (hours before)</Label>
                    <Input
                      id="reservationReminder"
                      type="number"
                      min="1"
                      value={reservationReminderHours}
                      onChange={(e) => setReservationReminderHours(e.target.value)}
                      data-testid="input-reservation-reminder-hours"
                    />
                    <p className="text-xs text-gray-500 mt-1">Send reminder this many hours before pickup</p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => saveCalendarSettings.mutate()}
                disabled={saveCalendarSettings.isPending}
                className="w-full md:w-auto"
                data-testid="button-save-calendar-settings"
              >
                {saveCalendarSettings.isPending ? "Saving..." : "Save Calendar Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email & GPS Tab (existing email configuration) */}
        <TabsContent value="email" className="space-y-6">
          {/* Email Configuration Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure email settings for sending notifications and reminders
                  </CardDescription>
                </div>
                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenEmailDialog()} data-testid="button-add-email-config">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Email Config
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingEmail ? 'Edit Email Configuration' : 'Add Email Configuration'}
                      </DialogTitle>
                      <DialogDescription>
                        Configure email service provider and credentials
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="provider">Provider</Label>
                          <select
                            id="provider"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            data-testid="select-email-provider"
                          >
                            <option value="mailersend">MailerSend</option>
                            <option value="sendgrid">SendGrid</option>
                            <option value="smtp">Custom SMTP</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="purpose">Email Purpose</Label>
                          <select
                            id="purpose"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value as any)}
                            className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            data-testid="select-email-purpose"
                          >
                            {EMAIL_PURPOSES.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            {EMAIL_PURPOSES.find(p => p.value === purpose)?.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="fromEmail">From Email</Label>
                          <Input
                            id="fromEmail"
                            type="email"
                            value={fromEmail}
                            onChange={(e) => setFromEmail(e.target.value)}
                            placeholder="noreply@example.com"
                            data-testid="input-from-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="fromName">From Name</Label>
                          <Input
                            id="fromName"
                            value={fromName}
                            onChange={(e) => setFromName(e.target.value)}
                            placeholder="Car Rental Manager"
                            data-testid="input-from-name"
                          />
                        </div>
                      </div>
                      
                      {(provider === 'mailersend' || provider === 'sendgrid') && (
                        <div>
                          <Label htmlFor="apiKey">API Key</Label>
                          <Input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter API key"
                            data-testid="input-api-key"
                          />
                        </div>
                      )}
                      
                      {provider === 'smtp' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="smtpHost">SMTP Host</Label>
                              <Input
                                id="smtpHost"
                                value={smtpHost}
                                onChange={(e) => setSmtpHost(e.target.value)}
                                placeholder="smtp.example.com"
                                data-testid="input-smtp-host"
                              />
                            </div>
                            <div>
                              <Label htmlFor="smtpPort">SMTP Port</Label>
                              <Input
                                id="smtpPort"
                                value={smtpPort}
                                onChange={(e) => setSmtpPort(e.target.value)}
                                placeholder="587"
                                data-testid="input-smtp-port"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="smtpUser">SMTP Username</Label>
                              <Input
                                id="smtpUser"
                                value={smtpUser}
                                onChange={(e) => setSmtpUser(e.target.value)}
                                placeholder="username"
                                data-testid="input-smtp-user"
                              />
                            </div>
                            <div>
                              <Label htmlFor="smtpPassword">SMTP Password</Label>
                              <Input
                                id="smtpPassword"
                                type="password"
                                value={smtpPassword}
                                onChange={(e) => setSmtpPassword(e.target.value)}
                                placeholder="Enter your password"
                                data-testid="input-smtp-password"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEmailDialogOpen(false);
                          resetEmailForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveEmail}
                        disabled={saveEmailSetting.isPending}
                        data-testid="button-save-email-config"
                      >
                        {saveEmailSetting.isPending ? "Saving..." : "Save Configuration"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEmail ? (
                <div className="text-center py-8 text-gray-500">Loading email settings...</div>
              ) : emailSettings && emailSettings.length > 0 ? (
                <div className="space-y-4">
                  {emailSettings.map((setting) => {
                    const purposeInfo = EMAIL_PURPOSES.find(p => p.value === setting.value.purpose) || EMAIL_PURPOSES[EMAIL_PURPOSES.length - 1];
                    return (
                      <div key={setting.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{purposeInfo.label}</h3>
                            <Badge variant="outline">{setting.value.provider || 'mailersend'}</Badge>
                            <Badge 
                              variant="secondary" 
                              className={
                                setting.value.purpose === 'apk' ? 'bg-blue-100 text-blue-800' :
                                setting.value.purpose === 'maintenance' ? 'bg-green-100 text-green-800' :
                                setting.value.purpose === 'gps' ? 'bg-purple-100 text-purple-800' :
                                setting.value.purpose === 'custom' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }
                            >
                              {purposeInfo.value.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p className="text-xs text-gray-500 mb-1">{purposeInfo.description}</p>
                            <p><strong>From:</strong> {setting.value.fromName} &lt;{setting.value.fromEmail}&gt;</p>
                            {setting.value.apiKey && (
                              <p><strong>API Key:</strong> {setting.value.apiKey.substring(0, 10)}...***</p>
                            )}
                            {setting.value.smtpHost && (
                              <p><strong>SMTP:</strong> {setting.value.smtpHost}:{setting.value.smtpPort}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEmailDialog(setting)}
                          data-testid={`button-edit-email-${setting.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No email configuration set</p>
                  <p className="text-sm mt-1">Click "Add Email Config" to configure your email service</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* GPS Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                GPS Activation Settings
              </CardTitle>
              <CardDescription>
                Configure the GPS company's email address for activation requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="gpsRecipientEmail">GPS Company Email</Label>
                    <Input
                      id="gpsRecipientEmail"
                      type="email"
                      value={gpsRecipientEmail}
                      onChange={(e) => setGpsRecipientEmail(e.target.value)}
                      placeholder="gps@company.com"
                      className="mt-1"
                      data-testid="input-gps-recipient-email"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This email will receive GPS activation and swap requests
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => saveGpsRecipient.mutate()}
                      disabled={saveGpsRecipient.isPending}
                      className="w-full"
                      data-testid="button-save-gps-recipient"
                    >
                      {saveGpsRecipient.isPending ? "Saving..." : "Save GPS Email"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GPS Email Templates Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                GPS Email Templates
              </CardTitle>
              <CardDescription>
                Customize GPS activation and swap email messages sent to your GPS provider
              </CardDescription>
              <div className="mt-2 text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-md p-3">
                <strong>Available Placeholders:</strong> <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded">{'{brand}'}</code>
                <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded">{'{model}'}</code>
                <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded">{'{licensePlate}'}</code>
                <code className="mx-1 px-1.5 py-0.5 bg-blue-100 rounded">{'{imei}'}</code>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* GPS Activation Template */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">GPS Activation Email</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="gpsActivationSubject">Subject</Label>
                      <Input
                        id="gpsActivationSubject"
                        value={gpsActivationSubject}
                        onChange={(e) => setGpsActivationSubject(e.target.value)}
                        placeholder="GPS Activatie Verzoek - {brand} {model} ({licensePlate})"
                        className="mt-1"
                        data-testid="input-gps-activation-subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gpsActivationMessage">Message</Label>
                      <Textarea
                        id="gpsActivationMessage"
                        value={gpsActivationMessage}
                        onChange={(e) => setGpsActivationMessage(e.target.value)}
                        placeholder="Enter GPS activation message template..."
                        rows={6}
                        className="mt-1 font-mono text-sm"
                        data-testid="textarea-gps-activation-message"
                      />
                    </div>
                  </div>
                </div>

                {/* GPS Swap Template */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">GPS Module Swap Email</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="gpsSwapSubject">Subject</Label>
                      <Input
                        id="gpsSwapSubject"
                        value={gpsSwapSubject}
                        onChange={(e) => setGpsSwapSubject(e.target.value)}
                        placeholder="GPS Module Swap Verzoek - {brand} {model} ({licensePlate})"
                        className="mt-1"
                        data-testid="input-gps-swap-subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gpsSwapMessage">Message</Label>
                      <Textarea
                        id="gpsSwapMessage"
                        value={gpsSwapMessage}
                        onChange={(e) => setGpsSwapMessage(e.target.value)}
                        placeholder="Enter GPS swap message template..."
                        rows={6}
                        className="mt-1 font-mono text-sm"
                        data-testid="textarea-gps-swap-message"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={() => saveGpsTemplates.mutate()}
                  disabled={saveGpsTemplates.isPending}
                  className="w-full"
                  data-testid="button-save-gps-templates"
                >
                  {saveGpsTemplates.isPending ? "Saving..." : "Save GPS Email Templates"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
