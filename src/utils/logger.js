// src/utils/logger.js
// Logging utility

const LOG_LEVELS = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: 'ℹ️',
  SUCCESS: '✅',
  ADMIN: '🔑',
  ALERT: '🐳'
};

const log = (level, message) => {
  const timestamp = new Date().toLocaleTimeString('id-ID');
  const icon = LOG_LEVELS[level] || '•';
  console.log(`[${timestamp}] ${icon} ${message}`);
};

const logError = (message, err = null) => {
  log('ERROR', message);
  if (err) console.error(err);
};

const logAdmin = (adminName, adminId, action) => {
  log('ADMIN', `${adminName} (${adminId}) ${action}`);
};

const logAlert = (message) => {
  log('ALERT', message);
};

module.exports = {
  log,
  logError,
  logAdmin,
  logAlert,
  LOG_LEVELS
};
