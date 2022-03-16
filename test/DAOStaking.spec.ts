import chai from 'chai'
import { ethers } from 'hardhat';

import {BigNumber, ContractFactory, Wallet} from "ethers";

import {
    DAOFactoryStore,
    DAOFactory, DAOFactory__factory,
    DAOToken, DAOToken__factory,
    DAOStaking, DAOStaking__factory
} from '../typechain';

import {abi as DAOTokenABI} from '../artifacts/contracts/DAOToken.sol/DAOToken.json'

const { expect } = chai;

const BIG_INT = BigNumber.from(10).pow(18*2);

const getWeiNumber = (input: number) => {
    return BigNumber.from(10).pow(18).mul(input);
}

const mintTransfer = async (
    icpdaoToken: DAOToken,
    tokena: DAOToken,
    tokenb: DAOToken,
    ownerAccount: Wallet,
    icpdaoStaking: DAOStaking,
    transferAmount: any,
    expectAmountList: any[]
) => {
    await (await icpdaoToken.connect(ownerAccount).transfer(icpdaoStaking.address, transferAmount)).wait()
    await (await tokena.connect(ownerAccount).transfer(icpdaoStaking.address, transferAmount)).wait();
    await (await tokenb.connect(ownerAccount).transfer(icpdaoStaking.address, transferAmount)).wait();
    expect(
        await icpdaoToken.balanceOf(icpdaoStaking.address)
    ).to.eq(
        expectAmountList[0]
    )
    expect(
        await tokena.balanceOf(icpdaoStaking.address)
    ).to.eq(
        expectAmountList[1]
    )
    expect(
        await tokenb.balanceOf(icpdaoStaking.address)
    ).to.eq(
        expectAmountList[2]
    )
}

