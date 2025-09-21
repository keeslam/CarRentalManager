import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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

  // Mock notification history - you can implement this with a real API later
  const notificationHistory: NotificationHistory[] = [
    {
      id: "1",
      type: "apk",
      subject: "APK Reminder - Inspection due soon",
      recipients: 12,
      sentAt: "2024-03-15T10:30:00Z",
      status: "sent"
    },
    {
      id: "2", 
      type: "maintenance",
      subject: "Scheduled maintenance reminder",
      recipients: 8,
      sentAt: "2024-03-14T14:20:00Z",
      status: "sent"
    },
    {
      id: "3",
      type: "custom",
      subject: "Important vehicle recall notice",
      recipients: 25,
      sentAt: "2024-03-13T09:15:00Z",
      status: "sent"
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
                <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      disabled={selectedVehicles.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send to {selectedVehicles.length} vehicles
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Send Notifications</DialogTitle>
                      <DialogDescription>
                        You are about to send {getTemplateInfo(notificationTemplate).title.toLowerCase()} notifications to {selectedVehicles.length} vehicle(s).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="space-y-2">
                        <Label>Selected Vehicles:</Label>
                        <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                          {selectedVehicles.map((vehicle) => (
                            <div key={vehicle.id} className="text-sm">
                              {vehicle.licensePlate} - {vehicle.brand} {vehicle.model}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSendNotifications}
                        disabled={isLoadingNotifications}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isLoadingNotifications ? "Sending..." : "Send Notifications"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

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
              <CardTitle>Notification History</CardTitle>
              <CardDescription>View previously sent notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notificationHistory.map((notification) => {
                  const info = getTemplateInfo(notification.type);
                  const Icon = info.icon;
                  return (
                    <div key={notification.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <Icon className={`h-5 w-5 ${info.color}`} />
                        <div>
                          <div className="font-medium">{notification.subject}</div>
                          <div className="text-sm text-muted-foreground">
                            Sent to {notification.recipients} recipients • {new Date(notification.sentAt).toLocaleDateString('nl-NL')} at {new Date(notification.sentAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <Badge variant={notification.status === 'sent' ? 'default' : 'destructive'}>
                        {notification.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {["apk", "maintenance", "custom"].map((template) => {
              const info = getTemplateInfo(template);
              const Icon = info.icon;
              return (
                <Card key={template}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Icon className={`h-5 w-5 ${info.color}`} />
                      <span>{info.title}</span>
                    </CardTitle>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {template === "apk" && "Reminds customers about upcoming APK inspections with expiry dates and contact information."}
                      {template === "maintenance" && "Notifies customers about scheduled maintenance requirements for their vehicles."}
                      {template === "custom" && "Allows you to create personalized messages for any communication need."}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}