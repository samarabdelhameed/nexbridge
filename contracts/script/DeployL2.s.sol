// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {L2Vault} from "../src/L2Vault.sol";

/// @title DeployL2
/// @notice Deploys L2Vault to Abstract Testnet, sets the relayer address and
///         seeds the vault with test ETH liquidity for L1 -> L2 releases.
///         Usage: forge script script/DeployL2.s.sol:DeployL2 --rpc-url $ABSTRACT_TESTNET_RPC_URL --broadcast
contract DeployL2 is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        uint256 liquidity = vm.envOr("L2_LIQUIDITY_WEI", uint256(10 ether));

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        L2Vault vault = new L2Vault(deployer);
        vault.setRelayer(relayer);
        (bool ok, ) = payable(address(vault)).call{value: liquidity}("");
        require(ok, "seed failed");
        vm.stopBroadcast();

        console2.log("L2Vault deployed at:", address(vault));
        console2.log("Owner:", deployer);
        console2.log("Relayer:", relayer);
        console2.log("Seeded liquidity (wei):", liquidity);
    }
}
