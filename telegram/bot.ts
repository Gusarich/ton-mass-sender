require('dotenv').config();

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as os from 'os';
import { Msg, massSenderConfigToCell } from '../wrappers/MassSender';
import { TonConnectProvider } from './provider';
import { Address, Cell, contractAddress, fromNano, toNano } from 'ton-core';
import { compile } from '@ton-community/blueprint';
import { initRedisClient } from './tonconnect/storage';
import { toFile } from 'qrcode';
import { getConnector } from './tonconnect/connector';
import { parse } from 'csv-parse/sync';

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
        admin: provider.address()!,
    });

    const address = contractAddress(0, {
        code,
        data,
    });
    const value =
        messages.map((msg) => msg.value).reduce((a, b) => a + b) +
        BigInt(messages.length + Math.ceil(messages.length / 254)) * toNano('0.1');

    await bot.sendMessage(chatId, 'Please confirm the transaction in your Tonkeeper wallet.');

    try {
        await provider.sendTransaction(address, value, undefined, {
            code,
            data,
        });
        await bot.sendMessage(chatId, 'Success! The transaction has been sent.');
        await bot.sendMessage(
            chatId,
            'You can explore the details of your transactions by using the following links:\n[Tonscan](https://tonscan.org/address/' +
                address +
                ')\n[Tonviewer](https://tonviewer.com/' +
                address +
                ')\n[Ton Whales](https://tonwhales.com/explorer/address/' +
                address +
                ')',
            {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
            }
        );
    } catch (UserRejectsError) {
        console.log(UserRejectsError);
        await bot.sendMessage(chatId, 'The transaction was rejected. If this was a mistake, please try again.');
    }
}

