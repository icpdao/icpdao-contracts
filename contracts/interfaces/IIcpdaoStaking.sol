//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

interface IIcpdaoStaking {
  function mint(address token) external;

  /// @notice 增加质押, 如果用户以前已经有质押，并且增加过分红 token 列表, 需要先结算一下分红，再增加
  /// @param _amount 质押 ICP 的数量
  /// @param _tokenList 提供的分红列表, 用户质押时可以进行删改
  function deposit(uint256 _amount, address[] calldata _tokenList) external;

  function withdraw(uint256 _amount) external;

  /// @notice 增加/删除分红列表, 用户质押后可以进行分红列表删改.
  function addTokenList(address[] calldata _tokenList) external;

  function removeTokenList(address[] calldata _tokenList) external;

  /// @notice 查看分红详情
  /// @return token 地址列表
  function tokenList(address user) external view returns (address[] memory);

  function bonus(address user)
    external
    view
    returns (address[] memory _tokenList, uint256[] memory _amountList);

  /// @notice 提取自己在 _token_list 对应的 token 种类的分红
  function bonusWithdraw(address[] memory _token_list) external;
}
