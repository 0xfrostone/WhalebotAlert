// src/config/thresholds.js
// Konfigurasi threshold dan limit

const THRESHOLDS = {
  // Threshold untuk penelitian utama
  USD_VALUES: [10000, 50000, 100000, 500000, 1000000],
  DEFAULT_THRESHOLD: 50000,
  
  // Threshold khusus untuk mode demo/presentasi (mudah terdeteksi)
  DEMO_THRESHOLD: 1000,  // $1.000 USD untuk testing/sidang
  
  RISK_LEVELS: {
    ALL: 'ALL',
    HIGH_EXTREME: 'HIGH_EXTREME',
    EXTREME_ONLY: 'EXTREME_ONLY'
  }
};

module.exports = { THRESHOLDS };

