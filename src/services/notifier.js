// src/services/notifier.js
// Service untuk kirim notifikasi whale alert ke Telegram
// Format dirancang agar mudah dipahami oleh pengguna non-teknis

const { formatUSD, formatAmount } = require('../utils/formatter');

class NotificationService {
  static formatWhaleAlert(data) {
    const {
      tokenSymbol, direction, usdValue, amountIn, tokenIn, tokenOut,
      pool, whaleScore, lpImpactPct, poolTVL, wallet, txHash
    } = data;

    const formattedAmount = formatAmount(direction === 'BUY' ? data.amountOut : amountIn, tokenSymbol);

    // Format Timestamp to UTC
    const date = new Date();
    const tsStr = date.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

    return [
      `🐋 <b>WHALE ACTIVITY DETECTED</b>`,
      ``,
      `Asset      : <b>${tokenSymbol}</b>`,
      `Action     : <b>${direction}</b>`,
      `Network    : <b>Ethereum</b>`,
      `DEX        : <b>${pool.dex}</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Transaction Value`,
      `<b>${formatUSD(usdValue)}</b>`,
      ``,
      `Token Amount`,
      `<b>${formattedAmount} ${tokenSymbol}</b>`,
      ``,
      `Swap Route`,
      `<b>${tokenIn} → ${tokenOut}</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Whale Metrics`,
      ``,
      `Whale Score      : <b>${whaleScore.total} / 100</b>`,
      `Liquidity Impact : <b>${(lpImpactPct * 100).toFixed(2)}%</b>`,
      `Pool Liquidity   : <b>${formatUSD(poolTVL)}</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Wallet`,
      `<code>${wallet.slice(0, 6)}...${wallet.slice(-4)}</code>`,
      ``,
      `Transaction`,
      `<code>${txHash.slice(0, 6)}...${txHash.slice(-4)}</code>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Timestamp`,
      `<b>${tsStr}</b>`
    ].join('\n');
  }

  static formatAccumulationAlert(data) {
    const {
      wallet, tokenSymbol, direction, transactions, totalVolume, combinedImpactPct, timeWindow, riskLevel
    } = data;

    const emoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️', CRITICAL: '🔥' };
    const riskLabel = { EXTREME: 'Sangat Tinggi', HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah', CRITICAL: 'Kritis' };

    const txHashList = data.txHashes && data.txHashes.length > 0 
      ? data.txHashes.map((h, i) => `${i + 1}. <code>${h.slice(0, 6)}...${h.slice(-4)}</code>`).join('\n')
      : '<i>N/A</i>';

    const dexList = data.dexes && data.dexes.length > 0
      ? data.dexes.join(', ')
      : 'Uniswap';

    return [
      `🐳 <b>ACCUMULATION ALERT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Wallet: <code>${wallet.slice(0, 6)}...${wallet.slice(-4)}</code>`,
      `Token: <b>$${tokenSymbol}</b>`,
      `Arah: <b>${direction}</b>`,
      `Platform: <b>${dexList}</b>`,
      ``,
      `🔄 Transaksi: <b>${transactions}x</b>`,
      `💰 Total Volume: <b>${formatUSD(totalVolume)}</b>`,
      `🌊 Total Impact: <b>${(combinedImpactPct * 100).toFixed(2)}%</b>`,
      `⏳ Periode Waktu: <b>${timeWindow}</b>`,
      ``,
      `🔗 <b>Daftar Transaksi:</b>`,
      txHashList,
      ``,
      `${emoji[riskLevel] || 'ℹ️'} Tingkat Risiko: <b>${riskLabel[riskLevel] || riskLevel}</b>`
    ].join('\n');
  }
}

module.exports = { NotificationService };
