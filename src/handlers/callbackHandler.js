// src/handlers/callbackHandler.js
// Main callback handler untuk semua inline buttons

const { TokenHandler } = require('./tokenHandler');
const { ThresholdHandler } = require('./thresholdHandler');
const { RiskHandler } = require('./riskHandler');
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
    const user = this.subscribers.get(chatId, { name: query.from.first_name });
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
        this.menus.buildMainMenu()
      );
    }

    if (data === 'nav_dashboard') {
      const stats = this.appBot.getStats();
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;
      return this.editMsg(chatId, msgId,
        `📊 <b>Dashboard</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status Bot: <b>Online</b>\n👥 Subscriber Aktif: <b>${stats.active}</b>\n👀 Token Dipantau: <b>${tokenCount}</b>\n🔔 Alert Hari Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━`,
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

    if (data === 'nav_risk') {
      const labels = { ALL: 'Conservative', HIGH_EXTREME: 'Balanced', EXTREME_ONLY: 'Aggressive' };
      return this.editMsg(chatId, msgId,
        `⚠️ <b>Risk Filter</b>\n\nCurrent Risk Level: <b>${labels[user.riskFilter || 'ALL']}</b>\n\nChoose the minimum risk alert level to receive:`,
        this.menus.buildRiskFilterMenu()
      );
    }

    if (data === 'nav_help') {
      return this.editMsg(chatId, msgId,
        `❓ <b>Bantuan</b>\n\n<b>Tentang Sistem</b>\nBot ini memantau aktivitas transaksi whale pada jaringan Ethereum secara real-time menggunakan data on-chain dari liquidity pool DEX.\n\n<b>Fitur Utama</b>\n• Deteksi transaksi whale\n• Monitoring UNI, LINK, dan PEPE\n• Analisis nilai transaksi dalam USD\n• Perhitungan Liquidity Impact\n• Skor aktivitas whale\n\n<b>Cara Penggunaan</b>\n1. Tambahkan token ke Watchlist\n2. Atur Threshold deteksi\n3. Aktifkan monitoring\n4. Terima notifikasi saat whale terdeteksi\n\n<b>Kontak</b>\nAdministrator Sistem`,
        this.menus.buildHelpMenu()
      );
    }

    // ——— BACK COMPATIBILITY ———
    if (data === 'menu_back') {
      const tokenCount = user.tokens ? user.tokens.length : 0;
      const alertsToday = user.alertCount || 0;
      return this.editMsg(chatId, msgId,
        `🐋 <b>Whale Intelligence Bot</b>\n\nReal-time Ethereum Whale Monitoring\n\n━━━━━━━━━━━━━━━━━━━━\n\n📡 Status: <b>Online</b>\n👀 Watchlist: <b>${tokenCount} Token</b>\n🔔 Alert Hari Ini: <b>${alertsToday}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\nPilih menu:`,
        this.menus.buildMainMenu()
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

    if (data === 'menu_risk') {
      const labels = { ALL: 'Semua', HIGH_EXTREME: 'HIGH & EXTREME', EXTREME_ONLY: 'EXTREME saja' };
      return this.editMsg(chatId, msgId,
        `🔔 <b>Filter Level Risiko</b>\n\nFilter aktif: <b>${labels[user.riskFilter]}</b>\n\nPilih level risiko yang ingin kamu terima:`,
        RiskHandler.buildMenu(user)
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

    // ——— RISK HANDLERS ———
    if (data.startsWith('risk_') && data !== 'risk_confirm') {
      const riskVal = data.replace('risk_', '');
      RiskHandler.handleSelect(user, riskVal);
      this.subscribers.set(chatId, user);
      return this.bot.editMessageReplyMarkup(
        RiskHandler.buildMenu(user),
        { chat_id: chatId, message_id: msgId }
      ).catch(() => {});
    }

    if (data === 'risk_confirm') {
      this.subscribers.set(chatId, user);
      return this.editMsg(chatId, msgId,
        `✅ <b>Filter Risiko Tersimpan!</b>\n\nFilter aktif: <b>${RiskHandler.getLabelText(user.riskFilter)}</b>\n\nKembali ke menu utama:`,
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
