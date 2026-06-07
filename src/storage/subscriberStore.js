// src/storage/watchlistStore.js
// Manajemen data subscriber

const fs = require('fs');
const path = require('path');

const SUBSCRIBERS_FILE = path.join(process.cwd(), 'data', 'subscribers.json');

class watchlistStore {
  constructor() {
    this.subscribers = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(SUBSCRIBERS_FILE)) return new Map();
      const raw = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
      const map = new Map();
      for (const [id, state] of Object.entries(raw)) {
        map.set(parseInt(id), {
          ...state,
          tokens: new Set(state.tokens || ['UNI', 'LINK', 'PEPE'])
        });
      }
      console.log(`📋 ${map.size} subscriber dimuat`);
      return map;
    } catch (err) {
      console.error('Error load subscribers:', err.message);
      return new Map();
    }
  }

  save() {
    try {
      const dir = path.dirname(SUBSCRIBERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [id, state] of this.subscribers) {
        obj[id] = { ...state, tokens: [...state.tokens] };
      }
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error('Error save subscribers:', err.message);
    }
  }

  get(chatId, defaultUser = {}) {
    if (!this.subscribers.has(chatId)) {
      this.subscribers.set(chatId, {
        name: defaultUser.name || 'User',
        tokens: new Set(['UNI', 'LINK', 'PEPE']),
        threshold: 50000,
        riskFilter: 'ALL',
        active: false,
        alertCount: 0,
        joinedAt: new Date().toISOString(),
        ...defaultUser
      });
    }
    return this.subscribers.get(chatId);
  }

  set(chatId, user) {
    this.subscribers.set(chatId, user);
    this.save();
  }

  getAll() {
    return this.subscribers;
  }

  delete(chatId) {
    this.subscribers.delete(chatId);
    this.save();
  }

  count() {
    return this.subscribers.size;
  }

  countActive() {
    return [...this.subscribers.values()].filter(u => u.active).length;
  }
}

module.exports = { watchlistStore };
