import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
} from 'ton-core';

export type MassSenderConfig = {};
export type Msg = {
    destination: Address;
    value: bigint;
};

export function massSenderConfigToCell(config: MassSenderConfig): Cell {
    return beginCell().endCell();
}

export class MassSender implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MassSender(address);
    }

    static createFromConfig(config: MassSenderConfig, code: Cell, workchain = 0) {
        const data = massSenderConfigToCell(config);
        const init = { code, data };
        return new MassSender(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendSend(provider: ContractProvider, via: Sender, value: bigint, messages: Msg[]) {
        let msgDict = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
        for (let i = 0; i < messages.length; i++) {
            msgDict.set(i, beginCell().storeAddress(messages[i].destination).storeCoins(messages[i].value).endCell());
        }

        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x2883b930, 32).storeUint(messages.length, 8).storeDict(msgDict).endCell(),
        });
    }
}
