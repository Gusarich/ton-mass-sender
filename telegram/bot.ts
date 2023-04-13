require('dotenv').config();

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as os from 'os';
import { Msg, massSenderConfigToCell } from '../wrappers/MassSender';
import { TonConnectProvider } from './provider';
import { Address, Cell, contractAddress, toNano } from 'ton-core';
import { compile } from '@ton-community/blueprint';
import { initRedisClient } from './tonconnect/storage';
import { toFile } from 'qrcode';
import { getConnector } from './tonconnect/connector';

const TOO_BIG_FILE = 1024 * 1024; // 1 megabyte

const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });
var code: Cell;
compile('MassSender').then((c) => {
    code = c;
    Object.freeze(code);
});

async function sendTransaction(messages: Msg[], chatId: number, provider: TonConnectProvider) {
    const data = massSenderConfigToCell({
        messages: messages,
    });

    const address = contractAddress(0, {
        code,
        data,
    });
    const value =
        messages.map((msg) => msg.value).reduce((a, b) => a + b) +
        BigInt(messages.length + Math.ceil(messages.length / 254)) * toNano('0.1');

    await bot.sendMessage(chatId, 'Confirm transaction in Tonkeeper');

    try {
        await provider.sendTransaction(address, value, undefined, {
            code,
            data,
        });
        await bot.sendMessage(chatId, 'Transaction sent!');
    } catch (UserRejectsError) {
        await bot.sendMessage(chatId, 'You rejected the transaction');
    }
}

async function processMessages(messages: Msg[], chatId: number) {
    const provider = new TonConnectProvider(getConnector(chatId), 'Tonkeeper');
    await provider.restoreConnection();

    if (!provider.address()) {
        await bot.sendMessage(chatId, 'Connect your Tonkeeper wallet');

        const url = await provider.getConnectUrl();

        if (url === undefined) {
            return;
        }

        const filename = os.tmpdir() + 'qrcode' + Math.floor(Math.random() * 1e6).toString() + '.png';
        toFile(filename, url, async () => {
            const msg = await bot.sendPhoto(chatId, filename, { caption: 'Scan this QR code with Tonkeeper' });
            await fs.promises.rm(filename);
            await provider.connect(async () => {
                await bot.deleteMessage(chatId, msg.message_id);
                await bot.sendMessage(chatId, 'Wallet connected!');
                await sendTransaction(messages, chatId, provider);
            });
        });
    } else {
        await sendTransaction(messages, chatId, provider);
    }
}

async function main(): Promise<void> {
    await initRedisClient();

    bot.on('document', async (msg) => {
        const chatId = msg.chat.id;
        if (msg.document!.file_size! > TOO_BIG_FILE) {
            await bot.sendMessage(chatId, 'File is too big. The limit is 1MB.');
            return;
        }
        if (!msg.document!.file_name!.endsWith('.json') && !msg.document!.file_name!.endsWith('.csv')) {
            await bot.sendMessage(
                chatId,
                'Your file has unsupported extension. Make sure it is either `.json` or `.csv`.'
            );
            return;
        }

        const rawMessages = await (await fetch(await bot.getFileLink(msg.document!.file_id))).json();
        let messages: Msg[] = [];
        for (const addr of Object.keys(rawMessages)) {
            messages.push({
                value: toNano(rawMessages[addr]),
                destination: Address.parse(addr),
            });
        }

        await processMessages(messages, chatId);
    });

    bot.on('text', async (msg) => {
        const chatId = msg.chat.id;

        const rawMessagesText = msg.text!.match(/[a-zA-Z0-9-_]{48}: \d+/gm);
        if (rawMessagesText == null || rawMessagesText.length == 0) {
            return;
        }
        const rawMessages = rawMessagesText.map((t) => t.split(': '));

        let messages: Msg[] = [];
        for (const msg of rawMessages) {
            messages.push({
                value: toNano(msg[1]),
                destination: Address.parse(msg[0]),
            });
        }

        await processMessages(messages, chatId);
    });
}

main();
