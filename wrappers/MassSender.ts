import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
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

function messagesToCell(messages: Msg[]): Cell {
    let c = beginCell()
        .storeCoins(messages[messages.length - 1].value)
        .storeAddress(messages[messages.length - 1].destination)
        .endCell();
    for (let i = messages.length - 2; i >= 0; i--) {
        c = beginCell().storeCoins(messages[i].value).storeAddress(messages[i].destination).storeRef(c).endCell();
    }
    return c;
}

export function massSenderConfigToCell(config: MassSenderConfig): Cell {
    if (config.messages.length > 1016) {
        throw 'Too many messages! Amount should not be more than 1016.';
    }
    let b = beginCell()
        .storeUint(Date.now(), 64)
        .storeCoins(config.messages.map((msg) => msg.value).reduce((a, b) => a + b))
        .storeUint(0, 1)
        .storeUint(0, 2);
    for (let i = 0; i < config.messages.length; i += 254) {
        const chunk = config.messages.slice(i, i + 254);
        b.storeRef(messagesToCell(chunk));
    }
    return b.endCell();
}

export function getMessagesLength(refs: Cell[]): number {
    return refs.map((r) => r.depth() + 1).reduce((a, b) => a + b);
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
            value: value + BigInt(getMessagesLength(this.init!.data.refs)) * toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        });
    }
}
