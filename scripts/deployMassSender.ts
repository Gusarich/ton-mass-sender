import { toNano } from 'ton-core';
import { MassSender } from '../wrappers/MassSender';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const massSender = provider.open(MassSender.createFromConfig({}, await compile('MassSender')));

    await massSender.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(massSender.address);

    // run methods on `massSender`
}
