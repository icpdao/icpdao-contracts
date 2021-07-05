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

constructor (
    // ICPDAO-Staking 合约地址
    address _stakingAddress
)

function deploy(
    // _genesisToken
    address[] _genesisTokenAddressList,
    uint256[] _genesisTokenAmountList,

    // _temporaryToken = _genesisToken / 100 * _lpRatio
    uint256 _lpRatio,

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
) external
```

