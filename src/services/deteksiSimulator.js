// src/services/deteksiSimulator.js
// Manager untuk simulasi deteksi transaksi ($500 - $1M+) saat presentasi sidang

const activeSimulators = new Map();

function generateRandomDemoAlert(userTokens = []) {
  // Hanya gunakan token utama tema riset skripsi: PEPE, LINK, UNI
  const allowed = ['PEPE', 'LINK', 'UNI'];
  const userFiltered = (userTokens && Array.isArray(userTokens))
    ? userTokens.map(t => String(t).toUpperCase()).filter(t => allowed.includes(t))
    : [];
  const pool = userFiltered.length > 0 ? userFiltered : allowed;
  const token = pool[Math.floor(Math.random() * pool.length)];
  const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';

  // Random USD value between $500 and $1,250,000
  const randType = Math.random();
  let usdValue = 0;
  if (randType < 0.3) {
    usdValue = 500 + Math.random() * 9500; // $500 - $10k
  } else if (randType < 0.7) {
    usdValue = 10000 + Math.random() * 90000; // $10k - $100k
  } else {
    usdValue = 100000 + Math.random() * 1150000; // $100k - $1.25M
  }

  // Realistic unit price per token
  let unitPrice = 1.0;
  if (token === 'PEPE') unitPrice = 0.000008 + Math.random() * 0.000007;
  else if (token === 'LINK') unitPrice = 14 + Math.random() * 5;
  else if (token === 'UNI') unitPrice = 6 + Math.random() * 5;
  else unitPrice = 10 + Math.random() * 10;

  const actionText = direction === 'BUY' ? 'membeli' : 'menjual';
  const circleEmoji = direction === 'BUY' ? '🟢' : '🔴';

  // Format USD ($500, $68.3K, $1.2M)
  let formattedUsd = '';
  if (usdValue >= 1000000) {
    formattedUsd = `$${(usdValue / 1000000).toFixed(1)}M`;
  } else if (usdValue >= 1000) {
    formattedUsd = `$${(usdValue / 1000).toFixed(1)}K`;
  } else {
    formattedUsd = `$${usdValue.toFixed(0)}`;
  }

  // Format Unit Price ($3.00 or $0.000012)
  let formattedPrice = '';
  if (unitPrice >= 1) {
    formattedPrice = `$${unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    formattedPrice = `$${unitPrice.toFixed(6)}`;
  }

  const txHash = '0xDEMO_' + Math.random().toString(36).substring(2, 12);

  const message = `${circleEmoji} Seseorang baru saja ${actionText} (<b>$${token}</b>) Sebesar <b>${formattedUsd}</b> at <b>${formattedPrice}</b>`;

  const alertRecord = {
    tokenSymbol: token,
    token: token,
    direction: direction,
    transactionType: direction,
    usdValue: usdValue,
    valueUSD: usdValue,
    whaleScore: { total: Math.floor(40 + Math.random() * 50) },
    lpImpactPct: 0.001 + Math.random() * 0.02,
    wallet: '0x' + Math.random().toString(36).substring(2, 14),
    txHash: txHash,
    dex: 'Uniswap V3',
    timestamp: Date.now()
  };

  return { message, alertRecord };
}

function scheduleNextAlert(bot, watchlistStore, chatId) {
  const user = watchlistStore.getWatchlist(chatId);
  if (!user || !user.deteksiMode) {
    stopDeteksiSimulator(chatId);
    return;
  }

  // Jeda acak antara 15 detik sampai 25 detik agar tidak spam saat sidang
  const randomDelayMs = 15000 + Math.floor(Math.random() * 10000);

  const timeoutId = setTimeout(async () => {
    try {
      const currentUser = watchlistStore.getWatchlist(chatId);
      if (!currentUser || !currentUser.deteksiMode) {
        stopDeteksiSimulator(chatId);
        return;
      }

      const { message, alertRecord } = generateRandomDemoAlert(currentUser.tokens);

      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      // Save to user alerts and research store for thesis stats consistency
      const StorageManager = require('../storage/StorageManager');
      const alerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
      alertRecord.id = alerts.length + 1;
      alerts.unshift(alertRecord);
      if (alerts.length > 1000) alerts.splice(1000);
      StorageManager.writeUserJSON(chatId, 'alerts.json', alerts);

      if (global.appResearchStore) {
        global.appResearchStore.recordWhale({}, alertRecord);
      }
    } catch (err) {
      console.error('[SIMULATOR ERROR]', err.message);
    } finally {
      if (activeSimulators.has(chatId)) {
        scheduleNextAlert(bot, watchlistStore, chatId);
      }
    }
  }, randomDelayMs);

  activeSimulators.set(chatId, timeoutId);
}

function startDeteksiSimulator(bot, watchlistStore, chatId) {
  stopDeteksiSimulator(chatId); // stop previous if running

  // Notif pertama muncul 5 detik setelah /deteksi on
  const initialTimeout = setTimeout(async () => {
    try {
      const user = watchlistStore.getWatchlist(chatId);
      if (user && user.deteksiMode) {
        const { message, alertRecord } = generateRandomDemoAlert(user.tokens);

        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });

        const StorageManager = require('../storage/StorageManager');
        const alerts = StorageManager.readUserJSON(chatId, 'alerts.json', []);
        alertRecord.id = alerts.length + 1;
        alerts.unshift(alertRecord);
        if (alerts.length > 1000) alerts.splice(1000);
        StorageManager.writeUserJSON(chatId, 'alerts.json', alerts);

        if (global.appResearchStore) {
          global.appResearchStore.recordWhale({}, alertRecord);
        }
      }
    } catch (err) {
      console.error('[SIMULATOR FIRST ERROR]', err.message);
    } finally {
      scheduleNextAlert(bot, watchlistStore, chatId);
    }
  }, 5000);

  activeSimulators.set(chatId, initialTimeout);
}

function stopDeteksiSimulator(chatId) {
  if (activeSimulators.has(chatId)) {
    clearTimeout(activeSimulators.get(chatId));
    activeSimulators.delete(chatId);
  }
}

module.exports = {
  startDeteksiSimulator,
  stopDeteksiSimulator,
  generateRandomDemoAlert
};
