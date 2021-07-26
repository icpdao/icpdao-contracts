// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

// import "hardhat/console.sol";

import './interfaces/IDAOStaking.sol';


contract DAOStaking is IDAOStaking {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        mapping (address=>uint256) rewardDebt;
        EnumerableSet.AddressSet tokens;
    }

    struct RewardToken {
        IERC20 token;
        uint256 amount;
        uint256 lastRewardBlock;
        uint256 accPerShare;
    }

    mapping (address=>UserInfo) private users;
    mapping (address=>RewardToken) private rewardTokens;
    uint256 totalStaking;
    uint256 lastBlock;

    IERC20 public ICPTOKEN;
    address public ICP;
    address public immutable OWNER;

    uint256 public constant MAX_UINT256 = type(uint256).max;

    constructor () {
        OWNER = msg.sender;
    }

    function setICPToken(address _ICP) external override {
        require(msg.sender == OWNER, "ICPDAO: ONLY ONWNER CAN SET ICPTOKEN");
        require(ICP == address(0), "ICPDAO: ICP ADDRESS EXITST");
        ICP = _ICP;
        ICPTOKEN = IERC20(_ICP);
    }

    function addTokenList(address[] memory _tokenList) external override {
        _addTokenList(msg.sender, _tokenList);
        emit AddTokenList(msg.sender, _tokenList);
    }

    function removeTokenList(address[] memory _tokenList) external override {
        require(users[msg.sender].tokens.length() > 0, "ICPDAO: USER TOKENLIST IS ZERO");
        for (uint256 i = 0; i < _tokenList.length; i++) {
            users[msg.sender].tokens.remove(_tokenList[i]);
        }
        emit RemoveTokenList(msg.sender, _tokenList);
    }
    
    function tokenList(address _user) external view override returns (address[] memory) {
        address[] memory tokens = new address[](users[_user].tokens.length());
        for (uint256 i = 0; i < users[_user].tokens.length(); i++) {
            tokens[i] = users[_user].tokens.at(i);
        }
        return tokens;
    }

    function deposit(
        uint256 _amount, 
        address[] memory _tokenList
    ) external override { 
        require(_amount > 0, "ICPDAO: AMOUNT IS ZERO");
        require(msg.sender != address(this), "ICPDAO: SENDER IS DAO");

        address[] memory tokenList_;

        tokenList_ = this.tokenList(msg.sender);
        _bonusWithdraw(msg.sender, tokenList_);

        _addTokenList(msg.sender, _tokenList);
        tokenList_ = this.tokenList(msg.sender);

        for (uint256 i = 0; i < tokenList_.length; i++) {
            address _token = tokenList_[i];
            users[msg.sender].rewardDebt[_token] += _amount * rewardTokens[_token].accPerShare;
        }

        ICPTOKEN.safeTransferFrom(msg.sender, address(this), _amount);
        users[msg.sender].amount += _amount;
        totalStaking += _amount;
        emit Deposit(msg.sender, _amount);
    }

    function bonusWithdraw(address[] memory _tokenList) external override {
        _bonusWithdraw(msg.sender, _tokenList);
    }

    function bonus(address _user) external override returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = this.tokenList(_user);
        for (uint256 i = 0; i < tokens.length; i++) {
            amounts[i] = _bonusToken(_user, tokens[i]);
        }
    }

    function withdraw(uint256 _amount) external override {
        _withdraw(msg.sender, _amount);
    }

    function _addTokenList(address _user, address[] memory _tokenList) private {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            update(_tokenList[i]);
            users[_user].tokens.add(_tokenList[i]);
        }
    }

    function update(address token) private {
        RewardToken storage reward = rewardTokens[token];
        if (block.number <= reward.lastRewardBlock) {
            return;
        }
        uint256 currentAmount = IERC20(token).balanceOf(address(this));
        
        if (address(reward.token) == address(0)) {
            reward.token = IERC20(token);
            reward.amount = currentAmount;
        }

        // console.log(currentAmount, reward.amount, reward.accPerShare, totalStaking);
        if (totalStaking > 0) reward.accPerShare += (currentAmount - reward.amount) * 1e12 / totalStaking;
        
        reward.amount = currentAmount;
        reward.lastRewardBlock = block.number;
        // console.log(token, reward.amount, reward.accPerShare, reward.lastRewardBlock);
        emit UpdateBonus(token, reward.amount, reward.accPerShare, reward.lastRewardBlock);
    }

    function _bonusWithdrawToken(address _user, address _token) private {
        uint256 reward = _bonusToken(_user, _token);
        IERC20(_token).safeTransfer(_user, reward);
        users[_user].rewardDebt[_token] += reward * 1e12;
        rewardTokens[_token].amount -= reward;
        emit Bonus(_user, _token, reward);
    }

    function _bonusWithdraw(address _user, address[] memory _tokenList) private {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            if (users[_user].tokens.contains(_tokenList[i])) _bonusWithdrawToken(_user, _tokenList[i]);
        }
    }

    function _bonusToken(address _user, address _token) private returns (uint256 reward) {
        update(_token);
        reward = (rewardTokens[_token].accPerShare * users[_user].amount - users[_user].rewardDebt[_token]) / 1e12;
    }

    function _withdraw(address _user, uint256 _amount) private {
        uint256 amount = users[_user].amount;
        _amount = amount <= _amount ? amount : _amount;
        address[] memory tokens = this.tokenList(_user);
        for (uint256 i = 0; i < tokens.length; i++) {
            address _token = tokens[i];
            _bonusWithdrawToken(_user, _token);
            users[_user].rewardDebt[_token] = 0;
        }
        ICPTOKEN.safeTransfer(_user, _amount);
        totalStaking -= _amount;
        users[_user].amount -= _amount;
        emit Withdraw(_user, _amount);
    }
}