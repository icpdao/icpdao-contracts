import { ethers } from "hardhat";
import { expect } from "chai";
import { DAOFactory, DAOFactoryStore, ERC20Mock } from "../typechain";
import { abi as DAOTokenABI} from "../artifacts/contracts/DAOToken.sol/DAOToken.json";

describe("DAOFactoryStore.error", async () => {
    let _lpTotalAmount: number = 100000;
    let mintargs: any = {
        p: 90,
        aNumerator: 1,
        aDenominator: 3,
        bNumerator: 1,
        bDenominator: 30,
        c: 0,
        d: 0
    };

    it("add token only factory", async () => {
        // create store
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        await expect(
            store.connect(w2).addToken("123", w4.address, 1)
        ).revertedWith("onlyFactory");

        await (await store.connect(w1).addFactory(w2.address)).wait();

        await (await store.connect(w2).addToken("123", w4.address, 1)).wait();
    });

    it("add factory only owner", async () => {
        // create store
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        await expect(
            store.connect(w3).addFactory(w2.address)
        ).revertedWith("Ownable: caller is not the owner");

        await (await store.connect(w1).addFactory(w2.address)).wait();
    });

    it("remove factory only owner", async () => {
        // create store
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        await (await store.connect(w1).addFactory(w2.address)).wait();

        await expect(
            store.connect(w3).removeFactory(w2.address)
        ).revertedWith("Ownable: caller is not the owner");

        await (await store.connect(w1).removeFactory(w2.address)).wait();
    });

    it("set staking only owner", async () => {
        // create store
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        await expect(
            store.connect(w3).setStaking(w2.address)
        ).revertedWith("Ownable: caller is not the owner");

        await (await store.connect(w1).setStaking(w2.address)).wait();

    });
})