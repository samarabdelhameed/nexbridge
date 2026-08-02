// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVault} from "./interfaces/IVault.sol";

/// @title VaultBase
/// @notice Shared implementation of the NexBridge lock-and-release vault.
///         L1Vault and L2Vault both inherit from this abstract contract, keeping
///         the two chains' logic identical and auditable.
/// @dev Lock-and-release model: users deposit ETH here on the source chain and the
///      relayer releases an equivalent amount from the *other* chain's vault.
///      Per-user nonces prevent replay: each deposit gets a monotonic nonce scoped
///      to its user, and release() can only spend a (user, nonce) pair once.
abstract contract VaultBase is IVault, Ownable, Pausable, ReentrancyGuard {
    /// @notice Address authorised to call release().
    address public override relayer;

    /// @notice Per-user deposit nonce counter.
    mapping(address => uint256) public override userNonces;

    /// @notice (user, nonce) pairs that have already been released on this vault.
    mapping(address => mapping(uint256 => bool)) public override processedNonces;

    /// @notice Reject calls from anyone other than the relayer.
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Vault: not relayer");
        _;
    }

    /// @param owner_ Initial owner (deployer). Owner can set the relayer.
    constructor(address owner_) Ownable(owner_) {}

    /// @inheritdoc IVault
    function deposit() external payable override whenNotPaused nonReentrant returns (uint256 nonce) {
        require(msg.value > 0, "Vault: zero amount");

        nonce = userNonces[msg.sender]++;
        emit Deposited(msg.sender, msg.value, nonce);
    }

    /// @inheritdoc IVault
    function release(
        address to,
        uint256 amount,
        uint256 nonce
    ) external override onlyRelayer whenNotPaused nonReentrant {
        require(to != address(0), "Vault: zero address");
        require(amount > 0, "Vault: zero amount");
        require(!processedNonces[to][nonce], "Vault: nonce already processed");
        require(address(this).balance >= amount, "Vault: insufficient liquidity");

        processedNonces[to][nonce] = true;

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Vault: ETH transfer failed");

        emit Released(to, amount, nonce);
    }

    /// @inheritdoc IVault
    function setRelayer(address newRelayer) external override onlyOwner {
        require(newRelayer != address(0), "Vault: zero address");
        relayer = newRelayer;
        emit RelayerSet(newRelayer);
    }

    /// @inheritdoc IVault
    function pause() external override onlyOwner {
        _pause();
    }

    /// @inheritdoc IVault
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @inheritdoc IVault
    function emergencyWithdraw() external override onlyOwner {
        require(paused(), "Vault: not paused");
        uint256 balance = address(this).balance;
        require(balance > 0, "Vault: nothing to withdraw");

        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "Vault: ETH transfer failed");
    }

    /// @notice Allow the contract to receive ETH (liquidity seeding).
    receive() external payable {}
}
