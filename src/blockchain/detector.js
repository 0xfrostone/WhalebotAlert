// src/blockchain/detector.js
// Menghitung Whale Score dan memutuskan apakah perlu kirim alert

const axios = require('axios');
const { formatUSDLog, debugFormatUSD } = require('../utils/formatter');

// ============================================================
// PRICE CACHE — Hindari terlalu banyak request API
// ============================================================
const priceCache = new Map();
const PRICE_CACHE_TTL = 60000;  // 1 menit

async function getEthPrice() {
  const now = Date.now();
  const cached = priceCache.get('ETH');
  
  if (cached && (now - cached.timestamp) < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { timeout: 5000 }
    );
    const price = response.data.ethereum.usd;
    priceCache.set('ETH', { price, timestamp: now });
    return price;
  } catch (err) {
    // Fallback ke harga terakhir atau estimasi
    return cached ? cached.price : 3200;
  }
}

// ============================================================
// KONVERSI KE USD
// ============================================================
async function calculateUsdValue(swapData) {
  const { tokenIn, tokenOut, amountIn, amountOut, direction } = swapData;

  console.log(`   [USD Calc] tokenIn=${tokenIn} amountIn=${amountIn} | tokenOut=${tokenOut} amountOut=${amountOut}`);

  // Jika melibatkan USDT/USDC langsung
  if (tokenIn === 'USDT' || tokenIn === 'USDC') {
    const result = amountIn;
    console.log(`   [USD Calc] Result: ${formatUSDLog(result)} (dari ${tokenIn}, raw=${result})`);
    return result;
  }
  if (tokenOut === 'USDT' || tokenOut === 'USDC') {
    const result = amountOut;
    console.log(`   [USD Calc] Result: ${formatUSDLog(result)} (dari ${tokenOut}, raw=${result})`);
    return result;
  }

  // Jika melibatkan WETH
  const ethPrice = await getEthPrice();
  console.log(`   [USD Calc] ETH Price: ${formatUSDLog(ethPrice)}`);
  
  if (tokenIn === 'WETH') {
    const result = amountIn * ethPrice;
    console.log(`   [USD Calc] Result: ${formatUSDLog(result)} (${amountIn} WETH × ${formatUSDLog(ethPrice)}, raw=${result})`);
    return result;
  }
  if (tokenOut === 'WETH') {
    const result = amountOut * ethPrice;
    console.log(`   [USD Calc] Result: ${formatUSDLog(result)} (${amountOut} WETH × ${formatUSDLog(ethPrice)}, raw=${result})`);
    return result;
  }

  // Fallback: estimasi kasar
  console.log(`   [USD Calc] FALLBACK: Neither token is USDT/USDC/WETH! Return 0`);
  return 0;
}

// ============================================================
// HITUNG LIQUIDITY POOL SIZE
// Kita gunakan estimasi karena butuh RPC call tambahan
// Untuk produksi: tambahkan getReserves() call
// Sumber TVL: data.uniswap.org (update berkala)
// ============================================================
const poolTVLEstimates = {
  // UNI — likuiditas tinggi, blue chip DeFi
  'UNI_WETH_v2':   8_500_000,    // ~$8.5M TVL (Uniswap V2)
  'UNI_WETH_v3':  15_000_000,    // ~$15M TVL  (Uniswap V3)

  // LINK — institusional, TVL signifikan (DexScreener: ~$20.8M)
  'LINK_WETH_v2': 12_000_000,    // ~$12M TVL  (Uniswap V2)
  'LINK_WETH_v3': 20_000_000,    // ~$20M TVL  (Uniswap V3)

  // PEPE — meme coin, TVL fluktuatif
  'PEPE_WETH_v2': 10_000_000,    // ~$10M TVL  (Uniswap V2)
  'PEPE_WETH_v3': 25_000_000,    // ~$25M TVL  (Uniswap V3)
};

function estimatePoolTVL(pool) {
  // Key format: TOKEN_PASANGAN_dex (contoh: UNI_WETH_v3)
  const dexVersion = pool.version === 2 ? 'v2' : 'v3';
  const key = `${pool.token0Symbol}_${pool.token1Symbol}_${dexVersion}`;
  return poolTVLEstimates[key] || 5_000_000;  // Default $5M untuk pool tidak dikenal
}

// ============================================================
// HITUNG SUB-SCORE
// ============================================================

// Sub-score 1: Ukuran Transaksi (0-100)
function calcTxSizeScore(usdValue) {
  if (usdValue <= 0) return 0;
  // Logaritmik: $1k=20, $10k=40, $100k=60, $500k=80, $1M+=95
  const score = (Math.log10(usdValue) / Math.log10(2_000_000)) * 100;
  return Math.min(Math.max(score, 0), 100);
}

