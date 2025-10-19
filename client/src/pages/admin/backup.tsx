import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Redirect } from "wouter";
import { Database, Code, Download, CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BackupSettings {
  id: number;
  storageType: string;
  enableAutoBackup: boolean;
  backupSchedule: string;
  retentionDays: number;
  localPath: string;
}

interface BackupStatus {
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  isRunning: boolean;
  nextScheduled?: string;
}

export default function BackupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadingCode, setDownloadingCode] = useState(false);
  
  // Fetch backup settings
  const { data: settings } = useQuery<BackupSettings>({
    queryKey: ['/api/backup-settings'],
  });

  // Fetch backup status
  const { data: status } = useQuery<BackupStatus>({
    queryKey: ['/api/backups/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Toggle auto backup mutation
  const toggleAutoBackupMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!settings) throw new Error('Settings not loaded');
      
      const response = await apiRequest('PUT', `/api/backup-settings/${settings.id}`, {
        enableAutoBackup: enabled,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/backup-settings'] });
      toast({
        title: data.enableAutoBackup ? 'Auto Backup Enabled' : 'Auto Backup Disabled',
        description: data.enableAutoBackup 
          ? 'Daily backups will run automatically at 2:00 AM' 
          : 'Automatic backups have been disabled',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (user.role !== UserRole.ADMIN) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const handleDownloadData = async () => {
    setDownloadingData(true);
    try {
      const response = await fetch('/api/backups/download-data', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download data backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-rental-data-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Data Downloaded',
        description: 'Your app data has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download data',
        variant: 'destructive',
      });
    } finally {
      setDownloadingData(false);
    }
  };

  const handleDownloadCode = async () => {
    setDownloadingCode(true);
    try {
      const response = await fetch('/api/backups/download-code', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download code backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-rental-code-${new Date().toISOString().split('T')[0]}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Code Downloaded',
        description: 'Your app code has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download code',
        variant: 'destructive',
      });
    } finally {
      setDownloadingCode(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backup & Recovery</h1>
          <p className="text-gray-600 mt-2">
            Download backups of your app data and source code
          </p>
        </div>

        {/* Automatic Backup Schedule */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg text-purple-900">Automatic Backup Schedule</CardTitle>
                  <CardDescription className="text-purple-700">
                    Backups run daily at 2:00 AM to keep your data safe
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-backup"
                  checked={settings?.enableAutoBackup ?? false}
                  onCheckedChange={(checked) => toggleAutoBackupMutation.mutate(checked)}
                  disabled={toggleAutoBackupMutation.isPending || !settings}
                  data-testid="auto-backup-toggle"
                />
                <Label htmlFor="auto-backup" className="cursor-pointer font-medium text-purple-900">
                  {settings?.enableAutoBackup ? 'Enabled' : 'Disabled'}
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <Clock className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Schedule</p>
                  <p className="font-semibold text-gray-900">Daily at 2:00 AM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Last Backup</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {status?.lastSuccess ? formatDate(status.lastSuccess) : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Next Backup</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {settings?.enableAutoBackup ? 'Tonight at 2:00 AM' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>
            {status?.lastError && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Last backup error:</p>
                  <p className="text-xs text-red-700">{status.lastError}</p>
                </div>
              </div>
            )}
            {settings?.enableAutoBackup && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    <strong>Protection Active:</strong> Your data is automatically backed up every night, ensuring you always have a backup that's max 1 day old.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Download Buttons */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Download</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* App Data Backup */}
            <Card className="border-2 hover:border-blue-300 transition-colors">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-blue-100 rounded-full">
                    <Database className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <CardTitle className="text-xl">App Data</CardTitle>
                <CardDescription>
                  Download all your business data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>All vehicles, customers & reservations</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Expenses, documents & maintenance records</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>User accounts & settings</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Templates & notifications</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleDownloadData}
                  disabled={downloadingData}
                  data-testid="download-data-button"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingData ? 'Downloading...' : 'Download App Data'}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Database export (SQL format)
                </p>
              </CardContent>
            </Card>

            {/* App Code Backup */}
            <Card className="border-2 hover:border-green-300 transition-colors">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-green-100 rounded-full">
                    <Code className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-xl">App Code</CardTitle>
                <CardDescription>
                  Download all your source code files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Complete source code</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Configuration files</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Package dependencies list</span>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                    <span>Ready to restore & run</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleDownloadCode}
                  disabled={downloadingCode}
                  data-testid="download-code-button"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingCode ? 'Downloading...' : 'Download App Code'}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Compressed archive (.tar.gz)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-blue-900">Recovery Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p><strong>To recover your app data:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Import the SQL file into your PostgreSQL database</li>
              <li>Restart your application</li>
              <li>Login with your admin account</li>
            </ol>
            
            <p className="mt-4"><strong>To recover your app code:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Extract the .tar.gz archive</li>
              <li>Run "npm install" to install dependencies</li>
              <li>Configure your database connection</li>
              <li>Run "npm run dev" to start the application</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
