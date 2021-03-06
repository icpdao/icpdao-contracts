import chai from 'chai'
import { ethers } from 'hardhat';

import {
    DAOFactoryStore,
    DAOToken, DAOToken__factory, IWETH9, ERC20Mock, ERC20Mock__factory,
    DAOFactory,
    IUniswapV3Pool, INonfungiblePositionManager, ISwapRouter, DAOFactory__factory
} from '../typechain/index';

import {BigNumber, ContractFactory, Wallet} from "ethers";
import { Token, CurrencyAmount, Price} from '@uniswap/sdk-core'
import { parseUnits } from '@ethersproject/units'
import { abi as weth9Abi } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/external/IWETH9.sol/IWETH9.json';
import JSBI from 'jsbi'
import {FeeAmount, Position, TICK_SPACINGS} from '@uniswap/v3-sdk'

import { abi as nonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

import { abi as ISwapRouterABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';

import {abi as IcpdaoDaoTokenABI} from '../artifacts/contracts/DAOToken.sol/DAOToken.json'


import {
    Pool,
    priceToClosestTick,
    TickMath,
    nearestUsableTick,
} from '@uniswap/v3-sdk';

import {getMaxTick, getMinTick} from "./shared/uniswapTicks";
import {
    getCreatePoolAndPosition,
    getNearestTickLower,
    getNearestTickUpper,
    getTickSpacings
} from "./shared/daoTokenUtils";

const { expect } = chai


describe("IcpdaoDAOTokenLpTotalAmount", () => {
    let nonfungiblePositionManagerAddress: string
    let weth9Address: string
    let swapRouterAddress: string
    let wallets: Wallet[]
    let deployAccount: Wallet
    let ownerAccount: Wallet
    let user1Account: Wallet
    let user2Account: Wallet
    let user3Account: Wallet
    let user4Account: Wallet
    let stakingAddress: string
    let weth9: IWETH9
    let gasPrice: BigNumber
    let nonfungiblePositionManager: INonfungiblePositionManager
    let swapRouter: ISwapRouter
    let startTimestamp: number = parseInt((new Date().getTime() / 1000).toString().substr(0, 10));
    let deployTimestamp: number = startTimestamp + 86400 * 10;
    let firstMintTimestamp: number = startTimestamp + 86400 * 40;
    let deployTimestamp2: number = firstMintTimestamp + 86400 * 10;
    let firstMintTimestamp2: number = firstMintTimestamp + 86400 * 40;
    let lpToken0: string
    let lpToken1: string

    before("init", async () => {
        nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
        weth9Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        swapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
        wallets = await (ethers as any).getSigners();
        deployAccount = wallets[0];
        ownerAccount = wallets[1];
        user1Account = wallets[2];
        user2Account = wallets[3];
        user3Account = wallets[4];
        user4Account = wallets[5];
        stakingAddress = wallets[6].address;
        gasPrice = BigNumber.from(10).pow(9).mul(20);
        weth9 = (await ethers.getContractAt(weth9Abi, weth9Address)) as IWETH9
        nonfungiblePositionManager = (await ethers.getContractAt(nonfungiblePositionManagerABI, nonfungiblePositionManagerAddress)) as INonfungiblePositionManager;
        swapRouter = (await ethers.getContractAt(ISwapRouterABI, swapRouterAddress)) as ISwapRouter;
    });
    it("deploy max _lpTotalAmount", async () => {
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        // deploy IcpdaoDaoTokenFactory, IcpdaoDaoTokenFactory__factory,
        const DaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const daoTokenFactory = (await DaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;
        // deploy helloToken
        const ERC20MockFactory: ContractFactory = new ERC20Mock__factory(deployAccount);
        const helloToken = (await ERC20MockFactory.deploy(
            [deployAccount.address], [BigNumber.from(10).pow(18 * 2)], "mockERC1", "MERC1"
        )) as ERC20Mock;

        await (await store.connect(ownerAccount).addFactory(daoTokenFactory.address)).wait();

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        let _lpTotalAmount1: BigNumber = BigNumber.from(10).pow(18).mul(20000);
        await (await daoTokenFactory.deploy(
            '1',
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            101,
            _lpTotalAmount1,
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
        const {token: icpdaoDaoTokenAddress} = await daoTokenFactory.tokens('1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(_lpTotalAmount1)
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount)
        expect(await icpdaoDaoToken.balanceOf(user1Account.address)).eq(tokenCount)
        expect(await icpdaoDaoToken.balanceOf(user2Account.address)).eq(tokenCount)

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount1);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(_lpTotalAmount1);

        expect(
            await icpdaoDaoToken.WETH9()
        ).to.eq(weth9.address);

        expect(
            await icpdaoDaoToken.lpRatio()
        ).to.eq(101);

        expect(
            await icpdaoDaoToken.UNISWAP_V3_POSITIONS()
        ).to.eq(nonfungiblePositionManagerAddress);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(_lpTotalAmount1)

        expect(
            await icpdaoDaoToken.lpToken0()
        ).to.eq("0x0000000000000000000000000000000000000000");

        expect(
            await icpdaoDaoToken.lpToken1()
        ).to.eq("0x0000000000000000000000000000000000000000");

        expect(
            await icpdaoDaoToken.lpPool()
        ).to.eq("0x0000000000000000000000000000000000000000");
    })

    it("have pool max _lpTotalAmount", async () => {
        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new DAOToken__factory(deployAccount);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        let _lpTotalAmount2: BigNumber = BigNumber.from(10).pow(18).mul(31300);
        const icpdaoDaoToken = (await IcpdaoDaoTokenFactory.deploy(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount2,
            stakingAddress,
            ownerAccount.address,
            {
                p: p,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "icp-token",
            "ICP"
        )) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoToken.address, weth9Address,
            await icpdaoDaoToken.decimals(), 18,
            icpdaoDaoToken.address,
            "1000",
            icpdaoDaoToken.address,
            "1"
        )

        let sqrtPriceX96 = (mockPool as Pool).sqrtRatioX96.toString();
        let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.LOW])
        let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.LOW])
        let baseTokenAmount;
        let quoteTokenAmount;

        if (icpdaoDaoToken.address == (position as Position).amount0.currency.address) {
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        // console.log("(position as Position).amount0.currency.address == icpdaoDaoToken.address", (position as Position).amount0.currency.address == icpdaoDaoToken.address)
        // console.log("position amount0", (position as Position).mintAmounts.amount0.toString());
        // console.log("position amount1", (position as Position).mintAmounts.amount1.toString());
        // console.log("pool.sqrtRatioX96", (mockPool as Pool).sqrtRatioX96.toString());
        // console.log("baseTokenAmount", baseTokenAmount)
        // console.log("quoteTokenAmount", quoteTokenAmount)

        console.log("mock position tickLower", (position as Position).tickLower.toString());
        console.log("mock position tickUpper", (position as Position).tickUpper.toString());
        console.log("mock pool.tickCurrent", (mockPool as Pool).tickCurrent.toString());

        // weth9 ??????
        expect(await weth9.balanceOf(ownerAccount.address)).eq(0);
        expect(await weth9.balanceOf(icpdaoDaoToken.address)).eq(0);

        // eth
        const ownerAccountEthCountBefore = await ownerAccount.getBalance()
        const icpdaoDaoTokenEthCountBefore = await ethers.provider.getBalance(icpdaoDaoToken.address);
        expect(icpdaoDaoTokenEthCountBefore).eq(0)

        // icpdaotoken ??????
        const temporaryTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore);
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount)

        const quoteTokenAmountPlus123 = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoToken.connect(ownerAccount).createLPPoolOrLinkLPPool(
            baseTokenAmount,
            weth9.address,
            quoteTokenAmountPlus123,
            FeeAmount.LOW,
            tickLower,
            tickUpper,
            sqrtPriceX96,
            {
                value: quoteTokenAmountPlus123,
                gasPrice: gasPrice
            }
        )
        const tx3Done = await tx3.wait();

        const gasEth: BigNumber = gasPrice.mul(tx3Done.gasUsed)

        expect(await weth9.balanceOf(ownerAccount.address)).eq(0);
        expect(await weth9.balanceOf(icpdaoDaoToken.address)).eq(0);
        expect(await weth9.balanceOf(await icpdaoDaoToken.lpPool())).eq(quoteTokenAmount);

        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount)
        expect(await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(baseTokenAmount);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore.sub(baseTokenAmount));

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(temporaryTokenAmountBefore.sub(baseTokenAmount));

        expect(await ownerAccount.getBalance()).eq(
            ownerAccountEthCountBefore.sub(quoteTokenAmount).sub(gasEth)
        )
        expect(await ethers.provider.getBalance(icpdaoDaoToken.address)).eq(0)
        expect(await ethers.provider.getBalance(await icpdaoDaoToken.lpPool())).eq(0)

        const poolHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBefore);

        const uniswapV3Pool: IUniswapV3Pool = (await ethers.getContractAt(IUniswapV3PoolABI, await icpdaoDaoToken.lpPool())) as IUniswapV3Pool;
        const slot0 = (await uniswapV3Pool.slot0());
        const currentTick = slot0.tick;
        const fee = await uniswapV3Pool.fee();

        let tickLowerMint: number;
        let tickUpperMint: number;
        if (icpdaoDaoToken.address == await uniswapV3Pool.token0()) {
            tickLowerMint = getNearestTickLower(currentTick, fee, getTickSpacings(fee) as number);
            tickUpperMint = getMaxTick(getTickSpacings(fee) as number);
        } else {
            tickLowerMint = getMinTick(getTickSpacings(fee) as number);
            tickUpperMint = getNearestTickUpper(currentTick, fee, getTickSpacings(fee) as number);
        }

        let tx4 = await icpdaoDaoToken.connect(ownerAccount).updateLPPool(
            baseTokenAmount,
            tickLowerMint,
            tickUpperMint
        )
        const tx4Done = await tx4.wait();

        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const poolHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountAfter);

        const cha = poolHaveIcpDaoTokenAmountAfter.sub(poolHaveIcpDaoTokenAmountBefore);
        expect(cha).eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBefore.sub(icpdaoDaoTokenHaveIcpDaoTokenAmountAfter));

        expect(BigNumber.from(baseTokenAmount).gte(cha)).to.equal(true);

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 86400]);

        const poolHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        let tx5 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();

        const poolHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint);

        expect(ownerAccountHaveIcpDaoTokenAmountAfterMint).eq(ownerAccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))
        expect(user1AccountHaveIcpDaoTokenAmountAfterMint).eq(user1AccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))
        expect(user2AccountHaveIcpDaoTokenAmountAfterMint).eq(user2AccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))

        expect(poolHaveIcpDaoTokenAmountAfterMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint)).eq(
            poolHaveIcpDaoTokenAmountBeforeMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint).add(BigNumber.from(10).pow(18).mul(1000))
        )
        
        const _mintAnchor = await icpdaoDaoToken.mintAnchor();
        expect(_mintAnchor.p).to.eq(p)
        expect(_mintAnchor.aNumerator).to.eq(1)
        expect(_mintAnchor.aDenominator).to.eq(2)
        expect(_mintAnchor.bNumerator).to.eq(1)
        expect(_mintAnchor.bDenominator).to.eq(365)
        expect(_mintAnchor.c).to.eq(0)
        expect(_mintAnchor.d).to.eq(0)
        expect(_mintAnchor.lastTimestamp).to.eq(firstMintTimestamp)
        expect(_mintAnchor.n).to.eq(BigNumber.from(30))

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 5 * 86400]);

        const poolHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(_lpTotalAmount2);

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        let tx6 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp.add(4 * 86400),
            tickLowerMint,
            tickUpperMint
        )
        const tx6Done = await tx6.wait();

        const poolHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(_lpTotalAmount2);

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        expect(ownerAccountHaveIcpDaoTokenAmountAfterMint2).eq(ownerAccountHaveIcpDaoTokenAmountBeforeMint2.add(p))
        expect(user1AccountHaveIcpDaoTokenAmountAfterMint2).eq(user1AccountHaveIcpDaoTokenAmountBeforeMint2.add(p))
        expect(user2AccountHaveIcpDaoTokenAmountAfterMint2).eq(user2AccountHaveIcpDaoTokenAmountBeforeMint2.add(p))

        expect(poolHaveIcpDaoTokenAmountAfterMint2.add(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2)).eq(
            poolHaveIcpDaoTokenAmountBeforeMint2.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2).add(0)
        )
    })

    it("no pool max _lpTotalAmount", async () => {
        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new DAOToken__factory(deployAccount);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp2]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        let _lpTotalAmount2: BigNumber = BigNumber.from(10).pow(18).mul(31300);
        const icpdaoDaoToken = (await IcpdaoDaoTokenFactory.deploy(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount2,
            stakingAddress,
            ownerAccount.address,
            {
                p: p,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "icp-token",
            "ICP"
        )) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp2 + 86400]);

        const poolHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        let tx5 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            firstMintTimestamp2,
            0,
            0
        )
        const tx5Done = await tx5.wait();

        const poolHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountAfterMint = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint);

        expect(ownerAccountHaveIcpDaoTokenAmountAfterMint).eq(ownerAccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))
        expect(user1AccountHaveIcpDaoTokenAmountAfterMint).eq(user1AccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))
        expect(user2AccountHaveIcpDaoTokenAmountAfterMint).eq(user2AccountHaveIcpDaoTokenAmountBeforeMint.add(p.mul(10)))

        expect(poolHaveIcpDaoTokenAmountAfterMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint)).eq(
            poolHaveIcpDaoTokenAmountBeforeMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint).add(BigNumber.from(10).pow(18).mul(1000))
        )
        
        const _mintAnchor = await icpdaoDaoToken.mintAnchor();
        expect(_mintAnchor.p).to.eq(p)
        expect(_mintAnchor.aNumerator).to.eq(1)
        expect(_mintAnchor.aDenominator).to.eq(2)
        expect(_mintAnchor.bNumerator).to.eq(1)
        expect(_mintAnchor.bDenominator).to.eq(365)
        expect(_mintAnchor.c).to.eq(0)
        expect(_mintAnchor.d).to.eq(0)
        expect(_mintAnchor.lastTimestamp).to.eq(firstMintTimestamp2)
        expect(_mintAnchor.n).to.eq(BigNumber.from(30))

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp2 + 5 * 86400]);

        const poolHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountBeforeMint2 = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(_lpTotalAmount2);

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        let tx6 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp.add(4 * 86400),
            0,
            0
        )
        const tx6Done = await tx6.wait();

        const poolHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountAfterMint2 = await icpdaoDaoToken.balanceOf(user2Account.address);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(_lpTotalAmount2);

        expect(
            await icpdaoDaoToken.lpCurrentAmount()
        ).to.eq(_lpTotalAmount2);

        expect(
            await icpdaoDaoToken.lpTotalAmount()
        ).to.eq(_lpTotalAmount2);

        expect(ownerAccountHaveIcpDaoTokenAmountAfterMint2).eq(ownerAccountHaveIcpDaoTokenAmountBeforeMint2.add(p))
        expect(user1AccountHaveIcpDaoTokenAmountAfterMint2).eq(user1AccountHaveIcpDaoTokenAmountBeforeMint2.add(p))
        expect(user2AccountHaveIcpDaoTokenAmountAfterMint2).eq(user2AccountHaveIcpDaoTokenAmountBeforeMint2.add(p))

        expect(poolHaveIcpDaoTokenAmountAfterMint2.add(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint2)).eq(
            poolHaveIcpDaoTokenAmountBeforeMint2.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint2).add(0)
        )

    })
})