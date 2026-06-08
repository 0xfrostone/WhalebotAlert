// src/utils/excelExporter.js
const XLSX = require('xlsx');
const StorageManager = require('../storage/StorageManager');
const path = require('path');

class ExcelExporter {
  static generateResearchReport(rawAlerts, stats) {
    const workbook = XLSX.utils.book_new();

    // Normalize alerts to ensure compatibility between old and new JSON structures
    const alerts = rawAlerts.map(alert => {
      const dateTimeStr = alert.dateTime || (alert.timestamp ? new Date(alert.timestamp).toLocaleString('id-ID') : 'Unknown');
      return {
        ...alert,
        dateTimeStr: dateTimeStr,
        dateOnly: dateTimeStr.split(' ')[0] || '',
        timeOnly: dateTimeStr.split(' ')[1] || '',
        token: alert.token || alert.tokenSymbol || 'UNKNOWN',
        transactionType: alert.transactionType || alert.direction || 'UNKNOWN',
        valueUSD: alert.valueUSD || 0,
        valueETH: alert.valueETH || alert.amountIn || alert.amountOut || 0,
        whaleScore: alert.whaleScore?.total !== undefined ? alert.whaleScore.total : (alert.whaleScore || 0),
        liquidityImpactPct: alert.liquidityImpactPct || alert.liquidityImpact || 0,
        dex: alert.dex || alert.pool?.dex || 'UNKNOWN',
        walletAddress: alert.walletAddress || alert.wallet || 'UNKNOWN',
        txHash: alert.txHash || 'N/A'
      };
    });

    // 1. Sheet: Dataset Penelitian
    const datasetData = alerts.map((alert, index) => ({
      'No': index + 1,
      'Date': alert.dateOnly,
      'Time': alert.timeOnly,
      'Token': alert.token,
      'Action': alert.transactionType,
      'Transaction Value (USD)': alert.valueUSD,
      'Token Amount': alert.valueETH,
      'Whale Score': alert.whaleScore,
      'Liquidity Impact (%)': alert.liquidityImpactPct,
      'DEX': alert.dex,
      'Wallet Address': alert.walletAddress,
      'Transaction Hash': alert.txHash
    }));
    const datasetSheet = XLSX.utils.json_to_sheet(datasetData);
    
    // Set column widths for Dataset
    datasetSheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 8 },  // Token
      { wch: 8 },  // Action
      { wch: 25 }, // USD
      { wch: 15 }, // Token Amount
      { wch: 12 }, // Whale Score
      { wch: 20 }, // Liquidity Impact
      { wch: 15 }, // DEX
      { wch: 45 }, // Wallet
      { wch: 68 }  // TX Hash
    ];
    XLSX.utils.book_append_sheet(workbook, datasetSheet, "Dataset Penelitian");

    // 2. Sheet: Ringkasan Penelitian
    // Calculate monitoring duration
    let monitoringHours = 0;
    if (stats.monitoring_start_date) {
      monitoringHours = (Date.now() - new Date(stats.monitoring_start_date).getTime()) / 3600000;
    }

    // Calculate metrics based on ALERTS, not just stats
    const totalVolume = alerts.reduce((acc, val) => acc + (val.valueUSD || 0), 0);
    const avgScore = alerts.length > 0 ? alerts.reduce((acc, val) => acc + (val.whaleScore || 0), 0) / alerts.length : 0;
    const maxScore = alerts.length > 0 ? Math.max(...alerts.map(a => a.whaleScore || 0)) : 0;
    const avgImpact = alerts.length > 0 ? alerts.reduce((acc, val) => acc + (val.liquidityImpactPct || 0), 0) / alerts.length : 0;
    const maxImpact = alerts.length > 0 ? Math.max(...alerts.map(a => a.liquidityImpactPct || 0)) : 0;
    const maxTxValue = alerts.length > 0 ? Math.max(...alerts.map(a => a.valueUSD || 0)) : 0;
    const avgTxValue = alerts.length > 0 ? totalVolume / alerts.length : 0;

    const summaryData = [
      ["MONITORING PERIOD"],
      ["Start Date", stats.monitoring_start_date ? new Date(stats.monitoring_start_date).toLocaleString('id-ID') : 'N/A'],
      ["End Date", new Date().toLocaleString('id-ID')],
      ["Duration", `${monitoringHours.toFixed(2)} Hours (${(monitoringHours / 24).toFixed(1)} Days)`],
      [""],
      ["WHALE DETECTION STATISTICS"],
      ["Total Events Received", stats.total_events_received || 0],
      ["Total Whale Detected", stats.total_whale_detected || 0],
      ["Total Alerts Sent", stats.total_alerts_sent || 0],
      ["BUY Count", alerts.filter(a => a.transactionType === 'BUY').length],
      ["SELL Count", alerts.filter(a => a.transactionType === 'SELL').length],
      [""],
      ["RESEARCH METRICS"],
      ["Average Whale Score", avgScore.toFixed(2)],
      ["Highest Whale Score", maxScore],
      ["Average Liquidity Impact (%)", avgImpact.toFixed(4)],
      ["Highest Liquidity Impact (%)", maxImpact.toFixed(4)],
      ["Average Transaction Value (USD)", avgTxValue.toFixed(2)],
      ["Largest Transaction Value (USD)", maxTxValue.toFixed(2)]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan Penelitian");

    // 3. Sheet: Statistik Token
    const tokens = {};
    alerts.forEach(alert => {
      const t = alert.token || 'UNKNOWN';
      if (!tokens[t]) tokens[t] = { BUY: 0, SELL: 0 };
      if (alert.transactionType === 'BUY') tokens[t].BUY++;
      if (alert.transactionType === 'SELL') tokens[t].SELL++;
    });

    const tokenData = Object.entries(tokens).map(([token, data]) => ({
      Token: token,
      BUY: data.BUY,
      SELL: data.SELL,
      TOTAL: data.BUY + data.SELL
    })).sort((a, b) => b.TOTAL - a.TOTAL);

    const tokenSheet = XLSX.utils.json_to_sheet(tokenData);
    XLSX.utils.book_append_sheet(workbook, tokenSheet, "Statistik Token");

    // Top 10 Largest Transactions
    const top10 = [...alerts].sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0)).slice(0, 10);
    const top10Data = top10.map((alert, index) => ({
      Rank: index + 1,
      Date: alert.dateTimeStr,
      Token: alert.token,
      Action: alert.transactionType,
      'USD Value': alert.valueUSD,
      'Whale Score': alert.whaleScore
    }));
    
    XLSX.utils.sheet_add_aoa(summarySheet, [
      [""],
      ["TOP 10 LARGEST WHALE TRANSACTIONS"]
    ], { origin: -1 });
    XLSX.utils.sheet_add_json(summarySheet, top10Data, { origin: -1 });

    const today = new Date().toISOString().split('T')[0];
    const filename = `whale_research_report_${today}.xlsx`;
    const filePath = StorageManager.getResearchPath(filename);

    XLSX.writeFile(workbook, filePath);
    return filePath;
  }
}

module.exports = { ExcelExporter };
