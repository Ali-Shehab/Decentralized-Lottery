const { assert,expect} = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains,networkConfig  } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) ? describe.skip : describe("Lottery",async function ()
{
    let lottery,vrfCordinatorV2Mock,lotteryEntranceFee,deployer,interval
    beforeEach(async function(){
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["All"])
        lottery = await ethers.getContract("Lottery",deployer)
        vrfCordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock",deployer)
        lotteryEntranceFee = await lottery.getEntranceFee()
        interval = await lottery.getInterval()
    })

    describe("constructor" , function()
    {
        it("intializes the lottery correctly", async function()
        {
            const lotteryState = await lottery.getLotteryState()
            assert.equal(lotteryState.toString(),"0")
            assert.equal(
                interval.toString(),
                networkConfig[network.config.chainId]["interval"]
            )
        })
    })
    describe("enterLottery", function () {
        it("reverts when you don't pay enough", async () => {
            await expect(lottery.enterLottery()).to.be.revertedWith( 
                "Revert__NotEnoughEth"
            )
        })
        it("records player when they enter", async () => {
            await lottery.enterLottery({ value: lotteryEntranceFee })
            const contractPlayer = await lottery.getPlayers(0)
            assert.equal(deployer, contractPlayer)
        })
        it("emits event on enter", async () => {
            await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
                lottery,
                "LotteryEntered"
            )
        })
    })
    describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async () => {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x") 
            assert(!upkeepNeeded)
        })
        it("returns false if lottery isn't open", async () => {
            await lottery.enterLottery({ value: lotteryEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            await lottery.performUpkeep("0x") 
            const lotteryState = await lottery.getLotteryState()
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
      
            console.log(lotteryState1)
            assert.equal(lotteryState.toString() == "1", upkeepNeeded == false)
        })
    })
    describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
            await lottery.enterLottery({ value: lotteryEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const tx = await lottery.performUpkeep("0x") 
            assert(tx)
        })
        
        it("updates the raffle state and emits a requestId", async () => {
            // Too many asserts in this test!
            await lottery.enterRaffle({ value: raffleEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const txResponse = await lottery.performUpkeep("0x") 
            const txReceipt = await txResponse.wait(1) 
            const lotteryState = await lottery.getLotteryState()
            const requestId = txReceipt.events[1].args.requestId
            assert(requestId.toNumber() > 0)
            assert(lotteryState == 1) 
        })
    })
    describe("fulfillRandomWords", function (){
        beforeEach(async () => {
            await lottery.enterLottery({ value: lotteryEntranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
        })
        it("can only be called after performupkeep", async () => {
            await expect(
                vrfCordinatorV2Mock.fulfillRandomWords(0, lottery.address) 
            ).to.be.revertedWith("nonexistent request")
            await expect(
                vrfCordinatorV2Mock.fulfillRandomWords(1, lottery.address) 
            ).to.be.revertedWith("nonexistent request")
        })
        it("picks a winner, resets, and sends money", async () => {
            const additionalEntrances = 3 // to test
            const startingIndex = 2
            const accounts  = await ethers.getSigners()
            for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) { // i = 2; i < 5; i=i+1
                const accountConnectedLottery = lottery.connect(accounts[i])
                await accountConnectedLottery.enterLottery({value: lotteryEntranceFee})
            }
            const startingTimeStamp = await lottery.getLastTimeStamp()

           
            await new Promise(async (resolve, reject) => {
                lottery.once("WinnerPicked", async () => { // event listener for WinnerPicked
                    try {
                        console.log("he")
                        // Now lets get the ending values...
                        const recentWinner = await lottery.getRecentWinner()
                        const lotteryState = await lottery.getLotteryState()
                        const winnerBalance = await accounts[2].getBalance()
                        const endingTimeStamp = await lottery.getLastTimeStamp()
                        await expect(lottery.getPlayers(0)).to.be.reverted
                        // Comparisons to check if our ending values are correct:
                        assert.equal(recentWinner.toString(), accounts[2].address)
                        assert.equal(lotteryState, "0")
                        assert.equal(
                            winnerBalance.toString(), 
                            startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                .add(
                                    lotteryEntranceFee
                                        .mul(additionalEntrances)
                                        .add(lotteryEntranceFee)
                                )
                                .toString()
                        )
                        assert(endingTimeStamp > startingTimeStamp)
                        resolve() // if try passes, resolves the promise 
                    } catch (e) { 
                        reject(e) // if try fails, rejects the promise
                    }
                })
                const tx = await lottery.performUpkeep("0x")
                const txReceipt = await tx.wait(1)
                const startingBalance = await accounts[2].getBalance()
                await vrfCordinatorV2Mock.fulfillRandomWords(
                    txReceipt.events[1].args.requestId,
                    lottery.address
                )
            })
        })
    })
})