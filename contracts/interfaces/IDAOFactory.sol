// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

import '../libraries/MintMath.sol';

/// @title DAOFactory interface.
/// @notice to be used deploy daotoken contract.
interface IDAOFactory {
    event Deploy(
        string indexed _daoID,
        address[] _genesisTokenAddressList,
        uint256[] _genesisTokenAmountList,
        uint256 _lpRatio,
        address _ownerAddress,
        MintMath.MintArgs _mintArgs,
        string _erc20Name,
        string _erc20Symbol,
        address _token
    );

    function destruct() external;

    /// @notice Get DAOToken address by daoID.
    /// @param _daoID A unique ID provided by the ICPDAO.
    /// @return DAOToken address.
    function tokens(string memory _daoID) external view returns (address);

    function staking() external view returns (address);

    function deploy(
        string memory _daoID,
        address[] memory _genesisTokenAddressList,
        uint256[] memory _genesisTokenAmountList,
        uint256 _lpRatio,
        address payable _ownerAddress,
        MintMath.MintArgs memory _mintArgs,
        string memory _erc20Name,
        string memory _erc20Symbol
    ) external returns (address token);

    function owner() external view returns (address);

    function transferOwnership(address payable _newOwner) external;
}
