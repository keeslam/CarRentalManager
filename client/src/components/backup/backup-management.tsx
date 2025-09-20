import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatFileSize } from "@/lib/format-utils";
import { BackupSettingsPanel } from "./backup-settings";
import { Download, Play, Trash2, Database, FolderArchive, Clock, CheckCircle, AlertTriangle, RotateCcw, HardDriveIcon } from "lucide-react";

interface BackupManifest {
  timestamp: string;
  type: 'database' | 'files';
  filename: string;
  size: number;
  checksum: string;
  metadata?: {
    dbVersion?: string;
    fileCount?: number;
    compressedSize?: number;
  };
}

interface BackupStatus {
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  isRunning: boolean;
  nextScheduled?: string;
}

export function BackupManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch backup status
  const { data: status, isLoading: statusLoading } = useQuery<BackupStatus>({
    queryKey: ['/api/backups/status'],
    refetchInterval: 5000 // Refresh every 5 seconds when running
  });

  // Fetch backup list
  const { data: backups, isLoading: backupsLoading } = useQuery<BackupManifest[]>({
    queryKey: ['/api/backups'],
    refetchInterval: status?.isRunning ? 5000 : 30000
  });

  // Run backup mutation
  const runBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/backups/run');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run backup');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Backup Started",
        description: "The backup process has been started successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Backup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Cleanup old backups mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/backups/cleanup');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cleanup backups');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cleanup Complete",
        description: "Old backups have been cleaned up successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Database restore mutation
  const restoreDatabaseMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await apiRequest('POST', '/api/backups/restore/database', {
        filename
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore database');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Database Restored",
        description: data.message + (data.warning ? ` ${data.warning}` : ''),
        variant: data.warning ? "default" : "default",
      });
      // Refresh backup status since restore might affect the system
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Database Restore Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Files restore mutation
  const restoreFilesMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await apiRequest('POST', '/api/backups/restore/files', {
        filename
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore files');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Files Restored",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Files Restore Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Complete system restore mutation
  const restoreCompleteMutation = useMutation({
    mutationFn: async ({ databaseBackup, filesBackup }: { databaseBackup: string; filesBackup: string }) => {
      const response = await apiRequest('POST', '/api/backups/restore/complete', {
        databaseBackup,
        filesBackup
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to perform complete restore');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "System Restore Complete",
        description: data.message + (data.warning ? ` ${data.warning}` : ''),
        variant: data.warning ? "default" : "default",
      });
      // Refresh all backup data after complete restore
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Complete Restore Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const getStatusBadge = () => {
    if (status?.isRunning) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Running</Badge>;
    }
    if (status?.lastError) {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Error</Badge>;
    }
    if (status?.lastSuccess) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const downloadBackup = (backup: BackupManifest) => {
    const url = `/api/backups/download/${backup.type}/${backup.filename}`;
    window.open(url, '_blank');
  };

  const restoreBackup = (backup: BackupManifest) => {
    if (backup.type === 'database') {
      restoreDatabaseMutation.mutate(backup.filename);
    } else {
      restoreFilesMutation.mutate(backup.filename);
    }
  };

  // Removed duplicate function - use formatFileSize directly

  const databaseBackups = backups?.filter(b => b.type === 'database') || [];
  const fileBackups = backups?.filter(b => b.type === 'files') || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Backup Management</h1>
        {getStatusBadge()}
      </div>

      {/* Settings Section */}
      <BackupSettingsPanel onSettingsChange={() => {
        queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
        queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
      }} />

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled Backup</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.nextScheduled ? 
                formatDate(status.nextScheduled) : 
                'Not scheduled'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Daily at 2:00 AM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Successful Backup</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.lastSuccess ? 
                formatDate(status.lastSuccess) : 
                'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Database + Files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <FolderArchive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backups?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {databaseBackups.length} DB + {fileBackups.length} Files
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Actions</CardTitle>
          <CardDescription>
            Manage your backup operations and cleanup old backups
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button 
            onClick={() => runBackupMutation.mutate()} 
            disabled={status?.isRunning || runBackupMutation.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            {status?.isRunning ? 'Backup Running...' : 'Run Backup Now'}
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={cleanupMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-2" />
                Cleanup Old Backups
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cleanup Old Backups</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove old backups according to the retention policy:
                  <br />• Keep daily backups for 14 days
                  <br />• Keep weekly backups for 8 weeks
                  <br />• Keep monthly backups for 12 months
                  <br /><br />
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => cleanupMutation.mutate()}>
                  Cleanup
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            View and download your backup files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Backups ({backups?.length || 0})</TabsTrigger>
              <TabsTrigger value="database">Database ({databaseBackups.length})</TabsTrigger>
              <TabsTrigger value="files">Files ({fileBackups.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <BackupTable 
                backups={backups || []} 
                onDownload={downloadBackup}
                onRestore={restoreBackup}
                isLoading={backupsLoading}
                isRestoring={restoreDatabaseMutation.isPending || restoreFilesMutation.isPending}
              />
            </TabsContent>
            
            <TabsContent value="database" className="space-y-4">
              <BackupTable 
                backups={databaseBackups} 
                onDownload={downloadBackup}
                onRestore={restoreBackup}
                isLoading={backupsLoading}
                isRestoring={restoreDatabaseMutation.isPending}
              />
            </TabsContent>
            
            <TabsContent value="files" className="space-y-4">
              <BackupTable 
                backups={fileBackups} 
                onDownload={downloadBackup}
                onRestore={restoreBackup}
                isLoading={backupsLoading}
                isRestoring={restoreFilesMutation.isPending}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Complete System Restore */}
      {databaseBackups.length > 0 && fileBackups.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center">
              <HardDriveIcon className="w-4 h-4 mr-2" />
              Complete System Restore
            </CardTitle>
            <CardDescription>
              Restore both database and files from the same backup session for a complete system restore
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Select matching database and files backups from the same date:</p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                    disabled={restoreCompleteMutation.isPending || databaseBackups.length === 0 || fileBackups.length === 0}
                    data-testid="complete-restore-button"
                  >
                    <HardDriveIcon className="w-4 h-4 mr-2" />
                    Complete System Restore
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">⚠️ Complete System Restore</AlertDialogTitle>
                    <AlertDialogDescription>
                      <div className="space-y-3">
                        <p>This will restore both database and files from the most recent backups:</p>
                        
                        <div className="bg-gray-50 p-3 rounded space-y-2">
                          <div>
                            <strong>Database:</strong> {databaseBackups[0]?.filename || 'No database backup'}
                            <br />
                            <span className="text-sm text-muted-foreground">
                              Created: {databaseBackups[0] ? formatDate(databaseBackups[0].timestamp) : 'N/A'}
                            </span>
                          </div>
                          
                          <div>
                            <strong>Files:</strong> {fileBackups[0]?.filename || 'No files backup'}
                            <br />
                            <span className="text-sm text-muted-foreground">
                              Created: {fileBackups[0] ? formatDate(fileBackups[0].timestamp) : 'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-destructive font-semibold">
                          ⚠️ This will completely overwrite your current database and files. This action cannot be undone.
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          After the restore, you will need to restart the application for all changes to take effect.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (databaseBackups[0] && fileBackups[0]) {
                          restoreCompleteMutation.mutate({
                            databaseBackup: databaseBackups[0].filename,
                            filesBackup: fileBackups[0].filename
                          });
                        }
                      }}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Restore Complete System
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {status?.lastError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Last Backup Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{status.lastError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface BackupTableProps {
  backups: BackupManifest[];
  onDownload: (backup: BackupManifest) => void;
  onRestore: (backup: BackupManifest) => void;
  isLoading: boolean;
  isRestoring?: boolean;
}

function BackupTable({ backups, onDownload, onRestore, isLoading, isRestoring }: BackupTableProps) {
  if (isLoading) {
    return <div className="text-center py-4">Loading backups...</div>;
  }

  if (backups.length === 0) {
    return <div className="text-center py-4 text-gray-500">No backups found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {backups.map((backup) => (
          <TableRow key={backup.filename}>
            <TableCell>
              <div className="flex items-center">
                {backup.type === 'database' ? 
                  <Database className="w-4 h-4 mr-2" /> : 
                  <FolderArchive className="w-4 h-4 mr-2" />
                }
                <span className="capitalize">{backup.type}</span>
              </div>
            </TableCell>
            <TableCell>
              {formatDate(backup.timestamp)}
            </TableCell>
            <TableCell>
              {formatFileSize(backup.size)}
            </TableCell>
            <TableCell>
              <div className="text-sm text-muted-foreground">
                {backup.metadata?.fileCount && (
                  <div>{backup.metadata.fileCount} files</div>
                )}
                {backup.metadata?.compressedSize && (
                  <div>Compressed: {formatFileSize(backup.metadata.compressedSize)}</div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(backup)}
                  data-testid={`download-backup-${backup.filename}`}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRestoring}
                      data-testid={`restore-backup-${backup.filename}`}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restore {backup.type} Backup</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to restore this {backup.type} backup?
                        <br /><br />
                        <strong>Backup:</strong> {backup.filename}
                        <br />
                        <strong>Created:</strong> {formatDate(backup.timestamp)}
                        <br />
                        <strong>Size:</strong> {formatFileSize(backup.size)}
                        <br /><br />
                        <span className="text-destructive">
                          ⚠️ This will overwrite your current {backup.type === 'database' ? 'database data' : 'files'}. This action cannot be undone.
                        </span>
                        {backup.type === 'database' && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Note: After database restore, you may need to restart the application.
                          </p>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRestore(backup)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Restore {backup.type}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}