import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;

    const {deployer} = await getNamedAccounts();
    const owner = "0xAce84e2A50EfcF847c3a1d21018cecc2075E4a78";

    // DAOFactory
    await deploy('DAOFactory', {
        from: deployer,
        args: [owner],
        log: true,
    });

    // // DAOStaking
    // await deploy('DAOStaking', {
    //     from: deployer,
    //     args: [owner],
    //     log: true,
    // });
    // const DAOStaking = await deployments.get('DAOStaking');
};

export default func;
func.tags = ['DAOFactory'];
