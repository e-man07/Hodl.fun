// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../../src/WPUSH.sol";

contract WPUSHTest is Test {
    WPUSH wpush;

    address user1 = address(0x2);
    address user2 = address(0x3);

    uint256 internal user1PrivateKey = 0xA11CE;
    address internal user1Signer;

    event Deposit(address indexed sender, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    function setUp() public {
        // Create signer address from private key
        user1Signer = vm.addr(user1PrivateKey);

        // Deploy WPUSH (no owner - Ownable removed for security)
        wpush = new WPUSH();

        // Fund accounts
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
        vm.deal(user1Signer, 1000 ether);
    }

    // ============ Constructor Tests ============

    function testConstructor() public view {
        assertEq(wpush.name(), "Wrapped PUSH");
        assertEq(wpush.symbol(), "WPUSH");
        assertEq(wpush.decimals(), 18);
        assertEq(wpush.totalSupply(), 0);
    }

    // ============ Deposit Tests ============

    function testDepositSuccess() public {
        uint256 depositAmount = 10 ether;

        vm.expectEmit(true, false, false, true);
        emit Deposit(user1, depositAmount);

        vm.prank(user1);
        wpush.deposit{value: depositAmount}();

        assertEq(wpush.balanceOf(user1), depositAmount);
        assertEq(wpush.totalSupply(), depositAmount);
        assertEq(address(wpush).balance, depositAmount);
    }

    function testDepositMultipleTimes() public {
        vm.startPrank(user1);

        wpush.deposit{value: 5 ether}();
        assertEq(wpush.balanceOf(user1), 5 ether);

        wpush.deposit{value: 3 ether}();
        assertEq(wpush.balanceOf(user1), 8 ether);

        vm.stopPrank();
        assertEq(wpush.totalSupply(), 8 ether);
    }

    function testDepositZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert(WPUSH.ZeroDeposit.selector);
        wpush.deposit{value: 0}();
    }

    function testReceiveFunction() public {
        uint256 depositAmount = 5 ether;

        vm.expectEmit(true, false, false, true);
        emit Deposit(user1, depositAmount);

        vm.prank(user1);
        (bool success, ) = address(wpush).call{value: depositAmount}("");

        assertTrue(success);
        assertEq(wpush.balanceOf(user1), depositAmount);
    }

    function testReceiveZeroAmountReverts() public {
        vm.prank(user1);
        // Low-level call with 0 value should fail (receive() reverts with ZeroDeposit)
        // Note: vm.expectRevert doesn't work with low-level calls that catch their own reverts
        (bool success, ) = address(wpush).call{value: 0}("");
        assertFalse(success, "Sending 0 value should fail");
    }

    // ============ Withdraw Tests ============

    function testWithdrawSuccess() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;

        // Deposit first
        vm.prank(user1);
        wpush.deposit{value: depositAmount}();

        uint256 balanceBefore = user1.balance;

        vm.expectEmit(true, false, false, true);
        emit Withdrawal(user1, withdrawAmount);

        vm.prank(user1);
        wpush.withdraw(withdrawAmount);

        assertEq(wpush.balanceOf(user1), depositAmount - withdrawAmount);
        assertEq(user1.balance, balanceBefore + withdrawAmount);
    }

    function testWithdrawAll() public {
        uint256 depositAmount = 10 ether;

        vm.prank(user1);
        wpush.deposit{value: depositAmount}();

        vm.prank(user1);
        wpush.withdraw(depositAmount);

        assertEq(wpush.balanceOf(user1), 0);
        assertEq(wpush.totalSupply(), 0);
    }

    function testWithdrawZeroAmountReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        vm.expectRevert(WPUSH.ZeroWithdraw.selector);
        wpush.withdraw(0);
    }

    function testWithdrawInsufficientBalanceReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 5 ether}();

        vm.prank(user1);
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wpush.withdraw(10 ether);
    }

    // ============ Permit and WithdrawWithPermit Tests ============

    function testWithdrawWithPermit() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        uint256 deadline = block.timestamp + 1 hours;

        // Deposit as signer
        vm.prank(user1Signer);
        wpush.deposit{value: depositAmount}();

        // Create permit signature
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                wpush.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user1Signer,
                        user2,
                        withdrawAmount,
                        wpush.nonces(user1Signer),
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, permitHash);

        uint256 signerBalanceBefore = user1Signer.balance;

        // User2 calls withdrawWithPermit on behalf of user1Signer
        vm.prank(user2);
        wpush.withdrawWithPermit(user1Signer, withdrawAmount, deadline, v, r, s);

        // Check balances
        assertEq(wpush.balanceOf(user1Signer), depositAmount - withdrawAmount);
        assertEq(user1Signer.balance, signerBalanceBefore + withdrawAmount);
    }

    function testWithdrawWithPermitZeroAmountReverts() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.expectRevert(WPUSH.ZeroWithdraw.selector);
        wpush.withdrawWithPermit(user1, 0, deadline, 0, bytes32(0), bytes32(0));
    }

    function testWithdrawWithPermitInsufficientBalance() public {
        uint256 depositAmount = 5 ether;
        uint256 withdrawAmount = 10 ether;
        uint256 deadline = block.timestamp + 1 hours;

        // Deposit as signer
        vm.prank(user1Signer);
        wpush.deposit{value: depositAmount}();

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                wpush.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user1Signer,
                        user2,
                        withdrawAmount,
                        wpush.nonces(user1Signer),
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, permitHash);

        vm.prank(user2);
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wpush.withdrawWithPermit(user1Signer, withdrawAmount, deadline, v, r, s);
    }

    // ============ Burn Tests ============

    function testBurn() public {
        uint256 depositAmount = 10 ether;
        uint256 burnAmount = 5 ether;

        vm.prank(user1);
        wpush.deposit{value: depositAmount}();

        vm.expectEmit(true, false, false, true);
        emit Burned(user1, burnAmount);

        vm.prank(user1);
        wpush.burn(burnAmount);

        assertEq(wpush.balanceOf(user1), depositAmount - burnAmount);
    }

    function testBurnZeroAmountReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        vm.expectRevert(WPUSH.ZeroBurn.selector);
        wpush.burn(0);
    }

    function testBurnFrom() public {
        uint256 depositAmount = 10 ether;
        uint256 burnAmount = 5 ether;

        vm.prank(user1);
        wpush.deposit{value: depositAmount}();

        // Approve user2 to burn
        vm.prank(user1);
        wpush.approve(user2, burnAmount);

        // User2 burns on behalf of user1
        vm.prank(user2);
        wpush.burnFrom(user1, burnAmount);

        assertEq(wpush.balanceOf(user1), depositAmount - burnAmount);
        assertEq(wpush.allowance(user1, user2), 0);
    }

    function testBurnFromZeroAmountReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        wpush.approve(user2, 10 ether);

        vm.prank(user2);
        vm.expectRevert(WPUSH.ZeroBurn.selector);
        wpush.burnFrom(user1, 0);
    }

    function testBurnFromInsufficientAllowanceReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        wpush.approve(user2, 3 ether);

        vm.prank(user2);
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wpush.burnFrom(user1, 5 ether);
    }

    // ============ GetBalance Tests ============

    function testGetBalance() public {
        assertEq(wpush.getBalance(), 0);

        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        assertEq(wpush.getBalance(), 10 ether);
    }

    // ============ IsFullyBacked Tests ============

    function testIsFullyBacked() public {
        // Empty contract is fully backed (0 <= 0)
        assertTrue(wpush.isFullyBacked());

        // After deposit, should be fully backed
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();
        assertTrue(wpush.isFullyBacked());

        // After burn, totalSupply decreases but balance stays (burn doesn't unlock ETH)
        vm.prank(user1);
        wpush.burn(5 ether);
        assertTrue(wpush.isFullyBacked()); // Still fully backed since balance >= supply
    }

    // ============ Transfer Tests ============

    function testTransfer() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        wpush.transfer(user2, 5 ether);

        assertEq(wpush.balanceOf(user1), 5 ether);
        assertEq(wpush.balanceOf(user2), 5 ether);
    }

    function testTransferFrom() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        wpush.approve(user2, 5 ether);

        vm.prank(user2);
        wpush.transferFrom(user1, user2, 5 ether);

        assertEq(wpush.balanceOf(user1), 5 ether);
        assertEq(wpush.balanceOf(user2), 5 ether);
    }

    // ============ ERC20Permit Tests ============

    function testPermit() public {
        uint256 nonce = wpush.nonces(user1Signer);
        uint256 deadline = block.timestamp + 1 hours;
        uint256 value = 10 ether;

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                wpush.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user1Signer,
                        user2,
                        value,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, permitHash);

        wpush.permit(user1Signer, user2, value, deadline, v, r, s);

        assertEq(wpush.allowance(user1Signer, user2), value);
        assertEq(wpush.nonces(user1Signer), nonce + 1);
    }
}
