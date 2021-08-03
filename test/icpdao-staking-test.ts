import chai from 'chai'
import { ethers } from 'hardhat';

import {BigNumber, ContractFactory, Wallet} from "ethers";

import {
    IcpdaoDaoTokenFactory, IcpdaoDaoTokenFactory__factory,
    IcpdaoDaoToken, IcpdaoDaoToken__factory,
    IcpdaoStaking, IcpdaoStaking__factory
} from '../src/types/index';

import {abi as IcpdaoDaoTokenABI} from '../artifacts/contracts/IcpdaoDaoToken.sol/IcpdaoDaoToken.json'

const { expect } = chai;

const BIG_INT = BigNumber.from(10).pow(18*2);

const getWeiNumber = (input: number) => {
    return BigNumber.from(10).pow(18).mul(input);
}

const mintTransfer = async (
    icpdaoToken: IcpdaoDaoToken,
    tokena: IcpdaoDaoToken,
    tokenb: IcpdaoDaoToken,
    ownerAccount: Wallet,
    icpdaoStaking: IcpdaoStaking,
    transferAmount: number,
    expectAmountList: number[]
) => {
    await (await icpdaoToken.connect(ownerAccount).transfer(icpdaoStaking.address, getWeiNumber(transferAmount))).wait()
    await (await tokena.connect(ownerAccount).transfer(icpdaoStaking.address, getWeiNumber(transferAmount))).wait();
    await (await tokenb.connect(ownerAccount).transfer(icpdaoStaking.address, getWeiNumber(transferAmount))).wait();
    expect(
        await icpdaoToken.balanceOf(icpdaoStaking.address)
    ).to.eq(
        getWeiNumber(expectAmountList[0])
    )
    expect(
        await tokena.balanceOf(icpdaoStaking.address)
    ).to.eq(
        getWeiNumber(expectAmountList[1])
    )
    expect(
        await tokenb.balanceOf(icpdaoStaking.address)
    ).to.eq(
        getWeiNumber(expectAmountList[2])
    )
}

const expectPoolInfo = async (
    token: IcpdaoDaoToken,
    icpdaoStaking: IcpdaoStaking,
    expectAmountList: any[]
) => {
    expect(
        (await icpdaoStaking.poolInfo(token.address)).accTokenPerShare
    ).to.eq(
        expectAmountList[0]
    )
    expect(
        (await icpdaoStaking.poolInfo(token.address)).userStakingIcpdaoAmount
    ).to.eq(
        expectAmountList[1]
    )
    expect(
        (await icpdaoStaking.poolInfo(token.address)).blanceHaveMintAmount
    ).to.eq(
        expectAmountList[2]
    )
}

const expectBonus = async (
    icpdaoDaoToken: IcpdaoDaoToken,
    tokena: IcpdaoDaoToken,
    tokenb: IcpdaoDaoToken,
    icpdaoStaking: IcpdaoStaking,
    userAccount: Wallet,
    expectTokenList: any[],
    expectAmountList: any[]
) => {
    const resultTokenList = (await icpdaoStaking.bonus(userAccount.address)).resultTokenList;
    const resultAmountList = (await icpdaoStaking.bonus(userAccount.address)).resultAmountList;

    expect(resultTokenList.length).to.be.eq(expectTokenList.length);

    for(let index = 0; index < expectTokenList.length; index++) {
        let token = expectTokenList[index];
        expect(resultTokenList).to.be.include(token.address);
    }

    for (let index = 0; index < resultTokenList.length; index++) {
        let token = resultTokenList[index];
        if (icpdaoDaoToken.address == token) {
            expect(resultAmountList[index]).to.be.eq(expectAmountList[0])
        }
        if (tokena.address == token) {
            expect(resultAmountList[index]).to.be.eq(expectAmountList[1])
        }
        if (tokenb.address == token) {
            expect(resultAmountList[index]).to.be.eq(expectAmountList[2])
        }
    }
}

