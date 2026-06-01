// src/commands/research.js
// Command untuk akses fitur research (Riwayat Alert & Statistik)

function setupResearchCommand(bot) {
  bot.onText(/\/research|^📜.*$|^📊.*$/, async (msg) => {
    const chatId = msg.chat.id;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '📜 Riwayat Alert', callback_data: 'research_alerts_list' },
          { text: '📊 Statistik', callback_data: 'research_statistics' }
        ],
        [
          { text: '📥 Export CSV', callback_data: 'research_export_csv' }
        ],
        [
          { text: '← Menu Utama', callback_data: 'menu_back' }
        ]
      ]
    };

    const text = `📜 <b>RESEARCH & DATA COLLECTION</b>

Sistem WhaleBot mencatat setiap whale alert terdeteksi untuk keperluan penelitian. Gunakan menu di bawah untuk:

• <b>📜 Riwayat Alert</b> - Lihat 10 alert terakhir
• <b>📊 Statistik</b> - Statistik sistem & token trending
• <b>📥 Export CSV</b> - Unduh data untuk analisis

Data yang dikumpulkan mencakup:
✓ Timestamp & datetime terdeteksi
✓ Token, jenis transaksi (BUY/SELL)
✓ Nilai USD & ETH
✓ Whale score & breakdown
✓ Risk category & liquidity impact
✓ Wallet address & TX hash
✓ Harga token saat alert
✓ Metadata pool & DEX

Dataset siap untuk analisis BAB 4 skripsi tentang hubungan aktivitas whale dengan volatilitas harga.`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  });
}

module.exports = { setupResearchCommand };
