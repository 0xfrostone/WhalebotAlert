// src/utils/csvExporter.js
// Utility untuk export data penelitian ke format CSV

const fs = require('fs');
const path = require('path');

class CSVExporter {
  static escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  static alertsToCSV(alerts) {
    const headers = [
      'ID', 'Timestamp', 'DateTime', 'Token', 'Transaction Type', 'Value (USD)', 'Value (ETH)',
      'Whale Score', 'TX Size Score', 'LP Impact Score', 'Wallet Rep Score', 'Frequency Score',
      'Smart Money Score', 'Risk Category', 'Liquidity Impact (%)', 'Pool TVL (USD)',
      'Wallet Address', 'TX Hash', 'DEX', 'Token In', 'Token Out', 'Amount In', 'Amount Out',
      'Token Price', 'ETH Price', 'Pool Version'
    ];

    const rows = alerts.map(alert => [
      alert.id,
      alert.timestamp,
      alert.dateTime,
      alert.token,
      alert.transactionType,
      alert.valueUSD,
      alert.valueETH,
      alert.whaleScore,
      alert.whaleScoreBreakdown?.txSize || 0,
      alert.whaleScoreBreakdown?.lpImpact || 0,
      alert.whaleScoreBreakdown?.walletRep || 0,
      alert.whaleScoreBreakdown?.frequency || 0,
      alert.whaleScoreBreakdown?.smartMoney || 0,
      alert.riskCategory,
      alert.liquidityImpactPct,
      alert.poolTVL,
      alert.walletAddress,
      alert.txHash,
      alert.dex,
      alert.tokenIn,
      alert.tokenOut,
      alert.amountIn,
      alert.amountOut,
      alert.tokenPrice,
      alert.ethPrice,
      alert.metadata?.poolVersion || 'unknown'
    ]);

    const csvContent = [
      headers.map(h => this.escapeCSV(h)).join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(','))
    ].join('\n');

    return csvContent;
  }

  static exportToFile(alerts, fileName = null) {
    const StorageManager = require('../storage/StorageManager');
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName_ = fileName || `whale_alerts_research_${timestamp}.csv`;
    const filePath = StorageManager.getExportsPath(fileName_);

    const csvContent = this.alertsToCSV(alerts);
    require('fs').writeFileSync(filePath, csvContent, 'utf8');

    return filePath;
  }

  static generateAnalysisReport(alerts) {
    const report = {
      generatedAt: new Date().toISOString(),
      totalAlerts: alerts.length,
      
      // Summary statistics
      summary: {
        totalVolumeUSD: alerts.reduce((sum, a) => sum + (a.valueUSD || 0), 0),
        averageWhaleScore: this.calculateAverage(alerts.map(a => a.whaleScore)),
        averageLiquidityImpact: this.calculateAverage(alerts.map(a => a.liquidityImpactPct * 100)),
      },

      // Distribution analysis
      distribution: {
        byRiskCategory: this.groupBy(alerts, 'riskCategory'),
        byToken: this.groupBy(alerts, 'token'),
        byTransactionType: this.groupBy(alerts, 'transactionType'),
        byDEX: this.groupBy(alerts, 'dex'),
      },

      // Correlation analysis (for research)
      correlations: {
        whaleScoreToPriceImpact: this.analyzeCorrelation(
          alerts.map(a => a.whaleScore),
          alerts.map(a => a.liquidityImpactPct)
        ),
        volumeToRisk: this.analyzeCorrelation(
          alerts.map(a => a.valueUSD),
          alerts.map(a => this.riskToScore(a.riskCategory))
        ),
      },

      // Time series analysis
      timeAnalysis: this.analyzeTimeSeries(alerts),

      // Top performers
      topTokens: this.getTopItems(alerts, 'token', 5),
      topWallets: this.getTopItems(alerts, 'walletAddress', 5),
    };

    return report;
  }

  static calculateAverage(values) {
    if (values.length === 0) return 0;
    const filtered = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
    return filtered.length === 0 ? 0 : Math.round((filtered.reduce((a, b) => a + b, 0) / filtered.length) * 100) / 100;
  }

  static groupBy(alerts, field) {
    const groups = {};
    alerts.forEach(alert => {
      const key = alert[field] || 'UNKNOWN';
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  static getTopItems(alerts, field, limit = 5) {
    const items = {};
    alerts.forEach(alert => {
      const key = alert[field] || 'UNKNOWN';
      if (!items[key]) {
        items[key] = { count: 0, totalVolume: 0, avgScore: [] };
      }
      items[key].count++;
      items[key].totalVolume += alert.valueUSD || 0;
      items[key].avgScore.push(alert.whaleScore || 0);
    });

    return Object.entries(items)
      .map(([item, data]) => ({
        item,
        count: data.count,
        totalVolume: Math.round(data.totalVolume * 100) / 100,
        avgScore: this.calculateAverage(data.avgScore),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  static analyzeTimeSeries(alerts) {
    const timeline = {};
    alerts.forEach(alert => {
      const date = alert.dateTime.split(' ')[0]; // Get date part only
      if (!timeline[date]) {
        timeline[date] = { count: 0, volume: 0 };
      }
      timeline[date].count++;
      timeline[date].volume += alert.valueUSD || 0;
    });

    return Object.entries(timeline)
      .map(([date, data]) => ({
        date,
        alertCount: data.count,
        dailyVolume: Math.round(data.volume * 100) / 100,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  static analyzeCorrelation(values1, values2) {
    if (values1.length !== values2.length || values1.length < 2) {
      return 0;
    }

    const filtered = values1.map((v, i) => [v, values2[i]])
      .filter(([v1, v2]) => !isNaN(v1) && !isNaN(v2) && v1 !== null && v2 !== null);

    if (filtered.length < 2) return 0;

    const mean1 = filtered.reduce((sum, [v1]) => sum + v1, 0) / filtered.length;
    const mean2 = filtered.reduce((sum, [, v2]) => sum + v2, 0) / filtered.length;

    const numerator = filtered.reduce((sum, [v1, v2]) => sum + (v1 - mean1) * (v2 - mean2), 0);
    const denominator = Math.sqrt(
      filtered.reduce((sum, [v1]) => sum + (v1 - mean1) ** 2, 0) *
      filtered.reduce((sum, [, v2]) => sum + (v2 - mean2) ** 2, 0)
    );

    return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 10000;
  }

  static riskToScore(riskCategory) {
    const mapping = { LOW: 20, MEDIUM: 50, HIGH: 75, EXTREME: 95 };
    return mapping[riskCategory] || 0;
  }

  static saveReport(reportData, fileName = null) {
    const StorageManager = require('../storage/StorageManager');
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName_ = fileName || `research_report_${timestamp}.json`;
    const filePath = StorageManager.getExportsPath(fileName_);

    require('fs').writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf8');
    return filePath;
  }
}

module.exports = { CSVExporter };