const expectBalanceOf = async (
    icpdaoToken: IcpdaoDaoToken,
    tokena: IcpdaoDaoToken,
    tokenb: IcpdaoDaoToken,
    userAccountAddress: string,
    expectAmountList: any[]
) => {
    expect(
        await icpdaoToken.balanceOf(userAccountAddress)
    ).to.eq(
        expectAmountList[0]
    );
    expect(
        await tokena.balanceOf(userAccountAddress)
    ).to.eq(
        expectAmountList[1]
    );
    expect(
        await tokenb.balanceOf(userAccountAddress)
    ).to.eq(
        expectAmountList[2]
    );
}

describe("IcpdaoStaking", () => {
    let wallets: Wallet[];
    let deployAccount: Wallet;
    let ownerAccount: Wallet;
    let user1Account: Wallet;
    let user2Account: Wallet;
    let icpdaoStaking: IcpdaoStaking;
    let icpdaoDaoTokenFactory: IcpdaoDaoTokenFactory;
    let icpdaoToken: IcpdaoDaoToken; // 1
    let tokena: IcpdaoDaoToken;      // 2
    let tokenb: IcpdaoDaoToken;      // 3
    let startTimestamp: number;
    let deployTimestamp: number;
    let firstMintTimestamp: number;

    it("test", async () => {
        wallets = await (ethers as any).getSigners();
        deployAccount = wallets[0];
        ownerAccount = wallets[1];
        user1Account = wallets[2];
        user2Account = wallets[3];

        // 1. 部署 stack
        // 2. 准备 3 个 icpdaotoken
        // 3. 用户1 第一次质押 1 2 100
        // 4. 挖矿 1000
        // 5. 用户2 第一次质押 2 3 150
        // 6. 挖矿 1000
        // 7. 用户1 第二次质押 100 token 类型不变
        // 8 挖矿 1000
        // 9 用户2 第二次质押 150 增加 1
        // 10 挖矿 1000
        // 11 用户1 增加 token 3
        // 12 挖矿 1000
        // 13 用户2 减少 token 1
        // 14 挖矿 1000
        // 15 用户 1 提取手续费 1 2
        // 16 用户 2 提取手续费 2 3
        // 17 挖矿 1000
        // 18 用户1 退出质押 一半
        // 19 用户2 全部退出质押
        // 20 owner 转移

        // deploy IcpdaoStaking
        const IcpdaoStakingFactory: ContractFactory = new IcpdaoStaking__factory(deployAccount);
        icpdaoStaking = (await IcpdaoStakingFactory.deploy(
            ownerAccount.address
        )) as IcpdaoStaking;

        // deploy IcpdaoDaoTokenFactory
        const IcpdaoDaoTokenFactoryFactory: ContractFactory = new IcpdaoDaoTokenFactory__factory(deployAccount);
        icpdaoDaoTokenFactory = (await IcpdaoDaoTokenFactoryFactory.deploy(
            icpdaoStaking.address
        )) as IcpdaoDaoTokenFactory;

        // deploy icpdaotoken
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        startTimestamp = block.timestamp;
        deployTimestamp = startTimestamp + 86400 * 10;
        firstMintTimestamp = startTimestamp + 86400 * 40;

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        let icpdaoTokenTokenCount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            [ownerAccount.address],
            [icpdaoTokenTokenCount],
            101,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: -1,
                d: 0
            },
            '1',
            "icp-token",
            "ICP"
        )).wait();

        const icpdaoDaoTokenAddress = await icpdaoDaoTokenFactory.tokens('1')
        icpdaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as IcpdaoDaoToken;

        // deploy tokena
        let tokenACount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            [ownerAccount.address],
            [tokenACount],
            101,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: -1,
                d: 0
            },
            '2',
            "tokena",
            "TA"
        )).wait();

        const tokenaAddress = await icpdaoDaoTokenFactory.tokens('2')
        tokena = (await ethers.getContractAt(IcpdaoDaoTokenABI, tokenaAddress)) as IcpdaoDaoToken;

        // deploy tokenb
        let tokenBCount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            [ownerAccount.address],
            [tokenBCount],
            101,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: -1,
                d: 0
            },
            '3',
            "tokenb",
            "TB"
        )).wait();

        const tokenbAddress = await icpdaoDaoTokenFactory.tokens('3')
        tokenb = (await ethers.getContractAt(IcpdaoDaoTokenABI, tokenbAddress)) as IcpdaoDaoToken;

        // setIcpdaoToken
        await expect(
            icpdaoStaking.connect(user1Account).setIcpdaoToken(icpdaoToken.address)
        ).to.be.revertedWith("ICPDAO: NOT OWNER");
        // approve
        await icpdaoStaking.connect(ownerAccount).setIcpdaoToken(icpdaoToken.address);
        await icpdaoToken.connect(user1Account).approve(icpdaoStaking.address, BIG_INT);
        await icpdaoToken.connect(user2Account).approve(icpdaoStaking.address, BIG_INT);

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                0,
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                0,
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                0,
                0,
                0
            ]
        )

        await (await icpdaoToken.connect(ownerAccount).transfer(
            user1Account.address,
            getWeiNumber(1000)
        )).wait();

        await (await icpdaoToken.connect(ownerAccount).transfer(
            user2Account.address,
            getWeiNumber(1000)
        )).wait();

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(1000),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1000),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                0,
                0,
                0
            ]
        )


        // 3. 用户1 第一次质押 1 2 100
        await (await icpdaoStaking.connect(user1Account).deposit(
            getWeiNumber(100),
            [icpdaoToken.address, tokena.address]
        )).wait();

        /**
         * userStakingIcpdaoTotalAmount 100
         * UserStakeInfo
         *  user1
         *      amount 100
         *      tokens [icpdao, tokena]
         *  user2
         *      amount 0
         *      tokens []
         * PoolInfo
         *  icpdao
         *      accTokenPerShare 0
         *      userStakingIcpdaoAmount 100
         *      blanceHaveMintAmount 0
         *      user1
         *          rewardDebt 0
         *  tokena
         *      accTokenPerShare 0
         *      userStakingIcpdaoAmount 100
         *      blanceHaveMintAmount 0
         *      user1
         *          rewardDebt 0
         *  tokenb
         *      accTokenPerShare 0
         *      userStakingIcpdaoAmount 0
         *      blanceHaveMintAmount 0
         * */
        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(100)
        )

        const { amount: user1StakeAmount, tokens: user1StakeTokens}: { amount: BigNumber; tokens: string[] } = await icpdaoStaking.userStakeInfo(user1Account.address);
        expect(
            user1StakeAmount
        ).to.eq(
            getWeiNumber(100)
        )
        expect(user1StakeTokens).to.include(icpdaoToken.address);
        expect(user1StakeTokens).to.include(tokena.address);
        expect(user1StakeTokens.length).to.eq(2);

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(900),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1000),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(100),
                0,
                0
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [0, getWeiNumber(100), 0]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [0, getWeiNumber(100), 0]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [0, 0, 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [0, 0, 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [],
            [0, 0, 0]
        )

        // 4. 挖矿
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [1100, 1000, 1000]
        )

        // 5. 用户2 第一次质押 2 3
        await (await icpdaoStaking.connect(user2Account).deposit(
            getWeiNumber(150),
            [tokena.address, tokenb.address]
        )).wait();


        /**
         * userStakingIcpdaoTotalAmount 250
         * UserStakeInfo
         *  user1
         *      amount 100
         *      tokens [icpdao, tokena]
         *  user2
         *      amount 150
         *      tokens [tokena, tokenb]
         * PoolInfo
         *  icpdao
         *      accTokenPerShare 0
         *      userStakingIcpdaoAmount 100
         *      blanceHaveMintAmount 0
         *      user1
         *          rewardDebt 0
         *  tokena
         *      accTokenPerShare 10
         *      userStakingIcpdaoAmount 100 + 150
         *      blanceHaveMintAmount 1000
         *      user1
         *          rewardDebt 10 * 100
         *      user2
         *          rewardDebt 10 * 150
         *  tokenb
         *      accTokenPerShare 0
         *      userStakingIcpdaoAmount 150
         *      blanceHaveMintAmount 0
         *      user2
         *          rewardDebt 0
         * */

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(250)
        )

        const { amount: user2StakeAmount, tokens: user2StakeTokens}: { amount: BigNumber; tokens: string[] } = await icpdaoStaking.userStakeInfo(user2Account.address);
        expect(
            user2StakeAmount
        ).to.eq(
            getWeiNumber(150)
        )
        expect(user2StakeTokens).to.include(tokena.address);
        expect(user2StakeTokens).to.include(tokenb.address);
        expect(user2StakeTokens.length).to.eq(2);

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(900),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(850),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(1250),
                getWeiNumber(1000),
                getWeiNumber(1000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [0, getWeiNumber(100), 0]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [10, getWeiNumber(250), getWeiNumber(1000)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [0, getWeiNumber(150), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1000), getWeiNumber(1000), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, 0, getWeiNumber(900)]
        )

        // 6. 挖矿
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [2250, 2000, 2000]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(2000), getWeiNumber(1400), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600), getWeiNumber(150 * 13)]
        )

        // 7. 用户1 第二次质押 100 token 类型不变
        await (await icpdaoStaking.connect(user1Account).deposit(
            getWeiNumber(100),
            []
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(350)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).tokens
        ).to.include(tokena.address);
        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).tokens
        ).to.include(icpdaoToken.address);
        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).tokens.length
        ).to.eq(2);

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(900 + 2000 - 100),
                getWeiNumber(1400),
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(850),
                0,
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(350),
                getWeiNumber(2000 - 1400),
                getWeiNumber(2000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [20, getWeiNumber(200), 0]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [14, getWeiNumber(350), getWeiNumber(600)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [0, getWeiNumber(150), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [0, 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600), getWeiNumber(150 * 13)]
        )

        // 8 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [350 + 1000, 600 + 1000, 2000 + 1000]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1000), getWeiNumber(400), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600 + 150 * 2), getWeiNumber(150 * 20)]
        )

        // 9 用户2 第二次质押 150 增加 1
        await (await icpdaoStaking.connect(user2Account).deposit(
            getWeiNumber(150),
            [icpdaoToken.address]
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(2800),
                getWeiNumber(1400),
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(850 - 150),
                getWeiNumber(900),
                getWeiNumber(150 * 20)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(350 + 150 + 1000),
                getWeiNumber(600 + 1000 - 900),
                getWeiNumber(2000 + 1000 - 150 * 20)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [25, getWeiNumber(500), getWeiNumber(1000)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [16, getWeiNumber(500), getWeiNumber(400)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [20, getWeiNumber(300), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1000), getWeiNumber(400), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [0, 0, 0]
        )

        // 10 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [1500 + 1000, 700 + 1000, 1000]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1400), getWeiNumber(800), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600), getWeiNumber(600), getWeiNumber(900)]
        )

        // 11 用户1 增加 token 3
        await (await icpdaoStaking.connect(user1Account).addTokenList(
            [tokenb.address]
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )


        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(2800),
                getWeiNumber(1400),
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(850 - 150),
                getWeiNumber(900),
                getWeiNumber(150 * 20)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(2500),
                getWeiNumber(1700),
                getWeiNumber(1000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [25, getWeiNumber(500), getWeiNumber(1000)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [16, getWeiNumber(500), getWeiNumber(400)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [23, getWeiNumber(500), getWeiNumber(900)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400), getWeiNumber(800), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600), getWeiNumber(600), getWeiNumber(900)]
        )

        // 12 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [2500 + 1000, 1700 + 1000, 1000 + 1000]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400 + 400), getWeiNumber(800 + 400), getWeiNumber(0 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600 + 600), getWeiNumber(600 + 600), getWeiNumber(900 + 600)]
        )

        // 13 用户2 减少 token 1
        await (await icpdaoStaking.connect(user2Account).removeTokenList(
            [icpdaoToken.address]
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(2800),
                getWeiNumber(1400),
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(700 + 1200),
                getWeiNumber(900),
                getWeiNumber(3000)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(3500 - 1200),
                getWeiNumber(2700),
                getWeiNumber(2000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [25 + 4, getWeiNumber(500 - 300), getWeiNumber(1000 + 800)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [16, getWeiNumber(500), getWeiNumber(400)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [23, getWeiNumber(500), getWeiNumber(900)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400 + 400), getWeiNumber(800 + 400), getWeiNumber(0 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600 + 600), getWeiNumber(900 + 600)]
        )

        // 14 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [2300 + 1000, 2700 + 1000, 2000 + 1000]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1800 + 1000), getWeiNumber(1200 + 400), getWeiNumber(400 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(1200 + 600), getWeiNumber(1500 + 600)]
        )

        // 15 用户 1 提取手续费 1 2
        await (await icpdaoStaking.connect(user1Account).bonusWithdraw(
            [icpdaoToken.address, tokena.address]
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )


        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(2800 + 2800),
                getWeiNumber(1400 + 1600),
                0
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1900),
                getWeiNumber(900),
                getWeiNumber(3000)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(3300 - 2800),
                getWeiNumber(3700 - 1600),
                getWeiNumber(3000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [29 + 5, getWeiNumber(200), getWeiNumber(1800 + 1000 - 2800)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [16 + 6, getWeiNumber(500), getWeiNumber(400 + 3000 - 1600)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [23, getWeiNumber(500), getWeiNumber(900)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [0, 0, getWeiNumber(800)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(1800), getWeiNumber(2100)]
        )

        // 16 用户 2 提取手续费 2 3
        await (await icpdaoStaking.connect(user2Account).bonusWithdraw(
            [tokena.address, tokenb.address]
        )).wait();


        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(5600),
                getWeiNumber(3000),
                0
            ]
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1900),
                getWeiNumber(900 + 1800),
                getWeiNumber(3000 + 2100)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(500),
                getWeiNumber(2100 - 1800),
                getWeiNumber(3000 - 2100)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [34, getWeiNumber(200), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [22, getWeiNumber(500), getWeiNumber(1800 - 1800)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [23 + 4, getWeiNumber(500), getWeiNumber(900 + 2000 - 2100)]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [0, 0, getWeiNumber(800)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, 0, 0]
        )

        // 17 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            1000,
            [500 + 1000, 300 + 1000, 900 + 1000]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1000), getWeiNumber(400), getWeiNumber(800 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600), getWeiNumber(600)]
        )

        // 18 用户1 退出质押 一半
        await (await icpdaoStaking.connect(user1Account).withdraw(
            getWeiNumber(100)
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(400)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(300)
        )


        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(5600 + 1000 + 100),
                getWeiNumber(3000 + 400),
                getWeiNumber(0 + 1200)
            ]
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1900),
                getWeiNumber(2700),
                getWeiNumber(5100)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(1500 - 1000 - 100),
                getWeiNumber(1300 - 400),
                getWeiNumber(1900 - 1200)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [34 + 5, getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [22 + 2, getWeiNumber(400), getWeiNumber(600)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [27 + 2, getWeiNumber(400), getWeiNumber(600)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [0, 0, 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600), getWeiNumber(600)]
        )

        // 19 用户2 全部退出质押
        await (await icpdaoStaking.connect(user2Account).withdraw(
            getWeiNumber(300)
        )).wait();

        expect(
            await icpdaoStaking.userStakingIcpdaoTotalAmount()
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userStakeInfo(user2Account.address)).amount
        ).to.eq(
            getWeiNumber(0)
        )


        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user1Account.address,
            [
                getWeiNumber(6700),
                getWeiNumber(3400),
                getWeiNumber(1200)
            ]
        )

        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            user2Account.address,
            [
                getWeiNumber(1900 + 300),
                getWeiNumber(2700 + 600),
                getWeiNumber(5100 + 600)
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(400 - 300),
                getWeiNumber(900 - 600),
                getWeiNumber(700 - 600)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [39, getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [24, getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [29, getWeiNumber(100), getWeiNumber(0)]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [0, getWeiNumber(300), getWeiNumber(100)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [],
            [0, 0, 0]
        )

        // 20 owner 转移
        expect(
            await icpdaoStaking.owner()
        ).to.eq(
            ownerAccount.address
        )
        await expect(
            icpdaoStaking.connect(user1Account).transferOwnership(user2Account.address)
        ).to.be.revertedWith("ICPDAO: NOT OWNER");

        await (await icpdaoStaking.connect(ownerAccount).transferOwnership(user2Account.address)).wait();
        expect(
            await icpdaoStaking.owner()
        ).to.eq(
            user2Account.address
        )

    });
});