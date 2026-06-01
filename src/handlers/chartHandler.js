// src/handlers/chartHandler.js
// Handler untuk chart buttons dengan multi-timeframe support

const { ChartService } = require('../services/chartService');
const { TOKEN_CONFIG } = require('../config/tokens');
const { logError } = require('../utils/logger');

const TIMEFRAMES = ['15M', '30M', '1H', '4H', '1D'];
const DEFAULT_TIMEFRAME = '1D';

class ChartHandler {
  /**
   * Handle chart generation with timeframe selection
   * @param {*} bot - Telegram bot instance
   * @param {string} chatId - Chat ID to send to
   * @param {string} token - Token symbol (e.g., 'UNI')
   * @param {string} timeframe - Timeframe (15M, 30M, 1H, 4H, 1D) - defaults to 1D
   */
  static async handle(bot, chatId, token, timeframe = DEFAULT_TIMEFRAME) {
    try {
      // Validate timeframe
      if (!TIMEFRAMES.includes(timeframe)) {
        timeframe = DEFAULT_TIMEFRAME;
      }

      console.log(`📈 Generating chart for $${token} (${timeframe})...`);

      const config = TOKEN_CONFIG[token];
      if (!config) {
        return bot.sendMessage(chatId, `❌ Token $${token} tidak dikenal`);
      }

      // Generate chart
      const result = await ChartService.generateChart(token, config.cgId, timeframe);
      if (!result) {
        return bot.sendMessage(chatId,
          `❌ Gagal membuat grafik untuk $${token}. Coba lagi nanti.`
        );
      }

      const { imageBuffer, caption } = result;

      // Build timeframe buttons
      const timeframeButtons = TIMEFRAMES.map(tf => ({
        text: `${tf}${tf === timeframe ? ' ✓' : ''}`,
        callback_data: `chart_timeframe_${token}_${tf}`
      }));

      // Split into 2 rows (5 timeframes: 2 + 2 + 1)
      const row1 = timeframeButtons.slice(0, 2);
      const row2 = timeframeButtons.slice(2, 4);
      const row3 = [timeframeButtons[4]];

      const replyMarkup = {
        inline_keyboard: [
          row1,
          row2,
          row3,
          [
            { text: '🔄 Refresh', callback_data: `chart_refresh_${token}_${timeframe}` },
            { text: '⬅️ Kembali', callback_data: 'menu_token' }
          ]
        ]
      };

      // Send chart
      if (!imageBuffer) {
        // Text-only fallback
        return bot.sendMessage(chatId, caption, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
      }

      // Send as photo
      await bot.sendPhoto(chatId, imageBuffer, {
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });

      console.log(`✅ Chart sent for $${token} (${timeframe})`);
    } catch (err) {
      logError(`ChartHandler error: ${err.message}`, err);
      bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
  }

  /**
   * Handle timeframe switching callback
   * @param {*} bot - Telegram bot instance
   * @param {string} chatId - Chat ID
   * @param {string} messageId - Message ID to edit
   * @param {string} token - Token symbol
   * @param {string} newTimeframe - New timeframe to switch to
   */
  static async handleTimeframeSwitch(bot, chatId, messageId, token, newTimeframe) {
    try {
      console.log(`⏱️ Switching to ${newTimeframe} for $${token}...`);

      const config = TOKEN_CONFIG[token];
      if (!config) {
        return bot.answerCallbackQuery(chatId, '❌ Token tidak ditemukan');
      }

      // Generate chart for new timeframe
      const result = await ChartService.generateChart(token, config.cgId, newTimeframe);
      if (!result) {
        return bot.answerCallbackQuery(chatId, '❌ Gagal generate chart');
      }

      const { imageBuffer, caption } = result;

      // Build new buttons (same structure)
      const timeframeButtons = TIMEFRAMES.map(tf => ({
        text: `${tf}${tf === newTimeframe ? ' ✓' : ''}`,
        callback_data: `chart_timeframe_${token}_${tf}`
      }));

      const row1 = timeframeButtons.slice(0, 2);
      const row2 = timeframeButtons.slice(2, 4);
      const row3 = [timeframeButtons[4]];

      const replyMarkup = {
        inline_keyboard: [
          row1,
          row2,
          row3,
          [
            { text: '🔄 Refresh', callback_data: `chart_refresh_${token}_${newTimeframe}` },
            { text: '⬅️ Kembali', callback_data: 'menu_token' }
          ]
        ]
      };

      // Edit message with new chart
      if (imageBuffer) {
        await bot.editMessageMedia(
          {
            type: 'photo',
            media: imageBuffer,
            caption,
            parse_mode: 'HTML'
          },
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: replyMarkup
          }
        );
      } else {
        // Fallback to text edit
        await bot.editMessageText(caption, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
      }

      bot.answerCallbackQuery(chatId, `✅ Timeframe berubah ke ${newTimeframe}`);
      console.log(`✅ Timeframe switched to ${newTimeframe} for $${token}`);
    } catch (err) {
      logError(`TimeframeSwitch error: ${err.message}`, err);
      bot.answerCallbackQuery(chatId, `❌ Error: ${err.message}`);
    }
  }

  /**
   * Handle refresh button
   */
  static async handleRefresh(bot, chatId, messageId, token, timeframe) {
    try {
      console.log(`🔄 Refreshing chart for $${token} (${timeframe})...`);
      // Just call switch with same timeframe to refresh cache
      await ChartHandler.handleTimeframeSwitch(bot, chatId, messageId, token, timeframe);
    } catch (err) {
      logError(`Refresh error: ${err.message}`, err);
      bot.answerCallbackQuery(chatId, `❌ Error: ${err.message}`);
    }
  }
}

module.exports = { ChartHandler, TIMEFRAMES };
