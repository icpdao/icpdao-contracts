// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

library MintMath {
    struct Anchor {
        int256[7] args;
        uint256 lastTimestamp;
        uint256 lastValue;
    }

    function initialize(
        Anchor storage last,
        int256[7] memory args,
        uint256 time
    ) internal returns (uint256 result) {
        last.args = args;
        last.lastTimestamp = time;
        int256 p = args[0];
        int256 an = args[1];
        int256 ad = args[2];
        int256 c = args[5];
        int256 d = args[6];
        assembly {
            let a := div(an, ad)
            result := 1
            for { let i := 0 } lt(i, c) { i := add(i, 1) }
            {
                result := mul(result, a)
            }
            result := add(mul(result, p), d)
        }
        return result;
    }

    function total(
        Anchor storage last,
        uint256 endTimestamp
    ) internal returns (uint256 result) {
        int256 d = last.args[6];
        uint256 lastTimestamp = last.lastTimestamp;
        uint256 lastValue = last.lastValue;
        int256 an = last.args[1];
        int256 ad = last.args[2];
        int256 bn = last.args[3];
        int256 bd = last.args[4];
        assembly {
            let n := div(sub(endTimestamp, lastTimestamp), 86400)
            let b := div(bn, bd)
            let a := div(an, ad)
            let aPowerB := 0
            for { let i := 0 } lt(i, b) { i := add(i, 1) }
            {
                aPowerB := mul(result, a)
            }
            result := lastValue
            for {let i:= 0} lt(i, n) { i := add(i, 1) }
            {
                lastValue := add(mul(lastValue, aPowerB), mul(d, sub(1, aPowerB)))
                result := mul(result, lastValue)
            }
        }
        last.lastTimestamp = endTimestamp;
        last.lastValue = lastValue;
        return result;
    }
}