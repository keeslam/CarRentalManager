import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [notificationTemplate, setNotificationTemplate] = useState<string>("maintenance");
  const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>([]);
  const [customMessage, setCustomMessage] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [emailFieldSelection, setEmailFieldSelection] = useState<string>("auto"); // auto, email, emailForMOT, emailForInvoices, emailGeneral
  const [emailPreview, setEmailPreview] = useState<{
    subject: string;
    content: string;
    recipients: Array<{name: string, email: string, vehicleLicense: string, emailField: string, customer?: any, vehicleId?: number}>;
  } | null>(null);
  const [individualEmailSelections, setIndividualEmailSelections] = useState<Record<string, string>>({});
  
  // Template builder state
  const [templateName, setTemplateName] = useState<string>("");
  const [templateSubject, setTemplateSubject] = useState<string>("");
  const [templateContent, setTemplateContent] = useState<string>("");
  const [templates, setTemplates] = useState<Array<{id: string, name: string, subject: string, content: string, createdAt: string}>>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const { toast } = useToast();

  // Fetch vehicles with active reservations only
  const { data: vehiclesWithReservations = [] } = useQuery({
    queryKey: ['/api/vehicles/with-reservations'],
    queryFn: async () => {
      const response = await fetch('/api/vehicles/with-reservations');
      if (!response.ok) throw new Error('Failed to fetch vehicles with reservations');
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

    if (notificationTemplate === "custom" && (!customMessage.trim() || !customSubject.trim())) {
      toast({
        title: "Missing Information",
        description: "Please enter both subject and message for custom notifications",
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
          template: notificationTemplate,
          customMessage: customMessage.trim() || undefined,
          customSubject: customSubject.trim() || undefined,
          emailFieldSelection: emailFieldSelection,
          individualEmailSelections: individualEmailSelections,
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

    if (notificationTemplate === "custom" && (!customMessage.trim() || !customSubject.trim())) {
      toast({
        title: "Missing Information",
        description: "Please enter both subject and message for custom notifications",
        variant: "destructive",
      });
      return;
    }

    // Generate preview data
    let subject = "";
    let content = "";

    if (notificationTemplate === "custom") {
      subject = customSubject.trim();
      content = customMessage.trim();
    } else if (notificationTemplate === "apk") {
      subject = "APK Inspection Reminder - Action Required";
      content = "Dear {{customer_name}},\n\nWe hope this message finds you well. This is a friendly reminder that your vehicle {{vehicle_license}} ({{vehicle_brand}} {{vehicle_model}}) is due for its APK inspection.\n\nAPK Date: {{apk_date}}\n\nPlease schedule your APK inspection as soon as possible to ensure your vehicle remains road-legal. You can contact us to arrange a convenient appointment.\n\nThank you for choosing our services.\n\nBest regards,\nYour Car Rental Team";
    } else if (notificationTemplate === "maintenance") {
      subject = "Scheduled Maintenance Reminder";
      content = "Dear {{customer_name}},\n\nWe hope you're enjoying your rental experience with vehicle {{vehicle_license}} ({{vehicle_brand}} {{vehicle_model}}).\n\nThis is a reminder that your vehicle is due for scheduled maintenance. Regular maintenance ensures optimal performance and your safety.\n\nPlease contact us to schedule a convenient time for the maintenance service.\n\nThank you for your attention to this matter.\n\nBest regards,\nYour Car Rental Team";
    }

    // Generate recipients list with actual customer data
    const recipients = selectedVehicles.map(vehicle => {
      const reservation = vehiclesWithReservations.find((item: any) => item.vehicle.id === vehicle.id);
      const customer = reservation?.customer;
      
      // Determine which email to use based on selection
      let selectedEmail = "No email";
      let emailField = "none";
      
      if (customer) {
        if (emailFieldSelection === "auto") {
          // Auto-select based on notification type
          if (notificationTemplate === "apk" && customer.emailForMOT) {
            selectedEmail = customer.emailForMOT;
            emailField = "emailForMOT";
          } else if (customer.email) {
            selectedEmail = customer.email;
            emailField = "email";
          } else if (customer.emailGeneral) {
            selectedEmail = customer.emailGeneral;
            emailField = "emailGeneral";
          }
        } else {
          // Use specifically selected email field
          switch (emailFieldSelection) {
            case "email":
              selectedEmail = customer.email || "No email";
              emailField = customer.email ? "email" : "none";
              break;
            case "emailForMOT":
              selectedEmail = customer.emailForMOT || "No email";
              emailField = customer.emailForMOT ? "emailForMOT" : "none";
              break;
            case "emailForInvoices":
              selectedEmail = customer.emailForInvoices || "No email";
              emailField = customer.emailForInvoices ? "emailForInvoices" : "none";
              break;
            case "emailGeneral":
              selectedEmail = customer.emailGeneral || "No email";
              emailField = customer.emailGeneral ? "emailGeneral" : "none";
              break;
          }
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
      .replace(/\{\{customer_name\}\}/g, sampleCustomer?.name || "[Customer Name]")
      .replace(/\{\{vehicle_license\}\}/g, sampleVehicle.licensePlate || "[License Plate]")
      .replace(/\{\{vehicle_brand\}\}/g, sampleVehicle.brand || "[Brand]")
      .replace(/\{\{vehicle_model\}\}/g, sampleVehicle.model || "[Model]")
      .replace(/\{\{apk_date\}\}/g, sampleVehicle.apkDate || "[APK Date]");

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

  // Get available email options for a customer
  const getCustomerEmailOptions = (customer: any) => {
    const options = [];
    if (customer?.email) {
      options.push({ value: 'email', label: 'Primary Email', email: customer.email });
    }
    if (customer?.emailForMOT) {
      options.push({ value: 'emailForMOT', label: 'APK/MOT Email', email: customer.emailForMOT });
    }
    if (customer?.emailForInvoices) {
      options.push({ value: 'emailForInvoices', label: 'Invoice Email', email: customer.emailForInvoices });
    }
    if (customer?.emailGeneral) {
      options.push({ value: 'emailGeneral', label: 'General Email', email: customer.emailGeneral });
    }
    return options;
  };

  // Handle individual email selection change
  const handleIndividualEmailChange = (vehicleId: string, emailField: string, customer: any) => {
    setIndividualEmailSelections(prev => ({
      ...prev,
      [vehicleId]: emailField
    }));

    // Update the email preview to reflect the new selection
    if (emailPreview) {
      const updatedRecipients = emailPreview.recipients.map(recipient => {
        if (recipient.vehicleId?.toString() === vehicleId) {
          let newEmail = "No email";
          switch (emailField) {
            case "email":
              newEmail = customer?.email || "No email";
              break;
            case "emailForMOT":
              newEmail = customer?.emailForMOT || "No email";
              break;
            case "emailForInvoices":
              newEmail = customer?.emailForInvoices || "No email";
              break;
            case "emailGeneral":
              newEmail = customer?.emailGeneral || "No email";
              break;
          }
          return {
            ...recipient,
            email: newEmail,
            emailField: emailField
          };
        }
        return recipient;
      });

      setEmailPreview({
        ...emailPreview,
        recipients: updatedRecipients
      });
    }
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notification Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Type</CardTitle>
                <CardDescription>Choose the type of notification to send</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {["apk", "maintenance", "custom"].map((template) => {
                  const info = getTemplateInfo(template);
                  const Icon = info.icon;
                  return (
                    <div
                      key={template}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        notificationTemplate === template 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                      onClick={() => setNotificationTemplate(template)}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${info.color}`} />
                        <div>
                          <div className="font-medium">{info.title}</div>
                          <div className="text-xs text-muted-foreground">{info.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Email Selection Section */}
            <Card>
              <CardHeader>
                <CardTitle>Email Address Selection</CardTitle>
                <CardDescription>Choose which email address to use for each customer</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="emailField">Email Field</Label>
                  <Select value={emailFieldSelection} onValueChange={setEmailFieldSelection}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select email field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Smart Selection)</SelectItem>
                      <SelectItem value="email">Primary Email</SelectItem>
                      <SelectItem value="emailForMOT">APK/MOT Email</SelectItem>
                      <SelectItem value="emailForInvoices">Invoice Email</SelectItem>
                      <SelectItem value="emailGeneral">General Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {emailFieldSelection === "auto" && (
                      <p>✨ <strong>Auto:</strong> Uses APK email for APK notifications, otherwise uses primary email</p>
                    )}
                    {emailFieldSelection === "email" && (
                      <p>📧 <strong>Primary Email:</strong> Uses the main email address for each customer</p>
                    )}
                    {emailFieldSelection === "emailForMOT" && (
                      <p>🔧 <strong>APK/MOT Email:</strong> Uses the specific email address for APK inspections</p>
                    )}
                    {emailFieldSelection === "emailForInvoices" && (
                      <p>📄 <strong>Invoice Email:</strong> Uses the email address for billing and invoices</p>
                    )}
                    {emailFieldSelection === "emailGeneral" && (
                      <p>📬 <strong>General Email:</strong> Uses the general communication email address</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Message Fields */}
            {notificationTemplate === "custom" && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Custom Message</CardTitle>
                  <CardDescription>Create your custom notification</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-subject">Subject</Label>
                    <Input
                      id="custom-subject"
                      placeholder="Enter email subject..."
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-message">Message</Label>
                    <textarea
                      id="custom-message"
                      placeholder="Enter your message to customers..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="w-full min-h-[120px] p-3 border rounded-md resize-vertical"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vehicle Selection</CardTitle>
              <CardDescription>Choose which vehicles/customers to notify</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Input
                  placeholder="Search by license plate, brand, or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  disabled={selectedVehicles.length === 0}
                  onClick={generateEmailPreview}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-preview-send"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Preview & Send to {selectedVehicles.length} vehicles
                </Button>
              </div>

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
                            {emailPreview.recipients.map((recipient, index) => {
                              const emailOptions = getCustomerEmailOptions(recipient.customer);
                              const currentSelection = individualEmailSelections[recipient.vehicleId?.toString() || ''] || recipient.emailField;
                              
                              return (
                                <div key={index} className="p-3 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1 flex-1">
                                      <div className="font-medium text-sm">{recipient.name}</div>
                                      <div className="text-xs text-blue-600 font-mono">
                                        {recipient.vehicleLicense}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Email Selection for this recipient */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium">Email Address:</Label>
                                    <div className="flex items-center space-x-2">
                                      <Select 
                                        value={currentSelection}
                                        onValueChange={(value) => handleIndividualEmailChange(recipient.vehicleId?.toString() || '', value, recipient.customer)}
                                      >
                                        <SelectTrigger className="text-xs h-8 flex-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {emailOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="text-xs">
                                              <div className="flex flex-col">
                                                <span className="font-medium">{option.label}</span>
                                                <span className="text-muted-foreground">{option.email}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                                      <span className="font-medium">Selected:</span> {recipient.email}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
                          Each recipient will receive a personalized version of this email with their specific vehicle and customer information.
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
                  const reservation = item.reservation;
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
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{vehicle.licensePlate}</div>
                          <div className="text-xs text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            Customer: {customer.name}
                          </div>
                          {notificationTemplate === "apk" && vehicle.apkDate && (
                            <div className="text-xs text-orange-600 mt-1">
                              APK: {new Date(vehicle.apkDate).toLocaleDateString('nl-NL')}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        )}
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