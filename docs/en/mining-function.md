---
title: Mining-Function
description: Mining function for each DAO-Token
---

# Summary

Used to calculate mining output in DAO-Token, requires generic input parameters.

# Description

$x$ is the block height (number of days elapsed) from the contract deployment, $y=f(x) (x\ge0, x\subseteq N^+)$ is the token output at that block height (number of days elapsed).

Therefore, the theoretical token output is:
$$\sum_{x=1}^nf(x)$$

$^*$ in particular, $y$ is at least $0$. That is:
$$
f(x)=\begin{cases}
    f(x), & f(x)\gt0 \\
    0, & f(x)\le0
\end{cases}
$$


All mining curves $y=f(x) (x\ge0, x\subseteq N^+)$ must satisfy:
$$
y = f(x) =a^{\lceil bx+c\rceil} \ast P + d \ \ \ (其中a, b\subseteq  Q,\ P,c,d\subseteq N)
$$

For example, when $a=\frac{1}{2},\ b=1,\ c=-1,\ L(x)=10,\ d=0$
$$
y=f(x)=(\frac{1}{2})^{\lceil x-1\rceil}*10
$$


That is, the generic input parameters are :
input|type|desc
--|--|--
P|int|
$a$|fixed|
$b$|fixed|
$c$|int|
$d$|int|
