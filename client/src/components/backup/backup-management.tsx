import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Download, Play, Trash2, Database, FolderArchive, Clock, CheckCircle, AlertTriangle, RotateCcw, HardDriveIcon, Upload } from "lucide-react";

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'database' | 'files'>('database');

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
        throw new Error(error.error || t('backups.failedToRun'));
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('backups.backupStarted'),
        description: t('backups.backupStartedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.backupFailed'),
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
        throw new Error(error.error || t('backups.failedToCleanup'));
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t('backups.cleanupComplete'),
        description: t('backups.cleanupCompleteDescription'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.cleanupFailed'),
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
        throw new Error(error.error || t('backups.failedToRestoreDatabase'));
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('backups.databaseRestored'),
        description: data.message + (data.warning ? ` ${data.warning}` : ''),
        variant: data.warning ? "default" : "default",
      });
      // Refresh backup status since restore might affect the system
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.databaseRestoreFailed'),
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
        throw new Error(error.error || t('backups.failedToRestoreFiles'));
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('backups.filesRestored'),
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.filesRestoreFailed'),
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
        throw new Error(error.error || t('backups.failedToRestoreComplete'));
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('backups.systemRestoreComplete'),
        description: data.message + (data.warning ? ` ${data.warning}` : ''),
        variant: data.warning ? "default" : "default",
      });
      // Refresh all backup data after complete restore
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/backups/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.completeRestoreFailed'),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Upload backup mutation
  const uploadBackupMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'database' | 'files' }) => {
      const formData = new FormData();
      formData.append('backup', file);
      formData.append('type', type);

      return fetch(`/api/backups/upload`, {
        method: 'POST',
        body: formData,
      }).then(response => {
        if (!response.ok) {
          return response.json().then(err => Promise.reject(new Error(err.error || t('backups.uploadFailed'))));
        }
        return response.json();
      });
    },
    onSuccess: (data) => {
      toast({
        title: t('backups.uploadSuccessful'),
        description: t('backups.uploadSuccessfulDescription', { 
          type: data.backup.type, 
          name: data.backup.metadata.originalName 
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('backups.uploadFailed'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const getStatusBadge = () => {
    if (status?.isRunning) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />{t('backups.running')}</Badge>;
    }
    if (status?.lastError) {
      return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t('backups.error')}</Badge>;
    }
    if (status?.lastSuccess) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{t('backups.ready')}</Badge>;
    }
    return <Badge variant="secondary">{t('backups.unknown')}</Badge>;
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

  // File upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile && uploadType) {
      uploadBackupMutation.mutate({ file: selectedFile, type: uploadType });
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{t('backups.title')}</h1>
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
            <CardTitle className="text-sm font-medium">{t('backups.nextScheduledBackup')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.nextScheduled ? 
                formatDate(status.nextScheduled) : 
                t('backups.notScheduled')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {t('backups.dailyAt2AM')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('backups.lastSuccessfulBackup')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.lastSuccess ? 
                formatDate(status.lastSuccess) : 
                t('common.never')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {t('backups.databaseAndFiles')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('backups.totalBackups')}</CardTitle>
            <FolderArchive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {backups?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('backups.dbAndFilesCount', { 
                dbCount: databaseBackups.length, 
                filesCount: fileBackups.length 
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('backups.backupActions')}</CardTitle>
          <CardDescription>
            {t('backups.backupActionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button 
            onClick={() => runBackupMutation.mutate()} 
            disabled={status?.isRunning || runBackupMutation.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            {status?.isRunning ? t('backups.backupRunning') : t('backups.runBackupNow')}
          </Button>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={uploadBackupMutation.isPending}>
                <Upload className="w-4 h-4 mr-2" />
                {t('backups.uploadBackup')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('backups.uploadBackupFile')}</DialogTitle>
                <DialogDescription>
                  {t('backups.uploadBackupDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="backup-type">{t('backups.backupType')}</Label>
                  <Select value={uploadType} onValueChange={(value: 'database' | 'files') => setUploadType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('backups.selectBackupType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database">{t('backups.databaseBackupFiles')}</SelectItem>
                      <SelectItem value="files">{t('backups.filesBackupFiles')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="backup-file">{t('backups.backupFile')}</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={selectedFile?.name || t('backups.noFileSelected')}
                      placeholder={t('backups.chooseBackupFile')}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={openFileDialog}>
                      {t('common.browse')}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept={uploadType === 'database' ? '.sql,.sql.gz' : '.tar.gz,.tgz'}
                    className="hidden"
                  />
                </div>
                {selectedFile && (
                  <div className="text-sm text-muted-foreground">
                    {t('backups.fileSize')}: {formatFileSize(selectedFile.size)}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFile(null);
                }}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadBackupMutation.isPending}
                >
                  {uploadBackupMutation.isPending ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      {t('backups.uploading')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {t('common.upload')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={cleanupMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('backups.cleanupOldBackups')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('backups.cleanupOldBackups')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('backups.cleanupDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => cleanupMutation.mutate()}>
                  {t('backups.cleanup')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('backups.backupHistory')}</CardTitle>
          <CardDescription>
            {t('backups.backupHistoryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">{t('backups.allBackups')} ({backups?.length || 0})</TabsTrigger>
              <TabsTrigger value="database">{t('backups.database')} ({databaseBackups.length})</TabsTrigger>
              <TabsTrigger value="files">{t('backups.files')} ({fileBackups.length})</TabsTrigger>
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
              {t('backups.completeSystemRestore')}
            </CardTitle>
            <CardDescription>
              {t('backups.completeSystemRestoreDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">{t('backups.selectMatchingBackups')}</p>
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
                    {t('backups.completeSystemRestore')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">⚠️ {t('backups.completeSystemRestore')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      <div className="space-y-3">
                        <p>{t('backups.completeRestoreConfirmation')}</p>

                        <div className="bg-gray-50 p-3 rounded space-y-2">
                          <div>
                            <strong>{t('backups.database')}:</strong> {databaseBackups[0]?.filename || t('backups.noDatabaseBackup')}
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {t('backups.created')}: {databaseBackups[0] ? formatDate(databaseBackups[0].timestamp) : t('common.na')}
                            </span>
                          </div>

                          <div>
                            <strong>{t('backups.files')}:</strong> {fileBackups[0]?.filename || t('backups.noFilesBackup')}
                            <br />
                            <span className="text-sm text-muted-foreground">
                              {t('backups.created')}: {fileBackups[0] ? formatDate(fileBackups[0].timestamp) : t('common.na')}
                            </span>
                          </div>
                        </div>

                        <div className="text-destructive font-semibold">
                          ⚠️ {t('backups.completeRestoreWarning')}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {t('backups.restartRequiredNote')}
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
                      {t('backups.restoreCompleteSystem')}
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
              {t('backups.lastBackupError')}
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
  const { t } = useTranslation();

  if (isLoading) {
    return <div className="text-center py-4">{t('backups.loadingBackups')}</div>;
  }

  if (backups.length === 0) {
    return <div className="text-center py-4 text-gray-500">{t('backups.noBackupsFound')}</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('backups.type')}</TableHead>
          <TableHead>{t('backups.created')}</TableHead>
          <TableHead>{t('backups.size')}</TableHead>
          <TableHead>{t('backups.details')}</TableHead>
          <TableHead>{t('common.actions')}</TableHead>
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
                  <div>{t('backups.filesCount', { count: backup.metadata.fileCount })}</div>
                )}
                {backup.metadata?.compressedSize && (
                  <div>{t('backups.compressed')}: {formatFileSize(backup.metadata.compressedSize)}</div>
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
                  {t('common.download')}
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
                      {t('backups.restore')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('backups.restoreBackupTitle', { type: backup.type })}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('backups.restoreBackupConfirmation', { type: backup.type })}
                        <br /><br />
                        <strong>{t('backups.backup')}:</strong> {backup.filename}
                        <br />
                        <strong>{t('backups.created')}:</strong> {formatDate(backup.timestamp)}
                        <br />
                        <strong>{t('backups.size')}:</strong> {formatFileSize(backup.size)}
                        <br /><br />
                        <span className="text-destructive">
                          ⚠️ {t('backups.restoreWarning', { 
                            dataType: backup.type === 'database' ? t('backups.databaseData') : t('backups.files') 
                          })}
                        </span>
                        {backup.type === 'database' && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {t('backups.databaseRestoreNote')}
                          </p>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRestore(backup)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {t('backups.restoreType', { type: backup.type })}
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