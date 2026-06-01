// src/config/settings.js
// Konfigurasi aplikasi global

const SETTINGS = {
  PRICE_CACHE_TTL: 60000,  // 1 menit
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)),
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  ALERT_COOLDOWN_SECONDS: parseInt(process.env.ALERT_COOLDOWN_SECONDS || '300'),
  MIN_USD_VALUE: parseFloat(process.env.MIN_USD_VALUE || '5000'),
  MIN_LP_IMPACT: parseFloat(process.env.MIN_LP_IMPACT || '0.001'),
  MIN_WHALE_SCORE: parseInt(process.env.MIN_WHALE_SCORE || '20')
};

module.exports = { SETTINGS };
