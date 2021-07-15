// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import './IDAOPermission.sol';
import './IDAOEvents.sol';

interface IDAOToken is 
    IDAOPermission,
    IDAOEvents
{
    function createLPPool(
        uint256 _baseTokenAmount,
        address _quoteTokenAddress,
        uint256 _quoteTokenAmount,
        uint24 _fee,
        int24 _tickLower,
        int24 _tickUpper,
        uint160 _sqrtPriceX96,
        uint256 _deadline
    ) external payable;

    function updateLPPool(
        uint256 _baseTokenAmount,
        uint256 _deadline
    ) external;

    function mint(
        address[] memory _mintTokenAddressList,
        uint256[] memory _mintTokenAmountList,
        uint256 _endTimestamp,
        uint256 _deadline
    ) external;

    function bonusWithdraw() external;
}