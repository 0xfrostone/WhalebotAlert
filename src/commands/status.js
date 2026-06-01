// src/commands/status.js
// Command /status

const { formatUSD, createStatusIcon } = require('../utils/formatter');

function setupStatusCommand(bot, subscriberStore) {
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const user = subscriberStore.get(chatId);
    
    const isMaintenance = global.maintenanceService && global.maintenanceService.isActive();
    const statusIcon = createStatusIcon(user.active, isMaintenance);
    const statusText = isMaintenance ? 'MAINTENANCE' : (user.active ? 'AKTIF' : 'NONAKTIF');
    const tokenStr = user.tokens.size ? [...user.tokens].map(t => `$${t}`).join(', ') : 'Belum dipilih';
    const riskLabels = { ALL: 'Semua', HIGH_EXTREME: 'HIGH & EXTREME', EXTREME_ONLY: 'EXTREME saja' };
    const joined = new Date(user.joinedAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    let maintenanceWarning = '';
    if (isMaintenance) {
      const state = global.maintenanceService.getState();
      maintenanceWarning = [
        ``,
        `⚠️ <b>MAINTENANCE MODE AKTIF</b>`,
        `Alasan: ${state.reason}`,
        `⛔ Status tracking: <b>NONAKTIF</b> (sementara)`,
        `Alert akan kembali normal setelah maintenance selesai.`
      ].join('\n');
    }

    const text = [
      `📊 <b>Status Tracking Kamu</b>`,
      ``,
      `${statusIcon} Status:    <b>${statusText}</b>`,
      `💎 Token:    <b>${tokenStr}</b>`,
      `💰 Min Nilai: <b>${formatUSD(user.threshold)}</b>`,
      `🔔 Filter:   <b>${riskLabels[user.riskFilter]}</b>`,
      `📨 Alert Diterima: <b>${user.alertCount || 0}</b>`,
      `📅 Bergabung: ${joined}`,
      maintenanceWarning
    ].filter(line => line !== '').join('\n');

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: global.botMenus.buildMainMenu(user, global.maintenanceService)
    });
  });
}

module.exports = { setupStatusCommand };
