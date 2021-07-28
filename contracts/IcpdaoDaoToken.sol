//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

import "./interfaces/UniswapV3/INonfungiblePositionManager.sol";
import "./interfaces/UniswapV3/IUniswapV3Pool.sol";

import "hardhat/console.sol";

import "./interfaces/IIcpdaoDaoToken.sol";
import "./libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract IcpdaoDaoToken is ERC20, IIcpdaoDaoToken {
  using EnumerableSet for EnumerableSet.AddressSet;

  EnumerableSet.AddressSet managers;

  address private _owner;

  uint256 public lpRatio;

  address public stakingAddress;

  // TODO 挖矿公式数据上限导致代币溢出，所以参数的数据类型不能太大
  IIcpdaoDaoToken.MiningArg public miningArg;

  address public lpPool;

  address public lpToken0;
  address public lpToken1;

  address private _nonfungiblePositionManagerAddress =
    0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
  INonfungiblePositionManager private _nonfungiblePositionManager =
    INonfungiblePositionManager(_nonfungiblePositionManagerAddress);

  mapping(uint24 => int24) tickLowerMap;
  mapping(uint24 => int24) tickUpperMap;

  uint256 public mintLastTimestamp;
  uint256 public mintLastN;

  modifier onlyOwner() {
    require(_msgSender() == _owner, "ICPDAO: NOT OWNER");
    _;
  }

  modifier onlyOwnerOrManager() {
    require(
      managers.contains(_msgSender()) || _msgSender() == _owner,
      "NOT OWNER OR MANAGER"
    );
    _;
  }

  constructor(
    address[] memory genesisTokenAddressList_,
    uint256[] memory genesisTokenAmountList_,
    uint256 lpRatio_,
    address stakingAddress_,
    address ownerAddress_,
    IIcpdaoDaoToken.MiningArg memory miningArg_,
    string memory erc20Name_,
    string memory erc20Symbol_
  ) ERC20(erc20Name_, erc20Symbol_) {
    require(genesisTokenAddressList_.length == genesisTokenAmountList_.length);

    tickLowerMap[500] = -887270;
    tickLowerMap[3000] = -887220;
    tickLowerMap[10000] = -887200;

    tickUpperMap[500] = -tickLowerMap[500];
    tickUpperMap[3000] = -tickLowerMap[3000];
    tickUpperMap[10000] = -tickLowerMap[10000];

    lpRatio = lpRatio_;
    stakingAddress = stakingAddress_;
    _owner = ownerAddress_;

    miningArg = miningArg_;

    mintLastTimestamp = (block.timestamp / 86400) * 86400;
    mintLastN = 0;

    // 分配创世
    uint256 genesisTotalAmount = 0;
    for (uint256 index; index < genesisTokenAddressList_.length; index++) {
      _mint(genesisTokenAddressList_[index], genesisTokenAmountList_[index]);
      genesisTotalAmount = genesisTotalAmount + genesisTokenAmountList_[index];
    }
    _mint(address(this), (genesisTotalAmount / 100) * lpRatio);
  }

  receive() external payable {}

  function createLPPool(
    uint256 _baseTokenAmount,
    address _quoteTokenAddress,
    uint256 _quoteTokenAmount,
    uint24 fee,
    uint160 sqrtPriceX96,
    int24 tickLower,
    int24 tickUpper
  ) external payable override onlyOwnerOrManager {
    require(_quoteTokenAddress != address(this));
    require(_quoteTokenAddress != address(0));
    require(_baseTokenAmount != 0);
    require(_quoteTokenAmount != 0);

    TransferHelper.safeApprove(
      address(this),
      _nonfungiblePositionManagerAddress,
      type(uint256).max
    );

    if (_quoteTokenAddress != _nonfungiblePositionManager.WETH9()) {
      TransferHelper.safeApprove(
        _quoteTokenAddress,
        _nonfungiblePositionManagerAddress,
        type(uint256).max
      );

      TransferHelper.safeTransferFrom(
        _quoteTokenAddress,
        msg.sender,
        address(this),
        _quoteTokenAmount
      );
    }

    INonfungiblePositionManager.MintParams memory params = buildMintParams(
      _baseTokenAmount,
      _quoteTokenAddress,
      _quoteTokenAmount,
      fee,
      tickLower,
      tickUpper
    );

    lpToken0 = params.token0;
    lpToken1 = params.token1;

    lpPool = _nonfungiblePositionManager.createAndInitializePoolIfNecessary(
      params.token0,
      params.token1,
      fee,
      sqrtPriceX96
    );

    _nonfungiblePositionManager.mint{ value: msg.value }(params);

    if (_quoteTokenAddress == _nonfungiblePositionManager.WETH9()) {
      _nonfungiblePositionManager.refundETH();
      if (address(this).balance > 0) {
        TransferHelper.safeTransferETH(msg.sender, address(this).balance);
      }
    } else {
      if (ERC20(_quoteTokenAddress).balanceOf(address(this)) > 0) {
        TransferHelper.safeTransfer(
          _quoteTokenAddress,
          msg.sender,
          ERC20(_quoteTokenAddress).balanceOf(address(this))
        );
      }
    }
  }

  function updateLPPool(uint256 _baseTokenAmount)
    external
    override
    onlyOwnerOrManager
  {
    require(lpPool != address(0));
    require(_baseTokenAmount <= balanceOf(address(this)));

    (
      address quoteTokenAddress,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper
    ) = getNearestSingleMintParams();

    INonfungiblePositionManager.MintParams memory params = buildMintParams(
      _baseTokenAmount,
      quoteTokenAddress,
      0,
      fee,
      tickLower,
      tickUpper
    );

    // TODO 目前的实现并不能精确的把 _baseTokenAmount 完全放入进去
    // 原因如下
    // 即使是单币放入 pool.mint 方法也会 根据 tickLower 和 tickUpper 计算实际放入的 token 数量
    // 如果 tickLower 和 tickUpper 边界距离 currentTick 太近
    // 实际放入的 token 数量 会比 _baseTokenAmount 稍微少一些
    // 但是如果 tickLower 和 tickUpper 边界距离 currentTick 太远，对我们的逻辑有害处
    // 实际放入的 token 数量的具体计算还没有搞懂
    params.amount0Min = 0;
    (, , uint256 amount0, uint256 amount1) = _nonfungiblePositionManager.mint(
      params
    );
    console.log("amount0 amount1", amount0, amount1);
  }

  function mint(
    address[] calldata _mintTokenAddressList,
    uint24[] calldata _mintTokenAmountRatioList,
    uint256 _endTimestamp,
    int24 tickLower,
    int24 tickUpper
  ) external override onlyOwnerOrManager {
    console.log("mint", mintLastTimestamp, _endTimestamp, block.timestamp);
    require(_mintTokenAddressList.length == _mintTokenAmountRatioList.length);
    require(_endTimestamp <= block.timestamp);
    require(_endTimestamp >= mintLastTimestamp);

    (
      uint256 mintValue,
      uint256 _mintLastTimestamp,
      uint256 _mintLastN
    ) = getMintValue(_endTimestamp);

    console.log("mintValue", mintValue);

    mintLastTimestamp = _mintLastTimestamp;
    mintLastN = _mintLastN;

    // 给贡献者分配 token
    uint256 ratioSum = 0;
    for (uint256 index; index < _mintTokenAmountRatioList.length; index++) {
      ratioSum += _mintTokenAmountRatioList[index];
    }
    for (uint256 index; index < _mintTokenAmountRatioList.length; index++) {
      _mint(
        _mintTokenAddressList[index],
        (mintValue * _mintTokenAmountRatioList[index]) / ratioSum
      );
    }

    // 根据 _mintTokenAddressList lpRatio_ 分配 token
    // lpMintValue = value / 100 * _lpRatio
    uint256 lpMintValue = (mintValue * lpRatio) / 100;
    _mint(address(this), lpMintValue);

    console.log("lpMintValue", lpMintValue);
    // 单币放入 uniswap
    if (lpPool != address(0)) {
      mintToLP(lpMintValue, tickLower, tickUpper);
    }
  }

  function bonusWithdraw() external override {
    uint256 count = _nonfungiblePositionManager.balanceOf(address(this));
    uint256[] memory tokenIdList = new uint256[](count);
    for (uint256 index = 0; index < count; index++) {
      tokenIdList[index] = _nonfungiblePositionManager.tokenOfOwnerByIndex(
        address(this),
        index
      );
      console.log("set", index, tokenIdList[index]);
    }
    _bonusWithdrawByTokenIdList(tokenIdList);
  }

  function bonusWithdrawByTokenIdList(uint256[] memory tokenIdList)
    external
    override
  {
    for (uint256 index = 0; index < tokenIdList.length; index++) {
      uint256 tokenId = tokenIdList[index];
      require(_nonfungiblePositionManager.ownerOf(tokenId) == msg.sender);
    }
    _bonusWithdrawByTokenIdList(tokenIdList);
  }

  function addManager(address manager) external override onlyOwner {
    require(!managers.contains(manager));
    managers.add(manager);
  }

  function removeManager(address manager) external override onlyOwner {
    require(managers.contains(manager));
    managers.remove(manager);
  }

  function isManager(address manager)
    external
    view
    override
    returns (bool result)
  {
    result = managers.contains(manager);
  }

  function owner() external view override returns (address result) {
    result = _owner;
  }

  function transferOwnership(address newOwner) external override onlyOwner {
    require(newOwner != address(0));
    _owner = newOwner;
  }

  function _bonusWithdrawByTokenIdList(uint256[] memory tokenIdList) private {
    uint256 token0TotalAmount;
    uint256 token1TotalAmount;

    uint256 token0Add;
    uint256 token1Add;
    for (uint256 index = 0; index < tokenIdList.length; index++) {
      (token0Add, token1Add) = _bonusWithdrawByTokenId(tokenIdList[index]);
      console.log(
        "_bonusWithdrawByTokenId",
        tokenIdList[index],
        token0Add,
        token1Add
      );
      token0TotalAmount += token0Add;
      token1TotalAmount += token1Add;
    }

    if (token0TotalAmount > 0) {
      uint256 bonusToken0TotalAmount = token0TotalAmount / 100;
      uint256 stackingToken0TotalAmount = token0TotalAmount -
        bonusToken0TotalAmount;

      TransferHelper.safeTransfer(
        lpToken0,
        stakingAddress,
        stackingToken0TotalAmount
      );
      TransferHelper.safeTransfer(lpToken0, msg.sender, bonusToken0TotalAmount);
    }

    if (token1TotalAmount > 0) {
      uint256 bonusToken1TotalAmount = token1TotalAmount / 100;
      uint256 stackingToken1TotalAmount = token1TotalAmount -
        bonusToken1TotalAmount;

      TransferHelper.safeTransfer(
        lpToken1,
        stakingAddress,
        stackingToken1TotalAmount
      );
      TransferHelper.safeTransfer(lpToken1, msg.sender, bonusToken1TotalAmount);
    }
  }

  function _bonusWithdrawByTokenId(uint256 tokenId)
    private
    returns (uint256 token0Add, uint256 token1Add)
  {
    (
      ,
      ,
      address token0,
      address token1,
      ,
      ,
      ,
      ,
      ,
      ,
      ,

    ) = _nonfungiblePositionManager.positions(tokenId);

    if (lpToken0 != token0 || lpToken1 != token1) {
      token0Add = 0;
      token1Add = 0;
    } else {

        INonfungiblePositionManager.CollectParams memory bonusParams
       = INonfungiblePositionManager.CollectParams({
        tokenId: tokenId,
        recipient: address(this),
        amount0Max: type(uint128).max,
        amount1Max: type(uint128).max
      });
      ERC20 token0ERC20 = ERC20(token0);
      ERC20 token1ERC20 = ERC20(token1);
      uint256 token0Before = token0ERC20.balanceOf(address(this));
      uint256 token1Before = token1ERC20.balanceOf(address(this));
      _nonfungiblePositionManager.collect(bonusParams);
      token0Add = token0ERC20.balanceOf(address(this)) - token0Before;
      token1Add = token1ERC20.balanceOf(address(this)) - token1Before;
    }
  }

  function buildMintParams(
    uint256 _baseTokenAmount,
    address _quoteTokenAddress,
    uint256 _quoteTokenAmount,
    uint24 fee,
    int24 tickLower,
    int24 tickUpper
  )
    private
    view
    returns (INonfungiblePositionManager.MintParams memory params)
  {
    address token0;
    address token1;
    uint256 amount0Desired;
    uint256 amount1Desired;
    if (address(this) > _quoteTokenAddress) {
      token0 = _quoteTokenAddress;
      token1 = address(this);
      amount0Desired = _quoteTokenAmount;
      amount1Desired = _baseTokenAmount;
    } else {
      token0 = address(this);
      token1 = _quoteTokenAddress;
      amount0Desired = _baseTokenAmount;
      amount1Desired = _quoteTokenAmount;
    }

    uint256 amount0Min = (amount0Desired * 9975) / 10000;
    uint256 amount1Min = (amount1Desired * 9975) / 10000;
    uint256 deadline = block.timestamp + 60 * 60;

    params = INonfungiblePositionManager.MintParams({
      token0: token0,
      token1: token1,
      fee: fee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: amount0Desired,
      amount1Desired: amount1Desired,
      amount0Min: amount0Min,
      amount1Min: amount1Min,
      recipient: address(this),
      deadline: deadline
    });
  }

  function getNearestTickLower(
    int24 tick,
    uint24 fee,
    int24 tickSpacing
  ) private view returns (int24 tickLower) {
    // 比 tick 大
    // TODO 测试
    int24 bei = (tickUpperMap[fee] - tick) / tickSpacing;
    tickLower = tickUpperMap[fee] - tickSpacing * bei;
  }

  function getNearestTickUpper(
    int24 tick,
    uint24 fee,
    int24 tickSpacing
  ) private view returns (int24 tickLower) {
    // 比 tick 小
    // TODO 测试
    int24 bei = (tick - tickLowerMap[fee]) / tickSpacing;
    tickLower = tickLowerMap[fee] + tickSpacing * bei;
  }

  function getNearestSingleMintParams()
    private
    view
    returns (
      address quoteTokenAddress,
      uint24 fee,
      int24 tickLower,
      int24 tickUpper
    )
  {
    IUniswapV3Pool pool = IUniswapV3Pool(lpPool);

    (, int24 tick, , , , , ) = pool.slot0();

    fee = pool.fee();

    int24 tickSpacing = pool.tickSpacing();

    if (address(this) == pool.token0()) {
      tickLower = getNearestTickLower(tick, fee, tickSpacing);
      tickUpper = tickUpperMap[fee];
      quoteTokenAddress = pool.token1();
    } else {
      tickLower = tickLowerMap[fee];
      tickUpper = getNearestTickUpper(tick, fee, tickSpacing);
      quoteTokenAddress = pool.token0();
    }
  }

  function getMintValue(uint256 _endTimestamp)
    private
    view
    returns (
      uint256 mintValue,
      uint256 _newMintLastTimestamp,
      uint256 _newMintLastN
    )
  {
    require(_endTimestamp <= block.timestamp);
    require(_endTimestamp >= mintLastTimestamp);

    uint256 day = (_endTimestamp - mintLastTimestamp) / 86400;
    require(day >= 1);

    _newMintLastTimestamp = day * 86400 + mintLastTimestamp;
    _newMintLastN = mintLastN + day;

    // TODO 暴力循环可能非 GAS ,待优化
    for (int256 currentDay = 1; currentDay <= int256(day); currentDay++) {
      uint256 s = int256ToUint256Zero(
        (currentDay * miningArg.bNumerator) /
          miningArg.bDenominator +
          miningArg.c
      );
      mintValue += int256ToUint256Zero(
        miningArg.d +
          ((int256(miningArg.aNumerator)**s) * miningArg.p) /
          (int256(miningArg.aDenominator)**s)
      );
    }
  }

  function mintToLP(
    uint256 lpMintValue,
    int24 tickLower,
    int24 tickUpper
  ) private {
    (
      address quoteTokenAddress,
      uint24 fee,
      int24 nearestTickLower,
      int24 nearestTickUpper
    ) = getNearestSingleMintParams();

    require(tickLower >= nearestTickLower);
    require(tickUpper <= nearestTickUpper);

    INonfungiblePositionManager.MintParams memory params = buildMintParams(
      lpMintValue,
      quoteTokenAddress,
      0,
      fee,
      tickLower,
      tickUpper
    );

    // TODO 目前的实现并不能精确的把 _baseTokenAmount 完全放入进去
    params.amount0Min = 0;
    (, , uint256 amount0, uint256 amount1) = _nonfungiblePositionManager.mint(
      params
    );
    console.log("amount0 amount1", amount0, amount1);
  }

  function int256ToUint256Zero(int256 input)
    private
    pure
    returns (uint256 result)
  {
    if (input > 0) {
      result = uint256(input);
    } else {
      result = 0;
    }
  }
}
