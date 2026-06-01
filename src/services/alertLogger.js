// src/services/alertLogger.js
// Service untuk logging whale alerts ke storage dengan enrichment data

const { AlertStore } = require('../storage/alertStore');
const axios = require('axios');

class AlertLogger {
  constructor() {
    this.alertStore = new AlertStore();
    this.priceCache = new Map();
    this.PRICE_CACHE_TTL = 60000; // 1 minute
  }

  async getTokenPrice(tokenAddress) {
    // Try cache first
    const cached = this.priceCache.get(tokenAddress);
    if (cached && (Date.now() - cached.timestamp) < this.PRICE_CACHE_TTL) {
      return cached.price;
    }

    // Default fallback (in production, integrate with CoinGecko/price oracle)
    return 0;
  }

  async logAlert(alertData, userCount = 0) {
    try {
      // Enrich alert data with additional information
      const enrichedData = {
        ...alertData,
        tokenPrice: alertData.tokenPrice || await this.getTokenPrice(alertData.token),
        ethPrice: alertData.ethPrice || 0,
        userCount: userCount,
      };

      // Save to store (both JSON and CSV)
      const record = this.alertStore.saveAlert(enrichedData);

      // Log to console
      if (process.env.DEBUG_MODE === 'true') {
        console.log(`📝 Alert logged: ${record.token} | ${record.transactionType} | $${record.valueUSD} | Score: ${record.whaleScore}`);
      }

      return record;
    } catch (err) {
      console.error('❌ Error logging alert:', err.message);
      return null;
    }
  }

  getRecentAlerts(limit = 10) {
    return this.alertStore.getRecentAlerts(limit);
  }

  getStatistics() {
    return this.alertStore.getStatistics();
  }

  exportAlerts(filters = {}) {
    return this.alertStore.exportToCSV(filters);
  }

  async generateResearchReport(startDate, endDate) {
    const filters = { startDate, endDate };
    const data = this.alertStore.exportToCSV(filters);

    return {
      period: {
        start: startDate,
        end: endDate,
        totalDays: Math.floor((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)),
      },
      summary: {
        totalAlerts: data.length,
        uniqueTokens: [...new Set(data.map(a => a.token))].length,
        uniqueWallets: [...new Set(data.map(a => a.walletAddress))].length,
      },
      byType: {
        BUY: data.filter(a => a.transactionType === 'BUY').length,
        SELL: data.filter(a => a.transactionType === 'SELL').length,
      },
      byRisk: {
        EXTREME: data.filter(a => a.riskCategory === 'EXTREME').length,
        HIGH: data.filter(a => a.riskCategory === 'HIGH').length,
        MEDIUM: data.filter(a => a.riskCategory === 'MEDIUM').length,
        LOW: data.filter(a => a.riskCategory === 'LOW').length,
      },
      avgWhaleScore: data.length > 0
        ? Math.round((data.reduce((sum, a) => sum + a.whaleScore, 0) / data.length) * 100) / 100
        : 0,
      totalVolumeUSD: Math.round(data.reduce((sum, a) => sum + a.valueUSD, 0) * 100) / 100,
      topTokens: this.getTopTokens(data, 5),
      topWallets: this.getTopWallets(data, 5),
      data: data,
    };
  }

  getTopTokens(data, limit = 5) {
    const freq = {};
    data.forEach(alert => {
      if (!freq[alert.token]) {
        freq[alert.token] = { count: 0, totalVolume: 0, avgScore: [] };
      }
      freq[alert.token].count++;
      freq[alert.token].totalVolume += alert.valueUSD;
      freq[alert.token].avgScore.push(alert.whaleScore);
    });

    return Object.entries(freq)
      .map(([token, info]) => ({
        token,
        alertCount: info.count,
        totalVolumeUSD: Math.round(info.totalVolume * 100) / 100,
        avgScore: Math.round((info.avgScore.reduce((a, b) => a + b, 0) / info.avgScore.length) * 100) / 100,
      }))
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, limit);
  }

  getTopWallets(data, limit = 5) {
    const wallets = {};
    data.forEach(alert => {
      if (alert.walletAddress && alert.walletAddress !== 'UNKNOWN') {
        if (!wallets[alert.walletAddress]) {
          wallets[alert.walletAddress] = { count: 0, totalVolume: 0, avgScore: [] };
        }
        wallets[alert.walletAddress].count++;
        wallets[alert.walletAddress].totalVolume += alert.valueUSD;
        wallets[alert.walletAddress].avgScore.push(alert.whaleScore);
      }
    });

    return Object.entries(wallets)
      .map(([wallet, info]) => ({
        wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        fullWallet: wallet,
        transactionCount: info.count,
        totalVolumeUSD: Math.round(info.totalVolume * 100) / 100,
        avgScore: Math.round((info.avgScore.reduce((a, b) => a + b, 0) / info.avgScore.length) * 100) / 100,
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, limit);
  }
}

module.exports = { AlertLogger };
