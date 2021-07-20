import chai from 'chai'
import { ethers } from 'hardhat';
import {IcpdaoDaoToken, IcpdaoDaoToken__factory, IWETH9, HelloToken, HelloToken__factory} from '../src/types/index';
import {BigNumber, BigNumberish, ContractFactory, Wallet} from "ethers";
import { Token, CurrencyAmount, Price} from '@uniswap/sdk-core'
import { parseUnits } from '@ethersproject/units'
import {abi as weth9Abi} from '../artifacts/contracts/test/interfaces/IWETH9.sol/IWETH9.json'
import JSBI from 'jsbi'
import {FeeAmount, Position, TICK_SPACINGS} from '@uniswap/v3-sdk'


import { abi as nonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json'
import { INonfungiblePositionManager } from './mock/INonfungiblePositionManager'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { IUniswapV3Pool } from './mock/IUniswapV3Pool'


import {
    Pool,
    priceToClosestTick,
    TickMath,
    nearestUsableTick,
} from '@uniswap/v3-sdk';

import {getMaxTick, getMinTick} from "./shared/ticks";
import {MaxUint128} from "./shared/constants";

const { expect } = chai


const getTickSpacings = (fee: number) => {
    if (fee == 500) {
        return TICK_SPACINGS[FeeAmount.LOW];
    }
    if (fee == 3000) {
        return TICK_SPACINGS[FeeAmount.MEDIUM];
    }
    if (fee == 10000) {
        return TICK_SPACINGS[FeeAmount.HIGH];
    }
}

const getNearestTickLower = (tick: number, fee: number, tickSpacing: number) => {
    const bei = Math.floor((getMaxTick(tickSpacing) - tick) / tickSpacing);
    return getMaxTick(tickSpacing) - tickSpacing * bei;
}

const getNearestTickUpper = (tick: number, fee: number, tickSpacing: number) => {
    const bei = Math.floor((tick - getMinTick(tickSpacing)) / tickSpacing);
    return getMinTick(tickSpacing) + tickSpacing * bei;
}

const getCreatePoolAndPosition = (feeAmount: FeeAmount, baseTokenAddress: string, quoteTokenAddress: string, baseTokenDecimals: number, quoteTokenDecimals: number, radioTokenAddress: string, radioValue: string, independentTokenAddress: string, independentTokenValue: string) => {
    let baseToken = new Token(1, baseTokenAddress, baseTokenDecimals);
    let quoteToken = new Token(1, quoteTokenAddress, quoteTokenDecimals);
    let tokenA;
    let tokenB;
    let tokenAPased;
    let tokenBPased;
    let tokenAIsBaseToken;
    if (baseToken.sortsBefore(quoteToken)) {
        tokenA = baseToken
        tokenB = quoteToken
        tokenAIsBaseToken = true
    } else {
        tokenA = quoteToken
        tokenB = baseToken
        tokenAIsBaseToken = false
    }

    if (radioTokenAddress == tokenA.address) {
        tokenAPased = parseUnits(radioValue, quoteToken.decimals);
        tokenBPased = parseUnits("1", baseToken.decimals);
    } else {
        tokenAPased = parseUnits("1", quoteToken.decimals);
        tokenBPased = parseUnits(radioValue, baseToken.decimals);
    }

    const tokenACurrencyAmount = CurrencyAmount.fromRawAmount(tokenA, JSBI.BigInt(tokenAPased))
    const tokenBCurrencyAmount = CurrencyAmount.fromRawAmount(tokenB, JSBI.BigInt(tokenBPased))

    let price = new Price(
        tokenACurrencyAmount.currency,
        tokenBCurrencyAmount.currency,
        tokenACurrencyAmount.quotient,
        tokenBCurrencyAmount.quotient
    )
    if (!tokenAIsBaseToken) {
        price = price.invert()
    }

    const currentTick = priceToClosestTick(price);
    const currentSqrt = TickMath.getSqrtRatioAtTick(currentTick);

    const mockPool = new Pool(tokenA, tokenB, feeAmount, currentSqrt, JSBI.BigInt(0), currentTick, [])

    const tickLower = nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount])
    const tickUpper = nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount])

    let position: Position;
    if (independentTokenAddress == tokenA.address) {
        let independentTokenValuePased = parseUnits(independentTokenValue, tokenA.decimals);
        let independentTokenCurrencyAmount = CurrencyAmount.fromRawAmount(tokenA, JSBI.BigInt(independentTokenValuePased))

        position = Position.fromAmount0({
            pool: mockPool,
            tickLower,
            tickUpper,
            amount0: independentTokenCurrencyAmount.quotient,
            useFullPrecision: true, // we want full precision for the theoretical position
        })
    } else {
        let independentTokenValuePased = parseUnits(independentTokenValue, tokenB.decimals);
        let independentTokenCurrencyAmount = CurrencyAmount.fromRawAmount(tokenB, JSBI.BigInt(independentTokenValuePased))

        position = Position.fromAmount1({
            pool: mockPool,
            tickLower,
            tickUpper,
            amount1: independentTokenCurrencyAmount.quotient
        })
    }

    return [mockPool, position];
}

