import chai from 'chai'
import { ethers } from 'hardhat';

import {
    DAOFactoryStore,
    DAOToken, DAOToken__factory, IWETH9, ERC20Mock, ERC20Mock__factory,
    DAOFactory,
    IUniswapV3Pool, INonfungiblePositionManager, ISwapRouter, DAOFactory__factory
} from '../typechain/index';

import {BigNumber, ContractFactory, Wallet} from "ethers";

import { abi as weth9Abi } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/external/IWETH9.sol/IWETH9.json';

import {FeeAmount, Position, TICK_SPACINGS} from '@uniswap/v3-sdk'

import { abi as nonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

import { abi as ISwapRouterABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';

import {abi as IcpdaoDaoTokenABI} from '../artifacts/contracts/DAOToken.sol/DAOToken.json'
import {
    getCreatePoolAndPosition,
    getNearestTickLower,
    getNearestTickUpper,
    getTickSpacings
} from './shared/daoTokenUtils'

import {
    Pool
} from '@uniswap/v3-sdk';

import {getMaxTick, getMinTick} from "./shared/uniswapTicks";
import {MaxUint128} from "./shared/constants";

const { expect } = chai


describe("IcpdaoDaoToken", () => {
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
    let lpToken0: string
    let lpToken1: string
    let _lpTotalAmount: BigNumber = BigNumber.from(10).pow(18).mul(50000);

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
    it("create pool 1", async () => {
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        // deploy IcpdaoDaoTokenFactory, IcpdaoDaoTokenFactory__factory,
        const DaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const daoTokenFactory = (await DaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(daoTokenFactory.address)).wait();

        // deploy helloToken
        const ERC20MockFactory: ContractFactory = new ERC20Mock__factory(deployAccount);
        const helloToken = (await ERC20MockFactory.deploy(
            [deployAccount.address], [BigNumber.from(10).pow(18 * 2)], "mockERC1", "MERC1"
        )) as ERC20Mock;

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        await (await daoTokenFactory.deploy(
            '1',
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
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
        const {token: icpdaoDaoTokenAddress} = await daoTokenFactory.tokens('1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoToken.WETH9()
        ).to.eq(weth9.address);

        expect(
            await icpdaoDaoToken.staking()
        ).to.eq("0x0000000000000000000000000000000000000000");

        expect(
            await icpdaoDaoToken.lpRatio()
        ).to.eq(101);

        expect(
            await icpdaoDaoToken.UNISWAP_V3_POSITIONS()
        ).to.eq(nonfungiblePositionManagerAddress);

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoToken.lpToken0()
        ).to.eq("0x0000000000000000000000000000000000000000");

        expect(
            await icpdaoDaoToken.lpToken1()
        ).to.eq("0x0000000000000000000000000000000000000000");

        expect(
            await icpdaoDaoToken.lpPool()
        ).to.eq("0x0000000000000000000000000000000000000000");

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
            console.log("create pool 1 icpdaoDaoToken", "11111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("create pool 1 icpdaoDaoToken", "22222")
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
        await expect(
            icpdaoDaoToken.connect(user1Account).createLPPoolOrLinkLPPool(
                baseTokenAmount,
                helloToken.address,
                quoteTokenAmountPlus1,
                FeeAmount.LOW,
                tickLower,
                tickUpper,
                sqrtPriceX96
            )
        ).to.be.revertedWith("onlyOwner");
        let tx3 = await icpdaoDaoToken.connect(ownerAccount).createLPPoolOrLinkLPPool(
            baseTokenAmount,
            helloToken.address,
            quoteTokenAmountPlus1,
            FeeAmount.LOW,
            tickLower,
            tickUpper,
            sqrtPriceX96
        )
        await tx3.wait();

        if (helloToken.address > icpdaoDaoToken.address) {
            lpToken0 = icpdaoDaoToken.address;
            lpToken1 = helloToken.address;
        } else {
            lpToken0 = helloToken.address;
            lpToken1 = icpdaoDaoToken.address;
        }

        expect(
            await icpdaoDaoToken.lpToken0()
        ).to.eq(lpToken0);

        expect(
            await icpdaoDaoToken.lpToken1()
        ).to.eq(lpToken1);

        expect(await helloToken.balanceOf(ownerAccount.address)).eq(BigNumber.from(quoteTokenAmount).mul(9));
        expect(await helloToken.balanceOf(icpdaoDaoToken.address)).eq(0);
        expect(await helloToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(quoteTokenAmount);

        expect(await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool())).eq(baseTokenAmount);
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(temporaryTokenAmountBefore.sub(baseTokenAmount));
        expect(await icpdaoDaoToken.balanceOf(ownerAccount.address)).eq(tokenCount);

        const poolHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());
        const icpdaoDaoTokenHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);

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

        await expect(
            icpdaoDaoToken.connect(user1Account).updateLPPool(
                200,
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("onlyOwner");

        let tx4 = await icpdaoDaoToken.connect(ownerAccount).updateLPPool(
            200,
            tickLowerMint,
            tickUpperMint
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
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        const DaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const daoTokenFactory = (await DaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(daoTokenFactory.address)).wait();

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        await (await daoTokenFactory.deploy(
            "1",
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount,
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
        )).wait();

        const {token: icpdaoDaoTokenAddress} = await daoTokenFactory.tokens('1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

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
            console.log("create pool 2 icpdaoDaoToken", "11111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("create pool 2 icpdaoDaoToken", "2222222")
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
            poolHaveIcpDaoTokenAmountBeforeMint.add(icpdaoDaoTokenHaveIcpDaoTokenAmountBeforeMint).add(p.mul(30).mul(lpRadio).div(100))
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

        const user3AccountHaveIcpDaoTokenAmountBeforeExact = await icpdaoDaoToken.balanceOf(user3Account.address);

        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoToken.address,
                    fee: fee,
                    recipient: user3Account.address,
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

        (await icpdaoDaoToken.connect(user3Account).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: icpdaoDaoToken.address,
                    tokenOut: weth9Address,
                    fee: fee,
                    recipient: user3Account.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 2,
                    amountIn: BigNumber.from(10).pow(18),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }
            )
            const tx7Done = await tx7.wait();
        }

        const user3AccountHaveIcpDaoTokenAmountAfterExact = await icpdaoDaoToken.balanceOf(user3Account.address);

        const user3AccountAddIcpdao = user3AccountHaveIcpDaoTokenAmountAfterExact.sub(user3AccountHaveIcpDaoTokenAmountBeforeExact);

        console.log("user3AccountAddIcpdao", user3AccountAddIcpdao.toString());

        const ownerAccountHaveEthBeforeBonus = await weth9.balanceOf(ownerAccount.address);
        const ownerAccountHaveIcpBeforeBonus = await icpdaoDaoToken.balanceOf(ownerAccount.address);

        const stakingHaveEthBeforeBonus = await weth9.balanceOf(stakingAddress);
        const stakingHaveIcpBeforeBonus = await icpdaoDaoToken.balanceOf(stakingAddress);

        const icpHaveIcpBeforeBonus = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpHaveIcpBeforeBonus);

        await expect(
            icpdaoDaoToken.connect(ownerAccount).bonusWithdraw()
        ).to.be.revertedWith("NS");

        await (await store.connect(ownerAccount).setStaking(stakingAddress)).wait();

        let tx7 = await icpdaoDaoToken.connect(ownerAccount).bonusWithdraw();
        const tx7Done = await tx7.wait();

        const icpHaveIcpAfterBonus = await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address);
        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(icpHaveIcpAfterBonus);

        expect(icpHaveIcpBeforeBonus).to.eq(icpHaveIcpAfterBonus)

        const ownerAccountHaveEthAfterBonus = await weth9.balanceOf(ownerAccount.address);
        const ownerAccountHaveIcpAfterBonus = await icpdaoDaoToken.balanceOf(ownerAccount.address);

        const stakingHaveEthAfterBonus = await weth9.balanceOf(stakingAddress);
        const stakingHaveIcpAfterBonus = await icpdaoDaoToken.balanceOf(stakingAddress);

        const ownerAccountHaveEthAdd = ownerAccountHaveEthAfterBonus.sub(ownerAccountHaveEthBeforeBonus);
        const ownerAccountHaveIcpAdd = ownerAccountHaveIcpAfterBonus.sub(ownerAccountHaveIcpBeforeBonus);

        const stakingHaveEthAdd = stakingHaveEthAfterBonus.sub(stakingHaveEthBeforeBonus);
        const stakingHaveIcpAdd = stakingHaveIcpAfterBonus.sub(stakingHaveIcpBeforeBonus);

        console.log("ownerAccountHaveEthAdd", ownerAccountHaveEthAdd.toString());
        console.log("ownerAccountHaveIcpAdd", ownerAccountHaveIcpAdd.toString());
        console.log("stakingHaveEthAdd", stakingHaveEthAdd.toString());
        console.log("stakingHaveIcpAdd", stakingHaveIcpAdd.toString());

        expect(ownerAccountHaveEthAdd).to.equal(BigNumber.from("15000000000000"));
        expect(ownerAccountHaveIcpAdd).to.equal(BigNumber.from("14999999999999"));
        expect(stakingHaveEthAdd).to.equal(BigNumber.from("1485000000000003"));
        expect(stakingHaveIcpAdd).to.equal(BigNumber.from("1484999999999999"));

        (await icpdaoDaoToken.connect(ownerAccount).transfer(icpdaoDaoToken.address, 100)).wait();

        expect(
            (await icpdaoDaoToken.temporaryAmount()).add(100)
        ).to.eq(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address));
    })

    it('bonusWithdrawByTokenIdList', async () => {
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        const DaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const daoTokenFactory = (await DaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(daoTokenFactory.address)).wait();

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        startTimestamp = block.timestamp;
        deployTimestamp = startTimestamp + 86400 * 10;
        firstMintTimestamp = startTimestamp + 86400 * 40;

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        await (await daoTokenFactory.deploy(
            "1",
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount,
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
        )).wait();

        const {token: icpdaoDaoTokenAddress} = await daoTokenFactory.tokens('1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

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
            console.log("bonusWithdrawByTokenIdList icpdaoDaoToken", "1111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("bonusWithdrawByTokenIdList icpdaoDaoToken", "2222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

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


        const poolHaveIcpDaoTokenAmountBefore = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());

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

        const poolHaveIcpDaoTokenAmountAfter = await icpdaoDaoToken.balanceOf(await icpdaoDaoToken.lpPool());

        const cha = poolHaveIcpDaoTokenAmountAfter.sub(poolHaveIcpDaoTokenAmountBefore);

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 86400]);

        let tx5 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();



        const user3AccountHaveIcpDaoTokenAmountBeforeExact = await icpdaoDaoToken.balanceOf(user3Account.address);

        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoToken.address,
                    fee: fee,
                    recipient: user3Account.address,
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

        (await icpdaoDaoToken.connect(user3Account).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: icpdaoDaoToken.address,
                    tokenOut: weth9Address,
                    fee: fee,
                    recipient: user3Account.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 2,
                    amountIn: BigNumber.from(10).pow(18),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }
            )
            const tx7Done = await tx7.wait();
        }

        const user3AccountHaveIcpDaoTokenAmountAfterExact = await icpdaoDaoToken.balanceOf(user3Account.address);

        const user3AccountAddIcpdao = user3AccountHaveIcpDaoTokenAmountAfterExact.sub(user3AccountHaveIcpDaoTokenAmountBeforeExact);

        console.log("user3AccountAddIcpdao", user3AccountAddIcpdao.toString());

        const ownerAccountHaveEthBeforeBonus = await weth9.balanceOf(ownerAccount.address);
        const ownerAccountHaveIcpBeforeBonus = await icpdaoDaoToken.balanceOf(ownerAccount.address);

        const stakingHaveEthBeforeBonus = await weth9.balanceOf(stakingAddress);
        const stakingHaveIcpBeforeBonus = await icpdaoDaoToken.balanceOf(stakingAddress);

        const tokenIdList = [];
        let count = (await nonfungiblePositionManager.balanceOf(icpdaoDaoToken.address)).toNumber();
        for (let i = 0; i < count; i++) {
            let id = (await nonfungiblePositionManager.tokenOfOwnerByIndex(icpdaoDaoToken.address, i)).toNumber()
            tokenIdList.push(id);
        }

        await expect(
            icpdaoDaoToken.connect(ownerAccount).bonusWithdrawByTokenIdList(tokenIdList)
        ).to.be.revertedWith("NS");

        await (await store.connect(ownerAccount).setStaking(stakingAddress)).wait();

        let tx7 = await icpdaoDaoToken.connect(ownerAccount).bonusWithdrawByTokenIdList(tokenIdList);
        const tx7Done = await tx7.wait();

        const ownerAccountHaveEthAfterBonus = await weth9.balanceOf(ownerAccount.address);
        const ownerAccountHaveIcpAfterBonus = await icpdaoDaoToken.balanceOf(ownerAccount.address);

        const stakingHaveEthAfterBonus = await weth9.balanceOf(stakingAddress);
        const stakingHaveIcpAfterBonus = await icpdaoDaoToken.balanceOf(stakingAddress);

        const ownerAccountHaveEthAdd = ownerAccountHaveEthAfterBonus.sub(ownerAccountHaveEthBeforeBonus);
        const ownerAccountHaveIcpAdd = ownerAccountHaveIcpAfterBonus.sub(ownerAccountHaveIcpBeforeBonus);

        const stakingHaveEthAdd = stakingHaveEthAfterBonus.sub(stakingHaveEthBeforeBonus);
        const stakingHaveIcpAdd = stakingHaveIcpAfterBonus.sub(stakingHaveIcpBeforeBonus);

        console.log("ownerAccountHaveEthAdd", ownerAccountHaveEthAdd.toString());
        console.log("ownerAccountHaveIcpAdd", ownerAccountHaveIcpAdd.toString());
        console.log("stakingHaveEthAdd", stakingHaveEthAdd.toString());
        console.log("stakingHaveIcpAdd", stakingHaveIcpAdd.toString());

        expect(ownerAccountHaveEthAdd).to.equal(BigNumber.from("15000000000000"));
        expect(ownerAccountHaveIcpAdd).to.equal(BigNumber.from("14999999999999"));
        expect(stakingHaveEthAdd).to.equal(BigNumber.from("1485000000000001"));
        expect(stakingHaveIcpAdd).to.equal(BigNumber.from("1485000000000000"));

    })

    it("IcpdaoDaoTokenFactory redeploy", async () => {
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        // deploy IcpdaoDaoTokenFactory, IcpdaoDaoTokenFactory__factory,
        const IcpdaoDaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const icpdaoDaoTokenFactory = (await IcpdaoDaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(icpdaoDaoTokenFactory.address)).wait();

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        await (await icpdaoDaoTokenFactory.connect(ownerAccount).deploy(
            '1',
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
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

        let {token: icpdaoDaoTokenAddress} = await icpdaoDaoTokenFactory.tokens('1')
        let icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        // redeploy
        await expect(
            icpdaoDaoTokenFactory.connect(user1Account).deploy(
                '1',
                [ownerAccount.address, user1Account.address, user2Account.address],
                [tokenCount, tokenCount, tokenCount],
                101,
                _lpTotalAmount,
                user1Account.address,
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
            )
        ).to.be.revertedWith('NODR')

        // owner redeploy
        await (await icpdaoDaoTokenFactory.connect(ownerAccount).deploy(
            '1',
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
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
        icpdaoDaoTokenAddress = (await icpdaoDaoTokenFactory.tokens('1')).token
        icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;
        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(user1Account.address)).wait();

        await expect(
            icpdaoDaoTokenFactory.connect(user1Account).deploy(
                '1',
                [ownerAccount.address, user1Account.address, user2Account.address],
                [tokenCount, tokenCount, tokenCount],
                101,
                _lpTotalAmount,
                user1Account.address,
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
            )
        ).to.be.revertedWith("NODR");
    })

    it("test manager and owner", async () => {
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        const IcpdaoDaoTokenFactoryFactory: ContractFactory = new DAOFactory__factory(deployAccount);
        const icpdaoDaoTokenFactory = (await IcpdaoDaoTokenFactoryFactory.deploy(
            deployAccount.address,
            store.address
        )) as DAOFactory;
        await (await store.connect(ownerAccount).addFactory(icpdaoDaoTokenFactory.address)).wait();

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        startTimestamp = block.timestamp;
        deployTimestamp = startTimestamp + 86400 * 10;
        firstMintTimestamp = startTimestamp + 86400 * 40;

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        await (await icpdaoDaoTokenFactory.deploy(
            "1",
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount,
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
        )).wait();

        const {token: icpdaoDaoTokenAddress} = await icpdaoDaoTokenFactory.tokens('1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

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
            console.log("test manager and owner icpdaoDaoToken", "11111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("test manager and owner icpdaoDaoToken", "22222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        const quoteTokenAmountPlus123 = BigNumber.from(quoteTokenAmount).add(123);

        await expect(
            icpdaoDaoToken.connect(user1Account).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("onlyOwner");

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(user1Account.address)).wait();

        await expect(
            icpdaoDaoToken.connect(user1Account).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("onlyOwner");

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

        await expect(
            icpdaoDaoToken.connect(user2Account).updateLPPool(
                baseTokenAmount,
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("onlyOwner");

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(user2Account.address)).wait();

        await expect(
            icpdaoDaoToken.connect(user2Account).updateLPPool(
                baseTokenAmount,
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("onlyOwner");

        let tx4 = await icpdaoDaoToken.connect(ownerAccount).updateLPPool(
            baseTokenAmount,
            tickLowerMint,
            tickUpperMint
        )
        const tx4Done = await tx4.wait();

        await ethers.provider.send("evm_setNextBlockTimestamp", [firstMintTimestamp + 86400]);

        await expect(
            icpdaoDaoToken.connect(user3Account).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                0,
                firstMintTimestamp,
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("onlyOwnerOrManager");

        await expect(
            icpdaoDaoToken.connect(user3Account).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
                firstMintTimestamp,
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("onlyOwnerOrManager");

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(user3Account.address)).wait();

        let tx5 = await icpdaoDaoToken.connect(user3Account).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();


        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoToken.address,
                    fee: fee,
                    recipient: user3Account.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 200,
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

        (await icpdaoDaoToken.connect(user3Account).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: icpdaoDaoToken.address,
                    tokenOut: weth9Address,
                    fee: fee,
                    recipient: user3Account.address,
                    deadline: firstMintTimestamp + 86400 + 60 * 60 * 200,
                    amountIn: BigNumber.from(10).pow(18),
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                }
            )
            const tx7Done = await tx7.wait();
        }

        await (await store.connect(ownerAccount).setStaking(stakingAddress)).wait();

        let tx7 = await icpdaoDaoToken.connect(user4Account).bonusWithdraw();
        const tx7Done = await tx7.wait();

        await expect(
            icpdaoDaoToken.connect(user2Account).addManager(user4Account.address)
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user1Account).removeManager(user2Account.address)
        ).to.be.revertedWith("onlyOwner");
        await (await icpdaoDaoToken.connect(ownerAccount).removeManager(user2Account.address)).wait();
        await (await icpdaoDaoToken.connect(ownerAccount).removeManager(user1Account.address)).wait();
        await expect(
            icpdaoDaoToken.connect(user2Account).addManager(user4Account.address)
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user1Account).removeManager(user3Account.address)
        ).to.be.revertedWith("onlyOwner");
        await (await icpdaoDaoToken.connect(ownerAccount).removeManager(user3Account.address)).wait();

        //
        await (await icpdaoDaoToken.connect(ownerAccount).addManager(user1Account.address)).wait();
        await expect(
            icpdaoDaoToken.connect(user1Account).transferOwnership(user2Account.address)
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user2Account).transferOwnership(user3Account.address)
        ).to.be.revertedWith("onlyOwner");
        await (await icpdaoDaoToken.connect(ownerAccount).transferOwnership(user1Account.address)).wait();
        await (await icpdaoDaoToken.connect(user1Account).addManager(user2Account.address)).wait();

        expect(
            await icpdaoDaoToken.isManager(user3Account.address)
        ).to.equal(false)
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.equal(true)
        expect(
            await icpdaoDaoToken.isManager(user2Account.address)
        ).to.equal(true)
        expect(
            await icpdaoDaoToken.managers()
        ).to.include(user1Account.address)
        expect(
            await icpdaoDaoToken.managers()
        ).to.include(user2Account.address)
        expect(
            (await icpdaoDaoToken.managers()).length
        ).to.equal(2)
    })

    it('destruct', async () => {
        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new DAOToken__factory(deployAccount);

        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);

        startTimestamp = block.timestamp;
        deployTimestamp = startTimestamp + 86400 * 10;
        firstMintTimestamp = startTimestamp + 86400 * 40;

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);

        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        const icpdaoDaoToken = (await IcpdaoDaoTokenFactory.deploy(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [tokenCount, tokenCount, tokenCount],
            lpRadio,
            _lpTotalAmount,
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

        // await expect(
        //     icpdaoDaoToken.connect(user1Account).destruct()
        // ).to.be.revertedWith("onlyOwner")

        // await icpdaoDaoToken.connect(ownerAccount).destruct()
    })
})