---
title: Mining-Function
description: 每个 DAO-Token 的挖矿产出函数
---

# 概要

用于 DAO-Token 中计算挖矿产出, 需要提供通用输入参数.

# 说明

$x$ 是距离合约部署的区块高度(经过的天数), $y=f(x) (x\ge0, x\subseteq N^+)$ 是在该区块高度(经过的天数)上的 token 产出.

因此, 理论上 token 的产出是:
$$\sum_{x=1}^nf(x)$$

$^*$ 特殊的, $y$ 最小为 $0$. 即:
$$
f(x)=\begin{cases}
    f(x), & f(x)\gt0 \\
    0, & f(x)\le0
\end{cases}
$$


所有的挖矿曲线 $y=f(x) (x\ge0, x\subseteq N^+)$ 必须满足:
$$
y = f(x) =a^{\lceil bx+c\rceil} \ast P + d \ \ \ (其中a, b\subseteq  Q,\ P,c,d\subseteq N)
$$

例如, 当 $a=\frac{1}{2},\ b=1,\ c=-1,\ L(x)=10,\ d=0$ 时
$$
y=f(x)=(\frac{1}{2})^{\lceil x-1\rceil}*10
$$


即通用的输入参数有:
input|type|desc
--|--|--
P|int|
$a$|fixed|
$b$|fixed|
$c$|int|
$d$|int|
