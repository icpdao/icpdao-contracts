// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import '../libraries/MintMath.sol';

contract MintMathTest {
    MintMath.Anchor public anchor;
    uint256 public results;

    function initialize(MintMath.MintArgs memory args, uint256 time) public {
        MintMath.initialize(anchor, args, time);
    }

    function total(uint256 endTimestamp) public {
        results = MintMath.total(anchor, endTimestamp);
    }

    function mulDiv(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) public pure returns (uint256) {
        return MintMath.mulDiv(a, b, denominator);
    }
}
