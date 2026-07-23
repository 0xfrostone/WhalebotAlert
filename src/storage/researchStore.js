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
    const score = analysisResult.whaleScore ? analysisResult.whaleScore.total : 0;
    const impact = analysisResult.lpImpactPct || 0;
    this.data.sum_whale_score = (this.data.sum_whale_score || 0) + score;
    this.data.sum_liquidity_impact = (this.data.sum_liquidity_impact || 0) + impact;
    this.data.scored_whale_alerts = (this.data.scored_whale_alerts || 0) + 1;

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
    const divisor = d.scored_whale_alerts || d.total_whale_alerts;
    const average_score = divisor > 0 ? (d.sum_whale_score / divisor) : 0;
    const average_impact = divisor > 0 ? (d.sum_liquidity_impact / divisor) : 0;

    const totalBuySell = (d.buy_count || 0) + (d.sell_count || 0);
    const buyPct = totalBuySell > 0 ? ((d.buy_count || 0) / totalBuySell * 100).toFixed(1) : '0.0';
    const sellPct = totalBuySell > 0 ? ((d.sell_count || 0) / totalBuySell * 100).toFixed(1) : '0.0';
    
    let sentiment = '⚪ NETRAL';
    if ((d.buy_count || 0) > (d.sell_count || 0)) {
      sentiment = '🟢 BULLISH (Dominasi Akumulasi)';
    } else if ((d.sell_count || 0) > (d.buy_count || 0)) {
      sentiment = '🔴 BEARISH (Dominasi Distribusi)';
    }

    return {
      ...d,
      average_score,
      average_impact,
      buyPct,
      sellPct,
      sentiment
    };
  }
}

module.exports = { ResearchStore };
