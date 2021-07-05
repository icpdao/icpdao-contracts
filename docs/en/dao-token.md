---
title: DAO-Token
description: The token issued by each DAO through ICPDAO deployment
---

# Summary

Each DAO created on ICPDAO can deploy a DAO-Token contract through ICPDAO, i.e., issue a token of its own DAO.

The DAO Owner can deploy this DAO-Token contract on Ether by calling the Token-Factory contract provided by ICPDAO. Besides, ICPDAO does not recognize DAO-Token contracts created by other means.

A DAO-Token is essentially a Token contract with various characteristics that meet the ERC20 specification.

# Description


## Permissions

```solidity
/// @notice owner can add a manager
function addManager(address manager) external

/// @notice owner can remove a manager
function removeManager(address manager) external

/// @notice only owner and manage have permission
modifier onlyOwnerOrManager {
    // ...
    _;
}
```


## Genesis
When the contract is deployed, you can specify and allocate the genesis token `_genesisToken`, and you must reserve a proportion of the token for the LP pool of uniswap v3 `_temporaryToken`.

Also, you need to specify the ICPDAO-Staking contract address, DAO Owner wallet address, [mining formula parameters](./mining-function.md) and ERC20 parameters.

```solidity
/// @param _genesisTokenAddressList _genesisToken address list
/// @param _genesisTokenAmountList _genesisToken addresses corresponding to the number of token allocations
/// @param _lpRatio _temporaryToken value is _genesisToken / 100 * _lpRatio
/// @param _stakingAddress ICPDAO-Staking contract address
/// @param _ownerAddress DAO Owner
/// @param _miningArgs Mining formula parameters
/// @param _erc20 ERC20 Parameters
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

## Create pairs and add liquidity

### Creating a transaction pair
After the contract is deployed, the DAO Owner can add a portion of `_temporaryToken` and another token (i.e. `_quoteToken`) to a pair as an LP pool for uniswap v3 (i.e. `_tokenLPPool`). 

`_tokenLPPool` will be the only LP pool to which liquidity is automatically added for contract mining.

The `_quoteToken` type is generally a token that already has some consensus. for example, eth/usdc/dai.

```solidity
/// @param _baseTokenAmount Number of tokens0 to be placed, _baseTokenAmount <= _temporaryToken
/// @param _quoteTokenAddress The address of the quote token1 to be placed
/// @param _quoteTokenAmount the number of quote tokens1 to be placed
function createLPPool(
    uint256 _baseTokenAmount

    address _quoteTokenAddress
    uint256 _quoteTokenAmount

) external onlyOwnerOrManager
```

### Add mobility
The remaining `_temporaryToken` can be added to the `_tokenLPPool` by the DAO Owner at any time in any amount, multiple times. With uniswap v3's range order single coin additions.

```solidity
/// @param _baseTokenAmount Number of tokens0 to be added, _baseTokenAmount <= _temporaryToken
function updateLPPool(
    uint256 _baseTokenAmount
) external onlyOwnerOrManager
```

## Mining

After the contract is deployed, it has a mining function, each mining needs to pass in a mining deadline, and only the owner and manger can call the mining interface.

One part of the token generated during mining is distributed to the contributors of the DAO. 

The other part depends on the existence of the `_tokenLPPool` to determine its destination. 

If `_tokenLPPool` exists, it is added as a single coin, otherwise, it is added to `_temporaryToken`.

```solidity
/// @param _mintTokenAddressList List of addresses assigned to DAO contributors by mining
/// @param _mintTokenAmountList The corresponding number of digs assigned to DAO contributors
/// @param _endTimestap The current mining cycle is [_beginTimestap, _endTimestap], 
/// _beginTimestap is the last _endTimestap or contract deployment time (when first mined)
/// _endTimestap <= block.timestap
/// @param tickLower pass range order down interval when mining
/// @param tickUpper pass range order upper interval when mining, generally infinite
function mint(
    address[] _mintTokenAddressList,
    uint256[] _mintTokenAmountList,

    uint256 _endTimestap,

    int24 tickLower,
    int24 tickUpper,
) external onlyOwnerOrManager
```

## Pledge
The contract has a transaction fee of `_tokenLPPool`, which can be added to the ICPDAO-Staking contract by calling this method to pledge ICP (ICPDAO governance coin) rewards. This incentivizes the growth of the ICPDAO community.

99% of the transferred fees will be transferred into the ICPDAO-Staking contract, and 1% will be used as a reward for the caller.

```solidity
function bonusWithdraw external
```
