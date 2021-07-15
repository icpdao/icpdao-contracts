// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

interface IDAOStaking {
    function deposit(
        uint256 _amount, 
        address[] memory _tokenList
    ) external;

    function addTokenList(
        address[] memory _tokenList
    ) external;

    function removeTokenList(
        address[] memory _tokenList
    ) external;

    function tokenList() external view returns (address[] memory);

    function bonus() external view returns (address[] memory, uint256[] memory);

    /// @notice 提取自己在 _token_list 对应的 token 种类的分红
    function bonusWithdraw(
        address[] memory _token_list
    ) external;
    
    function withdraw(
        uint256 _amount
    ) external;
}