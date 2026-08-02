// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultBase} from "../src/VaultBase.sol";
import {L1Vault} from "../src/L1Vault.sol";
import {VaultTestBase} from "./VaultBase.t.sol";

/// @title L1Vault tests
/// @notice Full suite for the Sepolia (L1) vault deployment.
contract L1VaultTest is VaultTestBase {
    function deployVault() internal override returns (VaultBase) {
        return new L1Vault(owner);
    }
}
