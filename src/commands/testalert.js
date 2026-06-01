// src/commands/testalert.js
// Command /testalert — mengirim alert dummy melalui jalur notifier yang sama
// untuk membuktikan bahwa Telegram API dan notifier berfungsi.
// TEMPORARY: Hapus setelah debugging selesai.

const { SETTINGS } = require('../config/settings');
const { NotificationService } = require('../services/notifier');
const { formatUSDLog } = require('../utils/formatter');

function setupTestAlertCommand(bot, subscriberStore) {
  bot.onText(/\/testalert/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    console.log(`\n🧪 [TESTALERT] Command received from chatId=${chatId} userId=${userId} (${msg.from.first_name})`);

    // Buat data alert dummy yang realistis
    const dummyAlert = {
      tokenSymbol: 'UNI',
      direction: 'BUY',
      usdValue: 15000,
      amountIn: 5.25,
      amountOut: 2100,
      tokenIn: 'WETH',
      tokenOut: 'UNI',
      pool: {
        token0Symbol: 'UNI',
        token1Symbol: 'WETH',
        dex: 'Uniswap V3',
        version: 3,
      },
      whaleScore: {
        total: 62,
        breakdown: {
          txSize: 45,
          lpImpact: 30,
          walletRep: 0,
          frequency: 10,
          smartMoney: 0,
        }
      },
      lpImpactPct: 0.003,
      poolTVL: 5000000,
      riskCategory: 'MEDIUM',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12',
      txHash: '0xTEST_DUMMY_ALERT_' + Date.now().toString(16),
    };

    // === TAHAP 1: Test langsung ke user yang mengirim command ===
    console.log(`🧪 [TESTALERT] TAHAP 1: Direct send to chatId=${chatId}`);
    try {
      const message = NotificationService.formatWhaleAlert(dummyAlert);
      console.log(`🧪 [TESTALERT] Message formatted (${message.length} chars)`);

      await bot.sendMessage(chatId, 
        `🧪 <b>TEST ALERT — Direct Send</b>\n━━━━━━━━━━━━━━━━━━━━\n<i>Ini test langsung ke Telegram API. Jika kamu lihat ini, Telegram API berfungsi.</i>\n\n` + message,
        { parse_mode: 'HTML', disable_web_page_preview: true }
      );
      console.log(`🧪 [TESTALERT] ✅ TAHAP 1 BERHASIL — Direct send OK`);
    } catch (err) {
      console.log(`🧪 [TESTALERT] ❌ TAHAP 1 GAGAL — Direct send error: ${err.message}`);
      await bot.sendMessage(chatId, `❌ Direct send GAGAL: ${err.message}`).catch(() => {});
      return;
    }

    // === TAHAP 2: Test melalui jalur broadcast (sama dengan alert blockchain) ===
    console.log(`\n🧪 [TESTALERT] TAHAP 2: Broadcast test — simulating full pipeline`);
    
    // Log subscriber state
    const allSubs = subscriberStore.getAll();
    console.log(`🧪 [TESTALERT] Subscribers in store: ${allSubs.size}`);
    
    for (const [subChatId, user] of allSubs) {
      const tokensArr = user.tokens instanceof Set ? [...user.tokens] : (Array.isArray(user.tokens) ? user.tokens : []);
      console.log(`🧪 [TESTALERT]   Sub ${subChatId} (${user.name}): active=${user.active} | tokens=[${tokensArr.join(',')}] | threshold=${user.threshold} | riskFilter=${user.riskFilter}`);
      
      // Simulasi filter persis seperti bot.broadcast()
      const filters = [];
      if (!user.active) filters.push('FAIL:inactive');
      else filters.push('PASS:active');
      
      const hasToken = user.tokens instanceof Set ? user.tokens.has(dummyAlert.tokenSymbol) : false;
      if (!hasToken) filters.push(`FAIL:token(${dummyAlert.tokenSymbol} not in [${tokensArr.join(',')}])`);
      else filters.push('PASS:token');
      
      if (dummyAlert.usdValue < user.threshold) filters.push(`FAIL:threshold(${formatUSDLog(dummyAlert.usdValue)}<${formatUSDLog(user.threshold)})`);
      else filters.push('PASS:threshold');
      
      if (user.riskFilter === 'EXTREME_ONLY' && dummyAlert.riskCategory !== 'EXTREME') filters.push(`FAIL:risk(${user.riskFilter} vs ${dummyAlert.riskCategory})`);
      else if (user.riskFilter === 'HIGH_EXTREME' && !['HIGH', 'EXTREME'].includes(dummyAlert.riskCategory)) filters.push(`FAIL:risk(${user.riskFilter} vs ${dummyAlert.riskCategory})`);
      else filters.push('PASS:risk');
      
      const wouldPass = !filters.some(f => f.startsWith('FAIL'));
      console.log(`🧪 [TESTALERT]   → Filters: ${filters.join(' | ')} → ${wouldPass ? '✅ WOULD SEND' : '❌ WOULD SKIP'}`);
    }

    // Kirim laporan ke user
    let reportLines = [
      `\n🧪 <b>TEST ALERT — Broadcast Simulation</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 Total subscribers: <b>${allSubs.size}</b>`,
      ``,
    ];

    let wouldSendCount = 0;
    for (const [subChatId, user] of allSubs) {
      const tokensArr = user.tokens instanceof Set ? [...user.tokens] : (Array.isArray(user.tokens) ? user.tokens : []);
      const checks = [];
      
      if (!user.active) checks.push('❌ inactive');
      else checks.push('✅ active');
      
      const hasToken = user.tokens instanceof Set ? user.tokens.has(dummyAlert.tokenSymbol) : false;
      if (!hasToken) checks.push(`❌ token`);
      else checks.push('✅ token');
      
      if (dummyAlert.usdValue < user.threshold) checks.push(`❌ threshold`);
      else checks.push('✅ threshold');
      
      if (user.riskFilter === 'EXTREME_ONLY' && dummyAlert.riskCategory !== 'EXTREME') checks.push(`❌ risk`);
      else if (user.riskFilter === 'HIGH_EXTREME' && !['HIGH', 'EXTREME'].includes(dummyAlert.riskCategory)) checks.push(`❌ risk`);
      else checks.push('✅ risk');

      const wouldPass = !checks.some(c => c.startsWith('❌'));
      if (wouldPass) wouldSendCount++;
      
      reportLines.push(
        `👤 <b>${user.name}</b> (${subChatId})`,
        `   ${checks.join(' | ')}`,
        `   tokens=[${tokensArr.join(',')}] thr=$${user.threshold}`,
        `   → ${wouldPass ? '✅ Alert WILL be sent' : '❌ Alert WILL NOT be sent'}`,
        ``
      );
    }

    reportLines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `📊 <b>Dummy alert:</b> ${dummyAlert.tokenSymbol} ${dummyAlert.direction}`,
      `💰 USD: $${dummyAlert.usdValue} | Risk: ${dummyAlert.riskCategory}`,
      ``,
      `📱 <b>Would send to: ${wouldSendCount}/${allSubs.size} subscribers</b>`,
      ``,
      `<i>💡 Jika count=0, periksa: user harus active=true, token harus match, USD harus ≥ threshold, risk harus sesuai filter.</i>`
    );

    try {
      await bot.sendMessage(chatId, reportLines.join('\n'), {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      console.log(`🧪 [TESTALERT] ✅ Report sent to ${chatId}`);
    } catch (err) {
      console.log(`🧪 [TESTALERT] ❌ Failed to send report: ${err.message}`);
    }

    console.log(`🧪 [TESTALERT] Done.\n`);
  });
}

module.exports = { setupTestAlertCommand };
