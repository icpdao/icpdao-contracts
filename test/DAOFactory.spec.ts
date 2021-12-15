import { ethers } from "hardhat";
import { expect } from "chai";
import { DAOFactory, DAOFactoryStore, ERC20Mock } from "../typechain";
import { abi as IDAOTokenABI} from "../artifacts/contracts/interfaces/IDAOToken.sol/IDAOToken.json";

describe("DAOFactory", async () => {
    let mockStaking: ERC20Mock;
    let daoFactory: DAOFactory;
    let _lpTotalAmount: number = 100000;

    it("create one dao && re deploy", async () => {
        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        const erc20Mock = await ethers.getContractFactory('ERC20Mock');

        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        mockStaking = (await erc20Mock.deploy([w1.address, w2.address, w3.address], [100, 100, 100], "Mock", "MOCK")) as ERC20Mock;
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;

        await (await store.addFactory(daoFactory.address)).wait();

        expect(
            await daoFactory.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        expect(
            await daoFactory.owner()
        ).to.eq(w1.address)

        const doDeploy = await daoFactory.connect(w2).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [100, 100, 100, 100, 100, 100],
            50,
            _lpTotalAmount,
            w1.address,
            {
                p: 90,
                aNumerator: 1,
                aDenominator: 3,
                bNumerator: 1,
                bDenominator: 30,
                c: 0,
                d: 0
            },
            // [90, 1, 3, 1, 30, 0, 0],
            "MockDAO1",
            "MD1"
        );

        await expect(
            daoFactory.connect(w2).deploy(
                "mock_dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
                _lpTotalAmount,
                w1.address,
                // [90, 1, 3, 1, 30, 0, 0],
                {
                    p: 90,
                    aNumerator: 1,
                    aDenominator: 3,
                    bNumerator: 1,
                    bDenominator: 30,
                    c: 0,
                    d: 0
                },
                "MockDAO1",
                "MD1"
            )
        ).to.be.revertedWith("NOT OWNER DO REDEPLOY");

        let {token: newTokenAddress} = await daoFactory.tokens("mock_dao_id_1");
        let newToken = await ethers.getContractAt(
            IDAOTokenABI,
            newTokenAddress,
        );
        await newToken.connect(w1).addManager(w2.address);
        expect(await newToken.isManager(w2.address)).to.be.true;
        expect(await newToken.isManager(w3.address)).to.be.false;
        const reDeploy = await daoFactory.connect(w1).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [100, 100, 100, 100, 100, 100],
            50,
            _lpTotalAmount,
            w3.address,
            // [90, 1, 3, 1, 30, 0, 0],
            {
                p: 90,
                aNumerator: 1,
                aDenominator: 3,
                bNumerator: 1,
                bDenominator: 30,
                c: 0,
                d: 0
            },
            "MockDAO1",
            "MD1"
        );
        let {token: newTokenAddress2} = await daoFactory.tokens("mock_dao_id_1");
        let newToken2 = await ethers.getContractAt(
            IDAOTokenABI,
            newTokenAddress2,
        );
        expect(newToken2.address).not.eq(newToken.address);

        expect(
            await newToken2.factory()
        ).to.eq(daoFactory.address)

        expect(
            await newToken2.owner()
        ).to.eq(w3.address)

        expect(
            await newToken2.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        expect(
            await newToken.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')
    })

    it("transferOwnership", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const erc20Mock = await ethers.getContractFactory('ERC20Mock');
        const _mockStaking = (await erc20Mock.deploy([w1.address, w2.address, w3.address], [100, 100, 100], "Mock", "MOCK")) as ERC20Mock;

        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const _daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;

        await (await store.addFactory(_daoFactory.address)).wait();

        expect(
            await _daoFactory.owner()
        ).to.eq(
            w1.address
        )
        await expect(
            _daoFactory.connect(w2).transferOwnership(w3.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await (await _daoFactory.connect(w1).transferOwnership(w2.address)).wait();
        expect(
            await _daoFactory.owner()
        ).to.eq(
            w2.address
        )
    })

    it("destruct", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const erc20Mock = await ethers.getContractFactory('ERC20Mock');
        const _mockStaking = (await erc20Mock.deploy([w1.address, w2.address, w3.address], [100, 100, 100], "Mock", "MOCK")) as ERC20Mock;

        const store = (await (await ethers.getContractFactory('DAOFactoryStore')).deploy(w1.address)) as DAOFactoryStore;

        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const _daoFactory = (await daoFactory_.deploy(w1.address, store.address)) as DAOFactory;

        await (await store.addFactory(_daoFactory.address)).wait();

        await expect(
            _daoFactory.connect(w2).destruct()
        ).to.be.revertedWith("Ownable: caller is not the owner")

        await _daoFactory.connect(w1).destruct()
    })
})