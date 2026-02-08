// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/Token.sol";

contract TokenTest is Test {
    Token tokenImpl;
    Token token;

    address coreContract = address(0x1);
    address factory = address(0x2);
    address bondingCurve = address(0x3);
    address user1 = address(0x4);
    address user2 = address(0x5);

    string constant TOKEN_NAME = "Test Token";
    string constant TOKEN_SYMBOL = "TEST";
    string constant TOKEN_URI = "ipfs://QmTestHash";

    function setUp() public {
        // Deploy Token implementation
        tokenImpl = new Token();

        // Deploy Token proxy as factory (simulating BondingCurveFactory behavior)
        vm.startPrank(factory);
        bytes memory initData = abi.encodeWithSelector(
            Token.initialize.selector,
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_URI,
            coreContract
        );

        token = Token(address(new ERC1967Proxy(address(tokenImpl), initData)));
        vm.stopPrank();

        // Fund accounts
        vm.deal(coreContract, 100 ether);
        vm.deal(factory, 100 ether);
        vm.deal(user1, 100 ether);
    }

    // ============ Initialization Tests ============

    function testInitialization() public view {
        assertEq(token.name(), TOKEN_NAME);
        assertEq(token.symbol(), TOKEN_SYMBOL);
        assertEq(token.decimals(), 18);
        assertEq(token.tokenURI(), TOKEN_URI);
        assertEq(token.core(), coreContract);
        assertEq(token.totalSupply(), 0); // Not minted yet
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), coreContract));
        assertTrue(token.hasRole(token.CORE_ROLE(), coreContract));
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), factory)); // Factory also gets admin role
    }

    function testInitializeWithZeroCoreReverts() public {
        Token newTokenImpl = new Token();

        bytes memory initData = abi.encodeWithSelector(
            Token.initialize.selector,
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_URI,
            address(0)
        );

        vm.expectRevert(Token.InvalidAddress.selector);
        new ERC1967Proxy(address(newTokenImpl), initData);
    }

    function testCannotReinitialize() public {
        vm.expectRevert();
        token.initialize(
            "New Name",
            "NEW",
            "ipfs://new",
            coreContract
        );
    }

    // ============ Constants Tests ============

    function testTotalSupplyConstant() public view {
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 * 10**18);
    }

    function testBondingCurveRoleConstant() public view {
        bytes32 expectedRole = keccak256("BONDING_CURVE_ROLE");
        assertEq(token.BONDING_CURVE_ROLE(), expectedRole);
    }

    function testCoreRoleConstant() public view {
        bytes32 expectedRole = keccak256("CORE_ROLE");
        assertEq(token.CORE_ROLE(), expectedRole);
    }

    // ============ SetBondingCurve Tests ============

    function testSetBondingCurveByFactory() public {
        vm.prank(factory);
        token.setBondingCurve(bondingCurve);

        assertTrue(token.hasRole(token.BONDING_CURVE_ROLE(), bondingCurve));
    }

    function testSetBondingCurveByCore() public {
        vm.prank(coreContract);
        token.setBondingCurve(bondingCurve);

        assertTrue(token.hasRole(token.BONDING_CURVE_ROLE(), bondingCurve));
    }

    function testSetBondingCurveWithZeroAddressReverts() public {
        vm.prank(factory);
        vm.expectRevert(Token.InvalidAddress.selector);
        token.setBondingCurve(address(0));
    }

    function testSetBondingCurveByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        token.setBondingCurve(bondingCurve);
    }

    // ============ Mint Tests ============

    function testMintSuccess() public {
        // First set bonding curve
        vm.prank(factory);
        token.setBondingCurve(bondingCurve);

        // Mint to bonding curve (requires DEFAULT_ADMIN_ROLE)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        assertEq(token.balanceOf(bondingCurve), token.TOTAL_SUPPLY());
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function testMintOnlyOnce() public {
        // First mint succeeds (as admin)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        // Second mint reverts
        vm.prank(coreContract);
        vm.expectRevert(Token.AlreadyMinted.selector);
        token.mint(user1);
    }

    function testMintRequiresAdminRole() public {
        // Non-admin cannot call mint
        vm.prank(user1);
        vm.expectRevert();
        token.mint(bondingCurve);
    }

    function testMintByFactorySucceeds() public {
        // Factory has admin role and can mint
        vm.prank(factory);
        token.mint(bondingCurve);

        assertEq(token.balanceOf(bondingCurve), token.TOTAL_SUPPLY());
    }

    // ============ Burn Tests ============

    function testBurn() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        uint256 burnAmount = 1000 * 10**18;
        uint256 initialSupply = token.totalSupply();

        vm.prank(bondingCurve);
        token.burn(burnAmount);

        assertEq(token.balanceOf(bondingCurve), initialSupply - burnAmount);
        assertEq(token.totalSupply(), initialSupply - burnAmount);
    }

    function testBurnFrom() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        uint256 burnAmount = 1000 * 10**18;
        uint256 initialSupply = token.totalSupply();

        // Approve user1 to burn tokens
        vm.prank(bondingCurve);
        token.approve(user1, burnAmount);

        // User1 burns on behalf of bonding curve
        vm.prank(user1);
        token.burnFrom(bondingCurve, burnAmount);

        assertEq(token.balanceOf(bondingCurve), initialSupply - burnAmount);
    }

    // ============ Transfer Tests ============

    function testTransfer() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        uint256 transferAmount = 1000 * 10**18;

        vm.prank(bondingCurve);
        token.transfer(user1, transferAmount);

        assertEq(token.balanceOf(user1), transferAmount);
        assertEq(token.balanceOf(bondingCurve), token.TOTAL_SUPPLY() - transferAmount);
    }

    function testTransferFrom() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        uint256 transferAmount = 1000 * 10**18;

        // Approve user1
        vm.prank(bondingCurve);
        token.approve(user1, transferAmount);

        // User1 transfers on behalf of bonding curve
        vm.prank(user1);
        token.transferFrom(bondingCurve, user2, transferAmount);

        assertEq(token.balanceOf(user2), transferAmount);
    }

    // ============ Approval Tests ============

    function testApprove() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        uint256 approvalAmount = 500 * 10**18;

        vm.prank(bondingCurve);
        token.approve(user1, approvalAmount);

        assertEq(token.allowance(bondingCurve, user1), approvalAmount);
    }

    function testIncreaseAllowance() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        vm.startPrank(bondingCurve);
        token.approve(user1, 100 * 10**18);
        token.increaseAllowance(user1, 50 * 10**18);
        vm.stopPrank();

        assertEq(token.allowance(bondingCurve, user1), 150 * 10**18);
    }

    function testDecreaseAllowance() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        vm.startPrank(bondingCurve);
        token.approve(user1, 100 * 10**18);
        token.decreaseAllowance(user1, 30 * 10**18);
        vm.stopPrank();

        assertEq(token.allowance(bondingCurve, user1), 70 * 10**18);
    }

    // ============ Token URI Tests ============

    function testTokenURI() public view {
        assertEq(token.tokenURI(), TOKEN_URI);
    }

    // ============ Role Tests ============

    function testGrantRole() public {
        vm.startPrank(coreContract);
        token.grantRole(token.CORE_ROLE(), user1);
        vm.stopPrank();

        assertTrue(token.hasRole(token.CORE_ROLE(), user1));
    }

    function testRevokeRole() public {
        // Core has CORE_ROLE
        assertTrue(token.hasRole(token.CORE_ROLE(), coreContract));

        vm.startPrank(coreContract);
        token.revokeRole(token.CORE_ROLE(), coreContract);
        vm.stopPrank();

        assertFalse(token.hasRole(token.CORE_ROLE(), coreContract));
    }

    function testRenounceRole() public {
        // Factory has admin role
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), factory));

        vm.startPrank(factory);
        token.renounceRole(token.DEFAULT_ADMIN_ROLE(), factory);
        vm.stopPrank();

        assertFalse(token.hasRole(token.DEFAULT_ADMIN_ROLE(), factory));
    }

    // ============ Edge Cases ============

    function testTransferZeroAmount() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        vm.prank(bondingCurve);
        // Zero transfer should succeed
        token.transfer(user1, 0);

        assertEq(token.balanceOf(user1), 0);
    }

    function testTransferInsufficientBalanceReverts() public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        // User1 has no tokens
        vm.prank(user1);
        vm.expectRevert();
        token.transfer(user2, 100 * 10**18);
    }

    function testBurnInsufficientBalanceReverts() public {
        // User1 has no tokens
        vm.prank(user1);
        vm.expectRevert();
        token.burn(100 * 10**18);
    }

    // ============ ERC20 Metadata Tests ============

    function testName() public view {
        assertEq(token.name(), TOKEN_NAME);
    }

    function testSymbol() public view {
        assertEq(token.symbol(), TOKEN_SYMBOL);
    }

    function testDecimals() public view {
        assertEq(token.decimals(), 18);
    }

    // ============ Multiple Bonding Curves Tests ============

    function testCanSetMultipleBondingCurves() public {
        address curve1 = address(0x10);
        address curve2 = address(0x11);

        vm.startPrank(factory);
        token.setBondingCurve(curve1);
        token.setBondingCurve(curve2);
        vm.stopPrank();

        assertTrue(token.hasRole(token.BONDING_CURVE_ROLE(), curve1));
        assertTrue(token.hasRole(token.BONDING_CURVE_ROLE(), curve2));
    }

    // ============ Fuzz Tests ============

    function testFuzzTransfer(uint256 amount) public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        // Bound amount to total supply
        amount = bound(amount, 0, token.TOTAL_SUPPLY());

        vm.prank(bondingCurve);
        token.transfer(user1, amount);

        assertEq(token.balanceOf(user1), amount);
    }

    function testFuzzBurn(uint256 amount) public {
        // Mint first (requires admin role)
        vm.prank(coreContract);
        token.mint(bondingCurve);

        // Bound amount to total supply
        amount = bound(amount, 0, token.TOTAL_SUPPLY());

        uint256 initialSupply = token.totalSupply();

        vm.prank(bondingCurve);
        token.burn(amount);

        assertEq(token.totalSupply(), initialSupply - amount);
    }
}
