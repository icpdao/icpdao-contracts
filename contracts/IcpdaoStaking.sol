//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./interfaces/IIcpdaoStaking.sol";
import "./libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

contract IcpdaoStaking is IIcpdaoStaking {
  using EnumerableSet for EnumerableSet.AddressSet;

  address private _owner;
  address public icpdaoToken;
  // 用户质押 ICPDAO 的总数量
  uint256 public userStakingIcpdaoTotalAmount;

  struct UserStakeInfo {
    //  用户质押 ICPDAO 的数量
    uint256 amount;
    // 用户选择的分红列表
    EnumerableSet.AddressSet tokens;
  }
  mapping(address => UserStakeInfo) private _userStakeInfo;

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

    emit SetIcpdaoToken(_icpdaoToken);
  }

  function deposit(uint256 _amount, address[] calldata _addTokenList)
    external
    override
  {
    require(_amount > 0);
    require(icpdaoToken != address(0), "icpdaoToken cannot address(0)");

    EnumerableSet.AddressSet storage oldTokenList = _userStakeInfo[msg.sender]
    .tokens;
    for (uint256 index = 0; index < _addTokenList.length; index++) {
      address token = _addTokenList[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake == false);
    }

    if (oldTokenList.length() > 0) {
      for (uint256 index = 0; index < oldTokenList.length(); index++) {
        _mintAndBonusWithDrawAndRemoveStackWithToken(
          oldTokenList.at(index),
          _userStakeInfo[msg.sender].amount
        );
      }
    }

    for (uint256 index = 0; index < _addTokenList.length; index++) {
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

    UserStakeInfo storage info = _userStakeInfo[address(msg.sender)];
    info.amount = info.amount + _amount;
    userStakingIcpdaoTotalAmount = userStakingIcpdaoTotalAmount + _amount;

    if (oldTokenList.length() > 0) {
      for (uint256 index = 0; index < oldTokenList.length(); index++) {
        address token = oldTokenList.at(index);
        // 更新 pool 中 用户个人数据
        _addUserStackAmountWithToken(token);
      }
    }

    console.log("oldTokenList", oldTokenList.length());
    for (uint256 index = 0; index < _addTokenList.length; index++) {
      address token = _addTokenList[index];
      // 更新 pool 中 用户个人数据
      _addUserStackAmountWithToken(token);
      // 增加列表
      bool result = oldTokenList.add(token);
      console.log("add", token, result);
    }
    console.log("oldTokenList", _addTokenList.length, oldTokenList.length());

    emit Deposit(msg.sender, _amount, _addTokenList);
  }

  function withdraw(uint256 _amount) external override {
    uint256 userAmount = _userStakeInfo[msg.sender].amount;
    require(_amount <= userAmount);

    EnumerableSet.AddressSet storage userTokenList = _userStakeInfo[msg.sender]
    .tokens;
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

    _userStakeInfo[msg.sender].amount -= _amount;
    userStakingIcpdaoTotalAmount -= _amount;
    TransferHelper.safeTransfer(icpdaoToken, msg.sender, _amount);

    emit Withdraw(msg.sender, _amount);
  }

  function addTokenList(address[] calldata _addTokenList) external override {
    require(_addTokenList.length > 0, "_addTokenList cannot be empty");

    for (uint256 index = 0; index < _addTokenList.length; index++) {
      address token = _addTokenList[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake == false);
    }

    EnumerableSet.AddressSet storage oldTokenList = _userStakeInfo[msg.sender]
    .tokens;
    for (uint256 index = 0; index < _addTokenList.length; index++) {
      address token = _addTokenList[index];
      // 更新挖矿
      _mintWithToken(token);
      _addUserStackAmountWithToken(token);
      oldTokenList.add(token);
    }

    emit AddTokenList(msg.sender, _addTokenList);
  }

  function removeTokenList(address[] calldata _removeTokenList)
    external
    override
  {
    require(_removeTokenList.length > 0, "_removeTokenList cannot be empty");

    for (uint256 index = 0; index < _removeTokenList.length; index++) {
      address token = _removeTokenList[index];
      require(poolInfos[token].userPoolInfo[msg.sender].stake);
    }

    EnumerableSet.AddressSet storage userTokenList = _userStakeInfo[msg.sender]
    .tokens;
    for (uint256 index = 0; index < _removeTokenList.length; index++) {
      address token = _removeTokenList[index];
      _mintAndBonusWithDrawAndRemoveStackWithToken(
        token,
        _userStakeInfo[msg.sender].amount
      );
      userTokenList.remove(token);
    }

    emit RemoveTokenList(msg.sender, _removeTokenList);
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
    console.log("bonus", user);
    resultTokenList = _tokenList(user);
    resultAmountList = new uint256[](resultTokenList.length);

    for (uint256 index = 0; index < resultTokenList.length; index++) {
      address token = resultTokenList[index];

      PoolInfo storage pool = poolInfos[token];

      uint256 unMintAmount = _getUnMintAmount(token);

      uint256 mockAccTokenPerShare = pool.accTokenPerShare;
      if (unMintAmount > 0 && pool.userStakingIcpdaoAmount > 0) {
        uint256 preAdd = unMintAmount / pool.userStakingIcpdaoAmount;
        mockAccTokenPerShare = pool.accTokenPerShare + preAdd;
        console.log("preAdd", preAdd);
      }
      console.log("pool.accTokenPerShare", pool.accTokenPerShare);
      console.log("mockAccTokenPerShare", mockAccTokenPerShare);
      console.log("unMintAmount", unMintAmount);
      console.log("amount", _userStakeInfo[user].amount);
      console.log("rewardDebt", pool.userPoolInfo[user].rewardDebt);
      resultAmountList[index] =
        _userStakeInfo[user].amount *
        mockAccTokenPerShare -
        pool.userPoolInfo[user].rewardDebt;
      console.log("result", resultAmountList[index]);
    }
  }

  function bonusWithdraw(address[] memory _token_list) external override {
    uint256 userAmount = _userStakeInfo[msg.sender].amount;
    require(userAmount > 0, "no stake");

    for (uint256 index = 0; index < _token_list.length; index++) {
      address token = _token_list[index];
      console.log(
        "poolInfos[token].userPoolInfo[msg.sender].stake",
        poolInfos[token].userPoolInfo[msg.sender].stake
      );
      require(
        poolInfos[token].userPoolInfo[msg.sender].stake,
        "_token_list have no stake token"
      );
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

  function transferOwnership(address newOwner) external override onlyOwner {
    require(newOwner != address(0));
    _owner = newOwner;

    emit TransferOwnership(newOwner);
  }

  function userStakeInfo(address user)
    external
    view
    override
    returns (uint256 amount, address[] memory tokens)
  {
    amount = _userStakeInfo[user].amount;
    uint256 length = _userStakeInfo[user].tokens.length();
    tokens = new address[](length);

    for (uint256 index = 0; index < length; index++) {
      tokens[index] = _userStakeInfo[user].tokens.at(index);
    }
  }

  function poolInfo(address token)
    external
    view
    override
    returns (
      uint256 accTokenPerShare,
      uint256 userStakingIcpdaoAmount,
      uint256 blanceHaveMintAmount
    )
  {
    PoolInfo storage info = poolInfos[token];
    accTokenPerShare = info.accTokenPerShare;
    userStakingIcpdaoAmount = info.userStakingIcpdaoAmount;
    blanceHaveMintAmount = info.blanceHaveMintAmount;
    console.log(
      "poolInfo",
      accTokenPerShare,
      userStakingIcpdaoAmount,
      blanceHaveMintAmount
    );
  }

  function _tokenList(address user)
    private
    view
    returns (address[] memory result)
  {
    EnumerableSet.AddressSet storage userTokenList = _userStakeInfo[user]
    .tokens;
    result = new address[](userTokenList.length());
    for (uint256 index = 0; index < userTokenList.length(); index++) {
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

      console.log("_mintWithToken preAdd", preAdd);
      console.log(
        "_mintWithToken pool.accTokenPerShare",
        pool.accTokenPerShare
      );
      console.log("pool.userStakingIcpdaoAmount", pool.userStakingIcpdaoAmount);
      console.log("_mintWithToken unMintAmount", unMintAmount);
      console.log(
        "_mintWithToken blanceHaveMintAmount",
        pool.blanceHaveMintAmount
      );

      emit MintWithToken(
        token,
        msg.sender,
        preAdd * pool.userStakingIcpdaoAmount
      );
    }
  }

  function _bonusWithdrawWithToken(address token) private {
    uint256 userAmount = _userStakeInfo[msg.sender].amount;
    if (userAmount > 0) {
      PoolInfo storage pool = poolInfos[token];
      uint256 pending = userAmount *
        pool.accTokenPerShare -
        pool.userPoolInfo[msg.sender].rewardDebt;

      if (pending > 0) {
        TransferHelper.safeTransfer(token, msg.sender, pending);
        pool.blanceHaveMintAmount = pool.blanceHaveMintAmount - pending;
        pool.userPoolInfo[msg.sender].rewardDebt += pending;
        console.log("pending", pending);
        console.log(
          "pool.userPoolInfo[msg.sender].rewardDebt",
          pool.userPoolInfo[msg.sender].rewardDebt
        );
        console.log("userAmount", userAmount);
        console.log("accTokenPerShare", pool.accTokenPerShare);

        emit BonusWithdrawWithToken(token, msg.sender, pending);
      }
    }
  }

  function _addUserStackAmountWithToken(address token) private {
    uint256 userAmount = _userStakeInfo[msg.sender].amount;
    require(userAmount > 0);

    PoolInfo storage pool = poolInfos[token];
    require(pool.userPoolInfo[msg.sender].stake == false, "repeat stake");

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
    uint256 userAmount = _userStakeInfo[msg.sender].amount;
    require(removeAmount <= userAmount);

    PoolInfo storage pool = poolInfos[token];

    pool.userStakingIcpdaoAmount = pool.userStakingIcpdaoAmount - removeAmount;
    if (removeAmount == userAmount) {
      pool.userPoolInfo[msg.sender].stake = false;
      pool.userPoolInfo[msg.sender].rewardDebt = 0;
    } else {
      pool.userPoolInfo[msg.sender].rewardDebt -=
        removeAmount *
        pool.accTokenPerShare;
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
