---
title: Token-Factory
description: DAO Owner calls Token-Factory contract to deploy DAO-Token
---

# Summary

All DAO-Tokens recognized by ICPDAO must be deployed by the Token-Factory.

# Description

## Deploy DAO-Token

Parameter reference: [DAO-Token](./dao-token.md#Genesis)

TokenFactory has a tokens variable to record the list of deployed DAO-Tokens, DAO-Tokens must be deployed by TokenFactory.deploy to ensure that the tokens are recorded in the correct list.

```solidity
mapping (address => bool) public tokens;

constructor (
    // ICPDAO-Staking contract address
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

    // Mineral extraction formula parameters, note if floating point is available
    int256 _miningArgsP,
    int256 _miningArgsANumerator,
    int256 _miningArgsADenominator,
    int256 _miningArgsBNumerator,
    int256 _miningArgsBDenominator,
    int256 _miningArgsC,
    int256 _miningArgsD,

    // ERC20 parameters
    string _erc20Name,
    string _erc20Symbol
) external
```

