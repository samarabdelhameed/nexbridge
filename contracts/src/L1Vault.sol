// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultBase} from "./VaultBase.sol";

/// @title L1Vault
/// @notice NexBridge vault deployed on Sepolia (Ethereum L1 testnet).
/// @dev See VaultBase for the full implementation. This concrete contract exists
///      so the two chains deploy independent instances with distinct addresses.
contract L1Vault is VaultBase {
    constructor(address owner_) VaultBase(owner_) {}
}
