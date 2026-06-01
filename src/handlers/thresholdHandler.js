// src/handlers/thresholdHandler.js
// Handler untuk threshold selection

const { THRESHOLDS } = require('../config/thresholds');

class ThresholdHandler {
  static buildMenu(user) {
    const c = (v) => user.threshold === v ? '✅ ' : '';
    return {
      inline_keyboard: [
        [
          { text: `${c(1000)}🎬 Demo ($1K)`, callback_data: 'thr_1000' },
          { text: `${c(10000)}$10K`, callback_data: 'thr_10000' }
        ],
        [
          { text: `${c(50000)}$50K ✦`, callback_data: 'thr_50000' },
          { text: `${c(100000)}$100K`, callback_data: 'thr_100000' }
        ],
        [
          { text: `${c(500000)}$500K`, callback_data: 'thr_500000' },
          { text: `${c(1000000)}$1M`, callback_data: 'thr_1000000' }
        ],
        [
          { text: '✔️ Simpan', callback_data: 'thr_confirm' },
          { text: '← Kembali', callback_data: 'menu_back' }
        ]
      ]
    };
  }

  static handleSelect(user, thresholdValue) {
    const val = parseInt(thresholdValue);
    if (!isNaN(val)) {
      user.threshold = val;
    }
  }
}

module.exports = { ThresholdHandler };

