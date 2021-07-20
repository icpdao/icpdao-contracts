// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

library AddressArray {
    function find(address[] storage addr, address ele) internal view returns (uint256) {
        for (uint256 i = 0; i < addr.length; i++) {
            if (addr[i] == ele) {
                return i;
            }
        }
        return addr.length;
    }

    function setAppend(address[] storage addr, address ele) internal {
        require(ele != address(0));
        uint256 index = find(addr, ele);
        if (index == addr.length) {
            addr.push(ele);
        }
    }

    function setRemove(address[] storage addr, address ele) internal {
        require(ele != address(0));
        uint256 index = find(addr, ele);
        if (index < addr.length) {
            delete addr[index];
        }
    }

}