//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

import './interfaces/IDAOStaking.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import 'hardhat/console.sol';

contract DAOStaking is Context, IDAOStaking {
    using EnumerableSet for EnumerableSet.AddressSet;

    address payable private _owner;
    address public override ICPD;
    // 用户质押 ICPDAO 的总数量
    uint256 public override totalStaking;

    struct UserInfo {
        //  用户质押 ICPDAO 的数量
        uint256 amount;
        // token => number 用户不能得到的分红总数
        mapping(address => uint256) rewardDebt;
        // 用户选择的分红列表
        EnumerableSet.AddressSet tokens;
    }
    mapping(address => UserInfo) private _users;

    // 每种分红 token 的信息
    struct PoolInfo {
        uint256 accPerShare; // 每个 ICPDAO 代币应该得到的分红数量 * 1e12
        uint256 userStakingIcpdAmount; // 选择了这个分红的用户，他们的 icpdao 总质押数量
        // 合约的账号中拥有的 token 中，有多少数量是已经 mint 过的
        uint256 blanceHaveMintAmount;
    }

    // token address => pool info
    mapping(address => PoolInfo) _poolInfos;

    modifier onlyOwner() {
        require(msg.sender == _owner, 'ICPDAO: NOT OWNER');
        _;
    }

    constructor(address payable owner_) {
        _owner = owner_;
    }

    function setICPToken(address _ICPD) external override onlyOwner {
        require(_ICPD != address(0), 'ICPDAO: _ICPD INVALID');
        require(ICPD == address(0), 'ICPDAO: ICPD ADDRESS EXITST');
        ICPD = _ICPD;
    }

    function destruct() external override {
        require(_owner == _msgSender(), 'ICPDAO: ONLY OWNER CAN CALL DESTRUCT');
        selfdestruct(payable(_owner));
    }

    function userInfo(address _user) external view override returns (uint256 amount, address[] memory tokens) {
        amount = _users[_user].amount;
        tokens = this.tokenList(_user);
    }

    function userRewardDebt(address _user, address _token) external view override returns (uint256 rewardDebt) {
        rewardDebt = _users[_user].rewardDebt[_token];
    }

    function poolInfo(address _token)
        external
        view
        override
        returns (
            uint256 accPerShare,
            uint256 userStakingIcpdAmount,
            uint256 blanceHaveMintAmount
        )
    {
        accPerShare = _poolInfos[_token].accPerShare;
        userStakingIcpdAmount = _poolInfos[_token].userStakingIcpdAmount;
        blanceHaveMintAmount = _poolInfos[_token].blanceHaveMintAmount;
    }

    function deposit(uint256 _amount, address[] calldata _addTokenList) external override {
        require(_amount > 0, 'ICPDAO: AMOUNT IS ZERO');
        require(_msgSender() != address(this), 'ICPDAO: SENDER IS DAO');
        require(ICPD != address(0), 'ICPDAO: ICPD CANNOT address(0)');

        EnumerableSet.AddressSet storage oldTokenList = _users[msg.sender].tokens;
        for (uint256 index = 0; index < _addTokenList.length; index++) {
            address token = _addTokenList[index];
            require(!oldTokenList.contains(token), 'ICPDAO: _addTokenList HAVE TOKEN CONTAINS oldTokenList');
        }

        if (oldTokenList.length() > 0) {
            for (uint256 index = 0; index < oldTokenList.length(); index++) {
                _mintAndBonusWithDrawAndRemoveStackWithToken(oldTokenList.at(index), _users[msg.sender].amount);
            }
        }

        for (uint256 index = 0; index < _addTokenList.length; index++) {
            address token = _addTokenList[index];
            // 更新挖矿
            _mintWithToken(token);
        }

        // 把用户的 _amount ICPDAO 转入合约
        // TransferHelper.safeTransferFrom(icpdaoToken, msg.sender, address(this), _amount);
        SafeERC20.safeTransferFrom(IERC20(ICPD), _msgSender(), address(this), _amount);
        _users[_msgSender()].amount += _amount;
        totalStaking += _amount;

        if (oldTokenList.length() > 0) {
            for (uint256 index = 0; index < oldTokenList.length(); index++) {
                address token = oldTokenList.at(index);
                // 更新 pool 中 用户个人数据
                _addUserStackAmountWithToken(token);
            }
        }

        console.log('oldTokenList', oldTokenList.length());
        for (uint256 index = 0; index < _addTokenList.length; index++) {
            address token = _addTokenList[index];
            // 更新 pool 中 用户个人数据
            _addUserStackAmountWithToken(token);
            // 增加列表
            bool result = oldTokenList.add(token);
            console.log('add', token, result);
        }
        console.log('oldTokenList', _addTokenList.length, oldTokenList.length());
    }

    function withdraw(uint256 _amount) external override {
        uint256 userAmount = _users[msg.sender].amount;
        require(_amount <= userAmount);

        EnumerableSet.AddressSet storage userTokenList = _users[msg.sender].tokens;
        address[] memory _tmpTokenList = new address[](userTokenList.length());
        for (uint256 index = 0; index < userTokenList.length(); index++) {
            _tmpTokenList[index] = userTokenList.at(index);
        }

        for (uint256 index = 0; index < _tmpTokenList.length; index++) {
            address token = _tmpTokenList[index];
            _mintAndBonusWithDrawAndRemoveStackWithToken(token, _amount);
            if (_amount == userAmount) {
                userTokenList.remove(token);
            }
        }

        _users[msg.sender].amount -= _amount;
        totalStaking -= _amount;
        // TransferHelper.safeTransfer(icpdaoToken, msg.sender, _amount);
        SafeERC20.safeTransfer(IERC20(ICPD), _msgSender(), _amount);

        emit Withdraw(msg.sender, _amount);
    }

    function addTokenList(address[] calldata _addTokenList) external override {
        require(_addTokenList.length > 0, '_addTokenList cannot be empty');
        uint256 userAmount = _users[msg.sender].amount;
        require(userAmount > 0, 'addTokenList need userAmount > 0');

        EnumerableSet.AddressSet storage oldTokenList = _users[msg.sender].tokens;

        for (uint256 index = 0; index < _addTokenList.length; index++) {
            address token = _addTokenList[index];
            require(!oldTokenList.contains(token), 'ICPDAO: _addTokenList HAVE TOKEN CONTAINS oldTokenList');
        }

        for (uint256 index = 0; index < _addTokenList.length; index++) {
            address token = _addTokenList[index];
            // 更新挖矿
            _mintWithToken(token);
            _addUserStackAmountWithToken(token);
            oldTokenList.add(token);
        }

        emit AddTokenList(msg.sender, _addTokenList);
    }

    function removeTokenList(address[] calldata _removeTokenList) external override {
        require(_removeTokenList.length > 0, '_removeTokenList cannot be empty');

        EnumerableSet.AddressSet storage oldTokenList = _users[msg.sender].tokens;

        for (uint256 index = 0; index < _removeTokenList.length; index++) {
            address token = _removeTokenList[index];
            require(oldTokenList.contains(token), 'ICPDAO: _removeTokenList HAVE TOKEN NOT CONTAINS oldTokenList');
        }

        for (uint256 index = 0; index < _removeTokenList.length; index++) {
            address token = _removeTokenList[index];
            _mintAndBonusWithDrawAndRemoveStackWithToken(token, _users[msg.sender].amount);
            oldTokenList.remove(token);
        }

        emit RemoveTokenList(msg.sender, _removeTokenList);
    }

    function tokenList(address user) external view override returns (address[] memory) {
        return _tokenList(user);
    }

    function bonus(address user) external view override returns (address[] memory tokens, uint256[] memory amounts) {
        console.log('bonus', user);
        tokens = _tokenList(user);
        amounts = new uint256[](tokens.length);

        for (uint256 index = 0; index < tokens.length; index++) {
            address token = tokens[index];

            PoolInfo storage pool = _poolInfos[token];

            uint256 unMintAmount = _getUnMintAmount(token);

            uint256 mockAccTokenPerShare = pool.accPerShare;
            if (unMintAmount > 0 && pool.userStakingIcpdAmount > 0) {
                uint256 addMockAccTokenPerShare = (unMintAmount * 1e12) / pool.userStakingIcpdAmount;
                mockAccTokenPerShare = pool.accPerShare + addMockAccTokenPerShare;
                console.log('addMockAccTokenPerShare', addMockAccTokenPerShare);
            }
            console.log('pool.accTokenPerShare', pool.accPerShare);
            console.log('mockAccTokenPerShare', mockAccTokenPerShare);
            console.log('unMintAmount', unMintAmount);
            console.log('amount', _users[user].amount);
            console.log('rewardDebt', _users[user].rewardDebt[token]);
            amounts[index] = (_users[user].amount * mockAccTokenPerShare) / 1e12 - _users[user].rewardDebt[token];
            console.log('result', amounts[index]);
        }
    }

    function bonusWithdraw(address[] memory _token_list) external override {
        uint256 userAmount = _users[msg.sender].amount;
        require(userAmount > 0, 'ICPDAO: YOU NO HAVE STAKE');

        EnumerableSet.AddressSet storage _userTokenList = _users[msg.sender].tokens;

        for (uint256 index = 0; index < _token_list.length; index++) {
            address token = _token_list[index];
            require(_userTokenList.contains(token), 'ICPDAO: _token_list HAVE NO STAKE TOKEN');
        }

        for (uint256 index = 0; index < _token_list.length; index++) {
            address token = _token_list[index];
            // 更新挖矿
            _mintWithToken(token);
            // 结算手续费
            _bonusWithdrawWithToken(token);
        }
    }

    function owner() external view override returns (address result) {
        result = _owner;
    }

    function transferOwnership(address payable newOwner) external override onlyOwner {
        require(newOwner != address(0));
        _owner = newOwner;

        emit TransferOwnership(newOwner);
    }

    function _tokenList(address user) private view returns (address[] memory result) {
        EnumerableSet.AddressSet storage userTokenList = _users[user].tokens;
        result = new address[](userTokenList.length());
        for (uint256 index = 0; index < userTokenList.length(); index++) {
            result[index] = userTokenList.at(index);
        }
    }

    function _mintAndBonusWithDrawAndRemoveStackWithToken(address token, uint256 amount) private {
        // 更新挖矿
        _mintWithToken(token);
        // 结算分红
        _bonusWithdrawWithToken(token);
        // _amount 退出池子
        _removeUserStackAmountWithToken(token, amount);
    }

    function _mintWithToken(address token) private {
        uint256 unMintAmount = _getUnMintAmount(token);

        PoolInfo storage pool = _poolInfos[token];
        if (unMintAmount > 0 && pool.userStakingIcpdAmount > 0) {
            uint256 addAccPerShare = (unMintAmount * 1e12) / pool.userStakingIcpdAmount;
            pool.accPerShare += addAccPerShare;
            pool.blanceHaveMintAmount += (addAccPerShare * pool.userStakingIcpdAmount) / 1e12;

            console.log('_mintWithToken addAccPerShare', addAccPerShare);
            console.log('_mintWithToken pool.accPerShare', pool.accPerShare);
            console.log('pool.userStakingIcpdAmount', pool.userStakingIcpdAmount);
            console.log('_mintWithToken unMintAmount', unMintAmount);
            console.log('_mintWithToken blanceHaveMintAmount', pool.blanceHaveMintAmount);
        }
    }

    function _bonusWithdrawWithToken(address token) private {
        uint256 userAmount = _users[msg.sender].amount;
        if (userAmount > 0) {
            PoolInfo storage pool = _poolInfos[token];
            uint256 pending = (userAmount * pool.accPerShare) / 1e12 - _users[msg.sender].rewardDebt[token];

            if (pending > 0) {
                // TransferHelper.safeTransfer(token, msg.sender, pending);
                SafeERC20.safeTransfer(IERC20(token), msg.sender, pending);
                pool.blanceHaveMintAmount = pool.blanceHaveMintAmount - pending;
                // pool.userPoolInfo[msg.sender].rewardDebt += pending;
                _users[msg.sender].rewardDebt[token] += pending;
                console.log('pending', pending);
                console.log('_users[msg.sender].rewardDebt[token]', _users[msg.sender].rewardDebt[token]);
                console.log('userAmount', userAmount);
                console.log('accTokenPerShare', pool.accPerShare);
            }
        }
    }

    function _addUserStackAmountWithToken(address token) private {
        uint256 userAmount = _users[msg.sender].amount;
        require(userAmount > 0, '_addUserStackAmountWithToken need userAmount > 0');

        PoolInfo storage pool = _poolInfos[token];
        pool.userStakingIcpdAmount += userAmount;
        _users[msg.sender].rewardDebt[token] = (pool.accPerShare * userAmount) / 1e12;
    }

    function _removeUserStackAmountWithToken(address token, uint256 removeAmount) private {
        require(removeAmount > 0, 'ICPDAO: _removeUserStackAmountWithToken removeAmount need > 0');
        uint256 userAmount = _users[msg.sender].amount;
        require(removeAmount <= userAmount, 'ICPDAO: _removeUserStackAmountWithToken need removeAmount <= userAmount');

        PoolInfo storage pool = _poolInfos[token];
        pool.userStakingIcpdAmount -= removeAmount;

        if (removeAmount == userAmount) {
            _users[msg.sender].rewardDebt[token] = 0;
        } else {
            _users[msg.sender].rewardDebt[token] -= (removeAmount * pool.accPerShare) / 1e12;
        }
    }

    function _getUnMintAmount(address token) private view returns (uint256 unMintAmount) {
        PoolInfo storage pool = _poolInfos[token];
        if (token == ICPD) {
            unMintAmount = IERC20(token).balanceOf(address(this)) - totalStaking - pool.blanceHaveMintAmount;
        } else {
            unMintAmount = IERC20(token).balanceOf(address(this)) - pool.blanceHaveMintAmount;
        }
    }
}
