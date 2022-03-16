import chai from 'chai'
import { ethers } from 'hardhat';

import {
    DAOFactoryStore,
    DAOToken, DAOToken__factory, IWETH9,
    IUniswapV3Pool, INonfungiblePositionManager, ISwapRouter, ERC20Mock__factory, ERC20Mock, DAOFactory,
} from '../typechain/index';

import {BigNumber, BigNumberish, ContractFactory, Wallet} from "ethers";
import { abi as weth9Abi } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/external/IWETH9.sol/IWETH9.json';
import {FeeAmount, Position, TICK_SPACINGS} from '@uniswap/v3-sdk'

import { abi as nonfungiblePositionManagerABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json'

import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';

import { abi as ISwapRouterABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';

import {
    Pool
} from '@uniswap/v3-sdk';

import {getMaxTick, getMinTick} from "./shared/uniswapTicks";
import {
    getCreatePoolAndPosition,
    getNearestTickLower,
    getNearestTickUpper,
    getTickSpacings
} from "./shared/daoTokenUtils";
import {MaxUint256} from "@uniswap/sdk-core";
import {abi as IcpdaoDaoTokenABI} from "../artifacts/contracts/DAOToken.sol/DAOToken.json";
import exp from "constants";
import {MaxUint128} from "./shared/constants";

const { expect } = chai

describe("IcpdaoDaoToken.rule.1.reverse", () => {
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
    let user5Account: Wallet
    let user6Account: Wallet
    let user7Account: Wallet
    let user8Account: Wallet
    let daoFactory: DAOFactory
    let daoFactory2: DAOFactory
    let daoFactory3: DAOFactory
    let stakingAddress: string
    let weth9: IWETH9
    let gasPrice: BigNumber
    let nonfungiblePositionManager: INonfungiblePositionManager
    let swapRouter: ISwapRouter
    let startTimestamp: number = parseInt((new Date().getTime() / 1000).toString().substr(0, 10));
    let deployTimestamp: number = startTimestamp + 86400 * 10;
    let deadlineTimestamp: number = startTimestamp + 86400 * 70;
    let firstMintTimestamp: number = startTimestamp + 86400 * 70;
    let _lpTotalAmount: BigNumber = BigNumber.from(10).pow(18).mul(50000);
    let icpdaoDaoToken: DAOToken
    let icpdaoDaoTokenForLink: DAOToken
    let icpdaoDaoTokenForUpdate: DAOToken
    let icpdaoDaoTokenForNoPool: DAOToken
    let icpdaoDaoTokenForBonusWithdraw: DAOToken
    let icpdaoDaoTokenForBonusWithdrawByTokenIdList: DAOToken
    let helloToken: ERC20Mock
    let store: DAOFactoryStore
    let store2: DAOFactoryStore
    let store3: DAOFactoryStore

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
        user5Account = wallets[7];
        user6Account = wallets[8];
        user7Account = wallets[9];
        user8Account = wallets[10];
        gasPrice = BigNumber.from(10).pow(9).mul(20);
        weth9 = (await ethers.getContractAt(weth9Abi, weth9Address)) as IWETH9
        nonfungiblePositionManager = (await ethers.getContractAt(nonfungiblePositionManagerABI, nonfungiblePositionManagerAddress)) as INonfungiblePositionManager;
        swapRouter = (await ethers.getContractAt(ISwapRouterABI, swapRouterAddress)) as ISwapRouter;

        store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;
        store2 = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;
        store3 = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(ownerAccount.address)) as DAOFactoryStore;

        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        // begin magic code for adjusting the token sequence
        for(let i=0;i<5;i++){
            (await daoFactory_.deploy(deployAccount.address, ownerAccount.address)) as DAOFactory;
        }
        // end
        daoFactory = (await daoFactory_.deploy(deployAccount.address, store.address)) as DAOFactory;
        // begin magic code for adjusting the token sequence
        for(let i=0;i<5;i++){
            (await daoFactory_.deploy(deployAccount.address, ownerAccount.address)) as DAOFactory;
        }
        // end
        daoFactory2 = (await daoFactory_.deploy(deployAccount.address, store2.address)) as DAOFactory;
        // begin magic code for adjusting the token sequence
        for(let i=0;i<2;i++){
            (await daoFactory_.deploy(deployAccount.address, ownerAccount.address)) as DAOFactory;
        }
        // end
        daoFactory3 = (await daoFactory_.deploy(deployAccount.address, store3.address)) as DAOFactory;

        await (await store.connect(ownerAccount).addFactory(daoFactory.address)).wait();
        await (await store2.connect(ownerAccount).addFactory(daoFactory2.address)).wait();
        await (await store3.connect(ownerAccount).addFactory(daoFactory3.address)).wait();

        expect(
            await daoFactory.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        // deploy icpdaoDaoToken
        let tokenCount = BigNumber.from(10).pow(18).mul(10000);
        const IcpdaoDaoTokenFactory: ContractFactory = new DAOToken__factory(deployAccount);

        await ethers.provider.send("evm_setNextBlockTimestamp", [deployTimestamp]);


        const p = BigNumber.from(10).pow(18).mul(200);
        const lpRadio = 101;
        await (await daoFactory.deploy(
            "ICP",
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
        )).wait()
        icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory.tokens('ICP')).token)) as DAOToken;

        expect(await icpdaoDaoToken.balanceOf(icpdaoDaoToken.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoToken.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        // begin magic code for adjusting the token sequence
        for(let i=0;i<3;i++){
            (await daoFactory_.deploy(deployAccount.address, ownerAccount.address)) as DAOFactory;
        }
        // end

        await (await daoFactory.deploy(
            "ICPFL",
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
            "icp-token-for-link",
            "ICPFL"
        )).wait()
        icpdaoDaoTokenForLink = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory.tokens('ICPFL')).token)) as DAOToken;

        expect(await icpdaoDaoTokenForLink.balanceOf(icpdaoDaoTokenForLink.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoTokenForLink.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));


        await (await daoFactory.deploy(
            "ICPFU",
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
            "icp-token-for-update",
            "ICPFU"
        )).wait()
        icpdaoDaoTokenForUpdate = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory.tokens('ICPFU')).token)) as DAOToken;


        expect(await icpdaoDaoTokenForUpdate.balanceOf(icpdaoDaoTokenForUpdate.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoTokenForUpdate.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        await (await daoFactory.deploy(
            "ICPFNP",
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
            "icp-token-for-no-pool",
            "ICPFNP"
        )).wait()
        icpdaoDaoTokenForNoPool = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory.tokens('ICPFNP')).token)) as DAOToken;

        expect(await icpdaoDaoTokenForNoPool.balanceOf(icpdaoDaoTokenForNoPool.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoTokenForNoPool.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));

        await (await daoFactory2.deploy(
            "ICPFBW",
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
            "icp-token-for-b-w",
            "ICPFBW"
        )).wait()
        icpdaoDaoTokenForBonusWithdraw = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory2.tokens('ICPFBW')).token)) as DAOToken;

        expect(await icpdaoDaoTokenForBonusWithdraw.balanceOf(icpdaoDaoTokenForBonusWithdraw.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoTokenForBonusWithdraw.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));


        await (await daoFactory3.deploy(
            "ICPFBWL",
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
            "icp-token-for-b-w-l",
            "ICPFBWL"
        )).wait()
        icpdaoDaoTokenForBonusWithdrawByTokenIdList = (await ethers.getContractAt(IcpdaoDaoTokenABI, (await daoFactory3.tokens('ICPFBWL')).token)) as DAOToken;

        expect(await icpdaoDaoTokenForBonusWithdrawByTokenIdList.balanceOf(icpdaoDaoTokenForBonusWithdrawByTokenIdList.address)).eq(tokenCount.mul(3).mul(101).div(100))

        expect(
            await icpdaoDaoTokenForBonusWithdrawByTokenIdList.temporaryAmount()
        ).to.eq(tokenCount.mul(3).mul(101).div(100));


        const ERC20MockFactory: ContractFactory = new ERC20Mock__factory(deployAccount);
        helloToken = (await ERC20MockFactory.deploy(
            [deployAccount.address], [BigNumber.from(10).pow(18 * 2)], "mockERC1", "MERC1"
        )) as ERC20Mock;
        helloToken.connect(deployAccount).transfer(ownerAccount.address, BigNumber.from(10).pow(18).mul(100000))
    });

    it("addManager and removeManager", async () => {
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(false)
        await expect(
            icpdaoDaoToken.connect(user1Account).addManager(
                user1Account.address
            )
        ).to.be.revertedWith("onlyOwner");

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(true)
        await expect(
            icpdaoDaoToken.connect(user1Account).addManager(
                user2Account.address
            )
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user2Account).removeManager(
                user1Account.address
            )
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user1Account).removeManager(
                user1Account.address
            )
        ).to.be.revertedWith("onlyOwner");
        await (await icpdaoDaoToken.connect(ownerAccount).removeManager(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(false)

        await (await icpdaoDaoToken.connect(ownerAccount).addManager(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(true)

        await (await icpdaoDaoTokenForUpdate.connect(ownerAccount).addManager(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoTokenForUpdate.isManager(user1Account.address)
        ).to.eq(true)

        await (await icpdaoDaoTokenForNoPool.connect(ownerAccount).addManager(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoTokenForNoPool.isManager(user1Account.address)
        ).to.eq(true)
    })

    it("createLPPoolOrLinkLPPool create", async () => {
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
            console.log("icpdaoDaoToken", "111111111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("icpdaoDaoToken", "222222222222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoToken.address)).toNumber()
        ).to.eq(0)

        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        await expect(
            icpdaoDaoToken.connect(user1Account).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("onlyOwner");
        await expect(
            icpdaoDaoToken.connect(user2Account).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("onlyOwner");

        let tx3 = await icpdaoDaoToken.connect(ownerAccount).createLPPoolOrLinkLPPool(
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

        await expect(
            icpdaoDaoToken.connect(ownerAccount).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("LP");

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoToken.address)).toNumber()
        ).to.eq(1)

    })

    it("createLPPoolOrLinkLPPool link", async () => {
        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoTokenForLink.address, weth9Address,
            await icpdaoDaoTokenForLink.decimals(), 18,
            icpdaoDaoTokenForLink.address,
            "1000",
            icpdaoDaoTokenForLink.address,
            "1"
        )

        let sqrtPriceX96 = (mockPool as Pool).sqrtRatioX96.toString();
        let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.LOW])
        let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.LOW])

        let token0 = (position as Position).amount0.currency.address;
        let token1 = (position as Position).amount1.currency.address;
        let token0Amount = (position as Position).mintAmounts.amount0.toString();
        let token1Amount = (position as Position).mintAmounts.amount1.toString();

        let baseTokenAmount;
        let quoteTokenAmount;
        if (icpdaoDaoTokenForLink.address == (position as Position).amount0.currency.address) {
            console.log("icpdaoDaoTokenForLink", "111111111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("icpdaoDaoTokenForLink", "22222222222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        expect(
            (await nonfungiblePositionManager.balanceOf(ownerAccount.address)).toNumber()
        ).to.eq(0)

        await (await nonfungiblePositionManager.connect(ownerAccount).createAndInitializePoolIfNecessary(
            token0,
            token1,
            FeeAmount.LOW,
            sqrtPriceX96
        )).wait()

        await (await icpdaoDaoTokenForLink.connect(ownerAccount).approve(nonfungiblePositionManager.address, MaxUint256.toString())).wait()

        await (await nonfungiblePositionManager.connect(ownerAccount).mint(
            {
                token0: token0,
                token1: token1,
                fee: FeeAmount.LOW,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: token0Amount,
                amount1Desired: token1Amount,
                amount0Min: 0,
                amount1Min: 0,
                recipient: ownerAccount.address,
                deadline: deadlineTimestamp
            },
            {
                value: quoteTokenAmount
            }
        )).wait()

        expect(
            (await nonfungiblePositionManager.balanceOf(ownerAccount.address)).toNumber()
        ).to.eq(1)

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForLink.address)).toNumber()
        ).to.eq(0)
        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoTokenForLink.connect(ownerAccount).createLPPoolOrLinkLPPool(
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
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForLink.address)).toNumber()
        ).to.eq(1)


        await expect(
            icpdaoDaoTokenForLink.connect(ownerAccount).createLPPoolOrLinkLPPool(
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
        ).to.be.revertedWith("LP");

    })

    it("updateLPPool", async () => {
        await expect(
            icpdaoDaoTokenForUpdate.connect(user2Account).updateLPPool(
                1,0,0
            )
        ).to.be.revertedWith("onlyOwner");

        await expect(
            icpdaoDaoTokenForUpdate.connect(user1Account).updateLPPool(
                1,0,0
            )
        ).to.be.revertedWith("onlyOwner");

        await expect(
            icpdaoDaoTokenForUpdate.connect(ownerAccount).updateLPPool(
                1,0,0
            )
        ).to.be.revertedWith("NP");

        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoTokenForUpdate.address, weth9Address,
            await icpdaoDaoTokenForUpdate.decimals(), 18,
            icpdaoDaoTokenForUpdate.address,
            "1000",
            icpdaoDaoTokenForUpdate.address,
            "1"
        )

        let sqrtPriceX96 = (mockPool as Pool).sqrtRatioX96.toString();
        let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.LOW])
        let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.LOW])
        let baseTokenAmount;
        let quoteTokenAmount;

        if (icpdaoDaoTokenForUpdate.address == (position as Position).amount0.currency.address) {
            console.log("icpdaoDaoTokenForUpdate", "111111111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("icpdaoDaoTokenForUpdate", "2222222222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }


        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForUpdate.address)).toNumber()
        ).to.eq(0)

        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoTokenForUpdate.connect(ownerAccount).createLPPoolOrLinkLPPool(
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
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForUpdate.address)).toNumber()
        ).to.eq(1)

        const uniswapV3Pool: IUniswapV3Pool = (await ethers.getContractAt(IUniswapV3PoolABI, await icpdaoDaoTokenForUpdate.lpPool())) as IUniswapV3Pool;
        const slot0 = (await uniswapV3Pool.slot0());
        const currentTick = slot0.tick;
        const fee = await uniswapV3Pool.fee();

        let tickLowerMint: number;
        let tickUpperMint: number;
        if (icpdaoDaoTokenForUpdate.address == await uniswapV3Pool.token0()) {
            tickLowerMint = getNearestTickLower(currentTick, fee, getTickSpacings(fee) as number);
            tickUpperMint = getMaxTick(getTickSpacings(fee) as number);
        } else {
            tickLowerMint = getMinTick(getTickSpacings(fee) as number);
            tickUpperMint = getNearestTickUpper(currentTick, fee, getTickSpacings(fee) as number);
        }
        await expect(
            icpdaoDaoTokenForUpdate.connect(ownerAccount).updateLPPool(
                (await icpdaoDaoTokenForUpdate.temporaryAmount()).add(1),
                tickLowerMint,
                tickUpperMint
            )
        ).to.be.revertedWith("NET")

        await (await icpdaoDaoTokenForUpdate.connect(ownerAccount).updateLPPool(
            (await icpdaoDaoTokenForUpdate.temporaryAmount()),
            tickLowerMint,
            tickUpperMint
        )).wait()

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForUpdate.address)).toNumber()
        ).to.eq(2)
    });

    it("mint have pool", async () => {
        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoToken.address)).toNumber()
        ).to.eq(1)
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

        const firstStart = (await icpdaoDaoToken.mintAnchor()).lastTimestamp

        await expect(
            icpdaoDaoToken.connect(user2Account).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                firstStart,
                firstMintTimestamp,
                tickLowerMint,
                tickUpperMint
            )
        ).to.revertedWith("onlyOwnerOrManager")

        let tx5 = await icpdaoDaoToken.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            firstStart,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();
        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoToken.address)).toNumber()
        ).to.eq(2)

        await expect(
            icpdaoDaoToken.connect(ownerAccount).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                firstStart,
                firstMintTimestamp,
                tickLowerMint,
                tickUpperMint
            )
        ).to.revertedWith("STI")

        await expect(
            icpdaoDaoToken.connect(ownerAccount).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
                firstMintTimestamp + 86400 + 12,
                tickLowerMint,
                tickUpperMint
            )
        ).to.revertedWith("ET1")

        await expect(
            icpdaoDaoToken.connect(ownerAccount).mint(
                [ownerAccount.address, user1Account.address, user2Account.address],
                [1, 1, 1],
                (await icpdaoDaoToken.mintAnchor()).lastTimestamp,
                (await icpdaoDaoToken.mintAnchor()).lastTimestamp.sub(1),
                tickLowerMint,
                tickUpperMint
            )
        ).to.revertedWith("ET2")

    })

    it("mint no pool", async () => {
        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForNoPool.address)).toNumber()
        ).to.eq(0)
        let tx5 = await icpdaoDaoTokenForNoPool.connect(user1Account).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoTokenForNoPool.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            1,
            1
        )
        const tx5Done = await tx5.wait();
        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForNoPool.address)).toNumber()
        ).to.eq(0)
    })

    it("bonusWithdraw", async () => {
        await expect(
            icpdaoDaoTokenForBonusWithdraw.connect(user3Account).bonusWithdraw()
        ).to.revertedWith("NP")
        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoTokenForBonusWithdraw.address, weth9Address,
            await icpdaoDaoTokenForBonusWithdraw.decimals(), 18,
            icpdaoDaoTokenForBonusWithdraw.address,
            "1000",
            icpdaoDaoTokenForBonusWithdraw.address,
            "1"
        )

        let sqrtPriceX96 = (mockPool as Pool).sqrtRatioX96.toString();
        let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.LOW])
        let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.LOW])
        let baseTokenAmount;
        let quoteTokenAmount;

        if (icpdaoDaoTokenForBonusWithdraw.address == (position as Position).amount0.currency.address) {
            console.log("icpdaoDaoTokenForBonusWithdraw", "111111111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("icpdaoDaoTokenForBonusWithdraw", "22222222222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForBonusWithdraw.address)).toNumber()
        ).to.eq(0)

        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoTokenForBonusWithdraw.connect(ownerAccount).createLPPoolOrLinkLPPool(
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

        const uniswapV3Pool: IUniswapV3Pool = (await ethers.getContractAt(IUniswapV3PoolABI, await icpdaoDaoTokenForBonusWithdraw.lpPool())) as IUniswapV3Pool;
        const slot0 = (await uniswapV3Pool.slot0());
        const currentTick = slot0.tick;
        const fee = await uniswapV3Pool.fee();

        let tickLowerMint: number;
        let tickUpperMint: number;
        if (icpdaoDaoTokenForBonusWithdraw.address == await uniswapV3Pool.token0()) {
            tickLowerMint = getNearestTickLower(currentTick, fee, getTickSpacings(fee) as number);
            tickUpperMint = getMaxTick(getTickSpacings(fee) as number);
        } else {
            tickLowerMint = getMinTick(getTickSpacings(fee) as number);
            tickUpperMint = getNearestTickUpper(currentTick, fee, getTickSpacings(fee) as number);
        }

        let tx5 = await icpdaoDaoTokenForBonusWithdraw.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoTokenForBonusWithdraw.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();

        let tx4 = await icpdaoDaoTokenForBonusWithdraw.connect(ownerAccount).updateLPPool(
            baseTokenAmount,
            tickLowerMint,
            tickUpperMint
        )
        const tx4Done = await tx4.wait();

        await (await icpdaoDaoTokenForBonusWithdraw.connect(user3Account).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoTokenForBonusWithdraw.address,
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
        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: icpdaoDaoTokenForBonusWithdraw.address,
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

        await expect(
            icpdaoDaoTokenForBonusWithdraw.bonusWithdraw()
        ).to.revertedWith("NS")

        await (await store2.connect(ownerAccount).setStaking(stakingAddress)).wait()

        const before1 = await icpdaoDaoTokenForBonusWithdraw.balanceOf(user3Account.address)
        const before2 = await icpdaoDaoTokenForBonusWithdraw.balanceOf(stakingAddress)
        await (await icpdaoDaoTokenForBonusWithdraw.connect(user3Account).bonusWithdraw()).wait()
        const after1 = await icpdaoDaoTokenForBonusWithdraw.balanceOf(user3Account.address)
        const after2 = await icpdaoDaoTokenForBonusWithdraw.balanceOf(stakingAddress)
        expect(after1.sub(before1)).to.eq("14999999999999")
        expect(after2.sub(before2)).to.eq("1485000000000000")
    })

    it("bonusWithdrawByTokenIdList", async () => {
        await (await store3.connect(ownerAccount).setStaking(stakingAddress)).wait()
        await expect(
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(user3Account).bonusWithdraw()
        ).to.revertedWith("NP")
        const [mockPool, position] = getCreatePoolAndPosition(
            FeeAmount.LOW,
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.address, weth9Address,
            await icpdaoDaoTokenForBonusWithdrawByTokenIdList.decimals(), 18,
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.address,
            "1000",
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.address,
            "1"
        )

        let sqrtPriceX96 = (mockPool as Pool).sqrtRatioX96.toString();
        let tickLower = getMinTick(TICK_SPACINGS[FeeAmount.LOW])
        let tickUpper = getMaxTick(TICK_SPACINGS[FeeAmount.LOW])
        let baseTokenAmount;
        let quoteTokenAmount;

        if (icpdaoDaoTokenForBonusWithdrawByTokenIdList.address == (position as Position).amount0.currency.address) {
            console.log("icpdaoDaoTokenForBonusWithdrawByTokenIdList", "111111111111")
            baseTokenAmount = (position as Position).mintAmounts.amount0.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount1.toString();
        } else {
            console.log("icpdaoDaoTokenForBonusWithdrawByTokenIdList", "22222222222")
            baseTokenAmount = (position as Position).mintAmounts.amount1.toString();
            quoteTokenAmount = (position as Position).mintAmounts.amount0.toString()
        }

        expect(
            (await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForBonusWithdrawByTokenIdList.address)).toNumber()
        ).to.eq(0)

        const quoteTokenAmountPlus = BigNumber.from(quoteTokenAmount).add(123)
        let tx3 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(ownerAccount).createLPPoolOrLinkLPPool(
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

        const uniswapV3Pool: IUniswapV3Pool = (await ethers.getContractAt(IUniswapV3PoolABI, await icpdaoDaoTokenForBonusWithdrawByTokenIdList.lpPool())) as IUniswapV3Pool;
        const slot0 = (await uniswapV3Pool.slot0());
        const currentTick = slot0.tick;
        const fee = await uniswapV3Pool.fee();

        let tickLowerMint: number;
        let tickUpperMint: number;
        if (icpdaoDaoTokenForBonusWithdrawByTokenIdList.address == await uniswapV3Pool.token0()) {
            tickLowerMint = getNearestTickLower(currentTick, fee, getTickSpacings(fee) as number);
            tickUpperMint = getMaxTick(getTickSpacings(fee) as number);
        } else {
            tickLowerMint = getMinTick(getTickSpacings(fee) as number);
            tickUpperMint = getNearestTickUpper(currentTick, fee, getTickSpacings(fee) as number);
        }

        let tx5 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(ownerAccount).mint(
            [ownerAccount.address, user1Account.address, user2Account.address],
            [1, 1, 1],
            (await icpdaoDaoTokenForBonusWithdrawByTokenIdList.mintAnchor()).lastTimestamp,
            firstMintTimestamp,
            tickLowerMint,
            tickUpperMint
        )
        const tx5Done = await tx5.wait();

        let tx4 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(ownerAccount).updateLPPool(
            baseTokenAmount,
            tickLowerMint,
            tickUpperMint
        )
        const tx4Done = await tx4.wait();

        await (await icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(user3Account).approve(swapRouter.address, MaxUint128)).wait();

        for (let i = 0; i <= 2; i++){
            const tx6 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: weth9Address,
                    tokenOut: icpdaoDaoTokenForBonusWithdrawByTokenIdList.address,
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
        for (let i = 0; i <= 2; i++){
            const tx7 = await swapRouter.connect(user3Account).exactInputSingle(
                {
                    tokenIn: icpdaoDaoTokenForBonusWithdrawByTokenIdList.address,
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
        let countBigNum = await nonfungiblePositionManager.balanceOf(icpdaoDaoTokenForBonusWithdrawByTokenIdList.address);
        let count = parseInt(countBigNum.toString(), 10)
        const tokenIdList = []
        for (let i = 0; i < count; i++){
            let tokenIdBigNum = await nonfungiblePositionManager.tokenOfOwnerByIndex(icpdaoDaoTokenForBonusWithdrawByTokenIdList.address, i)
            let tokenId = parseInt(tokenIdBigNum.toString(), 10)
            tokenIdList.push(tokenId)
        }

        expect(tokenIdList.includes(0)).to.eq(false)
        expect(tokenIdList.includes(1)).to.eq(false)

        await expect(
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(user3Account).bonusWithdrawByTokenIdList([0])
        ).to.revertedWith("ERC721: owner query for nonexistent token")

        await expect(
            icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(user3Account).bonusWithdrawByTokenIdList([1])
        ).to.revertedWith("")

        const before1 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.balanceOf(user3Account.address)
        const before2 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.balanceOf(stakingAddress)
        await (await icpdaoDaoTokenForBonusWithdrawByTokenIdList.connect(user3Account).bonusWithdrawByTokenIdList([tokenIdList[0]])).wait()
        const after1 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.balanceOf(user3Account.address)
        const after2 = await icpdaoDaoTokenForBonusWithdrawByTokenIdList.balanceOf(stakingAddress)
        expect(after1.sub(before1)).to.eq("1237357706")
        expect(after2.sub(before2)).to.eq("122498412943")
    })

    it("transferOwnership", async () => {
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(true)
        await expect(
            icpdaoDaoToken.connect(user1Account).transferOwnership(
                user2Account.address
            )
        ).to.revertedWith("onlyOwner")
        await expect(
            icpdaoDaoToken.connect(user2Account).transferOwnership(
                user3Account.address
            )
        ).to.revertedWith("onlyOwner")
        await expect(
            icpdaoDaoToken.connect(ownerAccount).transferOwnership(
                "0x0000000000000000000000000000000000000000"
            )
        ).to.revertedWith("")
        expect(
            await icpdaoDaoToken.owner()
        ).to.eq(ownerAccount.address)
        await (await icpdaoDaoToken.connect(ownerAccount).transferOwnership(
            user1Account.address
        )).wait()
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(true)
        expect(
            await icpdaoDaoToken.owner()
        ).to.eq(user1Account.address)

        await (await icpdaoDaoToken.connect(user1Account).transferOwnership(
            user2Account.address
        )).wait()
        expect(
            await icpdaoDaoToken.isManager(user1Account.address)
        ).to.eq(true)
        expect(
            await icpdaoDaoToken.owner()
        ).to.eq(user2Account.address)
    })

    it("erc20 base function", async () => {
        expect(
            await icpdaoDaoToken.balanceOf(user4Account.address)
        ).to.eq(0)
        expect(
            await icpdaoDaoToken.balanceOf(user5Account.address)
        ).to.eq(0)
        await (await icpdaoDaoToken.connect(ownerAccount).transfer(user4Account.address, 100)).wait()
        expect(
            await icpdaoDaoToken.balanceOf(user4Account.address)
        ).to.eq(100)
        await (await icpdaoDaoToken.connect(user4Account).transfer(user5Account.address, 10)).wait()
        expect(
            await icpdaoDaoToken.balanceOf(user4Account.address)
        ).to.eq(90)
        expect(
            await icpdaoDaoToken.balanceOf(user5Account.address)
        ).to.eq(10)
        await expect(
            icpdaoDaoToken.connect(user6Account).transferFrom(user4Account.address, user5Account.address, 10)
        ).to.revertedWith("ERC20: transfer amount exceeds allowance")
        await (await icpdaoDaoToken.connect(user4Account).approve(user6Account.address, 11)).wait()
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(11)
        await (await icpdaoDaoToken.connect(user6Account).transferFrom(user4Account.address, user5Account.address, 10)).wait()
        expect(
            await icpdaoDaoToken.balanceOf(user4Account.address)
        ).to.eq(80)
        expect(
            await icpdaoDaoToken.balanceOf(user5Account.address)
        ).to.eq(20)
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(1)
        await (await icpdaoDaoToken.connect(user4Account).increaseAllowance(user6Account.address, 199)).wait()
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(200)
        await (await icpdaoDaoToken.connect(user4Account).decreaseAllowance(user6Account.address, 150)).wait()
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(50)
        await expect(
            icpdaoDaoToken.connect(user6Account).transferFrom(user4Account.address, user5Account.address, 60)
        ).to.revertedWith("ERC20: transfer amount exceeds allowance")
        await (await icpdaoDaoToken.connect(user4Account).increaseAllowance(user6Account.address, 150)).wait()
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(200)
        await expect(
            icpdaoDaoToken.connect(user6Account).transferFrom(user4Account.address, user5Account.address, 81)
        ).to.revertedWith("ERC20: transfer amount exceeds balance")

        await (await icpdaoDaoToken.connect(user6Account).transferFrom(user4Account.address, user5Account.address, 80)).wait()
        expect(
            await icpdaoDaoToken.balanceOf(user4Account.address)
        ).to.eq(0)
        expect(
            await icpdaoDaoToken.balanceOf(user5Account.address)
        ).to.eq(100)
        expect(
            await icpdaoDaoToken.allowance(user4Account.address, user6Account.address)
        ).to.eq(120)
    })

})