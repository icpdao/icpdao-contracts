// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

interface IDAOFactoryStore {
    function tokens(string memory _daoID) external view returns (address token, uint256 version);

    function isFactory(address addr) external view returns (bool);

    function staking() external view returns (address);

    function addToken(
        string memory _daoId,
        address token,
        uint256 version
    ) external;

    function setStaking(address _staking) external;

    function addFactory(address _factory) external;

    function removeFactory(address _factory) external;
}
