// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import './interfaces/IDAOFactory.sol';
import './interfaces/IDAOToken.sol';
import './DAOToken.sol';


contract DAOFactory is IDAOFactory {
    mapping (string => address) public tokens;

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
        string memory _daoID,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external override returns (address token) {
        if (tokens[_daoID] != address(0)) {
            IDAOToken oldToken = IDAOToken(tokens[_daoID]);
            require(oldToken.isManager(msg.sender) || msg.sender == oldToken.owner(), "ICPDAO: NOT OWNER OR MANAGER DO REDEPLOY");
        }
        token = address(new DAOToken(
            _genesisTokenAddressList, _genesisTokenAmountList,
            _lpRatio, staking, _ownerAddress, _miningArgs, _erc20Name, _erc20Symbol
        ));
        tokens[_daoID] = token;
    }
}