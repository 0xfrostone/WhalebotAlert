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

// ============================================================
// DAFTAR POOL YANG DIPANTAU
// ============================================================

// Format: { address, dex, token0Symbol, token1Symbol, token0Decimals, token1Decimals, version }
// Penelitian fokus pada 3 token ERC-20: UNI, LINK, PEPE
//
// PENTING: Pool address harus sesuai dengan version!
// - version: 2 → menggunakan V2 Swap ABI (amount0In, amount1In, amount0Out, amount1Out)
// - version: 3 → menggunakan V3 Swap ABI (amount0, amount1, sqrtPriceX96, liquidity, tick)
// Jika salah, event akan gagal decode secara silent!
//
// Pool addresses verified on-chain via Uniswap V3 Factory.getPool() — 2026-06-02
const WATCHED_POOLS = [

  // ================================================================
  // === UNI (Uniswap Governance Token) ===
  // Contract: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
  // ================================================================
  {
    address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17',
    dex: 'Uniswap V2',
    token0Symbol: 'UNI',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 2,
    baseTokenIndex: 1,
    tokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
  },
  {
    // Verified on-chain: Factory.getPool(UNI, WETH, 3000) = 0x1d42064F...
    address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801',
    dex: 'Uniswap V3 (0.3%)',
    token0Symbol: 'UNI',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
  },
  {
    // UNI/WETH V3 1% fee — large trades often route through 1% pools
    // Verified on-chain: Factory.getPool(UNI, WETH, 10000) = 0x360b9726...
    address: '0x360b9726186C0F62cc719450685ce70280774Dc8',
    dex: 'Uniswap V3 (1%)',
    token0Symbol: 'UNI',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
  },

  // ================================================================
  // === LINK (Chainlink Oracle Token) ===
  // Contract: 0x514910771AF9Ca656af840dff83E8264EcF986CA
  // ================================================================
  {
    address: '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974',
    dex: 'Uniswap V2',
    token0Symbol: 'LINK',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 2,
    baseTokenIndex: 1,
    tokenAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
  },
  {
    // Verified on-chain: Factory.getPool(LINK, WETH, 3000) = 0xa6Cc3C25...
    address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8',
    dex: 'Uniswap V3 (0.3%)',
    token0Symbol: 'LINK',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
  },
  {
    // LINK/WETH V3 1% fee — whale transactions often use this pool
    // Verified on-chain: Factory.getPool(LINK, WETH, 10000) = 0x3A0f221e...
    address: '0x3A0f221eA8B150f3D3d27DE8928851aB5264bB65',
    dex: 'Uniswap V3 (1%)',
    token0Symbol: 'LINK',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
  },

  // ================================================================
  // === PEPE (Meme Coin ERC-20) ===
  // Contract: 0x6982508145454Ce325dDbE47a25d4ec3d2311933
  //
  // ⚠️ BUG FIX: Alamat lama 0xa43fe169... adalah pool Uniswap V2,
  // BUKAN V3! Kode sebelumnya mendeklarasikan version: 3 sehingga
  // menggunakan V3 ABI untuk decode event V2 → decode SELALU gagal
  // → event dibuang secara silent → PEPE tidak pernah terdeteksi!
  // ================================================================
  {
    // PEPE/WETH V3 0.3% — CORRECT address verified on-chain
    // Factory.getPool(PEPE, WETH, 3000) = 0x11950d14...
    address: '0x11950d141EcB863F01007AdD7D1A342041227b58',
    dex: 'Uniswap V3 (0.3%)',
    token0Symbol: 'PEPE',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
  },
  {
    // PEPE/WETH V3 1% fee — high volume for meme coin trades
    // Factory.getPool(PEPE, WETH, 10000) = 0xF239009A...
    address: '0xF239009A101B6B930A527DEaaB6961b6E7deC8a6',
    dex: 'Uniswap V3 (1%)',
    token0Symbol: 'PEPE',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 3,
    baseTokenIndex: 1,
    tokenAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
  },
  {
    // PEPE/WETH V2 — alamat lama, sekarang dengan version: 2 yang benar
    address: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
    dex: 'Uniswap V2',
    token0Symbol: 'PEPE',
    token1Symbol: 'WETH',
    token0Decimals: 18,
    token1Decimals: 18,
    version: 2,
    baseTokenIndex: 1,
    tokenAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
  }
];


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
    for (const pool of WATCHED_POOLS) {
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
    }

    console.log(`\n🚀 Sistem aktif! Memantau ${WATCHED_POOLS.length} pool...\n`);
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
      poolsMonitored: WATCHED_POOLS.length
    };
  }
}

module.exports = { BlockchainListener, WATCHED_POOLS };
