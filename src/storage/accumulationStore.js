// src/storage/accumulationStore.js
const { StoreBase } = require('./storeBase');

class AccumulationStore extends StoreBase {
  constructor() {
    super('accumulation.json', {});
  }

  getWalletActivity(wallet, tokenSymbol) {
    const key = `${wallet.toLowerCase()}_${tokenSymbol.toUpperCase()}`;
    if (!this.data[key]) {
      this.data[key] = {
        wallet: wallet.toLowerCase(),
        token: tokenSymbol.toUpperCase(),
        direction: 'BUY', // Accumulation usually tracks BUYS, but we can track both
        transactions: []
      };
    }
    return this.data[key];
  }

  addTransaction(wallet, tokenSymbol, direction, txData) {
    const key = `${wallet.toLowerCase()}_${tokenSymbol.toUpperCase()}`;
    const activity = this.getWalletActivity(wallet, tokenSymbol);
    
    // We can reset if direction changes completely, or track them together.
    // For accumulation, it usually means buying over time.
    // We will just append the transaction.
    activity.direction = direction;
    activity.transactions.push({
      timestamp: Date.now(),
      usdValue: txData.usdValue,
      impactPct: txData.lpImpactPct
    });

    this.save();
    return activity;
  }

  cleanupOldTransactions(wallet, tokenSymbol, maxAgeMs) {
    const activity = this.getWalletActivity(wallet, tokenSymbol);
    const now = Date.now();
    activity.transactions = activity.transactions.filter(tx => (now - tx.timestamp) <= maxAgeMs);
    this.save();
    return activity;
  }
}

module.exports = { AccumulationStore };
