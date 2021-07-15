// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import '../libraries/MintMath.sol';

contract MintMathTest {
    MintMath.Anchor public anchor;
    function initialize(
        int256[7] memory args,
        uint256 time
    ) public {
        MintMath.initialize(anchor, args, time);
    }

    function total(
        uint256 endTimestamp
    ) public returns (uint256 result) {
        result = MintMath.total(anchor, endTimestamp);
    }
}