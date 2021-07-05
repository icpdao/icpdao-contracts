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

/// @param _stakingAddress ICPDAO-Staking 合约地址
constructor (
    address _stakingAddress
)

/// @param _genesisTokenAddressList _genesisToken 地址列表
/// @param _genesisTokenAmountList _genesisToken 地址对应 token 分配数
/// @param _lpRatio _temporaryToken 的值是 _genesisToken / 100 * _lpRatio
/// @param _ownerAddress DAO Owner
/// @param _miningArgs 挖矿产出公式参数
/// @param _erc20 ERC20 参数
function deploy(
    address[] _genesisTokenAddressList,
    uint256[] _genesisTokenAmountList,

    uint256 _lpRatio,

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
) external
```

