// src/commands/start.js
// Command /start

const { SETTINGS } = require('../config/settings');

function setupStartCommand(bot, watchlistStore) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const isAdmin = SETTINGS.ADMIN_IDS.includes(userId);

    // Check maintenance untuk non-admin
    if (global.maintenanceService && global.maintenanceService.isActive() && !isAdmin) {
      const state = global.maintenanceService.getState();
      return bot.sendMessage(chatId,
        `🔧 <b>Sistem Sedang Maintenance</b>\n\nAlasan: ${state.reason}\n\nBot akan kembali normal segera. Terima kasih atas kesabaran Anda!`,
        { parse_mode: 'HTML' }
      );
    }

    const user = watchlistStore.getWatchlist(chatId, msg.from.first_name);
    // /start selalu reset status, watchlist, dan alert today ketika memulai
    user.active = false;
    user.tokens = [];
    user.alertCount = 0;
    watchlistStore.set(chatId, user);

    const tokenCount = user.tokens ? user.tokens.length : 0;
    const alertsToday = user.alertCount || 0;

    const text = [
      `🐋 <b>Whale Intelligence Bot</b>`,
      `Real-time Ethereum Whale Monitoring`,
      `━━━━━━━━━━━━━━`,
      `📡 Status: <b>Online</b>`,
      `👀 Watchlist: <b>${tokenCount} Tokens</b>`,
      `🔔 Alerts Today: <b>${alertsToday}</b>`,
      `━━━━━━━━━━━━━━`,
      `Choose an option:`
    ].join('\n');

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: global.botMenus.buildMainMenu(user, isAdmin)
    });
  });
}

module.exports = { setupStartCommand };
