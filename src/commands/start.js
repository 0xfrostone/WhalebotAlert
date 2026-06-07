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

    const user = watchlistStore.get(chatId, { name: msg.from.first_name });
    user.name = msg.from.first_name;
    // /start selalu reset status ke MATI — user harus klik "Mulai Tracking" untuk aktif
    user.active = false;
    watchlistStore.set(chatId, user);

    const text = [
      `🐳 <b>Whale Intelligence Bot</b>`,
      `<i>Real-time ERC-20 Whale Detector</i>`,
      ``,
      `Halo, <b>${user.name}!</b> 👋`,
      ``,
      `Bot ini memantau pergerakan whale secara real-time:`,
      `💎 <b>$UNI</b> — Uniswap Governance Token`,
      `🔗 <b>$LINK</b> — Chainlink Oracle Token`,
      `🐸 <b>$PEPE</b> — Meme Coin ERC-20`,
      ``,
      `Pilih menu di bawah untuk memulai:`
    ].join('\n');

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: global.botMenus.buildMainMenu(user, global.maintenanceService)
    });
  });
}

module.exports = { setupStartCommand };
