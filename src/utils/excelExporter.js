// src/utils/excelExporter.js
const XLSX = require('xlsx');
const StorageManager = require('../storage/StorageManager');
const path = require('path');

class ExcelExporter {
  static generateDatasetExcel(rawAlerts) {
    const workbook = XLSX.utils.book_new();
    const alerts = this.normalizeAlerts(rawAlerts);

    const datasetData = alerts.map((alert, index) => ({
      'No': index + 1,
      'Tanggal': alert.dateOnly,
      'Jam': alert.timeOnly,
      'Koin/Token': alert.token,
      'Aktivitas (Beli/Jual)': alert.transactionType === 'BUY' ? 'Beli' : 'Jual',
      'Nilai Uang (USD)': alert.valueUSD,
      'Jumlah Token': alert.valueETH,
      'Skor Whale (0-100)': alert.whaleScore,
      'Efek ke Harga (%)': alert.liquidityImpactPct,
      'Bursa (DEX)': alert.dex,
      'Dompet (Wallet)': alert.walletAddress,
      'Kode Transaksi': alert.txHash
    }));
    const datasetSheet = XLSX.utils.json_to_sheet(datasetData);
    
    datasetSheet['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 },
      { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 15 },
      { wch: 45 }, { wch: 68 }
    ];
    XLSX.utils.book_append_sheet(workbook, datasetSheet, "Data Lengkap");

    const today = new Date().toISOString().split('T')[0];
    const filename = `dataset_penelitian_${today}.xlsx`;
    const filePath = StorageManager.getResearchPath(filename);
    XLSX.writeFile(workbook, filePath);
    return filePath;
  }

  static generateSummaryExcel(rawAlerts, stats) {
    const workbook = XLSX.utils.book_new();
    const alerts = this.normalizeAlerts(rawAlerts);

    let monitoringHours = 0;
    if (stats.monitoring_start_date) {
      monitoringHours = (Date.now() - new Date(stats.monitoring_start_date).getTime()) / 3600000;
    }

    const totalVolume = alerts.reduce((acc, val) => acc + (val.valueUSD || 0), 0);
    const avgScore = alerts.length > 0 ? alerts.reduce((acc, val) => acc + (val.whaleScore || 0), 0) / alerts.length : 0;
    const maxScore = alerts.length > 0 ? Math.max(...alerts.map(a => a.whaleScore || 0)) : 0;
    const avgImpact = alerts.length > 0 ? alerts.reduce((acc, val) => acc + (val.liquidityImpactPct || 0), 0) / alerts.length : 0;
    const maxImpact = alerts.length > 0 ? Math.max(...alerts.map(a => a.liquidityImpactPct || 0)) : 0;
    const maxTxValue = alerts.length > 0 ? Math.max(...alerts.map(a => a.valueUSD || 0)) : 0;
    const avgTxValue = alerts.length > 0 ? totalVolume / alerts.length : 0;

    const summaryData = [
      ["PERIODE PEMANTAUAN"],
      ["Waktu Mulai", stats.monitoring_start_date ? new Date(stats.monitoring_start_date).toLocaleString('id-ID') : 'Tidak Diketahui'],
      ["Waktu Selesai", new Date().toLocaleString('id-ID')],
      ["Lama Pemantauan", `${monitoringHours.toFixed(2)} Jam (${(monitoringHours / 24).toFixed(1)} Hari)`],
      [""],
      ["STATISTIK DETEKSI WHALE (PAUS)"],
      ["Total Transaksi Terpantau", stats.total_events || 0],
      ["Total Paus Ditemukan", stats.total_whale_alerts || 0],
      ["Total Notifikasi Dikirim", stats.total_alerts_sent || 0],
      ["Total Aktivitas Pembelian", alerts.filter(a => a.transactionType === 'BUY').length],
      ["Total Aktivitas Penjualan", alerts.filter(a => a.transactionType === 'SELL').length],
      [""],
      ["RANGKUMAN ANGKA"],
      ["Rata-Rata Skor Paus", avgScore.toFixed(2)],
      ["Skor Paus Tertinggi", maxScore],
      ["Rata-Rata Efek ke Harga Pasar (%)", avgImpact.toFixed(4)],
      ["Efek Terbesar ke Harga Pasar (%)", maxImpact.toFixed(4)],
      ["Rata-Rata Nilai Transaksi (USD)", avgTxValue.toFixed(2)],
      ["Nilai Transaksi Terbesar (USD)", maxTxValue.toFixed(2)]
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan Penelitian");

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
      ["10 TRANSAKSI PAUS TERBESAR"]
    ], { origin: -1 });
    XLSX.utils.sheet_add_json(summarySheet, top10Data, { origin: -1 });

    const today = new Date().toISOString().split('T')[0];
    const filename = `ringkasan_penelitian_${today}.xlsx`;
    const filePath = StorageManager.getResearchPath(filename);
    XLSX.writeFile(workbook, filePath);
    return filePath;
  }

  static normalizeAlerts(rawAlerts) {
    return rawAlerts.map(alert => {
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
        liquidityImpactPct: (alert.lpImpactPct || alert.liquidityImpactPct || alert.liquidityImpact || 0) * 100,
        dex: alert.dex || alert.pool?.dex || 'UNKNOWN',
        walletAddress: alert.walletAddress || alert.wallet || 'UNKNOWN',
        txHash: alert.txHash || 'N/A'
      };
    });
  }
}

module.exports = { ExcelExporter };
