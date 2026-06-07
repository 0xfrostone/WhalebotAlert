// src/services/notifier.js
// Service untuk kirim notifikasi whale alert ke Telegram
// Format dirancang agar mudah dipahami oleh pengguna non-teknis

const { formatUSD, formatAmount } = require('../utils/formatter');

// ============================================================
// NARASI OTOMATIS — mengubah skor angka jadi kalimat deskriptif
// ============================================================

/**
 * Narasi ukuran transaksi berdasarkan txSize score (0-100)
 */
function narrateTxSize(score, usdValue) {
  const usdStr = formatUSD(usdValue);
  if (score >= 80) return `Transaksi bernilai ${usdStr} — tergolong sangat besar dan jarang terjadi.`;
  if (score >= 60) return `Nilai transaksi ${usdStr} cukup besar dibanding aktivitas normal.`;
  if (score >= 40) return `Transaksi senilai ${usdStr} berada di atas rata-rata volume harian.`;
  if (score >= 20) return `Transaksi ${usdStr} termasuk ukuran sedang, cukup umum terjadi.`;
  return `Transaksi ${usdStr} relatif kecil dan umum terjadi di pasar.`;
}

/**
 * Narasi dampak ke likuiditas berdasarkan lpImpact score (0-100)
 */
function narrateLpImpact(score, lpImpactPct) {
  const pctStr = (lpImpactPct * 100).toFixed(2);
  if (score >= 80) return `Menggunakan ${pctStr}% likuiditas — dampak sangat besar, berpotensi menggerakkan harga.`;
  if (score >= 50) return `Menggunakan ${pctStr}% likuiditas — dampak signifikan terhadap kedalaman pasar.`;
  if (score >= 20) return `Menggunakan ${pctStr}% likuiditas — dampak moderat, pasar masih cukup stabil.`;
  return `Hanya memengaruhi ${pctStr}% likuiditas — dampak minimal terhadap pasar.`;
}

/**
 * Narasi frekuensi aktivitas wallet berdasarkan frequency score (0-100)
 */
function narrateFrequency(score) {
  if (score >= 80) return `Wallet ini sangat aktif — melakukan banyak transaksi dalam waktu singkat.`;
  if (score >= 50) return `Wallet ini menunjukkan aktivitas berulang yang patut diwaspadai.`;
  if (score >= 20) return `Wallet ini mulai menunjukkan pola aktivitas yang meningkat.`;
  return `Wallet ini belum menunjukkan aktivitas besar yang berulang.`;
}

/**
 * Kesimpulan otomatis berdasarkan risk category dan whale score
 */
function generateConclusion(riskCategory, whaleScore, direction) {
  const dirWord = direction === 'BUY' ? 'pembelian' : 'penjualan';

  const conclusions = {
    EXTREME: `🔴 Aktivitas whale besar terdeteksi! ${dirWord.charAt(0).toUpperCase() + dirWord.slice(1)} ini berpotensi memicu pergerakan harga signifikan. Perhatikan perubahan harga dalam beberapa menit ke depan.`,
    HIGH: `🟠 Transaksi ${dirWord} ini berpotensi memengaruhi harga dan menarik perhatian trader lain. Pantau perkembangan selanjutnya.`,
    MEDIUM: `🟡 Aktivitas ${dirWord} ini layak dipantau, namun belum menunjukkan pengaruh besar terhadap pasar. Tetap waspada jika muncul transaksi serupa.`,
    LOW: `🟢 Aktivitas ${dirWord} normal dengan risiko rendah. Tidak ditemukan indikasi manipulasi pasar.`
  };

  return conclusions[riskCategory] || conclusions.LOW;
}

/**
 * Label risk category dalam bahasa Indonesia
 */
function riskLabel(riskCategory) {
  const labels = {
    EXTREME: 'Sangat Tinggi',
    HIGH: 'Tinggi',
    MEDIUM: 'Sedang',
    LOW: 'Rendah'
  };
  return labels[riskCategory] || riskCategory;
}

/**
 * Progress bar visual untuk skor
 */
