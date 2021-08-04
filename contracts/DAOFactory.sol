// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;


import '@openzeppelin/contracts/utils/Context.sol';

import './interfaces/IDAOFactory.sol';
import './interfaces/IDAOToken.sol';
import './libraries/MintMath.sol';
import './DAOToken.sol';


contract DAOFactory is Context, IDAOFactory {
    
    mapping (string => address) public override tokens;

    address public immutable override staking;
    
    constructor (
        address _stakingAddress
    ) {
        staking = _stakingAddress;
    }

    function deploy(
        string memory _daoID,
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        address _ownerAddress,
        MintMath.MintArgs memory _mintArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external override returns (address token) {
        if (tokens[_daoID] != address(0)) {
            IDAOToken oldToken = IDAOToken(tokens[_daoID]);
            require(_msgSender() == oldToken.owner(), "ICPDAO: NOT OWNER DO REDEPLOY");
        }
        token = address(new DAOToken(
            _genesisTokenAddressList, _genesisTokenAmountList,
            _lpRatio, staking, _ownerAddress, _mintArgs, _erc20Name, _erc20Symbol
        ));
        tokens[_daoID] = token;
        emit Deploy(_daoID, _genesisTokenAddressList, _genesisTokenAmountList, _lpRatio, _ownerAddress, _mintArgs, _erc20Name, _erc20Symbol, token);
    }
}