import { ethers } from "hardhat";
import { expect } from "chai";
import {DAOFactory, DAOToken, ERC20Mock} from "../typechain";
import { abi as IDAOTokenABI} from "../artifacts/contracts/interfaces/IDAOToken.sol/IDAOToken.json";
import {abi as IcpdaoDaoTokenABI} from "../artifacts/contracts/DAOToken.sol/DAOToken.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/src/signers";

describe("DAOFactory.2", async () => {
    let mockStaking: ERC20Mock;
    let daoFactory: DAOFactory;
    let _lpTotalAmount: number = 100000;

    it("deploy", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        daoFactory = (await daoFactory_.deploy(w1.address)) as DAOFactory;
        expect(
            await daoFactory.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        const doDeploy = await daoFactory.connect(w2).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address],
            [100, 100],
            50,
            _lpTotalAmount,
            w3.address,
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
        await doDeploy.wait();

        const icpdaoDaoTokenAddress = await daoFactory.tokens('mock_dao_id_1')
        const icpdaoDaoToken = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress)) as DAOToken;

        expect(
            await icpdaoDaoToken.owner()
        ).to.eq(w3.address)

        await expect(
            daoFactory.connect(w2).deploy(
                "mock_dao_id_1",
                [w1.address, w2.address, w3.address],
                [100, 100, 100],
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
        ).to.be.revertedWith("ICPDAO: NOT OWNER DO REDEPLOY");

        const reDoDeploy = await daoFactory.connect(w3).deploy(
            "mock_dao_id_1",
            [w1.address, w2.address],
            [100, 100],
            50,
            _lpTotalAmount,
            w2.address,
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
        await reDoDeploy.wait();

        const icpdaoDaoTokenAddress2 = await daoFactory.tokens('mock_dao_id_1')
        const icpdaoDaoToken2 = (await ethers.getContractAt(IcpdaoDaoTokenABI, icpdaoDaoTokenAddress2)) as DAOToken;

        expect(
            await icpdaoDaoToken2.owner()
        ).to.eq(w2.address)
    })

    it("setStaking", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        expect(
            await daoFactory.owner()
        ).to.eq(w1.address)

        expect(
            await daoFactory.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        await expect(
            daoFactory.connect(w2).setStaking(
                w1.address
            )
        ).to.be.revertedWith("ICPDAO: ONLY OWNER CAN CALL");

        await expect(
            daoFactory.connect(w1).setStaking(
                '0x0000000000000000000000000000000000000000'
            )
        ).to.be.revertedWith("ICPDAO: _staking INVALID");

        expect(
            await daoFactory.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')

        await (await daoFactory.connect(w1).setStaking(
            w2.address
        )).wait();

        expect(
            await daoFactory.staking()
        ).to.eq(w2.address)

        await (await daoFactory.connect(w1).setStaking(
            w3.address
        )).wait();

        expect(
            await daoFactory.staking()
        ).to.eq(w3.address)
    })

    it("transferOwnership", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        expect(
            await daoFactory.owner()
        ).to.eq(w1.address);

        await expect(
            daoFactory.connect(w2).transferOwnership(
                w1.address
            )
        ).to.be.revertedWith("ICPDAO: NOT OWNER");
        expect(
            await daoFactory.owner()
        ).to.eq(w1.address);

        await (await daoFactory.connect(w1).transferOwnership(
            w2.address
        )).wait();
        expect(
            await daoFactory.owner()
        ).to.eq(w2.address);

        await expect(
            daoFactory.connect(w1).transferOwnership(
                w3.address
            )
        ).to.be.revertedWith("ICPDAO: NOT OWNER");
        expect(
            await daoFactory.owner()
        ).to.eq(w2.address);

        await (await daoFactory.connect(w2).transferOwnership(
            w3.address
        )).wait();
        expect(
            await daoFactory.owner()
        ).to.eq(w3.address);

        await (await daoFactory.connect(w3).transferOwnership(
            w1.address
        )).wait();
        expect(
            await daoFactory.owner()
        ).to.eq(w1.address);
    })

    it("destruct", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const daoFactoryDestruct = (await daoFactory_.deploy(w1.address)) as DAOFactory;
        expect(
            await daoFactoryDestruct.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')
        expect(
            await daoFactoryDestruct.owner()
        ).to.eq(w1.address);

        await expect(
            daoFactoryDestruct.connect(w2).destruct()
        ).to.be.revertedWith("ICPDAO: ONLY OWNER CAN CALL DESTRUCT");

        await (await daoFactoryDestruct.connect(w1).destruct()).wait();
    })

    it("transferOwnership zero", async () => {
        const [w1, w2, w3] = await ethers.getSigners();
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        const daoFactoryZero = (await daoFactory_.deploy(w1.address)) as DAOFactory;
        expect(
            await daoFactoryZero.staking()
        ).to.eq('0x0000000000000000000000000000000000000000')
        expect(
            await daoFactoryZero.owner()
        ).to.eq(w1.address);

        await (await daoFactoryZero.connect(w1).transferOwnership(
            '0x0000000000000000000000000000000000000000'
        )).wait();
        expect(
            await daoFactoryZero.owner()
        ).to.eq('0x0000000000000000000000000000000000000000');
    })
})