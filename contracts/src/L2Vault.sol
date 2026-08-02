// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultBase} from "./VaultBase.sol";

/// @title L2Vault
/// @notice NexBridge vault deployed on Abstract Testnet (L2).
/// @dev See VaultBase for the full implementation. This concrete contract exists
///      so the two chains deploy independent instances with distinct addresses.
///      The L2Vault is seeded with test ETH liquidity by the project owner so the
///      relayer can release funds for L1 -> L2 transfers.
contract L2Vault is VaultBase {
    constructor(address owner_) VaultBase(owner_) {}
}
