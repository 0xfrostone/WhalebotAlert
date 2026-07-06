// src/blockchain/accumulationTracker.js
// Tracks repeated buys/sells from the same wallet

const { AccumulationStore } = require('../storage/accumulationStore');

const ACCUMULATION_CONFIG = {
  MIN_TRANSACTIONS: 3,
  TIME_WINDOW_MS: 60 * 60 * 1000, // 1 Hour
  MIN_TOTAL_VOLUME_USD: 5000,
  MIN_COMBINED_IMPACT_PCT: 0.0005 // 0.05%
};

class AccumulationTracker {
  constructor() {
    this.store = new AccumulationStore();
  }

  processSwap(swapData) {
    const { wallet, tokenSymbol, direction, usdValue, lpImpactPct } = swapData;
    
    // We only track accumulation per direction (mostly buys are what people care about, but we track both separately)
    // Actually, the user asked to track "repeated buying or selling", so we'll just track the exact direction
    
    // Clean old transactions
    this.store.cleanupOldTransactions(wallet, tokenSymbol, ACCUMULATION_CONFIG.TIME_WINDOW_MS);
    
    // Add new transaction
    const activity = this.store.addTransaction(wallet, tokenSymbol, direction, {
      usdValue,
      lpImpactPct,
      txHash: swapData.txHash,
      dex: swapData.pool ? swapData.pool.dex : 'Uniswap'
    });

    if (activity.direction !== direction) {
      // Different direction, just tracking
    }

    const recentTxs = activity.transactions;
    const txCount = recentTxs.length;

    if (txCount >= ACCUMULATION_CONFIG.MIN_TRANSACTIONS) {
      const totalVolume = recentTxs.reduce((sum, tx) => sum + tx.usdValue, 0);
      const combinedImpact = recentTxs.reduce((sum, tx) => sum + tx.impactPct, 0);

      if (totalVolume >= ACCUMULATION_CONFIG.MIN_TOTAL_VOLUME_USD && combinedImpact >= ACCUMULATION_CONFIG.MIN_COMBINED_IMPACT_PCT) {
        
        let riskLevel = 'LOW';
        if (txCount >= 10 && totalVolume >= 25000 && combinedImpact >= 0.0025) {
          riskLevel = 'HIGH';
        } else if (txCount >= 5 && totalVolume >= 10000 && combinedImpact >= 0.0010) {
          riskLevel = 'MEDIUM';
        } else {
          riskLevel = 'LOW';
        }

        // Collect txHashes and unique dexes
        const txHashes = recentTxs.map(tx => tx.txHash).filter(Boolean);
        const dexes = [...new Set(recentTxs.map(tx => tx.dex).filter(Boolean))];

        return {
          isAccumulation: true,
          wallet: wallet,
          tokenSymbol: tokenSymbol,
          direction: direction,
          transactions: txCount,
          totalVolume: totalVolume,
          combinedImpactPct: combinedImpact,
          timeWindow: '1 Hour',
          riskLevel: riskLevel,
          txHashes: txHashes,
          dexes: dexes
        };
      }
    }

    return null;
  }
}

module.exports = { AccumulationTracker };
