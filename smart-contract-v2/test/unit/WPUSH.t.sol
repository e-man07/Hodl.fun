// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../../src/WPUSH.sol";

contract WPUSHTest is Test {
    WPUSH wpush;

    address owner = address(0x1);
    address user1 = address(0x2);
    address user2 = address(0x3);

    uint256 internal user1PrivateKey = 0xA11CE;
    address internal user1Signer;

    event Deposit(address indexed sender, uint256 amount);
    event Withdrawal(address indexed recipient, uint256 amount);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    function setUp() public {
        // Create signer address from private key
        user1Signer = vm.addr(user1PrivateKey);

        // Deploy WPUSH as owner
        vm.prank(owner);
        wpush = new WPUSH();

        // Fund accounts
        vm.deal(owner, 1000 ether);
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
        assertEq(wpush.owner(), owner);
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
        vm.expectRevert("Deposit amount must be greater than 0");
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
        vm.expectRevert("Withdraw amount must be greater than 0");
        wpush.withdraw(0);
    }

    function testWithdrawInsufficientBalanceReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 5 ether}();

        vm.prank(user1);
        vm.expectRevert("Insufficient balance");
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
        vm.expectRevert("Insufficient balance");
        wpush.withdrawWithPermit(user1Signer, withdrawAmount, deadline, v, r, s);
    }

    // ============ Mint Tests (Owner Only) ============

    function testMintByOwner() public {
        uint256 mintAmount = 100 ether;

        vm.expectEmit(true, false, false, true);
        emit Minted(user1, mintAmount);

        vm.prank(owner);
        wpush.mint(user1, mintAmount);

        assertEq(wpush.balanceOf(user1), mintAmount);
        assertEq(wpush.totalSupply(), mintAmount);
    }

    function testMintByNonOwnerReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        wpush.mint(user1, 100 ether);
    }

    function testMintZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert("Invalid recipient");
        wpush.mint(address(0), 100 ether);
    }

    function testMintZeroAmountReverts() public {
        vm.prank(owner);
        vm.expectRevert("Mint amount must be greater than 0");
        wpush.mint(user1, 0);
    }

    // ============ BatchMint Tests ============

    function testBatchMint() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = address(0x5);

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10 ether;
        amounts[1] = 20 ether;
        amounts[2] = 30 ether;

        vm.prank(owner);
        wpush.batchMint(recipients, amounts);

        assertEq(wpush.balanceOf(user1), 10 ether);
        assertEq(wpush.balanceOf(user2), 20 ether);
        assertEq(wpush.balanceOf(address(0x5)), 30 ether);
        assertEq(wpush.totalSupply(), 60 ether);
    }

    function testBatchMintArrayMismatchReverts() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10 ether;
        amounts[1] = 20 ether;
        amounts[2] = 30 ether;

        vm.prank(owner);
        vm.expectRevert("Array length mismatch");
        wpush.batchMint(recipients, amounts);
    }

    function testBatchMintWithZeroAddressReverts() public {
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = address(0);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 20 ether;

        vm.prank(owner);
        vm.expectRevert("Invalid recipient");
        wpush.batchMint(recipients, amounts);
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
        vm.expectRevert("Burn amount must be greater than 0");
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

    function testBurnFromInsufficientAllowanceReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        wpush.approve(user2, 3 ether);

        vm.prank(user2);
        vm.expectRevert("Insufficient allowance");
        wpush.burnFrom(user1, 5 ether);
    }

    // ============ GetBalance Tests ============

    function testGetBalance() public {
        assertEq(wpush.getBalance(), 0);

        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        assertEq(wpush.getBalance(), 10 ether);
    }

    // ============ EmergencyWithdraw Tests ============

    function testEmergencyWithdraw() public {
        // Deposit some funds
        vm.prank(user1);
        wpush.deposit{value: 100 ether}();

        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        wpush.emergencyWithdraw();

        assertEq(address(wpush).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + 100 ether);
    }

    function testEmergencyWithdrawNoFundsReverts() public {
        vm.prank(owner);
        vm.expectRevert("No funds to withdraw");
        wpush.emergencyWithdraw();
    }

    function testEmergencyWithdrawByNonOwnerReverts() public {
        vm.prank(user1);
        wpush.deposit{value: 10 ether}();

        vm.prank(user1);
        vm.expectRevert();
        wpush.emergencyWithdraw();
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
