// src/services/notifier.js
// Service untuk kirim notifikasi whale alert ke Telegram dengan tampilan super clean

const { formatUSD, formatAmount } = require('../utils/formatter');

class NotificationService {
  static formatWhaleAlert(data) {
    const {
      tokenSymbol, direction, usdValue, amountIn, amountOut, tokenIn, tokenOut,
      pool, whaleScore, lpImpactPct, poolTVL, wallet, txHash
    } = data;

    const rawTokenAmount = direction === 'BUY' ? amountOut : amountIn;
    const formattedAmount = formatAmount(rawTokenAmount, tokenSymbol);
    const actionBadge = direction === 'BUY' ? '🟢 BUY (Akumulasi)' : '🔴 SELL (Distribusi)';
    const dexName = pool && pool.dex ? pool.dex : 'Uniswap V3';

    const dateStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';

    const shortWallet = wallet && wallet.length > 10 ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}` : wallet;
    const shortTx = txHash && txHash.length > 10 ? `${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}` : txHash;

    const scoreNum = whaleScore && typeof whaleScore.total === 'number' ? whaleScore.total : (typeof whaleScore === 'number' ? whaleScore : 50);
    let scoreBadge = 'Sedang';
    if (scoreNum >= 75) scoreBadge = 'Tinggi 🚨';
    else if (scoreNum >= 50) scoreBadge = 'Sedang ⚠️';
    else scoreBadge = 'Rendah ℹ️';

    return [
      `🐳 <b>WHALE TRANSACTION DETECTED</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Asset  : <b>$${tokenSymbol}</b> (Ethereum • ${dexName})`,
      `Arah   : <b>${actionBadge}</b>`,
      ``,
      `💰 Volume Swap : <b>${formatUSD(usdValue)}</b>`,
      `🪙 Jumlah Token: <b>${formattedAmount} ${tokenSymbol}</b>`,
      `🔄 Rute Swap   : <b>${tokenIn || tokenSymbol} → ${tokenOut || tokenSymbol}</b>`,
      ``,
      `📊 <b>Metrik Riset Whale:</b>`,
      `• Skor Whale   : <b>${scoreNum}/100</b> (${scoreBadge})`,
      `• Dampak Harga : <b>${(lpImpactPct * 100).toFixed(2)}%</b>`,
      `• Pool TVL     : <b>${formatUSD(poolTVL)}</b>`,
      ``,
      `👤 Wallet : <a href="https://etherscan.io/address/${wallet}"><code>${shortWallet}</code></a>`,
      `🔗 Hash   : <a href="https://etherscan.io/tx/${txHash}"><code>${shortTx}</code></a>`,
      `⏳ Waktu  : <b>${dateStr}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');
  }

  static formatAccumulationAlert(data) {
    const {
      wallet, tokenSymbol, direction, transactions, totalVolume, combinedImpactPct, timeWindow, riskLevel, txHashes, dexes
    } = data;

    const emoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️', CRITICAL: '🔥' };
    const riskLabel = { EXTREME: 'Sangat Tinggi', HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah', CRITICAL: 'Kritis' };

    const shortWallet = wallet && wallet.length > 10 ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}` : wallet;

    const txHashLinks = txHashes && txHashes.length > 0 
      ? txHashes.map((h, i) => `<a href="https://etherscan.io/tx/${h}">[${i + 1}]</a>`).join(' ')
      : '<i>N/A</i>';

    const dexList = dexes && dexes.length > 0 ? dexes.join(', ') : 'Uniswap V3';
    const actionBadge = direction === 'BUY' ? '🟢 BUY (Akumulasi)' : '🔴 SELL (Distribusi)';

    return [
      `🐳 <b>ACCUMULATION ALERT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Asset   : <b>$${tokenSymbol}</b>`,
      `Arah    : <b>${actionBadge}</b>`,
      `DEX     : <b>${dexList}</b>`,
      `Wallet  : <a href="https://etherscan.io/address/${wallet}"><code>${shortWallet}</code></a>`,
      ``,
      `🔄 Total Transaksi : <b>${transactions}x</b>`,
      `💰 Akumulasi Volume: <b>${formatUSD(totalVolume)}</b>`,
      `🌊 Total Impact LP : <b>${(combinedImpactPct * 100).toFixed(2)}%</b>`,
      `⏳ Rentang Waktu   : <b>${timeWindow}</b>`,
      ``,
      `🔗 <b>Bukti Transaksi (Etherscan):</b>`,
      txHashLinks,
      ``,
      `${emoji[riskLevel] || '⚠️'} Tingkat Risiko: <b>${riskLabel[riskLevel] || riskLevel}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');
  }

  static formatSimpleDetectionAlert(data) {
    const { tokenSymbol, direction, usdValue, amountIn, amountOut } = data;
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

    // Clean 1-line format without extra brackets or Etherscan hash links
    return `${circleEmoji} Seseorang baru saja ${actionText} <b>$${tokenSymbol}</b> Sebesar <b>${formattedUsd}</b> at <b>${formattedPrice}</b>`;
  }
}

module.exports = { NotificationService };
