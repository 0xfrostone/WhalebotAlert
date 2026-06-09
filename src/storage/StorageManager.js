// src/storage/StorageManager.js
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(process.cwd(), 'storage');

class StorageManager {
  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static getFilePath(filename) {
    this.ensureDir(STORAGE_DIR);
    return path.join(STORAGE_DIR, filename);
  }

  static readJSON(filename, defaultData = null) {
    const filePath = this.getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      return defaultData;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`[StorageManager] Error reading ${filename}:`, err.message);
      return defaultData;
    }
  }

  static writeJSON(filename, data) {
    const filePath = this.getFilePath(filename);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error(`[StorageManager] Error writing ${filename}:`, err.message);
      return false;
    }
  }

  static getExportsPath(filename) {
    const exportsDir = path.join(STORAGE_DIR, 'exports');
    this.ensureDir(exportsDir);
    return path.join(exportsDir, filename);
  }

  static getResearchPath(filename) {
    const researchDir = path.join(STORAGE_DIR, 'research');
    this.ensureDir(researchDir);
    return path.join(researchDir, filename);
  }

  static getBackupsPath(filename) {
    const backupsDir = path.join(STORAGE_DIR, 'backups');
    this.ensureDir(backupsDir);
    return path.join(backupsDir, filename);
  }

  // --- Specific Helpers for Phase 1 ---

  static loadTokens() {
    return this.readJSON('tokens.json', {});
  }
  static saveTokens(data) {
    this.writeJSON('tokens.json', data);
  }

  // --- Multi-User Storage Helpers (Phase 2+) ---

  static getUserDir(userId) {
    const userDir = path.join(STORAGE_DIR, 'users', String(userId));
    this.ensureDir(userDir);
    return userDir;
  }

  static getUserFilePath(userId, filename) {
    const userDir = this.getUserDir(userId);
    return path.join(userDir, filename);
  }

  static readUserJSON(userId, filename, defaultData = null) {
    const filePath = this.getUserFilePath(userId, filename);
    if (!fs.existsSync(filePath)) {
      return defaultData;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`[StorageManager] Error reading user ${userId} ${filename}:`, err.message);
      return defaultData;
    }
  }

  static writeUserJSON(userId, filename, data) {
    const filePath = this.getUserFilePath(userId, filename);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error(`[StorageManager] Error writing user ${userId} ${filename}:`, err.message);
      return false;
    }
  }
}

module.exports = StorageManager;
