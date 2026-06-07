// src/services/maintenanceService.js
// Service untuk manage maintenance mode

const { logAdmin, logAlert } = require('../utils/logger');

class MaintenanceService {
  constructor(maintenanceStore, watchlistStore, bot) {
    this.store = maintenanceStore;
    this.subscribers = watchlistStore;
    this.bot = bot;
  }

  async activate(reason = 'Admin maintenance') {
    this.store.activate(reason);

    // Matikan tracking semua user
    for (const [chatId, user] of this.subscribers.getAll()) {
      user.active = false;
    }
    this.subscribers.save();

    // Broadcast maintenance start notification ke semua subscribers
    await this.broadcastStart(reason);

    logAlert(`Maintenance mode ACTIVATED: ${reason}`);
  }

  async deactivate() {
    const { oldReason, uptimeMins } = this.store.deactivate();
    await this.broadcastEnd(oldReason, uptimeMins);
    logAlert(`Maintenance mode DEACTIVATED (duration: ${uptimeMins} min)`);
  }

  isActive() {
    return this.store.isActive();
  }

  getState() {
    return this.store.getState();
  }

  async broadcastStart(reason) {
    const message = [
      `🔧 <b>SISTEM SEDANG MAINTENANCE</b>`,
      ``,
      `Alasan: ${reason}`,
      ``,
      `⚠️ <b>Status Tracking Anda: NONAKTIF</b>`,
      `Semua alert akan berhenti sementara. Sistem akan kembali normal segera.`,
      ``,
      `Terima kasih atas kesabaran Anda! 🙏`
    ].join('\n');

    let sent = 0;
    for (const [chatId] of this.subscribers.getAll()) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        sent++;
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.subscribers.delete(chatId);
        }
      }
    }

    console.log(`📢 Maintenance START notification sent to ${sent} users`);
  }

  async broadcastEnd(reason, uptimeMins) {
    const message = [
      `✅ <b>SISTEM KEMBALI NORMAL</b>`,
      ``,
      `Maintenance selesai. Durasi: <b>${uptimeMins} menit</b>`,
      `Alasan: <i>${reason}</i>`,
      ``,
      `📊 Anda bisa mulai aktifkan tracking kembali dengan tekan "/start" atau "Mulai Tracking"`,
      ``,
      `Terima kasih! 🐳`
    ].join('\n');

    let sent = 0;
    for (const [chatId] of this.subscribers.getAll()) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
        sent++;
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.subscribers.delete(chatId);
        }
      }
    }

    console.log(`📢 Maintenance END notification sent to ${sent} users`);
  }
}

module.exports = { MaintenanceService };
