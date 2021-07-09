import chai from 'chai'
import { ethers } from 'hardhat';
import {Greeter, Greeter__factory} from '../src/types/index';
import {ContractFactory} from "ethers";

const { expect } = chai

describe("Greeter", () => {
  it("Should return the new greeting once it's changed", async () => {
    const signers = await ethers.getSigners();
    const GreeterFactory: ContractFactory = new Greeter__factory(signers[0]);
    const greeter: Greeter = (await GreeterFactory.deploy("hello")) as Greeter;

    const setGreetingTx = await greeter.setGreeting("hola");
    await setGreetingTx.wait();
    expect(await  greeter.greet()).to.equal("hola");
  })
})
