const { startDeteksiSimulator, stopDeteksiSimulator } = require('../services/deteksiSimulator');

function setupDeteksiCommand(bot, watchlistStore) {
  bot.onText(/\/deteksi(?:\s+(on|off))?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const arg = match[1] ? match[1].toLowerCase() : null;

    const user = watchlistStore.getWatchlist(chatId, msg.from.first_name);

    if (arg === 'on') {
      user.deteksiMode = true;
      watchlistStore.saveSettings(chatId, { deteksiMode: true });
      startDeteksiSimulator(bot, watchlistStore, chatId);
      return;
    }

    if (arg === 'off') {
      user.deteksiMode = false;
      watchlistStore.saveSettings(chatId, { deteksiMode: false });
      stopDeteksiSimulator(chatId);
      return;
    }

    // Jika tanpa argumen: tampilkan status & tombol toggle
    const isDeteksiOn = !!user.deteksiMode;
    const statusText = isDeteksiOn ? '🟢 <b>AKTIF</b> (Format Ringkas)' : '🔴 <b>NON-AKTIF</b> (Format Detail)';

    const text = [
      `⚡ <b>Pengaturan Mode Deteksi Singkat</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Status Mode Deteksi: ${statusText}`,
      ``,
      `<b>Contoh Tampilan Saat Aktif:</b>`,
      `🔴 Seseorang baru saja menjual (<b>$PEPE</b>) Sebesar <b>$68.3K</b> at <b>$0.000012</b>`,
      `🟢 Seseorang baru saja membeli (<b>$LINK</b>) Sebesar <b>$120.5K</b> at <b>$18.50</b>`,
      ``,
      `Pilih status yang diinginkan:`
    ].join('\n');

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🟢 Aktifkan Mode Deteksi', callback_data: 'deteksi_on' },
          { text: '🔴 Matikan Mode Deteksi', callback_data: 'deteksi_off' }
        ],
        [{ text: '⬅️ Kembali', callback_data: 'nav_settings' }]
      ]
    };

    return bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  });
}

module.exports = { setupDeteksiCommand };
