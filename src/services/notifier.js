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
      `<a href="https://etherscan.io/address/${wallet}">${wallet}</a>`,
      ``,
      `Transaction`,
      `<a href="https://etherscan.io/tx/${txHash}">${txHash}</a>`,
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

    const txHashLinks = data.txHashes && data.txHashes.length > 0 
      ? data.txHashes.map((h, i) => `<a href="https://etherscan.io/tx/${h}">[${i + 1}]</a>`).join(' ')
      : '<i>N/A</i>';

    const dexList = data.dexes && data.dexes.length > 0
      ? data.dexes.join(', ')
      : 'Uniswap';

    return [
      `🐳 <b>ACCUMULATION ALERT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Wallet: <a href="https://etherscan.io/address/${wallet}">${wallet}</a>`,
      `Token: <b>$${tokenSymbol}</b>`,
      `Arah: <b>${direction}</b>`,
      `Platform: <b>${dexList}</b>`,
      ``,
      `🔄 Transaksi: <b>${transactions}x</b>`,
      `💰 Total Volume: <b>${formatUSD(totalVolume)}</b>`,
      `🌊 Total Impact: <b>${(combinedImpactPct * 100).toFixed(2)}%</b>`,
      `⏳ Periode Waktu: <b>${timeWindow}</b>`,
      ``,
      `🔗 <b>Bukti Transaksi (Etherscan):</b>`,
      txHashLinks,
      ``,
      `${emoji[riskLevel] || 'ℹ️'} Tingkat Risiko: <b>${riskLabel[riskLevel] || riskLevel}</b>`
    ].join('\n');
  }
  static formatSimpleDetectionAlert(data) {
    const { tokenSymbol, direction, usdValue, amountIn, amountOut, txHash } = data;
    const tokenAmount = direction === 'BUY' ? (amountOut || 1) : (amountIn || 1);
    const unitPrice = (usdValue && tokenAmount > 0) ? (usdValue / tokenAmount) : 0;

    const actionText = direction === 'BUY' ? 'membeli' : 'menjual';
    const circleEmoji = direction === 'BUY' ? '🟢' : '🔴';

    const formattedUsd = formatUSD(usdValue);
    let formattedPrice = '';
    if (unitPrice >= 1) {
      formattedPrice = `$${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (unitPrice > 0) {
      formattedPrice = `$${unitPrice.toFixed(6)}`;
    } else {
      formattedPrice = '$0';
    }

    return `${circleEmoji} Seseorang baru saja ${actionText} (<b>$${tokenSymbol}</b>) Sebesar <b>${formattedUsd}</b> at <b>${formattedPrice}</b>`;
  }
}

module.exports = { NotificationService };
