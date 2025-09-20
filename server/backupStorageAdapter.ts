import * as fs from 'fs';
import * as path from 'path';
import { ObjectStorageService } from './objectStorage';

export interface BackupFile {
  name: string;
  path?: string;
  size: number;
  timestamp: string;
  type: 'database' | 'files';
  checksum: string;
}

export interface BackupStorageAdapter {
  uploadBackup(filePath: string, backupType: 'database' | 'files', timestamp: string): Promise<string>;
  listBackups(type?: 'database' | 'files'): Promise<BackupFile[]>;
  downloadBackup(filename: string, type: 'database' | 'files'): Promise<Buffer>;
  deleteBackup(filename: string, type: 'database' | 'files'): Promise<void>;
  cleanup(retentionDays: number): Promise<void>;
}

export class ObjectStorageAdapter implements BackupStorageAdapter {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  async uploadBackup(filePath: string, backupType: 'database' | 'files', timestamp: string): Promise<string> {
    const filename = path.basename(filePath);
    const remotePath = `${this.objectStorage.getPrivateObjectDir()}/backups/${backupType}/${filename}`;
    
    await this.objectStorage.uploadObject(filePath, remotePath);
    return remotePath;
  }

  async listBackups(type?: 'database' | 'files'): Promise<BackupFile[]> {
    const privateDir = this.objectStorage.getPrivateObjectDir();
    const prefix = type ? `${privateDir}/backups/${type}/` : `${privateDir}/backups/`;
    
    const files = await this.objectStorage.listFiles(prefix);
    
    return files.map(file => ({
      name: path.basename(file.name),
      size: file.size || 0,
      timestamp: file.updated || new Date().toISOString(),
      type: file.name.includes('/database/') ? 'database' as const : 'files' as const,
      checksum: file.md5Hash || ''
    }));
  }

  async downloadBackup(filename: string, type: 'database' | 'files'): Promise<Buffer> {
    const privateDir = this.objectStorage.getPrivateObjectDir();
    const remotePath = `${privateDir}/backups/${type}/${filename}`;
    
    // This method needs to be implemented in ObjectStorageService
    // For now, throw an error
    throw new Error('Download method not implemented in ObjectStorageService');
  }

  async deleteBackup(filename: string, type: 'database' | 'files'): Promise<void> {
    const privateDir = this.objectStorage.getPrivateObjectDir();
    const remotePath = `${privateDir}/backups/${type}/${filename}`;
    
    await this.objectStorage.deleteObject(remotePath);
  }

  async cleanup(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const allBackups = await this.listBackups();
    
    for (const backup of allBackups) {
      const backupDate = new Date(backup.timestamp);
      if (backupDate < cutoffDate) {
        await this.deleteBackup(backup.name, backup.type);
      }
    }
  }
}

export class LocalFileSystemAdapter implements BackupStorageAdapter {
  private backupDir: string;

  constructor(backupDir: string) {
    this.backupDir = backupDir;
    this.ensureBackupDirectories();
  }

  private ensureBackupDirectories(): void {
    const dbDir = path.join(this.backupDir, 'database');
    const filesDir = path.join(this.backupDir, 'files');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }
  }

  async uploadBackup(filePath: string, backupType: 'database' | 'files', timestamp: string): Promise<string> {
    const filename = path.basename(filePath);
    const destinationDir = path.join(this.backupDir, backupType);
    const destinationPath = path.join(destinationDir, filename);
    
    // Copy file to backup directory
    await fs.promises.copyFile(filePath, destinationPath);
    
    return destinationPath;
  }

  async listBackups(type?: 'database' | 'files'): Promise<BackupFile[]> {
    const backups: BackupFile[] = [];
    
    const typesToCheck = type ? [type] : ['database', 'files'];
    
    for (const backupType of typesToCheck) {
      const dir = path.join(this.backupDir, backupType);
      
      if (!fs.existsSync(dir)) continue;
      
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.promises.stat(filePath);
        
        backups.push({
          name: file,
          path: filePath,
          size: stats.size,
          timestamp: stats.mtime.toISOString(),
          type: backupType as 'database' | 'files',
          checksum: '' // Could implement checksum calculation if needed
        });
      }
    }
    
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async downloadBackup(filename: string, type: 'database' | 'files'): Promise<Buffer> {
    const filePath = path.join(this.backupDir, type, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }
    
    return await fs.promises.readFile(filePath);
  }

  async deleteBackup(filename: string, type: 'database' | 'files'): Promise<void> {
    const filePath = path.join(this.backupDir, type, filename);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async cleanup(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const allBackups = await this.listBackups();
    
    for (const backup of allBackups) {
      const backupDate = new Date(backup.timestamp);
      if (backupDate < cutoffDate && backup.path) {
        await fs.promises.unlink(backup.path);
      }
    }
  }

  getBackupPath(filename: string, type: 'database' | 'files'): string {
    return path.join(this.backupDir, type, filename);
  }
}