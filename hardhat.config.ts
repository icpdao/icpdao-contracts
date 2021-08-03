import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'

// // This is a sample Hardhat task. To learn how to create your own go to
// // https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
//   const accounts = await hre.ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [{
      version: "0.8.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        }
      }
    }]
  },
  mocha: {
    timeout: 40000
  },
  typechain: {
    outDir: 'src/types',
    target: 'ethers-v5'
  },
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: 'VCSGXU48FJ5GJ5D6SVPDC44J8ZQ3YVI63W'
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/IsvyJHT2uPB-J5CkSDaTQsxJsrM4KVAv",
        blockNumber: 12811541
      }
    },
    ropsten: {
      url: `https://eth-ropsten.alchemyapi.io/v2/IsvyJHT2uPB-J5CkSDaTQsxJsrM4KVAv`,
      accounts: ['0x189a98f135f1a692d6d9925a10173e6e36c301c43a7825ace2ec07fb32ffe809']
    }
  },
};
