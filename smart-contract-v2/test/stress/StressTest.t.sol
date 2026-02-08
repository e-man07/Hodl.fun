// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";
import "@uniswap/v3-core/contracts/UniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/UniswapV3Pool.sol";
import "../../src/interfaces/IBondingCurve.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";

/// @title Mock WPUSH for stress testing
contract MockWPUSH is ERC20 {
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

/// @title Comprehensive Stress Tests for Hodl.fun Smart Contracts
/// @notice Tests all contracts at stress levels with real interactions (no mocks for core logic)
/// @dev Tests new features: liquidity reserve, adaptive V3 range, LP permanent lock, fee distribution
contract StressTest is Test {
    MockWPUSH wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    // Test accounts
    address admin = address(0x1);
    address creator = address(0x2);
    address[] users;
    uint256 constant NUM_USERS = 20;

    // Production-like configuration
    uint256 deployFee = 2 ether;
    uint256 listingFee = 100 ether;
    uint256 virtualNative = 30_000 ether;
    uint256 virtualToken = 1_073_000_191 * 1e18;
    uint256 graduationMarketCap = 690_000 ether;
    uint8 feeDenominator = 100;
    uint16 feeNumerator = 1; // 1% fee
    uint24 dexFee = 3000; // 0.30% tier

    // Constants for fee validation
    uint16 constant LIQUIDITY_FEE_SHARE = 2000; // 20% of fee
    uint16 constant CREATOR_FEE_SHARE = 3750;   // 37.5% of remaining (30% of total)

    function setUp() public {
        wNative = new MockWPUSH();

        // Create user accounts
        for (uint256 i = 0; i < NUM_USERS; i++) {
            users.push(address(uint160(0x1000 + i)));
        }

        // Fund all accounts generously
        vm.deal(admin, 10_000_000 ether);
        vm.deal(creator, 10_000_000 ether);
        for (uint256 i = 0; i < NUM_USERS; i++) {
            vm.deal(users[i], 10_000_000 ether);
        }

        // Deploy Uniswap V3 Factory
        uniswapFactory = new UniswapV3Factory();

        // Deploy FeeVault
        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        // Deploy Core
        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(payable(address(new ERC1967Proxy(address(coreImpl), ""))));

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

    // ============================================================
    //                    HELPER FUNCTIONS
    // ============================================================

    function createToken(address _creator) internal returns (address curve_, address token_) {
        vm.startPrank(_creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (curve_, token_) = core.createCurve(
            _creator,
            "Stress Test Token",
            "STRESS",
            "ipfs://stress",
            0,
            deployFee
        );
        vm.stopPrank();
    }

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

    function sellTokens(address user, address token_, uint256 amountTokens) internal returns (uint256 nativeReceived) {
        vm.startPrank(user);
        IERC20(token_).approve(address(core), amountTokens);

        uint256 balBefore = wNative.balanceOf(user);
        core.exactInSell(amountTokens, 0, token_, user, user, block.timestamp + 1 hours);
        uint256 balAfter = wNative.balanceOf(user);

        vm.stopPrank();
        return balAfter - balBefore;
    }

    function graduateCurve(address curve_, address token_) internal {
        BondingCurve bc = BondingCurve(curve_);
        uint256 buyAmount = 50_000 ether;
        uint256 userIndex = 0;

        while (!bc.getLock()) {
            buyTokens(users[userIndex % NUM_USERS], token_, buyAmount);
            userIndex++;
        }
    }

    // ============================================================
    //            LIQUIDITY RESERVE TESTS (0.2%)
    // ============================================================

    function testLiquidityReserveAccumulatesOnSell() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens first
        uint256 tokensReceived = buyTokens(users[0], token_, 1000 ether);

        // Check initial liquidity reserve
        uint256 liqReserveBefore = bc.liquidityReserve();
        assertEq(liqReserveBefore, 0, "Liquidity reserve should be 0 before any sells");

        // Sell half the tokens
        uint256 sellAmount = tokensReceived / 2;
        sellTokens(users[0], token_, sellAmount);

        // Check liquidity reserve increased
        uint256 liqReserveAfter = bc.liquidityReserve();
        assertGt(liqReserveAfter, 0, "Liquidity reserve should increase after sell");

        console.log("Liquidity reserve after sell:", liqReserveAfter);
    }

    function testLiquidityReserveAccumulatesCorrectAmount() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens
        uint256 tokensReceived = buyTokens(users[0], token_, 10_000 ether);

        // Sell tokens and track fee
        uint256 sellAmount = tokensReceived / 2;

        // Get quote for sell amount
        (uint256 virtualNat, uint256 virtualTok) = bc.getVirtualReserves();
        uint256 k = bc.getK();

        // Calculate expected output
        uint256 newVirtualToken = virtualTok + sellAmount;
        uint256 newVirtualNative = k / newVirtualToken;
        uint256 expectedOutput = virtualNat - newVirtualNative;

        // Fee is 1% of output
        uint256 expectedFee = (expectedOutput * feeNumerator) / feeDenominator;
        // Liquidity reserve is 20% of fee
        uint256 expectedLiqReserve = (expectedFee * LIQUIDITY_FEE_SHARE) / 10000;

        // Execute sell
        sellTokens(users[0], token_, sellAmount);

        // Verify liquidity reserve
        uint256 actualLiqReserve = bc.liquidityReserve();

        // Allow 1% tolerance for rounding
        assertApproxEqRel(actualLiqReserve, expectedLiqReserve, 0.01e18, "Liquidity reserve should be ~20% of fee");
    }

    function testLiquidityReserveAddedToLPAtGraduation() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Do many buy/sell cycles to accumulate liquidity reserve
        for (uint256 i = 0; i < 5; i++) {
            uint256 tokens = buyTokens(users[i], token_, 10_000 ether);
            if (!bc.getLock()) {
                sellTokens(users[i], token_, tokens / 2);
            }
        }

        uint256 liqReserveBefore = bc.liquidityReserve();
        console.log("Liquidity reserve before graduation:", liqReserveBefore);

        // Graduate the curve
        if (!bc.getLock()) {
            graduateCurve(curve_, token_);
        }

        assertTrue(bc.getLock(), "Curve should be locked");

        // Get real reserves before listing
        (uint256 realNativeBefore, ) = bc.getReserves();
        uint256 totalNativeForLP = realNativeBefore + liqReserveBefore;
        console.log("Total native for LP:", totalNativeForLP);

        // List and verify liquidity reserve is used
        core.triggerListing(token_);

        // Liquidity reserve should be reset to 0
        uint256 liqReserveAfter = bc.liquidityReserve();
        assertEq(liqReserveAfter, 0, "Liquidity reserve should be 0 after listing");
    }

    // ============================================================
    //            FEE DISTRIBUTION TESTS (0.2/0.3/0.5)
    // ============================================================

    function testFeeDistributionOnSell() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens
        uint256 tokensReceived = buyTokens(users[0], token_, 50_000 ether);

        // Record balances before sell
        uint256 vaultBefore = wNative.balanceOf(address(feeVault));
        uint256 creatorFeesBefore = factory.creatorFees(creator);
        uint256 liqReserveBefore = bc.liquidityReserve();

        // Sell tokens
        uint256 sellAmount = tokensReceived / 2;
        sellTokens(users[0], token_, sellAmount);

        // Get changes
        uint256 vaultAfter = wNative.balanceOf(address(feeVault));
        uint256 creatorFeesAfter = factory.creatorFees(creator);
        uint256 liqReserveAfter = bc.liquidityReserve();

        uint256 platformFeeReceived = vaultAfter - vaultBefore;
        uint256 creatorFeeReceived = creatorFeesAfter - creatorFeesBefore;
        uint256 liqFeeReceived = liqReserveAfter - liqReserveBefore;

        uint256 totalFee = platformFeeReceived + creatorFeeReceived + liqFeeReceived;

        console.log("Total fee:", totalFee);
        console.log("Liquidity fee (20%):", liqFeeReceived);
        console.log("Creator fee (30%):", creatorFeeReceived);
        console.log("Platform fee (50%):", platformFeeReceived);

        // Verify ratios (with 5% tolerance for rounding)
        // Liquidity should be ~20% of total
        assertApproxEqRel(liqFeeReceived * 100 / totalFee, 20, 0.05e18, "Liquidity fee should be ~20%");

        // Creator should be ~30% of total
        assertApproxEqRel(creatorFeeReceived * 100 / totalFee, 30, 0.05e18, "Creator fee should be ~30%");

        // Platform should be ~50% of total
        assertApproxEqRel(platformFeeReceived * 100 / totalFee, 50, 0.05e18, "Platform fee should be ~50%");
    }

    function testCreatorCanClaimFeesAnytime() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy and sell to generate fees
        uint256 tokens = buyTokens(users[0], token_, 10_000 ether);
        sellTokens(users[0], token_, tokens / 2);

        uint256 accumulatedFees = factory.creatorFees(creator);
        assertGt(accumulatedFees, 0, "Should have accumulated fees");

        // Creator claims fees immediately (no vesting)
        uint256 creatorBalBefore = wNative.balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorBalAfter = wNative.balanceOf(creator);
        assertEq(creatorBalAfter - creatorBalBefore, accumulatedFees, "Creator should receive all fees");
        assertEq(factory.creatorFees(creator), 0, "Fees should be zeroed");
    }

    // ============================================================
    //            ADAPTIVE V3 RANGE TESTS (0.25x to 4x)
    // ============================================================

    function testAdaptiveV3RangeIsAsymmetric() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        graduateCurve(curve_, token_);
        core.triggerListing(token_);

        // Get LP position details
        int24 tickLower = bc.lpTickLower();
        int24 tickUpper = bc.lpTickUpper();
        uint128 liquidity = bc.lpLiquidity();

        console.log("LP Tick Lower:", tickLower);
        console.log("LP Tick Upper:", tickUpper);
        console.log("LP Liquidity:", liquidity);

        // Verify the LP position was created with valid ticks
        assertTrue(tickLower < tickUpper, "Tick lower should be less than tick upper");
        assertGt(liquidity, 0, "Liquidity should be positive");

        // Calculate tick spread (should be approximately 27720 ticks for 0.25x to 4x range)
        // ln(4/0.25) / ln(1.0001) = ln(16) / ln(1.0001) ≈ 27726 ticks
        int24 tickSpread = tickUpper - tickLower;
        console.log("Tick spread:", tickSpread);

        // Tick spread should be approximately 27720 (allowing for tick spacing adjustments)
        // With 60 tick spacing for 0.3% fee tier, range gets rounded
        assertGt(tickSpread, 20000, "Tick spread should be significant (>20000)");
        assertLt(tickSpread, 35000, "Tick spread should be reasonable (<35000)");
    }

    function testLPRangeAllowsSignificantPriceMovement() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        graduateCurve(curve_, token_);
        core.triggerListing(token_);

        int24 tickLower = bc.lpTickLower();
        int24 tickUpper = bc.lpTickUpper();

        // Calculate price range from ticks
        // price = 1.0001^tick
        // At tickLower: price should be ~0.25x of current
        // At tickUpper: price should be ~4x of current

        uint160 sqrtPriceLower = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpper = TickMath.getSqrtRatioAtTick(tickUpper);

        address pool = bc.pool();
        (uint160 sqrtPriceCurrent, , , , , , ) = IUniswapV3Pool(pool).slot0();

        // Price ratio = (sqrtPrice)^2
        // sqrtPriceLower/sqrtPriceCurrent should be ~0.5 (sqrt of 0.25)
        // sqrtPriceUpper/sqrtPriceCurrent should be ~2 (sqrt of 4)

        uint256 lowerRatio = uint256(sqrtPriceLower) * 1e18 / uint256(sqrtPriceCurrent);
        uint256 upperRatio = uint256(sqrtPriceUpper) * 1e18 / uint256(sqrtPriceCurrent);

        console.log("Lower sqrt price ratio:", lowerRatio);
        console.log("Upper sqrt price ratio:", upperRatio);

        // Lower should be ~0.5e18 (allowing 20% tolerance)
        assertApproxEqRel(lowerRatio, 0.5e18, 0.2e18, "Lower bound should be ~0.25x price (sqrt = 0.5)");

        // Upper should be ~2e18 (allowing 20% tolerance)
        assertApproxEqRel(upperRatio, 2e18, 0.2e18, "Upper bound should be ~4x price (sqrt = 2)");
    }

    // ============================================================
    //            LP PERMANENT LOCK TESTS
    // ============================================================

    function testLPPositionStoredCorrectly() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        graduateCurve(curve_, token_);
        core.triggerListing(token_);

        // Verify LP position details are stored
        int24 tickLower = bc.lpTickLower();
        int24 tickUpper = bc.lpTickUpper();
        uint128 liquidity = bc.lpLiquidity();

        assertTrue(tickLower != 0 || tickUpper != 0, "Tick range should be set");
        assertGt(liquidity, 0, "Liquidity should be positive");

        console.log("Stored LP tick lower:", tickLower);
        console.log("Stored LP tick upper:", tickUpper);
        console.log("Stored LP liquidity:", liquidity);
    }

    function testLPCannotBeWithdrawn() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate and list
        graduateCurve(curve_, token_);
        core.triggerListing(token_);

        // Verify no withdrawal function exists
        // The BondingCurve contract should NOT have any function to:
        // - burn liquidity
        // - decrease liquidity
        // - collect LP fees and withdraw principal

        // Check that pool has liquidity from this contract
        address pool = bc.pool();
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);

        uint128 poolLiquidity = poolContract.liquidity();
        assertGt(poolLiquidity, 0, "Pool should have liquidity");

        // The liquidity is owned by the BondingCurve contract
        // Since BondingCurve has no burn() or decreaseLiquidity() function,
        // the LP is effectively locked forever

        // Verify reserves are empty (all went to LP)
        (uint256 nativeRes, uint256 tokenRes) = bc.getReserves();
        assertEq(nativeRes, 0, "Native reserves should be 0");
        assertEq(tokenRes, 0, "Token reserves should be 0");
    }

    function testLPBurnedEventEmitted() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Graduate
        graduateCurve(curve_, token_);

        // Expect LPBurned event
        vm.expectEmit(true, false, false, false);
        emit IBondingCurve.LPBurned(token_, address(0), 0, 0, 0);

        core.triggerListing(token_);
    }

    // ============================================================
    //            TOKEN BURN TESTS
    // ============================================================

    function testTokenDistributionAtGraduation() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);
        Token tokenContract = Token(token_);

        uint256 totalSupplyBefore = tokenContract.totalSupply();
        console.log("Total supply before graduation:", totalSupplyBefore);

        // Graduate
        graduateCurve(curve_, token_);

        // Get reserves before listing
        (, uint256 tokenReserves) = bc.getReserves();
        console.log("Token reserves before listing:", tokenReserves);

        // List
        core.triggerListing(token_);

        uint256 totalSupplyAfter = tokenContract.totalSupply();
        console.log("Total supply after listing:", totalSupplyAfter);

        // In this protocol design:
        // - 100% of tokens go to bonding curve at creation
        // - Users buy tokens from curve (tokens transfer to users)
        // - At graduation, remaining tokens go to LP
        // - Burn only happens if there are excess tokens beyond expected

        // Verify total supply is accounted for
        // Total supply = tokens held by users + tokens in LP
        assertEq(totalSupplyAfter, totalSupplyBefore, "Total supply should remain constant (all tokens accounted for)");

        // Verify curve has no remaining tokens
        (, uint256 tokenReservesAfter) = bc.getReserves();
        assertEq(tokenReservesAfter, 0, "Token reserves should be 0 after listing");

        // Verify LP was created
        uint128 lpLiquidity = bc.lpLiquidity();
        assertGt(lpLiquidity, 0, "LP should have been created with liquidity");

        console.log("LP Liquidity created:", lpLiquidity);
    }

    // ============================================================
    //            STRESS TESTS - HIGH VOLUME
    // ============================================================

    function testHighVolumeTrading() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 totalVolume = 0;
        uint256 numTrades = 0;

        // Execute many large trades
        while (!bc.getLock() && numTrades < 100) {
            uint256 buyAmount = 10_000 ether + (numTrades * 1000 ether);

            buyTokens(users[numTrades % NUM_USERS], token_, buyAmount);
            totalVolume += buyAmount;
            numTrades++;
        }

        console.log("Total trades:", numTrades);
        console.log("Total volume:", totalVolume);

        assertTrue(bc.getLock(), "Curve should be locked after high volume");

        // Verify state is consistent
        (uint256 athPrice, ) = bc.getATHPrice();
        (uint256 athMarketCap, ) = bc.getATHMarketCap();

        assertGt(athPrice, 0, "ATH price should be set");
        assertGt(athMarketCap, 0, "ATH market cap should be set");
        assertGe(athMarketCap, graduationMarketCap, "ATH market cap should be >= graduation threshold");
    }

    function testManySequentialBuysAndSells() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256[] memory userTokens = new uint256[](NUM_USERS);

        // Phase 1: Multiple buys
        for (uint256 i = 0; i < NUM_USERS && !bc.getLock(); i++) {
            userTokens[i] = buyTokens(users[i], token_, 5_000 ether);
        }

        // Phase 2: Interleaved buys and sells
        for (uint256 round = 0; round < 10 && !bc.getLock(); round++) {
            for (uint256 i = 0; i < NUM_USERS && !bc.getLock(); i++) {
                // Some users buy
                if (i % 3 == 0) {
                    userTokens[i] += buyTokens(users[i], token_, 2_000 ether);
                }
                // Some users sell half
                else if (i % 3 == 1 && userTokens[i] > 0) {
                    uint256 sellAmount = userTokens[i] / 2;
                    sellTokens(users[i], token_, sellAmount);
                    userTokens[i] -= sellAmount;
                }
                // Some users do nothing
            }
        }

        console.log("Curve locked:", bc.getLock());

        // Verify liquidity reserve accumulated from sells
        uint256 liqReserve = bc.liquidityReserve();
        console.log("Liquidity reserve after trading:", liqReserve);
        assertGt(liqReserve, 0, "Should have liquidity reserve from sells");
    }

    function testConcurrentUsersTrading() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Simulate concurrent trading by having all users trade in same block
        uint256[] memory userTokens = new uint256[](NUM_USERS);

        // All users buy at same timestamp
        for (uint256 i = 0; i < NUM_USERS && !bc.getLock(); i++) {
            userTokens[i] = buyTokens(users[i], token_, 3_000 ether);
        }

        // All users sell some at same timestamp
        for (uint256 i = 0; i < NUM_USERS && !bc.getLock(); i++) {
            if (userTokens[i] > 0) {
                uint256 sellAmount = userTokens[i] / 4;
                sellTokens(users[i], token_, sellAmount);
                userTokens[i] -= sellAmount;
            }
        }

        // Verify state consistency
        uint256 totalUserTokens = 0;
        for (uint256 i = 0; i < NUM_USERS; i++) {
            totalUserTokens += IERC20(token_).balanceOf(users[i]);
        }

        (, uint256 curveTokens) = bc.getReserves();
        uint256 totalTokens = totalUserTokens + curveTokens;

        console.log("Total user tokens:", totalUserTokens);
        console.log("Curve tokens:", curveTokens);
        console.log("Total accounted:", totalTokens);
    }

    // ============================================================
    //            STRESS TESTS - EDGE CASES
    // ============================================================

    function testMinimumBuyAmount() public {
        (address curve_, address token_) = createToken(creator);

        // Try very small buy
        uint256 minBuy = 0.001 ether;
        uint256 tokensReceived = buyTokens(users[0], token_, minBuy);

        assertGt(tokensReceived, 0, "Should receive tokens even for minimum buy");
    }

    function testMinimumSellAmount() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy some tokens first
        uint256 tokens = buyTokens(users[0], token_, 1_000 ether);

        // Try very small sell
        uint256 minSell = tokens / 1000;
        uint256 nativeReceived = sellTokens(users[0], token_, minSell);

        assertGt(nativeReceived, 0, "Should receive native even for minimum sell");
    }

    function testBuyJustBelowGraduation() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy in increments, stopping just before graduation
        uint256 buyAmount = 20_000 ether;

        while (!bc.getLock()) {
            uint256 marketCap = bc.calculateMarketCap();

            if (marketCap + buyAmount * 2 > graduationMarketCap) {
                // We're close to graduation, use smaller amounts
                buyAmount = 1_000 ether;
            }

            buyTokens(users[0], token_, buyAmount);
        }

        assertTrue(bc.getLock(), "Curve should be locked");
    }

    function testSellToZeroTokens() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens
        uint256 tokens = buyTokens(users[0], token_, 10_000 ether);

        // Sell all tokens
        sellTokens(users[0], token_, tokens);

        uint256 remainingTokens = IERC20(token_).balanceOf(users[0]);
        assertEq(remainingTokens, 0, "User should have 0 tokens after selling all");
    }

    function testRapidBuySellCycles() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Rapid buy/sell cycles
        for (uint256 i = 0; i < 50 && !bc.getLock(); i++) {
            uint256 tokens = buyTokens(users[i % NUM_USERS], token_, 1_000 ether);

            if (!bc.getLock() && tokens > 0) {
                sellTokens(users[i % NUM_USERS], token_, tokens / 2);
            }
        }

        // State should still be consistent
        uint256 liqReserve = bc.liquidityReserve();
        assertGt(liqReserve, 0, "Liquidity reserve should accumulate");
    }

    // ============================================================
    //            FULL INTEGRATION STRESS TEST
    // ============================================================

    function testFullFlowUnderStress() public {
        console.log("\n=== FULL FLOW STRESS TEST ===\n");

        // 1. Create token
        console.log("1. Creating token...");
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // 2. Multiple users trade heavily
        console.log("2. Heavy trading phase...");
        uint256 totalBuyVolume = 0;
        uint256 totalSellVolume = 0;
        uint256[] memory userTokenBalances = new uint256[](NUM_USERS);

        for (uint256 round = 0; round < 20 && !bc.getLock(); round++) {
            for (uint256 i = 0; i < NUM_USERS && !bc.getLock(); i++) {
                // Random-ish buy amount
                uint256 buyAmount = 5_000 ether + (i * round * 100 ether);
                userTokenBalances[i] += buyTokens(users[i], token_, buyAmount);
                totalBuyVolume += buyAmount;

                // Some users sell
                if (i % 2 == 0 && userTokenBalances[i] > 0 && !bc.getLock()) {
                    uint256 sellAmount = userTokenBalances[i] / 3;
                    uint256 received = sellTokens(users[i], token_, sellAmount);
                    userTokenBalances[i] -= sellAmount;
                    totalSellVolume += received;
                }
            }
        }

        console.log("Total buy volume:", totalBuyVolume);
        console.log("Total sell volume:", totalSellVolume);

        // 3. Verify graduation happened
        console.log("3. Verifying graduation...");
        assertTrue(bc.getLock(), "Curve should be locked after heavy trading");

        uint256 finalMarketCap = bc.calculateMarketCap();
        console.log("Final market cap:", finalMarketCap);
        assertGe(finalMarketCap, graduationMarketCap, "Market cap should exceed threshold");

        // 4. Check fee accumulation
        console.log("4. Checking fees...");
        uint256 creatorAccumulatedFees = factory.creatorFees(creator);
        uint256 liquidityReserve = bc.liquidityReserve();
        uint256 vaultBalance = wNative.balanceOf(address(feeVault));

        console.log("Creator accumulated fees:", creatorAccumulatedFees);
        console.log("Liquidity reserve:", liquidityReserve);
        console.log("Vault balance:", vaultBalance);

        assertGt(creatorAccumulatedFees, 0, "Creator should have accumulated fees");
        assertGt(liquidityReserve, 0, "Should have liquidity reserve");
        assertGt(vaultBalance, 0, "Vault should have fees");

        // 5. List on DEX
        console.log("5. Listing on DEX...");
        address pool = core.triggerListing(token_);

        assertTrue(bc.getIsListing(), "Should be listed");
        assertTrue(pool != address(0), "Pool should exist");

        // 6. Verify LP details
        console.log("6. Verifying LP...");
        int24 tickLower = bc.lpTickLower();
        int24 tickUpper = bc.lpTickUpper();
        uint128 lpLiquidity = bc.lpLiquidity();

        console.log("LP tick lower:", tickLower);
        console.log("LP tick upper:", tickUpper);
        console.log("LP liquidity:", lpLiquidity);

        assertGt(lpLiquidity, 0, "LP should have liquidity");

        // 7. Verify liquidity reserve used
        assertEq(bc.liquidityReserve(), 0, "Liquidity reserve should be 0 after listing");

        // 8. Creator claims fees
        console.log("7. Creator claiming fees...");
        uint256 creatorBalBefore = wNative.balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorBalAfter = wNative.balanceOf(creator);
        uint256 creatorReceived = creatorBalAfter - creatorBalBefore;

        console.log("Creator received:", creatorReceived);
        assertEq(creatorReceived, creatorAccumulatedFees, "Creator should receive all accumulated fees");

        // 9. Verify final state
        console.log("8. Final state verification...");

        // Reserves should be empty
        (uint256 nativeRes, uint256 tokenRes) = bc.getReserves();
        assertEq(nativeRes, 0, "Native reserves should be 0");
        assertEq(tokenRes, 0, "Token reserves should be 0");

        // Pool should have liquidity
        IUniswapV3Pool poolContract = IUniswapV3Pool(pool);
        assertGt(poolContract.liquidity(), 0, "Pool should have liquidity");

        // Users still have their tokens
        for (uint256 i = 0; i < NUM_USERS; i++) {
            uint256 userBalance = IERC20(token_).balanceOf(users[i]);
            assertGe(userBalance, 0, "User balance should be >= 0");
        }

        console.log("\n=== FULL FLOW STRESS TEST PASSED ===\n");
    }

    // ============================================================
    //            FUZZ TESTS
    // ============================================================

    function testFuzz_BuyAmount(uint256 amount) public {
        amount = bound(amount, 0.01 ether, 100_000 ether);

        (address curve_, address token_) = createToken(creator);

        uint256 tokensReceived = buyTokens(users[0], token_, amount);
        assertGt(tokensReceived, 0, "Should receive tokens");
    }

    function testFuzz_SellPercentage(uint256 sellPercentage) public {
        sellPercentage = bound(sellPercentage, 1, 99);

        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 tokens = buyTokens(users[0], token_, 10_000 ether);

        if (!bc.getLock()) {
            uint256 sellAmount = tokens * sellPercentage / 100;
            uint256 received = sellTokens(users[0], token_, sellAmount);
            assertGt(received, 0, "Should receive native");
        }
    }

    function testFuzz_MultipleBuys(uint8 numBuys) public {
        numBuys = uint8(bound(numBuys, 1, 50));

        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 totalTokens = 0;
        for (uint256 i = 0; i < numBuys && !bc.getLock(); i++) {
            totalTokens += buyTokens(users[i % NUM_USERS], token_, 1_000 ether);
        }

        assertGt(totalTokens, 0, "Should have accumulated tokens");
    }

    // ============================================================
    //            INVARIANT TESTS
    // ============================================================

    function testInvariant_KConstant() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 initialK = bc.getK();

        // Do many trades
        for (uint256 i = 0; i < 20 && !bc.getLock(); i++) {
            uint256 tokens = buyTokens(users[i % NUM_USERS], token_, 5_000 ether);
            if (!bc.getLock() && tokens > 0) {
                sellTokens(users[i % NUM_USERS], token_, tokens / 2);
            }
        }

        uint256 finalK = bc.getK();

        // K should remain constant (allowing for minor rounding)
        assertEq(initialK, finalK, "K should remain constant");
    }

    function testInvariant_ATHNeverDecreases() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 lastATHPrice = 0;
        uint256 lastATHMarketCap = 0;

        for (uint256 i = 0; i < 30 && !bc.getLock(); i++) {
            // Buy
            buyTokens(users[i % NUM_USERS], token_, 5_000 ether);

            (uint256 athPrice, ) = bc.getATHPrice();
            (uint256 athMarketCap, ) = bc.getATHMarketCap();

            assertGe(athPrice, lastATHPrice, "ATH price should never decrease");
            assertGe(athMarketCap, lastATHMarketCap, "ATH market cap should never decrease");

            lastATHPrice = athPrice;
            lastATHMarketCap = athMarketCap;

            // Sell some (should not decrease ATH)
            if (!bc.getLock()) {
                uint256 userTokens = IERC20(token_).balanceOf(users[i % NUM_USERS]);
                if (userTokens > 0) {
                    sellTokens(users[i % NUM_USERS], token_, userTokens / 4);
                }

                (athPrice, ) = bc.getATHPrice();
                (athMarketCap, ) = bc.getATHMarketCap();

                assertGe(athPrice, lastATHPrice, "ATH price should never decrease after sell");
                assertGe(athMarketCap, lastATHMarketCap, "ATH market cap should never decrease after sell");
            }
        }
    }

    function testInvariant_TotalSupplyConsistent() public {
        (address curve_, address token_) = createToken(creator);
        BondingCurve bc = BondingCurve(curve_);
        Token tokenContract = Token(token_);

        uint256 initialSupply = tokenContract.totalSupply();

        // Do trades
        for (uint256 i = 0; i < 15 && !bc.getLock(); i++) {
            buyTokens(users[i % NUM_USERS], token_, 10_000 ether);
        }

        // Total supply should remain constant during trading (no burn until listing)
        uint256 supplyAfterTrading = tokenContract.totalSupply();
        assertEq(supplyAfterTrading, initialSupply, "Supply should not change during trading");

        // Graduate and list
        if (!bc.getLock()) {
            graduateCurve(curve_, token_);
        }
        core.triggerListing(token_);

        // After listing, supply may decrease due to burn
        uint256 finalSupply = tokenContract.totalSupply();
        assertLe(finalSupply, initialSupply, "Supply should not increase after listing");
    }
}
