import { useState } from "react";
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
    useOAuth2?: boolean;
    oauth2ClientId?: string;
    oauth2ClientSecret?: string;
    oauth2RefreshToken?: string;
  };
  category: string;
  description?: string;
}

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
  const [useOAuth2, setUseOAuth2] = useState(false);
  const [oauth2ClientId, setOauth2ClientId] = useState("");
  const [oauth2ClientSecret, setOauth2ClientSecret] = useState("");
  const [oauth2RefreshToken, setOauth2RefreshToken] = useState("");
  
  // Fetch email settings
  const { data: emailSettings, isLoading } = useQuery<EmailSetting[]>({
    queryKey: ['/api/settings/category/email'],
  });
  
  // Create/Update email setting mutation
  const saveEmailSettingMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editingEmail 
        ? `/api/settings/${editingEmail.id}` 
        : '/api/settings';
      const method = editingEmail ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        key: 'email_config',
        category: 'email',
        description: 'Email configuration settings',
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
  
  const resetForm = () => {
    setFromEmail("");
    setFromName("");
    setApiKey("");
    setSmtpHost("");
    setSmtpPort("");
    setSmtpUser("");
    setSmtpPassword("");
    setProvider("mailersend");
    setUseOAuth2(false);
    setOauth2ClientId("");
    setOauth2ClientSecret("");
    setOauth2RefreshToken("");
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
      setUseOAuth2(setting.value.useOAuth2 || false);
      setOauth2ClientId(setting.value.oauth2ClientId || "");
      setOauth2ClientSecret(setting.value.oauth2ClientSecret || "");
      setOauth2RefreshToken(setting.value.oauth2RefreshToken || "");
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
      useOAuth2,
      oauth2ClientId,
      oauth2ClientSecret,
      oauth2RefreshToken,
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
                          <Label htmlFor="smtpPassword">
                            SMTP Password
                            {useOAuth2 && <span className="text-gray-400 ml-1">(not needed with OAuth2)</span>}
                          </Label>
                          <Input
                            id="smtpPassword"
                            type="password"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                            placeholder={useOAuth2 ? "OAuth2 is enabled" : "password"}
                            disabled={useOAuth2}
                            className={useOAuth2 ? "bg-gray-100" : ""}
                            data-testid="input-smtp-password"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-md">
                        <input
                          type="checkbox"
                          id="useOAuth2"
                          checked={useOAuth2}
                          onChange={(e) => setUseOAuth2(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                          data-testid="checkbox-use-oauth2"
                        />
                        <Label htmlFor="useOAuth2" className="text-sm font-medium">
                          Use OAuth2 Authentication (for Microsoft/Outlook)
                        </Label>
                      </div>
                      
                      {useOAuth2 && (
                        <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-600">
                            OAuth2 is required for Microsoft 365/Outlook accounts that have basic authentication disabled.
                          </p>
                          <div>
                            <Label htmlFor="oauth2ClientId">OAuth2 Client ID</Label>
                            <Input
                              id="oauth2ClientId"
                              value={oauth2ClientId}
                              onChange={(e) => setOauth2ClientId(e.target.value)}
                              placeholder="Enter Client ID from Azure AD"
                              data-testid="input-oauth2-client-id"
                            />
                          </div>
                          <div>
                            <Label htmlFor="oauth2ClientSecret">OAuth2 Client Secret</Label>
                            <Input
                              id="oauth2ClientSecret"
                              type="password"
                              value={oauth2ClientSecret}
                              onChange={(e) => setOauth2ClientSecret(e.target.value)}
                              placeholder="Enter Client Secret"
                              data-testid="input-oauth2-client-secret"
                            />
                          </div>
                          <div>
                            <Label htmlFor="oauth2RefreshToken">OAuth2 Refresh Token</Label>
                            <Textarea
                              id="oauth2RefreshToken"
                              value={oauth2RefreshToken}
                              onChange={(e) => setOauth2RefreshToken(e.target.value)}
                              placeholder="Enter Refresh Token"
                              className="font-mono text-sm"
                              rows={3}
                              data-testid="input-oauth2-refresh-token"
                            />
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>To set up OAuth2 for Microsoft 365:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                              <li>Register an app in Azure AD</li>
                              <li>Grant Mail.Send API permissions</li>
                              <li>Generate a refresh token using OAuth2 flow</li>
                            </ol>
                          </div>
                        </div>
                      )}
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
              {emailSettings.map((setting) => (
                <div key={setting.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">Email Configuration</h3>
                      <Badge variant="outline">{setting.value.provider || 'mailersend'}</Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
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
              ))}
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
