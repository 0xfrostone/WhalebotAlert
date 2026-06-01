// src/commands/maintenance.js
// Command /maintenance (admin only)

const { SETTINGS } = require('../config/settings');
const { logAdmin } = require('../utils/logger');

function setupMaintenanceCommand(bot) {
  bot.onText(/\/maintenance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Check admin
    if (!SETTINGS.ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk command ini.');
    }

    logAdmin(msg.from.first_name, userId, 'membuka maintenance menu');

    await bot.sendMessage(chatId,
      `🔧 <b>Admin Maintenance Control</b>\n\nPilih opsi di bawah:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🟢 Maintenance ON', callback_data: 'maint_on' },
              { text: '🔴 Maintenance OFF', callback_data: 'maint_off' }
            ],
            [
              { text: '🔄 Restart Bot', callback_data: 'maint_restart' },
              { text: '📊 Status Bot', callback_data: 'maint_status' }
            ],
            [
              { text: '❌ Cancel', callback_data: 'maint_cancel' }
            ]
          ]
        }
      }
    );
  });
}

module.exports = { setupMaintenanceCommand };
