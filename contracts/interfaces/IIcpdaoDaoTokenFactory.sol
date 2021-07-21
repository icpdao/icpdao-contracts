//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

interface IIcpdaoDaoTokenFactory {
  /// @param _genesisTokenAddressList _genesisToken 地址列表
  /// @param _genesisTokenAmountList _genesisToken 地址对应 token 分配数
  /// @param _lpRatio _temporaryToken 的值是 _genesisToken / 100 * _lpRatio
  /// @param _ownerAddress DAO Owner
  /// @param _miningArgsP 挖矿产出公式参数 P
  /// @param _miningArgsANumerator 挖矿产出公式参数 A Numerator
  /// @param _miningArgsADenominator 挖矿产出公式参数 A Denominator
  /// @param _miningArgsBNumerator 挖矿产出公式参数 B Numerator
  /// @param _miningArgsBDenominator 挖矿产出公式参数 B Denominator
  /// @param _miningArgsC 挖矿产出公式参数 C
  /// @param _miningArgsD 挖矿产出公式参数 D
  /// @param _erc20Name ERC20 参数 name
  /// @param _erc20Symbol ERC20 参数 symbol
  function deploy(
    address[] calldata _genesisTokenAddressList,
    uint256[] calldata _genesisTokenAmountList,
    uint256 _lpRatio,
    address _ownerAddress,
    int256 _miningArgsP,
    int256 _miningArgsANumerator,
    int256 _miningArgsADenominator,
    int256 _miningArgsBNumerator,
    int256 _miningArgsBDenominator,
    int256 _miningArgsC,
    int256 _miningArgsD,
    string calldata _erc20Name,
    string calldata _erc20Symbol
  ) external;
}
