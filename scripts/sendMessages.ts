import { Address, toNano } from 'ton-core';
import { MassSender, Msg } from '../wrappers/MassSender';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function process(provider: NetworkProvider, messages: Msg[]) {
    const massSender = provider.open(
        MassSender.createFromConfig(
            {
                messages,
            },
            await compile('MassSender')
        )
    );

    await massSender.sendDeploy(
        provider.sender(),
        messages.map((msg) => msg.value).reduce((a, b) => a + b)
    );

    await provider.waitForDeploy(massSender.address);
}

export async function run(provider: NetworkProvider) {
    let rawMessages = require('./transactions.json');
    let messages: Msg[] = [];
    for (const addr of Object.keys(rawMessages)) {
        messages.push({
            destination: Address.parse(addr),
            value: toNano(rawMessages[addr]),
        });
    }
    await process(provider, messages);
}
