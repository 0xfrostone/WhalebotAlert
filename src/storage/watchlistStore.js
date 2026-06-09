// src/storage/watchlistStore.js
const fs = require('fs');
const path = require('path');
const StorageManager = require('./StorageManager');

class WatchlistStore {
  constructor() {}

  getSettings(chatId, name = 'User') {
    let settings = StorageManager.readUserJSON(chatId, 'settings.json');
    if (!settings) {
      settings = {
        chatId: chatId,
        name: name,
        threshold: 50000,
        riskFilter: 'ALL',
        active: false,
        alertCount: 0,
        joinedAt: new Date().toISOString()
      };
      StorageManager.writeUserJSON(chatId, 'settings.json', settings);
    }
    return settings;
  }

  saveSettings(chatId, data) {
    const settings = {
      ...this.getSettings(chatId),
      ...data,
      updatedAt: new Date().toISOString()
    };
    StorageManager.writeUserJSON(chatId, 'settings.json', settings);
  }

  getTokens(chatId) {
    let watchlist = StorageManager.readUserJSON(chatId, 'watchlist.json');
    if (!watchlist || !Array.isArray(watchlist.tokens)) {
      watchlist = { tokens: [] };
      StorageManager.writeUserJSON(chatId, 'watchlist.json', watchlist);
    }
    return watchlist.tokens;
  }

  saveTokens(chatId, tokens) {
    StorageManager.writeUserJSON(chatId, 'watchlist.json', { tokens });
  }

  // Compatibility method for bot.js
  getWatchlist(chatId, name = 'User') {
    const settings = this.getSettings(chatId, name);
    const tokens = this.getTokens(chatId);
    return { ...settings, tokens };
  }

  // Compatibility method for bot.js
  set(chatId, userObj) {
    this.saveSettings(chatId, {
      name: userObj.name,
      threshold: userObj.threshold,
      riskFilter: userObj.riskFilter,
      active: userObj.active,
      alertCount: userObj.alertCount
    });
    this.saveTokens(chatId, userObj.tokens || []);
  }

  saveWatchlist(chatId, data) {
    this.set(chatId, data);
  }

  hasToken(chatId, tokenSymbol) {
    const tokens = this.getTokens(chatId);
    return tokens.includes(tokenSymbol.toUpperCase());
  }

  addToken(chatId, tokenSymbol) {
    const tokens = this.getTokens(chatId);
    const sym = tokenSymbol.toUpperCase();
    if (!tokens.includes(sym)) {
      tokens.push(sym);
      this.saveTokens(chatId, tokens);
    }
  }

  removeToken(chatId, tokenSymbol) {
    let tokens = this.getTokens(chatId);
    const sym = tokenSymbol.toUpperCase();
    tokens = tokens.filter(t => t !== sym);
    this.saveTokens(chatId, tokens);
  }

  getAll() {
    const usersDir = path.join(process.cwd(), 'storage', 'users');
    if (!fs.existsSync(usersDir)) return {};

    const allSubs = {};
    const dirs = fs.readdirSync(usersDir);
    
    for (const dir of dirs) {
      const chatId = dir;
      const settings = StorageManager.readUserJSON(chatId, 'settings.json');
      if (settings) {
        allSubs[chatId] = settings;
      }
    }
    return allSubs;
  }

  getAllActiveSubscribers() {
    const usersDir = path.join(process.cwd(), 'storage', 'users');
    if (!fs.existsSync(usersDir)) return [];

    const activeSubs = [];
    const dirs = fs.readdirSync(usersDir);
    
    for (const dir of dirs) {
      const chatId = dir;
      const settings = StorageManager.readUserJSON(chatId, 'settings.json');
      if (settings && settings.active) {
        const tokens = this.getTokens(chatId);
        activeSubs.push({ ...settings, tokens });
      }
    }
    return activeSubs;
  }

  save() {
    // No-op for global save, we save per user now
  }

  delete(chatId) {
    // If blocked or not found, we mark as inactive instead of deleting history
    const settings = this.getSettings(chatId);
    settings.active = false;
    this.saveSettings(chatId, settings);
  }
}

module.exports = { WatchlistStore };
