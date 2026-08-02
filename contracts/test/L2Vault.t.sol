// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VaultBase} from "../src/VaultBase.sol";
import {L2Vault} from "../src/L2Vault.sol";
import {VaultTestBase} from "./VaultBase.t.sol";

/// @title L2Vault tests
/// @notice Full suite for the Abstract Testnet (L2) vault deployment.
contract L2VaultTest is VaultTestBase {
    function deployVault() internal override returns (VaultBase) {
        return new L2Vault(owner);
    }
}
