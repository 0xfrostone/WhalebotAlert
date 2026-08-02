// src/services/backupService.js
const fs = require('fs');
const path = require('path');
const StorageManager = require('../storage/StorageManager');

class BackupService {
  constructor(bot = null) {
    this.bot = bot;
    this.maxBackups = 14;
  }

  setBot(bot) {
    this.bot = bot;
  }

  generateCombinedBackupJSON() {
    const researchStats = StorageManager.readJSON('research_stats.json', {});
    const allAlerts = StorageManager.getAllUsersAlerts();
    const watchlists = StorageManager.readJSON('watchlists.json', {});
    const wallets = StorageManager.readJSON('wallets.json', []);

    return {
      backupDate: new Date().toISOString(),
      systemVersion: '2.0',
      research_stats: researchStats,
      alerts: allAlerts,
      watchlists: watchlists,
      wallets: wallets
    };
  }

  createLocalBackup() {
    try {
      const backupData = this.generateCombinedBackupJSON();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `whalebot_backup_${dateStr}.json`;
      const filePath = StorageManager.getBackupsPath(filename);

      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');
      console.log(`[BACKUP] Combined backup created: ${filename} (${backupData.alerts ? backupData.alerts.length : 0} alerts)`);
      return { filePath, filename, backupData };
    } catch (err) {
      console.error('[BACKUP] Local backup error:', err.message);
      return null;
    }
  }

  async sendBackupToAdminTelegram() {
    if (!this.bot) return;
    const adminId = process.env.ADMIN_IDS;
    if (!adminId || adminId.includes('ISI_')) return;

    try {
      const res = this.createLocalBackup();
      if (!res) return;

      const caption = [
        `💾 <b>BACKUP DATASET PENELITIAN OTOMATIS</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Tanggal   : <b>${new Date().toLocaleString('id-ID')}</b>`,
        `Total Alert: <b>${res.backupData.alerts.length} Transaksi</b>`,
        `Research Stats: <b>OK</b>`,
        ``,
        `<i>File ini disimpan aman di cloud Telegram Chat. Jika VPS mati/reset, gunakan file ini untuk /restore.</i>`
      ].join('\n');

      await this.bot.sendDocument(adminId, res.filePath, {
        caption: caption,
        parse_mode: 'HTML'
      });
      console.log(`[BACKUP] Backup sent to Admin Telegram (${adminId}) successfully!`);
    } catch (err) {
      console.error('[BACKUP] Error sending backup to Telegram:', err.message);
    }
  }

  restoreFromBackupJSON(backupData, targetChatId = null) {
    try {
      if (!backupData || !backupData.research_stats) {
        throw new Error('Format file backup tidak valid!');
      }

      // Restore research_stats.json
      if (backupData.research_stats) {
        StorageManager.writeJSON('research_stats.json', backupData.research_stats);
      }

      // Restore wallets.json
      if (Array.isArray(backupData.wallets)) {
        StorageManager.writeJSON('wallets.json', backupData.wallets);
      }

      // Restore watchlists.json
      if (backupData.watchlists) {
        StorageManager.writeJSON('watchlists.json', backupData.watchlists);
      }

      // Restore alerts.json for targetChatId or admin
      if (Array.isArray(backupData.alerts)) {
        const target = targetChatId || process.env.ADMIN_IDS;
        if (target) {
          StorageManager.writeUserJSON(target, 'alerts.json', backupData.alerts);
        }
      }

      return {
        success: true,
        alertsCount: backupData.alerts ? backupData.alerts.length : 0,
        researchStats: backupData.research_stats
      };
    } catch (err) {
      console.error('[RESTORE ERROR]', err.message);
      return { success: false, error: err.message };
    }
  }

  startCron() {
    // Run initial backup after 1 minute of bot launch
    setTimeout(() => {
      this.sendBackupToAdminTelegram();
    }, 60000);

    // Run every 12 hours
    setInterval(() => {
      this.sendBackupToAdminTelegram();
    }, 12 * 60 * 60 * 1000);
  }
}

module.exports = { BackupService };
