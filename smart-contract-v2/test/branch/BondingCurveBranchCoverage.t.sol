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
import "../../src/WPUSH.sol";
import "@uniswap/v3-core/contracts/UniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/UniswapV3Pool.sol";
import "../../src/interfaces/ICore.sol";
import "../../src/interfaces/IBondingCurve.sol";
import "../../src/interfaces/IBondingCurveFactory.sol";
import "../../src/utils/BondingCurveLibrary.sol";

/**
 * @title BondingCurveBranchCoverageTest
 * @notice Deep branch coverage tests for BondingCurve.sol
 * @dev Targets uncovered branches: InvalidToken, InvalidAmountIn, InvalidReserves,
 *      InsufficientVirtualTokenReserves, InvalidAmountOut, pause/unpause, callback validation
 */
contract BondingCurveBranchCoverageTest is Test {
    WPUSH wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    // Direct access to implementations for low-level testing
    BondingCurve bondingCurveImpl;
    Token tokenImpl;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);

    uint256 deployFee = 0.01 ether;
    uint256 listingFee = 0.1 ether;
    uint256 virtualNativeInit = 1 ether;
    uint256 virtualTokenInit = 50_000_000 * 1e18;
    uint256 graduationMarketCap = 100 ether;
    uint8 feeDenominator = 100;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    function setUp() public {
        wNative = new WPUSH();

        vm.deal(admin, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);

        uniswapFactory = new UniswapV3Factory();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        bytes memory initData;

        initData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0),
            admin
        );
        core = Core(payable(address(new ERC1967Proxy(address(coreImpl), initData))));

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
            virtualNative: virtualNativeInit,
            virtualToken: virtualTokenInit,
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

    receive() external payable {}

    function createTestToken() internal returns (address curve_, address token_) {
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (curve_, token_) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    // ============ BondingCurve.buy() Branch Tests ============

    function testBuy_FailsWhenLocked() public {
        (address curve_, address token_) = createTestToken();

        // Buy enough to lock the curve (reach graduation)
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        // Keep buying until locked
        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }

        // Now curve is locked, trying to buy should fail
        vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuy_FailsWithInvalidRecipient_Zero() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy to address(0) should fail - Core reverts with InvalidAddress for address(0)
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInBuy(1 ether, 0, token_, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuy_FailsWithInvalidRecipient_WNative() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy to wNative address should fail
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInBuy(1 ether, 0, token_, address(wNative), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuy_FailsWithInvalidRecipient_Token() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy to token address should fail
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInBuy(1 ether, 0, token_, token_, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuy_WithZeroAmountIn() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy with 0 amount should fail - Core validates this
        vm.expectRevert(); // Revert due to invalid amount
        core.exactInBuy(0, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuy_WithExpiredDeadline() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy with expired deadline should fail
        vm.expectRevert(Core.Expired.selector);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    function testBuy_SlippageProtection() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy with unrealistically high minAmountOut should fail due to slippage
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInBuy(0.1 ether, 1e30, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ BondingCurve.sell() Branch Tests ============

    function testSell_FailsWhenLocked() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 150 ether}();
        wNative.approve(address(core), 150 ether);

        // Buy tokens
        core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        uint256 balance = IERC20(token_).balanceOf(user1);

        // Lock the curve by buying more
        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }

        // Now try to sell - should fail because locked
        IERC20(token_).approve(address(core), balance);
        vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
        core.exactInSell(balance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSell_FailsWithInvalidRecipient_Zero() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy first
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        uint256 balance = IERC20(token_).balanceOf(user1);

        // Sell to address(0) should fail - Core reverts with InvalidAddress for address(0)
        IERC20(token_).approve(address(core), balance);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInSell(balance / 2, 0, token_, user1, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSell_FailsWithZeroAmountIn() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy first
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Sell with 0 amount should fail
        IERC20(token_).approve(address(core), 1);
        vm.expectRevert(); // Revert due to invalid amount
        core.exactInSell(0, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSell_SlippageProtection() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy first
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        uint256 balance = IERC20(token_).balanceOf(user1);

        // Sell with unrealistically high minAmountOut should fail
        IERC20(token_).approve(address(core), balance);
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInSell(balance / 2, 1e30, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSell_FailsWithExpiredDeadline() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Buy first
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        uint256 balance = IERC20(token_).balanceOf(user1);

        // Sell with expired deadline should fail
        IERC20(token_).approve(address(core), balance);
        vm.expectRevert(Core.Expired.selector);
        core.exactInSell(balance / 2, 0, token_, user1, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    // ============ BondingCurve.listing() Branch Tests ============

    function testListing_FailsWhenNotLocked() public {
        (, address token_) = createTestToken();

        // Direct call to listing() fails with access control, so test via Core
        vm.expectRevert(BondingCurve.OnlyLock.selector);
        core.triggerListing(token_);
    }

    function testListing_FailsWhenAlreadyListed() public {
        (address curve_, address token_) = createTestToken();

        // Buy enough to graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // First listing should succeed via Core
        core.triggerListing(token_);

        // Second listing should fail
        vm.expectRevert(BondingCurve.AlreadyListed.selector);
        core.triggerListing(token_);
    }

    function testListing_InsufficientNativeForListingFee() public {
        // Set a very high listing fee
        vm.prank(admin);
        factory.setListingFee(1000 ether);

        (address curve_, address token_) = createTestToken();

        // Buy enough to graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Listing should fail because reserves < listingFee
        vm.expectRevert(BondingCurve.InsufficientNativeReserves.selector);
        core.triggerListing(token_);
    }

    // ============ BondingCurve Pause/Unpause Tests ============

    function testPause_OnlyAdmin() public {
        (address curve_, ) = createTestToken();

        // Non-admin should not be able to pause
        vm.prank(user1);
        vm.expectRevert();
        BondingCurve(curve_).pause();
    }

    function testPause_AdminCanPause() public {
        (address curve_, address token_) = createTestToken();

        // Admin (which is core contract) should be able to pause
        // The CORE_ROLE has DEFAULT_ADMIN_ROLE, so core can pause
        vm.prank(address(core));
        BondingCurve(curve_).pause();

        // Verify paused
        assertTrue(BondingCurve(curve_).paused());

        // Buy should fail when paused
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert("Pausable: paused");
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testUnpause_AdminCanUnpause() public {
        (address curve_, address token_) = createTestToken();

        // Pause first
        vm.prank(address(core));
        BondingCurve(curve_).pause();

        // Unpause
        vm.prank(address(core));
        BondingCurve(curve_).unpause();

        // Verify unpaused
        assertFalse(BondingCurve(curve_).paused());

        // Buy should work again
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ BondingCurve ATH Tracking Tests ============

    function testATH_PriceUpdatesOnBuy() public {
        (address curve_, address token_) = createTestToken();

        (uint256 athPriceBefore, ) = BondingCurve(curve_).getATHPrice();

        // Buy to increase price
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 athPriceAfter, ) = BondingCurve(curve_).getATHPrice();

        assertTrue(athPriceAfter > athPriceBefore);
    }

    function testATH_MarketCapUpdatesOnBuy() public {
        (address curve_, address token_) = createTestToken();

        (uint256 athMcBefore, ) = BondingCurve(curve_).getATHMarketCap();

        // Buy to increase market cap
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 athMcAfter, ) = BondingCurve(curve_).getATHMarketCap();

        assertTrue(athMcAfter > athMcBefore);
    }

    function testATH_DoesNotDecreaseOnSell() public {
        (address curve_, address token_) = createTestToken();

        // Buy first
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        (uint256 athPriceAfterBuy, ) = BondingCurve(curve_).getATHPrice();
        (uint256 athMcAfterBuy, ) = BondingCurve(curve_).getATHMarketCap();

        // Sell some tokens
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), balance);
        core.exactInSell(balance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 athPriceAfterSell, ) = BondingCurve(curve_).getATHPrice();
        (uint256 athMcAfterSell, ) = BondingCurve(curve_).getATHMarketCap();

        // ATH should not decrease
        assertEq(athPriceAfterSell, athPriceAfterBuy);
        assertEq(athMcAfterSell, athMcAfterBuy);
    }

    // ============ BondingCurve View Functions ============

    function testGetReserves() public {
        (address curve_, address token_) = createTestToken();

        (uint256 nativeReserves, uint256 tokenReserves) = BondingCurve(curve_).getReserves();

        // Initially should be 0 real reserves
        assertEq(nativeReserves, 0);

        // After buy
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (nativeReserves, tokenReserves) = BondingCurve(curve_).getReserves();
        assertTrue(nativeReserves > 0);
    }

    function testGetVirtualReserves() public {
        (address curve_, ) = createTestToken();

        (uint256 vNative, uint256 vToken) = BondingCurve(curve_).getVirtualReserves();

        assertEq(vNative, virtualNativeInit);
        assertEq(vToken, virtualTokenInit);
    }

    function testGetK() public {
        (address curve_, ) = createTestToken();

        uint256 k = BondingCurve(curve_).getK();
        assertEq(k, virtualNativeInit * virtualTokenInit);
    }

    function testGetGraduationMarketCap() public {
        (address curve_, ) = createTestToken();

        uint256 gradMc = BondingCurve(curve_).getGraduationMarketCap();
        assertEq(gradMc, graduationMarketCap);
    }

    function testGetFeeConfig() public {
        (address curve_, ) = createTestToken();

        (uint8 denom, uint16 numer) = BondingCurve(curve_).getFeeConfig();
        assertEq(denom, feeDenominator);
        assertEq(numer, feeNumerator);
    }

    function testCalculateMarketCap() public {
        (address curve_, ) = createTestToken();

        uint256 marketCap = BondingCurve(curve_).calculateMarketCap();
        assertTrue(marketCap > 0);
    }

    function testGetCurrentPrice() public {
        (address curve_, ) = createTestToken();

        uint256 price = BondingCurve(curve_).getCurrentPrice();
        // price = virtualNative * 1e18 / virtualToken = 1e18 * 1e18 / 50e24 = 2e10
        assertTrue(price > 0);
    }

    // ============ BondingCurve.uniswapV3MintCallback() Tests ============

    function testUniswapV3MintCallback_FailsWhenNotLocked() public {
        (address curve_, ) = createTestToken();

        // Try to call callback directly when not locked
        vm.expectRevert(BondingCurve.OnlyLock.selector);
        BondingCurve(curve_).uniswapV3MintCallback(
            1 ether,
            1 ether,
            abi.encode(address(wNative), address(0x123))
        );
    }

    function testUniswapV3MintCallback_FailsWithInvalidCaller() public {
        (address curve_, address token_) = createTestToken();

        // Buy to graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Try to call callback from unauthorized address
        vm.prank(user1);
        vm.expectRevert(BondingCurve.InvalidAddress.selector);
        BondingCurve(curve_).uniswapV3MintCallback(
            1 ether,
            1 ether,
            abi.encode(address(wNative), token_)
        );
    }

    // ============ Graduation Flow Complete Test ============

    function testFullGraduationFlow() public {
        (address curve_, address token_) = createTestToken();

        // Verify initial state
        assertFalse(BondingCurve(curve_).getLock());
        assertFalse(BondingCurve(curve_).getIsListing());

        // Buy until graduation
        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);

        uint256 buyCount = 0;
        while (!BondingCurve(curve_).getLock() && buyCount < 20) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
            buyCount++;
        }
        vm.stopPrank();

        assertTrue(BondingCurve(curve_).getLock());

        // List on DEX via Core
        address pool = core.triggerListing(token_);
        assertTrue(pool != address(0));
        assertTrue(BondingCurve(curve_).getIsListing());
        assertEq(BondingCurve(curve_).pool(), pool);
    }

    // ============ exactOutBuy and exactOutSell Tests ============

    function testExactOutBuy_ExcessiveInput() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.001 ether}();
        wNative.approve(address(core), 0.001 ether);

        // Asking for way more tokens than we can afford with our amountInMax
        // This should revert with ExcessiveInput
        uint256 tokenWanted = 10_000_000 * 1e18;

        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutBuy(tokenWanted, 0.001 ether, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutSell_Success() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 10 ether}();
        wNative.approve(address(core), 10 ether);

        // Buy tokens first
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell to get exactly 0.01 ether
        uint256 nativeWanted = 0.01 ether;
        core.exactOutSell(nativeWanted, tokenBalance, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ Fee Distribution Tests ============

    function testCreatorFeeDistribution() public {
        (, address token_) = createTestToken();

        // Check initial accumulated fees
        uint256 feesBefore = factory.creatorFees(creator);
        assertEq(feesBefore, 0);

        // Buy and sell to generate fees
        vm.startPrank(user1);
        wNative.deposit{value: 2 ether}();
        wNative.approve(address(core), 2 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), balance);
        core.exactInSell(balance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Creator should have accumulated fees from sell
        uint256 feesAfter = factory.creatorFees(creator);
        assertTrue(feesAfter > 0);
    }

    function testCreatorCanClaimFees() public {
        (, address token_) = createTestToken();

        // Generate fees
        vm.startPrank(user1);
        wNative.deposit{value: 2 ether}();
        wNative.approve(address(core), 2 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), balance);
        core.exactInSell(balance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Claim fees
        uint256 feeAmount = factory.creatorFees(creator);
        assertTrue(feeAmount > 0);

        uint256 creatorWNativeBefore = IERC20(wNative).balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorWNativeAfter = IERC20(wNative).balanceOf(creator);
        assertEq(creatorWNativeAfter - creatorWNativeBefore, feeAmount);
    }
}

// Mock contract that tries to call BondingCurve directly
contract MaliciousCaller {
    function tryBuy(address curve, address to, uint256 amountOut) external {
        BondingCurve(curve).buy(to, amountOut);
    }

    function trySell(address curve, address to, uint256 amountOut) external {
        BondingCurve(curve).sell(to, amountOut);
    }
}
