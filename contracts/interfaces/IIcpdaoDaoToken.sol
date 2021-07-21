//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

interface IIcpdaoDaoToken {
  /// @param _baseTokenAmount 需要放置的 token0 数量, _baseTokenAmount <= _temporaryToken
  /// @param _quoteTokenAddress 需要放置的报价 token1 的地址
  /// @param _quoteTokenAmount 需要放置的报价 token1 的数量
  function createLPPool(
    uint256 _baseTokenAmount,
    address _quoteTokenAddress,
    uint256 _quoteTokenAmount,
    uint24 fee,
    uint160 sqrtPriceX96,
    int24 tickLower,
    int24 tickUpper
  ) external payable;

  /// @param _baseTokenAmount 需要添加的 token0 数量, _baseTokenAmount <= _temporaryToken
  function updateLPPool(uint256 _baseTokenAmount) external;

  /// @param _mintTokenAddressList 挖矿分配给 DAO 贡献者的地址列表
  /// @param _mintTokenAmountList 挖矿分配给 DAO 贡献者的对应数量
  /// @param _endTimestap 本次挖矿周期是 [_beginTimestap, _endTimestap],
  ///   _beginTimestap 是上一次 _endTimestap 或者合约部署时间(当第一次挖矿时)
  ///   _endTimestap <= block.timestap
  /// @param tickLower 挖矿时传 range order 下区间
  /// @param tickUpper 挖矿时传 range order 上区间, 一般无限大
  function mint(
    address[] calldata _mintTokenAddressList,
    uint24[] calldata _mintTokenAmountList,
    uint256 _endTimestap,
    int24 tickLower,
    int24 tickUpper
  ) external;

  function bonusWithdraw() external;

  function bonusWithdrawByTokenIdList(uint256[] memory tokenIdList) external;
}
