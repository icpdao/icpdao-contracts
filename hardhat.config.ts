import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'

import 'hardhat-gas-reporter'
import "hardhat-contract-sizer";

const dotenv = require("dotenv")
dotenv.config()

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
        blockNumber: 12811541
      },
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
    },
    ropsten: {
      url: `https://eth-ropsten.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
      accounts: [process.env.ROPSTEN_DEPLOY_ACCOUNT]
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
      accounts: [process.env.ROPSTEN_DEPLOY_ACCOUNT]
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
      accounts: [process.env.ROPSTEN_DEPLOY_ACCOUNT]
    },
    kovan: {
      url: `https://eth-kovan.alchemyapi.io/v2/${process.env.ALCHEMYAPI_API_KEY}`,
      accounts: [process.env.ROPSTEN_DEPLOY_ACCOUNT]
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMYAPI_API_KEY}`,
      accounts: [process.env.ROPSTEN_DEPLOY_ACCOUNT],
      chainId: 80001
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    // apiKey: process.env.ETHERSCAN_API_KEY,
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  mocha: {
    timeout: 150000
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
}