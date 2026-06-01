// src/commands/help.js
// Command /help

function setupHelpCommand(bot) {
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;

    const text = [
      `❓ <b>Panduan Penggunaan</b>`,
      ``,
      `<b>Perintah tersedia:</b>`,
      `/start  — Buka menu utama`,
      `/status — Lihat pengaturan aktif`,
      `/stop   — Hentikan semua alert`,
      `/help   — Tampilkan bantuan ini`,
      ``,
      `<b>Perintah Admin:</b>`,
      `/maintenance — Buka menu maintenance (admin only)`,
      ``,
      `<b>Cara Pakai:</b>`,
      `1️⃣ Tekan <b>Pilih Token</b> → centang yang diinginkan`,
      `2️⃣ Tekan <b>Set Threshold</b> → atur minimum USD`,
      `3️⃣ Tekan <b>Filter Risiko</b> → pilih level alert`,
      `4️⃣ Tekan <b>Mulai Tracking</b> → alert aktif!`,
      `5️⃣ Tekan <b>📈 Chart</b> → lihat grafik harga 24 jam`,
      ``,
      `<b>Level Risiko:</b>`,
      `🚨 EXTREME (75–100) — Potensi pergerakan besar`,
      `⚠️ HIGH (50–75)     — Aktivitas whale signifikan`,
      `📊 MEDIUM (25–50)   — Perlu dipantau`,
      `ℹ️ LOW (0–25)       — Aktivitas normal`,
      ``,
      `<b>Token Penelitian:</b>`,
      `• <b>$UNI</b>  — Governance DeFi, whale institusional`,
      `• <b>$LINK</b> — Infrastruktur oracle, akumulasi besar`,
      `• <b>$PEPE</b> — Meme coin, volatilitas & manipulasi tinggi`,
      ``,
      `<b>Status Maintenance:</b>`,
      `Jika sistem sedang maintenance, status tracking Anda akan otomatis ⛔ NONAKTIF`
    ].join('\n');

    const keyboard = {
      inline_keyboard: [[
        { text: '← Kembali ke Menu', callback_data: 'menu_back' }
      ]]
    };

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  });
}

module.exports = { setupHelpCommand };
