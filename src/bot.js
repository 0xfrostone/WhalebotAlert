// src/bot.js
// Interactive Whale Bot — Telegram bot untuk whale alerts

const { TelegramBot } = require('node-telegram-bot-api');
const { formatUSDLog, debugFormatUSD } = require('./utils/formatters');

class InteractiveWhaleBot {
  constructor(token) {
    this.bot = new TelegramBot(token, { polling: false });
    this.watchlistStore = require('./storage/WatchlistStore');
    this.maintenanceService = require('./services/maintenanceService');
  }

  setTokenService(tokenService) {
    this.tokenService = tokenService;
  }

  setListener(listener) {
    this.listener = listener;
  }

  setResearchStore(researchStore) {
    this.researchStore = researchStore;
  }

  async startPolling() {
    this.bot.startPolling();
  }

  async broadcast(alertData) {
    if (this.maintenanceService.isActive()) {
      return [];
    }

    const { tokenSymbol, usdValue, riskCategory } = alertData;
    let sent = 0;
    let filtered = 0;
    let totalSubs = 0;

    const allSubs = this.watchlistStore.getAllActiveSubscribers();
    const sentChatIds = [];

    for (const user of allSubs) {
      const chatId = user.chatId;
      totalSubs++;
      
      // === FILTER: active ===
      if (!user.active) {
        filtered++;
        continue;
      }
      
      // === FILTER: token watchlist ===
      const hasToken = user.tokens instanceof Set ? user.tokens.has(tokenSymbol) : (Array.isArray(user.tokens) ? user.tokens.includes(tokenSymbol) : false);
      if (!hasToken) {
        filtered++;
        continue;
      }
      
      // === FILTER: USD threshold ===
      if (usdValue < user.threshold) {
        filtered++;
        continue;
      }

      // === ALL FILTERS PASSED — SEND MESSAGE ===
      try {
        const { NotificationService } = require('./services/notifier');
        const isSimpleMode = !!user.deteksiMode;
        const message = isSimpleMode
          ? NotificationService.formatSimpleDetectionAlert(alertData)
          : NotificationService.formatWhaleAlert(alertData);

        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[
              { text: '🔍 Etherscan', url: `https://etherscan.io/tx/${alertData.txHash}` },
              { text: '⏹️ Stop Alert', callback_data: 'tracking_stop' }
            ]]
          }
        });

        user.alertCount = (user.alertCount || 0) + 1;
        this.watchlistStore.saveSettings(chatId, { alertCount: user.alertCount });
        sentChatIds.push(chatId);
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.watchlistStore.delete(chatId);
        }
      }
    }

    return sentChatIds;
  }

  async broadcastAccumulation(accumulationData) {
    if (this.maintenanceService.isActive()) return [];
    
    const sentChatIds = [];
    const allSubs = this.watchlistStore.getAllActiveSubscribers();
    
    for (const user of allSubs) {
      const chatId = user.chatId;
      const hasToken = user.tokens instanceof Set ? user.tokens.has(accumulationData.tokenSymbol) : (Array.isArray(user.tokens) ? user.tokens.includes(accumulationData.tokenSymbol) : false);
      
      if (!hasToken) continue;
      
      const userThreshold = user.threshold || 50000;
      if (accumulationData.totalVolume < userThreshold) {
        continue;
      }
      
      try {
        const { NotificationService } = require('./services/notifier');
        const message = NotificationService.formatAccumulationAlert(accumulationData);
        
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
        sentChatIds.push(chatId);
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.watchlistStore.delete(chatId);
        }
      }
    }
    return sentChatIds;
  }

  getStats() {
    const all = this.watchlistStore.getAll();
    const activeSubs = this.watchlistStore.getAllActiveSubscribers();
    return {
      total: Object.keys(all).length,
      active: activeSubs.length
    };
  }
}

module.exports = { InteractiveWhaleBot };
