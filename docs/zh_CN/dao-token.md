---
title: DAO-Token
description: 每个 DAO 借由 ICPDAO 所部署发行的 token
---

# 概要

每个在 ICPDAO 上所创建的 DAO 都可以借由 ICPDAO 部署 DAO-Token 合约, 即发行属于自己 DAO 的 token.

DAO Owner 调用 ICPDAO 提供的 Token-Factory 合约及 [相关参数]() 即可部署本 DAO-Token 合约在以太坊上. 除此之外, ICPDAO 不认可通过其他方式创建的 DAO-Token 合约.

DAO-Token 本质是一份具有多种特性的, 满足 ERC20 规范的 Token 合约.

# 说明


## 权限

```solidity
// owner 可以增加管理员
function addManager(address manager) external

// owner 可以删除管理员
function removeManager(address manager) external

modify onlyOwnerOrManager {
    // ...
    _;
}
```


## 创世
合约部署时, 可以指定并分配创世 token 即 `_genesisToken`, 同时必须按比例预留一部分 token 用于 uniswap v3 的 LP 池即 `_temporaryToken`.

同时, 需要指定 ICPDAO-Staking 合约地址, DAO Owner 钱包地址, [挖矿产出公式参数](./mining-function.md) 及 ERC20 参数.

```solidity
constructor(
    // _genesisToken
    address[] _genesisTokenAddressList,
    uint256[] _genesisTokenAmountList,

    // _temporaryToken = _genesisToken / 100 * _lpRatio
    uint256 _lpRatio,

    // ICPDAO-Staking 合约地址
    address _stakingAddress,

    // DAO Owner
    address _ownerAddress,

    // 挖矿产出公式参数, 注意浮点型是否可用
    int256 _miningArgsP,
    int256 _miningArgsANumerator,
    int256 _miningArgsADenominator,
    int256 _miningArgsBNumerator,
    int256 _miningArgsBDenominator,
    int256 _miningArgsC,
    int256 _miningArgsD,

    // ERC20 参数
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
function createLPPool(
    // _baseTokenAmount <= _temporaryToken
    uint256 _baseTokenAmount

    // _transactionToken 即 quotetoken
    address _quoteTokenAddress
    uint256 _quoteTokenAmount

) external onlyOwnerOrManager
```

### 添加流动性
剩余的 `_temporaryToken` 可以由 DAO Owner 随时添加任意数量至 `_tokenLPPool`, 可以多次添加. 借助 uniswap v3 的 range order 单币增加.

```solidity
function updateLPPool(
    // _baseTokenAmount <= _temporaryToken
    uint256 _baseTokenAmount
) external onlyOwnerOrManager
```

## 挖矿

合约部署后, 具有挖矿功能, 每次挖矿需要传入一个挖矿的截止时间, 同时仅 owner 和 manger 可以调用挖矿接口.

挖矿时产生的 token 一部分分配给该 DAO 的贡献者. 

另一部分视 `_tokenLPPool` 是否存在确定去向. 

若 `_tokenLPPool` 存在则单币添加进去, 反之, 添加至 `_temporaryToken`.

```solidity
function mint(
    // _mint_token
    address[] _mintTokenAddressList,
    uint256[] _mintTokenAmountList,

    // _endTimestap <= block.timestap
    // _beginTimestap 是上一次 _endTimestap 或者 合约部署时间(上一次 _endTimestap 时)
    uint256 _endTimestap,

    // 挖矿时传 range order 下区间, 上区间无限大
    int24 tickLower
) external onlyOwnerOrManager
```

## 质押
该合约所具有的 `_tokenLPPool` 的交易手续费, 可以通过调用该方法被添加到 ICPDAO-Staking 合约中, 用于质押 ICP(ICPDAO 治理币) 的奖励. 从而激励 ICPDAO 社区的发展.

被转账的手续费 99% 会转账进入 ICPDAO-Staking 合约，1% 会作为调用者的奖励.

```solidity
function bonusWithdraw external
```
