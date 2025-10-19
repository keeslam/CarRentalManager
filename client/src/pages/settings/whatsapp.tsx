import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageSquare, Phone, CheckCircle, XCircle, Save } from "lucide-react";

interface WhatsAppSettings {
  enabled: boolean;
  phoneNumber: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  autoNotifications: boolean;
  notifyOnReservationCreated: boolean;
  notifyOnPickupReminder: boolean;
  notifyOnReturnReminder: boolean;
  notifyOnPaymentDue: boolean;
}

export default function WhatsAppSettingsPage() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected');

  // Fetch WhatsApp settings
  const { data: settings, isLoading } = useQuery<WhatsAppSettings>({
    queryKey: ["/api/settings/whatsapp"],
    // Default values if settings don't exist yet
    placeholderData: {
      enabled: false,
      phoneNumber: '',
      autoNotifications: false,
      notifyOnReservationCreated: false,
      notifyOnPickupReminder: false,
      notifyOnReturnReminder: false,
      notifyOnPaymentDue: false,
    }
  });

  const [formData, setFormData] = useState<WhatsAppSettings>({
    enabled: false,
    phoneNumber: '',
    autoNotifications: false,
    notifyOnReservationCreated: false,
    notifyOnPickupReminder: false,
    notifyOnReturnReminder: false,
    notifyOnPaymentDue: false,
  });

  // Update form data when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: WhatsAppSettings) => {
      return apiRequest('/api/settings/whatsapp', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/whatsapp"] });
      toast({
        title: "Success",
        description: "WhatsApp settings saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save WhatsApp settings",
        variant: "destructive",
      });
    }
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/whatsapp/test-connection', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setConnectionStatus('connected');
      toast({
        title: "Success",
        description: "WhatsApp connection test successful",
      });
    },
    onError: () => {
      setConnectionStatus('disconnected');
      toast({
        title: "Error",
        description: "WhatsApp connection test failed",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleTestConnection = () => {
    setConnectionStatus('checking');
    testConnectionMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            WhatsApp Settings
          </h1>
          <p className="text-muted-foreground">Configure WhatsApp Business integration for customer communications</p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {connectionStatus === 'disconnected' && (
            <Badge variant="secondary">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
      </div>

      {/* Enable WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Integration</CardTitle>
          <CardDescription>Enable or disable WhatsApp messaging for customer communications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable WhatsApp Integration</Label>
              <p className="text-sm text-muted-foreground">Turn on WhatsApp messaging capabilities</p>
            </div>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              data-testid="switch-whatsapp-enabled"
            />
          </div>
        </CardContent>
      </Card>

      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>Configure your WhatsApp Business API connection via Twilio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">WhatsApp Business Phone Number</Label>
            <div className="flex gap-2">
              <Phone className="h-4 w-4 mt-3 text-muted-foreground" />
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="+31612345678"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                data-testid="input-phone-number"
              />
            </div>
            <p className="text-xs text-muted-foreground">Include country code (e.g., +31 for Netherlands)</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
            <Input
              id="twilioAccountSid"
              type="text"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={formData.twilioAccountSid || ''}
              onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
              data-testid="input-twilio-sid"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
            <Input
              id="twilioAuthToken"
              type="password"
              placeholder="••••••••••••••••••••••••••••••••"
              value={formData.twilioAuthToken || ''}
              onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
              data-testid="input-twilio-token"
            />
          </div>

          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={!formData.phoneNumber || testConnectionMutation.isPending}
            data-testid="button-test-connection"
          >
            {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Automatic Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Notifications</CardTitle>
          <CardDescription>Configure which events trigger automatic WhatsApp messages to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoNotifications">Enable Automatic Notifications</Label>
              <p className="text-sm text-muted-foreground">Send automatic WhatsApp messages based on reservation events</p>
            </div>
            <Switch
              id="autoNotifications"
              checked={formData.autoNotifications}
              onCheckedChange={(checked) => setFormData({ ...formData, autoNotifications: checked })}
              data-testid="switch-auto-notifications"
            />
          </div>

          {formData.autoNotifications && (
            <>
              <Separator />
              
              <div className="space-y-4 pl-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyReservationCreated">New Reservation Confirmation</Label>
                    <p className="text-sm text-muted-foreground">Send confirmation when reservation is created</p>
                  </div>
                  <Switch
                    id="notifyReservationCreated"
                    checked={formData.notifyOnReservationCreated}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyOnReservationCreated: checked })}
                    data-testid="switch-notify-created"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyPickupReminder">Pickup Reminder</Label>
                    <p className="text-sm text-muted-foreground">Remind customer 1 day before pickup</p>
                  </div>
                  <Switch
                    id="notifyPickupReminder"
                    checked={formData.notifyOnPickupReminder}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyOnPickupReminder: checked })}
                    data-testid="switch-notify-pickup"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyReturnReminder">Return Reminder</Label>
                    <p className="text-sm text-muted-foreground">Remind customer 1 day before return</p>
                  </div>
                  <Switch
                    id="notifyReturnReminder"
                    checked={formData.notifyOnReturnReminder}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyOnReturnReminder: checked })}
                    data-testid="switch-notify-return"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifyPaymentDue">Payment Due Notification</Label>
                    <p className="text-sm text-muted-foreground">Notify customer when payment is due</p>
                  </div>
                  <Switch
                    id="notifyPaymentDue"
                    checked={formData.notifyOnPaymentDue}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyOnPaymentDue: checked })}
                    data-testid="switch-notify-payment"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
