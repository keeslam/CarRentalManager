import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { Redirect } from "wouter";
import { Database, Code, Download, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BackupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadingCode, setDownloadingCode] = useState(false);
  
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backup & Recovery</h1>
          <p className="text-gray-600 mt-2">
            Download backups of your app data and source code
          </p>
        </div>

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
