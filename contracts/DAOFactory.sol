// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import '@openzeppelin/contracts/utils/Context.sol';

import './interfaces/IDAOFactory.sol';
import './interfaces/IDAOToken.sol';
import './libraries/MintMath.sol';
import './DAOToken.sol';

contract DAOFactory is Context, IDAOFactory {
    address payable private _owner;

    mapping(string => address) public override tokens;

    address public immutable override staking;

    constructor(address payable _ownerAddress, address _stakingAddress) {
        _owner = _ownerAddress;
        staking = _stakingAddress;
    }

    function destruct() external override {
        require(_owner == _msgSender(), 'ICPDAO: ONLY OWNER CAN CALL DESTRUCT');
        selfdestruct(_owner);
    }

    function deploy(
        string memory _daoID,
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        uint256 _lpTotalAmount,
        address payable _ownerAddress,
        MintMath.MintArgs memory _mintArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external override returns (address token) {
        if (tokens[_daoID] != address(0)) {
            IDAOToken oldToken = IDAOToken(tokens[_daoID]);
            require(_msgSender() == oldToken.owner(), 'ICPDAO: NOT OWNER DO REDEPLOY');
        }
        token = address(
            new DAOToken(
                _genesisTokenAddressList,
                _genesisTokenAmountList,
                _lpRatio,
                _lpTotalAmount,
                staking,
                _ownerAddress,
                _mintArgs,
                _erc20Name,
                _erc20Symbol
            )
        );
        tokens[_daoID] = token;
        emit Deploy(
            _daoID,
            _genesisTokenAddressList,
            _genesisTokenAmountList,
            _lpRatio,
            _lpTotalAmount,
            _ownerAddress,
            _mintArgs,
            _erc20Name,
            _erc20Symbol,
            token
        );
    }

    function owner() external view override returns (address) {
        return _owner;
    }

    function transferOwnership(address payable _newOwner) external override {
        require(msg.sender == _owner, 'ICPDAO: NOT OWNER');
        require(_newOwner != address(0), 'ICPDAO: NEW OWNER INVALID');
        _owner = _newOwner;
    }
}
