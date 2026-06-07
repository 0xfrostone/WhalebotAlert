// index.js v2.0
// Bot Interaktif — tidak perlu Chat ID grup, user chat langsung

require('dotenv').config();

const { BlockchainListener }  = require('./src/blockchain/listener');
const { analyzeSwap }          = require('./src/blockchain/detector');
const { InteractiveWhaleBot }  = require('./src/bot');
const { AlertLogger }          = require('./src/services/alertLogger');
const { AccumulationTracker }  = require('./src/blockchain/accumulationTracker');

// ============================================================
// UTILITAS: Simpan alert dan statistik wallet
// ============================================================
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const WALLETS_FILE = path.join(DATA_DIR, 'wallets.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function saveAlert(alertData) {
  ensureDataDir();
  const alerts = loadJSON(ALERTS_FILE);
  alerts.unshift({
    ...alertData,
    savedAt: new Date().toISOString()
  });
  if (alerts.length > 1000) alerts.splice(1000);
  saveJSON(ALERTS_FILE, alerts);
}

function updateWalletStats(address, txData) {
  ensureDataDir();
  const wallets = loadJSON(WALLETS_FILE);
  const existing = wallets.find(w => w.address === address);
  
  if (existing) {
    existing.txCount++;
    existing.lastSeen = new Date().toISOString();
    existing.totalVolumeUSD = (existing.totalVolumeUSD || 0) + txData.usdValue;
  } else {
    wallets.unshift({
      address,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      txCount: 1,
      totalVolumeUSD: txData.usdValue,
    });
  }
  
  if (wallets.length > 500) wallets.splice(500);
  saveJSON(WALLETS_FILE, wallets);
}

