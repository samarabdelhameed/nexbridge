// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {L1Vault} from "../src/L1Vault.sol";

/// @title DeployL1
/// @notice Deploys L1Vault to Sepolia and sets the relayer address.
///         Usage: forge script script/DeployL1.s.sol:DeployL1 --rpc-url $SEPOLIA_RPC_URL --broadcast
contract DeployL1 is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        L1Vault vault = new L1Vault(deployer);
        vault.setRelayer(relayer);
        vm.stopBroadcast();

        console2.log("L1Vault deployed at:", address(vault));
        console2.log("Owner:", deployer);
        console2.log("Relayer:", relayer);
    }
}
