// src/blockchain/listener.js
// Mendengarkan event Swap dari Uniswap V2 dan V3 secara real-time

const { ethers } = require('ethers');

// ============================================================
// ABI — Hanya event yang kita butuhkan
// ============================================================

const UNISWAP_V2_PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
];

const UNISWAP_V3_POOL_ABI = [
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
];

const { TokenStore } = require('../storage/tokenStore');

// ============================================================
// BLOCKCHAIN LISTENER CLASS
// ============================================================

class BlockchainListener {
  constructor(wssUrl, onSwapCallback) {
    this.wssUrl = wssUrl;
    this.onSwapCallback = onSwapCallback;
    this.provider = null;
    this.interfaces = {
      v2: new ethers.Interface(UNISWAP_V2_PAIR_ABI),
      v3: new ethers.Interface(UNISWAP_V3_POOL_ABI)
    };
    this.reconnectDelay = 3000;  // 3 detik awal
    this.isRunning = false;
    this.totalEventsReceived = 0;
    this.tokenStore = new TokenStore();
    this.activePools = 0;
  }

  async start() {
    this.isRunning = true;
    console.log('🔌 Menghubungkan ke Ethereum...');
    await this.connect();
  }

  async connect() {
    try {
      // Tutup koneksi lama jika ada
      if (this.provider) {
        this.provider.removeAllListeners();
        this.provider.destroy();
      }

      this.provider = new ethers.WebSocketProvider(this.wssUrl);

      // Test koneksi
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`✅ Terhubung ke Ethereum! Block terbaru: #${blockNumber.toLocaleString()}`);
      
      // Reset reconnect delay setelah berhasil
      this.reconnectDelay = 3000;

      // Setup listeners untuk semua pool
      await this.setupPoolListeners();

      // Monitor kesehatan koneksi
      this.setupHealthCheck();

    } catch (error) {
      console.error(`❌ Gagal terhubung: ${error.message}`);
      await this.scheduleReconnect();
    }
  }

  async setupPoolListeners() {
    const tokens = this.tokenStore.getAllTokens();
    let count = 0;
    
    for (const token of tokens) {
      if (token.pools && token.pools.length > 0) {
        for (const pool of token.pools) {
          this.attachPoolListener(pool);
          count++;
        }
      }
    }

    console.log(`\n🚀 Sistem aktif! Memantau ${count} pool...\n`);
  }

  attachPoolListener(pool) {
    const filter = {
      address: pool.address,
      topics: [
        pool.version === 2
          ? this.interfaces.v2.getEvent('Swap').topicHash
          : this.interfaces.v3.getEvent('Swap').topicHash
      ]
    };

    this.provider.on(filter, async (log) => {
      try {
        await this.processSwapLog(log, pool);
      } catch (err) {
        console.error(`Error proses log: ${err.message}`);
      }
    });

    console.log(`👂 Memantau pool ${pool.token0Symbol}/${pool.token1Symbol} (${pool.dex})`);
    this.activePools++;
  }

  addNewToken(tokenData) {
    console.log(`[LISTENER] Menambahkan token baru secara dinamis: ${tokenData.symbol}`);
    if (tokenData.pools && tokenData.pools.length > 0) {
      for (const pool of tokenData.pools) {
        this.attachPoolListener(pool);
      }
    }
  }

  async processSwapLog(log, pool) {
    this.totalEventsReceived++;

    let decoded;
    let swapData;

    try {
      if (pool.version === 2) {
        decoded = this.interfaces.v2.parseLog(log);
        swapData = this.parseV2Swap(decoded, pool);
      } else {
        decoded = this.interfaces.v3.parseLog(log);
        swapData = this.parseV3Swap(decoded, pool);
      }

      if (!swapData) return;

      // Tambah metadata
      swapData.txHash = log.transactionHash;
      swapData.blockNumber = log.blockNumber;
      swapData.pool = pool;
      swapData.timestamp = Date.now();

      console.log(`📡 [LISTENER] Event #${this.totalEventsReceived}: ${pool.token0Symbol}/${pool.token1Symbol} | TX: ${log.transactionHash.slice(0, 10)}...`);

      // Kirim ke callback (detector)
      await this.onSwapCallback(swapData);

    } catch (err) {
      // Skip jika gagal decode (bukan event yang kita kenal)
      console.error(`⚠️ [LISTENER] Decode error: ${err.message}`);
    }
  }

  parseV2Swap(decoded, pool) {
    const { amount0In, amount1In, amount0Out, amount1Out } = decoded.args;

    // Tentukan arah transaksi
    let tokenInSymbol, tokenOutSymbol;
    let amountIn, amountOut;
    let tokenInDecimals, tokenOutDecimals;

    if (amount0In > 0n) {
      // token0 masuk → token1 keluar
      tokenInSymbol = pool.token0Symbol;
      tokenOutSymbol = pool.token1Symbol;
      amountIn = amount0In;
      amountOut = amount1Out;
      tokenInDecimals = pool.token0Decimals;
      tokenOutDecimals = pool.token1Decimals;
    } else {
      // token1 masuk → token0 keluar
      tokenInSymbol = pool.token1Symbol;
      tokenOutSymbol = pool.token0Symbol;
      amountIn = amount1In;
      amountOut = amount0Out;
      tokenInDecimals = pool.token1Decimals;
      tokenOutDecimals = pool.token0Decimals;
    }

    return {
      tokenIn: tokenInSymbol,
      tokenOut: tokenOutSymbol,
      amountIn: parseFloat(ethers.formatUnits(amountIn, tokenInDecimals)),
      amountOut: parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals)),
      wallet: decoded.args.sender,
      direction: this.getDirection(tokenInSymbol, pool),
    };
  }

  parseV3Swap(decoded, pool) {
    const { sender, amount0, amount1 } = decoded.args;

    let tokenInSymbol, tokenOutSymbol;
    let amountIn, amountOut;
    let tokenInDecimals, tokenOutDecimals;

    // Di V3: amount positif = masuk ke pool, negatif = keluar dari pool
    if (amount0 > 0n) {
      tokenInSymbol = pool.token0Symbol;
      tokenOutSymbol = pool.token1Symbol;
      amountIn = amount0;
      amountOut = -amount1;  // negatif karena keluar
      tokenInDecimals = pool.token0Decimals;
      tokenOutDecimals = pool.token1Decimals;
    } else {
      tokenInSymbol = pool.token1Symbol;
      tokenOutSymbol = pool.token0Symbol;
      amountIn = amount1;
      amountOut = -amount0;
      tokenInDecimals = pool.token1Decimals;
      tokenOutDecimals = pool.token0Decimals;
    }

    return {
      tokenIn: tokenInSymbol,
      tokenOut: tokenOutSymbol,
      amountIn: parseFloat(ethers.formatUnits(amountIn, tokenInDecimals)),
      amountOut: parseFloat(ethers.formatUnits(amountOut > 0n ? amountOut : -amountOut, tokenOutDecimals)),
      wallet: sender,
      direction: this.getDirection(tokenInSymbol, pool),
    };
  }

  getDirection(tokenIn, pool) {
    // BUY = menukar WETH/USDT ke token meme
    // SELL = menukar token meme ke WETH/USDT
    const stableTokens = ['WETH', 'USDT', 'USDC', 'DAI', 'WBTC'];
    return stableTokens.includes(tokenIn) ? 'BUY' : 'SELL';
  }

  setupHealthCheck() {
    // Ping setiap 30 detik untuk pastikan koneksi masih hidup
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.provider.getBlockNumber();
      } catch (err) {
        console.warn('⚠️  Koneksi terputus, reconnecting...');
        clearInterval(this.healthCheckInterval);
        await this.scheduleReconnect();
      }
    }, 30000);
  }

  async scheduleReconnect() {
    if (!this.isRunning) return;
    
    console.log(`🔄 Mencoba reconnect dalam ${this.reconnectDelay / 1000} detik...`);
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
    
    // Exponential backoff: 3s → 6s → 12s → max 60s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
    
    await this.connect();
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.healthCheckInterval);
    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider.destroy();
    }
    console.log('🛑 Listener dihentikan.');
  }

  getStats() {
    return {
      totalEvents: this.totalEventsReceived,
      poolsMonitored: this.activePools
    };
  }
}

module.exports = { BlockchainListener };
