// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

/// @title A DAO Staking interface
/// @notice staking token must be ICP, so only deployer can set once ICP address.
interface IDAOStaking {
    /// @notice Emitted when deposit.
    /// @dev The bounty will be settled before the deposit
    /// @param user The deposit user address
    /// @param amount The deposit amount
    event Deposit(address indexed user, uint256 amount);
    event UpdateBonus(address indexed token, uint256 amount, uint256 accPerShare, uint256 lastRewardBlock);
    event Bonus(address indexed token, address user, uint256 reward);
    event Withdraw(address indexed user, uint256 amount);
    event AddTokenList(address indexed user, address[] tokenList);
    event RemoveTokenList(address indexed user, address[] tokenList);
    event TransferOwnership(address _newOwner);

    function totalStaking() external returns (uint256);

    function ICPD() external returns (address);

    function destruct() external;

    function userInfo(address _user) external returns (uint256 amount, address[] memory tokens);

    function userRewardDebt(address _user, address _token) external returns (uint256 rewardDebt);

    function poolInfo(address _token)
        external
        returns (
            uint256 accPerShare,
            uint256 userStakingIcpdAmount,
            uint256 blanceHaveMintAmount
        );

    function setICPToken(address _ICP) external;

    function deposit(uint256 _amount, address[] memory _tokenList) external;

    function addTokenList(address[] memory _tokenList) external;

    function removeTokenList(address[] memory _tokenList) external;

    function tokenList(address _user) external view returns (address[] memory);

    function bonus(address _user) external view returns (address[] memory, uint256[] memory);

    function bonusWithdraw(address[] memory _token_list) external;

    function withdraw(uint256 _amount) external;

    function owner() external view returns (address);

    function transferOwnership(address payable _newOwner) external;
}
