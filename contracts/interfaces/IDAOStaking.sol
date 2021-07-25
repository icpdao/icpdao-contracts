// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

interface IDAOStaking {
    event Deposit(address indexed user, uint256 amount);
    event UpdateBonus(address indexed token, uint256 amount, uint256 accPerShare, uint256 lastRewardBlock);
    event Bonus(address indexed token, address user, uint256 reward);
    event Withdraw(address indexed user, uint256 amount);
    
    event AddTokenList(address indexed user, address[] tokenList);
    event RemoveTokenList(address indexed user, address[] tokenList);

    function setICPToken(address _ICP) external;
    
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

    function tokenList(address _user) external view returns (address[] memory);

    function bonus(address _user) external returns (address[] memory, uint256[] memory);

    /// @notice 提取自己在 _token_list 对应的 token 种类的分红
    function bonusWithdraw(
        address[] memory _token_list
    ) external;
    
    function withdraw(
        uint256 _amount
    ) external;
}