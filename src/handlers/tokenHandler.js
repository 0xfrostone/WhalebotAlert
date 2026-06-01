// src/handlers/tokenHandler.js
// Handler untuk token selection

const { THRESHOLDS } = require('../config/thresholds');

class TokenHandler {
  static buildMenu(user) {
    const c = (t) => user.tokens.has(t) ? '✅' : '⬜';
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
          { text: '← Kembali', callback_data: 'menu_back' }
        ]
      ]
    };
  }

  static handleToggle(user, token) {
    user.tokens.has(token) ? user.tokens.delete(token) : user.tokens.add(token);
  }

  static handleSelectAll(user) {
    user.tokens = new Set(['UNI', 'LINK', 'PEPE']);
  }

  static handleSelectNone(user) {
    user.tokens = new Set();
  }

  static getSelectedText(user) {
    return user.tokens.size
      ? [...user.tokens].map(t => `<b>$${t}</b>`).join(', ')
      : '<i>Tidak ada</i>';
  }
}

module.exports = { TokenHandler };
