import { ethers, network } from "hardhat";
import { expect } from "chai";
import { DAOStaking, DAOFactory, ERC20Mock, ERC20 } from "../typechain";
import { abi as IERC20ABI } from "../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("DAOStaking", () => {
    let mockICP: string;
    let mockICPContract: ERC20;
    let daoStaking: DAOStaking;
    let daoFactory: DAOFactory;
    let mockERC1: ERC20Mock;
    let mockERC2: ERC20Mock;
    let mockERC3: ERC20Mock;
    let w1: SignerWithAddress;
    let w2: SignerWithAddress;
    let w3: SignerWithAddress;
    let w4: SignerWithAddress;
    let w5: SignerWithAddress;
    let w6: SignerWithAddress;

    before("deploy dao staking && dao factory", async () => {
        [w1, w2, w3, w4, w5, w6] = await ethers.getSigners();
        daoStaking = (await (await ethers.getContractFactory("DAOStaking")).deploy(w1.address)) as DAOStaking;
        
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        daoFactory = (await daoFactory_.deploy(w1.address, daoStaking.address)) as DAOFactory;
        // mock icp holders: w1, w2
        await daoFactory.deploy(
            "mock_icp_id_1",
            [w1.address, w2.address], [1000, 1000],
            50, w1.address, 
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
            "MockICP", "MICP"
        );

        mockICP = await daoFactory.tokens("mock_icp_id_1");
        mockICPContract = (await ethers.getContractAt(IERC20ABI, mockICP)) as ERC20;

        await daoStaking.setICPToken(mockICP);

        expect(await daoStaking.ICPD()).to.be.equal(mockICP);
        
        // mock bonus: mockERC1, mockERC2, mockERC3
        mockERC1 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w3.address], [1000], "mockERC1", "MERC1")) as ERC20Mock;
        mockERC2 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w4.address], [1000], "mockERC2", "MERC2")) as ERC20Mock;
        mockERC3 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w5.address], [1000], "mockERC3", "MERC3")) as ERC20Mock;

        // init mock bonus
        await mockERC1.connect(w3).transfer(daoStaking.address, 100);
        await mockERC2.connect(w4).transfer(daoStaking.address, 100);
        await mockERC3.connect(w5).transfer(daoStaking.address, 100);
    })

    it("add/remove token list", async () => {
        await daoStaking.connect(w1).addTokenList([mockERC1.address, mockERC2.address]);
        let tl = await daoStaking.tokenList(w1.address);
        expect(tl).to.contain(mockERC1.address).contain(mockERC2.address);
        await daoStaking.connect(w1).removeTokenList([mockERC2.address]);
        tl = await daoStaking.tokenList(w1.address);
        expect(tl[0]).to.be.equal(mockERC1.address);
        await daoStaking.connect(w1).removeTokenList([mockERC1.address]);
        tl = await daoStaking.tokenList(w1.address);
        expect(tl.length).to.be.equal(0);
    })

    it("deposit", async () => {
        await network.provider.send("evm_mine");
        await mockICPContract.connect(w1).approve(daoStaking.address, 300);
        await mockICPContract.connect(w2).approve(daoStaking.address, 100);
        const d1 = await (await daoStaking.connect(w1).deposit(100, [mockERC1.address])).wait();
        // d1.events?.forEach(x => {
        //     console.log(x.event, x.args)
        // });
        await (await mockERC1.connect(w3).transfer(daoStaking.address, 100)).wait();
        expect(await mockERC1.balanceOf(daoStaking.address)).to.be.equal(200);

        const d2 = await (await daoStaking.connect(w1).deposit(100, [mockERC1.address])).wait();
        expect(await mockERC1.balanceOf(w1.address)).to.be.equal(100);

        const d3 = await (await daoStaking.connect(w2).deposit(50, [mockERC1.address])).wait();
        expect(await mockERC1.balanceOf(w2.address)).to.be.equal(0);

        await (await mockERC1.connect(w3).transfer(daoStaking.address, 200)).wait();
        const d4 = await (await daoStaking.connect(w2).deposit(10, [mockERC1.address])).wait();
        expect(await mockERC1.balanceOf(w2.address)).to.be.equal(40);

        await (await mockERC1.connect(w3).transfer(daoStaking.address, 200)).wait();
        const d5 = await (await daoStaking.connect(w2).deposit(40, [mockERC1.address])).wait();
        expect(await mockERC1.balanceOf(w2.address)).to.be.equal(86);

        await (await mockERC1.connect(w3).transfer(daoStaking.address, 200)).wait();
        const d6 = await (await daoStaking.connect(w1).deposit(100, [mockERC1.address])).wait();
        // d6.events?.forEach(x => {
        //     console.log(x.event, x.args)
        // });
        expect(await mockERC1.balanceOf(w1.address)).to.be.equal(100 + 160 + 154 + 133);
    })

    it("withdraw", async () => {
        expect(await mockICPContract.balanceOf(w1.address)).to.be.equal(700);
        await (await mockERC1.connect(w3).transfer(daoStaking.address, 200)).wait();
        const wd1 = await (await daoStaking.connect(w1).withdraw(100)).wait();
        expect(await mockERC1.balanceOf(w1.address)).to.be.equal(100 + 160 + 154 + 133 + 150);

        expect(await mockICPContract.balanceOf(w1.address)).to.be.equal(700 + 100);
    })
})