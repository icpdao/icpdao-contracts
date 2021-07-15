// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import '../libraries/FullMath.sol';

contract FullMathTest {
    function divMul(uint a, uint b, uint c) public pure returns (uint) {
        return FullMath.divMul(a, b, c);
    }
}