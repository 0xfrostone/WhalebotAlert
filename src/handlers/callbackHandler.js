// src/handlers/callbackHandler.js
// Main callback handler untuk semua inline buttons

const fs = require('fs');
const path = require('path');
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
      
      const rs = this.appBot.researchStore.getStats();
      const startDate = new Date(rs.monitoring_start_date).toLocaleString('id-ID');
      const lastDate = new Date().toLocaleString('id-ID');

      // Token string builder
      let tokensStr = '';
      if (rs.token_stats && Object.keys(rs.token_stats).length > 0) {
        for (const [sym, stats] of Object.entries(rs.token_stats)) {
          tokensStr += `\n${sym}:\nBUY ${stats.BUY}\nSELL ${stats.SELL}\n`;
        }
      } else {
        tokensStr = '\nBelum ada data token.\n';
      }

      const h_token = rs.highest_transaction.token || '-';
      const h_amount = formatUSD(rs.highest_transaction.amount || 0);
      const h_time = rs.highest_transaction.timestamp ? new Date(rs.highest_transaction.timestamp).toLocaleString('id-ID') : '-';

      const avg_score = rs.average_score.toFixed(1);
      const avg_impact = (rs.average_impact * 100).toFixed(5);
      
      const uptimeH = ((Date.now() - new Date(rs.monitoring_start_date).getTime()) / 3_600_000).toFixed(1);

      const msgText = `📈 <b>Statistik Penelitian</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Periode Monitoring</b>\nMulai:\n${startDate}\n\nTerakhir:\n${lastDate}\n\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Aktivitas Whale</b>\n\nTotal Event Masuk:\n<b>${rs.total_events}</b>\n\nTotal Whale Terdeteksi:\n<b>${rs.total_whale_alerts}</b>\n\nTotal Alert Dikirim:\n<b>${rs.total_alerts_sent}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Aktivitas BUY / SELL</b>\n\nBUY:\n<b>${rs.buy_count}</b>\n\nSELL:\n<b>${rs.sell_count}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Per Token</b>\n${tokensStr}\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Transaksi Terbesar</b>\n\nToken:\n<b>${h_token}</b>\n\nNilai:\n<b>${h_amount}</b>\n\nWaktu:\n<b>${h_time}</b>\n\n━━━━━━━━━━━━━━━━━━━━\n\n<b>Metrik Sistem</b>\n\nRata-rata Whale Score:\n<b>${avg_score}</b>\n\nRata-rata Liquidity Impact:\n<b>${avg_impact}%</b>\n\nMonitoring Uptime:\n<b>${uptimeH} jam</b>\n\n━━━━━━━━━━━━━━━━━━━━`;

      return this.editMsg(chatId, msgId, msgText, {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'refresh_research_stats' }],
          [{ text: '📤 Export Data', callback_data: 'export_menu' }],
          [{ text: '⬅️ Kembali', callback_data: 'nav_main' }]
        ]
      });
    }

    if (data === 'export_menu') {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });

      return this.editMsg(chatId, msgId, `📤 <b>Export Data</b>\n\nPilih jenis export:`, {
        inline_keyboard: [
          [{ text: '📄 Dataset Penelitian', callback_data: 'export_dataset' }],
          [{ text: '📊 Ringkasan Penelitian', callback_data: 'export_summary' }],
          [{ text: '⬅️ Kembali', callback_data: 'nav_research_stats' }]
        ]
      });
    }

    if (data === 'export_dataset') {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });
      
      try {
        const StorageManager = require('../storage/StorageManager');
        const alerts = StorageManager.readJSON('alerts.json', []);
        
        if (alerts.length === 0) {
          return this.bot.sendMessage(chatId, 'Belum ada data alert untuk di-export.');
        }

        let csvContent = 'No,Date,Time,Token,Action,Transaction Value (USD),Token Amount,Whale Score,Liquidity Impact (%),DEX,Wallet Address,Transaction Hash\n';
        
        // Reverse array to start from oldest (index 1) to newest
        const sortedAlerts = [...alerts].reverse();

        sortedAlerts.forEach((a, i) => {
          const dateObj = new Date(a.timestamp);
          const dateStr = dateObj.toISOString().split('T')[0];
          const timeStr = dateObj.toTimeString().split(' ')[0];
          
          const token = a.tokenSymbol;
          const action = a.direction;
          const usd = (a.usdValue || 0).toFixed(2);
          
          // Token amount extraction
          let tokenAmountStr = '0';
          if (action === 'BUY' && a.amountOut) {
            tokenAmountStr = Number(a.amountOut).toFixed(2);
          } else if (action === 'SELL' && a.amountIn) {
            tokenAmountStr = Number(a.amountIn).toFixed(2);
          }
          
          const score = a.whaleScore.total;
          const impact = (a.liquidityImpact * 100).toFixed(4);
          const dex = a.pool ? a.pool.dex : '-';
          const wallet = a.wallet;
          const txHash = a.txHash || '-';
          
          csvContent += `${i + 1},${dateStr},${timeStr},${token},${action},${usd},${tokenAmountStr},${score},${impact},${dex},${wallet},${txHash}\n`;
        });

        const today = new Date().toISOString().split('T')[0];
        const filename = `whale_research_dataset_${today}.csv`;
        const csvPath = StorageManager.getResearchPath(filename);
        fs.writeFileSync(csvPath, csvContent, 'utf8');

        await this.bot.sendDocument(chatId, csvPath, {
          caption: '📄 <b>Dataset Penelitian</b>\n\nSeluruh data transaksi whale mentah untuk analisis.',
          parse_mode: 'HTML'
        });
        
        return this.bot.answerCallbackQuery(query.id, { text: 'Dataset berhasil dikirim!', show_alert: false });
      } catch (err) {
        console.error('Export Dataset error:', err);
        return this.bot.sendMessage(chatId, `❌ Gagal export dataset: ${err.message}`);
      }
    }

    if (data === 'export_summary') {
      if (!isAdmin) return this.bot.answerCallbackQuery(query.id, { text: 'Akses ditolak', show_alert: true });
      
      try {
        const rs = this.appBot.researchStore.getStats();
        const alerts = StorageManager.readJSON('alerts.json', []);

        const startDate = new Date(rs.monitoring_start_date).toLocaleString('id-ID');
        const lastDate = new Date().toLocaleString('id-ID');
        const uptimeH = ((Date.now() - new Date(rs.monitoring_start_date).getTime()) / 3_600_000).toFixed(1);
        const uptimeD = (uptimeH / 24).toFixed(1);

        let csvContent = 'Monitoring Information\n';
        csvContent += `Monitoring Start,${startDate}\n`;
        csvContent += `Monitoring End,${lastDate}\n`;
        csvContent += `Monitoring Duration,${uptimeH} Hours (${uptimeD} Days)\n\n`;

        csvContent += 'Whale Detection Summary\n';
        csvContent += `Total Events Received,${rs.total_events}\n`;
        csvContent += `Total Whale Detected,${rs.total_whale_alerts}\n`;
        csvContent += `Total Alerts Sent,${rs.total_alerts_sent}\n`;
        csvContent += `BUY Count,${rs.buy_count}\n`;
        csvContent += `SELL Count,${rs.sell_count}\n\n`;

        csvContent += 'Token Activity Summary\n';
        csvContent += 'Token,BUY,SELL,TOTAL\n';
        let mostActiveToken = { name: '-', count: 0 };
        if (rs.token_stats && Object.keys(rs.token_stats).length > 0) {
          for (const [sym, stats] of Object.entries(rs.token_stats)) {
            const total = stats.BUY + stats.SELL;
            if (total > mostActiveToken.count) {
              mostActiveToken = { name: sym, count: total };
            }
            csvContent += `${sym},${stats.BUY},${stats.SELL},${total}\n`;
          }
        }
        csvContent += '\n';

        csvContent += 'Largest Transactions (Top 10)\n';
        csvContent += 'Rank,Date,Token,Action,Value (USD),Whale Score\n';
        const sortedAlerts = [...alerts].sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0)).slice(0, 10);
        sortedAlerts.forEach((a, i) => {
          const dateStr = new Date(a.timestamp).toLocaleString('id-ID');
          const token = a.tokenSymbol;
          const action = a.direction;
          const usd = (a.usdValue || 0).toFixed(2);
          const score = a.whaleScore.total;
          csvContent += `${i + 1},${dateStr},${token},${action},${usd},${score}\n`;
        });
        csvContent += '\n';

        const highestScore = alerts.length > 0 ? Math.max(...alerts.map(a => a.whaleScore.total)) : 0;
        const avgScore = rs.average_score.toFixed(1);
        const highestImpact = alerts.length > 0 ? Math.max(...alerts.map(a => a.liquidityImpact)) : 0;
        const avgImpact = rs.average_impact;
        const avgValue = rs.total_whale_alerts > 0 ? (alerts.reduce((acc, a) => acc + (a.usdValue||0), 0) / rs.total_whale_alerts) : 0;

        csvContent += 'Whale Metrics\n';
        csvContent += `Average Whale Score,${avgScore}\n`;
        csvContent += `Highest Whale Score,${highestScore}\n`;
        csvContent += `Average Liquidity Impact (%),${(avgImpact * 100).toFixed(4)}%\n`;
        csvContent += `Highest Liquidity Impact (%),${(highestImpact * 100).toFixed(4)}%\n`;
        csvContent += `Average Transaction Value (USD),${avgValue.toFixed(2)}\n`;
        csvContent += `Highest Transaction Value (USD),${(rs.highest_transaction.amount || 0).toFixed(2)}\n\n`;

        csvContent += 'Most Active Token\n';
        csvContent += `Token Name,${mostActiveToken.name}\n`;
        csvContent += `Total Transactions,${mostActiveToken.count}\n`;
        const activePct = rs.total_whale_alerts > 0 ? ((mostActiveToken.count / rs.total_whale_alerts) * 100).toFixed(2) : 0;
        csvContent += `Percentage Contribution,${activePct}%\n\n`;

        const totalWatchlistTokens = Object.keys(this.appBot.tokenService?.tokenStore?.data || {}).length;
        const avgAlertsDay = uptimeD > 0 ? (rs.total_alerts_sent / uptimeD).toFixed(2) : 0;

        csvContent += 'System Performance\n';
        csvContent += `Monitoring Uptime,${uptimeH} Hours\n`;
        csvContent += `Total Watchlist Tokens,${totalWatchlistTokens}\n`;
        csvContent += `Average Alerts Per Day,${avgAlertsDay}\n`;

        const today = new Date().toISOString().split('T')[0];
        const filename = `whale_research_summary_${today}.csv`;
        const csvPath = StorageManager.getResearchPath(filename);
        fs.writeFileSync(csvPath, csvContent, 'utf8');

        await this.bot.sendDocument(chatId, csvPath, {
          caption: '📊 <b>Ringkasan Penelitian</b>\n\nExecutive summary yang siap disajikan untuk laporan Bab 4.',
          parse_mode: 'HTML'
        });
        
        return this.bot.answerCallbackQuery(query.id, { text: 'Summary berhasil dikirim!', show_alert: false });
      } catch (err) {
        console.error('Export Summary error:', err);
        return this.bot.sendMessage(chatId, `❌ Gagal export summary: ${err.message}`);
      }
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
