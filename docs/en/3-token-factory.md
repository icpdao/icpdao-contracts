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

/// @param _stakingAddress ICPDAO-Staking contract address
constructor (
    address _stakingAddress
)

//// @param _genesisTokenAddressList _genesisToken address list
/// @param _genesisTokenAmountList _genesisToken address corresponding token allocation number
/// @param _lpRatio _temporaryToken value is _genesisToken / 100 * _lpRatio
/// @param _ownerAddress DAO Owner
/// @param _miningArgs Mineral extraction formula parameters
/// @param _erc20 ERC20 parameter
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

