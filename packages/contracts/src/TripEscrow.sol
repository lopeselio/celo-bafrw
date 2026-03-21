// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TripEscrow
 * @dev Handles group deposits and allows an AI Agent (SplitBot) to autonomously
 * disperse USDC to group members based on off-chain conversational logic.
 */
contract TripEscrow is Ownable, Pausable {
    IERC20 public stablecoin;
    address public splitBotAgent; // The ERC-8004 Agent's Wallet Identity
    
    mapping(address => uint256) public deposits;
    uint256 public totalPool;

    // A daily cap to prevent total drainage if the Agent's private key leaks (e.g. 500 USDC)
    uint256 public constant MAX_DAILY_SETTLE = 500 * 10**18; 
    mapping(uint256 => uint256) public dailySettleAmount;

    event Deposited(address indexed user, uint256 amount);
    event Settled(address indexed to, uint256 amount, string description);
    event AgentUpdated(address oldAgent, address newAgent);
    event Refunded(address indexed user, uint256 amount);
    event Slashed(address indexed user, uint256 amount, string reason);

    constructor(address _stablecoinAddress, address _agentWallet) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoinAddress);
        splitBotAgent = _agentWallet;
    }

    modifier onlyAgentOrOwner() {
        require(msg.sender == splitBotAgent || msg.sender == owner(), "Not authorized Agent/Owner");
        _;
    }

    function deposit(uint256 amount) external whenNotPaused {
        require(stablecoin.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        deposits[msg.sender] += amount;
        totalPool += amount;
        emit Deposited(msg.sender, amount);
    }

    function settleExpense(address payee, uint256 amount, string calldata description) external onlyAgentOrOwner whenNotPaused {
        require(totalPool >= amount, "Insufficient funds in the Trip Escrow pool");
        
        uint256 today = block.timestamp / 1 days;
        require(dailySettleAmount[today] + amount <= MAX_DAILY_SETTLE, "Daily Agent settle cap exceeded");
        dailySettleAmount[today] += amount;

        totalPool -= amount;
        require(stablecoin.transfer(payee, amount), "USDC reimburse transfer failed");
        
        emit Settled(payee, amount, description);
    }

    function refundUser(address user, uint256 amount) external onlyAgentOrOwner {
        require(deposits[user] >= amount, "User does not have enough deposit left");
        deposits[user] -= amount;
        totalPool -= amount;
        
        require(stablecoin.transfer(user, amount), "Refund transfer failed");
        emit Refunded(user, amount);
    }

    /**
     * Agent calls this to "slash" a user's deposit if they default on a group expense.
     * The slashed amount stays in the totalPool to be redistributed to the victims.
     */
    function slashUser(address user, uint256 amount, string calldata reason) external onlyAgentOrOwner {
        require(deposits[user] >= amount, "User has insufficient deposit to slash");
        deposits[user] -= amount;
        emit Slashed(user, amount, reason);
    }

    function updateAgent(address newAgent) external onlyOwner {
        emit AgentUpdated(splitBotAgent, newAgent);
        splitBotAgent = newAgent;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
