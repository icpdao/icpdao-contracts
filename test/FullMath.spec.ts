import { expect } from 'chai'
import { ethers } from 'hardhat'

import { FullMathTest } from '../typechain'

describe('FullMath', () => {
    let fullMathTest: FullMathTest
    before('deploy test contract', async () => {
        const fullMathTestFactory = await ethers.getContractFactory('FullMathTest')
        fullMathTest = (await fullMathTestFactory.deploy()) as FullMathTest
    })

    it('check div mul', async () => {
        const r1 = await fullMathTest.divMul(300, 100, 2)
        expect(r1).to.equal(6)
    })

    it('check div 0', async () => {
        expect(await fullMathTest.divMul(300, 0, 2)).to.equal(0)
    })

    it('check 0 div', async () => {
        expect(await fullMathTest.divMul(0, 300, 2)).to.equal(0)
    })

})