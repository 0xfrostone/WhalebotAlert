// src/commands/stop.js
// Command /stop

function setupStopCommand(bot, subscriberStore) {
  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    const user = subscriberStore.get(chatId);
    user.active = false;
    subscriberStore.set(chatId, user);

    bot.sendMessage(chatId,
      '⏹️ <b>Tracking dihentikan.</b>\n\nKetik /start untuk mulai lagi.',
      { parse_mode: 'HTML' }
    );
  });
}

module.exports = { setupStopCommand };
