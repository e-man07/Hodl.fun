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
import "../../src/UniswapV3Pool.sol";

/// @title Mock WPUSH for integration testing
contract MockWNativeIntegration is ERC20 {
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

/// @title Integration tests for graduation and DEX listing flow
contract ListingIntegrationTest is Test {
    MockWNativeIntegration wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x10);
    address user2 = address(0x11);
    address user3 = address(0x12);

    // Configuration - using lower graduation cap for faster testing
    uint256 deployFee = 0.01 ether;
    uint256 listingFee = 0.1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 50_000_000 * 1e18; // 50M tokens
    uint256 graduationMarketCap = 100 ether; // Lower for testing
    uint8 feeDenominator = 100;
    uint16 feeNumerator = 1; // 1% fee
    uint24 dexFee = 3000; // 0.30% tier

    function setUp() public {
        wNative = new MockWNativeIntegration();

        // Fund accounts
        vm.deal(admin, 10000 ether);
        vm.deal(creator, 10000 ether);
        vm.deal(user1, 10000 ether);
        vm.deal(user2, 10000 ether);
        vm.deal(user3, 10000 ether);

        // Deploy Uniswap V3 Factory
        uniswapFactory = new UniswapV3Factory();

        // Deploy FeeVault
        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        // Deploy Core
        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(address(new ERC1967Proxy(address(coreImpl), "")));

        // Deploy Factory
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), "")));

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
            "Graduation Token",
            "GRAD",
            "ipfs://graduation",
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

    // ==================== Graduation Tests ====================

    function testGraduationTriggeredByMarketCap() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Initial state: not locked
        assertFalse(bc.getLock(), "Curve should not be locked initially");

        // Calculate how much native we need to reach graduation market cap
        // Market cap = price * totalSupply
        // We need to buy enough to push price up
        uint256 marketCapBefore = bc.calculateMarketCap();
        console.log("Market cap before:", marketCapBefore);
        console.log("Graduation threshold:", graduationMarketCap);

        // Buy in chunks until graduation
        uint256 totalBought = 0;
        uint256 buyAmount = 10 ether;

        while (!bc.getLock() && totalBought < 1000 ether) {
            buyTokens(user1, token_, buyAmount);
            totalBought += buyAmount;

            uint256 currentMarketCap = bc.calculateMarketCap();
            console.log("Total bought:", totalBought, "Market cap:", currentMarketCap);
        }

        assertTrue(bc.getLock(), "Curve should be locked after reaching graduation market cap");

        uint256 marketCapAfter = bc.calculateMarketCap();
        assertGe(marketCapAfter, graduationMarketCap, "Market cap should be >= graduation threshold");
    }

    function testCannotBuyAfterGraduation() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy until graduation
        uint256 buyAmount = 10 ether;
        while (!bc.getLock()) {
            buyTokens(user1, token_, buyAmount);
        }

        assertTrue(bc.getLock(), "Curve should be locked");

        // Try to buy after graduation
        vm.startPrank(user2);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert();
        core.exactInBuy(1 ether, 0, token_, user2, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function testCannotSellAfterGraduation() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy some tokens first
        uint256 tokensReceived = buyTokens(user1, token_, 5 ether);

        // Buy more until graduation
        uint256 buyAmount = 10 ether;
        while (!bc.getLock()) {
            buyTokens(user2, token_, buyAmount);
        }

        assertTrue(bc.getLock(), "Curve should be locked");

        // User1 tries to sell their tokens
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensReceived);

        vm.expectRevert();
        core.exactInSell(tokensReceived, 0, token_, user1, user1, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    // ==================== Listing Tests ====================

    function testListingCreatesPool() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate the curve
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        assertTrue(bc.getLock(), "Curve should be locked");
        assertFalse(bc.getIsListing(), "Should not be listed yet");

        // Call listing
        address pool = bc.listing();

        assertTrue(bc.getIsListing(), "Should be listed after listing()");
        assertTrue(pool != address(0), "Pool address should not be zero");

        // Verify pool was created in factory
        address token0 = address(wNative) < token_ ? address(wNative) : token_;
        address token1 = address(wNative) < token_ ? token_ : address(wNative);
        address factoryPool = uniswapFactory.getPool(token0, token1, dexFee);

        assertEq(pool, factoryPool, "Pool should match factory pool");
    }

    function testListingRevertsIfNotLocked() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertFalse(bc.getLock(), "Should not be locked");

        vm.expectRevert(BondingCurve.OnlyLock.selector);
        bc.listing();
    }

    function testListingRevertsIfAlreadyListed() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        bc.listing();
        assertTrue(bc.getIsListing(), "Should be listed");

        // Try to list again
        vm.expectRevert(BondingCurve.AlreadyListed.selector);
        bc.listing();
    }

    function testListingTransfersFeesToVault() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        uint256 vaultBalBefore = wNative.balanceOf(address(feeVault));

        bc.listing();

        uint256 vaultBalAfter = wNative.balanceOf(address(feeVault));

        // Listing fee should have been transferred to vault
        assertGe(vaultBalAfter, vaultBalBefore + listingFee, "Vault should receive listing fee");
    }

    function testListingResetsReserves() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        (uint256 nativeResBefore, uint256 tokenResBefore) = bc.getReserves();
        assertGt(nativeResBefore, 0, "Should have native reserves before listing");

        bc.listing();

        (uint256 nativeResAfter, uint256 tokenResAfter) = bc.getReserves();
        assertEq(nativeResAfter, 0, "Native reserves should be 0 after listing");
        assertEq(tokenResAfter, 0, "Token reserves should be 0 after listing");
    }

    function testListingEmitsEvent() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        vm.expectEmit(true, true, false, false);
        emit IBondingCurve.Listing(curve_, token_, address(0), 0, 0, 0);

        bc.listing();
    }

    // ==================== Pool State Tests ====================

    function testPoolHasLiquidity() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        address pool = bc.listing();

        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        uint128 poolLiquidity = poolContract.liquidity();

        assertGt(poolLiquidity, 0, "Pool should have liquidity");
    }

    function testPoolTokensMatchExpected() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        while (!bc.getLock()) {
            buyTokens(user1, token_, 10 ether);
        }

        address pool = bc.listing();

        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);

        address poolToken0 = poolContract.token0();
        address poolToken1 = poolContract.token1();

        // Verify tokens are correctly ordered
        assertTrue(poolToken0 < poolToken1, "Token0 should be less than token1");

        // One should be wNative, one should be the token
        bool hasWNative = (poolToken0 == address(wNative)) || (poolToken1 == address(wNative));
        bool hasToken = (poolToken0 == token_) || (poolToken1 == token_);

        assertTrue(hasWNative, "Pool should contain wNative");
        assertTrue(hasToken, "Pool should contain token");
    }

    // ==================== Full Flow Tests ====================

    function testFullGraduationToListingFlow() public {
        // 1. Create token
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertFalse(bc.getLock(), "Not locked initially");
        assertFalse(bc.getIsListing(), "Not listed initially");

        // 2. Multiple users buy tokens - use small amounts to not trigger graduation
        uint256 user1Tokens = buyTokens(user1, token_, 0.5 ether);
        uint256 user2Tokens = buyTokens(user2, token_, 0.3 ether);

        assertGt(user1Tokens, 0, "User1 should have tokens");
        assertGt(user2Tokens, 0, "User2 should have tokens");

        // 3. Buy until graduation
        while (!bc.getLock()) {
            buyTokens(user3, token_, 10 ether);
        }

        assertTrue(bc.getLock(), "Curve should be locked");

        // 4. List on DEX
        address pool = bc.listing();

        assertTrue(bc.getIsListing(), "Should be listed");
        assertTrue(pool != address(0), "Pool should exist");

        // 5. Verify pool state
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        assertGt(poolContract.liquidity(), 0, "Pool should have liquidity");

        // 6. Verify curve reserves are empty
        (uint256 nativeRes, uint256 tokenRes) = bc.getReserves();
        assertEq(nativeRes, 0, "No native reserves");
        assertEq(tokenRes, 0, "No token reserves");

        // 7. Users still hold their tokens
        assertEq(IERC20(token_).balanceOf(user1), user1Tokens, "User1 still has tokens");
        assertEq(IERC20(token_).balanceOf(user2), user2Tokens, "User2 still has tokens");
    }

    function testATHTrackingThroughGraduation() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 lastATHPrice;
        uint256 lastATHMarketCap;

        // Buy in stages, checking ATH updates
        uint256 stages = 0;
        while (!bc.getLock() && stages < 50) {
            uint256 priceBefore = bc.getCurrentPrice();

            buyTokens(user1, token_, 2 ether);

            uint256 priceAfter = bc.getCurrentPrice();
            (uint256 athPrice, ) = bc.getATHPrice();
            (uint256 athMarketCap, ) = bc.getATHMarketCap();

            // Price should increase after buy
            assertGt(priceAfter, priceBefore, "Price should increase after buy");

            // ATH should be >= current price
            assertGe(athPrice, priceAfter, "ATH price should be >= current price");

            // ATH values should never decrease
            assertGe(athPrice, lastATHPrice, "ATH price should never decrease");
            assertGe(athMarketCap, lastATHMarketCap, "ATH market cap should never decrease");

            lastATHPrice = athPrice;
            lastATHMarketCap = athMarketCap;
            stages++;
        }

        assertTrue(bc.getLock(), "Should have graduated");

        // After graduation, ATH should equal final state
        (uint256 finalATHPrice, ) = bc.getATHPrice();
        assertEq(finalATHPrice, lastATHPrice, "Final ATH should match last recorded");
    }

    function testCreatorFeesAccumulatedDuringTrading() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens first - use small amounts to avoid graduation
        buyTokens(user1, token_, 1 ether);

        // Ensure curve is not locked yet
        assertFalse(bc.getLock(), "Curve should not be locked yet");

        // Note: Creator fees are only accumulated from SELL operations
        // On buys, fees are deferred (tokens burned), not distributed to creator
        // So we need to sell to generate creator fees

        // Sell some tokens to generate sell fees (which go to creator)
        uint256 user1Balance = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), user1Balance / 2);
        core.exactInSell(user1Balance / 2, 0, token_, user1, user1, block.timestamp + 1 hours);
        vm.stopPrank();

        // Check creator has accumulated fees from sells
        uint256 creatorAccFees = factory.creatorFees(creator);
        assertGt(creatorAccFees, 0, "Creator should have accumulated fees from sells");
    }

    function testCreatorCanClaimFeesAfterListing() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy some tokens (smaller amounts to avoid premature graduation)
        buyTokens(user1, token_, 1 ether);

        // Sell some tokens to generate sell fees (only if not locked)
        if (!bc.getLock()) {
            uint256 user1Balance = IERC20(token_).balanceOf(user1);
            vm.startPrank(user1);
            IERC20(token_).approve(address(core), user1Balance / 2);
            core.exactInSell(user1Balance / 2, 0, token_, user1, user1, block.timestamp + 1 hours);
            vm.stopPrank();
        }

        // Buy until graduation
        while (!bc.getLock()) {
            buyTokens(user2, token_, 5 ether);
        }

        // List
        bc.listing();

        // Creator claims fees
        uint256 accumulatedFees = factory.creatorFees(creator);
        assertGt(accumulatedFees, 0, "Should have accumulated fees");

        uint256 creatorWNativeBefore = wNative.balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorWNativeAfter = wNative.balanceOf(creator);
        assertEq(creatorWNativeAfter - creatorWNativeBefore, accumulatedFees, "Creator should receive all accumulated fees");

        // Fees should be zeroed after claim
        assertEq(factory.creatorFees(creator), 0, "Accumulated fees should be 0 after claim");
    }
}
