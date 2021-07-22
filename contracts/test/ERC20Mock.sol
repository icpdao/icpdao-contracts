// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import '../interfaces/IDAOPermission.sol';

contract ERC20Mock is ERC20, IDAOPermission {
    address private immutable _owner;
    mapping (address=>bool) public managers;
    
    constructor (
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList
    ) ERC20("Mock", "MOCK") {
        for (uint256 i = 0; i < _genesisTokenAddressList.length; i++) {
            _mint(_genesisTokenAddressList[i], _genesisTokenAmountList[i]);
        }
        _owner = _msgSender();
    }

    modifier onlyOwner() {
        require(_msgSender() == _owner, "ICPDAO: NOT OWNER");
        _;
    }

    modifier onlyOwnerOrManager() {
        require(managers[_msgSender()] || _msgSender() == _owner, "NOT OWNER OR MANAGER");
        _;
    }

    function owner() external view virtual override returns (address) {
        return _owner;
    }

    function isManager(address _address) external view virtual override returns (bool) {
        return managers[_address];
    }

    function addManager(address manager) external override onlyOwner {
        require(manager != address(0), "ICPDAO: MANGAGER IS ZERO");
        managers[manager] = true;
    }

    function removeManager(address manager) external override onlyOwner {
        require(manager != address(0), "ICPDAO: MANAGER IS ZERO");
        managers[manager] = false;
    }
}