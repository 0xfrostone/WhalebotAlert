// src/bot.js
// Bot Telegram Interaktif — orchestrator utama

const TelegramBot = require('node-telegram-bot-api');
const { WatchlistStore } = require('./storage/watchlistStore');
const { MaintenanceStore } = require('./storage/maintenanceStore');
const { MaintenanceService } = require('./services/maintenanceService');
const { CallbackHandler } = require('./handlers/callbackHandler');
const { setupStartCommand } = require('./commands/start');
const { setupStopCommand } = require('./commands/stop');
const { setupHelpCommand } = require('./commands/help');
const { setupStatusCommand } = require('./commands/status');
const { setupMaintenanceCommand } = require('./commands/maintenance');
const { TokenHandler } = require('./handlers/tokenHandler');
const { ThresholdHandler } = require('./handlers/thresholdHandler');
const { RiskHandler } = require('./handlers/riskHandler');
const { createStatusIcon, formatUSDLog, debugFormatUSD } = require('./utils/formatter');
const { ResearchHandler } = require('./handlers/researchHandler');
const { setupResearchCommand } = require('./commands/research');
const { setupTestAlertCommand } = require('./commands/testalert');

class InteractiveWhaleBot {
  constructor(token) {
    this.bot = new TelegramBot(token, {
      polling: {
        interval: 0,
        autoStart: true,
        params: {
          timeout: 10,
          allowed_updates: JSON.stringify(['message', 'callback_query'])
        }
      }
    });

    // Initialize stores
    this.watchlistStore = new WatchlistStore();
    this.maintenanceStore = new MaintenanceStore();
    this.maintenanceService = new MaintenanceService(
      this.maintenanceStore,
      this.watchlistStore,
      this.bot
    );

    // Make services available globally
    global.maintenanceService = this.maintenanceService;
    global.botMenus = {
      buildMainMenu: this.buildMainMenu.bind(this),
      buildDashboardMenu: this.buildDashboardMenu.bind(this),
      buildSettingsMenu: this.buildSettingsMenu.bind(this),
      buildWatchlistMenu: this.buildWatchlistMenu.bind(this),
      buildThresholdMenu: this.buildThresholdMenu.bind(this),
      buildRiskFilterMenu: this.buildRiskFilterMenu.bind(this),
      buildHelpMenu: this.buildHelpMenu.bind(this)
    };

    this.setupCommands();
    this.setupCallbackHandler();
    this.setupResearchHandler();

    console.log('🤖 Bot interaktif aktif!');
    if (this.maintenanceService.isActive()) {
      console.log(`⚠️ MAINTENANCE MODE AKTIF — ${this.maintenanceService.getState().reason}`);
    }
  }

  setupCommands() {
    setupStartCommand(this.bot, this.watchlistStore);
    setupStopCommand(this.bot, this.watchlistStore);
    setupHelpCommand(this.bot);
    setupStatusCommand(this.bot, this.watchlistStore);
    setupMaintenanceCommand(this.bot);
    setupResearchCommand(this.bot);
    setupTestAlertCommand(this.bot, this.watchlistStore);
    console.log('🧪 /testalert command registered (temporary debug command)');
  }

  setupCallbackHandler() {
    const callbackHandler = new CallbackHandler(
      this.bot,
      this.watchlistStore,
      this.maintenanceService,
      global.botMenus
    );
    callbackHandler.setup();
  }

  setupResearchHandler() {
    const researchHandler = new ResearchHandler(this.bot);
    researchHandler.setup();
  }

  buildMainMenu() {
    return {
      inline_keyboard: [
        [
          { text: '📊 Dashboard', callback_data: 'nav_dashboard' }
        ],
        [
          { text: '⚙️ Settings', callback_data: 'nav_settings' }
        ],
        [
          { text: '❓ Help', callback_data: 'nav_help' }
        ]
      ]
    };
  }

  buildDashboardMenu(user) {
    const trackingBtn = user.active 
      ? { text: '⏹ Stop Tracking', callback_data: 'tracking_stop' }
      : { text: '▶️ Start Tracking', callback_data: 'tracking_start' };

    return {
      inline_keyboard: [
        [ trackingBtn ],
        [ { text: '📜 Alert History', callback_data: 'research_alerts_list' } ],
        [ { text: '⬅️ Back', callback_data: 'nav_main' } ]
      ]
    };
  }

