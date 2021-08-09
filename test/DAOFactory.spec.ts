import { ethers } from "hardhat";
import { expect } from "chai";
import { DAOFactory, ERC20Mock } from "../typechain";
import { abi as IDAOTokenABI} from "../artifacts/contracts/interfaces/IDAOToken.sol/IDAOToken.json";

describe("DAOFactory", async () => {
    let mockStaking: ERC20Mock;
    let daoFactory: DAOFactory;

    before("deploy mock staking && factory", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const erc20Mock = await ethers.getContractFactory('ERC20Mock');
        mockStaking = (await erc20Mock.deploy([w1.address, w2.address, w3.address], [100, 100, 100], "Mock", "MOCK")) as ERC20Mock;
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        daoFactory = (await daoFactory_.deploy(w1.address, mockStaking.address)) as DAOFactory;
    })

    it("create one dao && re deploy", async () => {
        expect(
            await daoFactory.staking()
        ).to.eq(mockStaking.address)

        const [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        const doDeploy = await daoFactory.connect(w2).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [100, 100, 100, 100, 100, 100],
            50,
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
        console.log("deploy gas limit: ", doDeploy.gasLimit?.toNumber());

        try {
            const reDeploy = await daoFactory.connect(w2).deploy(
                "mock_dao_id_1",
                [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
                [100, 100, 100, 100, 100, 100],
                50,
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
            );
            expect(1).to.be.equal(2);
        } catch (e) {
            expect(e.message).to.be.contain("ICPDAO: NOT OWNER DO REDEPLOY");
        }
        let newToken = await ethers.getContractAt(
            IDAOTokenABI,
            await daoFactory.tokens("mock_dao_id_1"),
        );
        await newToken.connect(w1).addManager(w2.address);
        expect(await newToken.isManager(w2.address)).to.be.true;
        expect(await newToken.isManager(w3.address)).to.be.false;
        const reDeploy = await daoFactory.connect(w1).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [100, 100, 100, 100, 100, 100],
            50,
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
        );
        console.log("redeploy gas limit: ", reDeploy.gasLimit?.toNumber());
    })

    it("transferOwnership", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const erc20Mock = await ethers.getContractFactory('ERC20Mock');
        const _mockStaking = (await erc20Mock.deploy([w1.address, w2.address, w3.address], [100, 100, 100], "Mock", "MOCK")) as ERC20Mock;
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const _daoFactory = (await daoFactory_.deploy(w1.address, _mockStaking.address)) as DAOFactory;

        expect(
            await _daoFactory.owner()
        ).to.eq(
            w1.address
        )
        await expect(
            _daoFactory.connect(w2).transferOwnership(w3.address)
        ).to.be.revertedWith("ICPDAO: NOT OWNER");

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
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const _daoFactory = (await daoFactory_.deploy(w1.address, _mockStaking.address)) as DAOFactory;

        await expect(
            _daoFactory.connect(w2).destruct()
        ).to.be.revertedWith("ICPDAO: ONLY OWNER CAN CALL DESTRUCT")

        await _daoFactory.connect(w1).destruct()
    })
})