---
title: Token-Factory
description: DAO Owner 调用 Token-Factory 合约部署 DAO-Token
---

# 概要

所有被 ICPDAO 认可的 DAO-Token 必须由 Token-Factory 部署.

# 说明

## 部署 DAO-Token

参数参考: [DAO-Token](./dao-token.md#创世)

有一个 map，记录已经部署的 token 的名单, token 部署账号必须是 TokenFactory，保证记录了正确的列表.

```solidity
function deploy(
    // _genesis_token
    address[] memory _genesis_token_address_list,
    uint256[] memory _genesis_token_amount_list,

    // _temporary_token = _genesis_token * ( _lp_ratio / 100 )
    uint8 _lp_ratio,

    // ICPDAO-Staking 合约地址
    address _staking_address,

    // DAO Owner
    address _owner_address,

    // 挖矿产出公式参数, 注意浮点型是否可用
    int _mining_args_P,
    fixed _mining_args_a,
    fixed _mining_args_b,
    int _mining_args_c,
    int _mining_args_d,

    // ERC20 参数
    ...
) external
```