const expectPoolInfo = async (
    token: DAOToken,
    icpdaoStaking: DAOStaking,
    expectAmountList: any[]
) => {
    expect(
        (await icpdaoStaking.poolInfo(token.address)).accPerShare
    ).to.eq(
        expectAmountList[0]
    )
    expect(
        (await icpdaoStaking.poolInfo(token.address)).userStakingIcpdAmount
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
    icpdaoDaoToken: DAOToken,
    tokena: DAOToken,
    tokenb: DAOToken,
    icpdaoStaking: DAOStaking,
    userAccount: Wallet,
    expectTokenList: any[],
    expectAmountList: any[]
) => {
    const resultTokenList = (await icpdaoStaking.bonus(userAccount.address)).tokens;
    const resultAmountList = (await icpdaoStaking.bonus(userAccount.address)).amounts;

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
    icpdaoToken: DAOToken,
    tokena: DAOToken,
    tokenb: DAOToken,
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
    let icpdaoStaking: DAOStaking;
    let icpdaoDaoTokenFactory: DAOFactory;
    let icpdaoToken: DAOToken; // 1
    let tokena: DAOToken;      // 2
    let tokenb: DAOToken;      // 3
    let startTimestamp: number;
    let deployTimestamp: number;
    let firstMintTimestamp: number;
    let _lpTotalAmount: number = 100000;

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

        // deploy DAOStaking
        const IcpdaoStakingFactory: ContractFactory = new DAOStaking__factory(deployAccount);
        icpdaoStaking = (await IcpdaoStakingFactory.deploy(
            ownerAccount.address
        )) as DAOStaking;

        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        // deploy DAOFactory
        const IcpdaoDaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        icpdaoDaoTokenFactory = (await IcpdaoDaoTokenFactoryFactory.deploy(
            ownerAccount.address,
            store.address
        )) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(icpdaoDaoTokenFactory.address)).wait();

        // deploy icpdaotoken
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        startTimestamp = block.timestamp;
        deployTimestamp = startTimestamp + 86400 * 10;
        firstMintTimestamp = startTimestamp + 86400 * 40;

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        let icpdaoTokenTokenCount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            '1',
            [ownerAccount.address],
            [icpdaoTokenTokenCount],
            101,
            _lpTotalAmount,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "icp-token",
            "ICP"
        )).wait();

        const {token: icpdaoDaoTokenAddress} = await icpdaoDaoTokenFactory.tokens('1')
        icpdaoToken = (await ethers.getContractAt(DAOTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        // deploy tokena
        let tokenACount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            '2',
            [ownerAccount.address],
            [tokenACount],
            101,
            _lpTotalAmount,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "tokena",
            "TA"
        )).wait();

        const {token: tokenaAddress} = await icpdaoDaoTokenFactory.tokens('2')
        tokena = (await ethers.getContractAt(DAOTokenABI, tokenaAddress)) as DAOToken;

        // deploy tokenb
        let tokenBCount = getWeiNumber(10000);
        await (await icpdaoDaoTokenFactory.connect(deployAccount).deploy(
            '3',
            [ownerAccount.address],
            [tokenBCount],
            101,
            _lpTotalAmount,
            ownerAccount.address,
            {
                p: 20,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "tokenb",
            "TB"
        )).wait();

        const {token: tokenbAddress} = await icpdaoDaoTokenFactory.tokens('3')
        tokenb = (await ethers.getContractAt(DAOTokenABI, tokenbAddress)) as DAOToken;

        // setIcpdaoToken
        await expect(
            icpdaoStaking.connect(user1Account).setICPToken(icpdaoToken.address)
        ).to.be.revertedWith("ICPDAO: NOT OWNER");
        // approve
        await icpdaoStaking.connect(ownerAccount).setICPToken(icpdaoToken.address);
        expect(
            await icpdaoStaking.ICPD()
        ).to.eq(
            icpdaoToken.address
        )
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
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(100)
        )

        const { amount: user1StakeAmount, tokens: user1StakeTokens}: { amount: BigNumber; tokens: string[] } = await icpdaoStaking.userInfo(user1Account.address);
        expect(
            user1StakeAmount
        ).to.eq(
            getWeiNumber(100)
        )
        expect(user1StakeTokens).to.include(icpdaoToken.address);
        expect(user1StakeTokens).to.include(tokena.address);
        expect(user1StakeTokens.length).to.eq(2);

        expect(
            await icpdaoStaking.userRewardDebt(user1Account.address, icpdaoToken.address)
        ).to.eq(
            0
        )
        expect(
            await icpdaoStaking.userRewardDebt(user1Account.address, tokena.address)
        ).to.eq(
            0
        )

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
            getWeiNumber(1000),
            [getWeiNumber(1100), getWeiNumber(1000), getWeiNumber(1000)]
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
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(250)
        )

        const { amount: user2StakeAmount, tokens: user2StakeTokens}: { amount: BigNumber; tokens: string[] } = await icpdaoStaking.userInfo(user2Account.address);
        expect(
            user2StakeAmount
        ).to.eq(
            getWeiNumber(150)
        )
        expect(user2StakeTokens).to.include(tokena.address);
        expect(user2StakeTokens).to.include(tokenb.address);
        expect(user2StakeTokens.length).to.eq(2);

        expect(
            await icpdaoStaking.userRewardDebt(user2Account.address, tokena.address)
        ).to.eq(
            BigNumber.from("1500000000000000000000")
        )

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
            tokena, icpdaoStaking, [BigNumber.from(10).mul(1e12), getWeiNumber(250), getWeiNumber(1000)]
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
            [0, 0, BigNumber.from('999999999999900000000')]
        )

        // 6. 挖矿
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            getWeiNumber(1000),
            [getWeiNumber(2250), getWeiNumber(2000), getWeiNumber(2000)]
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
            [0, getWeiNumber(600), BigNumber.from('1999999999999950000000')]
        )

        console.log("7. 用户1 第二次质押 100 token 类型不变")
        // 7. 用户1 第二次质押 100 token 类型不变
        await (await icpdaoStaking.connect(user1Account).deposit(
            getWeiNumber(100),
            []
        )).wait();

        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(350)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            await icpdaoStaking.userRewardDebt(user1Account.address, tokena.address)
        ).to.eq(
            BigNumber.from("2800000000000000000000")
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).tokens
        ).to.include(tokena.address);
        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).tokens
        ).to.include(icpdaoToken.address);
        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).tokens.length
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
            icpdaoToken, icpdaoStaking, [BigNumber.from(20).mul(1e12), getWeiNumber(200), 0]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from(14).mul(1e12), getWeiNumber(350), getWeiNumber(600)]
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
            [0, getWeiNumber(600), BigNumber.from('1999999999999950000000')]
        )

        // 8 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            getWeiNumber(1000),
            [getWeiNumber(350 + 1000), getWeiNumber(600 + 1000), getWeiNumber(2000 + 1000)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1000), BigNumber.from('571428571428400000000'), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, BigNumber.from('1028571428571300000000'), getWeiNumber(150 * 20)]
        )

        console.log("9 用户2 第二次质押 150 增加 1")
        // 9 用户2 第二次质押 150 增加 1
        await (await icpdaoStaking.connect(user2Account).deposit(
            getWeiNumber(150),
            [icpdaoToken.address]
        )).wait();

        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from('1028571428571300000000'),
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
                BigNumber.from('571428571428700000000'),
                getWeiNumber(2000 + 1000 - 150 * 20)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(25).mul(1e12), getWeiNumber(500), getWeiNumber(1000)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from('16857142857142'), getWeiNumber(500), BigNumber.from('571428571428400000000')]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from(20).mul(1e12), getWeiNumber(300), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1000), BigNumber.from('571428571428400000000'), 0]
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
            getWeiNumber(1000),
            [BigNumber.from('2500000000000000000000'), BigNumber.from("1571428571428700000000"), getWeiNumber(1000)]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena],
            [getWeiNumber(1400), BigNumber.from("971428571428400000000"), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600), getWeiNumber(600), BigNumber.from("999999999999900000000")]
        )

        // 11 用户1 增加 token 3
        await (await icpdaoStaking.connect(user1Account).addTokenList(
            [tokenb.address]
        )).wait();

        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("1028571428571300000000"),
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
                BigNumber.from("1571428571428700000000"),
                getWeiNumber(1000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(25).mul(1e12), getWeiNumber(500), getWeiNumber(1000)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("16857142857142"), getWeiNumber(500), BigNumber.from("571428571428400000000")]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("23333333333333"), getWeiNumber(500), BigNumber.from("999999999999900000000")]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400), BigNumber.from("971428571428400000000"), 0]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600), getWeiNumber(600), BigNumber.from("999999999999900000000")]
        )

        // 12 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            getWeiNumber(1000),
            [getWeiNumber(2500 + 1000), BigNumber.from("2571428571428700000000"), getWeiNumber(1000 + 1000)]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400 + 400), BigNumber.from("1371428571428400000000"), getWeiNumber(0 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(600 + 600), getWeiNumber(600 + 600), BigNumber.from("1599999999999900000000")]
        )

        // 13 用户2 减少 token 1
        await (await icpdaoStaking.connect(user2Account).removeTokenList(
            [icpdaoToken.address]
        )).wait();

        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("1028571428571300000000"),
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
                BigNumber.from("2571428571428700000000"),
                getWeiNumber(2000)
            ]
        )

        await expectPoolInfo(

            icpdaoToken, icpdaoStaking, [BigNumber.from(25 + 4).mul(1e12), getWeiNumber(500 - 300), getWeiNumber(1000 + 800)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("16857142857142"), getWeiNumber(500), BigNumber.from("571428571428400000000")]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("23333333333333"), getWeiNumber(500), BigNumber.from("999999999999900000000")]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1400 + 400), BigNumber.from("1371428571428400000000"), getWeiNumber(0 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(600 + 600), BigNumber.from("1599999999999900000000")]
        )

        // 14 挖矿 1000
        await mintTransfer(
            icpdaoToken,
            tokena,
            tokenb,
            ownerAccount,
            icpdaoStaking,
            getWeiNumber(1000),
            [getWeiNumber(2300 + 1000), BigNumber.from("3571428571428700000000"), getWeiNumber(2000 + 1000)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [getWeiNumber(1800 + 1000), BigNumber.from("1771428571428400000000"), getWeiNumber(400 + 400)]
        )

        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user2Account,
            [tokena, tokenb],
            [0, getWeiNumber(1200 + 600), BigNumber.from("2199999999999900000000")]
        )

        // 15 用户 1 提取手续费 1 2
        await (await icpdaoStaking.connect(user1Account).bonusWithdraw(
            [icpdaoToken.address, tokena.address]
        )).wait();

        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("3171428571428400000000"),
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
                BigNumber.from("1028571428571300000000"),
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
                BigNumber.from("1800000000000300000000"),
                getWeiNumber(3000)
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(29 + 5).mul(1e12), getWeiNumber(200), getWeiNumber(1800 + 1000 - 2800)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("22857142857142"), getWeiNumber(500), getWeiNumber(400 + 3000 - 1600)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("23333333333333"), getWeiNumber(500), BigNumber.from("999999999999900000000")]
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
            [0, getWeiNumber(1800), BigNumber.from("2199999999999900000000")]
        )

        // 16 用户 2 提取手续费 2 3
        await (await icpdaoStaking.connect(user2Account).bonusWithdraw(
            [tokena.address, tokenb.address]
        )).wait();


        expect(
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(500)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(200)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("3171428571428400000000"),
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
                BigNumber.from("2828571428571300000000"),
                BigNumber.from("5199999999999900000000")
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(500),
                BigNumber.from("300000000"),
                BigNumber.from("800000000000100000000")
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(34).mul(1e12), getWeiNumber(200), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("22857142857142"), getWeiNumber(500), getWeiNumber(1800 - 1800)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("27333333333333"), getWeiNumber(500), getWeiNumber(900 + 2000 - 2100)]
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
            getWeiNumber(1000),
            [getWeiNumber(500 + 1000), BigNumber.from("1000000000000300000000"), BigNumber.from("1800000000000100000000")]
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
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(400)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("3571428571428400000000"),
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
                BigNumber.from("2828571428571300000000"),
                BigNumber.from("5199999999999900000000")
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(1500 - 1000 - 100),
                BigNumber.from("600000000000300000000"),
                BigNumber.from("600000000000100000000")
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(34 + 5).mul(1e12), getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("24857142857142"), getWeiNumber(400), getWeiNumber(600)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("29333333333333"), getWeiNumber(400), getWeiNumber(600)]
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
            await icpdaoStaking.totalStaking()
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userInfo(user1Account.address)).amount
        ).to.eq(
            getWeiNumber(100)
        )

        expect(
            (await icpdaoStaking.userInfo(user2Account.address)).amount
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
                BigNumber.from("3571428571428400000000"),
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
                BigNumber.from("3428571428571300000000"),
                BigNumber.from("5799999999999900000000")
            ]
        )
        await expectBalanceOf(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking.address,
            [
                getWeiNumber(400 - 300),
                BigNumber.from("300000000"),
                BigNumber.from("100000000")
            ]
        )

        await expectPoolInfo(
            icpdaoToken, icpdaoStaking, [BigNumber.from(39).mul(1e12), getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokena, icpdaoStaking, [BigNumber.from("24857142857142"), getWeiNumber(100), getWeiNumber(0)]
        )
        await expectPoolInfo(
            tokenb, icpdaoStaking, [BigNumber.from("29333333333333"), getWeiNumber(100), getWeiNumber(0)]
        )


        await expectBonus(
            icpdaoToken,
            tokena,
            tokenb,
            icpdaoStaking,
            user1Account,
            [icpdaoToken, tokena, tokenb],
            [0, BigNumber.from("300000000"), BigNumber.from("100000000")]
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

        // await expect(
        //     icpdaoStaking.connect(user1Account).destruct()
        // ).to.be.revertedWith("ICPDAO: ONLY OWNER CAN CALL DESTRUCT")

        // await icpdaoStaking.connect(user2Account).destruct()

    });
});