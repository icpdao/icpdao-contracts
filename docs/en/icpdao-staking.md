---
title: ICPDAO-Staking
description: Pledge ICPDAO governance coins to receive dividends from each DAO-Token
---

# Summary

By pledging ICP (ICPDAO governance coins), you can receive dividends in multiple coins, which consist of the transaction fees of uniswap v3 of each DAO-Token under ICPDAO.

Note that only when the arbitrageur actively calls the bonusWithdraw method of the DAO-Token, the processing fee is transferred to the ICPDAO-Staking contract and the bonus is generated.

# Explanation

Assuming that there is a DAO-Token like token0, there will be the following interactions. 1:

After the arbitrageur actively calls the bonusWithdraw method of the DAO-Token, the fee will be transferred to the ICPDAO-Staking contract, and the fee may be token0(baseToken) / token1 of the _tokenLPPool of the DAO-Token (quoteToken), this action will only affect the token0 and token1 balance of ICPDAO-Staking, and will not change anything else in the ICPDAO-Staking contract. 2.
2. The user can pledge a certain amount of ICPs to ICPDAO-Staking. 3.
3. Users who have already pledged ICPs can add/remove their own token list for withdrawing dividends

## Pledge

```solidity
/*
  Add pledge, _amount is the number of pledged ICPs
  If the user already has a pledge and has added a list of bonus tokens
  you need to settle the dividend first, and then add
*/
function deposit(
    // The number of pledges
    uint256 _amount, 
    // A list of provided bonuses, which can be changed when the user pledges.
    address[] _tokenList,
) external
```

## Dividend List

1. the user needs to actively select a limited list of dividends, the length of the list is not limited to the business, but the user needs to be reminded of the disadvantages of too long a length
2. user can add/remove and view the dividend list

```solidity
// Add/delete bonus list, user can delete/remove bonus list after pledge.
function addTokenList(address[] _tokenList) external
function removeTokenList(address[] _tokenList) external
// View bonus details
function tokenList external view returns (address[])
```

## View and extract dividends

```solidity
// Calculate the bonus for the token type corresponding to _token_list as of the current msg.sender
function bonus external view returns (address[], uint256[])

// Draw your own bonus of the token type corresponding to _token_list
function bonusWithdraw(address[] _token_list) external
```

## Exit pledge

```solidity
/*
  Exit pledge with bonus
  _amount is the number of ICP withdrawals
  You need to settle the dividends first, then exit
*/
function withdraw(uint256 _amount) external
```
