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
import "../../src/UniswapV3Factory.sol";

/// @title Mock WPUSH for upgrade testing
contract MockWNativeUpgrade is ERC20 {
    constructor() ERC20("Wrapped PUSH", "WPUSH") {}

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

/// @title Mock V2 Core for upgrade testing - adds a new function
contract CoreV2 is Core {
    uint256 public v2Variable;

    constructor(address _wNative, address _vault) Core(_wNative, _vault) {}

    function setV2Variable(uint256 _value) external {
        v2Variable = _value;
    }

    function getVersion() external pure returns (string memory) {
        return "v2";
    }
}

/// @title Mock V2 Factory for upgrade testing
contract BondingCurveFactoryV2 is BondingCurveFactory {
    uint256 public v2Variable;

    constructor(address _wNative) BondingCurveFactory(_wNative) {}

    function setV2Variable(uint256 _value) external {
        v2Variable = _value;
    }

    function getVersion() external pure returns (string memory) {
        return "v2";
    }
}

/// @title Mock V2 BondingCurve for upgrade testing
contract BondingCurveV2 is BondingCurve {
    uint256 public v2Variable;

    constructor(address _core, address _wNative) BondingCurve(_core, _wNative) {}

    function setV2Variable(uint256 _value) external {
        v2Variable = _value;
    }

    function getVersion() external pure returns (string memory) {
        return "v2";
    }
}

/// @title Mock V2 FeeVault for upgrade testing
contract FeeVaultV2 is FeeVault {
    uint256 public v2Variable;

    function setV2Variable(uint256 _value) external {
        v2Variable = _value;
    }

    function getVersion() external pure returns (string memory) {
        return "v2";
    }
}

/// @title Integration tests for UUPS upgrade scenarios
contract UpgradeIntegrationTest is Test {
    MockWNativeUpgrade wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address nonAdmin = address(0x99);
    address creator = address(0x2);
    address user1 = address(0x10);

    // Configuration
    uint256 deployFee = 0.01 ether;
    uint256 listingFee = 0.1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 50_000_000 * 1e18;
    uint256 graduationMarketCap = 1000 ether; // High for testing
    uint8 feeDenominator = 100;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    function setUp() public {
        wNative = new MockWNativeUpgrade();

        // Fund accounts
        vm.deal(admin, 10000 ether);
        vm.deal(creator, 10000 ether);
        vm.deal(user1, 10000 ether);
        vm.deal(nonAdmin, 10000 ether);

        // Deploy DEX factory
        uniswapFactory = new UniswapV3Factory();

        // Deploy FeeVault
        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), bytes(""))));

        // Deploy Core
        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(address(new ERC1967Proxy(address(coreImpl), bytes(""))));

        // Deploy Factory
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), bytes(""))));

        // Initialize Core
        vm.startPrank(admin);
        core.initialize(address(0), admin);
        core.setFactory(address(factory));
        vm.stopPrank();

        // Initialize FeeVault
        feeVault.initialize(
            address(wNative),
            "Fee Vault",
            "fVAULT",
            address(core),
            admin
        );

        // Initialize Factory
        vm.prank(admin);
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
        factory.initialize(params);
    }

    /// @notice Helper to create a token
    function createTestToken(address _creator) internal returns (address curve_, address token_) {
        vm.startPrank(_creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (curve_, token_) = core.createCurve(
            _creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    /// @notice Helper for a user to buy tokens
    function buyTokens(address user, address token_, uint256 amountNative) internal returns (uint256 tokensReceived) {
        vm.startPrank(user);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 balBefore = IERC20(token_).balanceOf(user);
        core.exactInBuy(amountNative, 0, token_, user, block.timestamp + 1 hours);
        uint256 balAfter = IERC20(token_).balanceOf(user);

        vm.stopPrank();
        return balAfter - balBefore;
    }

    // ==================== Core Upgrade Tests ====================

    function testCoreUpgradeByAdmin() public {
        // Deploy new implementation
        CoreV2 newImpl = new CoreV2(address(wNative), address(feeVault));

        // Upgrade
        vm.prank(admin);
        core.upgradeTo(address(newImpl));

        // Verify upgrade worked - V2 function should be accessible
        CoreV2 coreV2 = CoreV2(address(core));
        assertEq(coreV2.getVersion(), "v2", "Should be upgraded to v2");

        // Test new functionality
        vm.prank(admin);
        coreV2.setV2Variable(123);
        assertEq(coreV2.v2Variable(), 123, "V2 variable should be set");
    }

    function testCoreUpgradeRevertsForNonAdmin() public {
        CoreV2 newImpl = new CoreV2(address(wNative), address(feeVault));

        vm.expectRevert();
        vm.prank(nonAdmin);
        core.upgradeTo(address(newImpl));
    }

    function testCoreUpgradePreservesState() public {
        // Create a token before upgrade
        (address curve_, address token_) = createTestToken(creator);

        // Verify token exists
        address factoryBefore = core.factory();
        assertEq(factoryBefore, address(factory), "Factory should be set");

        // Buy some tokens
        buyTokens(user1, token_, 1 ether);
        uint256 user1BalBefore = IERC20(token_).balanceOf(user1);

        // Upgrade Core
        CoreV2 newImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newImpl));

        // Verify state preserved
        CoreV2 coreV2 = CoreV2(address(core));
        assertEq(coreV2.factory(), address(factory), "Factory address should be preserved");

        // User balance should be unchanged
        assertEq(IERC20(token_).balanceOf(user1), user1BalBefore, "User balance should be preserved");
    }

    function testCoreCanStillOperateAfterUpgrade() public {
        // Create token before upgrade
        (address curve_, address token_) = createTestToken(creator);

        // Upgrade Core
        CoreV2 newImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newImpl));

        // Should still be able to trade
        uint256 balBefore = IERC20(token_).balanceOf(user1);
        buyTokens(user1, token_, 1 ether);
        uint256 balAfter = IERC20(token_).balanceOf(user1);

        assertGt(balAfter, balBefore, "Should be able to buy tokens after upgrade");
    }

    // ==================== Factory Upgrade Tests ====================

    function testFactoryUpgradeByAdmin() public {
        BondingCurveFactoryV2 newImpl = new BondingCurveFactoryV2(address(wNative));

        vm.prank(admin);
        factory.upgradeTo(address(newImpl));

        BondingCurveFactoryV2 factoryV2 = BondingCurveFactoryV2(address(factory));
        assertEq(factoryV2.getVersion(), "v2", "Should be upgraded to v2");
    }

    function testFactoryUpgradeRevertsForNonAdmin() public {
        BondingCurveFactoryV2 newImpl = new BondingCurveFactoryV2(address(wNative));

        vm.expectRevert();
        vm.prank(nonAdmin);
        factory.upgradeTo(address(newImpl));
    }

    function testFactoryUpgradePreservesConfig() public {
        // Get config before upgrade
        IBondingCurveFactory.Config memory configBefore = factory.getConfig();

        // Upgrade Factory
        BondingCurveFactoryV2 newImpl = new BondingCurveFactoryV2(address(wNative));
        vm.prank(admin);
        factory.upgradeTo(address(newImpl));

        // Verify config preserved
        IBondingCurveFactory.Config memory configAfter = factory.getConfig();

        assertEq(configAfter.deployFee, configBefore.deployFee, "deployFee should be preserved");
        assertEq(configAfter.listingFee, configBefore.listingFee, "listingFee should be preserved");
        assertEq(configAfter.virtualNative, configBefore.virtualNative, "virtualNative should be preserved");
        assertEq(configAfter.virtualToken, configBefore.virtualToken, "virtualToken should be preserved");
        assertEq(configAfter.k, configBefore.k, "k should be preserved");
        assertEq(configAfter.graduationMarketCap, configBefore.graduationMarketCap, "graduationMarketCap should be preserved");
    }

    function testFactoryCanCreateTokensAfterUpgrade() public {
        // Upgrade Factory
        BondingCurveFactoryV2 newImpl = new BondingCurveFactoryV2(address(wNative));
        vm.prank(admin);
        factory.upgradeTo(address(newImpl));

        // Should still be able to create tokens
        (address curve_, address token_) = createTestToken(creator);

        assertFalse(curve_ == address(0), "Curve should be created");
        assertFalse(token_ == address(0), "Token should be created");
    }

    // ==================== FeeVault Upgrade Tests ====================

    function testFeeVaultUpgradeByAdmin() public {
        FeeVaultV2 newImpl = new FeeVaultV2();

        vm.prank(admin);
        feeVault.upgradeTo(address(newImpl));

        FeeVaultV2 vaultV2 = FeeVaultV2(address(feeVault));
        assertEq(vaultV2.getVersion(), "v2", "Should be upgraded to v2");
    }

    function testFeeVaultUpgradeRevertsForNonAdmin() public {
        FeeVaultV2 newImpl = new FeeVaultV2();

        vm.expectRevert();
        vm.prank(nonAdmin);
        feeVault.upgradeTo(address(newImpl));
    }

    function testFeeVaultPreservesBalancesAfterUpgrade() public {
        // Create token and generate fees
        (address curve_, address token_) = createTestToken(creator);
        buyTokens(user1, token_, 1 ether);

        // User1 sells some tokens to generate fee
        uint256 user1Bal = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), user1Bal / 2);
        core.exactInSell(user1Bal / 2, 0, token_, user1, user1, block.timestamp + 1 hours);
        vm.stopPrank();

        uint256 vaultAssetsBefore = feeVault.totalAssets();

        // Upgrade FeeVault
        FeeVaultV2 newImpl = new FeeVaultV2();
        vm.prank(admin);
        feeVault.upgradeTo(address(newImpl));

        // Verify assets preserved
        uint256 vaultAssetsAfter = feeVault.totalAssets();
        assertEq(vaultAssetsAfter, vaultAssetsBefore, "Vault assets should be preserved");
    }

    // ==================== Multi-Contract Upgrade Tests ====================

    function testUpgradeAllContractsSequentially() public {
        // Create token before any upgrades
        (address curve_, address token_) = createTestToken(creator);
        buyTokens(user1, token_, 1 ether);

        uint256 user1BalBefore = IERC20(token_).balanceOf(user1);

        // Upgrade Core
        CoreV2 newCoreImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newCoreImpl));

        // Upgrade Factory
        BondingCurveFactoryV2 newFactoryImpl = new BondingCurveFactoryV2(address(wNative));
        vm.prank(admin);
        factory.upgradeTo(address(newFactoryImpl));

        // Upgrade FeeVault
        FeeVaultV2 newVaultImpl = new FeeVaultV2();
        vm.prank(admin);
        feeVault.upgradeTo(address(newVaultImpl));

        // Verify all contracts upgraded
        assertEq(CoreV2(address(core)).getVersion(), "v2", "Core should be v2");
        assertEq(BondingCurveFactoryV2(address(factory)).getVersion(), "v2", "Factory should be v2");
        assertEq(FeeVaultV2(address(feeVault)).getVersion(), "v2", "FeeVault should be v2");

        // System should still work
        uint256 balBefore = IERC20(token_).balanceOf(user1);
        buyTokens(user1, token_, 1 ether);
        uint256 balAfter = IERC20(token_).balanceOf(user1);

        assertGt(balAfter, balBefore, "Should be able to trade after all upgrades");
    }

    function testCreateNewTokenAfterAllUpgrades() public {
        // Upgrade all contracts
        CoreV2 newCoreImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newCoreImpl));

        BondingCurveFactoryV2 newFactoryImpl = new BondingCurveFactoryV2(address(wNative));
        vm.prank(admin);
        factory.upgradeTo(address(newFactoryImpl));

        FeeVaultV2 newVaultImpl = new FeeVaultV2();
        vm.prank(admin);
        feeVault.upgradeTo(address(newVaultImpl));

        // Create new token - should work with upgraded contracts
        (address curve_, address token_) = createTestToken(creator);

        assertFalse(curve_ == address(0), "New curve should be created");
        assertFalse(token_ == address(0), "New token should be created");

        // Should be able to trade new token
        buyTokens(user1, token_, 1 ether);
        uint256 balance = IERC20(token_).balanceOf(user1);

        assertGt(balance, 0, "Should be able to buy new token after upgrade");
    }

    // ==================== Emergency Scenarios ====================

    function testUpgradeWhilePaused() public {
        // Pause Core
        vm.prank(admin);
        core.pause();

        assertTrue(core.paused(), "Core should be paused");

        // Upgrade should still work while paused
        CoreV2 newCoreImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newCoreImpl));

        // Verify upgrade worked
        assertEq(CoreV2(address(core)).getVersion(), "v2", "Should be upgraded to v2");

        // Should still be paused
        assertTrue(core.paused(), "Core should still be paused after upgrade");

        // Unpause and verify functionality
        vm.prank(admin);
        core.unpause();

        (address curve_, address token_) = createTestToken(creator);
        assertFalse(token_ == address(0), "Should work after unpause");
    }

    function testUpgradeWithPendingTrades() public {
        // Create token and have user buy
        (address curve_, address token_) = createTestToken(creator);
        buyTokens(user1, token_, 5 ether);

        uint256 user1BalBefore = IERC20(token_).balanceOf(user1);

        // Upgrade while user has tokens
        CoreV2 newCoreImpl = new CoreV2(address(wNative), address(feeVault));
        vm.prank(admin);
        core.upgradeTo(address(newCoreImpl));

        // User can still sell after upgrade
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), user1BalBefore);
        uint256 wNativeBefore = wNative.balanceOf(user1);
        core.exactInSell(user1BalBefore, 0, token_, user1, user1, block.timestamp + 1 hours);
        uint256 wNativeAfter = wNative.balanceOf(user1);
        vm.stopPrank();

        assertGt(wNativeAfter, wNativeBefore, "User should receive wNative from sell after upgrade");
    }
}
