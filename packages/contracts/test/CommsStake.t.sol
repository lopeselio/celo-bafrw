// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CommsStake.sol";

contract CommsStakeTest is Test {
    CommsStake public comms;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    function setUp() public {
        comms = new CommsStake();
    }

    function test_StakeIncreasesBalance() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        comms.stake{value: 2 ether}();
        assertEq(comms.stakeWei(alice), 2 ether);
    }

    function test_StakeAccumulates() public {
        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        comms.stake{value: 1 ether}();
        comms.stake{value: 3 ether}();
        vm.stopPrank();
        assertEq(comms.stakeWei(alice), 4 ether);
    }

    function test_TwoUsersIndependent() public {
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);
        vm.prank(alice);
        comms.stake{value: 1 ether}();
        vm.prank(bob);
        comms.stake{value: 2 ether}();
        assertEq(comms.stakeWei(alice), 1 ether);
        assertEq(comms.stakeWei(bob), 2 ether);
    }

    function test_WithdrawPartial() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        comms.stake{value: 5 ether}();
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        comms.withdraw(2 ether);
        assertEq(comms.stakeWei(alice), 3 ether);
        assertEq(alice.balance, balBefore + 2 ether);
    }

    function test_WithdrawFull() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        comms.stake{value: 1 ether}();
        vm.prank(alice);
        comms.withdraw(1 ether);
        assertEq(comms.stakeWei(alice), 0);
    }

    function test_RevertWithdrawInsufficient() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        comms.stake{value: 1 ether}();
        vm.prank(alice);
        vm.expectRevert(bytes("insufficient stake"));
        comms.withdraw(2 ether);
    }

    function test_EmitStaked() public {
        vm.deal(alice, 1 ether);
        vm.expectEmit(true, true, true, true);
        emit Staked(alice, 1 ether);
        vm.prank(alice);
        comms.stake{value: 1 ether}();
    }

    function test_EmitWithdrawn() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        comms.stake{value: 1 ether}();
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(alice, 1 ether);
        vm.prank(alice);
        comms.withdraw(1 ether);
    }
}
