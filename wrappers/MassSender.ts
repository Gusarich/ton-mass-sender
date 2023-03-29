import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    DictionaryValue,
    Sender,
    SendMode,
    toNano,
} from 'ton-core';

export type Msg = {
    destination: Address;
    value: bigint;
};
export type MassSenderConfig = {
    messages: Msg[];
};

const msgDictValue: DictionaryValue<Msg> = {
    serialize: (src, buidler) => {
        buidler.storeAddress(src.destination).storeCoins(src.value);
    },
    parse: (src) => {
        return { destination: src.loadAddress(), value: src.loadCoins() };
    },
};

export function massSenderConfigToCell(config: MassSenderConfig): Cell {
    let msgDict = Dictionary.empty(Dictionary.Keys.Uint(8), msgDictValue);
    for (let i = 0; i < config.messages.length; i++) {
        msgDict.set(i, config.messages[i]);
    }
    return beginCell().storeUint(config.messages.length, 8).storeDict(msgDict).endCell();
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
            value: value + this.init!.data.beginParse().loadUintBig(8) * toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        });
    }
}
