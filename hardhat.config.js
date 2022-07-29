require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
//require("dotenv").config()


/** @type import('hardhat/config').HardhatUserConfig */


const PRIVATE_KEY = "0x836eb87c2a3df37c5ca9c3c4f5633711bf3de2307d508a0b010fb05e4c1749dc"


module.exports = {
  defaultNetwork: "hardhat",
  networks:{
      hardhat:{
        chainId: 31337,
        blockConfirmations: 1,
      },
      rinkeby:{
        chainId: 4,
        blockConfirmations: 6,
        url:"https://eth-rinkeby.alchemyapi.io/v2/n3uHn2FtpABhSC9iJFNmAE6nuDas_3jz",
        accounts: [PRIVATE_KEY],
        
      }

  },


  solidity: "0.8.7",
  namedAccounts: {
      deployer:{
        default: 0,
      },
      player:{
        default: 1,
      },
  },
  mocha: {
    timeout: 200000
  }
};
