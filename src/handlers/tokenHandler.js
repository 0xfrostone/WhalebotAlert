// src/handlers/tokenHandler.js
// Handler untuk token selection

const { THRESHOLDS } = require('../config/thresholds');

class TokenHandler {
  static buildMenu(user) {
    const tokens = user.tokens || [];
    const c = (t) => tokens.includes(t) ? '✅' : '⬜';
    return {
      inline_keyboard: [
        [
          { text: `${c('UNI')}  $UNI — Uniswap Token`, callback_data: 'token_toggle_UNI' },
          { text: '📈 Chart', callback_data: 'chart_UNI' }
        ],
        [
          { text: `${c('LINK')} $LINK — Chainlink Token`, callback_data: 'token_toggle_LINK' },
          { text: '📈 Chart', callback_data: 'chart_LINK' }
        ],
        [
          { text: `${c('PEPE')} $PEPE — Meme Coin`, callback_data: 'token_toggle_PEPE' },
          { text: '📈 Chart', callback_data: 'chart_PEPE' }
        ],
        [
          { text: '✅ Semua', callback_data: 'token_all' },
          { text: '❌ Reset', callback_data: 'token_none' }
        ],
        [
          { text: '✔️ Simpan', callback_data: 'token_confirm' },
          { text: '← Kembali', callback_data: 'nav_watchlist' }
        ]
      ]
    };
  }

  static handleToggle(user, token) {
    if (!user.tokens) user.tokens = [];
    const index = user.tokens.indexOf(token);
    if (index > -1) {
      user.tokens.splice(index, 1);
    } else {
      user.tokens.push(token);
    }
  }

  static handleSelectAll(user) {
    user.tokens = ['UNI', 'LINK', 'PEPE'];
  }

  static handleSelectNone(user) {
    user.tokens = [];
  }

  static getSelectedText(user) {
    const tokens = user.tokens || [];
    return tokens.length
      ? tokens.map(t => `<b>$${t}</b>`).join(', ')
      : '<i>Tidak ada</i>';
  }
}

module.exports = { TokenHandler };