// Sub-score 2: Dampak LP (0-100)
function calcLPImpactScore(usdValue, poolTVL) {
  if (poolTVL <= 0) return 0;
  const impactRatio = usdValue / poolTVL;
  // 10% dampak = skor 100
  const score = (impactRatio / 0.10) * 100;
  return Math.min(score, 100);
}

// Sub-score 3: Frekuensi Wallet (0-100)
// Tracking sederhana in-memory
const walletActivityCache = new Map();

function calcFrequencyScore(walletAddress, tokenSymbol) {
  const key = `${walletAddress}_${tokenSymbol}`;
  const now = Date.now();
  const windowMs = 6 * 60 * 60 * 1000;  // 6 jam
  
  if (!walletActivityCache.has(key)) {
    walletActivityCache.set(key, []);
  }
  
  const activity = walletActivityCache.get(key);
  
  // Hapus yang sudah lewat window
  const recent = activity.filter(t => now - t < windowMs);
  recent.push(now);
  walletActivityCache.set(key, recent);
  
  // 10 transaksi dalam 6 jam = skor 100
  const score = (recent.length / 10) * 100;
  return Math.min(score, 100);
}

// Sub-score 4: Smart Money Bonus (0-100)
// Daftar wallet yang diketahui aktif di UNI, LINK, PEPE
const KNOWN_SMART_WALLETS = new Set([
  // Tambahkan address smart money yang kamu tracking
  // Sumber: Nansen, Arkham Intelligence, atau hasil clustering sendiri
  // '0x...',
]);

function calcSmartMoneyScore(walletAddress) {
  if (KNOWN_SMART_WALLETS.has(walletAddress.toLowerCase())) {
    return 80;
  }
  return 0;
}

// ============================================================
// WHALE CONFIDENCE SCORE (WCS) UTAMA
// ============================================================
function calculateWhaleScore(txData) {
  const { usdValue, lpImpactPct, wallet, pool } = txData;
  
  const txSizeScore    = calcTxSizeScore(usdValue);
  const lpImpactScore  = calcLPImpactScore(usdValue, estimatePoolTVL(pool));
  const freqScore      = calcFrequencyScore(wallet, pool.token0Symbol);
  const smartMoneyScore = calcSmartMoneyScore(wallet);
  
  // Wallet rep score (sederhana untuk MVP — 0 karena belum ada riwayat)
  const walletRepScore = 0;
  
  console.log(`   [Whale Score Breakdown]`);
  console.log(`      txSize=${txSizeScore} | lpImpact=${lpImpactScore} | freq=${freqScore} | smartMoney=${smartMoneyScore} | walletRep=${walletRepScore}`);
  
  // Weighted formula (total bobot = 1.00, jadi skor otomatis 0-100)
  const rawScore = (
    0.25 * txSizeScore +
    0.30 * lpImpactScore +
    0.20 * walletRepScore +
    0.10 * freqScore +
    0.15 * smartMoneyScore
  );
  
  console.log(`      finalScore=${rawScore.toFixed(2)}`);
  
  return {
    total: Math.round(rawScore),
    breakdown: {
      txSize: Math.round(txSizeScore),
      lpImpact: Math.round(lpImpactScore),
      walletRep: Math.round(walletRepScore),
      frequency: Math.round(freqScore),
      smartMoney: Math.round(smartMoneyScore),
    }
  };
}

// ============================================================
// HITUNG RISK CATEGORY
// ============================================================
function getRiskCategory(whaleScore, lpImpactPct) {
  // Adaptive Alert Levels based on Liquidity Impact
  // Feature 5 Requirements:
  // LOW: > 0.05% (0.0005)
  // MEDIUM: > 0.10% (0.0010)
  // HIGH: > 0.25% (0.0025)
  // CRITICAL: > 0.50% (0.0050)
  
  if (lpImpactPct >= 0.0050) return 'CRITICAL';
  if (lpImpactPct >= 0.0025) return 'HIGH';
  if (lpImpactPct >= 0.0010) return 'MEDIUM';
  return 'LOW';
}

// ============================================================
// ALERT COOLDOWN — Hindari spam
// ============================================================
const lastAlertTime = new Map();

function isInCooldown(tokenSymbol, cooldownSeconds) {
  const key = tokenSymbol;
  const now = Date.now();
  const last = lastAlertTime.get(key);
  
  if (!last) return false;
  return (now - last) < (cooldownSeconds * 1000);
}

