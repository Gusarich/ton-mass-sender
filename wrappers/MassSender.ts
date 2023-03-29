import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type MassSenderConfig = {};

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
}
