import TonConnect, { WalletInfo, WalletInfoRemote } from '@tonconnect/sdk';
import { Address, Cell, StateInit, beginCell, storeStateInit } from 'ton-core';

export interface SendProvider {
    connect(): Promise<void>;
    sendTransaction(address: Address, amount: bigint, payload?: Cell, stateInit?: StateInit): Promise<any>;
    address(): Address | undefined;
}

function isRemote(walletInfo: WalletInfo): walletInfo is WalletInfoRemote {
    return 'universalLink' in walletInfo && 'bridgeUrl' in walletInfo;
}

export class TonConnectProvider {
    #connector: TonConnect;
    walletName: string;

    constructor(connector: TonConnect, walletName: string) {
        this.walletName = walletName;
        this.#connector = connector;
    }

    async connect(callback: Function): Promise<void | string> {
        new Promise(() => {
            this.#connector.onStatusChange((w) => {
                if (w) callback(w);
            });
        });
    }

    address(): Address | undefined {
        if (!this.#connector.wallet) return undefined;
        return Address.parse(this.#connector.wallet.account.address);
    }

    async restoreConnection() {
        await this.#connector.restoreConnection();
    }

    async getConnectUrl(): Promise<string> {
        const wallets = (await this.#connector.getWallets()).filter(isRemote);
        const wallet = wallets.find((w) => {
            return w.name == this.walletName;
        });
        if (wallet === undefined) {
            throw '';
        }
        await this.#connector.restoreConnection();
        if (this.#connector.wallet) {
            throw '';
        }

        const url = this.#connector.connect({
            universalLink: wallets[0].universalLink,
            bridgeUrl: wallet.bridgeUrl,
        }) as string;

        return url;
    }

    async sendTransaction(address: Address, amount: bigint, payload?: Cell, stateInit?: StateInit) {
        const result = await this.#connector.sendTransaction({
            validUntil: Date.now() + 5 * 60 * 1000,
            messages: [
                {
                    address: address.toString(),
                    amount: amount.toString(),
                    payload: payload?.toBoc().toString('base64'),
                    stateInit: stateInit
                        ? beginCell().storeWritable(storeStateInit(stateInit)).endCell().toBoc().toString('base64')
                        : undefined,
                },
            ],
        });

        return result;
    }
}
