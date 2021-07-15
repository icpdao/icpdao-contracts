// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import './interfaces/IDAOFactory.sol';
import './DAOToken.sol';


contract DAOFactory is IDAOFactory {
    mapping (address => bool) public tokens;
    address public immutable staking;
    constructor (
        address _stakingAddress
    ) {
        staking = _stakingAddress;
    }

    function deploy(
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        address _ownerAddress,
        uint256[7] memory _miningArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external override returns (address token) {
        token = address(new DAOToken{salt: keccak256(abi.encode("ICPDAO", _erc20Name, _erc20Symbol))}(
            _genesisTokenAddressList, _genesisTokenAmountList,
            _lpRatio, staking, _ownerAddress, _miningArgs, _erc20Name, _erc20Symbol
        ));
        tokens[token] = true;
    }
}