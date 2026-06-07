// src/storage/storeBase.js
// Base class for JSON file storage

const StorageManager = require('./StorageManager');

class StoreBase {
  constructor(filename, defaultData = {}) {
    this.filename = filename;
    this.defaultData = defaultData;
    this.data = this.load();
  }

  load() {
    return StorageManager.readJSON(this.filename, this.defaultData);
  }

  save() {
    StorageManager.writeJSON(this.filename, this.data);
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

module.exports = { StoreBase };
