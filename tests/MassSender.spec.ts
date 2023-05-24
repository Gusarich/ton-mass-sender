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
        for (let i = 0; i < 1400; i++) {
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
                    messages: [{ value: toNano('1'), destination: randomAddresses[0] }],
                    admin: deployer.address,
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
        expect(await massSender.getHasFinished()).toBeTruthy();
    });

    it('should send one message to admin', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: [{ value: toNano('0.1'), destination: deployer.address }],
                    admin: deployer.address,
                },
                code
            )
        );
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('0.1'));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: massSender.address,
            to: deployer.address,
            value: toNano('0.1'),
        });
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
        expect(await massSender.getHasFinished()).toBeTruthy();
    });

    it('should send 254 messages', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.slice(0, 254).map((addr, idx) => ({
                        value: toNano(idx + 1),
                        destination: addr,
                    })),
                    admin: deployer.address,
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
        expect(await massSender.getHasFinished()).toBeTruthy();
    });

    it('should send 1400 messages', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.map((addr, idx) => ({
                        value: toNano(idx + 1),
                        destination: addr,
                    })),
                    admin: deployer.address,
                },
                code
            )
        );
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('980700'));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: true,
        });
        for (let i = 0; i < 1400; ++i) {
            expect(result.transactions).toHaveTransaction({
                from: massSender.address,
                to: randomAddresses[i],
                value: toNano(i + 1),
            });
        }
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
        expect(await massSender.getHasFinished()).toBeTruthy();
    });

    it('should send 600 messages', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.slice(0, 600).map((addr, idx) => ({
                        value: toNano(idx + 1),
                        destination: addr,
                    })),
                    admin: deployer.address,
                },
                code
            )
        );
        const result = await massSender.sendDeploy(deployer.getSender(), toNano('180300'));
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: massSender.address,
            success: true,
        });
        for (let i = 0; i < 600; ++i) {
            expect(result.transactions).toHaveTransaction({
                from: massSender.address,
                to: randomAddresses[i],
                value: toNano(i + 1),
            });
        }
        expect((await blockchain.getContract(massSender.address)).balance).toEqual(0n);
        expect(await massSender.getHasFinished()).toBeTruthy();
    });

    it('should send message several times', async () => {
        async function sendMessage(msg: Msg) {
            let massSender = blockchain.openContract(
                MassSender.createFromConfig(
                    {
                        messages: [msg],
                        admin: deployer.address,
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
            expect(await massSender.getHasFinished()).toBeTruthy();
        }

        for (let i = 0; i < 15; ++i) {
            await sendMessage({
                value: toNano(randomInt(1, 100)),
                destination: randomAddresses[i],
            });
        }
    });

    it('should revert on not enough value', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.map((addr, idx) => ({
                        value: toNano(idx + 1),
                        destination: addr,
                    })),
                    admin: deployer.address,
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
        expect(await massSender.getHasFinished()).toBeFalsy();
    });

    it('should continue sending after post-payment', async () => {
        let massSender = blockchain.openContract(
            MassSender.createFromConfig(
                {
                    messages: randomAddresses.slice(0, 300).map((addr, idx) => ({
                        value: toNano(idx + 1),
                        destination: addr,
                    })),
                    total: 0n,
                    admin: deployer.address,
                },
                code
            )
        );

        let result = await massSender.sendDeploy(deployer.getSender(), toNano('45000'));
        expect(result.transactions).toHaveTransaction({
            on: massSender.address,
            aborted: true,
            actionResultCode: 37,
        });
        expect(result.transactions).toHaveLength(257);
        expect(await massSender.getHasFinished()).toBeFalsy();

        result = await massSender.sendContinue(deployer.getSender(), toNano('150'));
        expect(result.transactions).toHaveLength(49);
        expect(await massSender.getHasFinished()).toBeTruthy();
        for (let i = 254; i < 300; ++i) {
            expect(result.transactions).toHaveTransaction({
                from: massSender.address,
                to: randomAddresses[i],
                value: toNano(i + 1),
            });
        }
    });
});
