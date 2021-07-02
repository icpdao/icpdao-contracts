---
title: Token-Factory
description: DAO Owner 调用 Token-Factory 合约部署 DAO-Token
---

# 概要

所有被 ICPDAO 认可的 DAO-Token 必须由 Token-Factory 部署.

# 说明

## 部署 DAO-Token

参数参考: [DAO-Token](./dao-token.md#创世)

TokenFactory 有一个 tokens 变量记录已经部署的 DAO-Token 的名单, DAO-Token 必须由 TokenFactory.deploy 部署，保证 tokens 记录了正确的列表.

```solidity
mapping (address => bool) public tokens;

constructor(
    // ICPDAO-Staking 合约地址
    address _staking_address
)

function deploy(
    // _genesis_token
    address[] _genesis_token_address_list,
    uint256[] _genesis_token_amount_list,

    // _temporary_token = _genesis_token / 100 * _lp_ratio
    uint256 _lp_ratio,

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
) external
```

