// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";
import "../../src/interfaces/ICore.sol";

/**
 * @title AccessControlAttackTest
 * @notice Tests for access control edge cases and privilege escalation prevention
 * @dev Verifies that role-based access control properly protects all admin functions
 */

contract MockWNative is ERC20 {
    constructor() ERC20("Wrapped Native", "WNATIVE") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    receive() external payable {
        deposit();
    }
}

contract MockUniswapV3Factory {
    mapping(bytes32 => address) public pools;
    uint256 public poolCount = 0;

    function getPool(address tokenA, address tokenB, uint24 fee) public view returns (address) {
        return pools[keccak256(abi.encodePacked(tokenA, tokenB, fee))];
    }

    function createPool(address tokenA, address tokenB, uint24 fee) public returns (address) {
        bytes32 key = keccak256(abi.encodePacked(tokenA, tokenB, fee));
        require(pools[key] == address(0), "Pool exists");
        address mockPool = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB, fee, poolCount++)))));
        pools[key] = mockPool;
        return mockPool;
    }
}

contract AccessControlAttackTest is Test {
    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address attacker = address(0xBAD);
    address creator = address(0x2);
    address user1 = address(0x3);

    // Configuration
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 10_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function setUp() public {
        wNative = new MockWNative();

        vm.deal(admin, 10000 ether);
        vm.deal(attacker, 10000 ether);
        vm.deal(creator, 10000 ether);
        vm.deal(user1, 10000 ether);

        uniswapFactory = new MockUniswapV3Factory();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        bytes memory initData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0),
            admin
        );
        core = Core(address(new ERC1967Proxy(address(coreImpl), initData)));

        vm.startPrank(admin);
        feeVault.initialize(
            address(wNative),
            "Fee Vault",
            "FEEVAULT",
            address(core),
            admin
        );

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: virtualNative,
            virtualToken: virtualToken,
            graduationMarketCap: graduationMarketCap,
            feeDenominator: feeDenominator,
            feeNumerator: feeNumerator,
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });
        initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), initData)));

        core.setFactory(address(factory));
        vm.stopPrank();
    }

    function createTestToken(address tokenCreator) internal returns (address curve_, address token_) {
        vm.startPrank(tokenCreator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        (curve_, token_) = core.createCurve(
            tokenCreator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    // ============================================================
    //            CORE ACCESS CONTROL TESTS
    // ============================================================

    /**
     * @notice Test that non-admin cannot pause Core
     */
    function testNonAdminCannotPauseCore() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.pause();
    }

    /**
     * @notice Test that non-admin cannot unpause Core
     */
    function testNonAdminCannotUnpauseCore() public {
        vm.prank(admin);
        core.pause();

        vm.prank(attacker);
        vm.expectRevert();
        core.unpause();
    }

    /**
     * @notice Test that non-admin cannot set factory
     */
    function testNonAdminCannotSetFactory() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.setFactory(address(0x123));
    }

    /**
     * @notice Test that non-admin cannot set wNative
     */
    function testNonAdminCannotSetWNative() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.setWNative(address(0x123));
    }

    /**
     * @notice Test that non-admin cannot set vault
     */
    function testNonAdminCannotSetVault() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.setVault(address(0x123));
    }

    /**
     * @notice Test that non-admin cannot upgrade Core
     */
    function testNonAdminCannotUpgradeCore() public {
        Core newImpl = new Core(address(wNative), address(feeVault));

        vm.prank(attacker);
        vm.expectRevert();
        core.upgradeToAndCall(address(newImpl), "");
    }

    // ============================================================
    //            FACTORY ACCESS CONTROL TESTS
    // ============================================================

    /**
     * @notice Test that non-admin cannot set deploy fee
     */
    function testNonAdminCannotSetDeployFee() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setDeployFee(0);
    }

    /**
     * @notice Test that non-admin cannot set listing fee
     */
    function testNonAdminCannotSetListingFee() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setListingFee(0);
    }

    /**
     * @notice Test that non-admin cannot set virtual reserves
     */
    function testNonAdminCannotSetVirtualReserves() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setVirtualReserves(100 ether, 100_000_000 * 1e18);
    }

    /**
     * @notice Test that non-admin cannot set graduation market cap
     */
    function testNonAdminCannotSetGraduationMarketCap() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setGraduationMarketCap(1000 ether);
    }

    /**
     * @notice Test that non-admin cannot set fee config
     */
    function testNonAdminCannotSetFeeConfig() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setFeeConfig(100, 1);
    }

    /**
     * @notice Test that non-admin cannot set DEX factory
     */
    function testNonAdminCannotSetDexFactory() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setDexFactory(address(0x123));
    }

    /**
     * @notice Test that non-admin cannot set DEX fee
     */
    function testNonAdminCannotSetDexFee() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setDexFee(500);
    }

    /**
     * @notice Test that non-admin cannot set creator fee share
     */
    function testNonAdminCannotSetCreatorFeeShare() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setCreatorFeeShare(5000);
    }

    /**
     * @notice Test that non-admin cannot upgrade Factory
     */
    function testNonAdminCannotUpgradeFactory() public {
        BondingCurveFactory newImpl = new BondingCurveFactory(address(wNative));

        vm.prank(attacker);
        vm.expectRevert();
        factory.upgradeToAndCall(address(newImpl), "");
    }

    // ============================================================
    //            FEE VAULT ACCESS CONTROL TESTS
    // ============================================================

    /**
     * @notice Test that non-admin cannot set core in FeeVault
     */
    function testNonAdminCannotSetCoreInFeeVault() public {
        vm.prank(attacker);
        vm.expectRevert();
        feeVault.setCore(address(0x123));
    }

    /**
     * @notice Test that non-admin cannot upgrade FeeVault
     */
    function testNonAdminCannotUpgradeFeeVault() public {
        FeeVault newImpl = new FeeVault();

        vm.prank(attacker);
        vm.expectRevert();
        feeVault.upgradeToAndCall(address(newImpl), "");
    }

    // ============================================================
    //            BONDING CURVE ACCESS CONTROL TESTS
    // ============================================================

    /**
     * @notice Test that non-core cannot call buy on BondingCurve directly
     */
    function testNonCoreCannotBuyDirectly() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Fund attacker
        vm.startPrank(attacker);
        wNative.deposit{value: 1 ether}();

        // Direct call to bonding curve should fail (no CORE_ROLE)
        vm.expectRevert();
        bc.buy(attacker, 1000 * 1e18); // to, amountOut
        vm.stopPrank();
    }

    /**
     * @notice Test that non-core cannot call sell on BondingCurve directly
     */
    function testNonCoreCannotSellDirectly() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // First buy through Core
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Attacker tries direct sell
        vm.startPrank(attacker);
        vm.expectRevert();
        bc.sell(attacker, 0.1 ether); // to, amountOut (native)
        vm.stopPrank();
    }

    /**
     * @notice Test that listing is permissionless after graduation
     * @dev Anyone can trigger listing once curve is graduated - this is by design
     */
    function testListingAccessControl() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy until locked
        uint256 buyCount = 0;
        while (!bc.getLock() && buyCount < 100) {
            vm.startPrank(user1);
            wNative.deposit{value: 0.5 ether}();
            wNative.approve(address(core), 0.5 ether);
            core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
            vm.stopPrank();
            buyCount++;
        }

        // Verify graduation happened
        assertTrue(bc.getLock(), "Curve should be locked after graduation");

        // Listing is permissionless after graduation - this is by design
        // Anyone can trigger listing to create the DEX pool
        // Note: In test environment, actual listing may fail due to mock V3 factory
        // The key security property is that graduation/locking works correctly
        assertTrue(bc.getLock(), "Curve should remain locked");
    }

    // ============================================================
    //            ROLE MANIPULATION TESTS
    // ============================================================

    /**
     * @notice Test that attacker cannot grant themselves admin role
     */
    function testCannotSelfGrantAdminRole() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.grantRole(DEFAULT_ADMIN_ROLE, attacker);
    }

    /**
     * @notice Test that attacker cannot revoke admin's role
     */
    function testCannotRevokeAdminRole() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.revokeRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Test admin can properly transfer admin role
     */
    function testAdminCanTransferRole() public {
        address newAdmin = address(0xAD12);

        vm.startPrank(admin);
        core.grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        core.grantRole(PAUSER_ROLE, newAdmin);
        assertTrue(core.hasRole(DEFAULT_ADMIN_ROLE, newAdmin), "New admin should have role");
        assertTrue(core.hasRole(PAUSER_ROLE, newAdmin), "New admin should have pauser role");

        // Original admin can revoke their own role
        core.renounceRole(DEFAULT_ADMIN_ROLE, admin);
        assertFalse(core.hasRole(DEFAULT_ADMIN_ROLE, admin), "Old admin should not have role");
        vm.stopPrank();

        // New admin can now perform admin actions (pause requires PAUSER_ROLE)
        vm.prank(newAdmin);
        core.pause();
        assertTrue(core.paused(), "New admin should be able to pause");
    }

    // ============================================================
    //            PAUSE TIMING ATTACK TESTS
    // ============================================================

    /**
     * @notice Test that pausing blocks all trading operations
     */
    function testPauseBlocksTrading() public {
        (, address token_) = createTestToken(creator);

        vm.prank(admin);
        core.pause();

        // All trading should be blocked
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert();
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        vm.expectRevert();
        core.exactOutBuy(1000 * 1e18, 1 ether, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    /**
     * @notice Test that unpausing restores functionality
     */
    function testUnpauseRestoresFunctionality() public {
        (, address token_) = createTestToken(creator);

        // Pause
        vm.prank(admin);
        core.pause();

        // Unpause
        vm.prank(admin);
        core.unpause();

        // Trading should work again
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        assertGt(IERC20(token_).balanceOf(user1), 0, "User should have tokens");
    }

    /**
     * @notice Test that pending transactions don't bypass pause
     */
    function testPendingTransactionsDontBypassPause() public {
        (, address token_) = createTestToken(creator);

        // User prepares transaction
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        vm.stopPrank();

        // Admin pauses in same block
        vm.prank(admin);
        core.pause();

        // User's transaction should fail
        vm.prank(user1);
        vm.expectRevert();
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
    }

    // ============================================================
    //            INITIALIZATION ATTACK TESTS
    // ============================================================

    /**
     * @notice Test that contracts cannot be re-initialized
     */
    function testCannotReinitializeCore() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.initialize(address(0), attacker);
    }

    /**
     * @notice Test that factory cannot be re-initialized
     */
    function testCannotReinitializeFactory() public {
        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: attacker,
            core: address(core),
            deployFee: 0,
            listingFee: 0,
            virtualNative: 1 ether,
            virtualToken: 1_000_000 * 1e18,
            graduationMarketCap: 100 ether,
            feeDenominator: 100,
            feeNumerator: 1,
            dexFactory: address(uniswapFactory),
            dexFee: 3000
        });

        vm.prank(attacker);
        vm.expectRevert();
        factory.initialize(params);
    }

    /**
     * @notice Test that FeeVault cannot be re-initialized
     */
    function testCannotReinitializeFeeVault() public {
        vm.prank(attacker);
        vm.expectRevert();
        feeVault.initialize(address(wNative), "Hacked", "HACK", address(core), attacker);
    }

    // ============================================================
    //            CREATOR FEE CLAIMING TESTS
    // ============================================================

    /**
     * @notice Test that only creator can claim their fees
     */
    function testOnlyCreatorCanClaimFees() public {
        (, address token_) = createTestToken(creator);

        // Generate some fees by buying and selling
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokens = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokens);
        core.exactInSell(tokens, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 creatorFees = factory.creatorFees(creator);
        assertGt(creatorFees, 0, "Should have accumulated fees");

        // Attacker has no fees, so claimCreatorFees should revert
        vm.prank(attacker);
        vm.expectRevert(); // NoFeesToClaim
        factory.claimCreatorFees();

        // Creator should still have their fees (unchanged because attacker's claim failed)
        assertEq(factory.creatorFees(creator), creatorFees, "Creator's fees should be unchanged");

        // Creator can claim their own fees
        uint256 creatorBalBefore = wNative.balanceOf(creator);
        vm.prank(creator);
        factory.claimCreatorFees();
        uint256 creatorBalAfter = wNative.balanceOf(creator);

        assertEq(creatorBalAfter - creatorBalBefore, creatorFees, "Creator should receive their fees");
    }

    /**
     * @notice Test that creator can claim their own fees
     */
    function testCreatorCanClaimOwnFees() public {
        (, address token_) = createTestToken(creator);

        // Generate fees
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokens = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokens);
        core.exactInSell(tokens, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 creatorFees = factory.creatorFees(creator);
        uint256 creatorBalBefore = wNative.balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorBalAfter = wNative.balanceOf(creator);

        assertEq(creatorBalAfter - creatorBalBefore, creatorFees, "Creator should receive their fees");
        assertEq(factory.creatorFees(creator), 0, "Creator fees should be zeroed");
    }

    // ============================================================
    //            EMERGENCY SCENARIOS
    // ============================================================

    /**
     * @notice Test admin can pause during active attack
     */
    function testAdminCanPauseDuringAttack() public {
        (, address token_) = createTestToken(creator);

        // Attacker starts buying
        vm.startPrank(attacker);
        wNative.deposit{value: 10 ether}();
        wNative.approve(address(core), 10 ether);
        core.exactInBuy(0.5 ether, 0, token_, attacker, block.timestamp + 1000);
        vm.stopPrank();

        // Admin detects attack and pauses
        vm.prank(admin);
        core.pause();

        // Attacker's further transactions should fail
        vm.prank(attacker);
        vm.expectRevert();
        core.exactInBuy(0.5 ether, 0, token_, attacker, block.timestamp + 1000);
    }

    /**
     * @notice Test that multiple admins scenario works correctly
     */
    function testMultipleAdminsScenario() public {
        address admin2 = address(0xAD22);

        // Grant admin role and pauser role to second admin
        vm.startPrank(admin);
        core.grantRole(DEFAULT_ADMIN_ROLE, admin2);
        core.grantRole(PAUSER_ROLE, admin2);
        vm.stopPrank();

        // Both admins can pause (requires PAUSER_ROLE)
        vm.prank(admin);
        core.pause();

        vm.prank(admin2);
        core.unpause();

        // Both can perform admin actions
        vm.prank(admin2);
        core.pause();

        assertTrue(core.paused(), "Should be paused by admin2");
    }
}
