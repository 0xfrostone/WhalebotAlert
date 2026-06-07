// src/commands/stop.js
// Command /stop

function setupStopCommand(bot, watchlistStore) {
  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    const user = watchlistStore.get(chatId);
    user.active = false;
    watchlistStore.set(chatId, user);

    bot.sendMessage(chatId,
      '⏹️ <b>Tracking dihentikan.</b>\n\nKetik /start untuk mulai lagi.',
      { parse_mode: 'HTML' }
    );
  });
}

module.exports = { setupStopCommand };
