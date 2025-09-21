import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Shield, Wrench, Users, Send, Calendar, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import type { Vehicle, Customer } from "@shared/schema";

interface NotificationHistory {
  id: string;
  type: 'apk' | 'maintenance' | 'custom';
  subject: string;
  recipients: number;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  failureReason?: string;
  emailsSent: number;
  emailsFailed: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  createdAt: string;
  lastUsed?: string;
}

export default function CustomerCommunications() {
  const [activeTab, setActiveTab] = useState("send");
  const [communicationMode, setCommunicationMode] = useState<'apk' | 'maintenance' | 'custom'>('apk');
  const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>([]);
  const [customMessage, setCustomMessage] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{
    subject: string;
    content: string;
    recipients: Array<{name: string, email: string, vehicleLicense: string, emailField: string, customer?: any, vehicleId?: number}>;
  } | null>(null);
  
  // Vehicle filter is now based on communication mode
  const vehicleFilter = communicationMode === 'custom' ? 'all' : communicationMode;
  
  // Template builder state
  const [templateName, setTemplateName] = useState<string>("");
  const [templateSubject, setTemplateSubject] = useState<string>("");
  const [templateContent, setTemplateContent] = useState<string>("");
  const [templates, setTemplates] = useState<Array<{id: string, name: string, subject: string, content: string, createdAt: string}>>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const { toast } = useToast();

  // Fetch vehicles with active reservations (filtered or all)
  const { data: vehiclesWithReservations = [] } = useQuery({
    queryKey: ['/api/vehicles', vehicleFilter === 'all' ? 'with-reservations' : 'filtered', vehicleFilter],
    queryFn: async () => {
      const endpoint = vehicleFilter === 'all' 
        ? '/api/vehicles/with-reservations'
        : `/api/vehicles/filtered?filterType=${vehicleFilter}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    }
  });

  // Fetch customers 
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers']
  });

  // Fetch email logs
  const { data: emailLogs = [] } = useQuery({
    queryKey: ['/api/email-logs'],
    queryFn: async () => {
      const response = await fetch('/api/email-logs');
      if (!response.ok) throw new Error('Failed to fetch email logs');
      return response.json();
    }
  });

  // Mock notification history for now - will be replaced with real data
  const notificationHistory: NotificationHistory[] = [
    {
      id: "1",
      type: "apk",
      subject: "APK Reminder - Inspection due soon",
      recipients: 12,
      sentAt: "2024-03-15T10:30:00Z",
      status: "sent",
      emailsSent: 12,
      emailsFailed: 0
    },
    {
      id: "2", 
      type: "maintenance",
      subject: "Scheduled maintenance reminder",
      recipients: 8,
      sentAt: "2024-03-14T14:20:00Z",
      status: "sent",
      emailsSent: 7,
      emailsFailed: 1,
      failureReason: "Invalid email address"
    },
    {
      id: "3",
      type: "custom",
      subject: "Important vehicle recall notice",
      recipients: 25,
      sentAt: "2024-03-13T09:15:00Z",
      status: "sent",
      emailsSent: 25,
      emailsFailed: 0
    }
  ];

  const filteredVehicles = vehiclesWithReservations.filter((item: any) => {
    const vehicle = item.vehicle;
    const query = searchQuery.toLowerCase();
    return !query ||
      vehicle.licensePlate?.toLowerCase().includes(query) ||
      vehicle.brand?.toLowerCase().includes(query) ||
      vehicle.model?.toLowerCase().includes(query);
  });

  const handleSendNotifications = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "No Vehicles Selected",
        description: "Please select at least one vehicle",
        variant: "destructive",
      });
      return;
    }

    if (!customMessage.trim() || !customSubject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both subject and message for the notification",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingNotifications(true);
    
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vehicleIds: selectedVehicles.map(v => v.id),
          template: "custom",
          customMessage: customMessage.trim(),
          customSubject: customSubject.trim(),
          emailFieldSelection: "auto",
          individualEmailSelections: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send notifications: ${response.statusText}`);
      }

      const result = await response.json();
      
      toast({
        title: "Notifications Sent Successfully",
        description: `${result.sent} emails sent, ${result.failed || 0} failed`,
      });

      // Reset form
      setSendDialogOpen(false);
      setSelectedVehicles([]);
      setCustomMessage("");
      setCustomSubject("");
      setSearchQuery("");
    } catch (error) {
      console.error('Failed to send notifications:', error);
      toast({
        title: "Failed to Send Notifications",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const generateEmailPreview = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "No Vehicles Selected",
        description: "Please select at least one vehicle",
        variant: "destructive",
      });
      return;
    }

    if (!customMessage.trim() || !customSubject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both subject and message for the notification",
        variant: "destructive",
      });
      return;
    }

    // Use custom message and subject
    const subject = customSubject.trim();
    const content = customMessage.trim();

    // Generate recipients list with actual customer data
    const recipients = selectedVehicles.map(vehicle => {
      const reservation = vehiclesWithReservations.find((item: any) => item.vehicle.id === vehicle.id);
      const customer = reservation?.customer;
      
      // Use primary email (simplify email selection)
      let selectedEmail = "No email";
      let emailField = "none";
      
      if (customer) {
        // Prioritize primary email, then fall back to other available emails
        if (customer.email) {
          selectedEmail = customer.email;
          emailField = "email";
        } else if (customer.emailForMOT) {
          selectedEmail = customer.emailForMOT;
          emailField = "emailForMOT";
        } else if (customer.emailGeneral) {
          selectedEmail = customer.emailGeneral;
          emailField = "emailGeneral";
        } else if (customer.emailForInvoices) {
          selectedEmail = customer.emailForInvoices;
          emailField = "emailForInvoices";
        }
      }
      
      return {
        name: customer?.name || "Customer",
        email: selectedEmail,
        vehicleLicense: vehicle.licensePlate,
        emailField: emailField,
        customer: customer,
        vehicleId: vehicle.id
      };
    });

    // Process content with sample data for preview
    const sampleVehicle = selectedVehicles[0];
    const sampleReservation = vehiclesWithReservations.find((item: any) => item.vehicle.id === sampleVehicle.id);
    const sampleCustomer = sampleReservation?.customer;

    const processedContent = content
      .replace(/\{customerName\}/g, sampleCustomer?.name || "[Customer Name]")
      .replace(/\{vehiclePlate\}/g, sampleVehicle.licensePlate || "[License Plate]")
      .replace(/\{vehicleBrand\}/g, sampleVehicle.brand || "[Brand]")
      .replace(/\{vehicleModel\}/g, sampleVehicle.model || "[Model]")
      .replace(/\{companyName\}/g, "Autolease Lam");

    setEmailPreview({
      subject,
      content: processedContent,
      recipients
    });

    setPreviewDialogOpen(true);
  };

  const confirmSendNotifications = async () => {
    setPreviewDialogOpen(false);
    await handleSendNotifications();
  };



  const getTemplateInfo = (template: string) => {
    switch (template) {
      case "apk":
        return {
          title: "APK Reminder",
          icon: Shield,
          description: "Send APK inspection reminders to customers",
          color: "text-orange-600"
        };
      case "maintenance":
        return {
          title: "Maintenance Reminder", 
          icon: Wrench,
          description: "Send scheduled maintenance reminders",
          color: "text-blue-600"
        };
      case "custom":
        return {
          title: "Custom Message",
          icon: Mail,
          description: "Send custom messages to customers",
          color: "text-green-600"
        };
      default:
        return {
          title: "Unknown",
          icon: Mail,
          description: "",
          color: "text-gray-600"
        };
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Communications</h1>
          <p className="text-muted-foreground">
            Manage and send notifications to your customers
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {customers.length} customers • {vehiclesWithReservations.length} vehicles with reservations
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="send" className="flex items-center space-x-2">
            <Send className="h-4 w-4" />
            <span>Send Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>Template Builder</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Email Log</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          {/* Communication Mode Sub-tabs */}
          <Tabs value={communicationMode} onValueChange={(value) => {
            setCommunicationMode(value as 'apk' | 'maintenance' | 'custom');
            setSelectedVehicles([]);
            setSelectedTemplateId("");
            setCustomSubject("");
            setCustomMessage("");
          }} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="apk" className="flex items-center space-x-2" data-testid="tab-apk">
                <Shield className="h-4 w-4" />
                <span>APK Reminders</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex items-center space-x-2" data-testid="tab-maintenance">
                <Wrench className="h-4 w-4" />
                <span>Maintenance</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center space-x-2" data-testid="tab-custom">
                <Mail className="h-4 w-4" />
                <span>Custom Message</span>
              </TabsTrigger>
            </TabsList>

            {/* APK Tab */}
            <TabsContent value="apk" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>APK Reminder Notifications</CardTitle>
                  <CardDescription>Send APK inspection reminders to customers with upcoming or overdue inspections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="apk-template-select" className="text-sm font-medium">
                      Email Template
                    </Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="w-full" data-testid="select-apk-template">
                        <SelectValue placeholder="Select an APK reminder template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apk-urgent">APK Urgent Reminder (Overdue)</SelectItem>
                        <SelectItem value="apk-warning">APK Warning (30 days)</SelectItem>
                        <SelectItem value="apk-notice">APK Notice (60 days)</SelectItem>
                        <SelectItem value="apk-general">General APK Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedTemplateId && (
                      <div className="text-xs text-muted-foreground">
                        Template selected: {
                          selectedTemplateId === 'apk-urgent' ? 'APK Urgent Reminder (Overdue)' :
                          selectedTemplateId === 'apk-warning' ? 'APK Warning (30 days)' :
                          selectedTemplateId === 'apk-notice' ? 'APK Notice (60 days)' :
                          selectedTemplateId === 'apk-general' ? 'General APK Reminder' : 
                          selectedTemplateId
                        }
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 mb-4">
                    <div className="flex-1">
                      <Label htmlFor="search-apk" className="text-sm font-medium sr-only">Search</Label>
                      <Input
                        id="search-apk"
                        placeholder="Search by license plate, brand, or model..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-apk"
                      />
                    </div>
                    <Button 
                      disabled={selectedVehicles.length === 0 || !selectedTemplateId}
                      onClick={generateEmailPreview}
                      className="bg-orange-600 hover:bg-orange-700"
                      data-testid="button-preview-apk"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Preview & Send to {selectedVehicles.length} vehicles
                    </Button>
                  </div>

              {/* Filter Information */}
              {vehicleFilter !== "all" && (
                <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r">
                  {vehicleFilter === "apk" && (
                    <div className="flex items-start space-x-2">
                      <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">APK Reminder Filter Active</p>
                        <p className="text-sm text-blue-700">
                          Showing vehicles with APK expiring within 2 months (60 days). 
                          Vehicles are sorted by urgency: most urgent first.
                        </p>
                      </div>
                    </div>
                  )}
                  {vehicleFilter === "maintenance" && (
                    <div className="flex items-start space-x-2">
                      <Wrench className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Maintenance Reminder Filter Active</p>
                        <p className="text-sm text-blue-700">
                          Showing vehicles that need maintenance (no maintenance recorded in the last year). 
                          Vehicles never maintained are prioritized.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Preview Dialog */}
              <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Email Preview</DialogTitle>
                    <DialogDescription>
                      Review your email before sending to {emailPreview?.recipients.length || 0} recipients
                    </DialogDescription>
                  </DialogHeader>
                  
                  {emailPreview && (
                    <div className="space-y-6">
                      {/* Email Content Preview */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Subject:</Label>
                          <div className="mt-1 p-3 bg-gray-50 rounded border">
                            <p className="font-medium">{emailPreview.subject}</p>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium">Email Content:</Label>
                          <div className="mt-1 p-4 bg-gray-50 rounded border">
                            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                              {emailPreview.content}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Recipients List */}
                      <div>
                        <Label className="text-sm font-medium">
                          Recipients ({emailPreview.recipients.length}):
                        </Label>
                        <div className="mt-2 max-h-48 overflow-y-auto border rounded">
                          <div className="divide-y">
                            {emailPreview.recipients.map((recipient, index) => (
                              <div key={index} className="p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-1 flex-1">
                                    <div className="font-medium text-sm">{recipient.name}</div>
                                    <div className="text-xs text-blue-600 font-mono">
                                      {recipient.vehicleLicense}
                                    </div>
                                  </div>
                                  {recipient.emailField !== "none" && (
                                    <Badge variant="outline" className="text-xs">
                                      {recipient.emailField === "email" && "Primary"}
                                      {recipient.emailField === "emailForMOT" && "APK/MOT"}
                                      {recipient.emailField === "emailForInvoices" && "Invoice"}
                                      {recipient.emailField === "emailGeneral" && "General"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Email:</span> {recipient.email}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded p-4">
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            Ready to send {emailPreview.recipients.length} emails
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                          Each recipient will receive a personalized version of this email with their specific vehicle and customer information. Email addresses are automatically selected (primary email preferred).
                        </p>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={confirmSendNotifications}
                      disabled={isLoadingNotifications}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoadingNotifications ? "Sending..." : "Confirm & Send Emails"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredVehicles.slice(0, 50).map((item: any) => {
                  const vehicle = item.vehicle;
                  const customer = item.customer;
                  const filterInfo = item.filterInfo;
                  const isSelected = selectedVehicles.some(v => v.id === vehicle.id);
                  
                  // Determine urgency color
                  const getUrgencyColor = (urgency: string) => {
                    switch (urgency) {
                      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
                      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
                      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                      default: return 'bg-blue-100 text-blue-800 border-blue-200';
                    }
                  };
                  
                  return (
                    <div
                      key={vehicle.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
                        } else {
                          setSelectedVehicles(prev => [...prev, vehicle]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{vehicle.licensePlate}</div>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {vehicle.brand} {vehicle.model}
                      </div>
                      <div className="text-xs text-blue-600 mb-2">
                        Customer: {customer.name}
                      </div>
                      
                      {/* Filter-specific information */}
                      {filterInfo && (
                        <div className="mb-2">
                          {vehicleFilter === 'apk' && (
                            <div className="space-y-1">
                              <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                getUrgencyColor(filterInfo.urgencyLevel)
                              }`}>
                                {filterInfo.urgencyLevel === 'overdue' ? 'APK OVERDUE' :
                                 filterInfo.urgencyLevel === 'urgent' ? 'APK URGENT' :
                                 filterInfo.urgencyLevel === 'warning' ? 'APK WARNING' : 'APK NOTICE'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                APK: {filterInfo.apkDate}
                                {filterInfo.daysUntilAPK < 0 ? 
                                  ` (${Math.abs(filterInfo.daysUntilAPK)} days overdue)` :
                                  ` (${filterInfo.daysUntilAPK} days remaining)`
                                }
                              </div>
                            </div>
                          )}
                          {vehicleFilter === 'maintenance' && (
                            <div className="space-y-1">
                              <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                getUrgencyColor(filterInfo.urgencyLevel)
                              }`}>
                                {filterInfo.urgencyLevel === 'urgent' ? 'NEVER MAINTAINED' :
                                 filterInfo.urgencyLevel === 'overdue' ? 'MAINTENANCE OVERDUE' :
                                 filterInfo.urgencyLevel === 'warning' ? 'MAINTENANCE DUE' : 'MAINTENANCE NOTICE'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {filterInfo.lastMaintenanceDate ? 
                                  `Last: ${filterInfo.lastMaintenanceDate} (${filterInfo.daysSinceLastMaintenance} days ago)` :
                                  'No maintenance recorded'
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {vehicle.vehicleType || 'Vehicle'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedVehicles.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-900">
                    {selectedVehicles.length} vehicle(s) selected for notification
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Reminder Notifications</CardTitle>
              <CardDescription>Send maintenance reminders to customers with vehicles needing service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1">
                  <Label htmlFor="search-maintenance" className="text-sm font-medium sr-only">Search</Label>
                  <Input
                    id="search-maintenance"
                    placeholder="Search by license plate, brand, or model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-maintenance"
                  />
                </div>
                <Button 
                  disabled={selectedVehicles.length === 0 || !customMessage.trim() || !customSubject.trim()}
                  onClick={generateEmailPreview}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-preview-maintenance"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Preview & Send to {selectedVehicles.length} vehicles
                </Button>
              </div>

              {/* Filter Information */}
              {vehicleFilter !== "all" && (
                <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r">
                  {vehicleFilter === "maintenance" && (
                    <div className="flex items-start space-x-2">
                      <Wrench className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">Maintenance Reminder Filter Active</p>
                        <p className="text-sm text-blue-700">
                          Showing vehicles that need maintenance (no maintenance recorded in the last year). 
                          Vehicles never maintained are prioritized.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredVehicles.slice(0, 50).map((item: any) => {
                  const vehicle = item.vehicle;
                  const customer = item.customer;
                  const filterInfo = item.filterInfo;
                  const isSelected = selectedVehicles.some(v => v.id === vehicle.id);
                  
                  return (
                    <div
                      key={vehicle.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
                        } else {
                          setSelectedVehicles(prev => [...prev, vehicle]);
                        }
                      }}
                      data-testid={`vehicle-card-${vehicle.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{vehicle.licensePlate}</div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {vehicle.brand} {vehicle.model}
                        </div>
                        <div className="text-xs text-gray-600">
                          Customer: {customer?.name || 'Unknown'}
                        </div>
                        {filterInfo && (
                          <div className="text-xs text-muted-foreground">
                            {filterInfo.lastMaintenanceDate ? 
                              `Last: ${filterInfo.lastMaintenanceDate} (${filterInfo.daysSinceLastMaintenance} days ago)` :
                              'No maintenance recorded'
                            }
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {vehicle.vehicleType || 'Vehicle'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedVehicles.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-900">
                    {selectedVehicles.length} vehicle(s) selected for notification
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Message Composition */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Message</CardTitle>
              <CardDescription>Compose your maintenance reminder message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maintenance-subject">Email Subject</Label>
                <Input
                  id="maintenance-subject"
                  placeholder="Enter email subject..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  data-testid="input-maintenance-subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenance-message">Message</Label>
                <Textarea
                  id="maintenance-message"
                  placeholder="Enter your maintenance reminder message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="textarea-maintenance-message"
                />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 text-sm mb-2">Available Placeholders:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                  <div><code>{"{customerName}"}</code> - Customer's name</div>
                  <div><code>{"{vehiclePlate}"}</code> - License plate</div>
                  <div><code>{"{vehicleBrand}"}</code> - Vehicle brand</div>
                  <div><code>{"{vehicleModel}"}</code> - Vehicle model</div>
                  <div><code>{"{companyName}"}</code> - Your company name</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Message Tab */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Message Notifications</CardTitle>
              <CardDescription>Send custom messages to all customers with active reservations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-1">
                  <Label htmlFor="search-custom" className="text-sm font-medium sr-only">Search</Label>
                  <Input
                    id="search-custom"
                    placeholder="Search by license plate, brand, or model..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-custom"
                  />
                </div>
                <Button 
                  disabled={selectedVehicles.length === 0 || !customMessage.trim() || !customSubject.trim()}
                  onClick={generateEmailPreview}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-preview-custom"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Preview & Send to {selectedVehicles.length} vehicles
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {filteredVehicles.slice(0, 50).map((item: any) => {
                  const vehicle = item.vehicle;
                  const customer = item.customer;
                  const isSelected = selectedVehicles.some(v => v.id === vehicle.id);
                  
                  return (
                    <div
                      key={vehicle.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
                        } else {
                          setSelectedVehicles(prev => [...prev, vehicle]);
                        }
                      }}
                      data-testid={`vehicle-card-${vehicle.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{vehicle.licensePlate}</div>
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {vehicle.brand} {vehicle.model}
                        </div>
                        <div className="text-xs text-gray-600">
                          Customer: {customer?.name || 'Unknown'}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {vehicle.vehicleType || 'Vehicle'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedVehicles.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm font-medium text-green-900">
                    {selectedVehicles.length} vehicle(s) selected for notification
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Message Composition */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Message</CardTitle>
              <CardDescription>Compose your custom message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-subject">Email Subject</Label>
                <Input
                  id="custom-subject"
                  placeholder="Enter email subject..."
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  data-testid="input-custom-subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-message">Message</Label>
                <Textarea
                  id="custom-message"
                  placeholder="Enter your custom message to customers..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="textarea-custom-message"
                />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 text-sm mb-2">Available Placeholders:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                  <div><code>{"{customerName}"}</code> - Customer's name</div>
                  <div><code>{"{vehiclePlate}"}</code> - License plate</div>
                  <div><code>{"{vehicleBrand}"}</code> - Vehicle brand</div>
                  <div><code>{"{vehicleModel}"}</code> - Vehicle model</div>
                  <div><code>{"{companyName}"}</code> - Your company name</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          </Tabs>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Log</CardTitle>
              <CardDescription>Track sent and failed email notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notificationHistory.map((notification) => {
                  const info = getTemplateInfo(notification.type);
                  const Icon = info.icon;
                  const successRate = notification.emailsSent / (notification.emailsSent + notification.emailsFailed) * 100;
                  
                  return (
                    <div key={notification.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <Icon className={`h-5 w-5 ${info.color}`} />
                          <div>
                            <div className="font-medium">{notification.subject}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(notification.sentAt).toLocaleDateString('nl-NL')} at {new Date(notification.sentAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                        <Badge variant={notification.status === 'sent' ? 'default' : 'destructive'}>
                          {notification.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-900">Sent Successfully</div>
                          <div className="text-lg font-bold text-green-700">{notification.emailsSent}</div>
                        </div>
                        
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-900">Failed</div>
                          <div className="text-lg font-bold text-red-700">{notification.emailsFailed}</div>
                        </div>
                        
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-sm font-medium text-blue-900">Success Rate</div>
                          <div className="text-lg font-bold text-blue-700">{successRate.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      {notification.failureReason && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <div className="text-sm text-yellow-800">
                            <strong>Failure Reason:</strong> {notification.failureReason}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-full mr-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {notificationHistory.reduce((sum, n) => sum + n.emailsSent, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Emails Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-full mr-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {notificationHistory.reduce((sum, n) => sum + n.emailsFailed, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed Emails</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-full mr-4">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {notificationHistory.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Campaigns</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-full mr-4">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      {vehiclesWithReservations.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Active Customers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Email Performance</CardTitle>
              <CardDescription>Track your email communication effectiveness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2">APK Notifications</h4>
                    <div className="text-2xl font-bold text-orange-600">
                      {notificationHistory.filter(n => n.type === 'apk').reduce((sum, n) => sum + n.emailsSent, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Emails sent</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Maintenance Reminders</h4>
                    <div className="text-2xl font-bold text-blue-600">
                      {notificationHistory.filter(n => n.type === 'maintenance').reduce((sum, n) => sum + n.emailsSent, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Emails sent</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Custom Messages</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {notificationHistory.filter(n => n.type === 'custom').reduce((sum, n) => sum + n.emailsSent, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Emails sent</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Email Templates</h3>
              <p className="text-sm text-muted-foreground">Create and manage custom email templates</p>
            </div>
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setTemplateName("");
                setTemplateSubject("");
                setTemplateContent("");
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template Builder */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingTemplate ? "Edit Template" : "Create New Template"}
                </CardTitle>
                <CardDescription>
                  Design your email template with placeholders for dynamic content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Service Reminder, Welcome Message"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-subject">Email Subject</Label>
                  <Input
                    id="template-subject"
                    placeholder="e.g., Service Reminder for {vehiclePlate}"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-content">Email Content</Label>
                  <textarea
                    id="template-content"
                    placeholder="Write your email content here... Use placeholders like {customerName}, {vehiclePlate}, {vehicleBrand}, {vehicleModel}"
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="w-full min-h-[200px] p-3 border rounded-md resize-vertical font-mono text-sm"
                  />
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 text-sm mb-2">Available Placeholders:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div><code>{"{customerName}"}</code> - Customer's name</div>
                    <div><code>{"{vehiclePlate}"}</code> - License plate</div>
                    <div><code>{"{vehicleBrand}"}</code> - Vehicle brand</div>
                    <div><code>{"{vehicleModel}"}</code> - Vehicle model</div>
                    <div><code>{"{apkDate}"}</code> - APK expiry date</div>
                    <div><code>{"{companyName}"}</code> - Your company name</div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={async () => {
                      if (!templateName.trim() || !templateSubject.trim() || !templateContent.trim()) {
                        toast({
                          title: "Missing Information",
                          description: "Please fill in all template fields",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setIsLoadingTemplates(true);
                      
                      try {
                        const method = editingTemplate ? 'PUT' : 'POST';
                        const url = editingTemplate 
                          ? `/api/email-templates/${editingTemplate}` 
                          : '/api/email-templates';
                        
                        const response = await fetch(url, {
                          method,
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                          body: JSON.stringify({
                            name: templateName,
                            subject: templateSubject,
                            content: templateContent,
                          }),
                        });

                        if (!response.ok) {
                          throw new Error(`Failed to save template: ${response.statusText}`);
                        }

                        const result = await response.json();
                        
                        toast({
                          title: editingTemplate ? "Template Updated" : "Template Created",
                          description: `Template "${templateName}" saved successfully`,
                        });

                        // Reset form
                        setTemplateName("");
                        setTemplateSubject("");
                        setTemplateContent("");
                        setEditingTemplate(null);
                        
                        // Refresh templates list (you'd implement this)
                        // fetchTemplates();
                      } catch (error) {
                        console.error('Failed to save template:', error);
                        toast({
                          title: "Failed to Save Template",
                          description: error instanceof Error ? error.message : "An error occurred",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoadingTemplates(false);
                      }
                    }}
                    disabled={isLoadingTemplates}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoadingTemplates ? "Saving..." : (editingTemplate ? "Update Template" : "Save Template")}
                  </Button>
                  
                  {editingTemplate && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(null);
                        setTemplateName("");
                        setTemplateSubject("");
                        setTemplateContent("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Saved Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Saved Templates</CardTitle>
                <CardDescription>Manage your existing email templates</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mock templates for now - will be replaced with real data */}
                <div className="space-y-3">
                  {[
                    { id: "1", name: "APK Reminder", subject: "APK Inspection Due - {vehiclePlate}", content: "Dear {customerName}, your vehicle {vehiclePlate} requires APK inspection...", createdAt: "2024-03-15" },
                    { id: "2", name: "Maintenance Due", subject: "Service Reminder - {vehiclePlate}", content: "Hello {customerName}, it's time for your {vehicleBrand} {vehicleModel} service...", createdAt: "2024-03-14" },
                    { id: "3", name: "Welcome Message", subject: "Welcome to Autolease Lam", content: "Dear {customerName}, welcome to our car rental service...", createdAt: "2024-03-13" }
                  ].map((template) => (
                    <div key={template.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{template.subject}</p>
                          <p className="text-xs text-gray-500 mt-1">Created: {new Date(template.createdAt).toLocaleDateString('nl-NL')}</p>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTemplate(template.id);
                              setTemplateName(template.name);
                              setTemplateSubject(template.subject);
                              setTemplateContent(template.content);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              // Implement delete functionality
                              toast({
                                title: "Template Deleted",
                                description: `Template "${template.name}" has been deleted`,
                              });
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}