  buildSettingsMenu() {
    return {
      inline_keyboard: [
        [ { text: '👀 Watchlist', callback_data: 'nav_watchlist' } ],
        [ { text: '🎯 Threshold', callback_data: 'nav_threshold' } ],
        [ { text: '⚠️ Risk Filter', callback_data: 'nav_risk' } ],
        [ { text: '⬅️ Back', callback_data: 'nav_main' } ]
      ]
    };
  }

  buildWatchlistMenu() {
    return {
      inline_keyboard: [
        [
          { text: '➕ Add Token', callback_data: 'menu_add_token' },
          { text: '➖ Remove Token', callback_data: 'menu_remove_token' }
        ],
        [ { text: '📋 View Watchlist', callback_data: 'menu_my_watchlist' } ],
        [ { text: '⬅️ Back', callback_data: 'nav_settings' } ]
      ]
    };
  }

  buildThresholdMenu() {
    // Current threshold is handled by text, menu just provides the input options
    // To match user request, we link to the existing threshold input system but clean up the menu
    return {
      inline_keyboard: [
        [ { text: '💰 Set Min USD', callback_data: 'menu_threshold_usd' } ], // Note: Existing is just 'menu_threshold'
        [ { text: '⬅️ Back', callback_data: 'nav_settings' } ]
      ]
    };
  }

  buildRiskFilterMenu() {
    return {
      inline_keyboard: [
        [ { text: '🟢 Conservative', callback_data: 'risk_conservative' } ],
        [ { text: '🟡 Balanced', callback_data: 'risk_balanced' } ],
        [ { text: '🔴 Aggressive', callback_data: 'risk_aggressive' } ],
        [ { text: '⬅️ Back', callback_data: 'nav_settings' } ]
      ]
    };
  }

  buildHelpMenu() {
    return {
      inline_keyboard: [
        [ { text: '⬅️ Back', callback_data: 'nav_main' } ]
      ]
    };
  }

