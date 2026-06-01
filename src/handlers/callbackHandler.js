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
  constructor(bot, subscriberStore, maintenanceService, botMenus) {
    this.bot = bot;
    this.subscribers = subscriberStore;
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

    // ——— NAVIGASI ———
    if (data === 'menu_back') {
      return this.editMsg(chatId, msgId,
        '🐳 <b>Menu Utama</b>\nPilih opsi di bawah:',
        this.menus.buildMainMenu(user, this.maintenance)
      );
    }

    // ——— MENU ITEMS ———
    if (data === 'menu_token') {
      const sel = user.tokens.size ? [...user.tokens].map(t => `$${t}`).join(', ') : 'Belum ada';
      return this.editMsg(chatId, msgId,
        `🎯 <b>Pilih Token yang Dipantau</b>\n\nToken aktif: <b>${sel}</b>\n\nCentang/hapus centang token:`,
        TokenHandler.buildMenu(user)
      );
    }

    if (data === 'menu_threshold') {
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

    // ——— TOKEN HANDLERS ———
    if (data.startsWith('token_toggle_')) {
      const token = data.replace('token_toggle_', '');
      TokenHandler.handleToggle(user, token);
      this.subscribers.set(chatId, user);
      return this.bot.editMessageReplyMarkup(
        TokenHandler.buildMenu(user),
        { chat_id: chatId, message_id: msgId }
      ).catch(() => {});
    }

    if (data === 'token_all') {
      TokenHandler.handleSelectAll(user);
      this.subscribers.set(chatId, user);
      return this.bot.editMessageReplyMarkup(
        TokenHandler.buildMenu(user),
        { chat_id: chatId, message_id: msgId }
      ).catch(() => {});
    }

    if (data === 'token_none') {
      TokenHandler.handleSelectNone(user);
      this.subscribers.set(chatId, user);
      return this.bot.editMessageReplyMarkup(
        TokenHandler.buildMenu(user),
        { chat_id: chatId, message_id: msgId }
      ).catch(() => {});
    }

    if (data === 'token_confirm') {
      const sel = TokenHandler.getSelectedText(user);
      this.subscribers.set(chatId, user);
      return this.editMsg(chatId, msgId,
        `✅ <b>Token Tersimpan!</b>\n\nMemantau: ${sel}\n\nKembali ke menu utama:`,
        this.menus.buildMainMenu(user, this.maintenance)
      );
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
      if (user.tokens.size === 0) {
        return this.bot.answerCallbackQuery(query.id, {
          text: '⚠️ Pilih minimal 1 token dulu!',
          show_alert: true
        });
      }
      user.active = true;
      this.subscribers.set(chatId, user);

      const tokenList = [...user.tokens].map(t => `• <b>$${t}</b>`).join('\n');
      const riskLabels = { ALL: 'Semua level', HIGH_EXTREME: 'HIGH & EXTREME', EXTREME_ONLY: 'EXTREME saja' };

      return this.editMsg(chatId, msgId,
        [
          `🟢 <b>Tracking AKTIF!</b>`,
          ``,
          `Kamu akan menerima alert untuk:`,
          tokenList,
          ``,
          `⚙️ Minimum nilai: <b>${formatUSD(user.threshold)}</b>`,
          `🔔 Filter risiko: <b>${riskLabels[user.riskFilter]}</b>`,
          ``,
          `Alert datang otomatis saat whale terdeteksi.`,
          `Tekan Stop kapanpun untuk jeda.`
        ].join('\n'),
        this.menus.buildMainMenu(user, this.maintenance)
      );
    }

    if (data === 'tracking_stop') {
      user.active = false;
      this.subscribers.set(chatId, user);
      return this.editMsg(chatId, msgId,
        `⏹️ <b>Tracking Dihentikan</b>\n\nKamu tidak akan menerima alert untuk sementara.\n\nTekan "Mulai Tracking" kapanpun untuk melanjutkan.`,
        this.menus.buildMainMenu(user, this.maintenance)
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
