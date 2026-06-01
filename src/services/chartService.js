// src/services/chartService.js
// Service untuk generate chart image dengan multi-timeframe support

let CanvasRenderService;
try {
  CanvasRenderService = require('chartjs-node-canvas').CanvasRenderService;
} catch (e) {
  CanvasRenderService = null;
}

const { CoinGeckoService } = require('./coingeckoService');
const { TOKEN_CONFIG } = require('../config/tokens');

// Cache untuk data per timeframe
const timeframeCache = new Map();
const TIMEFRAME_CONFIG = {
  '15M': { days: 1, interval: 'hourly', label: '15 Min' },
  '30M': { days: 1, interval: 'hourly', label: '30 Min' },
  '1H': { days: 1, interval: 'hourly', label: '1 Hour' },
  '4H': { days: 7, interval: 'daily', label: '4 Hour' },
  '1D': { days: 30, interval: 'daily', label: '1 Day' }
};

class ChartService {
  static async generateChart(token, cgId, timeframe = '1D') {
    // Validate timeframe
    if (!TIMEFRAME_CONFIG[timeframe]) {
      timeframe = '1D';  // Default to 1D if invalid
    }

    const config = TIMEFRAME_CONFIG[timeframe];
    const cacheKey = `${cgId}_${timeframe}`;

    // Check cache
    if (timeframeCache.has(cacheKey)) {
      const cached = timeframeCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {  // 60s cache TTL
        console.log(`  📊 Using cached chart data for ${token} ${timeframe}`);
        return ChartService.formatChartResponse(cached.imageBuffer, cached.caption, timeframe);
      }
    }

    // Fallback jika canvas tidak terinstall
    if (!CanvasRenderService) {
      return ChartService.generateTextChart(token, cgId, timeframe);
    }

    try {
      const data = await CoinGeckoService.fetchPriceData(cgId, config.days);
      if (!data) return ChartService.generateTextChart(token, cgId, timeframe);

      // Calculate statistics
      const stats = ChartService.calculateStats(data, timeframe);

      const canvasRenderService = new CanvasRenderService(1200, 600);
      const changeColor = stats.changePercent >= 0 ? '#00ff00' : '#ff0000';

      const chartConfig = {
        type: 'line',
        data: {
          labels: data.timeLabels,
          datasets: [{
            label: `$${token} Price`,
            data: data.priceValues,
            borderColor: changeColor,
            backgroundColor: stats.changePercent >= 0 ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            pointBackgroundColor: changeColor,
            pointBorderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              labels: { color: '#ffffff', font: { size: 12, weight: 'bold' }, padding: 15 }
            },
            title: {
              display: true,
              text: `${TOKEN_CONFIG[token]?.name || token} (${token}) — ${config.label} Chart`,
              color: '#ffffff',
              font: { size: 16, weight: 'bold' },
              padding: 15
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: { color: '#aaaaaa', font: { size: 11 } },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
              ticks: { color: '#aaaaaa', font: { size: 11 }, maxRotation: 45, minRotation: 0 },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      };

      const imageBuffer = await canvasRenderService.renderToBuffer(chartConfig);
      
      const caption = ChartService.buildCaption(token, stats, timeframe);

      // Cache result
      timeframeCache.set(cacheKey, { imageBuffer, caption, timestamp: Date.now() });

      return ChartService.formatChartResponse(imageBuffer, caption, timeframe);
    } catch (err) {
      console.error('Error generating chart:', err.message);
      return ChartService.generateTextChart(token, cgId, timeframe);
    }
  }

  static calculateStats(data, timeframe) {
    const prices = data.priceValues;
    const currentPrice = prices[prices.length - 1];
    const openPrice = prices[0];
    const changePercent = ((currentPrice - openPrice) / openPrice * 100).toFixed(2);
    
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const range = ((maxPrice - minPrice) / minPrice * 100).toFixed(2);

    // Trend detection
    const midPoint = prices.length / 2;
    const firstHalf = prices.slice(0, Math.floor(midPoint));
    const secondHalf = prices.slice(Math.floor(midPoint));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend = 'SIDEWAYS';
    if (avgSecond > avgFirst * 1.02) trend = 'BULLISH';
    if (avgSecond < avgFirst * 0.98) trend = 'BEARISH';

    // Volatility calculation (standard deviation)
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const volatility = ((stdDev / mean) * 100).toFixed(2);

    let volatilityLevel = 'RENDAH';
    if (volatility > 5) volatilityLevel = 'SEDANG';
    if (volatility > 10) volatilityLevel = 'TINGGI';

    return {
      currentPrice,
      openPrice,
      changePercent,
      maxPrice,
      minPrice,
      range,
      trend,
      volatility,
      volatilityLevel,
      volume24h: data.volume24h,
      marketCap: data.marketCap
    };
  }

  static buildCaption(token, stats, timeframe) {
    const changeEmoji = stats.changePercent >= 0 ? '📈' : '📉';
    const changeColor = stats.changePercent >= 0 ? '🟢' : '🔴';
    const trendEmoji = stats.trend === 'BULLISH' ? '📈' : (stats.trend === 'BEARISH' ? '📉' : '〰️');

    return [
      `${changeEmoji} <b>${token} — ${TIMEFRAME_CONFIG[timeframe].label} Chart</b>`,
      ``,
      `${changeColor} Harga Saat Ini: <b>$${stats.currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</b>`,
      `${changeColor} Perubahan: <b>${stats.changePercent}%</b>`,
      ``,
      `📊 <b>STATISTIK</b>`,
      `High:  $${stats.maxPrice.toFixed(8)}`,
      `Low:   $${stats.minPrice.toFixed(8)}`,
      `Range: <b>${stats.range}%</b>`,
      ``,
      `${trendEmoji} Trend: <b>${stats.trend}</b>`,
      `📈 Volatility: <b>${stats.volatilityLevel}</b> (${stats.volatility}%)`,
      ``,
      `💰 Volume 24h: $${(stats.volume24h / 1000000).toFixed(2)}M`,
      `🏆 Market Cap: $${(stats.marketCap / 1000000000).toFixed(2)}B`,
      ``,
      `⏱️ Data terbaru dari CoinGecko (cache TTL: 60s)`
    ].join('\n');
  }

  static formatChartResponse(imageBuffer, caption, timeframe) {
    return { imageBuffer, caption, timeframe };
  }

  static async generateTextChart(token, cgId, timeframe) {
    try {
      const data = await CoinGeckoService.fetchPriceData(cgId, TIMEFRAME_CONFIG[timeframe].days);
      if (!data) return null;

      const stats = ChartService.calculateStats(data, timeframe);
      const caption = ChartService.buildCaption(token, stats, timeframe);

      return { caption, imageBuffer: null, timeframe };
    } catch (err) {
      console.error('Error generating text chart:', err.message);
      return null;
    }
  }
}

module.exports = { ChartService };
