// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '../interfaces/IDAOPermission.sol';

contract ERC20Mock is ERC20, IDAOPermission {
    using EnumerableSet for EnumerableSet.AddressSet;

    address payable private _owner;
    EnumerableSet.AddressSet private _managers;

    constructor(
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) ERC20(_erc20Name, _erc20Symbol) {
        for (uint256 i = 0; i < _genesisTokenAddressList.length; i++) {
            _mint(_genesisTokenAddressList[i], _genesisTokenAmountList[i]);
        }
        _owner = payable(_msgSender());
    }

    modifier onlyOwner() {
        require(_msgSender() == _owner, 'ICPDAO: NOT OWNER');
        _;
    }

    modifier onlyOwnerOrManager() {
        require(_managers.contains(_msgSender()) || _msgSender() == _owner, 'NOT OWNER OR MANAGER');
        _;
    }

    function owner() external view virtual override returns (address) {
        return _owner;
    }

    function transferOwnership(address payable _newOwner) external override {
        _owner = _newOwner;
    }

    function managers() external view override returns (address[] memory) {
        address[] memory _managers_ = new address[](_managers.length());
        for (uint256 i = 0; i < _managers.length(); i++) {
            _managers_[i] = _managers.at(i);
        }
        return _managers_;
    }

    function isManager(address _address) external view override returns (bool) {
        return _managers.contains(_address);
    }

    function addManager(address manager) external override onlyOwner {
        require(manager != address(0), 'ICPDAO: MANGAGER IS ZERO');
        _managers.add(manager);
    }

    function removeManager(address manager) external override onlyOwner {
        require(manager != address(0), 'ICPDAO: MANAGER IS ZERO');
        _managers.remove(manager);
    }
}
