import { spawn } from 'child_process';
import { createReadStream, createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { createGzip } from 'zlib';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { ObjectStorageService } from './objectStorage';

export interface BackupManifest {
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

export interface BackupStatus {
  lastRun?: string;
  lastSuccess?: string;
  lastError?: string;
  isRunning: boolean;
  nextScheduled?: string;
}

export class BackupService {
  private objectStorage: ObjectStorageService;
  private isRunning = false;
  private statusFile = '/tmp/backup-status.json';

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  // Get current backup status
  getStatus(): BackupStatus {
    try {
      if (existsSync(this.statusFile)) {
        const data = JSON.parse(readFileSync(this.statusFile, 'utf8'));
        return { ...data, isRunning: this.isRunning };
      }
    } catch (error) {
      console.error('Error reading backup status:', error);
    }

    return {
      isRunning: this.isRunning,
      nextScheduled: this.getNextScheduledTime()
    };
  }

  // Update backup status
  private updateStatus(updates: Partial<BackupStatus>): void {
    try {
      const currentStatus = this.getStatus();
      const newStatus = { ...currentStatus, ...updates };
      writeFileSync(this.statusFile, JSON.stringify(newStatus, null, 2));
    } catch (error) {
      console.error('Error updating backup status:', error);
    }
  }

  // Get next scheduled backup time (2:00 AM tomorrow)
  private getNextScheduledTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    return tomorrow.toISOString();
  }

  // Create database backup
  async createDatabaseBackup(): Promise<BackupManifest> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-backup-${timestamp}.sql.gz`;
    const tempFile = `/tmp/${filename}`;
    
    console.log('Creating database backup...');
    
    // Create pg_dump command
    const pgDumpProcess = spawn('pg_dump', [
      process.env.DATABASE_URL!,
      '--verbose',
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges'
    ]);

    // Create gzip stream
    const gzip = createGzip({ level: 9 });
    const writeStream = createWriteStream(tempFile);

    // Pipe pg_dump output through gzip to file
    pgDumpProcess.stdout.pipe(gzip).pipe(writeStream);

    // Handle errors
    pgDumpProcess.stderr.on('data', (data) => {
      console.log(`pg_dump: ${data}`);
    });

    // Wait for completion
    await new Promise<void>((resolve, reject) => {
      pgDumpProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed with code ${code}`));
        }
      });
    });

    // Calculate file stats
    const fileStats = await stat(tempFile);
    const checksum = await this.calculateChecksum(tempFile);

    // Upload to object storage
    const privatePath = this.objectStorage.getPrivateObjectDir();
    const backupPath = `${privatePath}/backups/database/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${filename}`;
    
    const readStream = createReadStream(tempFile);
    await this.objectStorage.uploadStream(backupPath, readStream, 'application/gzip');

    // Create manifest
    const manifest: BackupManifest = {
      timestamp,
      type: 'database',
      filename,
      size: fileStats.size,
      checksum,
      metadata: {
        compressedSize: fileStats.size
      }
    };

    // Upload manifest
    const manifestPath = `${privatePath}/backups/database/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${filename}.manifest.json`;
    await this.objectStorage.uploadBuffer(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

    console.log(`Database backup created: ${filename} (${fileStats.size} bytes)`);
    return manifest;
  }

  // Create files backup
  async createFilesBackup(): Promise<BackupManifest> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `files-backup-${timestamp}.tar.gz`;
    const tempFile = `/tmp/${filename}`;
    
    console.log('Creating files backup...');

    // Create archive
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: {
        level: 9
      }
    });

    const writeStream = createWriteStream(tempFile);
    archive.pipe(writeStream);

    // Add uploads directory if it exists
    const uploadsDir = join(process.cwd(), 'uploads');
    let fileCount = 0;
    
    if (existsSync(uploadsDir)) {
      fileCount = await this.addDirectoryToArchive(archive, uploadsDir, 'uploads');
    }

    // Add any other important directories
    const otherDirs = ['shared', 'server', 'client'];
    for (const dir of otherDirs) {
      const dirPath = join(process.cwd(), dir);
      if (existsSync(dirPath)) {
        fileCount += await this.addDirectoryToArchive(archive, dirPath, dir);
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for write stream to finish
    await new Promise<void>((resolve) => {
      writeStream.on('close', resolve);
    });

    // Calculate file stats
    const fileStats = await stat(tempFile);
    const checksum = await this.calculateChecksum(tempFile);

    // Upload to object storage
    const privatePath = this.objectStorage.getPrivateObjectDir();
    const backupPath = `${privatePath}/backups/files/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${filename}`;
    
    const readStream = createReadStream(tempFile);
    await this.objectStorage.uploadStream(backupPath, readStream, 'application/gzip');

    // Create manifest
    const manifest: BackupManifest = {
      timestamp,
      type: 'files',
      filename,
      size: fileStats.size,
      checksum,
      metadata: {
        fileCount,
        compressedSize: fileStats.size
      }
    };

    // Upload manifest
    const manifestPath = `${privatePath}/backups/files/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${filename}.manifest.json`;
    await this.objectStorage.uploadBuffer(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');

    console.log(`Files backup created: ${filename} (${fileStats.size} bytes, ${fileCount} files)`);
    return manifest;
  }

  // Add directory to archive recursively
  private async addDirectoryToArchive(archive: archiver.Archiver, dirPath: string, baseName: string): Promise<number> {
    let fileCount = 0;
    
    try {
      const items = await readdir(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const itemStat = await stat(itemPath);
        
        if (itemStat.isDirectory()) {
          fileCount += await this.addDirectoryToArchive(archive, itemPath, `${baseName}/${item}`);
        } else {
          archive.file(itemPath, { name: `${baseName}/${item}` });
          fileCount++;
        }
      }
    } catch (error) {
      console.error(`Error adding directory ${dirPath} to archive:`, error);
    }
    
    return fileCount;
  }

  // Calculate file checksum
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  // Run complete backup
  async runBackup(): Promise<{ database: BackupManifest; files: BackupManifest }> {
    if (this.isRunning) {
      throw new Error('Backup is already running');
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    
    try {
      this.updateStatus({
        lastRun: startTime,
        isRunning: true,
        nextScheduled: this.getNextScheduledTime()
      });

      console.log('Starting backup process...');

      // Create both backups
      const [databaseBackup, filesBackup] = await Promise.all([
        this.createDatabaseBackup(),
        this.createFilesBackup()
      ]);

      // Update status file
      const endTime = new Date().toISOString();
      await this.updateStatusFile(startTime, endTime, { database: databaseBackup, files: filesBackup });

      this.updateStatus({
        lastSuccess: endTime,
        isRunning: false
      });

      console.log('Backup completed successfully');
      return { database: databaseBackup, files: filesBackup };

    } catch (error) {
      const errorTime = new Date().toISOString();
      console.error('Backup failed:', error);
      
      this.updateStatus({
        lastError: `${errorTime}: ${error instanceof Error ? error.message : String(error)}`,
        isRunning: false
      });

      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Update status file in object storage
  private async updateStatusFile(startTime: string, endTime: string, backups: { database: BackupManifest; files: BackupManifest }): Promise<void> {
    try {
      const privatePath = this.objectStorage.getPrivateObjectDir();
      const statusPath = `${privatePath}/backups/status/last.json`;
      
      const status = {
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        backups,
        success: true
      };

      await this.objectStorage.uploadBuffer(statusPath, Buffer.from(JSON.stringify(status, null, 2)), 'application/json');
    } catch (error) {
      console.error('Error updating status file in object storage:', error);
    }
  }

  // List available backups
  async listBackups(type?: 'database' | 'files'): Promise<BackupManifest[]> {
    try {
      const privatePath = this.objectStorage.getPrivateObjectDir();
      const backupTypes = type ? [type] : ['database', 'files'];
      const manifests: BackupManifest[] = [];

      for (const backupType of backupTypes) {
        const prefix = `${privatePath}/backups/${backupType}/`;
        const files = await this.objectStorage.listFiles(prefix);
        
        for (const file of files) {
          if (file.name.endsWith('.manifest.json')) {
            try {
              const buffer = await file.download();
              const manifest = JSON.parse(buffer[0].toString('utf8'));
              manifests.push(manifest);
            } catch (error) {
              console.error(`Error reading manifest ${file.name}:`, error);
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      return manifests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // Cleanup old backups based on retention policy
  async cleanupOldBackups(): Promise<void> {
    console.log('Cleaning up old backups...');
    
    const now = new Date();
    const backups = await this.listBackups();
    const toDelete: string[] = [];

    for (const backup of backups) {
      const backupDate = new Date(backup.timestamp);
      const daysOld = Math.floor((now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let shouldDelete = false;
      
      // Retention policy: 14 days for daily, 8 weeks for weekly, 12 months for monthly
      if (daysOld > 365) {
        // Older than 1 year - delete all
        shouldDelete = true;
      } else if (daysOld > 56) {
        // Older than 8 weeks - keep only monthly (first of month)
        shouldDelete = backupDate.getDate() !== 1;
      } else if (daysOld > 14) {
        // Older than 2 weeks - keep only weekly (Sundays)
        shouldDelete = backupDate.getDay() !== 0;
      }
      
      if (shouldDelete) {
        const privatePath = this.objectStorage.getPrivateObjectDir();
        const year = backupDate.getFullYear();
        const month = String(backupDate.getMonth() + 1).padStart(2, '0');
        const day = String(backupDate.getDate()).padStart(2, '0');
        
        toDelete.push(`${privatePath}/backups/${backup.type}/${year}/${month}/${day}/${backup.filename}`);
        toDelete.push(`${privatePath}/backups/${backup.type}/${year}/${month}/${day}/${backup.filename}.manifest.json`);
      }
    }

    // Delete old backups
    for (const path of toDelete) {
      try {
        await this.objectStorage.deleteFile(path);
        console.log(`Deleted old backup: ${path}`);
      } catch (error) {
        console.error(`Error deleting ${path}:`, error);
      }
    }

    console.log(`Cleanup completed. Deleted ${toDelete.length / 2} old backups.`);
  }
}