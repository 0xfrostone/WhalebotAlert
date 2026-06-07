// src/storage/researchStore.js
const { StoreBase } = require('./storeBase');

class ResearchStore extends StoreBase {
  constructor() {
    super('research_stats.json', {
      total_events: 0,
      total_whale_alerts: 0,
      total_alerts_sent: 0,
      buy_count: 0,
      sell_count: 0,
      sum_whale_score: 0,
      sum_liquidity_impact: 0,
      highest_transaction: {
        amount: 0,
        token: '',
        timestamp: ''
      },
      token_stats: {}, // { "UNI": { BUY: 0, SELL: 0 }, ... }
      monitoring_start_date: new Date().toISOString()
    });
  }

  incrementEvents() {
    this.data.total_events = (this.data.total_events || 0) + 1;
    this.save();
  }

  recordWhale(swapData, analysisResult) {
    this.data.total_whale_alerts = (this.data.total_whale_alerts || 0) + 1;
    
    // Action tracking
    if (swapData.direction === 'BUY') {
      this.data.buy_count = (this.data.buy_count || 0) + 1;
    } else {
      this.data.sell_count = (this.data.sell_count || 0) + 1;
    }

    // Averages Tracking
    this.data.sum_whale_score = (this.data.sum_whale_score || 0) + (analysisResult.score || 0);
    this.data.sum_liquidity_impact = (this.data.sum_liquidity_impact || 0) + (analysisResult.liquidityImpact || 0);

    // Highest Transaction
    if (!this.data.highest_transaction) {
      this.data.highest_transaction = { amount: 0, token: '', timestamp: '' };
    }
    const currentHighest = this.data.highest_transaction.amount || 0;
    const usdValue = analysisResult.usdValue || 0;
    
    if (usdValue > currentHighest) {
      this.data.highest_transaction = {
        amount: usdValue,
        token: swapData.tokenOut || swapData.tokenIn || 'UNKNOWN',
        timestamp: new Date().toISOString()
      };
    }

    // Per Token Tracking
    const tokenSymbol = swapData.direction === 'BUY' ? swapData.tokenOut : swapData.tokenIn;
    if (tokenSymbol) {
      if (!this.data.token_stats[tokenSymbol]) {
        this.data.token_stats[tokenSymbol] = { BUY: 0, SELL: 0 };
      }
      if (swapData.direction === 'BUY') {
        this.data.token_stats[tokenSymbol].BUY++;
      } else {
        this.data.token_stats[tokenSymbol].SELL++;
      }
    }

    this.save();
  }

  addAlertsSent(count) {
    if (count > 0) {
      this.data.total_alerts_sent = (this.data.total_alerts_sent || 0) + count;
      this.save();
    }
  }

  getStats() {
    const d = this.data;
    const average_score = d.total_whale_alerts > 0 ? (d.sum_whale_score / d.total_whale_alerts) : 0;
    const average_impact = d.total_whale_alerts > 0 ? (d.sum_liquidity_impact / d.total_whale_alerts) : 0;

    return {
      ...d,
      average_score,
      average_impact
    };
  }
}

module.exports = { ResearchStore };
