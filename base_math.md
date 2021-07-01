
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



即通用的输入有:
input|type|desc
--|--|--
P|enum|函数类型
$a$|int|
$b$|int|
$c$|int|
$d$|int|

额外的, 当 $L(x)$ 是常函数时, 

input|type|desc
--|--|--
C|uint|$L(x)=C$

额外的, 当 $L(x)$ 是幂函数时,

input|type|desc
--|--|--
R|uint|$L(x)=x^r$

额外的, 当 $L(x)$ 是指数函数时,

input|type|desc
--|--|--
A|uint|$L(x)=a^x$

额外的, 当 $L(x)$ 是对数函数时,

input|type|desc
--|--|--
A|uint|$L(x)=\log_a{x}$

额外的, 当 $L(x)$ 是(反)三角函数时,

input|type|desc
--|--|--
TF|三角函数类型|$L(x)=\sin x$

$^*$ 在 solidity 中, 没有开方运算, 通用的做法是 uniswap 使用的[巴比伦算法](https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method), 同样的, 对于三角函数/对数函数, 可以使用泰勒展开表示, 结合后, 可以得到函数的高精度值.