import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { MassSender } from '../wrappers/MassSender';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('MassSender', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('MassSender');
    });

    let blockchain: Blockchain;
    let massSender: SandboxContract<MassSender>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        massSender = blockchain.openContract(MassSender.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await massSender.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            deploy: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and massSender are ready to use
    });
});
