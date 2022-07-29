const { network, ethers } = require("hardhat")
const {getNamedAccounts,deployments} = hre
const { developmentChains ,networkConfig } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") //0.25 is the premium cost. It cost 0.25 Link
const GAS_PRICE_LINK = 1e9 //calculated value based on the gas price of the chain . Link/gas

module.exports = async(hre) =>{
    const {deploy ,log} = deployments
    const {deployer } = await getNamedAccounts() //a way to get name account
    const chainId = network.config.chainId

    if(developmentChains.includes(network.name))
    {
        log("Local network  detected! Deploying Mocks")
        //deploy a mock vrf cordinator
        await deploy("VRFCoordinatorV2Mock",{
            from: deployer,
            log: true,
            args: [BASE_FEE,GAS_PRICE_LINK]
        })
        log("Mock Deployed!")
        log("---------------------------------")
    }
}

module.exports.tags = ["All","Mocks"]