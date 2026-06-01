// src/services/coingeckoService.js
// Service untuk fetch data dari CoinGecko API

const axios = require('axios');

const priceCache = new Map();
const PRICE_CACHE_TTL = 60000; // 1 menit

class CoinGeckoService {
  static async fetchPriceData(cgId, days = 1) {
    // Check cache dulu
    const now = Date.now();
    const cacheKey = `${cgId}_${days}`;
    const cached = priceCache.get(cacheKey);

    if (cached && (now - cached.timestamp) < PRICE_CACHE_TTL) {
      console.log(`📊 Cache HIT untuk ${cgId} (${PRICE_CACHE_TTL / 1000}s TTL)`);
      return cached.data;
    }

    try {
      console.log(`📡 Fetching price data untuk ${cgId} dari CoinGecko...`);
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart`,
        {
          params: {
            vs_currency: 'usd',
            days: days,
            interval: days === 1 ? 'hourly' : 'daily'
          },
          timeout: 10000
        }
      );

      const prices = response.data.prices;
      const marketCaps = response.data.market_caps;
      const volumes = response.data.total_volumes;

      const timeLabels = prices.map(p => {
        const date = new Date(p[0]);
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      });

      const priceValues = prices.map(p => parseFloat(p[1].toFixed(8)));
      const currentPrice = priceValues[priceValues.length - 1];
      const openingPrice = priceValues[0];
      const changePercent = ((currentPrice - openingPrice) / openingPrice * 100).toFixed(2);

      const data = {
        currentPrice,
        changePercent,
        openingPrice,
        maxPrice: Math.max(...priceValues),
        minPrice: Math.min(...priceValues),
        volume24h: volumes[volumes.length - 1][1],
        marketCap: marketCaps[marketCaps.length - 1][1],
        timeLabels,
        priceValues
      };

      // Simpan ke cache
      priceCache.set(cacheKey, { data, timestamp: now });
      console.log(`✅ Cache SAVED untuk ${cgId}`);

      return data;
    } catch (err) {
      console.error(`❌ CoinGecko API error:`, err.message);
      // Return cached data jika tersedia
      if (cached) {
        console.log(`⚠️ Using stale cache untuk ${cgId}`);
        return cached.data;
      }
      return null;
    }
  }

  static async getETHPrice() {
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
      return cached ? cached.price : 3200;
    }
  }
}

module.exports = { CoinGeckoService };
