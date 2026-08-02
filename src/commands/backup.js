// src/commands/backup.js
const { BackupService } = require('../services/backupService');
const StorageManager = require('../storage/StorageManager');
const { runBackfill } = require('../../scripts/backfill');
const axios = require('axios');

function setupBackupCommands(bot) {
  const backupService = new BackupService(bot);

  // Command /backup
  bot.onText(/\/backup/i, async (msg) => {
    const chatId = msg.chat.id;
    const adminId = process.env.ADMIN_IDS;
    if (adminId && adminId !== String(chatId)) {
      return bot.sendMessage(chatId, '❌ Perintah /backup hanya dapat digunakan oleh Admin.');
    }

    const waitMsg = await bot.sendMessage(chatId, '⏳ Membuat file backup dataset penelitian...');
    try {
      const res = backupService.createLocalBackup();
      if (!res) {
        return bot.sendMessage(chatId, '❌ Gagal membuat backup.');
      }

      const caption = [
        `💾 <b>BACKUP DATASET PENELITIAN</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Tanggal   : <b>${new Date().toLocaleString('id-ID')}</b>`,
        `Total Alert: <b>${res.backupData.alerts ? res.backupData.alerts.length : 0} Transaksi</b>`,
        `Research Stats: <b>OK</b>`,
        ``,
        `<i>Simpan file ini. Jika VPS mati/reset di kemudian hari, kirim file ini ke Telegram bot untuk /restore.</i>`
      ].join('\n');

      await bot.sendDocument(chatId, res.filePath, {
        caption: caption,
        parse_mode: 'HTML'
      });
      bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
    } catch (err) {
      console.error('Error on /backup:', err.message);
      bot.sendMessage(chatId, `❌ Gagal mengirim file backup: ${err.message}`);
    }
  });

  // Command /restore
  bot.onText(/\/restore/i, async (msg) => {
    const chatId = msg.chat.id;
    const text = [
      `📥 <b>PANDUAN RESTORE DATASET PENELITIAN</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Untuk memulihkan data yang hilang setelah VPS reset:`,
      ``,
      `1. Cari file backup <code>whalebot_backup_*.json</code> di chat Telegram ini.`,
      `2. Kirim/Upload file tersebut langsung ke chat bot ini.`,
      `3. Bot akan otomatis memulihkan 100% data riwayat alert dan statistik penelitian kamu!`
    ].join('\n');

    return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  });

  // Listen to document uploads (.json backup files)
  bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;

    if (!doc || !doc.file_name || !doc.file_name.endsWith('.json')) return;
    if (!doc.file_name.includes('whalebot_backup') && !doc.file_name.includes('backup')) return;

    const waitMsg = await bot.sendMessage(chatId, `⏳ Memproses dan memulihkan data dari <b>${doc.file_name}</b>...`, { parse_mode: 'HTML' });

    try {
      const fileLink = await bot.getFileLink(doc.file_id);
      const response = await axios.get(fileLink, { responseType: 'json' });
      const backupData = response.data;

      const result = backupService.restoreFromBackupJSON(backupData, chatId);
      bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

      if (result.success) {
        const text = [
          `✅ <b>PEMULIHAN DATASET BERHASIL!</b>`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `Total Alert Dipulihkan : <b>${result.alertsCount} Transaksi</b>`,
          `Statistik Penelitian   : <b>BERHASIL DIPULIHKAN</b>`,
          ``,
          `<i>Data penelitian skripsi kamu sudah kembali 100%. Silakan cek menu /statistik.</i>`
        ].join('\n');

        return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      } else {
        return bot.sendMessage(chatId, `❌ Gagal restore: ${result.error}`);
      }
    } catch (err) {
      console.error('Error restoring from document:', err.message);
      return bot.sendMessage(chatId, `❌ Gagal memproses file backup: ${err.message}`);
    }
  });

  // Command /backfill
  bot.onText(/\/backfill(?:\s+(\d+))?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const days = match[1] ? parseInt(match[1]) : 7;

    const waitMsg = await bot.sendMessage(chatId, `⏳ <b>Proses Backfill Blockchain (${days} Hari Terakhir)...</b>\n\nSistem sedang memindai log Uniswap V3 Ethereum mainnet untuk merekap transaksi whale > $50K yang terlewat saat VPS mati...`, { parse_mode: 'HTML' });

    try {
      await runBackfill(days, 50000);
      bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

      const text = [
        `🎉 <b>REKAP HISTORI BLOCKCHAIN SELESAI!</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Rentang Waktu : <b>${days} Hari Terakhir</b>`,
        `Status        : <b>Berhasil Dipulihkan dari Ethereum RPC</b>`,
        ``,
        `<i>Data transaksi whale > $50K telah dimasukkan ke file statistik & riwayat alert kamu! Silakan buka menu /statistik.</i>`
      ].join('\n');

      return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('Error on /backfill:', err.message);
      return bot.sendMessage(chatId, `❌ Gagal backfill data: ${err.message}`);
    }
  });
}

module.exports = { setupBackupCommands };
