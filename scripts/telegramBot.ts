import TelegramBot from 'node-telegram-bot-api';

const token = require('./config.json').API_TOKEN;

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Received your message');
});
