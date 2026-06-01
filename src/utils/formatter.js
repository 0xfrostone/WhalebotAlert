// src/utils/formatter.js
// Fungsi formatting untuk display
//
// PENTING: Jangan gunakan toLocaleString() tanpa locale eksplisit!
// Tanpa locale, angka seperti 63.407 bisa tampil sebagai "63,407"
// yang terlihat seperti $63,407 (enam puluh tiga ribu) padahal
// nilai sebenarnya hanya ~$63.

/**
 * Format angka USD untuk display di notifikasi Telegram.
 * Menggunakan sufiks K/M untuk angka besar, dan 2 desimal untuk angka kecil.
 * @param {number} value - Nilai USD (raw number)
 * @returns {string} Formatted string, contoh: "$63.41", "$1.5K", "$2.30M"
 */
const formatUSD = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1_000) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toFixed(2)}`;
};

/**
 * Format angka USD untuk logging ke console (SAFE — tidak ambigu).
 * Selalu menampilkan angka penuh dengan 2 desimal, tanpa pemisah ribuan
 * untuk menghindari kebingungan antara pemisah ribuan dan desimal.
 * @param {number} value - Nilai USD (raw number)
 * @returns {string} Formatted string, contoh: "$63.41", "$150432.50"
 */
const formatUSDLog = (value) => {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
};

/**
 * Debug formatter: menampilkan raw value, formatted value, dan threshold
 * dalam satu string untuk memudahkan verifikasi di log.
 * @param {number} rawValue - Nilai USD raw
 * @param {number} [threshold] - Threshold perbandingan (opsional)
 * @returns {string} Debug string
 */
const debugFormatUSD = (rawValue, threshold) => {
  const raw = typeof rawValue === 'number' ? rawValue : 0;
  const parts = [
    `raw=${raw}`,
    `formatted=${formatUSDLog(raw)}`,
    `display=${formatUSD(raw)}`
  ];
  if (threshold !== undefined) {
    parts.push(`threshold=${formatUSDLog(threshold)}`);
    parts.push(`pass=${raw >= threshold}`);
  }
  return parts.join(' | ');
};

const formatAmount = (amount, symbol) => {
  if (typeof amount !== 'number' || isNaN(amount)) return `0 ${symbol}`;
  if (symbol === 'PEPE') {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}T ${symbol}`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ${symbol}`;
  }
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ${symbol}`;
  if (amount >= 1e3) return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
  return `${amount.toFixed(4)} ${symbol}`;
};

const formatBarChart = (score) => {
  return '█'.repeat(Math.max(1, Math.floor(score / 20)));
};

const createStatusIcon = (active, maintenance = false) => {
  if (maintenance) return '⛔';
  return active ? '🟢' : '🔴';
};

module.exports = {
  formatUSD,
  formatUSDLog,
  debugFormatUSD,
  formatAmount,
  formatBarChart,
  createStatusIcon
};
