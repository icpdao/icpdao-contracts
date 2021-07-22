// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "hardhat/console.sol";

import "./interfaces/external/INonfungiblePositionManager.sol";
import "./interfaces/IDAOToken.sol";

import "./libraries/FullMath.sol";
import "./libraries/MintMath.sol";

/// @title DAO Token Contracts.
contract DAOToken is IDAOToken, ERC20 {
    using FullMath for uint256;
    using MintMath for MintMath.Anchor;
    using SafeERC20 for IERC20;

    address private _owner;
    uint256 private _temporaryAmount;
    
    address public immutable staking;
    uint256 public immutable lpRatio;

    address public lpToken0;
    address public lpToken1;
    address public lpPool;

    mapping(uint24 => int24) tickLowerMap;
    mapping(uint24 => int24) tickUpperMap;
    
    address public constant UNISWAP_V3_POSITIONS = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address public constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    uint256 public constant MAX_UINT256 = type(uint256).max;
    uint128 public constant MAX_UINT128 = type(uint128).max;
    
    MintMath.Anchor public anchor;

    mapping (address=>bool) public managers;

    modifier onlyOwner() {
        require(_msgSender() == _owner, "ICPDAO: NOT OWNER");
        _;
    }

    modifier onlyOwnerOrManager() {
        require(managers[_msgSender()] || _msgSender() == _owner, "NOT OWNER OR MANAGER");
        _;
    }

    constructor(
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        address _stakingAddress,
        address _ownerAddress,
        uint256[7] memory _miningArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) ERC20(_erc20Name, _erc20Symbol) {
        require(_genesisTokenAddressList.length == _genesisTokenAmountList.length, "ICPDAO: GENESIS ADDRESS LENGTH != AMOUNT LENGTH");
        for (uint256 i = 0; i < _genesisTokenAddressList.length; i++) {
            _mint(_genesisTokenAddressList[i], _genesisTokenAmountList[i]);
        }
        if (totalSupply() > 0) {
            _temporaryAmount = totalSupply().divMul(100, _lpRatio);
            _mint(address(this), _temporaryAmount);
        }
        anchor.initialize(_miningArgs, block.timestamp);
        _owner = _ownerAddress;
        staking = _stakingAddress;
        lpRatio = _lpRatio;

        tickLowerMap[500] = -887270;
        tickLowerMap[3000] = -887220;
        tickLowerMap[10000] = -887200;
        tickUpperMap[500] = -tickLowerMap[500];
        tickUpperMap[3000] = -tickLowerMap[3000];
        tickUpperMap[10000] = -tickLowerMap[10000];
    }

    function owner() external view virtual override returns (address) {
        return _owner;
    }

    function isManager(address _address) external view virtual override returns (bool) {
        return managers[_address];
    }

    function addManager(address manager) external override onlyOwner {
        require(manager != address(0), "ICPDAO: MANGAGER IS ZERO");
        managers[manager] = true;
    }

    function removeManager(address manager) external override onlyOwner {
        require(manager != address(0), "ICPDAO: MANAGER IS ZERO");
        managers[manager] = false;
    }

    function createLPPool(
        uint256 _baseTokenAmount,
        address _quoteTokenAddress,
        uint256 _quoteTokenAmount,
        uint24 _fee,
        int24 _tickLower,
        int24 _tickUpper,
        uint160 _sqrtPriceX96
    ) external payable override onlyOwnerOrManager {
        require(_baseTokenAmount > 0, "ICPDAO: BASE TOKEN AMOUNT MUST > 0");
        require(_quoteTokenAmount > 0, "ICPDAO: QUOTE TOKEN AMOUNT MUST > 0");
        require(_baseTokenAmount <= _temporaryAmount, "ICPDAO: NOT ENOUGH TEMPORARYAMOUNT");
        require(_quoteTokenAddress != address(0), "ICPDAO: QUOTE TOKEN NOT EXIST");
        require(_quoteTokenAddress != address(this), "ICPDAO: QUOTE TOKEN CAN NOT BE BASE TOKEN");

        IERC20(address(this)).safeApprove(UNISWAP_V3_POSITIONS, MAX_UINT256);
        if (_quoteTokenAddress != WETH9) {
            IERC20(_quoteTokenAddress).safeApprove(UNISWAP_V3_POSITIONS, MAX_UINT256);
            IERC20(_quoteTokenAddress).safeTransferFrom(_msgSender(), address(this), _quoteTokenAmount);
        }

        INonfungiblePositionManager.MintParams memory params = buildMintParams(
            _baseTokenAmount, _quoteTokenAddress, _quoteTokenAmount,
            _fee, _tickLower, _tickUpper
        );

        lpToken0 = params.token0;
        lpToken1 = params.token1;

        lpPool = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).createAndInitializePoolIfNecessary(
            lpToken0, lpToken1, _fee, _sqrtPriceX96);
        
        INonfungiblePositionManager(UNISWAP_V3_POSITIONS).mint{value: msg.value}(params);

        if (_quoteTokenAddress == WETH9) {
            INonfungiblePositionManager(UNISWAP_V3_POSITIONS).refundETH();
            if (address(this).balance > 0) IERC20(address(this)).safeTransfer(_msgSender(), address(this).balance);
        }
        if (_quoteTokenAddress != WETH9) {
            uint256 balance_ = IERC20(_quoteTokenAddress).balanceOf(address(this));
            if (balance_ > 0) IERC20(_quoteTokenAddress).safeTransfer(_msgSender(), balance_);
        }
        _temporaryAmount -= _baseTokenAmount;
    }

    function updateLPPool(
        uint256 _baseTokenAmount
    ) external override onlyOwnerOrManager {
        require(_baseTokenAmount <= _temporaryAmount, "ICPDAO: NOT ENOUGH TEMPORARYAMOUNT");
        require(lpPool != address(0), "ICPDAO: LP POOL DOES NOT EXIST");

        (address quoteTokenAddress, uint24 fee, int24 tickLower, int24 tickUpper) = getNearestSingleMintParams();
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
        (, , uint256 amount0, uint256 amount1) = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).mint(params);
        console.log("amount0 amount1", amount0, amount1);
        // if (address(this).balance > 0) IERC20(address(this)).safeTransfer(_msgSender(), address(this).balance);
        _temporaryAmount -= _baseTokenAmount;
    }

    function mint(
        address[] memory _mintTokenAddressList,
        uint256[] memory _mintTokenAmountList,
        uint256 _endTimestamp,
        int24 tickLower,
        int24 tickUpper
    ) external override onlyOwnerOrManager {
        require(_mintTokenAddressList.length == _mintTokenAmountList.length, "ICPDAO: MINT ADDRESS LENGTH != AMOUNT LENGTH");
        require(_endTimestamp <= block.timestamp, "ICPDAO: MINT TIMESTAMP > BLOCK TIMESTAMP");
        require(_endTimestamp > anchor.lastTimestamp, "ICPDAO: MINT TIMESTAMP < LAST MINT TIMESTAMP");
        uint256 totalSum = anchor.total(_endTimestamp);
        uint256 userAmount;
        for (uint256 i = 0; i < _mintTokenAddressList.length; i++) {
            userAmount += _mintTokenAmountList[i];
        }
        uint256 thisTemporaryAmount = userAmount.divMul(100, lpRatio);
        require(totalSum >= (userAmount + thisTemporaryAmount), "ICPDAO: MINT TOTAL TOKEN < USER AMOUNT");
        _mint(address(this), totalSum);
        
        for (uint256 i = 0; i < _mintTokenAddressList.length; i++) {
            IERC20(address(this)).safeTransfer(_mintTokenAddressList[i], _mintTokenAmountList[i]);
        }
        
        if (lpPool == address(0)) {
            _temporaryAmount += thisTemporaryAmount;
        } else {
            mintToLP(thisTemporaryAmount, tickLower, tickUpper);
        }
    }

    function bonusWithdraw() external override {
        require(lpPool != address(0), "ICPDAO: LP POOL DOES NOT EXIST");
        uint256 count = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).balanceOf(address(this));
        for (uint256 i = 0; i < count; i++) {
            uint256 lpTokenId = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).tokenOfOwnerByIndex(
                address(this),
                i
            );
            ( , , , , , , , , , , uint128 tokensOwed0, uint128 tokensOwed1) = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).positions(lpTokenId);
            uint128 bonusToken0 = tokensOwed0 / 100;
            uint128 bonusToken1 = tokensOwed1 / 100;
            INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager.CollectParams({
                tokenId: lpTokenId,
                recipient: staking,
                amount0Max: tokensOwed0 - bonusToken0,
                amount1Max: tokensOwed1 - bonusToken1
            });
            INonfungiblePositionManager.CollectParams memory bonusParams = INonfungiblePositionManager.CollectParams({
                tokenId: lpTokenId,
                recipient: _msgSender(),
                amount0Max: bonusToken0,
                amount1Max: bonusToken1
            });
            INonfungiblePositionManager(UNISWAP_V3_POSITIONS).collect(params);
            INonfungiblePositionManager(UNISWAP_V3_POSITIONS).collect(bonusParams);
        }        
    }

    // 
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

    function mintToLP(
        uint256 lpMintValue,
        int24 tickLower,
        int24 tickUpper
    ) private {
        (address quoteTokenAddress, uint24 fee, int24 nearestTickLower, int24 nearestTickUpper) = getNearestSingleMintParams();

        require(tickLower >= nearestTickLower);
        require(tickUpper <= nearestTickUpper);

        INonfungiblePositionManager.MintParams memory params = buildMintParams(
            lpMintValue, quoteTokenAddress, 0, fee, tickLower, tickUpper);

        // TODO 目前的实现并不能精确的把 _baseTokenAmount 完全放入进去
        params.amount0Min = 0;
        (, , uint256 amount0, uint256 amount1) = INonfungiblePositionManager(UNISWAP_V3_POSITIONS).mint(params);
        console.log(amount0, amount1);
    }

    receive() external payable {}
}