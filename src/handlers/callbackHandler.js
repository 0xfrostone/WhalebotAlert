// src/handlers/callbackHandler.js
// Main callback handler untuk semua inline buttons

const fs = require('fs');
const path = require('path');
const StorageManager = require('../storage/StorageManager');
const { TokenHandler } = require('./tokenHandler');
const { ThresholdHandler } = require('./thresholdHandler');
const { ChartHandler } = require('./chartHandler');
const { SETTINGS } = require('../config/settings');
const { logAdmin } = require('../utils/logger');
const { formatUSD } = require('../utils/formatter');

class CallbackHandler {
  constructor(telegramBot, watchlistStore, maintenanceService, botMenus, appBot) {
    this.bot = telegramBot;
    this.appBot = appBot;
    this.subscribers = watchlistStore;
    this.maintenance = maintenanceService;
    this.menus = botMenus;
  }

  setup() {
    this.bot.on('callback_query', (query) => this.handleCallback(query));
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;
    const user = this.subscribers.getWatchlist(chatId, query.from.first_name);
    const isAdmin = SETTINGS.ADMIN_IDS.includes(query.from.id);

    // Check maintenance untuk non-admin
    if (this.maintenance.isActive() && !isAdmin && !data.startsWith('maint_')) {
      return this.bot.answerCallbackQuery(query.id, {
        text: `⚠️ Sistem maintenance: ${this.maintenance.getState().reason}`,
        show_alert: true
      });
    }

    // Acknowledge tombol
    this.bot.answerCallbackQuery(query.id).catch(() => {});

    // ——— NEW UI NAVIGATION ROUTES ———
    if (data === 'nav_main') {
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;
      return this.editMsg(chatId, msgId,
        `🐋 <b>Whale Intelligence Bot</b>\n\nReal-time Ethereum Whale Monitoring\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status: <b>Online</b>\n👀 Watchlist: <b>${tokenCount} Token</b>\n🔔 Alert Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\nPilih menu:`,
        this.menus.buildMainMenu(user, isAdmin)
      );
    }

    if (data === 'nav_dashboard') {
      const stats = this.appBot.getStats();
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;
      let extraStats = '';
      if (isAdmin && this.appBot.researchStore) {
        const rs = this.appBot.researchStore.getStats();
        extraStats = `\n\n📈 Whale Terdeteksi: <b>${rs.total_whale_alerts || 0}</b>`;
      }

      return this.editMsg(chatId, msgId,
        `📊 <b>Dashboard</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status Bot: <b>Online</b>\n👥 Subscriber Aktif: <b>${stats.active}</b>\n👀 Token Dipantau: <b>${tokenCount}</b>\n🔔 Alert Hari Hari Ini: <b>${alertsToday}</b>${extraStats}\n\n━━━━━━━━━━━━━━━━━━━━`,
        this.menus.buildDashboardMenu(user)
      );
    }

    if (data === 'nav_settings') {
      return this.editMsg(chatId, msgId,
        `⚙️ <b>Pengaturan</b>\n\nKelola konfigurasi sistem monitoring.`,
        this.menus.buildSettingsMenu()
      );
    }

    if (data === 'nav_watchlist') {
      return this.editMsg(chatId, msgId,
        `👀 <b>Watchlist Menu</b>\n\nKelola token yang sedang dipantau.`,
        this.menus.buildWatchlistMenu()
      );
    }

    if (data === 'nav_threshold') {
      return this.editMsg(chatId, msgId,
        `🎯 <b>Threshold Settings</b>\n\nCurrent Minimum USD: <b>${formatUSD(user.threshold || 0)}</b>`,
        this.menus.buildThresholdMenu()
      );
    }


    if (data === 'nav_help') {
      return this.editMsg(chatId, msgId,
        `❓ <b>Bantuan</b>\n\n<b>Tentang Sistem</b>\nBot ini memantau aktivitas transaksi whale pada jaringan Ethereum secara real-time menggunakan data on-chain dari liquidity pool DEX.\n\n<b>Fitur Utama</b>\n• Deteksi transaksi whale\n• Monitoring UNI, LINK, dan PEPE\n• Analisis nilai transaksi dalam USD\n• Perhitungan Liquidity Impact\n• Skor aktivitas whale\n\n<b>Cara Penggunaan</b>\n1. Tambahkan token ke Watchlist\n2. Atur Threshold deteksi\n3. Aktifkan monitoring\n4. Terima notifikasi saat whale terdeteksi\n\n<b>Kontak</b>\nAdministrator Sistem`,
        this.menus.buildHelpMenu()
      );
    }

    if (data === 'nav_research_stats' || data === 'refresh_research_stats') {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });
      return this.renderResearchStats(chatId, msgId, 'all', query);
    }

    if (data.startsWith('stats_filter_')) {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });
      const period = data.replace('stats_filter_', '');
      return this.renderResearchStats(chatId, msgId, period, query);
    }

    if (data === 'research_chart') {
      try {
        const rs = this.appBot.researchStore.getStats();
        const buyCount = rs.buy_count || 0;
        const sellCount = rs.sell_count || 0;

        const chartConfig = {
          type: 'doughnut',
          data: {
            labels: [`BUY (${rs.buyPct || 0}%)`, `SELL (${rs.sellPct || 0}%)`],
            datasets: [{
              data: [buyCount || 1, sellCount || 0],
              backgroundColor: ['#22c55e', '#ef4444']
            }]
          },
          options: {
            plugins: {
              title: { display: true, text: 'Rasio Aktivitas Whale (BUY vs SELL)', fontSize: 18 }
            }
          }
        };

        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=500&h=300&bkg=white`;

        await this.bot.sendPhoto(chatId, chartUrl, {
          caption: `🖼️ <b>Grafik Aktivitas Whale (BUY vs SELL)</b>\n\nSentimen: <b>${rs.sentiment || 'NETRAL'}</b>\nTotal BUY: ${buyCount} | Total SELL: ${sellCount}\n\n<i>Bisa langsung di-copy & paste ke slide presentasi sidang skripsi!</i>`,
          parse_mode: 'HTML'
        });

        return this.bot.answerCallbackQuery(query.id, { text: 'Grafik berhasil dikirim!', show_alert: false });
      } catch (err) {
        console.error('Error generating chart:', err);
        return this.bot.sendMessage(chatId, `❌ Gagal memuat grafik: ${err.message}`);
      }
    }

    if (data === 'export_pdf') {
      try {
        const StorageManager = require('../storage/StorageManager');
        const alerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
        const rs = this.appBot.researchStore.getStats();

        const fs = require('fs');
        const today = new Date().toISOString().split('T')[0];
        const filename = `lampiran_laporan_skripsi_${today}.txt`;
        const filePath = StorageManager.getResearchPath(filename);

        const reportText = [
          `====================================================================`,
          `         LAMPIRAN LAPORAN HASIL PENELITIAN SKRIPSI`,
          `   SISTEM INTELLIGENCE WHALE MONITORING & IMPACT ANALYSIS`,
          `====================================================================`,
          `Tanggal Cetak : ${new Date().toLocaleString('id-ID')}`,
          `Status Sistem : ONLINE / AKTIF`,
          ``,
          `1. METRIK MONITORING`,
          `--------------------------------------------------------------------`,
          `Waktu Mulai Monitoring : ${new Date(rs.monitoring_start_date).toLocaleString('id-ID')}`,
          `Total Event Terpantau  : ${rs.total_events}`,
          `Total Transaksi Whale  : ${rs.total_whale_alerts}`,
          `Total Alert Terkirim   : ${alerts.length}`,
          `Sentimen Pasar Whale   : ${rs.sentiment || 'NETRAL'}`,
          ``,
          `2. ANALISIS AKTIVITAS BUY VS SELL`,
          `--------------------------------------------------------------------`,
          `Total Transaksi BUY    : ${rs.buy_count} (${rs.buyPct}%)`,
          `Total Transaksi SELL   : ${rs.sell_count} (${rs.sellPct}%)`,
          `Rata-Rata Whale Score  : ${rs.average_score.toFixed(1)} / 100`,
          `Rata-Rata Dampak Harga : ${(rs.average_impact * 100).toFixed(4)}%`,
          ``,
          `3. TRANSAKSI TERBESAR TERDETEKSI`,
          `--------------------------------------------------------------------`,
          `Token                  : ${rs.highest_transaction.token || '-'}`,
          `Nilai Uang (USD)       : $${(rs.highest_transaction.amount || 0).toLocaleString('id-ID')}`,
          `Waktu Transaksi        : ${rs.highest_transaction.timestamp ? new Date(rs.highest_transaction.timestamp).toLocaleString('id-ID') : '-'}`,
          ``,
          `4. DAFTAR RIWAYAT ALERT (SAMPEL DATASET PENELITIAN)`,
          `--------------------------------------------------------------------`,
          alerts.slice(0, 50).map((a, i) => 
            `[${i + 1}] ${a.dateTime} | Token: $${a.tokenSymbol || a.token} | Arah: ${a.direction || a.transactionType} | USD: $${a.valueUSD} | Score: ${a.whaleScore}`
          ).join('\n'),
          ``,
          `====================================================================`,
          `           DOKUMEN INI DICETAK SECARA OTOMATIS OLEH BOT`,
          `               SIAP DIGUNAKAN SEBAGAI LAMPIRAN BAB 4`,
          `====================================================================`
        ].join('\n');

        fs.writeFileSync(filePath, reportText, 'utf8');

        await this.bot.sendDocument(chatId, filePath, {
          caption: `📄 <b>Laporan Ringkasan Penelitian (Lampiran Skripsi)</b>\n\nFormat laporan bersih terstruktur siap cetak untuk lampiran dokumen skripsi Bab 4.`,
          parse_mode: 'HTML'
        });

        return this.bot.answerCallbackQuery(query.id, { text: 'Laporan berhasil dikirim!', show_alert: false });
      } catch (err) {
        console.error('Error exporting PDF/text report:', err);
        return this.bot.sendMessage(chatId, `❌ Gagal export laporan: ${err.message}`);
      }
    }

    if (data === 'menu_preset_popular') {
      const presets = ['LINK', 'UNI', 'PEPE'];
      for (const token of presets) {
        if (!this.appBot.watchlistStore.hasToken(chatId, token)) {
          this.appBot.watchlistStore.addToken(chatId, token);
        }
      }
      const currentTokens = this.appBot.watchlistStore.getTokens(chatId);
      const text = `⚡ <b>Preset Token Berhasil Ditambahkan!</b>\n\nToken populer ditambahkan: <b>LINK, UNI, PEPE</b>\nWatchlist kamu saat ini (${currentTokens.length} token):\n<b>${currentTokens.join(', ')}</b>`;

      return this.editMsg(chatId, msgId, text, {
        inline_keyboard: [
          [{ text: '📋 Lihat Watchlist', callback_data: 'menu_my_watchlist' }],
          [{ text: '⬅️ Kembali', callback_data: 'nav_watchlist' }]
        ]
      });
    }

    if (data === 'export_menu') {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });

      return this.editMsg(chatId, msgId, `📊 <b>Export Statistik Penelitian</b>\n\nPilih periode waktu data yang ingin di-export:`, {
        inline_keyboard: [
          [{ text: '⚡ 24 Jam Terakhir', callback_data: 'exp_sm_24h' }],
          [{ text: '📅 7 Hari Terakhir', callback_data: 'exp_sm_7d' }],
          [{ text: '🗓️ 30 Hari Terakhir', callback_data: 'exp_sm_30d' }],
          [{ text: '🌐 Semua Data', callback_data: 'exp_sm_all' }],
          [{ text: '⬅️ Kembali', callback_data: 'nav_research_stats' }]
        ]
      });
    }

    if (data === 'export_summary' || data === 'export_dataset') {
      return this.editMsg(chatId, msgId, `📊 <b>Export Statistik Penelitian</b>\n\nPilih periode waktu data yang ingin di-export:`, {
        inline_keyboard: [
          [{ text: '⚡ 24 Jam Terakhir', callback_data: 'exp_sm_24h' }],
          [{ text: '📅 7 Hari Terakhir', callback_data: 'exp_sm_7d' }],
          [{ text: '🗓️ 30 Hari Terakhir', callback_data: 'exp_sm_30d' }],
          [{ text: '🌐 Semua Data', callback_data: 'exp_sm_all' }],
          [{ text: '⬅️ Kembali', callback_data: 'nav_research_stats' }]
        ]
      });
    }

    if (data.startsWith('exp_ds_') || data.startsWith('exp_sm_')) {
      const period = data.replace('exp_ds_', '').replace('exp_sm_', '');
      return this.handleSummaryExport(chatId, query, period);
    }

    // ——— BACK COMPATIBILITY ———
    if (data === 'menu_back') {
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;
      return this.editMsg(chatId, msgId,
        `🐋 <b>Whale Intelligence Bot</b>\n\nReal-time Ethereum Whale Monitoring\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status: <b>Online</b>\n👀 Watchlist: <b>${tokenCount} Token</b>\n🔔 Alert Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\nPilih menu:`,
        this.menus.buildMainMenu(user, isAdmin)
      );
    }

    // ——— MENU ITEMS ———
    if (data === 'menu_add_token') {
      console.log(`[WATCHLIST] Add Token Requested by ${user.name} (${chatId})`);
      this.appBot.userStates.set(chatId, 'AWAITING_CONTRACT');
      return this.editMsg(chatId, msgId,
        `➕ <b>Tambah Token</b>\n\nMasukkan Contract Address ERC-20 Ethereum yang ingin dipantau.\n\nContoh:\n<code>0x514910771AF9Ca656af840dff83E8264EcF986CA</code>\n\nKetik alamat contract atau tekan Batal.`,
        {
          inline_keyboard: [[{ text: '❌ Batal', callback_data: 'menu_cancel_add' }]]
        }
      );
    }

    if (data === 'menu_cancel_add') {
      this.appBot.userStates.delete(chatId);
      return this.editMsg(chatId, msgId,
        `👀 <b>Watchlist Menu</b>\n\nKelola token yang sedang dipantau.`,
        this.menus.buildWatchlistMenu()
      );
    }

    if (data === 'menu_remove_token') {
      const tokensArr = user.tokens || [];
      if (tokensArr.length === 0) {
        return this.bot.answerCallbackQuery(query.id, { text: 'Watchlist kosong!', show_alert: true });
      }

      const keyboard = tokensArr.map(t => [{ text: `❌ ${t}`, callback_data: `remove_token_${t}` }]);
      keyboard.push([{ text: '⬅️ Kembali', callback_data: 'nav_watchlist' }]);

      return this.editMsg(chatId, msgId,
        `➖ <b>Hapus Token</b>\n\nPilih token yang ingin dihapus dari watchlist:`,
        { inline_keyboard: keyboard }
      );
    }

    if (data.startsWith('remove_token_')) {
      const tokenSymbol = data.replace('remove_token_', '');
      console.log(`[WATCHLIST] Token Removed: ${tokenSymbol} by ${user.name} (${chatId})`);
      if (user.tokens) {
        user.tokens = user.tokens.filter(t => t !== tokenSymbol);
        this.subscribers.set(chatId, user);
      }
      return this.bot.answerCallbackQuery(query.id, { text: `✅ Token ${tokenSymbol} berhasil dihapus.`, show_alert: true })
        .then(() => {
          // Re-render the remove menu
          const tokensArr = user.tokens || [];
          const keyboard = tokensArr.map(t => [{ text: `❌ ${t}`, callback_data: `remove_token_${t}` }]);
          keyboard.push([{ text: '⬅️ Kembali', callback_data: 'nav_watchlist' }]);
          
          return this.editMsg(chatId, msgId,
            `➖ <b>Hapus Token</b>\n\nPilih token yang ingin dihapus dari watchlist:`,
            { inline_keyboard: keyboard }
          );
        });
    }

    if (data === 'menu_my_watchlist') {
      const tokensArr = user.tokens || [];
      const tokenList = tokensArr.length ? tokensArr.map(t => `• ${t}`).join('\n') : '<i>Belum ada token</i>';
      return this.editMsg(chatId, msgId,
        `👀 <b>Watchlist Token</b>\n\nToken yang sedang dipantau:\n\n${tokenList}`,
        this.menus.buildWatchlistMenu()
      );
    }

    if (data === 'menu_threshold' || data === 'menu_threshold_usd') {
      return this.editMsg(chatId, msgId,
        `💰 <b>Set Threshold Minimum</b>\n\nThreshold saat ini: <b>${formatUSD(user.threshold)}</b>\n\nAlert hanya dikirim jika nilai transaksi melebihi angka ini:`,
        ThresholdHandler.buildMenu(user)
      );
    }


    if (data === 'menu_status') {
      return this.handleStatus(chatId, msgId, user);
    }

    if (data === 'menu_help') {
      return this.handleHelp(chatId, msgId);
    }



    // ——— THRESHOLD HANDLERS ———
    if (data.startsWith('thr_') && data !== 'thr_confirm') {
      const thresholdVal = data.replace('thr_', '');
      ThresholdHandler.handleSelect(user, thresholdVal);
      this.subscribers.set(chatId, user);
      return this.bot.editMessageReplyMarkup(
        ThresholdHandler.buildMenu(user),
        { chat_id: chatId, message_id: msgId }
      ).catch(() => {});
    }

    if (data === 'thr_confirm') {
      this.subscribers.set(chatId, user);
      return this.editMsg(chatId, msgId,
        `✅ <b>Threshold Tersimpan!</b>\n\nMinimum nilai transaksi: <b>${formatUSD(user.threshold)}</b>\n\nKembali ke menu utama:`,
        this.menus.buildMainMenu(user, this.maintenance)
      );
    }


    // ——— TRACKING HANDLERS ———
    if (data === 'tracking_start') {
      const tokensArr = user.tokens || [];
      if (tokensArr.length === 0) {
        return this.bot.answerCallbackQuery(query.id, {
          text: '⚠️ Tambahkan minimal 1 token ke watchlist terlebih dahulu!',
          show_alert: true
        });
      }
      user.active = true;
      this.subscribers.set(chatId, user);

      const stats = this.appBot.getStats();
      const tokenCount = tokensArr.length;
      const alertsToday = user.alertCount || 0;

      return this.editMsg(chatId, msgId,
        `📊 <b>Dashboard</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status Bot: <b>Online</b>\n👥 Subscriber Aktif: <b>${stats.active}</b>\n👀 Token Dipantau: <b>${tokenCount}</b>\n🔔 Alert Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n✅ <b>Tracking AKTIF</b>. Anda akan menerima notifikasi whale secara real-time.`,
        this.menus.buildDashboardMenu(user)
      );
    }

    if (data === 'tracking_stop') {
      user.active = false;
      this.subscribers.set(chatId, user);
      
      const stats = this.appBot.getStats();
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;

      return this.editMsg(chatId, msgId,
        `📊 <b>Dashboard</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status Bot: <b>Online</b>\n👥 Subscriber Aktif: <b>${stats.active}</b>\n👀 Token Dipantau: <b>${tokenCount}</b>\n🔔 Alert Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n⏸ <b>Tracking DIHENTIKAN</b>. Anda tidak akan menerima notifikasi.`,
        this.menus.buildDashboardMenu(user)
      );
    }

    // ——— CHART HANDLER ———
    // Chart generation with default timeframe
    if (data.startsWith('chart_') && !data.includes('_timeframe_') && !data.includes('_refresh_')) {
      const token = data.replace('chart_', '');
      return ChartHandler.handle(this.bot, chatId, token);
    }

    // Timeframe switching
    if (data.startsWith('chart_timeframe_')) {
      const parts = data.replace('chart_timeframe_', '').split('_');
      if (parts.length >= 2) {
        const token = parts[0];
        const timeframe = parts[1];
        return ChartHandler.handleTimeframeSwitch(this.bot, chatId, msgId, token, timeframe);
      }
    }

    // Refresh button
    if (data.startsWith('chart_refresh_')) {
      const parts = data.replace('chart_refresh_', '').split('_');
      if (parts.length >= 2) {
        const token = parts[0];
        const timeframe = parts[1];
        return ChartHandler.handleRefresh(this.bot, chatId, msgId, token, timeframe);
      }
    }

    // ——— MAINTENANCE HANDLERS (ADMIN ONLY) ———
    if (data.startsWith('maint_') && isAdmin) {
      return this.handleMaintenance(chatId, msgId, data, query.from);
    }
  }

  async handleStatus(chatId, msgId, user) {
    const isMaintenance = this.maintenance.isActive();
    const statusIcon = isMaintenance ? '⛔' : (user.active ? '🟢' : '🔴');
    const statusText = isMaintenance ? 'MAINTENANCE' : (user.active ? 'AKTIF' : 'NONAKTIF');
    const tokenStr = user.tokens.size ? [...user.tokens].map(t => `$${t}`).join(', ') : 'Belum dipilih';
    const riskLabels = { ALL: 'Semua', HIGH_EXTREME: 'HIGH & EXTREME', EXTREME_ONLY: 'EXTREME saja' };
    const joined = new Date(user.joinedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let maintenanceWarning = '';
    if (isMaintenance) {
      const state = this.maintenance.getState();
      maintenanceWarning = [
        ``,
        `⚠️ <b>MAINTENANCE MODE AKTIF</b>`,
        `Alasan: ${state.reason}`,
        `⛔ Status tracking: <b>NONAKTIF</b> (sementara)`
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

    return this.editMsg(chatId, msgId, text, this.menus.buildMainMenu(user, this.maintenance));
  }

  async handleHelp(chatId, msgId) {
    const text = [
      `❓ <b>Panduan Penggunaan</b>`,
      ``,
      `<b>Level Risiko:</b>`,
      `🚨 EXTREME — Potensi pergerakan besar`,
      `⚠️ HIGH    — Aktivitas whale signifikan`,
      `📊 MEDIUM  — Perlu dipantau`,
      `ℹ️ LOW     — Aktivitas normal`,
      ``,
      `<b>Tombol Chart 📈:</b>`,
      `Lihat grafik harga 24 jam langsung di Telegram!`,
      `Gunakan 🔄 Refresh untuk update data terbaru.`,
      ``,
      `<b>Admin Commands:</b>`,
      `/maintenance — Menu maintenance mode`
    ].join('\n');

    const keyboard = {
      inline_keyboard: [[
        { text: '← Kembali ke Menu', callback_data: 'menu_back' }
      ]]
    };

    return this.editMsg(chatId, msgId, text, keyboard);
  }

  async handleMaintenance(chatId, msgId, data, fromUser) {
    if (data === 'maint_on') {
      logAdmin(fromUser.first_name, fromUser.id, 'MENGAKTIFKAN maintenance mode');

      await this.maintenance.activate();

      return this.editMsg(chatId, msgId,
        `✅ <b>Maintenance Mode: AKTIF</b>\n\nSemua user tracking dihentikan. Alert diabaikan.`,
        {
          inline_keyboard: [[
            { text: '🔴 OFF', callback_data: 'maint_off' },
            { text: '❌ Close', callback_data: 'maint_cancel' }
          ]]
        }
      );
    }

    if (data === 'maint_off') {
      logAdmin(fromUser.first_name, fromUser.id, 'MENONAKTIFKAN maintenance mode');

      await this.maintenance.deactivate();

      return this.editMsg(chatId, msgId,
        `✅ <b>Maintenance Mode: OFF</b>\n\nSistem kembali normal.`,
        {
          inline_keyboard: [[
            { text: '🟢 ON', callback_data: 'maint_on' },
            { text: '❌ Close', callback_data: 'maint_cancel' }
          ]]
        }
      );
    }

    if (data === 'maint_status') {
      const status = this.maintenance.isActive()
        ? `🔴 MAINTENANCE AKTIF\nAlasan: ${this.maintenance.getState().reason}`
        : `🟢 SISTEM NORMAL`;

      return this.editMsg(chatId, msgId,
        `📊 <b>Status Bot</b>\n\n${status}`,
        {
          inline_keyboard: [[
            { text: '🟢 ON', callback_data: 'maint_on' },
            { text: '🔴 OFF', callback_data: 'maint_off' },
            { text: '❌ Close', callback_data: 'maint_cancel' }
          ]]
        }
      );
    }

    if (data === 'maint_restart') {
      logAdmin(fromUser.first_name, fromUser.id, 'RESTART BOT (scheduled)');

      await this.editMsg(chatId, msgId,
        `🔄 <b>Bot Restart Scheduled</b>\n\nBot akan restart dalam 5 detik...`,
        { inline_keyboard: [[]] }
      );

      setTimeout(() => {
        console.log(`🔄 Restarting bot...`);
        process.exit(0);
      }, 5000);

      return;
    }

    if (data === 'maint_cancel') {
      logAdmin(fromUser.first_name, fromUser.id, 'tutup maintenance menu');

      return this.editMsg(chatId, msgId,
        `❌ <b>Menu ditutup</b>`,
        { inline_keyboard: [[]] }
      );
    }
  }

  filterAlertsByTime(alerts, period) {
    if (!period || period === 'all') return { filteredAlerts: alerts, label: 'Semua Waktu' };
    const now = Date.now();
    let maxMs = 0;
    let label = 'Semua Waktu';
    if (period === '24h') {
      maxMs = 24 * 60 * 60 * 1000;
      label = '24 Jam Terakhir';
    } else if (period === '7d') {
      maxMs = 7 * 24 * 60 * 60 * 1000;
      label = '7 Hari Terakhir';
    } else if (period === '30d') {
      maxMs = 30 * 24 * 60 * 60 * 1000;
      label = '30 Hari Terakhir';
    }

    const filteredAlerts = alerts.filter(a => {
      const ts = a.timestamp || (a.savedAt ? new Date(a.savedAt).getTime() : 0);
      if (!ts) return true;
      return (now - ts) <= maxMs;
    });

    return { filteredAlerts, label };
  }

  async handleDatasetExport(chatId, query, period) {
    try {
      const StorageManager = require('../storage/StorageManager');
      const alerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
      if (alerts.length === 0) {
        return this.bot.sendMessage(chatId, 'Belum ada data alert untuk di-export.');
      }

      const { filteredAlerts, label } = this.filterAlertsByTime(alerts, period);
      if (filteredAlerts.length === 0) {
        return this.bot.sendMessage(chatId, `❌ Tidak ada data alert dalam periode ${label}.`);
      }

      const { ExcelExporter } = require('../utils/excelExporter');
      const filePath = ExcelExporter.generateDatasetExcel(filteredAlerts, label);

      await this.bot.sendDocument(chatId, filePath, {
        caption: `📊 <b>Dataset Penelitian (${label})</b>\n\nSeluruh data transaksi whale mentah (${filteredAlerts.length} record) dalam format Excel (XLSX).`,
        parse_mode: 'HTML'
      });
      
      return this.bot.answerCallbackQuery(query.id, { text: `Dataset ${label} berhasil dikirim!`, show_alert: false });
    } catch (err) {
      console.error('Export Dataset error:', err);
      return this.bot.sendMessage(chatId, `❌ Gagal export dataset: ${err.message}`);
    }
  }

  async handleSummaryExport(chatId, query, period) {
    try {
      const StorageManager = require('../storage/StorageManager');
      const alerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
      if (alerts.length === 0) {
        return this.bot.sendMessage(chatId, 'Belum ada data alert untuk di-export.');
      }

      const { filteredAlerts, label } = this.filterAlertsByTime(alerts, period);
      if (filteredAlerts.length === 0) {
        return this.bot.sendMessage(chatId, `❌ Tidak ada data alert dalam periode ${label}.`);
      }

      const { ExcelExporter } = require('../utils/excelExporter');
      const rs = this.appBot.researchStore ? this.appBot.researchStore.getStats() : {};
      rs.total_alerts_sent = filteredAlerts.length;
      const filePath = ExcelExporter.generateSummaryExcel(filteredAlerts, rs, label);

      await this.bot.sendDocument(chatId, filePath, {
        caption: `📊 <b>Ringkasan Penelitian (${label})</b>\n\nLaporan komprehensif berisi statistik, aktivitas token, dan ringkasan angka penelitian (${filteredAlerts.length} record) dalam format Excel (XLSX).`,
        parse_mode: 'HTML'
      });
      
      return this.bot.answerCallbackQuery(query.id, { text: `Ringkasan ${label} berhasil dikirim!`, show_alert: false });
    } catch (err) {
      console.error('Export Summary error:', err);
      return this.bot.sendMessage(chatId, `❌ Gagal export summary: ${err.message}`);
    }
  }

  async renderResearchStats(chatId, msgId, period = 'all', query = null) {
    const StorageManager = require('../storage/StorageManager');
    const userAlerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
    const rsGlobal = this.appBot.researchStore.getStats();

    let alertsToUse = userAlerts;
    let label = 'Semua Waktu';
    const now = Date.now();

    if (period === '24h') {
      label = '24 Jam Terakhir';
      alertsToUse = userAlerts.filter(a => {
        const ts = a.timestamp || (a.savedAt ? new Date(a.savedAt).getTime() : 0);
        return ts && (now - ts <= 24 * 3600 * 1000);
      });
    } else if (period === '7d') {
      label = '7 Hari Terakhir';
      alertsToUse = userAlerts.filter(a => {
        const ts = a.timestamp || (a.savedAt ? new Date(a.savedAt).getTime() : 0);
        return ts && (now - ts <= 7 * 24 * 3600 * 1000);
      });
    } else if (period === '30d') {
      label = '30 Hari Terakhir';
      alertsToUse = userAlerts.filter(a => {
        const ts = a.timestamp || (a.savedAt ? new Date(a.savedAt).getTime() : 0);
        return ts && (now - ts <= 30 * 24 * 3600 * 1000);
      });
    }

    let buyCount = 0;
    let sellCount = 0;
    let tokenStats = {};
    let highestTx = { amount: 0, token: '-', timestamp: '-' };
    let sumScore = 0;
    let sumImpact = 0;
    let totalWhales = 0;

    if (period !== 'all' && alertsToUse.length > 0) {
      totalWhales = alertsToUse.length;
      for (const a of alertsToUse) {
        const dir = a.direction || a.transactionType || 'BUY';
        if (dir === 'BUY') buyCount++;
        else sellCount++;

        const sym = a.tokenSymbol || a.token || 'UNKNOWN';
        if (!tokenStats[sym]) tokenStats[sym] = { BUY: 0, SELL: 0 };
        if (dir === 'BUY') tokenStats[sym].BUY++;
        else tokenStats[sym].SELL++;

        const usd = a.valueUSD || a.usdValue || 0;
        if (usd > highestTx.amount) {
          highestTx = {
            amount: usd,
            token: sym,
            timestamp: a.dateTime || (a.timestamp ? new Date(a.timestamp).toLocaleString('id-ID') : '-')
          };
        }

        const score = typeof a.whaleScore === 'number' ? a.whaleScore : (a.whaleScore?.total || 0);
        sumScore += score;

        const impact = a.lpImpactPct || a.liquidityImpactPct || 0;
        sumImpact += impact;
      }
    } else {
      buyCount = rsGlobal.buy_count || 0;
      sellCount = rsGlobal.sell_count || 0;
      tokenStats = rsGlobal.token_stats || {};
      highestTx = {
        amount: rsGlobal.highest_transaction ? rsGlobal.highest_transaction.amount || 0 : 0,
        token: rsGlobal.highest_transaction ? rsGlobal.highest_transaction.token || '-' : '-',
        timestamp: rsGlobal.highest_transaction && rsGlobal.highest_transaction.timestamp ? new Date(rsGlobal.highest_transaction.timestamp).toLocaleString('id-ID') : '-'
      };
      totalWhales = rsGlobal.total_whale_alerts || userAlerts.length;
      sumScore = rsGlobal.sum_whale_score || 0;
      sumImpact = rsGlobal.sum_liquidity_impact || 0;
    }

    const totalBuySell = buyCount + sellCount;
    const buyPct = totalBuySell > 0 ? ((buyCount / totalBuySell) * 100).toFixed(1) : '0.0';
    const sellPct = totalBuySell > 0 ? ((sellCount / totalBuySell) * 100).toFixed(1) : '0.0';

    let sentiment = '⚪ NETRAL';
    if (buyCount > sellCount) sentiment = '🟢 BULLISH (Dominasi Akumulasi)';
    else if (sellCount > buyCount) sentiment = '🔴 BEARISH (Dominasi Distribusi)';

    const divisor = totalWhales || 1;
    const avgScore = (period === 'all' ? rsGlobal.average_score : (sumScore / divisor)).toFixed(1);
    const avgImpact = ((period === 'all' ? rsGlobal.average_impact : (sumImpact / divisor)) * 100).toFixed(5);

    const startDate = new Date(rsGlobal.monitoring_start_date).toLocaleString('id-ID');
    const lastDate = new Date().toLocaleString('id-ID');

    let tokensStr = '';
    if (Object.keys(tokenStats).length > 0) {
      for (const [sym, stats] of Object.entries(tokenStats)) {
        tokensStr += `\n${sym}: BUY ${stats.BUY} | SELL ${stats.SELL}`;
      }
    } else {
      tokensStr = '\nBelum ada data token.';
    }

    const { formatUSD } = require('../utils/formatter');
    const h_amount = formatUSD(highestTx.amount);
    const uptimeH = ((Date.now() - new Date(rsGlobal.monitoring_start_date).getTime()) / 3_600_000).toFixed(1);

    const msgText = [
      `📈 <b>Statistik Penelitian Skripsi</b>`,
      `⏳ Filter Rentang Waktu: <b>${label}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🎯 <b>Sentimen Pasar Whale:</b>`,
      `<b>${sentiment}</b>`,
      ``,
      `<b>Periode Monitoring System</b>`,
      `Mulai: ${startDate}`,
      `Terakhir: ${lastDate}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `<b>Aktivitas Whale (${label})</b>`,
      `Total Event System: <b>${rsGlobal.total_events}</b>`,
      `Whale Terdeteksi: <b>${totalWhales}</b>`,
      `Alert Dikirim: <b>${period === 'all' ? rsGlobal.total_alerts_sent : alertsToUse.length}</b>`,
      ``,
      `<b>Aktivitas BUY vs SELL</b>`,
      `🟢 BUY : <b>${buyCount} (${buyPct}%)</b>`,
      `🔴 SELL: <b>${sellCount} (${sellPct}%)</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `<b>Per Token Watchlist</b>${tokensStr}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `<b>Transaksi Terbesar (${label})</b>`,
      `Token: <b>${highestTx.token}</b>`,
      `Nilai: <b>${h_amount}</b>`,
      `Waktu: <b>${highestTx.timestamp}</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `<b>Metrik Riset (${label})</b>`,
      `Avg Whale Score: <b>${avgScore}/100</b>`,
      `Avg Impact Harga: <b>${avgImpact}%</b>`,
      `Uptime System: <b>${uptimeH} Jam</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');

    const b24h = period === '24h' ? '⚡ 24 Jam •' : '⚡ 24 Jam';
    const b7d  = period === '7d'  ? '📅 7 Hari •' : '📅 7 Hari';
    const b30d = period === '30d' ? '🗓️ 30 Hari •' : '🗓️ 30 Hari';
    const ball = period === 'all' ? '🌐 Semua •' : '🌐 Semua';

    const keyboard = {
      inline_keyboard: [
        [
          { text: b24h, callback_data: 'stats_filter_24h' },
          { text: b7d,  callback_data: 'stats_filter_7d' },
          { text: b30d, callback_data: 'stats_filter_30d' },
          { text: ball, callback_data: 'stats_filter_all' }
        ],
        [
          { text: '🖼️ Grafik Statistik', callback_data: 'research_chart' },
          { text: '📄 Laporan PDF/Teks', callback_data: 'export_pdf' }
        ],
        [
          { text: '🔄 Refresh', callback_data: `stats_filter_${period}` },
          { text: '📤 Export Excel', callback_data: 'export_menu' }
        ],
        [{ text: '⬅️ Kembali', callback_data: 'nav_main' }]
      ]
    };

    await this.editMsg(chatId, msgId, msgText, keyboard);
    if (query) {
      this.bot.answerCallbackQuery(query.id, { text: `Filter statistik: ${label}`, show_alert: false }).catch(() => {});
    }
  }

  async editMsg(chatId, msgId, text, keyboard) {
    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (err) {
      if (err.message.includes('message is not modified')) return;
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      }).catch(() => {});
    }
  }
}

module.exports = { CallbackHandler };
