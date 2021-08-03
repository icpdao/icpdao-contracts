//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
pragma abicoder v2;

import "./interfaces/IIcpdaoDaoTokenFactory.sol";
import "./IcpdaoDaoToken.sol";
import "./interfaces/IIcpdaoDaoToken.sol";

contract IcpdaoDaoTokenFactory is IIcpdaoDaoTokenFactory {
  address public stakingAddress;
  mapping(string => address) public tokens;

  constructor(address _stakingAddress) {
    stakingAddress = _stakingAddress;
  }

  function deploy(
    address[] memory _genesisTokenAddressList,
    uint256[] memory _genesisTokenAmountList,
    uint256 _lpRatio,
    address _ownerAddress,
    IIcpdaoDaoToken.MiningArg memory _miningArg,
    string memory daoId,
    string memory _erc20Name,
    string memory _erc20Symbol
  ) external override returns (address token) {
    if (tokens[daoId] != address(0)) {
      IIcpdaoDaoToken oldToken = IIcpdaoDaoToken(tokens[daoId]);
      require(
        oldToken.owner() == msg.sender || oldToken.isManager(msg.sender),
        "ICPDAO: NOT OWNER OR MANAGER DO REDEPLOY"
      );
    }
    token = address(
      new IcpdaoDaoToken(
        _genesisTokenAddressList,
        _genesisTokenAmountList,
        _lpRatio,
        stakingAddress,
        _ownerAddress,
        _miningArg,
        _erc20Name,
        _erc20Symbol
      )
    );
    tokens[daoId] = token;

    emit Deploy(
      _genesisTokenAddressList,
      _genesisTokenAmountList,
      _lpRatio,
      _ownerAddress,
      _miningArg,
      daoId,
      _erc20Name,
      _erc20Symbol,
      token
    );
  }
}
