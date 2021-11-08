import { ethers } from "hardhat";
import { expect } from "chai";
import {
    DAOFactory,
    DAOStaking,
    DAOStaking__factory,
    DAOFactory__factory,
    DAOToken,
    IWETH9,
    IUniswapV3Pool, ISwapRouter
} from "../typechain";
import {BigNumber, ContractFactory} from "ethers";
import {abi as IcpdaoDaoTokenABI} from "../artifacts/contracts/DAOToken.sol/DAOToken.json";
import { abi as weth9Abi } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/external/IWETH9.sol/IWETH9.json';
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { abi as ISwapRouterABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';

import {FeeAmount, Pool, Position, TICK_SPACINGS} from "@uniswap/v3-sdk";
import {
    getCreatePoolAndPosition,
    getNearestTickLower,
    getNearestTickUpper,
    getTickSpacings
} from "./shared/daoTokenUtils";
import {getMaxTick, getMinTick} from "./shared/uniswapTicks";
import {MaxUint128} from "./shared/constants";


describe("GasStat", async () => {
    let daoFactory: DAOFactory;
    let icpdaoStaking: DAOStaking;
    let weth9Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    let swapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    let icpdaoDaoToken: DAOToken;
    let weth9: IWETH9;
    let startTimestamp: number = parseInt((new Date().getTime() / 1000).toString().substr(0, 10));
    let deployTimestamp: number = startTimestamp + 86400 * 10;
    let firstMintTimestamp: number = startTimestamp + 86400 * 40;
    let uniswapV3Pool: IUniswapV3Pool;
    let swapRouter: ISwapRouter;

    it("deploy DAOFactory", async () => {
        const [w1] = await ethers.getSigners();
        const daoFactory_: ContractFactory = new DAOFactory__factory(w1);
        daoFactory = (await daoFactory_.deploy(w1.address)) as DAOFactory;
        expect(
            await daoFactory.owner()
        ).to.eq(w1.address)
    })

    it("deploy DAOStaking", async () => {
        const [w1] = await ethers.getSigners();
        const IcpdaoStakingFactory: ContractFactory = new DAOStaking__factory(w1);
        icpdaoStaking = (await IcpdaoStakingFactory.deploy(
            w1.address
        )) as DAOStaking;
        expect(
            await icpdaoStaking.owner()
        ).to.eq(w1.address)
    })

    it("DAOFactory deploy token", async () => {
        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const [w1, w2, w3, w4, w5] = await ethers.getSigners();
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        let _lpTotalAmount = BigNumber.from(10).pow(18).mul(10000).mul(100);
        let p = BigNumber.from(10).pow(18).mul(20);
        let lpRadio = 101;
        await (await daoFactory.deploy(
            "1",
            [w3.address, w4.address, w5.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount,
            w2.address,
            {
                p: p,
                aNumerator: 1,
                aDenominator: 2,
                bNumerator: 1,
                bDenominator: 365,
                c: 0,
                d: 0
            },
            "icpdao",
            "ICPD"
        )).wait();

        const icpdaoDaoTokenAddress = await daoFactory.tokens('1')
        icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        expect(
            await icpdaoDaoToken.owner()
        ).to.eq(w2.address)
    })


    it("DAOToken create pool", async () => {
        weth9 = (await ethers.getContractAt(weth9Abi, weth9Address)) as IWETH9;
        const [w1, w2, w3, w4, w5] = await ethers.getSigners();
        let [mockPool, position] = getCreatePoolAndPosition(
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

        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        let gasPrice = BigNumber.from(10).pow(9).mul(20);
        let tx3 = await icpdaoDaoToken.connect(w2).createLPPoolOrLinkLPPool(
            baseTokenAmount,
            weth9.address,
            quoteTokenAmountPlus,
            FeeAmount.LOW,
            tickLower,
            tickUpper,
            sqrtPriceX96,
            {
                value: quoteTokenAmountPlus,
                gasPrice: gasPrice
            }
        )
        const tx3Done = await tx3.wait();

        expect(
            await icpdaoDaoToken.lpPool()
        ).not.eq("0x0000000000000000000000000000000000000000")
    })

    it("DAOToken updateLPPool", async () => {
        const [w1, w2, w3, w4, w5] = await ethers.getSigners();
        uniswapV3Pool = (await ethers.getContractAt(IUniswapV3PoolABI, await icpdaoDaoToken.lpPool())) as IUniswapV3Pool;
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

        let [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoToken.address, weth9Address,
            await icpdaoDaoToken.decimals(), 18,
            icpdaoDaoToken.address,
            "1000",
            icpdaoDaoToken.address,
            "1"
        )

        let baseTokenAmount;
        if (icpdaoDaoToken.address == (position as Position).amount0.currency.address) {
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
        } else {
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
        }

        let tx4 = await icpdaoDaoToken.connect(w2).updateLPPool(
            baseTokenAmount,
            tickLowerMint,
            tickUpperMint
        )
        const tx4Done = await tx4.wait();

    })


    it("DAOToken mint", async () => {
        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 86400]);

        const [w1, w2, w3, w4, w5, w6, w7] = await ethers.getSigners();
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

        let tx5 = await icpdaoDaoToken.connect(w2).mint(
            [w3.address, w4.address, w5.address, w6.address, w7.address],
            [475000, 475000, 475000, 475000, 475000],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();
    })

    it("DAOToken bonusWithdraw", async () => {
        swapRouter = (await ethers.getContractAt(ISwapRouterABI, swapRouterAddress)) as ISwapRouter;

        const [w1, w2, w3, w4, w5, w6, w7, w8] = await ethers.getSigners();
        await (await daoFactory.connect(w1).setStaking(w8.address)).wait();
        const fee = await uniswapV3Pool.fee();
        let gasPrice = BigNumber.from(10).pow(9).mul(20);

        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(w3).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoToken.address,
                    fee: fee,
                    recipient: w3.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 2,
                    amountIn: BigNumber.from(10).pow(18),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                },
                {
                    value: BigNumber.from(10).pow(18),
                    gasPrice: gasPrice
                }
            )
            const tx6Done = await tx6.wait();
        }

        (await icpdaoDaoToken.connect(w3).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(w3).exactInputSingle(
                {
                    tokenIn: icpdaoDaoToken.address,
                    tokenOut: weth9Address,
                    fee: fee,
                    recipient: w3.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 2,
                    amountIn: BigNumber.from(10).pow(18),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }
            )
            const tx7Done = await tx7.wait();
        }

        let tx7 = await icpdaoDaoToken.connect(w8).bonusWithdraw();
        const tx7Done = await tx7.wait();

    })

    it("DAOToken addManager and removeManager", async () => {
        const [w1, w2, w3, w4, w5, w6, w7, w8] = await ethers.getSigners();

        expect(
            await icpdaoDaoToken.isManager(w8.address)
        ).to.eq(false)

        let tx8 = await icpdaoDaoToken.connect(w2).addManager(w8.address);
        await tx8.wait();

        expect(
            await icpdaoDaoToken.isManager(w8.address)
        ).to.eq(true)

        let tx9 = await icpdaoDaoToken.connect(w2).removeManager(w8.address);
        await tx9.wait();

        expect(
            await icpdaoDaoToken.isManager(w8.address)
        ).to.eq(false)
    })

    it("DAOToken erc20 methods", async () => {
        const [w1, w2, w3, w4, w5, w6, w7, w8] = await ethers.getSigners();
        let tokenCount = BigNumber.from(10).pow(18).mul(10);

        await (await icpdaoDaoToken.connect(w3).transfer(w4.address, tokenCount)).wait();

        await (await icpdaoDaoToken.connect(w3).approve(w8.address, tokenCount)).wait();
        await (await icpdaoDaoToken.connect(w3).increaseAllowance(w8.address, tokenCount)).wait();
        await (await icpdaoDaoToken.connect(w3).decreaseAllowance(w8.address, tokenCount)).wait();
        await (await icpdaoDaoToken.connect(w8).transferFrom(w3.address, w4.address, tokenCount)).wait();

        await (await icpdaoDaoToken.connect(w2).transferOwnership(w3.address)).wait();
    })


    it("", async () => {
        // https://ropsten.etherscan.io/address/0x7F0b21785726A3c7F68EC333f93e39c61b0CeB13#writeContract
    })

    it("", async () => {})

})