// What we want to do?
//1. People enter the lottery (pay some amount)
//2. Pick a random winner (verifiably winner)
//3. winner to be selected every x minutes ->completely automated.
// We will need chain oracle to get randomness and to trigger selecting a winner (chainlink keepers)


//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";


error Revert__NotEnoughEth();
error Revert__TransferFailed();
error Revert__NOTOPEN();

contract Lottery is VRFConsumerBaseV2,KeeperCompatibleInterface
{

    enum LotteryState{
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_entranceFee; // immutable since we will not use it anymore
    address payable[] private s_players; // storage since we will need to add and remove a lot
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gaslane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3; 
    uint32 private immutable i_callBackGaslimit;
    uint32 private constant numWords = 1;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;


    address private s_recentWinner;
    LotteryState private s_lotteryState;
 

    /*Events */

    event LotteryEntered(address indexed player);

    event RequestedLotteryWinner(uint256 indexed requestId);

    event WinnerPicked(address indexed winner);
    /*Events */
    constructor(uint256 entranceFee,address vrfCoordinatorV2,bytes32 gasLane,uint64 subscriptionId,uint32 gasLimit,uint256 interval) VRFConsumerBaseV2(vrfCoordinatorV2)
    {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gaslane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callBackGaslimit = gasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }
    function enterLottery() public payable{
        if(s_lotteryState != LotteryState.OPEN)
        {
            revert Revert__NOTOPEN();
        }
        if(msg.value < i_entranceFee)
        {
            revert Revert__NotEnoughEth();
        }
        s_players.push(payable(msg.sender));

        emit LotteryEntered(msg.sender);
    }


    /** 
    * @dev function that the chainlink keeper nodes call, they look for `upkeepNeeded` to return true.
    Should be true inorder to return true:
    1. At least one player we have.
    2. Time interval we specify must have been passed
    3. Subscription is funded with link
    4. Lottery should be in *open* state
    */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = LotteryState.OPEN == s_lotteryState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        return (upkeepNeeded, "0x0"); // can we comment this out?
    }



    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        // require(upkeepNeeded, "Upkeep not needed");
        require(upkeepNeeded);
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gaslane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callBackGaslimit,
            numWords
        );
        // Quiz... is this redundant?
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256 [] memory randomWords) internal override{
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable winner = s_players[indexOfWinner];
        s_recentWinner = winner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable [](0); //reseting the array
        s_lastTimeStamp = block.timestamp;
        (bool success,) = winner.call{value: address(this).balance}("");
        if(!success)
        {
            revert Revert__TransferFailed();
        }
        emit WinnerPicked(winner);
    }


    function getEntranceFee() public view returns(uint256)
    {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address)
    {
        return s_recentWinner;
    }

    function getNumberOfPlayers() public view returns(uint256)
    {
        return s_players.length;
    }
    
    function getLastTimeStamp() public view returns(uint256)
    {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getLotteryState() public view returns(LotteryState)
    {
        return s_lotteryState;
    }
    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}