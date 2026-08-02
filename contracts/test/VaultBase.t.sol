// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IVault} from "../src/interfaces/IVault.sol";
import {VaultBase} from "../src/VaultBase.sol";

/// @title VaultTestBase
/// @notice Shared test suite for both L1Vault and L2Vault. Because the two vaults
///         share the exact same implementation, both test files run this suite
///         against their own deployment, guaranteeing identical behaviour.
abstract contract VaultTestBase is Test {
    VaultBase internal vault;
    address internal owner;
    address internal relayer;
    address internal user;
    address internal stranger;

    function setUp() public virtual {
        owner = makeAddr("owner");
        relayer = makeAddr("relayer");
        user = makeAddr("user");
        stranger = makeAddr("stranger");
        vault = deployVault();
        vm.prank(owner);
        vault.setRelayer(relayer);
    }

    function deployVault() internal virtual returns (VaultBase);

    // ------------------------------------------------------------------ deposit

    function test_Deposit_LocksEther_AndEmitsEvent() public {
        uint256 amount = 1 ether;
        vm.deal(user, 10 ether);
        vm.expectEmit(true, true, true, true, address(vault));
        emit IVault.Deposited(user, amount, 0);
        vm.prank(user);
        vault.deposit{value: amount}();
        assertEq(address(vault).balance, amount, "vault balance");
        assertEq(vault.userNonces(user), 1, "user nonce incremented");
    }

    function test_Deposit_IncrementsNoncePerUser() public {
        address user2 = makeAddr("user2");
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        vm.prank(user2);
        vault.deposit{value: 1 ether}();
        assertEq(vault.userNonces(user), 1);
        assertEq(vault.userNonces(user2), 1);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        assertEq(vault.userNonces(user), 2);
    }

    function testFuzz_Deposit_TracksBalance(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);
        vm.deal(user, 10_000 ether);
        vm.prank(user);
        vault.deposit{value: amount}();
        assertEq(address(vault).balance, amount);
    }

    function test_Deposit_Reverts_ZeroAmount() public {
        vm.prank(user);
        vm.expectRevert("Vault: zero amount");
        vault.deposit{value: 0}();
    }

    function test_Deposit_Reverts_WhenPaused() public {
        vm.prank(owner);
        vault.pause();
        vm.deal(user, 10 ether);
        vm.prank(user);
        vm.expectRevert();
        vault.deposit{value: 1 ether}();
    }

    // ------------------------------------------------------------------ release

    function test_Release_SendsFunds_AndEmitsEvent() public {
        vm.deal(user, 10 ether);
        vm.prank(user);
        vault.deposit{value: 2 ether}();
        vm.deal(address(vault), 5 ether);

        uint256 balanceBefore = user.balance;
        vm.expectEmit(true, true, true, true, address(vault));
        emit IVault.Released(user, 2 ether, 0);
        vm.prank(relayer);
        vault.release(user, 2 ether, 0);
        assertEq(user.balance, balanceBefore + 2 ether, "user received funds");
        assertTrue(vault.processedNonces(user, 0), "nonce marked processed");
    }

    function test_Release_Reverts_OnlyRelayer() public {
        vm.deal(user, 10 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        vm.deal(address(vault), 5 ether);
        vm.prank(stranger);
        vm.expectRevert("Vault: not relayer");
        vault.release(user, 1 ether, 0);
    }

    function test_Release_Reverts_Replay() public {
        vm.deal(user, 10 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        vm.deal(address(vault), 5 ether);
        vm.prank(relayer);
        vault.release(user, 1 ether, 0);
        vm.prank(relayer);
        vm.expectRevert("Vault: nonce already processed");
        vault.release(user, 1 ether, 0);
    }

    function test_Release_SameNonceDifferentUser_IsAllowed() public {
        address user2 = makeAddr("user2");
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        vm.prank(user2);
        vault.deposit{value: 1 ether}();
        vm.deal(address(vault), 10 ether);
        vm.prank(relayer);
        vault.release(user, 1 ether, 0);
        vm.prank(relayer);
        vault.release(user2, 1 ether, 0);
        assertTrue(vault.processedNonces(user, 0));
        assertTrue(vault.processedNonces(user2, 0));
    }

    function test_Release_Reverts_ZeroAddress() public {
        vm.prank(relayer);
        vm.expectRevert("Vault: zero address");
        vault.release(address(0), 1 ether, 0);
    }

    function test_Release_Reverts_ZeroAmount() public {
        vm.prank(relayer);
        vm.expectRevert("Vault: zero amount");
        vault.release(user, 0, 0);
    }

    function test_Release_Reverts_InsufficientLiquidity() public {
        vm.prank(relayer);
        vm.expectRevert("Vault: insufficient liquidity");
        vault.release(user, 1 ether, 0);
    }

    function test_Release_Reverts_WhenPaused() public {
        vm.deal(user, 10 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();
        vm.deal(address(vault), 5 ether);
        vm.prank(owner);
        vault.pause();
        vm.prank(relayer);
        vm.expectRevert();
        vault.release(user, 1 ether, 0);
    }

    // ------------------------------------------------------------------ relayer

    function test_SetRelayer_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.setRelayer(stranger);
        vm.expectEmit(true, true, true, true, address(vault));
        emit IVault.RelayerSet(stranger);
        vm.prank(owner);
        vault.setRelayer(stranger);
        assertEq(vault.relayer(), stranger);
    }

    function test_SetRelayer_Reverts_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Vault: zero address");
        vault.setRelayer(address(0));
    }

    // ------------------------------------------------------------------ pause

    function test_Pause_Unpause_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.pause();
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());
        vm.prank(owner);
        vault.unpause();
        assertFalse(vault.paused());
    }

    // ------------------------------------------------------------------ emergency withdraw

    function test_EmergencyWithdraw_OnlyWhenPaused() public {
        vm.deal(address(vault), 5 ether);
        vm.prank(owner);
        vm.expectRevert("Vault: not paused");
        vault.emergencyWithdraw();
    }

    function test_EmergencyWithdraw_ReturnsFundsToOwner() public {
        vm.deal(address(vault), 5 ether);
        vm.prank(owner);
        vault.pause();
        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        vault.emergencyWithdraw();
        assertEq(owner.balance, ownerBefore + 5 ether);
        assertEq(address(vault).balance, 0);
    }

    function test_EmergencyWithdraw_Reverts_ForNonOwner() public {
        vm.deal(address(vault), 5 ether);
        vm.prank(owner);
        vault.pause();
        vm.prank(stranger);
        vm.expectRevert();
        vault.emergencyWithdraw();
    }

    // ------------------------------------------------------------------ receive

    function test_Receive_Ether() public {
        vm.deal(address(vault), 0);
        vm.deal(user, 10 ether);
        vm.prank(user);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(vault).balance, 1 ether);
    }
}