// ============================================================
// VALIDASI — TELEGRAM_CHAT_ID tidak diperlukan lagi!
// ============================================================
function validateConfig() {
  const required = ['ALCHEMY_WSS_URL', 'TELEGRAM_BOT_TOKEN'];
  const missing  = required.filter(k => !process.env[k] || process.env[k].includes('ISI_'));
  if (missing.length > 0) {
    console.error('❌ Konfigurasi tidak lengkap! Isi file .env untuk:');
    missing.forEach(k => console.error(`   - ${k}`));
    process.exit(1);
  }
  console.log('✅ Konfigurasi valid');
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🐳 WHALE INTELLIGENCE SYSTEM v2.0      ║');
  console.log('║  Interactive Telegram Bot · Multi-User   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  validateConfig();

  // Konfigurasi global (batas bawah sistem)
  // Threshold per-user diatur oleh masing-masing user di bot
  // PENTING: MIN_USD_VALUE harus JAUH lebih rendah dari user threshold agar user bisa pakai demo mode
  const config = {
    MIN_USD_VALUE:          parseFloat(process.env.MIN_USD_VALUE          || '100'),   // Lowered from 5000 to allow demo mode
    MIN_LP_IMPACT:          parseFloat(process.env.MIN_LP_IMPACT          || '0.00001'),  // 0.001% - very permissive for demo
    MIN_WHALE_SCORE:        parseInt(  process.env.MIN_WHALE_SCORE        || '5'),     // Lowered from 20 for demo (permissive detection)
    ALERT_COOLDOWN_SECONDS: parseInt(  process.env.ALERT_COOLDOWN_SECONDS || '60'),
    DEBUG_MODE:             process.env.DEBUG_MODE === 'true' || true,  // Enable by default to see filter logs
  };

  console.log('📋 Threshold sistem (batas bawah global):');
  console.log(`   Min USD:        $${config.MIN_USD_VALUE.toFixed(2)} (lowered for demo mode compatibility)`);
  console.log(`   Min LP Impact:  ${(config.MIN_LP_IMPACT * 100).toFixed(5)}% (very permissive for demo)`);
  console.log(`   Min Score:      ${config.MIN_WHALE_SCORE}/100 (lowered for demo - increase to 20+ for production)`);
  console.log(`   Debug Mode:     ${config.DEBUG_MODE ? '🔍 ON' : 'OFF'}`);
  console.log('   ⚠️ User threshold diatur via /start menu (overrides system min)');
  console.log('');

  // Inisialisasi bot interaktif
  const bot = new InteractiveWhaleBot(process.env.TELEGRAM_BOT_TOKEN);

  // Inisialisasi alert logger untuk research
  const alertLogger = new AlertLogger();

  // Tampilkan link bot
  try {
    const me = await bot.bot.getMe();
    console.log(`🔗 Link bot kamu: https://t.me/${me.username}`);
    console.log(`   → Buka link ini di Telegram, klik START`);
  } catch {}

  const { total, active } = bot.getStats();
  console.log(`👥 Subscribers: ${total} total, ${active} aktif\n`);

  // ============================================================
  // STATISTIK RUNTIME
  // ============================================================
  const stats = {
    startTime:   Date.now(),
    totalEvents: 0,
    alertsSent:  0,
    errors:      0
  };

  const accumulationTracker = new AccumulationTracker();

  // ============================================================
  // CALLBACK: dipanggil setiap ada Swap event dari blockchain
  // ============================================================
  async function onSwapDetected(swapData) {
    stats.totalEvents++;
    const tokenName = swapData.direction === 'BUY' ? swapData.tokenOut : swapData.tokenIn;
    console.log(`\n📡 [EVENT #${stats.totalEvents}] ${tokenName} ${swapData.direction} from listener`);
    console.log(`   amountIn=${swapData.amountIn} ${swapData.tokenIn} | amountOut=${swapData.amountOut} ${swapData.tokenOut}`);

    try {
      // === STAGE 1: Detector Analysis ===
      console.log(`   [STAGE 1] Calling analyzeSwap()...`);
      const result = await analyzeSwap(swapData, config);

      // Tidak lolos filter sistem
      if (!result) {
        console.log(`   ❌ [STAGE 1 RESULT] Rejected by system filters — alert will NOT be sent`);
        return;
      }
      console.log(`   ✅ [STAGE 1 RESULT] Passed ALL system filters!`);
      console.log(`   Token: ${result.tokenSymbol} | Direction: ${result.direction} | USD: $${result.usdValue.toFixed(2)} | Score: ${result.whaleScore.total} | Risk: ${result.riskCategory}`);

      // === STAGE 2: Broadcast to subscribers ===
      console.log(`\n   [STAGE 2] Calling bot.broadcast()...`);
      const subscriberStats = bot.getStats();
      console.log(`   Subscribers: ${subscriberStats.total} total, ${subscriberStats.active} active`);
      
      if (result) {
        // --- 1. WHALE ALERT BROADCAST ---
        stats.alertsSent++;
        console.log(`🚀 Mengirim Whale Alert ke bot...`);
        const sentCount = await bot.broadcast(result);
        console.log(`✅ Alert berhasil dikirim ke ${sentCount} user(s)`);

        // Simpan alert
        saveAlert(result);
        alertLogger.logAlert(result);
        
        // --- 2. ACCUMULATION DETECTION ---
        const accumulationEvent = accumulationTracker.processSwap(result);
        if (accumulationEvent) {
          console.log(`🐳 [ACCUMULATION DETECTED] ${accumulationEvent.wallet} accumulated ${accumulationEvent.tokenSymbol}`);
          if (bot.broadcastAccumulation) {
            await bot.broadcastAccumulation(accumulationEvent);
          }
        }
      }

    } catch (err) {
      stats.errors++;
      console.error(`   ❌ [ERROR] Exception in onSwapDetected: ${err.message}`);
      console.error(`   Stack: ${err.stack}`);
    }
  }

  // ============================================================
  // START BLOCKCHAIN LISTENER
  // ============================================================
  const listener = new BlockchainListener(process.env.ALCHEMY_WSS_URL, onSwapDetected);
  
  const { TokenService } = require('./src/services/tokenService');
  const tokenService = new TokenService(process.env.ALCHEMY_WSS_URL, listener.tokenStore);
  bot.setTokenService(tokenService);
  bot.setListener(listener);

  await listener.start();

  // ============================================================
  // LAPORAN STATUS SETIAP 6 JAM (console only)
  // ============================================================
  setInterval(() => {
    const uptime = ((Date.now() - stats.startTime) / 3_600_000).toFixed(1);
    const sub    = bot.getStats();
    console.log(
      `\n📊 STATUS | events: ${stats.totalEvents.toLocaleString()} | ` +
      `alerts: ${stats.alertsSent} | subscribers: ${sub.active}/${sub.total} | ` +
      `uptime: ${uptime}h`
    );
  }, 6 * 60 * 60 * 1000);

  // ============================================================
  // GRACEFUL SHUTDOWN
  // ============================================================
  process.on('SIGINT', () => {
    console.log('\n🛑 Menghentikan sistem...');
    listener.stop();
    console.log(`📊 Total events: ${stats.totalEvents.toLocaleString()}`);
    console.log(`📱 Total alerts: ${stats.alertsSent}`);
    process.exit(0);
  });

  process.on('uncaughtException',  (err) => { console.error('Uncaught:', err.message);  stats.errors++; });
  process.on('unhandledRejection', (err) => { console.error('Rejection:', String(err)); stats.errors++; });
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});