  async broadcast(alertData) {
    // Skip broadcast jika maintenance aktif
    if (this.maintenanceService.isActive()) {
      console.log(`⏭️ Alert diabaikan — maintenance mode aktif`);
      return 0;
    }

    const { tokenSymbol, usdValue, riskCategory } = alertData;
    let sent = 0;
    let filtered = 0;
    let totalSubs = 0;

    console.log(`\n🔊 [BROADCAST] Starting for ${tokenSymbol} ${alertData.direction} | USD: ${formatUSDLog(usdValue)} | Risk: ${riskCategory}`);
    
    // === DEBUG: Dump subscriber state ===
    const allSubs = this.watchlistStore.getAllActiveSubscribers();
    console.log(`   📋 [BROADCAST] Subscriber store loaded: ${allSubs.length} active subscribers found`);
    if (allSubs.length === 0) {
      console.log(`   ⚠️ [BROADCAST] NO SUBSCRIBERS! Use /start di Telegram untuk subscribe.`);
      return 0;
    }
    
    // Log ringkasan setiap subscriber sebelum filtering
    for (const user of allSubs) {
      const tokensArr = user.tokens || [];
      console.log(`   👤 Sub ${user.chatId} (${user.name}): active=${user.active} | tokens=[${tokensArr.join(',')}] | threshold=${user.threshold} | riskFilter=${user.riskFilter}`);
    }
    console.log(`   ---`);

    for (const user of allSubs) {
      const chatId = user.chatId;
      totalSubs++;
      
      // === FILTER: active ===
      if (!user.active) {
        filtered++;
        console.log(`   ❌ [F1-ACTIVE] Skip ${chatId} (${user.name}): active=${user.active}`);
        continue;
      }
      console.log(`   ✅ [F1-ACTIVE] ${chatId} (${user.name}): active=true`);
      
      // === FILTER: token watchlist ===
      const hasToken = user.tokens instanceof Set ? user.tokens.has(tokenSymbol) : (Array.isArray(user.tokens) ? user.tokens.includes(tokenSymbol) : false);
      if (!hasToken) {
        filtered++;
        const tokensArr = user.tokens instanceof Set ? [...user.tokens] : (Array.isArray(user.tokens) ? user.tokens : []);
        console.log(`   ❌ [F2-TOKEN] Skip ${chatId} (${user.name}): token "${tokenSymbol}" NOT in watchlist [${tokensArr.join(',')}]`);
        continue;
      }
      console.log(`   ✅ [F2-TOKEN] ${chatId} (${user.name}): token "${tokenSymbol}" found in watchlist`);
      
      // === FILTER: USD threshold ===
      if (usdValue < user.threshold) {
        filtered++;
        console.log(`   ❌ [F3-THRESHOLD] Skip ${chatId} (${user.name}): ${debugFormatUSD(usdValue, user.threshold)}`);
        continue;
      }
      console.log(`   ✅ [F3-THRESHOLD] ${chatId} (${user.name}): ${debugFormatUSD(usdValue, user.threshold)}`);

      // === FILTER: risk level ===
      if (user.riskFilter === 'EXTREME_ONLY' && riskCategory !== 'EXTREME') {
        filtered++;
        console.log(`   ❌ [F4-RISK] Skip ${chatId} (${user.name}): riskFilter=${user.riskFilter} but alert is ${riskCategory}`);
        continue;
      }
      if (user.riskFilter === 'HIGH_EXTREME' && !['HIGH', 'EXTREME'].includes(riskCategory)) {
        filtered++;
        console.log(`   ❌ [F4-RISK] Skip ${chatId} (${user.name}): riskFilter=${user.riskFilter} but alert is ${riskCategory}`);
        continue;
      }
      console.log(`   ✅ [F4-RISK] ${chatId} (${user.name}): riskFilter=${user.riskFilter} accepts ${riskCategory}`);

      // === ALL FILTERS PASSED — SEND MESSAGE ===
      try {
        console.log(`   📤 [SENDING] Preparing Telegram message for ${chatId} (${user.name})...`);
        const { NotificationService } = require('./services/notifier');
        const message = NotificationService.formatWhaleAlert(alertData);
        console.log(`   📤 [SENDING] Message formatted (${message.length} chars), calling sendMessage...`);

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
        sent++;
        console.log(`   ✅ [SENT] Successfully sent to ${chatId} (${user.name}) — alertCount now: ${user.alertCount}`);
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.watchlistStore.delete(chatId);
          console.log(`   ❌ [ERROR] User ${chatId} removed (blocked/not found): ${err.message}`);
        } else {
          console.log(`   ⚠️ [ERROR] Failed sending to ${chatId}: ${err.message}`);
        }
      }
    }

    console.log(`\n📱 [BROADCAST RESULT] Sent: ${sent}/${totalSubs} | Filtered: ${filtered} | Token: ${tokenSymbol} | USD: ${formatUSDLog(usdValue)} | Risk: ${riskCategory}`);
    if (sent > 0) {
      this.watchlistStore.save();
      console.log(`   💾 Subscriber data saved (alertCount updated)`);
    }
    if (sent === 0 && totalSubs > 0) {
      console.log(`   ⚠️ Semua subscriber di-filter. Kemungkinan penyebab:`);
      console.log(`      - User tidak active (belum klik "Mulai Tracking")`);
      console.log(`      - Token ${tokenSymbol} tidak ada di watchlist user`);
      console.log(`      - USD value ${formatUSDLog(usdValue)} di bawah threshold user`);
      console.log(`      - Risk ${riskCategory} tidak sesuai filter user`);
    }
    if (totalSubs === 0) {
      console.log(`   → No subscribers yet, use /start to subscribe`);
    }

    return sent;
  }

  async broadcastAccumulation(accumulationData) {
    if (this.maintenanceService.isActive()) return 0;
    
    let sent = 0;
    const allSubs = this.watchlistStore.getAllActiveSubscribers();
    
    for (const user of allSubs) {
      const chatId = user.chatId;
      const hasToken = user.tokens && user.tokens.includes(accumulationData.tokenSymbol);
      
      if (!hasToken) continue;
      
      try {
        const { NotificationService } = require('./services/notifier');
        const message = NotificationService.formatAccumulationAlert(accumulationData);
        
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
        sent++;
      } catch (err) {
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          this.watchlistStore.delete(chatId);
        }
      }
    }
    return sent;
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