async function processMessages(messages: Msg[], chatId: number) {
    if (messages.length > 1300) {
        await bot.sendMessage(
            chatId,
            "You've exceeded the maximum transaction limit. Please limit your transactions to 1300 or less."
        );
        return;
    }

    const provider = new TonConnectProvider(getConnector(chatId), 'Tonkeeper');
    await provider.restoreConnection();

    if (!provider.address()) {
        await bot.sendMessage(chatId, 'Please connect your Tonkeeper wallet to proceed.');

        const url = await provider.getConnectUrl();

        if (url === undefined) {
            await bot.sendMessage(chatId, 'Oops! An unknown error occurred. Please try again later.');
            return;
        }

        const filename = os.tmpdir() + 'qrcode' + Math.floor(Math.random() * 1e6).toString() + '.png';
        toFile(filename, url, async () => {
            const msg = await bot.sendPhoto(chatId, filename, {
                caption: 'Please scan this QR code using your Tonkeeper wallet.',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Open Tonkeeper',
                                url,
                            },
                        ],
                    ],
                },
            });
            await fs.promises.rm(filename);
            await provider.connect(async () => {
                await bot.deleteMessage(chatId, msg.message_id);
                await bot.sendMessage(chatId, 'Success! Your Tonkeeper wallet is now connected.');
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
            await bot.sendMessage(
                chatId,
                'The file you uploaded is too large. Please ensure your file is less than 1MB.'
            );
            return;
        }

        var rawMessages: {
            [key: string]: bigint;
        };

        if (msg.document!.file_name!.endsWith('.json')) {
            var good = true;
            try {
                rawMessages = await (await fetch(await bot.getFileLink(msg.document!.file_id))).json();
                Object.keys(rawMessages).forEach(async (key) => {
                    if (typeof rawMessages[key] != typeof '') {
                        good = false;
                    } else {
                        rawMessages[key] = toNano(rawMessages[key]);
                    }
                });
            } catch (e) {
                await bot.sendMessage(
                    chatId,
                    'The uploaded JSON file is invalid. Please check the file and try again.'
                );
                return;
            }
            if (!good) {
                await bot.sendMessage(
                    chatId,
                    'The values must be provided as strings\\. Example:\n`{\n  "EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL": "0.1",\n  "EQBKgXCNLPexWhs2L79kiARR1phGH1LwXxRbNsCFF9doc2lN": "1.2"\n}`',
                    { parse_mode: 'MarkdownV2' }
                );
                return;
            }
        } else if (msg.document!.file_name!.endsWith('.csv')) {
            var good = true;
            var duplicate: string;
            try {
                rawMessages = parse(await (await fetch(await bot.getFileLink(msg.document!.file_id))).text(), {
                    skip_empty_lines: true,
                }).reduce((map: { [key: string]: bigint }, obj: string[2]) => {
                    if (good && map[obj[0]] !== undefined) {
                        good = false;
                        duplicate = obj[0];
                    }
                    map[obj[0]] = toNano(obj[1]);
                    return map;
                }, {});
            } catch (e) {
                await bot.sendMessage(chatId, 'The uploaded CSV file is invalid. Please check the file and try again.');
                return;
            }
            if (!good) {
                await bot.sendMessage(
                    chatId,
                    'To avoid confusion, please ensure there are no duplicate addresses to send Toncoin to\\. The address `' +
                        duplicate! +
                        '` appears multiple times\\.',
                    { parse_mode: 'MarkdownV2' }
                );
                return;
            }
        } else {
            await bot.sendMessage(
                chatId,
                "The file type you uploaded isn't supported. Please ensure your file extension is either `.json` or `.csv`."
            );
            return;
        }

        let messages: Msg[] = [];
        const addresses = Object.keys(rawMessages);
        for (let i = 0; i < addresses.length; i++) {
            const addr = addresses[i];
            if (rawMessages[addr] <= 0n) {
                await bot.sendMessage(
                    chatId,
                    'The value at position ' + (i + 1) + ' is invalid: ' + fromNano(rawMessages[addr])
                );
                return;
            }
            var destination;
            try {
                destination = Address.parse(addr);
            } catch {
                await bot.sendMessage(chatId, 'The address at position ' + (i + 1) + ' is invalid:\n"' + addr + '"');
                return;
            }
            messages.push({
                value: rawMessages[addr],
                destination,
            });
        }
        await processMessages(messages, chatId);
    });

    bot.onText(/.*/, async (msg) => {
        if (!msg.text?.match(/^([a-zA-Z0-9-_]+: -?\d+(\.\d+)?\n*)+$/g)) {
            await bot.sendMessage(
                msg.chat.id,
                `*👋 Hello and welcome to the TON Mass Sender bot\\!*\nI'm here to help you send Toncoin to multiple addresses at once\\. You can provide me with a list of addresses in one of the following formats:\n\n*🔹 Plain text*\\: You can send the address and value separated by a colon and a space, with each address on a new line\\. Example: \`EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL: 0.1\nEQBKgXCNLPexWhs2L79kiARR1phGH1LwXxRbNsCFF9doc2lN: 1.2\`\n\n*🔹 JSON format*\\: Send a JSON object where each key is an address and the corresponding value is the amount to be sent\\.\n\n*🔹 CSV format*\\: Send a CSV file where each row contains an address and the corresponding value separated by a comma\\.\n\nLet's get started\\!`,
                { parse_mode: 'MarkdownV2' }
            );
            return;
        }

        const chatId = msg.chat.id;

        const rawMessagesText = msg.text!.split('\n');
        const rawMessages = rawMessagesText.map((t) => t.split(': '));

        let messages: Msg[] = [];
        let addressSet = new Set();
        for (let i = 0; i < rawMessages.length; i++) {
            const msg = rawMessages[i];
            const value = toNano(msg[1]);
            if (value <= 0) {
                await bot.sendMessage(chatId, 'The value at position ' + (i + 1) + ' is invalid: ' + msg[1]);
                return;
            }
            var destination;
            try {
                destination = Address.parse(msg[0]);
                if (addressSet.has(msg[0])) {
                    await bot.sendMessage(
                        chatId,
                        'To avoid confusion, please ensure there are no duplicate addresses to send Toncoin to\\. The address `' +
                            msg[0] +
                            '` appears multiple times\\.',
                        { parse_mode: 'MarkdownV2' }
                    );
                    return;
                }
                addressSet.add(msg[0]);
            } catch {
                await bot.sendMessage(chatId, 'The address at position ' + (i + 1) + ' is invalid:\n"' + msg[0] + '"');
                return;
            }
            messages.push({
                value,
                destination,
            });
        }

        await processMessages(messages, chatId);
    });
}

main();
