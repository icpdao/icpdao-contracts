import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy, execute} = deployments;

    const {deployer} = await getNamedAccounts();
    const owner = "0x3946d96a4b46657ca95CBE85d8a60b822186Ad1f";

    // IcpdaoStaking
    await deploy('IcpdaoStaking', {
        from: deployer,
        args: [owner],
        log: true,
    });
    const IcpdaoStaking = await deployments.get('IcpdaoStaking');

    // IcpdaoDaoTokenFactory
    await deploy('IcpdaoDaoTokenFactory', {
        from: deployer,
        args: [IcpdaoStaking.address],
        log: true,
    });

};
export default func;
func.tags = ['IcpdaoStaking', 'IcpdaoDaoTokenFactory'];
