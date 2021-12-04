import { ethers } from "hardhat";
import { expect } from "chai";
import { DAOFactory, DAOFactoryStore, ERC20Mock } from "../typechain";
import { abi as DAOTokenABI} from "../artifacts/contracts/DAOToken.sol/DAOToken.json";

describe("DAOFactoryStore", async () => {
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

    it("add token", async () => {
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        // create factory
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;
        // add factory
        await (await store.addFactory(daoFactory.address)).wait();
        // add token
        await (
            await daoFactory.connect(w2).deploy(
                "dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao1",
                "DAO1"
            )
        ).wait();
        await (
            await daoFactory.connect(w2).deploy(
                "dao_id_2",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao2",
                "DAO2"
            )
        ).wait();
        // query token
        let {token: dao1, version: dao1Version} = await daoFactory.tokens("dao_id_1");
        let dao1Token = await ethers.getContractAt(DAOTokenABI, dao1);
        let {token: dao2, version: dao2Version} = await daoFactory.tokens("dao_id_2");
        let dao2Token = await ethers.getContractAt(DAOTokenABI, dao2);
        expect(
            (await store.tokens("dao_id_1")).token
        ).eq(dao1);
        expect(
            (await store.tokens("dao_id_2")).token
        ).eq(dao2);
        expect(
            (await store.tokens("dao_id_1")).version
        ).eq(dao1Version);
        expect(
            (await store.tokens("dao_id_2")).version
        ).eq(dao2Version);
        expect(await dao1Token.name()).eq("dao1")
        expect(await dao2Token.name()).eq("dao2")
        expect(await dao1Token.symbol()).eq("DAO1")
        expect(await dao2Token.symbol()).eq("DAO2")
        // re add token
        await (
            await daoFactory.connect(w1).deploy(
                "dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao11",
                "DAO11"
            )
        ).wait();
        await (
            await daoFactory.connect(w1).deploy(
                "dao_id_2",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao22",
                "DAO22"
            )
        ).wait();
        // query token
        let {token: dao11, version: dao11Version} = await daoFactory.tokens("dao_id_1");
        let dao11Token = await ethers.getContractAt(DAOTokenABI, dao11);
        let {token: dao22, version: dao22Version} = await daoFactory.tokens("dao_id_2");
        let dao22Token = await ethers.getContractAt(DAOTokenABI, dao22);
        expect(
            (await store.tokens("dao_id_1")).token
        ).eq(dao11);
        expect(
            (await store.tokens("dao_id_2")).token
        ).eq(dao22);
        expect(
            (await store.tokens("dao_id_1")).version
        ).eq(dao11Version);
        expect(
            (await store.tokens("dao_id_2")).version
        ).eq(dao22Version);
        expect(await dao11Token.name()).eq("dao11")
        expect(await dao22Token.name()).eq("dao22")
        expect(await dao11Token.symbol()).eq("DAO11")
        expect(await dao22Token.symbol()).eq("DAO22")
    })

    it("add factory and remove factory", async () => {
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        // create factory
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;
        // add factory
        await (await store.addFactory(daoFactory.address)).wait();
        // add token
        await (
            await daoFactory.connect(w2).deploy(
                "dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao1",
                "DAO1"
            )
        ).wait();
        // remove factory
        await (await store.removeFactory(daoFactory.address)).wait();
        await expect(
            daoFactory.connect(w2).deploy(
                "dao_id_2",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao2",
                "DAO2"
            )
        ).revertedWith("onlyFactory");
    })

    it("set stacking", async () => {
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        // create store
        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        // create factory
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;
        // add factory
        await (await store.addFactory(daoFactory.address)).wait();
        // add token
        await (
            await daoFactory.connect(w2).deploy(
                "dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                mintargs,
                "dao1",
                "DAO1"
            )
        ).wait();
      // token staking
      let {token: dao1, version: dao1Version} = await daoFactory.tokens("dao_id_1");
      let dao1Token = await ethers.getContractAt(DAOTokenABI, dao1);
      expect(await dao1Token.staking()).eq("0x0000000000000000000000000000000000000000")
      // factory staking
      expect(await daoFactory.staking()).eq("0x0000000000000000000000000000000000000000")
      // store staking
      expect(await store.staking()).eq("0x0000000000000000000000000000000000000000")
      // set staking
      await (await store.setStaking(w3.address)).wait();
      // token staking
      expect(await dao1Token.staking()).eq(w3.address)
      // factory staking
      expect(await daoFactory.staking()).eq(w3.address)
      // store staking
      expect(await store.staking()).eq(w3.address)
    })
})