function scoreBar(score) {
  const filled = Math.max(1, Math.round(score / 10));
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// ============================================================
// FORMAT PESAN UTAMA
// ============================================================

class NotificationService {
  static formatWhaleAlert(data) {
    const {
      tokenSymbol, direction, usdValue, amountIn, tokenIn, tokenOut,
      pool, whaleScore, lpImpactPct, poolTVL, riskCategory, wallet, txHash
    } = data;

    console.log(`📤 [NOTIFIER] Formatting alert for ${tokenSymbol} ${direction} - Risk: ${riskCategory}`);

    const emoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️' };
    const dirEmoji = direction === 'BUY' ? '🟢' : '🔴';
    const dirText = direction === 'BUY' ? 'BELI (BUY)' : 'JUAL (SELL)';
    const arrow = direction === 'BUY' ? '📈' : '📉';
    const prob = direction === 'BUY'
      ? Math.min(30 + whaleScore.total * 0.5, 85).toFixed(0)
      : Math.min(20 + whaleScore.total * 0.3, 70).toFixed(0);

    const { breakdown: bd } = whaleScore;

    return [
      // ─── HEADER ───
      `${emoji[riskCategory]} <b>WHALE ALERT — ${riskCategory}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💎 Token: <b>$${tokenSymbol}</b>`,
      `🌐 DEX: ${pool.dex}`,
      `${dirEmoji} Aksi: <b>${dirText}</b>`,
      ``,

      // ─── DETAIL TRANSAKSI ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 <b>DETAIL TRANSAKSI</b>`,
      ``,
      `Nilai:     <b>${formatUSD(usdValue)}</b>`,
      `Swap:      ${tokenIn} → ${tokenOut}`,
      `Jumlah:    ${formatAmount(amountIn, tokenIn)}`,
      ``,

      // ─── ANALISA PASAR ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 <b>ANALISA PASAR</b>`,
      ``,
      `💰 <b>Likuiditas Pasar</b>`,
      `Tersedia sekitar <b>${formatUSD(poolTVL)}</b> dana di pool likuiditas.`,
      ``,
      `🌊 <b>Dampak Transaksi</b>`,
      `Transaksi ini menggunakan sekitar <b>${(lpImpactPct * 100).toFixed(2)}%</b> dari likuiditas yang tersedia.`,
      ``,
      `🎯 <b>Skor Whale</b>`,
      `${scoreBar(whaleScore.total)} <b>${whaleScore.total}/100</b> (${riskLabel(riskCategory)})`,
      ``,

      // ─── FAKTOR PENILAIAN ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 <b>FAKTOR PENILAIAN</b>`,
      ``,
      `💰 <b>Ukuran Transaksi</b> — ${bd.txSize}/100`,
      `<i>${narrateTxSize(bd.txSize, usdValue)}</i>`,
      ``,
      `🌊 <b>Dampak ke Pasar</b> — ${bd.lpImpact}/100`,
      `<i>${narrateLpImpact(bd.lpImpact, lpImpactPct)}</i>`,
      ``,
      `🔄 <b>Aktivitas Wallet</b> — ${bd.frequency}/100`,
      `<i>${narrateFrequency(bd.frequency)}</i>`,
      ``,

      // ─── PREDIKSI ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `${arrow} <b>PREDIKSI</b>`,
      `Probabilitas ${direction === 'BUY' ? 'kenaikan' : 'penurunan'} harga: <b>~${prob}%</b>`,
      ``,

      // ─── KESIMPULAN ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `📝 <b>KESIMPULAN</b>`,
      ``,
      `${generateConclusion(riskCategory, whaleScore.total, direction)}`,
      ``,

      // ─── FOOTER ───
      `━━━━━━━━━━━━━━━━━━━━`,
      `👛 Wallet: <code>${wallet.slice(0, 6)}...${wallet.slice(-4)}</code>`,
      `⚡️ <i>Bukan saran finansial. DYOR.</i>`
    ].join('\n');
  }

  static formatAccumulationAlert(data) {
    const {
      wallet, tokenSymbol, direction, transactions, totalVolume, combinedImpactPct, timeWindow, riskLevel
    } = data;

    const emoji = { EXTREME: '🚨', HIGH: '⚠️', MEDIUM: '📊', LOW: 'ℹ️', CRITICAL: '🔥' };
    const riskLabel = { EXTREME: 'Sangat Tinggi', HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah', CRITICAL: 'Kritis' };

    return [
      `🐳 <b>ACCUMULATION ALERT</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Wallet: <code>${wallet.slice(0, 6)}...${wallet.slice(-4)}</code>`,
      `Token: <b>$${tokenSymbol}</b>`,
      `Arah: <b>${direction}</b>`,
      ``,
      `🔄 Transaksi: <b>${transactions}x</b>`,
      `💰 Total Volume: <b>${formatUSD(totalVolume)}</b>`,
      `🌊 Total Impact: <b>${(combinedImpactPct * 100).toFixed(2)}%</b>`,
      `⏳ Periode Waktu: <b>${timeWindow}</b>`,
      ``,
      `${emoji[riskLevel] || 'ℹ️'} Tingkat Risiko: <b>${riskLabel[riskLevel] || riskLevel}</b>`
    ].join('\n');
  }
}

module.exports = { NotificationService };
