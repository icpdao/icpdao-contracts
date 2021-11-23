import { MaxUint256 } from "@uniswap/sdk-core"
import { expect } from "chai"
import { BigNumber, BigNumberish } from "ethers"
import { ethers } from "hardhat"

import { MintMathTest } from "../typechain"

describe('MintMath', () => {

    let mintMathTest: MintMathTest

    before('deploy test contract', async () => {
        const mintMathTestFactory = await ethers.getContractFactory('MintMathTest')
        mintMathTest = (await mintMathTestFactory.deploy()) as MintMathTest
    })

    it('test mul div', async () => {
        
        // 每日 90 token, 每 30 天 1/3 一次
        const args2: [
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish,
            BigNumberish
        ] = [90, 1, 3, 1, 30, 0, 0]
        // mintMathTest.initialize(args1, currentDate.getTime())
        const r1 = await mintMathTest.mulDiv(1, 1, 365)
        expect(r1).to.be.equal(BigNumber.from(1).div(365))

        expect(await mintMathTest.mulDiv(1, 365, 365)).to.be.equal(1)
        expect(await mintMathTest.mulDiv(1, 367, 365)).to.be.equal(1)

        expect(await mintMathTest.mulDiv(3, 4, 6)).to.be.equal(2)

        expect(await mintMathTest.mulDiv(
            BigNumber.from(2).pow(128).sub(1), 
            BigNumber.from(2).pow(128).sub(1),
            BigNumber.from(2).pow(128).sub(1))
        ).to.be.equal(BigNumber.from(2).pow(128).sub(1))

        expect(await mintMathTest.mulDiv(
            BigNumber.from(2).pow(128).sub(1), 
            BigNumber.from(2).pow(10).sub(1),
            BigNumber.from(2).pow(128).sub(1))
        ).to.be.equal(BigNumber.from(2).pow(10).sub(1))
    })

    it('test days 10, 1/2 365', async () => {
        let currentTime = Math.floor((new Date()).getTime() / 1000);
        // 每日 10 token, 每 365 天 减半一次
        // const args1: [
        //     BigNumberish,
        //     BigNumberish,
        //     BigNumberish,
        //     BigNumberish,
        //     BigNumberish,
        //     BigNumberish,
        //     BigNumberish
        // ] = [10, 1, 2, 1, 365, 0, 0]
        const args = {
            p: 10,
            aNumerator: 1,
            aDenominator: 2,
            bNumerator: 1,
            bDenominator: 365,
            c: 0,
            d: 0
        }
        await mintMathTest.initialize(args, currentTime)
        expect((await mintMathTest.anchor()).lastTimestamp).to.be.equal(Math.floor(currentTime / 86400) * 86400)
        expect((await mintMathTest.anchor()).n).to.be.equal(0)
        currentTime = currentTime + 86400 * 2 + 8
        await mintMathTest.total(currentTime)
        expect(await mintMathTest.results()).to.be.equal(20)
        currentTime = currentTime + 86400 * 363
        await mintMathTest.total(currentTime)
        expect(await mintMathTest.results()).to.be.equal(3620)
    })

    it('tests days 10, 1/4, 30', async () => {
        // 从第 1 天开始, 每天 10 token, 每 30 天 减 0.25, 第 31, 61 天的挖矿数量
        const args = {
            p: 10,
            aNumerator: 1,
            aDenominator: 4,
            bNumerator: 1,
            bDenominator: 30,
            c: 0,
            d: 0
        }
        let currentTime = Math.floor((new Date()).getTime() / 1000)
        await mintMathTest.initialize(args, currentTime)
        currentTime = currentTime + 86400 * 31 + 8
        await mintMathTest.total(currentTime)
        expect(await mintMathTest.results()).to.be.equal(10*30+2*1)
    })

})