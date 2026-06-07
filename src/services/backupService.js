// src/services/backupService.js
const fs = require('fs');
const path = require('path');
const StorageManager = require('../storage/StorageManager');

class BackupService {
  constructor() {
    this.filesToBackup = ['subscribers.json', 'watchlists.json', 'tokens.json'];
    this.maxBackups = 7;
  }

  runBackup() {
    console.log('[BACKUP] Starting daily backup routine...');
    const dateStr = new Date().toISOString().split('T')[0];

    this.filesToBackup.forEach(filename => {
      const sourcePath = StorageManager.getFilePath(filename);
      if (fs.existsSync(sourcePath)) {
        const backupFilename = `${path.basename(filename, '.json')}_${dateStr}.json`;
        const backupPath = StorageManager.getBackupsPath(backupFilename);
        
        try {
          fs.copyFileSync(sourcePath, backupPath);
          console.log(`[BACKUP] Backup created: ${backupFilename}`);
        } catch (err) {
          console.error(`[BACKUP] Error backing up ${filename}:`, err.message);
        }
      }
    });

    this.cleanupOldBackups();
  }

  cleanupOldBackups() {
    const backupsDir = StorageManager.getBackupsPath('');
    if (!fs.existsSync(backupsDir)) return;

    try {
      const files = fs.readdirSync(backupsDir);
      
      // Group files by base type (e.g. 'subscribers', 'watchlists')
      const groups = {};
      files.forEach(file => {
        const match = file.match(/^([a-z]+)_(\d{4}-\d{2}-\d{2})\.json$/);
        if (match) {
          const type = match[1];
          if (!groups[type]) groups[type] = [];
          groups[type].push(file);
        }
      });

      // For each type, sort by date descending and delete older than maxBackups
      for (const [type, groupFiles] of Object.entries(groups)) {
        groupFiles.sort().reverse(); // newest first
        if (groupFiles.length > this.maxBackups) {
          const toDelete = groupFiles.slice(this.maxBackups);
          toDelete.forEach(file => {
            const filePath = path.join(backupsDir, file);
            fs.unlinkSync(filePath);
            console.log(`[BACKUP] Old backup removed: ${file}`);
          });
        }
      }
    } catch (err) {
      console.error('[BACKUP] Error during cleanup:', err.message);
    }
  }

  startCron() {
    // Run backup immediately on startup
    this.runBackup();

    // Then run every 24 hours
    setInterval(() => {
      this.runBackup();
    }, 24 * 60 * 60 * 1000);
  }
}

module.exports = { BackupService };
