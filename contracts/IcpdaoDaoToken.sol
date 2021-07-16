//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

import "./interfaces/UniswapV3/INonfungiblePositionManager.sol";
import "./interfaces/UniswapV3/IUniswapV3Pool.sol";

import "hardhat/console.sol";

import "./interfaces/IIcpdaoDaoToken.sol";
import "./libraries/TransferHelper.sol";

contract IcpdaoDaoToken is ERC20, Ownable, IIcpdaoDaoToken {
  uint256 private constant MAX_INT =
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
  uint256 public lpRatio;

  address public stakingAddress;

  uint256 public temporaryTokenAmount;

  int256 public miningArgsP;
  int256 public miningArgsANumerator;
  int256 public miningArgsADenominator;
  int256 public miningArgsBNumerator;
  int256 public miningArgsBDenominator;
  int256 public miningArgsC;
  int256 public miningArgsD;
  address public lpPool;

  address private _nonfungiblePositionManagerAddress =
    0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
  INonfungiblePositionManager private _nonfungiblePositionManager =
    INonfungiblePositionManager(_nonfungiblePositionManagerAddress);

  address private _weth9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  mapping(uint24 => int24) tickLowerMap;
  mapping(uint24 => int24) tickUpperMap;

  constructor(
    address[] memory genesisTokenAddressList_,
    uint256[] memory genesisTokenAmountList_,
    uint256 lpRatio_,
    address stakingAddress_,
    address ownerAddress_,
    int256[] memory miningArg,
    string memory erc20Name_,
    string memory erc20Symbol_
  ) ERC20(erc20Name_, erc20Symbol_) {
    require(genesisTokenAddressList_.length == genesisTokenAmountList_.length);
    require(miningArg.length == 7);

    tickLowerMap[500] = -887270;
    tickLowerMap[3000] = -887220;
    tickLowerMap[10000] = -887200;

    tickUpperMap[500] = -tickLowerMap[500];
    tickUpperMap[3000] = -tickLowerMap[3000];
    tickUpperMap[10000] = -tickLowerMap[10000];

    lpRatio = lpRatio_;
    stakingAddress = stakingAddress_;
    transferOwnership(ownerAddress_);

    miningArgsP = miningArg[0];
    miningArgsANumerator = miningArg[1];
    miningArgsADenominator = miningArg[2];
    miningArgsBNumerator = miningArg[3];
    miningArgsBDenominator = miningArg[4];
    miningArgsC = miningArg[5];
    miningArgsD = miningArg[6];

    // 分配创世
    uint256 genesisTotalAmount = 0;
    for (uint256 index; index < genesisTokenAddressList_.length; index++) {
      _mint(genesisTokenAddressList_[index], genesisTokenAmountList_[index]);
      genesisTotalAmount = genesisTotalAmount + genesisTokenAmountList_[index];
    }
    temporaryTokenAmount = (genesisTotalAmount / 100) * lpRatio;
    _mint(address(this), temporaryTokenAmount);
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
  ) external payable override {
    require(_quoteTokenAddress != address(this));
    require(_quoteTokenAddress != address(0));
    require(_baseTokenAmount != 0);
    require(_quoteTokenAmount != 0);

    TransferHelper.safeApprove(
      address(this),
      _nonfungiblePositionManagerAddress,
      MAX_INT
    );

    if (_quoteTokenAddress != _weth9) {
      TransferHelper.safeApprove(
        _quoteTokenAddress,
        _nonfungiblePositionManagerAddress,
        MAX_INT
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

    lpPool = _nonfungiblePositionManager.createAndInitializePoolIfNecessary(
      params.token0,
      params.token1,
      fee,
      sqrtPriceX96
    );

    _nonfungiblePositionManager.mint{ value: msg.value }(params);

    if (_quoteTokenAddress == _weth9) {
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

  function updateLPPool(uint256 _baseTokenAmount) external override {
    require(lpPool != address(0));
    require(_baseTokenAmount <= temporaryTokenAmount);

    IUniswapV3Pool pool = IUniswapV3Pool(lpPool);

    (, int24 tick, , , , , ) = pool.slot0();

    uint24 fee = pool.fee();
    int24 tickSpacing = pool.tickSpacing();

    int24 tickLower;
    int24 tickUpper;
    address quoteTokenAddress;
    if (address(this) == pool.token0()) {
      tickLower = getNearestTickLower(tick, fee, tickSpacing);
      tickUpper = tickUpperMap[fee];
      quoteTokenAddress = pool.token1();
    } else {
      tickLower = tickLowerMap[fee];
      tickUpper = getNearestTickUpper(tick, fee, tickSpacing);
      quoteTokenAddress = pool.token0();
    }

    INonfungiblePositionManager.MintParams memory params = buildMintParams(
      _baseTokenAmount,
      quoteTokenAddress,
      0,
      pool.fee(),
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
    uint256[] calldata _mintTokenAmountList,
    uint256 _endTimestap,
    int24 tickLower,
    int24 tickUpper
  ) external override {}

  function bonusWithdraw() external override {}

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
}
