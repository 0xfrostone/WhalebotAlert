// src/handlers/riskHandler.js
// Handler untuk risk filter selection

class RiskHandler {
  static buildMenu(user) {
    const c = (v) => user.riskFilter === v ? '✅ ' : '';
    return {
      inline_keyboard: [
        [{ text: `${c('ALL')}Semua Risiko (LOW → EXTREME)`, callback_data: 'risk_ALL' }],
        [{ text: `${c('HIGH_EXTREME')}HIGH & EXTREME saja`, callback_data: 'risk_HIGH_EXTREME' }],
        [{ text: `${c('EXTREME_ONLY')}EXTREME saja 🚨`, callback_data: 'risk_EXTREME_ONLY' }],
        [
          { text: '✔️ Simpan', callback_data: 'risk_confirm' },
          { text: '← Kembali', callback_data: 'menu_back' }
        ]
      ]
    };
  }

  static handleSelect(user, riskLevel) {
    user.riskFilter = riskLevel;
  }

  static getLabelText(riskLevel) {
    const labels = {
      ALL: 'Semua Risiko',
      HIGH_EXTREME: 'HIGH & EXTREME',
      EXTREME_ONLY: 'EXTREME saja'
    };
    return labels[riskLevel] || 'Unknown';
  }
}

module.exports = { RiskHandler };
