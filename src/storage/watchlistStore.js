// src/storage/watchlistStore.js
const { StoreBase } = require('./storeBase');

class WatchlistStore extends StoreBase {
  constructor() {
    super('watchlists.json', {});
  }

  getWatchlist(chatId, name = 'User') {
    if (!this.data[chatId]) {
      this.data[chatId] = {
        chatId: chatId,
        name: name,
        tokens: [], // Default to empty, they must add tokens
        threshold: 50000,
        riskFilter: 'ALL',
        active: false,
        alertCount: 0,
        joinedAt: new Date().toISOString()
      };
      this.save();
    }
    // Update name if it's missing (for older accounts)
    if (!this.data[chatId].name) {
      this.data[chatId].name = name;
      this.save();
    }
    return this.data[chatId];
  }

  saveWatchlist(chatId, data) {
    this.data[chatId] = {
      ...this.getWatchlist(chatId),
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.save();
  }

  hasToken(chatId, tokenSymbol) {
    const list = this.getWatchlist(chatId);
    return list.tokens.includes(tokenSymbol.toUpperCase());
  }

  addToken(chatId, tokenSymbol) {
    const list = this.getWatchlist(chatId);
    const sym = tokenSymbol.toUpperCase();
    if (!list.tokens.includes(sym)) {
      list.tokens.push(sym);
      this.saveWatchlist(chatId, list);
    }
  }

  removeToken(chatId, tokenSymbol) {
    const list = this.getWatchlist(chatId);
    const sym = tokenSymbol.toUpperCase();
    list.tokens = list.tokens.filter(t => t !== sym);
    this.saveWatchlist(chatId, list);
  }

  getAllActiveSubscribers() {
    return Object.values(this.data).filter(sub => sub.active);
  }
}

module.exports = { WatchlistStore };
