import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Mail, Settings as SettingsIcon, Key, Server, Edit, Plus } from "lucide-react";
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
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailSetting | null>(null);
  
  // Form state
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [provider, setProvider] = useState("mailersend");
  const [purpose, setPurpose] = useState<'apk' | 'maintenance' | 'gps' | 'custom' | 'default'>('default');
  
  // GPS recipient email state
  const [gpsRecipientEmail, setGpsRecipientEmail] = useState("");
  
  // GPS email templates state
  const [gpsActivationSubject, setGpsActivationSubject] = useState("");
  const [gpsActivationMessage, setGpsActivationMessage] = useState("");
  const [gpsSwapSubject, setGpsSwapSubject] = useState("");
  const [gpsSwapMessage, setGpsSwapMessage] = useState("");
  
  // Fetch email settings
  const { data: emailSettings, isLoading } = useQuery<EmailSetting[]>({
    queryKey: ['/api/settings/category/email'],
  });
  
  // Fetch GPS recipient email setting
  const { data: gpsRecipientSetting } = useQuery<any>({
    queryKey: ['/api/settings/key/gps_recipient_email'],
    retry: false,
  });
  
  // Fetch GPS email templates
  const { data: gpsTemplatesSetting } = useQuery<any>({
    queryKey: ['/api/settings/key/gps_email_templates'],
    retry: false,
  });
  
  // Load GPS recipient email when fetched
  useEffect(() => {
    if (gpsRecipientSetting?.value?.email) {
      setGpsRecipientEmail(gpsRecipientSetting.value.email);
    }
  }, [gpsRecipientSetting]);
  
  // Load GPS email templates when fetched
  useEffect(() => {
    if (gpsTemplatesSetting?.value) {
      setGpsActivationSubject(gpsTemplatesSetting.value.activationSubject || "");
      setGpsActivationMessage(gpsTemplatesSetting.value.activationMessage || "");
      setGpsSwapSubject(gpsTemplatesSetting.value.swapSubject || "");
      setGpsSwapMessage(gpsTemplatesSetting.value.swapMessage || "");
    }
  }, [gpsTemplatesSetting]);
  
  // Create/Update email setting mutation
  const saveEmailSettingMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editingEmail 
        ? `/api/settings/${editingEmail.id}` 
        : '/api/settings';
      const method = editingEmail ? 'PATCH' : 'POST';
      
      // Create unique key based on purpose
      const purposeLabel = EMAIL_PURPOSES.find(p => p.value === data.purpose)?.label || 'Email';
      const key = `email_${data.purpose}`;
      
      const response = await apiRequest(method, endpoint, {
        key: key,
        category: 'email',
        description: `${purposeLabel} configuration`,
        value: data,
      });
      
      if (!response.ok) {
        throw new Error('Failed to save email settings');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Email configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/category/email'] });
      setIsEmailDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email settings. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Save GPS recipient email mutation
  const saveGpsRecipientMutation = useMutation({
    mutationFn: async (email: string) => {
      const endpoint = gpsRecipientSetting?.id 
        ? `/api/settings/${gpsRecipientSetting.id}` 
        : '/api/settings';
      const method = gpsRecipientSetting?.id ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        key: 'gps_recipient_email',
        category: 'gps',
        description: 'GPS company recipient email address',
        value: { email },
      });
      
      if (!response.ok) {
        throw new Error('Failed to save GPS recipient email');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "GPS Settings Saved",
        description: "GPS recipient email has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/key/gps_recipient_email'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save GPS recipient email. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleSaveGpsRecipient = () => {
    if (!gpsRecipientEmail || !gpsRecipientEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    saveGpsRecipientMutation.mutate(gpsRecipientEmail);
  };
  
  // Save GPS email templates mutation
  const saveGpsTemplatesMutation = useMutation({
    mutationFn: async () => {
      const endpoint = gpsTemplatesSetting?.id 
        ? `/api/settings/${gpsTemplatesSetting.id}` 
        : '/api/settings';
      const method = gpsTemplatesSetting?.id ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        key: 'gps_email_templates',
        category: 'gps',
        description: 'GPS email message templates',
        value: {
          activationSubject: gpsActivationSubject,
          activationMessage: gpsActivationMessage,
          swapSubject: gpsSwapSubject,
          swapMessage: gpsSwapMessage,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to save GPS email templates');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Templates Saved",
        description: "GPS email templates have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/key/gps_email_templates'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save GPS email templates. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleSaveGpsTemplates = () => {
    if (!gpsActivationSubject.trim() || !gpsActivationMessage.trim() || 
        !gpsSwapSubject.trim() || !gpsSwapMessage.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all GPS email template fields.",
        variant: "destructive",
      });
      return;
    }
    saveGpsTemplatesMutation.mutate();
  };
  
  const resetForm = () => {
    setFromEmail("");
    setFromName("");
    setApiKey("");
    setSmtpHost("");
    setSmtpPort("");
    setSmtpUser("");
    setSmtpPassword("");
    setProvider("mailersend");
    setPurpose('default');
    setEditingEmail(null);
  };
  
  const handleOpenDialog = (setting?: EmailSetting) => {
    if (setting) {
      setEditingEmail(setting);
      setFromEmail(setting.value.fromEmail || "");
      setFromName(setting.value.fromName || "");
      setApiKey(setting.value.apiKey || "");
      setSmtpHost(setting.value.smtpHost || "");
      setSmtpPort(setting.value.smtpPort || "");
      setSmtpUser(setting.value.smtpUser || "");
      setSmtpPassword(setting.value.smtpPassword || "");
      setProvider(setting.value.provider || "mailersend");
      setPurpose(setting.value.purpose || 'default');
    } else {
      resetForm();
    }
    setIsEmailDialogOpen(true);
  };
  
  const handleSave = () => {
    const emailData = {
      fromEmail,
      fromName,
      apiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      provider,
      purpose,
    };
    
    saveEmailSettingMutation.mutate(emailData);
  };
  
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Application Settings
        </h1>
        <p className="text-gray-500 mt-2">Manage application configuration and preferences</p>
      </div>
      
      {/* Email Settings Section */}
      <Card className="mb-6">
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
                <Button onClick={() => handleOpenDialog()} data-testid="button-add-email-config">
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
                        className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                        className="w-full mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveEmailSettingMutation.isPending}
                    data-testid="button-save-email-config"
                  >
                    {saveEmailSettingMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                      onClick={() => handleOpenDialog(setting)}
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
      
      {/* GPS Settings Section */}
      <Card className="mb-6">
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
                  onClick={handleSaveGpsRecipient}
                  disabled={saveGpsRecipientMutation.isPending}
                  className="w-full"
                  data-testid="button-save-gps-recipient"
                >
                  {saveGpsRecipientMutation.isPending ? "Saving..." : "Save GPS Email"}
                </Button>
              </div>
            </div>
            {gpsRecipientSetting?.value?.email && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-sm text-green-800">
                  <strong>Current GPS Recipient:</strong> {gpsRecipientSetting.value.email}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPS Email Templates Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            GPS Email Templates
          </CardTitle>
          <CardDescription>
            Customize GPS activation and swap email messages. Use placeholders: {'{brand}'}, {'{model}'}, {'{licensePlate}'}, {'{imei}'}
          </CardDescription>
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
              onClick={handleSaveGpsTemplates}
              disabled={saveGpsTemplatesMutation.isPending}
              className="w-full"
              data-testid="button-save-gps-templates"
            >
              {saveGpsTemplatesMutation.isPending ? "Saving..." : "Save GPS Email Templates"}
            </Button>

            {/* Current Templates Info */}
            {gpsTemplatesSetting?.value && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Templates Configured:</strong> Activation and Swap emails are customized
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Future Settings Sections */}
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-gray-500">
          <SettingsIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>Additional settings will be added here</p>
          <p className="text-sm mt-1">Notifications, integrations, and more</p>
        </CardContent>
      </Card>
    </div>
  );
}
