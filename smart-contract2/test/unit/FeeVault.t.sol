// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/FeeVault.sol";

contract MockAsset is ERC20 {
    constructor() ERC20("Mock Asset", "ASSET") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract FeeVaultTest is Test {
    FeeVault vaultImpl;
    FeeVault vault;
    MockAsset asset;

    address admin = address(0x1);
    address coreContract = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);
    address newCore = address(0x5);

    function setUp() public {
        // Deploy asset token
        asset = new MockAsset();

        // Deploy FeeVault implementation
        vaultImpl = new FeeVault();

        // Deploy FeeVault proxy
        bytes memory initData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            address(asset),
            "Fee Vault",
            "fVAULT",
            coreContract,
            admin
        );

        vault = FeeVault(address(new ERC1967Proxy(address(vaultImpl), initData)));

        // Mint some tokens to various addresses
        asset.mint(coreContract, 1000 ether);
        asset.mint(user1, 1000 ether);
        asset.mint(user2, 1000 ether);

        // Fund accounts with native tokens
        vm.deal(admin, 100 ether);
        vm.deal(coreContract, 100 ether);
        vm.deal(user1, 100 ether);
    }

    // ============ Initialization Tests ============

    function testInitialization() public view {
        assertEq(vault.name(), "Fee Vault");
        assertEq(vault.symbol(), "fVAULT");
        assertEq(vault.asset(), address(asset));
        assertEq(vault.core(), coreContract);
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.CORE_ROLE(), coreContract));
    }

    function testInitializeWithZeroAssetReverts() public {
        FeeVault newVaultImpl = new FeeVault();

        bytes memory initData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            address(0),
            "Fee Vault",
            "fVAULT",
            coreContract,
            admin
        );

        vm.expectRevert(FeeVault.InvalidAddress.selector);
        new ERC1967Proxy(address(newVaultImpl), initData);
    }

    function testInitializeWithZeroCoreReverts() public {
        FeeVault newVaultImpl = new FeeVault();

        bytes memory initData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            address(asset),
            "Fee Vault",
            "fVAULT",
            address(0),
            admin
        );

        vm.expectRevert(FeeVault.InvalidAddress.selector);
        new ERC1967Proxy(address(newVaultImpl), initData);
    }

    function testInitializeWithZeroAdminReverts() public {
        FeeVault newVaultImpl = new FeeVault();

        bytes memory initData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            address(asset),
            "Fee Vault",
            "fVAULT",
            coreContract,
            address(0)
        );

        vm.expectRevert(FeeVault.InvalidAddress.selector);
        new ERC1967Proxy(address(newVaultImpl), initData);
    }

    function testCannotReinitialize() public {
        vm.expectRevert();
        vault.initialize(
            address(asset),
            "New Name",
            "NEW",
            coreContract,
            admin
        );
    }

    // ============ DepositFees Tests ============

    function testDepositFees() public {
        uint256 depositAmount = 100 ether;

        // Approve vault to spend tokens
        vm.prank(coreContract);
        asset.approve(address(vault), depositAmount);

        // Deposit fees as core
        vm.prank(coreContract);
        vault.depositFees(depositAmount);

        // Check vault received the tokens
        assertEq(asset.balanceOf(address(vault)), depositAmount);
    }

    function testDepositFeesMultipleTimes() public {
        // First deposit
        vm.startPrank(coreContract);
        asset.approve(address(vault), 200 ether);
        vault.depositFees(100 ether);
        assertEq(asset.balanceOf(address(vault)), 100 ether);

        // Second deposit
        vault.depositFees(50 ether);
        assertEq(asset.balanceOf(address(vault)), 150 ether);
        vm.stopPrank();
    }

    function testDepositFeesByNonCoreReverts() public {
        vm.prank(user1);
        asset.approve(address(vault), 100 ether);

        vm.prank(user1);
        vm.expectRevert();
        vault.depositFees(100 ether);
    }

    // ============ SetCore Tests ============

    function testSetCore() public {
        vm.prank(admin);
        vault.setCore(newCore);

        assertEq(vault.core(), newCore);
        assertTrue(vault.hasRole(vault.CORE_ROLE(), newCore));
        assertFalse(vault.hasRole(vault.CORE_ROLE(), coreContract));
    }

    function testSetCoreWithZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(FeeVault.InvalidAddress.selector);
        vault.setCore(address(0));
    }

    function testSetCoreByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setCore(newCore);
    }

    function testNewCoreCanDepositFees() public {
        // Update core
        vm.prank(admin);
        vault.setCore(newCore);

        // Mint tokens to new core
        asset.mint(newCore, 100 ether);

        // Deposit fees as new core
        vm.startPrank(newCore);
        asset.approve(address(vault), 50 ether);
        vault.depositFees(50 ether);
        vm.stopPrank();

        assertEq(asset.balanceOf(address(vault)), 50 ether);
    }

    function testOldCoreCannotDepositFeesAfterUpdate() public {
        // Update core
        vm.prank(admin);
        vault.setCore(newCore);

        // Try to deposit fees as old core
        vm.prank(coreContract);
        asset.approve(address(vault), 100 ether);

        vm.prank(coreContract);
        vm.expectRevert();
        vault.depositFees(100 ether);
    }

    // ============ ERC4626 Tests ============

    function testERC4626Deposit() public {
        uint256 depositAmount = 100 ether;

        // Approve vault to spend user's tokens
        vm.prank(user1);
        asset.approve(address(vault), depositAmount);

        // Deposit via ERC4626 interface
        vm.prank(user1);
        uint256 shares = vault.deposit(depositAmount, user1);

        // Check shares and balance
        assertEq(vault.balanceOf(user1), shares);
        assertEq(asset.balanceOf(address(vault)), depositAmount);
    }

    function testERC4626Mint() public {
        uint256 sharesToMint = 50 ether;

        // Calculate assets needed
        uint256 assetsNeeded = vault.previewMint(sharesToMint);

        // Approve vault
        vm.prank(user1);
        asset.approve(address(vault), assetsNeeded);

        // Mint shares
        vm.prank(user1);
        uint256 assetsSpent = vault.mint(sharesToMint, user1);

        assertEq(vault.balanceOf(user1), sharesToMint);
        assertEq(assetsSpent, assetsNeeded);
    }

    function testERC4626Withdraw() public {
        uint256 depositAmount = 100 ether;

        // First deposit
        vm.startPrank(user1);
        asset.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, user1);

        // Get shares balance
        uint256 shares = vault.balanceOf(user1);

        // Withdraw half
        uint256 withdrawAmount = 50 ether;
        uint256 sharesBurned = vault.withdraw(withdrawAmount, user1, user1);
        vm.stopPrank();

        assertEq(vault.balanceOf(user1), shares - sharesBurned);
        assertEq(asset.balanceOf(user1), 1000 ether - depositAmount + withdrawAmount);
    }

    function testERC4626Redeem() public {
        uint256 depositAmount = 100 ether;

        // First deposit
        vm.startPrank(user1);
        asset.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, user1);

        // Get shares balance
        uint256 shares = vault.balanceOf(user1);

        // Redeem half the shares
        uint256 sharesToRedeem = shares / 2;
        uint256 assetsReceived = vault.redeem(sharesToRedeem, user1, user1);
        vm.stopPrank();

        assertEq(vault.balanceOf(user1), shares - sharesToRedeem);
        assertEq(asset.balanceOf(user1), 1000 ether - depositAmount + assetsReceived);
    }

    function testERC4626TotalAssets() public {
        assertEq(vault.totalAssets(), 0);

        // Deposit some fees via core
        vm.startPrank(coreContract);
        asset.approve(address(vault), 100 ether);
        vault.depositFees(100 ether);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 100 ether);

        // User also deposits
        vm.startPrank(user1);
        asset.approve(address(vault), 50 ether);
        vault.deposit(50 ether, user1);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 150 ether);
    }

    function testERC4626PreviewDeposit() public view {
        // With empty vault, 1:1 ratio
        uint256 shares = vault.previewDeposit(100 ether);
        assertEq(shares, 100 ether);
    }

    function testERC4626PreviewMint() public view {
        // With empty vault, 1:1 ratio
        uint256 assets = vault.previewMint(100 ether);
        assertEq(assets, 100 ether);
    }

    function testERC4626PreviewWithdraw() public {
        // Deposit first
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        // Preview withdraw
        uint256 shares = vault.previewWithdraw(50 ether);
        assertEq(shares, 50 ether);
    }

    function testERC4626PreviewRedeem() public {
        // Deposit first
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        // Preview redeem
        uint256 assets = vault.previewRedeem(50 ether);
        assertEq(assets, 50 ether);
    }

    // ============ Yield Generation Tests ============

    function testYieldAccruesToShareholders() public {
        // User1 deposits
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        uint256 initialShares = vault.balanceOf(user1);

        // Fees are deposited (simulating yield)
        vm.startPrank(coreContract);
        asset.approve(address(vault), 50 ether);
        vault.depositFees(50 ether);
        vm.stopPrank();

        // User1's shares are worth more now
        uint256 assetsForShares = vault.convertToAssets(initialShares);
        // Allow for rounding (150 ether - 1 wei due to integer division)
        assertApproxEqAbs(assetsForShares, 150 ether, 1);
    }

    function testYieldDistributionMultipleUsers() public {
        // User1 deposits 100
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        // User2 deposits 100
        vm.startPrank(user2);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user2);
        vm.stopPrank();

        // Fees deposited (50 total yield)
        vm.startPrank(coreContract);
        asset.approve(address(vault), 50 ether);
        vault.depositFees(50 ether);
        vm.stopPrank();

        // Each user should have claim to 125 (100 + 25)
        // Allow for rounding (1 wei due to integer division)
        uint256 user1Assets = vault.convertToAssets(vault.balanceOf(user1));
        uint256 user2Assets = vault.convertToAssets(vault.balanceOf(user2));

        assertApproxEqAbs(user1Assets, 125 ether, 1);
        assertApproxEqAbs(user2Assets, 125 ether, 1);
    }

    // ============ Max Functions Tests ============

    function testMaxDeposit() public view {
        uint256 maxDep = vault.maxDeposit(user1);
        assertEq(maxDep, type(uint256).max);
    }

    function testMaxMint() public view {
        uint256 maxMint = vault.maxMint(user1);
        assertEq(maxMint, type(uint256).max);
    }

    function testMaxWithdraw() public {
        // First deposit
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        uint256 maxWithdraw = vault.maxWithdraw(user1);
        assertEq(maxWithdraw, 100 ether);
    }

    function testMaxRedeem() public {
        // First deposit
        vm.startPrank(user1);
        asset.approve(address(vault), 100 ether);
        vault.deposit(100 ether, user1);
        vm.stopPrank();

        uint256 maxRedeem = vault.maxRedeem(user1);
        assertEq(maxRedeem, vault.balanceOf(user1));
    }

    // ============ Role Tests ============

    function testCoreRoleConstant() public view {
        bytes32 expectedRole = keccak256("CORE_ROLE");
        assertEq(vault.CORE_ROLE(), expectedRole);
    }

    function testGrantCoreRole() public {
        address newRoleHolder = address(0x99);

        vm.startPrank(admin);
        vault.grantRole(vault.CORE_ROLE(), newRoleHolder);
        vm.stopPrank();

        assertTrue(vault.hasRole(vault.CORE_ROLE(), newRoleHolder));
    }

    function testRevokeCoreRole() public {
        vm.startPrank(admin);
        vault.revokeRole(vault.CORE_ROLE(), coreContract);
        vm.stopPrank();

        assertFalse(vault.hasRole(vault.CORE_ROLE(), coreContract));
    }
}
