import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Address, Cell, toNano } from 'ton-core';
import { MassSender } from '../wrappers/MassSender';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { randomAddress } from '@ton-community/test-utils';

describe('MassSender', () => {
    let code: Cell;
    let randomAddresses: Address[] = [];

    beforeAll(async () => {
        code = await compile('MassSender');
        for (let i = 0; i < 254; i++) {
            randomAddresses.push(randomAddress());
        }
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
    });

    it('should deploy', async () => {});

    it('should send one message', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: [{ destination: randomAddresses[0], value: toNano('1') }],
                },
                code
            )
        );
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('1.11'));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: massSender.address,
            to: randomAddresses[0],
            value: toNano('1'),
        });
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
    });

    it('should send 254 messages', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.map((addr, idx) => ({
                        destination: addr,
                        value: toNano(idx + 1),
                    })),
                },
                code
            )
        );
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('32385'));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: true,
        });
        for (let i = 0; i < 254; ++i) {
            expect(result.transactions).toHaveTransaction({
                from: massSender.address,
                to: randomAddresses[i],
                value: toNano(i + 1),
            });
        }
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
    });
});