describe("IcpdaoDaoToken", () => {
    let nonfungiblePositionManagerAddress: string
    let weth9Address: string
    let wallets: Wallet[]
    let deployAccount: Wallet
    let ownerAccount: Wallet
    let user1Account: Wallet
    let user2Account: Wallet
    let stakingAddress: string
    let weth9: IWETH9
    let gasPrice: BigNumber
    let nonfungiblePositionManager: INonfungiblePositionManager
    let startTimestamp: number = parseInt((new Date().getTime() / 1000).toString().substr(0, 10));
    let deployTimestamp: number = startTimestamp + 86400 * 10;
    let firstMintTimestamp: number = startTimestamp + 86400 * 40;

    before("init", async () => {
        nonfungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
        weth9Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        wallets = await (ethers as any).getSigners();
        deployAccount = wallets[0];
        ownerAccount = wallets[1];
        user1Account = wallets[2];
        user2Account = wallets[3];
        stakingAddress = wallets[4].address;
        gasPrice = BigNumber.from(1).mul(10).pow(15);
        weth9 = (await ethers.getContractAt(weth9Abi, weth9Address)) as IWETH9
        nonfungiblePositionManager = (await ethers.getContractAt(nonfungiblePositionManagerABI, nonfungiblePositionManagerAddress)) as INonfungiblePositionManager
    });
    it("create pool 1", async () => {
        // deploy helloToken
        const HelloTokenTokenFactory: ContractFactory = new HelloToken__factory(deployAccount);
        const helloToken = (await HelloTokenTokenFactory.deploy(
            BigNumber.from(10).pow(18*2)
        )) as HelloToken;

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new IcpdaoDaoToken__factory(deployAccount);
        const icpdaoDaoToken = (await IcpdaoDaoTokenFactory.deploy(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            101,
            stakingAddress,
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
            "icp-token",
            "ICP"
        )) as IcpdaoDaoToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoToken.address, helloToken.address,
            await icpdaoDaoToken.decimals(),await helloToken.decimals(),
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

        expect(await helloToken.balanceOf(ownerAccount.address)).eq(0);
        expect(await helloToken.balanceOf(icpdaoDaoToken.address)).eq(0);

        // ownerAccount approve helloToken to icpdaoDaoToken.address
        let tx1 = await helloToken.connect(ownerAccount).approve(icpdaoDaoToken.address, MaxUint128);
        await tx1.wait();

        // ownerAccount add helloToken token
        let tx2 = await helloToken.connect(deployAccount).transfer(ownerAccount.address, BigNumber.from(quoteTokenAmount).mul(10));
        await tx2.wait();

        expect(await helloToken.balanceOf(icpdaoDaoToken.address)).eq(0);
        expect(await helloToken.balanceOf(ownerAccount.address)).eq(BigNumber.from(quoteTokenAmount).mul(10));

        const temporaryTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore);
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const quoteTokenAmountPlus1 = BigNumber.from(quoteTokenAmount).add(1)
        let tx3 = await icpdaoDaoToken.connect(ownerAccount).createLPPool(
            baseTokenAmount,
            helloToken.address,
            quoteTokenAmountPlus1,
            FeeAmount.LOW,
            sqrtPriceX96,
            tickLower,
            tickUpper
        )
        await tx3.wait();

        expect(await helloToken.balanceOf(ownerAccount.address)).eq(BigNumber.from(quoteTokenAmount).mul(9));
        expect(await helloToken.balanceOf(icpdaoDaoToken.address)).eq(0);
        expect(await helloToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(quoteTokenAmount);

        expect(await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(baseTokenAmount);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore.sub(baseTokenAmount));
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const poolHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        let tx4 = await icpdaoDaoToken.connect(ownerAccount).updateLPPool(
            200
        )
        const tx4Done = await tx4.wait();

        expect(await helloToken.balanceOf(ownerAccount.address)).eq(BigNumber.from(quoteTokenAmount).mul(9));
        expect(await helloToken.balanceOf(icpdaoDaoToken.address)).eq(0);
        expect(await helloToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(quoteTokenAmount);

        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const poolHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        const cha = poolHaveIcpDaoTokenAmountAfter.sub(poolHaveIcpDaoTokenAmountBefore);
        expect(cha).eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBefore.sub(icpdaoDaoTokenHaveIcpDaoTokenAmountAfter));

        expect(200).to.greaterThanOrEqual(cha.toNumber());
    })

    it("create pool 2", async () => {
        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new IcpdaoDaoToken__factory(deployAccount);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const icpdaoDaoToken = (await IcpdaoDaoTokenFactory.deploy(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            101,
            stakingAddress,
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
            "icp-token",
            "ICP"
        )) as IcpdaoDaoToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

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

        // weth9 余额
        expect(await weth9.balanceOf(ownerAccount.address)).eq(0);
        expect(await weth9.balanceOf(icpdaoDaoToken.address)).eq(0);

        // eth
        const ownerAccountEthCountBefore = await ownerAccount.getBalance()
        const icpdaoDaoTokenEthCountBefore = await ethers.provider.getBalance(icpdaoDaoToken.address);
        expect(icpdaoDaoTokenEthCountBefore).eq(0)

        // icpdaotoken 余额
        const temporaryTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore);
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount)

        const quoteTokenAmountPlus123 = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoToken.connect(ownerAccount).createLPPool(
            baseTokenAmount,
            weth9.address,
            quoteTokenAmountPlus123,
            FeeAmount.LOW,
            sqrtPriceX96,
            tickLower,
            tickUpper,
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

        expect(await ownerAccount.getBalance()).eq(
            ownerAccountEthCountBefore.sub(quoteTokenAmount).sub(gasEth)
        )
        expect(await ethers.provider.getBalance(icpdaoDaoToken.address)).eq(0)
        expect(await ethers.provider.getBalance(await icpdaoDaoToken.lpPool())).eq(0)

        const poolHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        let tx4 = await icpdaoDaoToken.connect(ownerAccount).updateLPPool(
            200
        )
        const tx4Done = await tx4.wait();

        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const poolHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

        const cha = poolHaveIcpDaoTokenAmountAfter.sub(poolHaveIcpDaoTokenAmountBefore);
        expect(cha).eq(icpdaoDaoTokenHaveIcpDaoTokenAmountBefore.sub(icpdaoDaoTokenHaveIcpDaoTokenAmountAfter));

        expect(200).to.greaterThanOrEqual(cha.toNumber());

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

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 86400]);


        const poolHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        const ownerAccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(ownerAccount.address);
        const user1AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user1Account.address);
        const user2AccountHaveIcpDaoTokenAmountBeforeMint = await icpdaoDaoToken.balanceOf(user2Account.address);


        let tx5 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
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

        expect(ownerAccountHaveIcpDaoTokenAmountAfterMint).eq(ownerAccountHaveIcpDaoTokenAmountBeforeMint.add(200))
        expect(user1AccountHaveIcpDaoTokenAmountAfterMint).eq(user1AccountHaveIcpDaoTokenAmountBeforeMint.add(200))
        expect(user2AccountHaveIcpDaoTokenAmountAfterMint).eq(user2AccountHaveIcpDaoTokenAmountBeforeMint.add(200))

        expect(poolHaveIcpDaoTokenAmountAfterMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountAfterMint)).eq(
            poolHaveIcpDaoTokenAmountBeforeMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint).add(606)
        )

        // const tokenId = (await nonfungiblePositionManager.tokenOfOwnerByIndex(icpdaoDaoToken.address, 0)).toNumber()
        // console.log("tokenId", tokenId)
        // const currentPosition = (await nonfungiblePositionManager.positions(tokenId))



    })
})