function markAlertSent(tokenSymbol) {
  lastAlertTime.set(tokenSymbol, Date.now());
}

// ============================================================
// MAIN DETECTOR FUNCTION
// ============================================================
async function analyzeSwap(swapData, config) {
  // Use config values passed from index.js, with minimal fallback
  const {
    MIN_USD_VALUE = 100,     // Changed from 50000 - use value from index.js
    MIN_LP_IMPACT = 0.00001,   // Changed from 0.001 (0.1%) to 0.00001 (0.001%) - very permissive for demo
    MIN_WHALE_SCORE = 5,    // Changed from 20 - very lenient for demo mode (production: 20+)
    ALERT_COOLDOWN_SECONDS = 300,
    DEBUG_MODE = false
  } = config;

  // Hitung USD value
  const usdValue = await calculateUsdValue(swapData);
  
  // Hitung LP impact
  const poolTVL = estimatePoolTVL(swapData.pool);
  const lpImpactPct = usdValue / poolTVL;
  
  const tokenName = swapData.direction === 'BUY' ? swapData.tokenOut : swapData.tokenIn;
  
  // Debug log untuk setiap stage (ALWAYS LOG, bukan hanya DEBUG_MODE)
  console.log(`\n📋 DETECTOR ANALYSIS - ${tokenName} (${swapData.direction})`);
  console.log(`   Pool: ${swapData.pool.token0Symbol}/${swapData.pool.token1Symbol} (${swapData.pool.dex})`);
  console.log(`   USD Value: ${debugFormatUSD(usdValue, MIN_USD_VALUE)}`);
  console.log(`   Pool TVL Est: ${formatUSDLog(poolTVL)}`);
  console.log(`   LP Impact: ${(lpImpactPct * 100).toFixed(4)}% (min: ${(MIN_LP_IMPACT * 100).toFixed(5)}%)`);

  // Filter 1: Terlalu kecil?
  if (usdValue < MIN_USD_VALUE) {
    console.log(`   ❌ FILTER 1 FAIL: USD ${formatUSDLog(usdValue)} < Min ${formatUSDLog(MIN_USD_VALUE)}`);
    return null;
  }
  console.log(`   ✅ FILTER 1 PASS: USD value OK`);
  
  // Filter 2: Dampak LP terlalu kecil?
  if (lpImpactPct < MIN_LP_IMPACT) {
    console.log(`   ❌ FILTER 2 FAIL: LP ${(lpImpactPct * 100).toFixed(4)}% < Min ${(MIN_LP_IMPACT * 100).toFixed(5)}%`);
    return null;
  }
  console.log(`   ✅ FILTER 2 PASS: LP impact OK`);

  // Hitung Whale Score
  const enrichedData = { ...swapData, usdValue, lpImpactPct };
  const whaleScore = calculateWhaleScore(enrichedData);
  
  console.log(`   Whale Score: ${whaleScore.total}/100 (Logged for statistics only)`);
  
  // Risk category (informasi untuk user, filtering dilakukan per-user di broadcast)
  // REMOVED: Filter 4 yang menolak semua LOW risk
  // Alasan: Pool dengan TVL besar (LINK $20M, PEPE $25M) menghasilkan
  // whale score rendah bahkan untuk transaksi $49K → selalu LOW risk
  // → alert TIDAK PERNAH terkirim. Filtering berdasarkan risk level
  // dilakukan di bot.broadcast() melalui user.riskFilter per-subscriber.
  const riskCategory = getRiskCategory(whaleScore.total, lpImpactPct);
  console.log(`   Risk Category: ${riskCategory}`);
  
  // Cek cooldown
  const tokenSymbol = swapData.direction === 'BUY' ? swapData.tokenOut : swapData.tokenIn;
  if (isInCooldown(tokenSymbol, ALERT_COOLDOWN_SECONDS)) {
    console.log(`   ⏳ COOLDOWN ACTIVE: ${tokenSymbol} (${ALERT_COOLDOWN_SECONDS}s), skipping`);
    return null;
  }
  console.log(`   ✅ COOLDOWN CHECK: OK`);

  // Tandai alert sudah dikirim
  markAlertSent(tokenSymbol);

  console.log(`   🟢 QUALIFIED FOR BROADCAST!\n`);

  // Return hasil analisis lengkap
  return {
    ...swapData,
    usdValue,
    lpImpactPct,
    poolTVL,
    whaleScore,
    riskCategory,
    tokenSymbol,
  };
}

module.exports = { analyzeSwap, calculateWhaleScore, getRiskCategory };
