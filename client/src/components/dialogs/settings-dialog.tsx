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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Settings as SettingsIcon,
  Building2,
  Bell,
  FileText,
  Calendar as CalendarIcon,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

interface AppSetting {
  id: number;
  key: string;
  value: any;
  category: string;
  description?: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("business");
  const isAdmin = user?.role === UserRole.ADMIN;

  const [defaultRentalDuration, setDefaultRentalDuration] = useState("7");
  const [defaultFuelPolicy, setDefaultFuelPolicy] = useState("full-to-full");
  const [eigenrisicoBinnenland, setEigenrisicoBinnenland] = useState("500");
  const [eigenrisicoBuitenland, setEigenrisicoBuitenland] = useState("1000");

  const [apkReminderDays, setApkReminderDays] = useState("60");
  const [warrantyReminderDays, setWarrantyReminderDays] = useState("30");
  const [maintenanceReminderDays, setMaintenanceReminderDays] = useState("7");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [notifyOnNewReservation, setNotifyOnNewReservation] = useState(true);
  const [notifyOnVehicleReturn, setNotifyOnVehicleReturn] = useState(true);
  const [notifyOnMaintenanceDue, setNotifyOnMaintenanceDue] = useState(true);

  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState("INV-{YEAR}-{NUMBER}");
  const [invoiceStartingNumber, setInvoiceStartingNumber] = useState("1001");
  const [contractTerms, setContractTerms] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");

  const [defaultMaintenanceDuration, setDefaultMaintenanceDuration] = useState("1");
  const [reservationReminderHours, setReservationReminderHours] = useState("24");

  const { data: appSettings, isLoading } = useQuery<AppSetting[]>({
    queryKey: ['/api/app-settings'],
    enabled: open && isAdmin,
  });

  useEffect(() => {
    if (!appSettings) return;

    const businessRules = appSettings.find(s => s.key === 'business_rules');
    if (businessRules?.value) {
      setDefaultRentalDuration(businessRules.value.defaultRentalDuration || "7");
      setDefaultFuelPolicy(businessRules.value.defaultFuelPolicy || "full-to-full");
      setEigenrisicoBinnenland(businessRules.value.eigenrisicoBinnenland || "500");
      setEigenrisicoBuitenland(businessRules.value.eigenrisicoBuitenland || "1000");
    }

    const notifPrefs = appSettings.find(s => s.key === 'notification_preferences');
    if (notifPrefs?.value) {
      setApkReminderDays(notifPrefs.value.apkReminderDays || "60");
      setWarrantyReminderDays(notifPrefs.value.warrantyReminderDays || "30");
      setMaintenanceReminderDays(notifPrefs.value.maintenanceReminderDays || "7");
      setEmailNotificationsEnabled(notifPrefs.value.emailNotificationsEnabled ?? true);
      setNotifyOnNewReservation(notifPrefs.value.notifyOnNewReservation ?? true);
      setNotifyOnVehicleReturn(notifPrefs.value.notifyOnVehicleReturn ?? true);
      setNotifyOnMaintenanceDue(notifPrefs.value.notifyOnMaintenanceDue ?? true);
    }

    const docSettings = appSettings.find(s => s.key === 'document_settings');
    if (docSettings?.value) {
      setInvoiceNumberFormat(docSettings.value.invoiceNumberFormat || "INV-{YEAR}-{NUMBER}");
      setInvoiceStartingNumber(docSettings.value.invoiceStartingNumber || "1001");
      setContractTerms(docSettings.value.contractTerms || "");
      setInvoiceFooter(docSettings.value.invoiceFooter || "");
    }

    const calSettings = appSettings.find(s => s.key === 'calendar_settings');
    if (calSettings?.value) {
      setDefaultMaintenanceDuration(calSettings.value.defaultMaintenanceDuration || "1");
      setReservationReminderHours(calSettings.value.reservationReminderHours || "24");
    }
  }, [appSettings]);

