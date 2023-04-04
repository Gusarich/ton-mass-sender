require('dotenv').config();

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import { Msg, getMessagesLength, massSenderConfigToCell } from '../wrappers/MassSender';
import { TonConnectProvider } from './provider';
import { Address, Cell, contractAddress, toNano } from 'ton-core';
import { compile } from '@ton-community/blueprint';
import { initRedisClient } from './tonconnect/storage';
import { toFile } from 'qrcode';
import { getConnector } from './tonconnect/connector';

const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });
var code: Cell;
compile('MassSender').then((c) => {
    code = c;
    Object.freeze(code);
});

async function main(): Promise<void> {
    await initRedisClient();

    bot.on('document', async (msg) => {
        const chatId = msg.chat.id;
        const rawMessages = await (await fetch(await bot.getFileLink(msg.document!.file_id))).json();
        let messages: Msg[] = [];
        for (const addr of Object.keys(rawMessages)) {
            messages.push({
                value: toNano(rawMessages[addr]),
                destination: Address.parse(addr),
            });
        }

        const data = massSenderConfigToCell({
            messages: messages,
        });

        const provider = new TonConnectProvider(getConnector(chatId), 'Tonkeeper');
        await provider.restoreConnection();

        if (!provider.address()) {
            await bot.sendMessage(chatId, 'Connect your Tonkeeper wallet');

            const url = await provider.getConnectUrl();

            if (url === undefined) {
                return;
            }

            const filename = 'qrcode' + Math.floor(Math.random() * 1e6).toString() + '.png';
            toFile(filename, url, async () => {
                const msg = await bot.sendPhoto(chatId, filename, { caption: 'Scan this QR code with Tonkeeper' });
                await fs.promises.rm(filename);
                await provider.connect(() => {
                    bot.deleteMessage(chatId, msg.message_id);
                    bot.sendMessage(chatId, 'Wallet connected!');
                });
            });
        } else {
            const address = contractAddress(0, {
                code,
                data,
            });
            const value =
                messages.map((msg) => msg.value).reduce((a, b) => a + b) +
                BigInt(getMessagesLength(data.refs)) * toNano('0.1');

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
    });
}

main();
