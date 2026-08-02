// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IVault
/// @notice Shared interface for the NexBridge lock-and-release vaults.
///         Both L1Vault (Sepolia) and L2Vault (Abstract Testnet) implement
///         this interface so the relayer and frontend can use a single ABI type.
interface IVault {
    /// @notice Emitted when a user locks ETH in the vault.
    /// @param user The address that deposited.
    /// @param amount The amount of ETH locked (wei).
    /// @param nonce The per-user nonce assigned to this deposit.
    event Deposited(address indexed user, uint256 indexed amount, uint256 indexed nonce);

    /// @notice Emitted when the relayer releases ETH to a user on the destination chain.
    /// @param to The address receiving the released ETH.
    /// @param amount The amount of ETH released (wei).
    /// @param nonce The nonce of the originating deposit.
    event Released(address indexed to, uint256 indexed amount, uint256 indexed nonce);

    /// @notice Emitted when the relayer address is changed.
    /// @param newRelayer The new relayer address.
    event RelayerSet(address indexed newRelayer);

    /// @notice Lock ETH into the vault (source-chain side of a bridge transfer).
    /// @return nonce The per-user nonce assigned to this deposit.
    function deposit() external payable returns (uint256 nonce);

    /// @notice Release ETH to `to` on the destination chain. Relayer only.
    /// @param to Destination address receiving the funds.
    /// @param amount Amount of ETH (wei) to release.
    /// @param nonce The deposit nonce this release corresponds to.
    function release(address to, uint256 amount, uint256 nonce) external;

    /// @notice Update the relayer address. Owner only.
    function setRelayer(address newRelayer) external;

    /// @notice Pause deposits and releases. Owner only.
    function pause() external;

    /// @notice Resume deposits and releases. Owner only.
    function unpause() external;

    /// @notice Owner-only emergency withdrawal, only while paused, for stuck-funds recovery.
    function emergencyWithdraw() external;

    /// @notice The address authorised to call release().
    function relayer() external view returns (address);

    /// @notice Per-user deposit nonce counter.
    function userNonces(address user) external view returns (uint256);

    /// @notice Whether a (user, nonce) pair has already been released on this vault.
    function processedNonces(address user, uint256 nonce) external view returns (bool);
}
