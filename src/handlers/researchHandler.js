// src/handlers/researchHandler.js
// Handler untuk research menu callbacks (Riwayat Alert & Statistik)

const fs = require('fs');
const { formatUSD } = require('../utils/formatter');

class ResearchHandler {
  constructor(bot) {
    this.bot = bot;
  }

  setup() {
    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const data = query.data;

      try {
        if (data === 'research_alerts_list') {
          await this.showAlertsList(chatId, query.message.message_id);
        } else if (data.startsWith('research_alert_detail_')) {
          const alertId = parseInt(data.replace('research_alert_detail_', ''));
          await this.showAlertDetail(chatId, alertId, query.message.message_id);
        } else if (data === 'research_statistics') {
          await this.showStatistics(chatId, query.message.message_id);
        }

        await this.bot.answerCallbackQuery(query.id);
      } catch (err) {
        console.error('Error in research handler:', err.message);
        await this.bot.answerCallbackQuery(query.id, {
          text: '❌ Error',
          show_alert: false
        });
      }
    });
  }

  async showAlertsList(chatId, messageId) {
    try {
      const StorageManager = require('../storage/StorageManager');
      const recentAlerts = StorageManager.readUserJSON(chatId, 'alerts.json', []).slice(0, 10);

      if (recentAlerts.length === 0) {
        const text = '📜 <b>RIWAYAT ALERT</b>\n\n❌ Belum ada alert terdeteksi.';
        await this.bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        });
        return;
      }

      const alertText = recentAlerts.map((alert, idx) => {
        const riskEmoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️' };
        return `${idx + 1}. ${riskEmoji[alert.riskCategory] || '📍'} <b>${alert.token}</b> | ${alert.transactionType} | $${alert.valueUSD} | Score: ${alert.whaleScore}`;
      }).join('\n');

      const text = `📜 <b>RIWAYAT ALERT (10 Terakhir)</b>\n\n${alertText}\n\n💾 Klik alert untuk detail lengkap atau export data.`;

      const buttons = recentAlerts.slice(0, 5).map((alert, idx) => [
        {
          text: `#${idx + 1} ${alert.token}`,
          callback_data: `research_alert_detail_${alert.id}`
        }
      ]);

      buttons.push([
        { text: '📊 Export CSV', callback_data: 'research_export_csv' },
        { text: '📈 Statistik', callback_data: 'research_statistics' }
      ]);

      buttons.push([
        { text: '⬅️ Kembali ke Menu', callback_data: 'menu_back' }
      ]);

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (err) {
      console.error('Error showing alerts list:', err.message);
    }
  }

  async showAlertDetail(chatId, alertId, messageId) {
    try {
      const StorageManager = require('../storage/StorageManager');
      const recentAlerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
      const alert = recentAlerts.find(a => a.id === alertId);

      if (!alert) {
        await this.bot.editMessageText('❌ Alert tidak ditemukan', {
          chat_id: chatId,
          message_id: messageId,
        });
        return;
      }

      const riskEmoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️' };
      const dirEmoji = alert.transactionType === 'BUY' ? '🟢' : '🔴';

      const text = [
        `${riskEmoji[alert.riskCategory] || '📍'} <b>DETAIL ALERT #${alert.id}</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `💎 Token: <b>$${alert.token}</b>`,
        `${dirEmoji} Tipe: <b>${alert.transactionType}</b>`,
        `⏰ Waktu: ${alert.dateTime}`,
        ``,
        `<b>💰 NILAI TRANSAKSI</b>`,
        `USD: <b>${formatUSD(alert.valueUSD)}</b>`,
        `ETH: ${alert.valueETH.toFixed(4)}`,
        ``,
        `<b>📊 WHALE SCORE: ${alert.whaleScore}/100</b>`,
        `├ TX Size: ${alert.whaleScoreBreakdown.txSize}`,
        `├ LP Impact: ${alert.whaleScoreBreakdown.lpImpact}`,
        `├ Frequency: ${alert.whaleScoreBreakdown.frequency}`,
        `├ Smart Money: ${alert.whaleScoreBreakdown.smartMoney}`,
        `└ Wallet Rep: ${alert.whaleScoreBreakdown.walletRep}`,
        ``,
        `<b>⚠️ RISK & IMPACT</b>`,
        `Risk: <b>${alert.riskCategory}</b>`,
        `LP Impact: ${alert.liquidityImpactPct.toFixed(2)}%`,
        `Pool TVL: ${formatUSD(alert.poolTVL)}`,
        ``,
        `<b>🔗 DETAILS</b>`,
        `DEX: ${alert.dex}`,
        `Pool Ver: ${alert.metadata.poolVersion}`,
        `TX: <code>${alert.txHash.slice(0, 20)}...</code>`,
      ].join('\n');

      const buttons = [
        [
          { text: '🔍 Token Analysis', callback_data: `research_token_filter_${alert.token}` },
          { text: '← Back', callback_data: 'research_alerts_list' }
        ]
      ];

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (err) {
      console.error('Error showing alert detail:', err.message);
    }
  }

  async showStatistics(chatId, messageId) {
    try {
      const StorageManager = require('../storage/StorageManager');
      const userAlerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
      
      const stats = {
        totalAlerts: userAlerts.length,
        tokenFrequency: {},
        alertsByType: { BUY: 0, SELL: 0 },
        highestVolumeUSD: 0,
        avgVolumeUSD: 0
      };

      let sumUSD = 0;
      for (const a of userAlerts) {
        if (a.transactionType === 'BUY') stats.alertsByType.BUY++;
        else if (a.transactionType === 'SELL') stats.alertsByType.SELL++;
        
        stats.tokenFrequency[a.token] = (stats.tokenFrequency[a.token] || 0) + 1;
        
        if (a.valueUSD > stats.highestVolumeUSD) stats.highestVolumeUSD = a.valueUSD;
        sumUSD += (a.valueUSD || 0);
      }
      stats.avgVolumeUSD = userAlerts.length > 0 ? (sumUSD / userAlerts.length) : 0;

      const sortedTokens = Object.entries(stats.tokenFrequency || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      let topTokensText = '';
      if (sortedTokens.length > 0) {
        topTokensText = sortedTokens.map(([token, count], idx) => `${idx + 1}. ${token} (${count})`).join('\n');
      } else {
        topTokensText = 'Tidak ada data';
      }

      const totalAlerts = stats.totalAlerts || 0;
      const buyCount = stats.alertsByType?.BUY || 0;
      const sellCount = stats.alertsByType?.SELL || 0;

      const highestUsd = formatUSD(stats.highestVolumeUSD || 0);
      const avgUsd = formatUSD(stats.avgVolumeUSD || 0);

      const avgScore = (stats.avgWhaleScore || 0).toFixed(1);
      const maxScore = stats.highestWhaleScore || 0;

      const text = [
        `📈 <b>Statistik Alert</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `Total Alert:`,
        `<b>${totalAlerts}</b>`,
        ``,
        `BUY:`,
        `<b>${buyCount}</b>`,
        ``,
        `SELL:`,
        `<b>${sellCount}</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>Token Teraktif</b>`,
        ``,
        topTokensText,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>Nilai Transaksi</b>`,
        ``,
        `Tertinggi:`,
        `<b>${highestUsd}</b>`,
        ``,
        `Rata-rata:`,
        `<b>${avgUsd}</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `<b>Whale Score</b>`,
        ``,
        `Rata-rata:`,
        `<b>${avgScore}</b>`,
        ``,
        `Tertinggi:`,
        `<b>${maxScore}</b>`,
        `━━━━━━━━━━━━━━━━━━━━`
      ].join('\n');

      const buttons = [
        [
          { text: '🔄 Refresh', callback_data: 'research_statistics' },
          { text: '📤 Export CSV', callback_data: 'research_export_csv' }
        ],
        [
          { text: '⬅️ Kembali', callback_data: 'research_alerts_list' }
        ]
      ];

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (err) {
      console.error('[STATISTICS ERROR]', err);
      try {
        await this.bot.sendMessage(chatId, '❌ Gagal membuka statistik.');
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  }

}

module.exports = { ResearchHandler };
