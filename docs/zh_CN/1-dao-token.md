---
title: DAO-Token
description: 每个 DAO 借由 ICPDAO 所部署发行的 token
---

# 概要

每个在 ICPDAO 上所创建的 DAO 都可以借由 ICPDAO 部署 DAO-Token 合约, 即发行属于自己 DAO 的 token.

DAO Owner 调用 ICPDAO 提供的 Token-Factory 合约即可部署本 DAO-Token 合约在以太坊上. 除此之外, ICPDAO 不认可通过其他方式创建的 DAO-Token 合约.

DAO-Token 本质是一份具有多种特性的, 满足 ERC20 规范的 Token 合约.

# 说明


## 权限

```solidity
/// @notice owner 可以增加管理员
function addManager(address manager) external

/// @notice owner 可以删除管理员
function removeManager(address manager) external

/// @notice 仅 owner 和 manage 有权限
modifier onlyOwnerOrManager {
    // ...
    _;
}
```


## 创世
合约部署时, 可以指定并分配创世 token 即 `_genesisToken`, 同时必须按比例预留一部分 token 用于 uniswap v3 的 LP 池即 `_temporaryToken`.

同时, 需要指定 ICPDAO-Staking 合约地址, DAO Owner 钱包地址, [挖矿产出公式参数](./mining-function.md) 及 ERC20 参数.

```solidity
/// @param _genesisTokenAddressList _genesisToken 地址列表
/// @param _genesisTokenAmountList _genesisToken 地址对应 token 分配数
/// @param _lpRatio _temporaryToken 的值是 _genesisToken / 100 * _lpRatio
/// @param _stakingAddress ICPDAO-Staking 合约地址
/// @param _ownerAddress DAO Owner
/// @param _miningArgs 挖矿产出公式参数
/// @param _erc20 ERC20 参数
constructor(
    address[] _genesisTokenAddressList,
    uint256[] _genesisTokenAmountList,

    uint256 _lpRatio,

    address _stakingAddress,

    address _ownerAddress,

    int256 _miningArgsP,
    int256 _miningArgsANumerator,
    int256 _miningArgsADenominator,
    int256 _miningArgsBNumerator,
    int256 _miningArgsBDenominator,
    int256 _miningArgsC,
    int256 _miningArgsD,

    string _erc20Name,
    string _erc20Symbol
)
```

## 创建交易对及添加流动性

### 创建交易对
合约部署后, DAO Owner 可以将一部分 `_temporaryToken` 和自行添加的另外一种 token (即 `_quoteToken`) 组成交易对, 添加为 uniswap v3 的 LP 池(即 `_tokenLPPool`). 

`_tokenLPPool` 将作为合约挖矿自动添加流动性的唯一 LP 池.

`_quoteToken` 种类一般为已经具有一定共识的 token. 例如, eth/usdc/dai.

```solidity
/// @param _baseTokenAmount 需要放置的 token0 数量, _baseTokenAmount <= _temporaryToken
/// @param _quoteTokenAddress 需要放置的报价 token1 的地址
/// @param _quoteTokenAmount 需要放置的报价 token1 的数量
function createLPPool(
    uint256 _baseTokenAmount

    address _quoteTokenAddress
    uint256 _quoteTokenAmount

) external onlyOwnerOrManager
```

### 添加流动性
剩余的 `_temporaryToken` 可以由 DAO Owner 随时添加任意数量至 `_tokenLPPool`, 可以多次添加. 借助 uniswap v3 的 range order 单币增加.

```solidity
/// @param _baseTokenAmount 需要添加的 token0 数量, _baseTokenAmount <= _temporaryToken
function updateLPPool(
    uint256 _baseTokenAmount
) external onlyOwnerOrManager
```

## 挖矿

合约部署后, 具有挖矿功能, 每次挖矿需要传入一个挖矿的截止时间, 同时仅 owner 和 manger 可以调用挖矿接口.

挖矿时产生的 token 一部分分配给该 DAO 的贡献者. 

另一部分视 `_tokenLPPool` 是否存在确定去向. 

若 `_tokenLPPool` 存在则单币添加进去, 反之, 添加至 `_temporaryToken`.

```solidity
/// @param _mintTokenAddressList 挖矿分配给 DAO 贡献者的地址列表
/// @param _mintTokenAmountList 挖矿分配给 DAO 贡献者的对应数量
/// @param _endTimestap 本次挖矿周期是 [_beginTimestap, _endTimestap], 
///   _beginTimestap 是上一次 _endTimestap 或者合约部署时间(当第一次挖矿时)
///   _endTimestap <= block.timestap
/// @param tickLower 挖矿时传 range order 下区间
/// @param tickUpper 挖矿时传 range order 上区间, 一般无限大
function mint(
    address[] _mintTokenAddressList,
    uint256[] _mintTokenAmountList,

    uint256 _endTimestap,

    int24 tickLower,
    int24 tickUpper,
) external onlyOwnerOrManager
```

## 质押
该合约所具有的 `_tokenLPPool` 的交易手续费, 可以通过调用该方法被添加到 ICPDAO-Staking 合约中, 用于质押 ICP(ICPDAO 治理币) 的奖励. 从而激励 ICPDAO 社区的发展.

被转账的手续费 99% 会转账进入 ICPDAO-Staking 合约，1% 会作为调用者的奖励.

```solidity
function bonusWithdraw external
```
