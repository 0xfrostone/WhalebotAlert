// src/commands/deteksi.js
// Command /deteksi, /deteksi on, /deteksi off
// Mengatur mode notifikasi deteksi singkat per-user

function setupDeteksiCommand(bot, watchlistStore) {
  bot.onText(/\/deteksi(?:\s+(on|off))?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const arg = match[1] ? match[1].toLowerCase() : null;

    const user = watchlistStore.getWatchlist(chatId, msg.from.first_name);

    if (arg === 'on') {
      user.deteksiMode = true;
      watchlistStore.saveSettings(chatId, { deteksiMode: true });

      const text = [
        `⚡ <b>Mode Deteksi Singkat: AKTIF</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Format alert sekarang beralih ke format ringkas:`,
        `🔴 <code>Seseorang baru saja menjual ($TOKEN) Sebesar $68.3K at $3.00</code>`,
        `🟢 <code>Seseorang baru saja membeli ($TOKEN) Sebesar $68.3K at $3.00</code>`,
        ``,
        `<i>Gunakan <code>/deteksi off</code> untuk kembali ke format Whale Alert detail.</i>`
      ].join('\n');

      return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    }

    if (arg === 'off') {
      user.deteksiMode = false;
      watchlistStore.saveSettings(chatId, { deteksiMode: false });

      const text = [
        `🐋 <b>Mode Deteksi Singkat: NON-AKTIF</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Format alert kembali ke laporan Whale Alert komprehensif.`,
        ``,
        `<i>Gunakan <code>/deteksi on</code> untuk menggunakan format ringkas.</i>`
      ].join('\n');

      return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
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
