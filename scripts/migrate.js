// scripts/migrate.js
// Migration script from subscribers.json to new store architecture

const fs = require('fs');
const path = require('path');
const { TokenStore } = require('../src/storage/tokenStore');
const { WatchlistStore } = require('../src/storage/watchlistStore');

const DATA_DIR = path.join(process.cwd(), 'data');
const OLD_SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

function runMigration() {
  console.log('🔄 Starting Database Migration...');

  // 1. Initialize Stores
  const tokenStore = new TokenStore();
  const watchlistStore = new WatchlistStore();

  // 2. Migrate Tokens
  // We will pull the hardcoded pools from listener.js (we need to extract them first, but for now we hardcode the initial tokens)
  const initialTokens = {
    UNI: {
      symbol: 'UNI',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18,
      pools: [
        { address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17', dex: 'Uniswap V2', version: 2, token0Symbol: 'UNI', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801', dex: 'Uniswap V3 (0.3%)', version: 3, token0Symbol: 'UNI', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0x360b9726186C0F62cc719450685ce70280774Dc8', dex: 'Uniswap V3 (1%)', version: 3, token0Symbol: 'UNI', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 }
      ]
    },
    LINK: {
      symbol: 'LINK',
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      decimals: 18,
      pools: [
        { address: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974', dex: 'Uniswap V2', version: 2, token0Symbol: 'LINK', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8', dex: 'Uniswap V3 (0.3%)', version: 3, token0Symbol: 'LINK', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0x3A0f221eA8B150f3D3d27DE8928851aB5264bB65', dex: 'Uniswap V3 (1%)', version: 3, token0Symbol: 'LINK', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 }
      ]
    },
    PEPE: {
      symbol: 'PEPE',
      address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      decimals: 18,
      pools: [
        { address: '0x11950d141EcB863F01007AdD7D1A342041227b58', dex: 'Uniswap V3 (0.3%)', version: 3, token0Symbol: 'PEPE', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0xF239009A101B6B930A527DEaaB6961b6E7deC8a6', dex: 'Uniswap V3 (1%)', version: 3, token0Symbol: 'PEPE', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 },
        { address: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f', dex: 'Uniswap V2', version: 2, token0Symbol: 'PEPE', token1Symbol: 'WETH', token0Decimals: 18, token1Decimals: 18, baseTokenIndex: 1 }
      ]
    }
  };

  Object.values(initialTokens).forEach(t => {
    if (!tokenStore.hasToken(t.symbol)) {
      tokenStore.addToken(t);
      console.log(`✅ Token ${t.symbol} added to tokenStore`);
    }
  });

  // 3. Migrate Subscribers
  if (fs.existsSync(OLD_SUBSCRIBERS_FILE)) {
    try {
      const subscribers = JSON.parse(fs.readFileSync(OLD_SUBSCRIBERS_FILE, 'utf8'));
      for (const [chatId, data] of Object.entries(subscribers)) {
        // watchlists.json
        watchlistStore.saveWatchlist(chatId, {
          name: data.name,
          tokens: Array.isArray(data.tokens) ? data.tokens : (data.tokens ? Array.from(data.tokens) : []),
          threshold: data.threshold,
          riskFilter: data.riskFilter,
          active: data.active,
          alertCount: data.alertCount,
          joinedAt: data.joinedAt
        });
        console.log(`✅ Migrated user ${chatId} (${data.name}) to watchlistStore`);
      }
    } catch (err) {
      console.error('❌ Error reading subscribers.json:', err.message);
    }
  } else {
    console.log('⚠️ subscribers.json not found, skipping user migration.');
  }

  console.log('🎉 Migration completed successfully!');
}

runMigration();
