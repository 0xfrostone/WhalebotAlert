// src/storage/maintenanceStore.js
// Manajemen data maintenance state

const fs = require('fs');
const path = require('path');

const MAINTENANCE_FILE = path.join(process.cwd(), 'data', 'maintenance.json');

class MaintenanceStore {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(MAINTENANCE_FILE)) {
        return { active: false, reason: '', startTime: null };
      }
      return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
    } catch (err) {
      console.error('Error load maintenance:', err.message);
      return { active: false, reason: '', startTime: null };
    }
  }

  save() {
    try {
      const dir = path.dirname(MAINTENANCE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.error('Error save maintenance:', err.message);
    }
  }

  activate(reason = 'Admin maintenance') {
    this.state = {
      active: true,
      reason,
      startTime: new Date().toISOString()
    };
    this.save();
  }

  deactivate() {
    const oldReason = this.state.reason;
    const uptimeMins = this.state.startTime
      ? Math.floor((Date.now() - new Date(this.state.startTime).getTime()) / 1000 / 60)
      : 0;

    this.state = { active: false, reason: '', startTime: null };
    this.save();

    return { oldReason, uptimeMins };
  }

  isActive() {
    return this.state.active;
  }

  getState() {
    return this.state;
  }

  getUptimeMinutes() {
    if (!this.state.startTime) return 0;
    return Math.floor((Date.now() - new Date(this.state.startTime).getTime()) / 1000 / 60);
  }
}

module.exports = { MaintenanceStore };
