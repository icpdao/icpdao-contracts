// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import '@openzeppelin/contracts/utils/Context.sol';
// import "hardhat/console.sol";

import './interfaces/IDAOStaking.sol';


contract DAOStaking is Context, IDAOStaking {
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

    mapping (address=>UserInfo) private _users;
    mapping (address=>RewardToken) private _rewardTokens;

    function userInfo(address _user) external view override returns (
        uint256 amount,
        address[] memory tokens
    ) {
        amount = _users[_user].amount;
        tokens = this.tokenList(_user);
    }

    function userRewardDebt(
        address _user, address _token
    ) external view override returns (uint256 rewardDebt) {
        rewardDebt = _users[_user].rewardDebt[_token];
    }

    function rewardToken(address _token) external view override returns (
        uint256 amount,
        uint256 lastRewardBlock,
        uint256 accPerShare
    ) {
        amount = _rewardTokens[_token].amount;
        lastRewardBlock = _rewardTokens[_token].lastRewardBlock;
        accPerShare = _rewardTokens[_token].accPerShare;
    }

    uint256 public override totalStaking;
    address public override ICPD;
    address payable private immutable _owner;

    IERC20 private _ICPDTOKEN;

    uint256 public constant MAX_UINT256 = type(uint256).max;

    constructor (address payable _ownerAddress) {
        _owner = _ownerAddress;
    }

    function setICPToken(address _ICPD) external override {
        require(_msgSender() == _owner, "ICPDAO: ONLY ONWNER CAN SET ICPTOKEN");
        require(ICPD == address(0), "ICPDAO: ICP ADDRESS EXITST");
        ICPD = _ICPD;
        _ICPDTOKEN = IERC20(_ICPD);
    }

    function destruct() external override {
        require(_owner == _msgSender(), "ICPDAO: ONLY OWNER CAN CALL DESTRUCT");
        selfdestruct(_owner);
    }

    function addTokenList(address[] memory _tokenList) external override {
        _addTokenList(_msgSender(), _tokenList);
        emit AddTokenList(_msgSender(), _tokenList);
    }

    function removeTokenList(address[] memory _tokenList) external override {
        require(_users[_msgSender()].tokens.length() > 0, "ICPDAO: USER TOKENLIST IS ZERO");
        for (uint256 i = 0; i < _tokenList.length; i++) {
            _users[_msgSender()].tokens.remove(_tokenList[i]);
        }
        emit RemoveTokenList(_msgSender(), _tokenList);
    }
    
    function tokenList(address _user) external view override returns (address[] memory) {
        address[] memory tokens = new address[](_users[_user].tokens.length());
        for (uint256 i = 0; i < _users[_user].tokens.length(); i++) {
            tokens[i] = _users[_user].tokens.at(i);
        }
        return tokens;
    }

    function deposit(
        uint256 _amount, 
        address[] memory _tokenList
    ) external override { 
        require(_amount > 0, "ICPDAO: AMOUNT IS ZERO");
        require(_msgSender() != address(this), "ICPDAO: SENDER IS DAO");

        address[] memory tokenList_;

        tokenList_ = this.tokenList(_msgSender());
        _bonusWithdraw(_msgSender(), tokenList_);

        _addTokenList(_msgSender(), _tokenList);
        tokenList_ = this.tokenList(_msgSender());

        for (uint256 i = 0; i < tokenList_.length; i++) {
            address _token = tokenList_[i];
            _users[_msgSender()].rewardDebt[_token] += _amount * _rewardTokens[_token].accPerShare;
        }

        _ICPDTOKEN.safeTransferFrom(_msgSender(), address(this), _amount);
        _users[_msgSender()].amount += _amount;
        totalStaking += _amount;
        emit Deposit(_msgSender(), _amount);
    }

    function bonusWithdraw(address[] memory _tokenList) external override {
        _bonusWithdraw(_msgSender(), _tokenList);
    }

    function bonus(address _user) external override returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = this.tokenList(_user);
        for (uint256 i = 0; i < tokens.length; i++) {
            amounts[i] = _bonusToken(_user, tokens[i]);
        }
    }

    function withdraw(uint256 _amount) external override {
        _withdraw(_msgSender(), _amount);
    }

    function _addTokenList(address _user, address[] memory _tokenList) private {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            update(_tokenList[i]);
            _users[_user].tokens.add(_tokenList[i]);
        }
    }

    function update(address token) private {
        RewardToken storage reward = _rewardTokens[token];
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
        _users[_user].rewardDebt[_token] += reward * 1e12;
        _rewardTokens[_token].amount -= reward;
        emit Bonus(_user, _token, reward);
    }

    function _bonusWithdraw(address _user, address[] memory _tokenList) private {
        for (uint256 i = 0; i < _tokenList.length; i++) {
            if (_users[_user].tokens.contains(_tokenList[i])) _bonusWithdrawToken(_user, _tokenList[i]);
        }
    }

    function _bonusToken(address _user, address _token) private returns (uint256 reward) {
        update(_token);
        reward = (_rewardTokens[_token].accPerShare * _users[_user].amount - _users[_user].rewardDebt[_token]) / 1e12;
    }

    function _withdraw(address _user, uint256 _amount) private {
        uint256 amount = _users[_user].amount;
        _amount = amount <= _amount ? amount : _amount;
        address[] memory tokens = this.tokenList(_user);
        for (uint256 i = 0; i < tokens.length; i++) {
            address _token = tokens[i];
            _bonusWithdrawToken(_user, _token);
            _users[_user].rewardDebt[_token] = 0;
        }
        _ICPDTOKEN.safeTransfer(_user, _amount);
        totalStaking -= _amount;
        _users[_user].amount -= _amount;
        emit Withdraw(_user, _amount);
    }
}