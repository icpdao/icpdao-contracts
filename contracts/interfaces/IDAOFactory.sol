// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

interface IDAOFactory {
    function deploy(
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        address _ownerAddress,
        uint256[7] memory _miningArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external returns (address token);
}