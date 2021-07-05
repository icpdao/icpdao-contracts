---
title: ICPDAO-Staking
description: 质押 ICPDAO 治理币获得各 DAO-Token 的分红
---

# 概要

质押 ICP(ICPDAO 治理币), 可以获得多个币种组成的分红, 这些分红由 ICPDAO 下的各个 DAO-Token 的 uniswap v3 的交易手续费组成.

注意, 只有套利者主动调用 DAO-Token 的 bonusWithdraw 方法后, 手续费才会被转账到 ICPDAO-Staking 合约, 从而产生分红.

# 说明

假设有 token0 这种 DAO-Token, 会有如下交互:

1. 套利者主动调用 DAO-Token 的 bonusWithdraw 方法后, 手续费会被转账到 ICPDAO-Staking 合约, 手续费可能是 DAO-Token 的 _tokenLPPool 的 token0(baseToken) / token1(quoteToken), 这个动作只会影响 ICPDAO-Staking 的 token0 和 token1 余额, 不会改变 ICPDAO-Staking 合约的任何其他内容.
2. 用户可以向 ICPDAO-Staking 质押一定数量的 ICP.
3. 已经质押了 ICP 的用户, 可以单独增加/删除自己要提取分红的 token 列表

## 质押

```solidity
/// @notice 增加质押, 如果用户以前已经有质押，并且增加过分红 token 列表, 需要先结算一下分红，再增加
/// @param _amount 质押 ICP 的数量
/// @param _tokenList 提供的分红列表, 用户质押时可以进行删改
function deposit(
    uint256 _amount, 
    address[] _tokenList,
) external
```

## 分红列表

1. 用户需要主动选择一个有限的分红列表，列表长度不做业务限制，但是需要提醒用户长度太长的弊端
2. 用户可以增加/删除和查看分红列表

```solidity
/// @notice 增加/删除分红列表, 用户质押后可以进行分红列表删改.
function addTokenList(address[] _tokenList) external
function removeTokenList(address[] _tokenList) external
/// @notice 查看分红详情
/// @return token 地址列表
function tokenList external view returns (address[])
```

## 查看和提取分红

```solidity
/// @notice 计算截止到当前 msg.sender 可以获取 _token_list 对应的 token 种类的分红
/// @return bonus 地址及地址对应的数量
function bonus external view returns (address[], uint256[])

/// @notice 提取自己在 _token_list 对应的 token 种类的分红
function bonusWithdraw(address[] _token_list) external
```

## 退出质押

```solidity
/// @notice 带分红退出质押, 需要先结算一下分红，再退出
/// @param _amount 提取 ICP 的数量
function withdraw(uint256 _amount) external
```
