// SPDX-License-Identifier: GPL-2.0+
pragma solidity >=0.8.4;

/// @title Events emitted by a DAO.
/// @notice Contains all events emitted by a DAO.
interface IDAOEvents {
    /// @notice Emitted when the DAO is created.
    event NewDAO();

    /// @notice Emitted when the DAO manger minted.
    event Mint();

}