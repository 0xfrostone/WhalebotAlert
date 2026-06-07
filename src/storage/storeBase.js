// src/storage/storeBase.js
// Base class for JSON file storage

const fs = require('fs');
const path = require('path');

class StoreBase {
  constructor(filename, defaultData = {}) {
    this.dataDir = path.join(process.cwd(), 'data');
    this.filePath = path.join(this.dataDir, filename);
    this.defaultData = defaultData;
    this.data = this.load();
  }

  ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  load() {
    this.ensureDir();
    try {
      if (!fs.existsSync(this.filePath)) {
        return this.defaultData;
      }
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      console.error(`[StoreBase] Error loading ${this.filePath}:`, err.message);
      return this.defaultData;
    }
  }

  save() {
    this.ensureDir();
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error(`[StoreBase] Error saving ${this.filePath}:`, err.message);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  delete(key) {
    delete this.data[key];
    this.save();
  }

  getAll() {
    return this.data;
  }
}

module.exports = { StoreBase };
