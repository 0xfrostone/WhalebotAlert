// src/storage/tokenStore.js
const { StoreBase } = require('./storeBase');

class TokenStore extends StoreBase {
  constructor() {
    super('tokens.json', {});
  }

  addToken(tokenData) {
    // Key by symbol (uppercase) for easy lookup
    const symbol = tokenData.symbol.toUpperCase();
    this.data[symbol] = {
      ...tokenData,
      addedAt: new Date().toISOString()
    };
    this.save();
    return this.data[symbol];
  }

  getToken(symbol) {
    return this.data[symbol.toUpperCase()];
  }

  getAllTokens() {
    return Object.values(this.data);
  }

  hasToken(symbol) {
    return !!this.data[symbol.toUpperCase()];
  }
}

module.exports = { TokenStore };
