import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";


describe("HelloToken", () => {
  it("HelloToken is erc20", async () => {
    const [owner, addr1] = await ethers.getSigners();

    console.log("address:", owner.address);
    console.log("address:", owner);
    let num = BigNumber.from(10).pow(18);
    const HelloToken = await ethers.getContractFactory("HelloToken");
    const helloToken = await HelloToken.deploy(num);
    await helloToken.deployed();

    
    expect(await helloToken.totalSupply()).to.equal(num);
    expect(await helloToken.balanceOf(owner.address)).to.equal(num);
    expect(await helloToken.balanceOf(addr1.address)).to.equal(0);

    const tx = await helloToken.transfer(addr1.address, 10000);
    
    // // wait until the transaction is mined
    await tx.wait();

    expect(await helloToken.balanceOf(addr1.address)).to.equal(10000);
  });
});
