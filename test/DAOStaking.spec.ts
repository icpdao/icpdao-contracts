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
        daoStaking = (await (await ethers.getContractFactory("DAOStaking")).deploy()) as DAOStaking;
        
        const daoFactory_ = await ethers.getContractFactory('DAOFactory');
        daoFactory = (await daoFactory_.deploy(daoStaking.address)) as DAOFactory;
        await daoFactory.deploy(
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [1000, 1000, 1000, 1000, 1000, 1000],
            50,
            w1.address,
            [90, 1, 3, 1, 30, 0, 0],
            "mock_icp_id_1",
            "MockICP",
            "MICP"
        );

        mockICP = await daoFactory.tokens("mock_icp_id_1");
        mockICPContract = (await ethers.getContractAt(
            IERC20ABI,
            mockICP
        )) as ERC20;
        await daoStaking.setICPToken(mockICP);

        expect(await daoStaking.ICP()).to.be.equal(mockICP);

        mockERC1 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [1000, 1000, 1000, 1000, 1000, 1000],
            "mockERC1",
            "MERC1"
        )) as ERC20Mock;
        mockERC2 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [1000, 1000, 1000, 1000, 1000, 1000],
            "mockERC1",
            "MERC1"
        )) as ERC20Mock;
        mockERC3 = (await (await ethers.getContractFactory("ERC20Mock")).deploy(
            [w1.address, w2.address, w3.address, w4.address, w5.address, w6.address],
            [1000, 1000, 1000, 1000, 1000, 1000],
            "mockERC1",
            "MERC1"
        )) as ERC20Mock;

        // init mock bonus
        await mockERC1.connect(w1).transfer(daoStaking.address, 900);
        await mockERC2.connect(w1).transfer(daoStaking.address, 900);
        await mockERC3.connect(w1).transfer(daoStaking.address, 900);
    })
    it("add/remove token list", async () => {
        await daoStaking.connect(w1).addTokenList(
            [mockERC1.address, mockERC2.address]
        );
        let tl = await daoStaking.tokenList(w1.address);
        expect(tl).to.contain(mockERC1.address).contain(mockERC2.address);
        await daoStaking.connect(w1).removeTokenList(
            [mockERC1.address]
        );
        tl = await daoStaking.tokenList(w1.address);
        expect(tl[0]).to.be.equal(mockERC2.address);
    })

    it("w1 deposit 100", async () => {
        await mockICPContract.connect(w1).approve(daoStaking.address, 200);
        const d1 = await daoStaking.connect(w1).deposit(
            100,
            [mockERC1.address]
        );
        (await d1.wait()).events?.forEach(x => { 
            console.log(x.event, x.args)
        });
        await network.provider.send("evm_mine");
        console.log((await mockERC1.balanceOf(w1.address)).toNumber());
        await mockERC1.connect(w6).transfer(daoStaking.address, 1000);
        const d2 = await daoStaking.connect(w1).deposit(
            100,
            [mockERC1.address]
        );
        (await d2.wait()).events?.forEach(x => {
            console.log(x.event, x.args)
        });
        console.log((await mockERC1.balanceOf(w1.address)).toNumber());
        await network.provider.send("evm_mine");
        console.log(await network.provider.send("eth_blockNumber"));
    })
})