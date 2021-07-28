//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./IIcpdaoDaoToken.sol";

interface IIcpdaoDaoTokenFactory {
  /// @param _genesisTokenAddressList _genesisToken 地址列表
  /// @param _genesisTokenAmountList _genesisToken 地址对应 token 分配数
  /// @param _lpRatio _temporaryToken 的值是 _genesisToken / 100 * _lpRatio
  /// @param _ownerAddress DAO Owner
  /// @param miningArg_ 挖矿产出公式参数
  /// @param _erc20Name ERC20 参数 name
  /// @param _erc20Symbol ERC20 参数 symbol
  function deploy(
    address[] memory _genesisTokenAddressList,
    uint256[] memory _genesisTokenAmountList,
    uint256 _lpRatio,
    address _ownerAddress,
    IIcpdaoDaoToken.MiningArg memory miningArg_,
    string memory daoId,
    string memory _erc20Name,
    string memory _erc20Symbol
  ) external returns (address token);
}
