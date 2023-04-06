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
    value: bigint;
    destination: Address;
};
export type MassSenderConfig = {
    messages: Msg[];
};

function createMessageValue(): DictionaryValue<Msg> {
    return {
        serialize: (src, buidler) => {
            buidler.storeCoins(src.value).storeAddress(src.destination);
        },
        parse: (src) => {
            return { value: src.loadCoins(), destination: src.loadAddress() };
        },
    };
}

function messagesToDict(messages: Msg[]): Dictionary<number, Msg> {
    let dict = Dictionary.empty(Dictionary.Keys.Uint(16), createMessageValue());
    for (let i = 1; i <= messages.length; i++) {
        dict.set(i, messages[i - 1]);
    }
    return dict;
}

export function massSenderConfigToCell(config: MassSenderConfig): Cell {
    return beginCell()
        .storeUint(Date.now(), 64)
        .storeCoins(config.messages.map((msg) => msg.value).reduce((a, b) => a + b))
        .storeUint(config.messages.length, 16)
        .storeUint(0, 16)
        .storeUint(0, 1)
        .storeUint(0, 2)
        .storeDict(messagesToDict(config.messages))
        .endCell();
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
        let s = this.init!.data.asSlice();
        s.loadUint(64);
        s.loadCoins();
        const length = s.loadUint(16);
        await provider.internal(via, {
            value: value + BigInt(length + Math.ceil(length / 254)) * toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        });
    }
}
