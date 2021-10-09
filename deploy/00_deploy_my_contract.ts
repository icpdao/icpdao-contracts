import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ContractFactory} from "ethers";
import {abi as DAOStakingABI} from '../artifacts/contracts/DAOStaking.sol/DAOStaking.json'
import {bytecode as DAOStakingByteCode} from '../artifacts/contracts/DAOStaking.sol/DAOStaking.json'
import {abi as DAOFactoryABI} from '../artifacts/contracts/DAOFactory.sol/DAOFactory.json'
import {bytecode as DAOFactoryByteCode} from '../artifacts/contracts/DAOFactory.sol/DAOFactory.json'
import {DAOStaking} from "../typechain";


// const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//     const {deployments, getNamedAccounts} = hre;
//     const {deploy, execute} = deployments;
//
//     const {deployer} = await getNamedAccounts();
//     const owner = "0x3946d96a4b46657ca95CBE85d8a60b822186Ad1f";
//
//     // // DAOStaking
//     await deploy('DAOStaking', {
//         from: deployer,
//         args: [owner],
//         log: true,
//     });
//     const DAOStaking = await deployments.get('DAOStaking');
//
//     // DAOFactory
//     await deploy('DAOFactory', {
//         from: deployer,
//         args: [owner, DAOStaking.address],
//         log: true,
//     });
//
// };
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const owner = "0x3946d96a4b46657ca95CBE85d8a60b822186Ad1f";
    const [actor] = await hre.ethers.getSigners();

    const daoStackingFactory = new ContractFactory(DAOStakingABI, DAOStakingByteCode, actor);
    const daoStackingDeployParams = [owner];
    const DAOStaking = await daoStackingFactory.deploy(...daoStackingDeployParams);

    const daoFactoryFactory = new ContractFactory(DAOFactoryABI, DAOFactoryByteCode, actor);
    const daoFactoryDeployParams = [owner, DAOStaking.address];
    const DAOFactory = await daoFactoryFactory.deploy(...daoFactoryDeployParams);

    console.log("DAOStaking address: " + DAOStaking.address)
    console.log("DAOFactory address: " + DAOFactory.address)
};
export default func;
func.tags = ['DAOStaking', 'DAOFactory'];