  const saveBusinessRules = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/app-settings', {
        key: 'business_rules',
        category: 'business',
        value: { defaultRentalDuration, defaultFuelPolicy, eigenrisicoBinnenland, eigenrisicoBuitenland }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Business rules saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const saveNotificationPrefs = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/app-settings', {
        key: 'notification_preferences',
        category: 'notifications',
        value: {
          apkReminderDays, warrantyReminderDays, maintenanceReminderDays,
          emailNotificationsEnabled, notifyOnNewReservation, notifyOnVehicleReturn, notifyOnMaintenanceDue
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Notification preferences saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const saveDocumentSettings = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/app-settings', {
        key: 'document_settings',
        category: 'documents',
        value: { invoiceNumberFormat, invoiceStartingNumber, contractTerms, invoiceFooter }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Document settings saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const saveCalendarSettings = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/app-settings', {
        key: 'calendar_settings',
        category: 'calendar',
        value: { defaultMaintenanceDuration, reservationReminderHours }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
      toast({ title: "Success", description: "Calendar settings saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">You don't have permission to access this feature.</p>
        </DialogContent>
      </Dialog>
    );
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Application Settings
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-100px)] px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="business" className="gap-1 text-xs">
                <Building2 className="h-3 w-3" />
                Business
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1 text-xs">
                <Bell className="h-3 w-3" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1 text-xs">
                <FileText className="h-3 w-3" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1 text-xs">
                <CalendarIcon className="h-3 w-3" />
                Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="business" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Business Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rental-duration">Default Rental Duration (days)</Label>
                      <Input
                        id="rental-duration"
                        type="number"
                        value={defaultRentalDuration}
                        onChange={(e) => setDefaultRentalDuration(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel-policy">Default Fuel Policy</Label>
                      <Input
                        id="fuel-policy"
                        value={defaultFuelPolicy}
                        onChange={(e) => setDefaultFuelPolicy(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eigen-binnen">Eigenrisico Binnenland (€)</Label>
                      <Input
                        id="eigen-binnen"
                        type="number"
                        value={eigenrisicoBinnenland}
                        onChange={(e) => setEigenrisicoBinnenland(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eigen-buiten">Eigenrisico Buitenland (€)</Label>
                      <Input
                        id="eigen-buiten"
                        type="number"
                        value={eigenrisicoBuitenland}
                        onChange={(e) => setEigenrisicoBuitenland(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={() => saveBusinessRules.mutate()} disabled={saveBusinessRules.isPending}>
                    {saveBusinessRules.isPending ? "Saving..." : "Save Business Rules"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="apk-days">APK Reminder (days)</Label>
                      <Input
                        id="apk-days"
                        type="number"
                        value={apkReminderDays}
                        onChange={(e) => setApkReminderDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warranty-days">Warranty Reminder (days)</Label>
                      <Input
                        id="warranty-days"
                        type="number"
                        value={warrantyReminderDays}
                        onChange={(e) => setWarrantyReminderDays(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maint-days">Maintenance Reminder (days)</Label>
                      <Input
                        id="maint-days"
                        type="number"
                        value={maintenanceReminderDays}
                        onChange={(e) => setMaintenanceReminderDays(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label>Email Notifications</Label>
                      <Switch checked={emailNotificationsEnabled} onCheckedChange={setEmailNotificationsEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Notify on New Reservation</Label>
                      <Switch checked={notifyOnNewReservation} onCheckedChange={setNotifyOnNewReservation} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Notify on Vehicle Return</Label>
                      <Switch checked={notifyOnVehicleReturn} onCheckedChange={setNotifyOnVehicleReturn} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Notify on Maintenance Due</Label>
                      <Switch checked={notifyOnMaintenanceDue} onCheckedChange={setNotifyOnMaintenanceDue} />
                    </div>
                  </div>

                  <Button onClick={() => saveNotificationPrefs.mutate()} disabled={saveNotificationPrefs.isPending}>
                    {saveNotificationPrefs.isPending ? "Saving..." : "Save Notification Preferences"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoice-format">Invoice Number Format</Label>
                      <Input
                        id="invoice-format"
                        value={invoiceNumberFormat}
                        onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-start">Starting Invoice Number</Label>
                      <Input
                        id="invoice-start"
                        type="number"
                        value={invoiceStartingNumber}
                        onChange={(e) => setInvoiceStartingNumber(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contract-terms">Contract Terms</Label>
                    <Textarea
                      id="contract-terms"
                      value={contractTerms}
                      onChange={(e) => setContractTerms(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-footer">Invoice Footer</Label>
                    <Textarea
                      id="invoice-footer"
                      value={invoiceFooter}
                      onChange={(e) => setInvoiceFooter(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button onClick={() => saveDocumentSettings.mutate()} disabled={saveDocumentSettings.isPending}>
                    {saveDocumentSettings.isPending ? "Saving..." : "Save Document Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Calendar Settings
                  </CardTitle>
                  <CardDescription className="text-xs">
                    For full calendar and holiday settings, use the dedicated Settings page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maint-duration">Default Maintenance Duration (days)</Label>
                      <Input
                        id="maint-duration"
                        type="number"
                        value={defaultMaintenanceDuration}
                        onChange={(e) => setDefaultMaintenanceDuration(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="res-reminder">Reservation Reminder (hours before)</Label>
                      <Input
                        id="res-reminder"
                        type="number"
                        value={reservationReminderHours}
                        onChange={(e) => setReservationReminderHours(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={() => saveCalendarSettings.mutate()} disabled={saveCalendarSettings.isPending}>
                    {saveCalendarSettings.isPending ? "Saving..." : "Save Calendar Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
