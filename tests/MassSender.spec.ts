import { Blockchain, SandboxContract, TreasuryContract } from '@ton-community/sandbox';
import { Address, Cell, toNano } from 'ton-core';
import { MassSender, Msg } from '../wrappers/MassSender';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { randomAddress } from '@ton-community/test-utils';
import { randomInt } from 'crypto';

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
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('1'));
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

    it('should send message 254 times', async () => {
        async function sendMessage(msg: Msg) {
            let massSender = blockchain.openContract(
                MassSender.createFromConfig(
                    {
                        messages: [msg],
                    },
                    code
                )
            );
            const result = await massSender.sendDeploy(deployer.getSender(), msg.value);
            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: massSender.address,
                success: true,
            });
            expect(result.transactions).toHaveTransaction({
                from: massSender.address,
                to: msg.destination,
                value: msg.value,
            });
            expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
        }

        for (let i = 0; i < 254; ++i) {
            await sendMessage({
                destination: randomAddresses[i],
                value: toNano(randomInt(1, 100)),
            });
        }
    });

    it('should revert on not enough value', async () => {
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
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('32300'));
        expect(result.transactions).toHaveLength(3);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: false,
        });
        expect(result.transactions).toHaveTransaction({
            from: massSender.address,
            to: deployer.address,
            inMessageBounced: true,
        });
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
    });
});
