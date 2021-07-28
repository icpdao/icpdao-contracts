//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./interfaces/IIcpdaoStaking.sol";
import "./libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract IcpdaoStaking is IIcpdaoStaking {
  using EnumerableSet for EnumerableSet.AddressSet;

  address private _owner;
  address public icpdaoToken;
  // 用户质押 ICPDAO 的总数量
  uint256 userStakingIcpdaoTotalAmount;

  struct UserStackInfo {
    //  用户质押 ICPDAO 的数量
    uint256 amount;
    // 用户选择的分红列表
    EnumerableSet.AddressSet tokens;
  }
  mapping(address => UserStackInfo) userStackInfo;

  struct UserPoolInfo {
    // 用户不能得到的分红总数
    uint256 rewardDebt;
    // 用户有质押这个 pool
    bool stake;
  }

  // 每种分红 token 的信息
  struct PoolInfo {
    uint256 accTokenPerShare; // 每个 ICPDAO 代币应该得到的分红数量。
    uint256 userStakingIcpdaoAmount; // 选择了这个分红的用户，他们的 icpdao 总质押数量
    // 合约的账号中拥有的 token 中，有多少数量是已经 mint 过的
    uint256 blanceHaveMintAmount;
    // 用户在这个 pool 的信息
    mapping(address => UserPoolInfo) userPoolInfo;
  }

  // token address => pool info
  mapping(address => PoolInfo) poolInfos;

  modifier onlyOwner() {
    require(msg.sender == _owner, "ICPDAO: NOT OWNER");
    _;
  }

  constructor(address owner_) {
    _owner = owner_;
  }

  function setIcpdaoToken(address _icpdaoToken) external override onlyOwner {
    require(icpdaoToken == address(0));
    icpdaoToken = _icpdaoToken;
  }

  function deposit(uint256 _amount, address[] calldata _addTokenList)
    external
    override
  {
    EnumerableSet.AddressSet storage oldTokenList = userStackInfo[msg.sender]
    .tokens;
    if (oldTokenList.length() > 0) {
      for (uint256 index; index <= oldTokenList.length(); index++) {
        _mintAndBonusWithDrawAndRemoveStackWithToken(
          oldTokenList.at(index),
          userStackInfo[msg.sender].amount
        );
      }
      delete userStackInfo[msg.sender].tokens;
    }

    for (uint256 index; index <= _addTokenList.length; index++) {
      address token = _addTokenList[index];
      // 更新挖矿
      _mintWithToken(token);
    }

    // 把用户的 _amount ICPDAO 转入合约
    TransferHelper.safeTransferFrom(
      icpdaoToken,
      msg.sender,
      address(this),
      _amount
    );
    userStackInfo[msg.sender].amount =
      userStackInfo[msg.sender].amount +
      _amount;
    userStakingIcpdaoTotalAmount = userStakingIcpdaoTotalAmount + _amount;

    EnumerableSet.AddressSet storage newTokenList = userStackInfo[msg.sender]
    .tokens;
    for (uint256 index; index <= _addTokenList.length; index++) {
      address token = _addTokenList[index];
      // 更新 pool 中 用户个人数据
      _addUserStackAmountWithToken(token);
      // 增加列表
      newTokenList.add(token);
    }
  }

  function withdraw(uint256 _amount) external override {
    uint256 userAmount = userStackInfo[msg.sender].amount;
    require(_amount <= userAmount);

    EnumerableSet.AddressSet storage userTokenList = userStackInfo[msg.sender]
    .tokens;
    for (uint256 index; index <= userTokenList.length(); index++) {
      address token = userTokenList.at(index);
      _mintAndBonusWithDrawAndRemoveStackWithToken(token, _amount);
    }

    userStackInfo[msg.sender].amount =
      userStackInfo[msg.sender].amount -
      _amount;
    userStakingIcpdaoTotalAmount = userStakingIcpdaoTotalAmount - _amount;

    TransferHelper.safeTransfer(icpdaoToken, msg.sender, _amount);

    if (_amount == userAmount) {
      delete userStackInfo[msg.sender].tokens;
    }
  }

  function addTokenList(address[] calldata _addTokenList) external override {
    for (uint256 index; index <= _addTokenList.length; index++) {
      address token = _addTokenList[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake == false);
    }

    for (uint256 index; index <= _addTokenList.length; index++) {
      address token = _addTokenList[index];
      // 更新挖矿
      _mintWithToken(token);
      _addUserStackAmountWithToken(token);
    }
  }

  function removeTokenList(address[] calldata _removeTokenList)
    external
    override
  {
    for (uint256 index = 0; index < _removeTokenList.length; index++) {
      address token = _removeTokenList[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake);
    }

    EnumerableSet.AddressSet storage userTokenList = userStackInfo[msg.sender]
    .tokens;
    for (uint256 index = 0; index < _removeTokenList.length; index++) {
      address token = _removeTokenList[index];
      _mintAndBonusWithDrawAndRemoveStackWithToken(
        token,
        userStackInfo[msg.sender].amount
      );
      userTokenList.remove(token);
    }
  }

  function tokenList(address user)
    external
    view
    override
    returns (address[] memory)
  {
    return _tokenList(user);
  }

  function bonus(address user)
    external
    view
    override
    returns (
      address[] memory resultTokenList,
      uint256[] memory resultAmountList
    )
  {
    resultTokenList = _tokenList(user);
    resultAmountList = new uint256[](resultTokenList.length);

    for (uint256 index; index <= resultTokenList.length; index++) {
      address token = resultTokenList[index];

      PoolInfo storage pool = poolInfos[token];

      uint256 unMintAmount = _getUnMintAmount(token);

      uint256 mockAccTokenPerShare = pool.accTokenPerShare;
      if (unMintAmount > 0 && pool.userStakingIcpdaoAmount > 0) {
        uint256 preAdd = unMintAmount / pool.userStakingIcpdaoAmount;
        mockAccTokenPerShare = pool.accTokenPerShare + preAdd;
      }

      resultAmountList[index] =
        userStackInfo[user].amount *
        mockAccTokenPerShare -
        pool.userPoolInfo[user].rewardDebt;
    }
  }

  function bonusWithdraw(address[] memory _token_list) external override {
    uint256 userAmount = userStackInfo[msg.sender].amount;
    require(userAmount > 0);

    for (uint256 index = 0; index < _token_list.length; index++) {
      address token = _token_list[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake);
    }

    for (uint256 index; index <= _token_list.length; index++) {
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

  function transferOwnership(address newOwner) external override onlyOwner {
    require(newOwner != address(0));
    _owner = newOwner;
  }

  function _tokenList(address user)
    private
    view
    returns (address[] memory result)
  {
    EnumerableSet.AddressSet storage userTokenList = userStackInfo[user].tokens;
    result = new address[](userTokenList.length());
    for (uint256 index; index < userTokenList.length(); index++) {
      result[index] = userTokenList.at(index);
    }
  }

  function _mintAndBonusWithDrawAndRemoveStackWithToken(
    address token,
    uint256 amount
  ) private {
    // 更新挖矿
    _mintWithToken(token);
    // 结算分红
    _bonusWithdrawWithToken(token);
    // _amount 退出池子
    _removeUserStackAmountWithToken(token, amount);
  }

  function _mintWithToken(address token) private {
    uint256 unMintAmount = _getUnMintAmount(token);

    PoolInfo storage pool = poolInfos[token];
    if (unMintAmount > 0 && pool.userStakingIcpdaoAmount > 0) {
      uint256 preAdd = unMintAmount / pool.userStakingIcpdaoAmount;
      pool.accTokenPerShare = pool.accTokenPerShare + preAdd;
      pool.blanceHaveMintAmount =
        pool.blanceHaveMintAmount +
        preAdd *
        pool.userStakingIcpdaoAmount;
    }
  }

  function _bonusWithdrawWithToken(address token) private {
    uint256 userAmount = userStackInfo[msg.sender].amount;
    if (userAmount > 0) {
      PoolInfo storage pool = poolInfos[token];
      uint256 pending = userAmount *
        pool.accTokenPerShare -
        pool.userPoolInfo[msg.sender].rewardDebt;

      if (pending > 0) {
        TransferHelper.safeTransfer(token, msg.sender, pending);
        pool.blanceHaveMintAmount = pool.blanceHaveMintAmount - pending;
      }
    }
  }

  function _addUserStackAmountWithToken(address token) private {
    uint256 userAmount = userStackInfo[msg.sender].amount;
    require(userAmount > 0);

    PoolInfo storage pool = poolInfos[token];
    require(poolInfos[token].userPoolInfo[msg.sender].stake == false);

    pool.userStakingIcpdaoAmount = pool.userStakingIcpdaoAmount + userAmount;

    pool.userPoolInfo[msg.sender].rewardDebt =
      pool.accTokenPerShare *
      userAmount;

    pool.userPoolInfo[msg.sender].stake = true;
  }

  function _removeUserStackAmountWithToken(address token, uint256 removeAmount)
    private
  {
    require(removeAmount > 0);
    uint256 userAmount = userStackInfo[msg.sender].amount;
    require(removeAmount <= userAmount);

    PoolInfo storage pool = poolInfos[token];

    pool.userStakingIcpdaoAmount = pool.userStakingIcpdaoAmount - removeAmount;
    if (removeAmount == userAmount) {
      delete pool.userPoolInfo[msg.sender];
    }
  }

  function _getUnMintAmount(address token)
    private
    view
    returns (uint256 unMintAmount)
  {
    PoolInfo storage pool = poolInfos[token];
    if (token == icpdaoToken) {
      unMintAmount =
        IERC20(token).balanceOf(address(this)) -
        userStakingIcpdaoTotalAmount -
        pool.blanceHaveMintAmount;
    } else {
      unMintAmount =
        IERC20(token).balanceOf(address(this)) -
        pool.blanceHaveMintAmount;
    }
  }
}
