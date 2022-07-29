const { network, ethers } = require("hardhat")
const {getNamedAccounts,deployments} = hre
const { developmentChains ,networkConfig } = require("../helper-hardhat-config")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async(hre) =>{
    const {deploy ,log} = deployments
    const {deployer } = await getNamedAccounts() //a way to get name account
    let vrfCordinatorV2Address , subscriptionId
    const chainId = network.config.chainId

    if(developmentChains.includes(network.name))
    {
        const vrfCordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCordinatorV2Address = vrfCordinatorV2Mock.address
        const transactionResponse = await vrfCordinatorV2Mock.createSubscription()
        const transactionReciept = await transactionResponse.wait(1)
        subscriptionId = transactionReciept.events[0].args.subId
        await vrfCordinatorV2Mock.fundSubscription(subscriptionId,VRF_SUB_FUND_AMOUNT)
    }
    else{
        vrfCordinatorV2Address = networkConfig[chainId]["VRFCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gaseLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const Lottery = await deploy("Lottery",{
        from: deployer,
        args:[entranceFee,vrfCordinatorV2Address,gaseLane,subscriptionId,callbackGasLimit,interval],
        log: true,
         waitConfirmations: network.config.blockConfirmations || 1,
    })
}

module.exports.tags = ["All","Lottery"]