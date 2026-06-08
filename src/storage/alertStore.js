// src/storage/alertStore.js
// Manajemen penyimpanan whale alerts untuk keperluan research

const { Parser } = require('json2csv');
const StorageManager = require('./StorageManager');

class AlertStore {
  constructor() {
    this.alerts = this.loadAlerts();
    this.updateStatistics();
  }

  loadAlerts() {
    return StorageManager.readJSON('alerts.json', []);
  }

  save() {
    StorageManager.writeJSON('alerts.json', this.alerts);
  }

  saveAlert(alertData) {
    const record = {
      id: this.alerts.length + 1,
      timestamp: new Date().toISOString(),
      dateTime: new Date().toLocaleString('id-ID'),
      token: alertData.tokenSymbol || 'UNKNOWN',
      transactionType: alertData.direction === 'BUY' ? 'BUY' : 'SELL',
      valueUSD: Math.round(alertData.usdValue * 100) / 100,
      valueETH: alertData.amountIn || 0,
      whaleScore: alertData.whaleScore?.total || 0,
      whaleScoreBreakdown: {
        txSize: alertData.whaleScore?.breakdown?.txSize || 0,
        lpImpact: alertData.whaleScore?.breakdown?.lpImpact || 0,
        walletRep: alertData.whaleScore?.breakdown?.walletRep || 0,
        frequency: alertData.whaleScore?.breakdown?.frequency || 0,
        smartMoney: alertData.whaleScore?.breakdown?.smartMoney || 0,
      },
      riskCategory: alertData.riskCategory || 'UNKNOWN',
      liquidityImpactPct: Math.round((alertData.lpImpactPct || 0) * 10000) / 100,
      poolTVL: Math.round(alertData.poolTVL || 0),
      walletAddress: alertData.wallet || 'UNKNOWN',
      txHash: alertData.txHash || 'N/A',
      dex: alertData.pool?.dex || 'UNKNOWN',
      tokenIn: alertData.tokenIn || 'N/A',
      tokenOut: alertData.tokenOut || 'N/A',
      amountIn: Math.round((alertData.amountIn || 0) * 1e8) / 1e8,
      amountOut: Math.round((alertData.amountOut || 0) * 1e8) / 1e8,
      tokenPrice: alertData.tokenPrice || 0,
      ethPrice: alertData.ethPrice || 0,
      metadata: {
        poolVersion: alertData.pool?.version || 'unknown',
        detectedAt: new Date().getTime(),
        userSubscribers: alertData.userCount || 0,
      }
    };

    this.alerts.unshift(record);
    
    // Keep only last 5000 alerts in memory
    if (this.alerts.length > 5000) {
      this.alerts = this.alerts.slice(0, 5000);
    }

    this.save();
    this.updateStatistics();

    return record;
  }



  updateStatistics() {
    let highestVolume = 0;
    let highestScore = 0;
    
    this.alerts.forEach(a => {
      if ((a.valueUSD || 0) > highestVolume) highestVolume = a.valueUSD;
      if ((a.whaleScore || 0) > highestScore) highestScore = a.whaleScore;
    });

    const avgVolume = this.alerts.length > 0 
      ? this.calculateTotalVolume() / this.alerts.length 
      : 0;

    const stats = {
      lastUpdated: new Date().toISOString(),
      totalAlerts: this.alerts.length,
      alertsByType: {
        BUY: this.alerts.filter(a => a.transactionType === 'BUY').length,
        SELL: this.alerts.filter(a => a.transactionType === 'SELL').length,
      },
      alertsByRisk: {
        EXTREME: this.alerts.filter(a => a.riskCategory === 'EXTREME').length,
        HIGH: this.alerts.filter(a => a.riskCategory === 'HIGH').length,
        MEDIUM: this.alerts.filter(a => a.riskCategory === 'MEDIUM').length,
        LOW: this.alerts.filter(a => a.riskCategory === 'LOW').length,
      },
      tokenFrequency: this.getTokenFrequency(),
      avgWhaleScore: this.calculateAverageWhaleScore(),
      highestWhaleScore: highestScore,
      totalVolumeUSD: this.calculateTotalVolume(),
      avgVolumeUSD: avgVolume,
      highestVolumeUSD: highestVolume,
      topWallets: this.getTopWallets(5),
    };
    this.statistics = stats;
  }

  calculateStatistics() {
    if (this.alerts.length === 0) {
      return {
        lastUpdated: new Date().toISOString(),
        totalAlerts: 0,
        alertsByType: { BUY: 0, SELL: 0 },
        alertsByRisk: { EXTREME: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        tokenFrequency: {},
        avgWhaleScore: 0,
        highestWhaleScore: 0,
        totalVolumeUSD: 0,
        avgVolumeUSD: 0,
        highestVolumeUSD: 0,
        topWallets: [],
      };
    }
    return this.statistics || {};
  }

  getTokenFrequency() {
    const freq = {};
    this.alerts.forEach(alert => {
      freq[alert.token] = (freq[alert.token] || 0) + 1;
    });
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .reduce((obj, [token, count]) => {
        obj[token] = count;
        return obj;
      }, {});
  }

  calculateAverageWhaleScore() {
    if (this.alerts.length === 0) return 0;
    const sum = this.alerts.reduce((acc, alert) => acc + (alert.whaleScore || 0), 0);
    return Math.round((sum / this.alerts.length) * 100) / 100;
  }

  calculateTotalVolume() {
    return this.alerts.reduce((total, alert) => total + (alert.valueUSD || 0), 0);
  }

  getTopWallets(limit = 5) {
    const wallets = {};
    this.alerts.forEach(alert => {
      if (alert.walletAddress && alert.walletAddress !== 'UNKNOWN') {
        wallets[alert.walletAddress] = (wallets[alert.walletAddress] || 0) + 1;
      }
    });
    return Object.entries(wallets)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([wallet, count]) => ({ wallet, transactionCount: count }));
  }

  getRecentAlerts(limit = 10) {
    return this.alerts.slice(0, limit);
  }

  getStatistics() {
    return this.statistics;
  }

  exportToCSV(filters = {}) {
    let filtered = [...this.alerts];

    if (filters.token) {
      filtered = filtered.filter(a => a.token === filters.token);
    }
    if (filters.riskCategory) {
      filtered = filtered.filter(a => a.riskCategory === filters.riskCategory);
    }
    if (filters.transactionType) {
      filtered = filtered.filter(a => a.transactionType === filters.transactionType);
    }
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).getTime();
      const end = new Date(filters.endDate).getTime();
      filtered = filtered.filter(a => {
        const alertTime = new Date(a.timestamp).getTime();
        return alertTime >= start && alertTime <= end;
      });
    }

    return filtered;
  }
}

module.exports = { AlertStore };
