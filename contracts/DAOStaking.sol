// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import './interfaces/IDAOStaking.sol';
import './libraries/AddressArray.sol';

contract DAOStaking is IDAOStaking {
    using AddressArray for address[];
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        mapping (address=>uint256) rewardDebt;
        address[] tokens;
    }

    struct RewardToken {
        IERC20 token;
        uint256 amount;
        uint256 lastRewardBlock;
        uint256 accPerShare;
    }

    mapping (address=>UserInfo) users;
    mapping (address=>RewardToken) rewardTokens;
    uint256 totalStaking;
    uint256 lastBlock;

    IERC20 public ICPTOKEN;
    address public constant OWNER = 0x7702f02E3251D1eD3AC5396088B512C7C490106e;

    function setICPToken(address _ICP) external override {
        require(msg.sender == OWNER, "ONLY ONWNER CAN SET ICPTOKEN");
        ICPTOKEN = IERC20(_ICP);
    }

    function addTokenList(address[] memory _tokenList) external override {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            users[msg.sender].tokens.setAppend(_tokenList[i]);
        }
    }
    function removeTokenList(address[] memory _tokenList) external override {
        require(users[msg.sender].tokens.length > 0, "ICPDAO: USER TOKENLIST IS ZERO");
        for (uint256 i = 0; i < _tokenList.length; i++) {
            users[msg.sender].tokens.setRemove(_tokenList[i]);
        }
    }
    
    function tokenList() external view override returns (address[] memory tokens) {
        return users[msg.sender].tokens;
    }

    function update(address token) internal {
        RewardToken storage reward = rewardTokens[token];
        if (block.number <= reward.lastRewardBlock) {
            return;
        }
        uint256 currentAmount = IERC20(token).balanceOf(address(this));

        if (reward.lastRewardBlock == 0) {
            reward.token = IERC20(token);
            reward.amount = currentAmount;
        }

        reward.accPerShare += (currentAmount - reward.amount) / totalStaking;
        reward.lastRewardBlock = block.number;
    }

    function deposit(
        uint256 _amount, 
        address[] memory _tokenList
    ) external override {
        require(_amount > 0, "ICPDAO: AMOUNT IS ZERO");
        require(msg.sender != address(this), "ICPDAO: SENDER IS DAO");
        
        this.bonusWithdraw(users[msg.sender].tokens);
        
        this.addTokenList(_tokenList);
        for (uint256 i = 0; i < users[msg.sender].tokens.length; i++) {
            address _token = users[msg.sender].tokens[i];
            users[msg.sender].rewardDebt[_token] += _amount * rewardTokens[_token].accPerShare;
        }
        ICPTOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        users[msg.sender].amount += _amount;
        totalStaking += _amount;
    }

    function bonusWithdrawToken(address _token) external {
        uint256 reward = this.bonusToken(_token);
        IERC20(_token).safeTransferFrom(address(this), msg.sender, reward);
        users[msg.sender].rewardDebt[_token] += reward;
    }

    function bonusWithdraw(address[] memory _tokenList) external override {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            this.bonusWithdrawToken(_tokenList[i]);
        }
    }

    function bonus() external override returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = users[msg.sender].tokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            amounts[i] = this.bonusToken(tokens[i]);
        }
    }

    function bonusToken(address _token) external returns (uint256 reward) {
        update(_token);
        reward = rewardTokens[_token].accPerShare * users[msg.sender].amount - users[msg.sender].rewardDebt[_token];
    }

    function withdraw(uint256 _amount) external override {
        address[] memory tokens = users[msg.sender].tokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            address _token = tokens[i];
            this.bonusWithdrawToken(_token);
            users[msg.sender].rewardDebt[_token] = 0;
        }
        ICPTOKEN.safeTransferFrom(address(this), msg.sender, _amount);
        totalStaking -= _amount;
        users[msg.sender].amount -= _amount;
    }
}