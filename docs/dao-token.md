---
title: DAO-Token
description: 每个 DAO 借由 ICPDAO 所部署发行的 token
---

# 概要

每个在 ICPDAO 上所创建的 DAO 都可以借由 ICPDAO 部署 DAO-Token 合约, 即发行属于自己 DAO 的 token.

DAO Owner 调用 ICPDAO 提供的 Token-Factory 合约及 [相关参数]() 即可部署本 DAO-Token 合约在以太坊上. 除此之外, ICPDAO 不认可通过其他方式创建的 DAO-Token 合约.

DAO-Token 本质是一份具有多种特性的, 满足 ERC20 规范的 Token 合约.

# 说明

## 创世
合约部署时, 可以指定并分配创世 token 即 `_genesis_token`, 同时必须按比例预留一部分 token 用于 uniswap v3 的 LP 池即 `_temporary_token`.

同时, 需要指定 ICPDAO-Staking 合约地址, DAO Owner 钱包地址, [挖矿产出公式参数](./mining-function.md) 及 ERC20 参数.

```solidity
constructor(
    // _genesis_token
    address[] _genesis_token_address_list,
    uint256[] _genesis_token_amount_list,

    // _temporary_token = _genesis_token / 100 * _lp_ratio
    uint256 _lp_ratio,

    // ICPDAO-Staking 合约地址
    address _staking_address,

    // DAO Owner
    address _owner_address,

    // 挖矿产出公式参数, 注意浮点型是否可用
    int256 _mining_args_P,
    int256 _mining_args_a_numerator,
    int256 _mining_args_a_denominator,
    int256 _mining_args_b_numerator,
    int256 _mining_args_b_denominator,
    int256 _mining_args_c,
    int256 _mining_args_d,

    // ERC20 参数
    string _erc20_name,
    string _erc20_symbol
)
```

## 创建交易对及添加流动性

### 创建交易对
合约部署后, DAO Owner 可以将一部分 `_temporary_token` 和自行添加的另外一种 token (即 `_transaction_token`) 组成交易对, 添加为 uniswap v3 的 LP 池(即 `_token_lp_pool`). 

`_token_lp_pool` 将作为合约挖矿自动添加流动性的唯一 LP 池.

`_transaction_token` 种类一般为已经具有一定共识的 token. 例如, eth/usdc/dai.

```solidity
function create_lp_pool(
    // _token0_amount <= _temporary_token
    uint256 _token0_amount

    // _transaction_token 即 token1
    address _token1_address
    uint256 _token1_amount

) external
```

### 添加流动性
剩余的 `_temporary_token` 可以由 DAO Owner 随时添加任意数量至 `_token_lp_pool`, 可以多次添加. 借助 uniswap v3 的 range order 单币增加.

```solidity
function update_lp_pool(
    // _token0_amount <= _temporary_token
    uint256 _token0_amount
) external
```

## 挖矿

合约部署后, 具有挖矿功能, 每次挖矿需要传入一个挖矿的截止时间, 同时仅 owner 和 manger 可以调用挖矿接口.

挖矿时产生的 token 一部分分配给该 DAO 的贡献者. 

另一部分视 `_token_lp_pool` 是否存在确定去向. 

若 `_token_lp_pool` 存在则单币添加进去, 反之, 添加至 `_temporary_token`.

```solidity
function mint(
    // _mint_token
    address[] _mint_token_address_list,
    uint256[] _mint_token_amount_list,

    // _end_timestap <= block.timestap
    uint256 _end_timestap,
    
    // TODO
    int24 tickLower, int24 tickUpper
) external
```

## 质押
该合约所具有的 `_token_lp_pool` 的交易手续费, 可以通过调用该方法被添加到 ICPDAO-Staking 合约中, 用于质押 ICP(ICPDAO 治理币) 的奖励. 从而激励 ICPDAO 社区的发展.

被转账的手续费 99% 会转账进入 ICPDAO-Staking 合约，1% 会作为调用者的奖励.

```solidity
function bonus_with_draw external
```

## 权限

```solidity
// owner 可以增加管理员
function add_manager(address manager) external

// owner 可以删除管理员
function remove_manager(address manager) external
```
