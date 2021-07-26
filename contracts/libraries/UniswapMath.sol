// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import "../interfaces/external/INonfungiblePositionManager.sol";

import "hardhat/console.sol";


library UniswapMath {
    int24 constant tick500 = -887270;
    int24 constant tick3000 = -887220;
    int24 constant tick10000 = -887200;

    function getLowerTick(uint24 fee) private pure returns (int24 tick) {
        if (fee == 500) return tick500;
        else if (fee == 3000) return tick3000;
        else if (fee == 10000) return tick10000; 
    }

    function getUpperTick(uint24 fee) private pure returns (int24 tick) {
        if (fee == 500) return -tick500;
        else if (fee == 3000) return -tick3000;
        else if (fee == 10000) return -tick10000; 
    }

    function createDAOTokenPool(
        INonfungiblePositionManager inpm,
        uint256 _baseTokenAmount,
        address _quoteTokenAddress,
        uint256 _quoteTokenAmount,
        uint24 _fee,
        int24 _tickLower,
        int24 _tickUpper,
        uint160 _sqrtPriceX96
    ) internal returns(address lpPool, address lpToken0, address lpToken1) {
        INonfungiblePositionManager.MintParams memory params = buildMintParams(
            _baseTokenAmount, _quoteTokenAddress, _quoteTokenAmount,
            _fee, _tickLower, _tickUpper
        );

        lpPool = inpm.createAndInitializePoolIfNecessary(params.token0, params.token1, _fee, _sqrtPriceX96);
        lpToken0 = params.token0;
        lpToken1 = params.token1;
        inpm.mint{value: msg.value}(params);
    }

    function buildMintParams(
        uint256 _baseTokenAmount,
        address _quoteTokenAddress,
        uint256 _quoteTokenAmount,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (INonfungiblePositionManager.MintParams memory params)
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

    function getNearestSingleMintParams(
        address lpPool
    ) internal view returns (
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
            tickUpper = getUpperTick(fee);
            quoteTokenAddress = pool.token1();
        } else {
            tickLower = getLowerTick(fee);
            tickUpper = getNearestTickUpper(tick, fee, tickSpacing);
            quoteTokenAddress = pool.token0();
        }
    }

    function getNearestTickLower(
        int24 tick,
        uint24 fee,
        int24 tickSpacing
    ) internal pure returns (int24 tickLower) {
        // 比 tick 大
        // TODO 测试
        int24 bei = (getUpperTick(fee) - tick) / tickSpacing;
        tickLower = getUpperTick(fee) - tickSpacing * bei;
    }

    function getNearestTickUpper(
        int24 tick,
        uint24 fee,
        int24 tickSpacing
    ) internal pure returns (int24 tickLower) {
        // 比 tick 小
        // TODO 测试
        int24 bei = (tick - getLowerTick(fee)) / tickSpacing;
        tickLower = getLowerTick(fee) + tickSpacing * bei;
    }

    function mintToLP(
        INonfungiblePositionManager inpm,
        address lpPool,
        uint256 lpMintValue
    ) internal {
        (address quoteTokenAddress, uint24 fee, int24 tickLower, int24 tickUpper) = getNearestSingleMintParams(lpPool);

        INonfungiblePositionManager.MintParams memory params = buildMintParams(
            lpMintValue, quoteTokenAddress, 0, fee, tickLower, tickUpper);

        // TODO 目前的实现并不能精确的把 _baseTokenAmount 完全放入进去
        // 原因如下
        // 即使是单币放入 pool.mint 方法也会 根据 tickLower 和 tickUpper 计算实际放入的 token 数量
        // 如果 tickLower 和 tickUpper 边界距离 currentTick 太近
        // 实际放入的 token 数量 会比 _baseTokenAmount 稍微少一些
        // 但是如果 tickLower 和 tickUpper 边界距离 currentTick 太远，对我们的逻辑有害处
        // 实际放入的 token 数量的具体计算还没有搞懂
        params.amount0Min = 0;
        (, , uint256 amount0, uint256 amount1) = inpm.mint(params);
        console.log(amount0, amount1);
    }

    function mintToLPByTick(
        INonfungiblePositionManager inpm,
        address lpPool,
        uint256 lpMintValue,
        int24 tickLower,
        int24 tickUpper
    ) internal {
        (address quoteTokenAddress, uint24 fee, int24 nearestTickLower, int24 nearestTickUpper) = getNearestSingleMintParams(lpPool);

        require(tickLower >= nearestTickLower);
        require(tickUpper <= nearestTickUpper);

        INonfungiblePositionManager.MintParams memory params = buildMintParams(
            lpMintValue, quoteTokenAddress, 0, fee, tickLower, tickUpper);

        // TODO 目前的实现并不能精确的把 _baseTokenAmount 完全放入进去
        // 原因如下
        // 即使是单币放入 pool.mint 方法也会 根据 tickLower 和 tickUpper 计算实际放入的 token 数量
        // 如果 tickLower 和 tickUpper 边界距离 currentTick 太近
        // 实际放入的 token 数量 会比 _baseTokenAmount 稍微少一些
        // 但是如果 tickLower 和 tickUpper 边界距离 currentTick 太远，对我们的逻辑有害处
        // 实际放入的 token 数量的具体计算还没有搞懂
        params.amount0Min = 0;
        (, , uint256 amount0, uint256 amount1) = inpm.mint(params);
        console.log(amount0, amount1);
    }
}