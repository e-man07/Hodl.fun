// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/interfaces/ICore.sol";
import "../src/interfaces/IBondingCurveFactory.sol";
import "../src/interfaces/IBondingCurve.sol";
import "../src/interfaces/IWNative.sol";
import "../src/interfaces/IToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title E2EForkTest
 * @notice End-to-end fork test for deployed Hodl.fun contracts on Push Chain Testnet
 * @dev Run with: forge test --match-contract E2EForkTest --fork-url https://evm.rpc-testnet-donut-node1.push.org/ -vvvv
 *
 * Requirements:
 * - Set TEST_PRIVATE_KEY environment variable with a wallet that has ~20 PUSH
 * - Push Chain Testnet (Chain ID: 42101)
 */
contract E2EForkTest is Test {
    // ============ Deployed Contract Addresses ============
    address public constant CORE = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address public constant FACTORY = 0x3c2e258D3CF31653a17b27d5C4f1789D25d14EA8;
    address public constant FEE_VAULT = 0xbE2fd9b720d1d7Fac7208523376d2A3332019928;
    address public constant WPUSH = 0x2137c11bdb56C8A74be8Cc0fBad23CCF5CB9a8a7;
    address public constant V3_FACTORY = 0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7;

    // ============ Test State ============
    ICore public core;
    IBondingCurveFactory public factory;
    IWNative public wPush;

    address public testWallet;
    uint256 public testPrivateKey;
    address public token1;
    address public curve1;
    address public token2;
    address public curve2;

    // ============ Test Configuration ============
    uint256 public constant MIN_BALANCE = 20 ether;
    uint256 public constant WRAP_AMOUNT = 10 ether;
    uint256 public constant BUY_AMOUNT = 1 ether;
    uint256 public constant INITIAL_BUY_AMOUNT = 0.5 ether;

    function setUp() public {
        // Get private key from environment
        testPrivateKey = vm.envUint("TEST_PRIVATE_KEY");
        testWallet = vm.addr(testPrivateKey);

        // Initialize contract interfaces
        core = ICore(CORE);
        factory = IBondingCurveFactory(FACTORY);
        wPush = IWNative(WPUSH);

        console.log("================================================================");
        console.log("     HODL.FUN E2E FORK TEST - Push Chain Testnet");
        console.log("================================================================");
        console.log("Test Wallet:", testWallet);
        console.log("Balance:", testWallet.balance / 1e18, "PUSH");
        console.log("================================================================");
    }

    // ============================================================================
    // Phase 1: Prerequisites & WPUSH Operations
    // ============================================================================

    function test_Phase1_WPUSHOperations() public {
        console.log("\n--- Phase 1: WPUSH Operations ---");

        // 1.1 Check native balance
        uint256 balance = testWallet.balance;
        console.log("[1.1] Native balance:", balance / 1e18, "PUSH");
        assertGe(balance, MIN_BALANCE, "Insufficient native balance");

        // 1.2 Wrap PUSH -> WPUSH
        vm.startPrank(testWallet);
        uint256 preWpush = wPush.balanceOf(testWallet);
        wPush.deposit{value: WRAP_AMOUNT}();
        uint256 postWpush = wPush.balanceOf(testWallet);
        console.log("[1.2] Wrapped", WRAP_AMOUNT / 1e18, "PUSH -> WPUSH");
        assertEq(postWpush - preWpush, WRAP_AMOUNT, "WPUSH amount mismatch");

        // 1.3 Verify WPUSH balance
        console.log("[1.3] WPUSH balance:", postWpush / 1e18);
        assertGe(postWpush, WRAP_AMOUNT, "WPUSH balance too low");

        // 1.4 Unwrap partial WPUSH
        uint256 unwrapAmount = 1 ether;
        uint256 preNative = testWallet.balance;
        wPush.withdraw(unwrapAmount);
        uint256 postNative = testWallet.balance;
        console.log("[1.4] Unwrapped", unwrapAmount / 1e18, "WPUSH");
        // Note: postNative should be close to preNative + unwrapAmount (minus gas in real tx)
        assertEq(wPush.balanceOf(testWallet), postWpush - unwrapAmount, "WPUSH not deducted");
        vm.stopPrank();

        console.log("[PASS] Phase 1 complete");
    }

    // ============================================================================
    // Phase 2: Factory Configuration Verification
    // ============================================================================

    function test_Phase2_FactoryConfig() public view {
        console.log("\n--- Phase 2: Factory Configuration ---");

        // 2.1 Get factory config
        IBondingCurveFactory.Config memory config = factory.getConfig();
        console.log("[2.1] Deploy Fee:", config.deployFee / 1e18, "PUSH");
        console.log("      Listing Fee:", config.listingFee / 1e18, "PUSH");
        console.log("      Virtual Native:", config.virtualNative / 1e18, "PUSH");
        console.log("      Virtual Token:", config.virtualToken / 1e18);
        console.log("      Graduation Cap:", config.graduationMarketCap / 1e18, "PUSH");
        console.log("      Fee:", config.feeNumerator, "/", config.feeDenominator);

        assertGt(config.deployFee, 0, "Deploy fee should be > 0");
        assertGt(config.virtualNative, 0, "Virtual native should be > 0");
        assertGt(config.virtualToken, 0, "Virtual token should be > 0");

        // 2.2-2.5 Verify individual getters
        uint256 deployFee = factory.getDeployFee();
        uint256 listingFee = factory.getListingFee();
        console.log("[2.2] getDeployFee():", deployFee / 1e18, "PUSH");
        console.log("[2.3] getListingFee():", listingFee / 1e18, "PUSH");
        assertEq(deployFee, config.deployFee, "Deploy fee mismatch");
        assertEq(listingFee, config.listingFee, "Listing fee mismatch");

        // 2.4 Verify K = virtualNative * virtualToken
        uint256 expectedK = config.virtualNative * config.virtualToken;
        console.log("[2.4] K verification:", config.k == expectedK ? "PASS" : "FAIL");
        assertEq(config.k, expectedK, "K mismatch");

        // 2.6 Core reference
        address coreAddr = factory.getCore();
        console.log("[2.6] Core address:", coreAddr);
        assertEq(coreAddr, CORE, "Core address mismatch");

        // 2.7 DEX Factory
        address dexFactory = factory.getDexFactory();
        console.log("[2.7] DEX Factory:", dexFactory);
        assertEq(dexFactory, V3_FACTORY, "DEX Factory mismatch");

        console.log("[PASS] Phase 2 complete");
    }

    // ============================================================================
    // Phase 3 & 4: Token Creation and Curve State
    // ============================================================================

    function test_Phase3_4_TokenCreation() public {
        console.log("\n--- Phase 3: Token Creation ---");

        uint256 deployFee = factory.getDeployFee();
        console.log("Deploy fee:", deployFee / 1e18, "PUSH");

        vm.startPrank(testWallet);

        // Wrap enough PUSH
        wPush.deposit{value: deployFee + 5 ether}();

        // Approve WPUSH for Core
        wPush.approve(CORE, deployFee);
        console.log("[3.1] Approved WPUSH for Core");

        // Create token
        string memory name = "E2E Fork Test Token";
        string memory symbol = "E2EFORK";
        string memory tokenURI = "ipfs://QmE2EForkTest";

        (address curveAddr, address tokenAddr) = core.createCurve(
            testWallet,
            name,
            symbol,
            tokenURI,
            0,
            deployFee
        );

        token1 = tokenAddr;
        curve1 = curveAddr;

        console.log("[3.2-3.4] Token created!");
        console.log("          Token:", token1);
        console.log("          Curve:", curve1);

        // Verify token properties
        IERC20Metadata tokenMeta = IERC20Metadata(token1);
        IToken token = IToken(token1);

        assertEq(tokenMeta.name(), name, "Name mismatch");
        assertEq(tokenMeta.symbol(), symbol, "Symbol mismatch");
        assertEq(token.tokenURI(), tokenURI, "TokenURI mismatch");
        assertEq(tokenMeta.totalSupply(), 1e27, "Total supply should be 1B");

        console.log("[3.5] Name:", tokenMeta.name());
        console.log("[3.6] Symbol:", tokenMeta.symbol());
        console.log("[3.7] TokenURI:", token.tokenURI());
        console.log("[3.8] Total Supply:", tokenMeta.totalSupply() / 1e18);

        // Verify factory mappings
        assertEq(factory.getCurve(token1), curve1, "Curve mapping mismatch");
        assertEq(factory.getCreator(token1), testWallet, "Creator mapping mismatch");
        console.log("[3.9-3.10] Factory mappings verified");

        // Phase 4: Verify curve state
        console.log("\n--- Phase 4: Curve State Verification ---");
        IBondingCurve curve = IBondingCurve(curve1);

        (uint256 virtualNative, uint256 virtualToken) = curve.getVirtualReserves();
        console.log("[4.1] Virtual Native:", virtualNative / 1e18, "PUSH");
        console.log("      Virtual Token:", virtualToken / 1e18);

        (uint256 realNative, uint256 realToken) = curve.getReserves();
        console.log("[4.2] Real Native:", realNative / 1e18, "PUSH");
        console.log("      Real Token:", realToken / 1e18);

        uint256 k = curve.getK();
        console.log("[4.3] K:", k);
        assertGt(k, 0, "K should be > 0");

        uint256 price = curve.getCurrentPrice();
        console.log("[4.4] Price:", price, "wei/token");
        assertGt(price, 0, "Price should be > 0");

        uint256 marketCap = curve.calculateMarketCap();
        console.log("[4.5] Market Cap:", marketCap / 1e18, "PUSH");

        assertFalse(curve.getLock(), "Curve should not be locked");
        assertFalse(curve.getIsListing(), "Curve should not be listing");
        console.log("[4.6-4.7] Lock/Listing status: OK");

        (uint256 athPrice, ) = curve.getATHPrice();
        console.log("[4.8] ATH Price:", athPrice);

        (uint8 feeDenom, uint16 feeNum) = curve.getFeeConfig();
        console.log("[4.9] Fee Config:", feeNum, "/", feeDenom);

        vm.stopPrank();
        console.log("[PASS] Phase 3 & 4 complete");
    }

    // ============================================================================
    // Phase 5: Buy Operations
    // ============================================================================

    function test_Phase5_BuyOperations() public {
        // First create a token
        _createTestToken();

        console.log("\n--- Phase 5: Buy Operations ---");

        IBondingCurve curve = IBondingCurve(curve1);
        IToken token = IToken(token1);
        IERC20 tokenErc20 = IERC20(token1);

        vm.startPrank(testWallet);

        // Get pre-buy state
        uint256 preBuyPrice = curve.getCurrentPrice();
        uint256 preBuyBalance = tokenErc20.balanceOf(testWallet);
        console.log("Pre-buy price:", preBuyPrice);
        console.log("Pre-buy token balance:", preBuyBalance / 1e18);

        // Approve and buy
        wPush.approve(CORE, BUY_AMOUNT * 3);
        console.log("[5.1] Approved WPUSH");

        // 5.3 exactInBuy
        uint256 deadline = block.timestamp + 3600;
        console.log("[5.3] Executing exactInBuy with", BUY_AMOUNT / 1e18, "PUSH");
        core.exactInBuy(BUY_AMOUNT, 0, token1, testWallet, deadline);

        uint256 postBuyBalance = tokenErc20.balanceOf(testWallet);
        uint256 tokensReceived = postBuyBalance - preBuyBalance;
        console.log("[5.4] Tokens received:", tokensReceived / 1e18);
        assertGt(tokensReceived, 0, "Should receive tokens");

        uint256 postBuyPrice = curve.getCurrentPrice();
        console.log("[5.5] Post-buy price:", postBuyPrice);
        assertGt(postBuyPrice, preBuyPrice, "Price should increase after buy");

        (uint256 realNative, uint256 realToken) = curve.getReserves();
        console.log("[5.6] Real reserves - Native:", realNative / 1e18, "Token:", realToken / 1e18);
        assertGt(realNative, 0, "Real native should be > 0 after buy");

        // 5.8 exactOutBuy
        uint256 targetTokens = 1000 * 1e18;
        uint256 preExactOutBalance = tokenErc20.balanceOf(testWallet);

        (uint256 vNative, uint256 vToken) = curve.getVirtualReserves();
        uint256 kVal = curve.getK();
        uint256 newVirtualToken = vToken - targetTokens;
        uint256 newVirtualNative = kVal / newVirtualToken;
        uint256 amountInNeeded = newVirtualNative - vNative;
        uint256 amountInWithBuffer = amountInNeeded * 110 / 100;

        wPush.approve(CORE, amountInWithBuffer);
        console.log("[5.8] Executing exactOutBuy for", targetTokens / 1e18, "tokens");
        core.exactOutBuy(targetTokens, amountInWithBuffer, token1, testWallet, deadline);

        uint256 postExactOutBalance = tokenErc20.balanceOf(testWallet);
        uint256 exactOutReceived = postExactOutBalance - preExactOutBalance;
        console.log("[5.9] Exact out received:", exactOutReceived / 1e18, "tokens");
        assertEq(exactOutReceived, targetTokens, "Should receive exact tokens");

        vm.stopPrank();
        console.log("[PASS] Phase 5 complete");
    }

    // ============================================================================
    // Phase 6: Sell Operations
    // ============================================================================

    function test_Phase6_SellOperations() public {
        _createTestToken();
        _buyTokens();

        console.log("\n--- Phase 6: Sell Operations ---");

        IBondingCurve curve = IBondingCurve(curve1);
        IERC20 tokenErc20 = IERC20(token1);

        vm.startPrank(testWallet);

        uint256 preSellPrice = curve.getCurrentPrice();
        uint256 preSellTokenBalance = tokenErc20.balanceOf(testWallet);
        uint256 preSellWpushBalance = wPush.balanceOf(testWallet);

        console.log("Pre-sell price:", preSellPrice);
        console.log("Pre-sell token balance:", preSellTokenBalance / 1e18);

        uint256 sellAmount = preSellTokenBalance / 2;
        uint256 deadline = block.timestamp + 3600;

        // 6.1 Approve tokens
        tokenErc20.approve(CORE, sellAmount);
        console.log("[6.1] Approved", sellAmount / 1e18, "tokens");

        // 6.4 exactInSell
        console.log("[6.4] Executing exactInSell");
        core.exactInSell(sellAmount, 0, token1, testWallet, testWallet, deadline);

        uint256 postSellWpushBalance = wPush.balanceOf(testWallet);
        uint256 wpushReceived = postSellWpushBalance - preSellWpushBalance;
        console.log("[6.5] WPUSH received:", wpushReceived / 1e18);
        assertGt(wpushReceived, 0, "Should receive WPUSH");

        uint256 postSellTokenBalance = tokenErc20.balanceOf(testWallet);
        uint256 tokensDeducted = preSellTokenBalance - postSellTokenBalance;
        console.log("[6.6] Tokens deducted:", tokensDeducted / 1e18);
        assertEq(tokensDeducted, sellAmount, "Token deduction mismatch");

        uint256 postSellPrice = curve.getCurrentPrice();
        console.log("[6.7] Post-sell price:", postSellPrice);
        assertLt(postSellPrice, preSellPrice, "Price should decrease after sell");

        // 6.8 exactOutSell
        uint256 targetWpush = 0.1 ether;
        uint256 currentBalance = tokenErc20.balanceOf(testWallet);
        uint256 maxTokensToSell = currentBalance / 2;

        tokenErc20.approve(CORE, maxTokensToSell);
        uint256 preExactOutWpush = wPush.balanceOf(testWallet);

        console.log("[6.8] Executing exactOutSell for", targetWpush / 1e18, "WPUSH");
        core.exactOutSell(targetWpush, maxTokensToSell, token1, testWallet, testWallet, deadline);

        uint256 postExactOutWpush = wPush.balanceOf(testWallet);
        uint256 exactOutReceived = postExactOutWpush - preExactOutWpush;
        console.log("     Exact WPUSH received:", exactOutReceived / 1e18);
        assertEq(exactOutReceived, targetWpush, "Should receive exact WPUSH");

        vm.stopPrank();
        console.log("[PASS] Phase 6 complete");
    }

    // ============================================================================
    // Phase 7: Fee Verification
    // ============================================================================

    function test_Phase7_FeeVerification() public {
        _createTestToken();
        _buyTokens();

        console.log("\n--- Phase 7: Fee Verification ---");

        uint256 vaultBalance = wPush.balanceOf(FEE_VAULT);
        console.log("[7.1] FeeVault WPUSH balance:", vaultBalance / 1e18);

        // Note: Vault balance may be 0 if fees go elsewhere
        console.log("[PASS] Phase 7 complete (vault checked)");
    }

    // ============================================================================
    // Phase 8: Slippage & Deadline Protection
    // ============================================================================

    function test_Phase8_SlippageProtection() public {
        _createTestToken();

        console.log("\n--- Phase 8: Slippage & Deadline Protection ---");

        uint256 deadline = block.timestamp + 3600;
        IERC20 tokenErc20 = IERC20(token1);

        vm.startPrank(testWallet);

        // 8.1 Buy with high slippage should revert
        wPush.approve(CORE, 0.1 ether);
        console.log("[8.1] Testing buy with excessive slippage...");
        vm.expectRevert();
        core.exactInBuy(0.1 ether, type(uint256).max, token1, testWallet, deadline);
        console.log("      Reverted as expected");

        // Need tokens first for sell tests
        wPush.approve(CORE, 1 ether);
        core.exactInBuy(1 ether, 0, token1, testWallet, deadline);

        // 8.2 Sell with high slippage should revert
        uint256 balance = tokenErc20.balanceOf(testWallet);
        uint256 smallAmount = balance / 10;
        tokenErc20.approve(CORE, smallAmount);
        console.log("[8.2] Testing sell with excessive slippage...");
        vm.expectRevert();
        core.exactInSell(smallAmount, type(uint256).max, token1, testWallet, testWallet, deadline);
        console.log("      Reverted as expected");

        // 8.3 Buy with expired deadline should revert
        wPush.approve(CORE, 0.1 ether);
        console.log("[8.3] Testing buy with expired deadline...");
        vm.expectRevert();
        core.exactInBuy(0.1 ether, 0, token1, testWallet, block.timestamp - 1);
        console.log("      Reverted as expected");

        // 8.4 Sell with expired deadline should revert
        tokenErc20.approve(CORE, smallAmount);
        console.log("[8.4] Testing sell with expired deadline...");
        vm.expectRevert();
        core.exactInSell(smallAmount, 0, token1, testWallet, testWallet, block.timestamp - 1);
        console.log("      Reverted as expected");

        vm.stopPrank();
        console.log("[PASS] Phase 8 complete");
    }

    // ============================================================================
    // Phase 9: Error Cases
    // ============================================================================

    function test_Phase9_ErrorCases() public {
        _createTestToken();

        console.log("\n--- Phase 9: Error Cases ---");

        uint256 deadline = block.timestamp + 3600;
        IERC20 tokenErc20 = IERC20(token1);
        IBondingCurve curve = IBondingCurve(curve1);

        vm.startPrank(testWallet);

        // 9.1 Buy with zero address should revert
        wPush.approve(CORE, 0.1 ether);
        console.log("[9.1] Testing buy with zero address...");
        vm.expectRevert();
        core.exactInBuy(0.1 ether, 0, token1, address(0), deadline);
        console.log("      Reverted as expected");

        // Buy some tokens first
        wPush.approve(CORE, 1 ether);
        core.exactInBuy(1 ether, 0, token1, testWallet, deadline);

        // 9.2 Sell more than balance should revert
        uint256 balance = tokenErc20.balanceOf(testWallet);
        uint256 hugeAmount = balance * 10;
        tokenErc20.approve(CORE, hugeAmount);
        console.log("[9.2] Testing sell more than balance...");
        vm.expectRevert();
        core.exactInSell(hugeAmount, 0, token1, testWallet, testWallet, deadline);
        console.log("      Reverted as expected");

        vm.stopPrank();

        // 9.4 Direct curve buy should revert (not via Core)
        console.log("[9.4] Testing direct curve buy...");
        vm.expectRevert();
        curve.buy(testWallet, 1000e18);
        console.log("      Reverted as expected");

        console.log("[PASS] Phase 9 complete");
    }

    // ============================================================================
    // Phase 10: Token Creation with Initial Buy
    // ============================================================================

    function test_Phase10_TokenWithInitialBuy() public {
        console.log("\n--- Phase 10: Token Creation with Initial Buy ---");

        uint256 deployFee = factory.getDeployFee();
        uint256 totalNeeded = deployFee + INITIAL_BUY_AMOUNT;

        vm.startPrank(testWallet);

        wPush.deposit{value: totalNeeded + 1 ether}();
        wPush.approve(CORE, totalNeeded);
        console.log("[10.1] Approved", totalNeeded / 1e18, "WPUSH");

        (address curveAddr, address tokenAddr) = core.createCurve(
            testWallet,
            "Initial Buy Token",
            "IBT",
            "ipfs://QmInitialBuy",
            INITIAL_BUY_AMOUNT,
            deployFee
        );

        token2 = tokenAddr;
        curve2 = curveAddr;

        console.log("[10.2] Token created with initial buy!");
        console.log("       Token:", token2);
        console.log("       Curve:", curve2);

        IERC20 tokenErc20 = IERC20(token2);
        uint256 creatorBalance = tokenErc20.balanceOf(testWallet);
        console.log("[10.3] Creator balance:", creatorBalance / 1e18, "tokens");
        assertGt(creatorBalance, 0, "Creator should have tokens from initial buy");

        IBondingCurve curve2Contract = IBondingCurve(curve2);
        uint256 price2 = curve2Contract.getCurrentPrice();
        console.log("[10.4] Token2 price:", price2);

        vm.stopPrank();
        console.log("[PASS] Phase 10 complete");
    }

    // ============================================================================
    // Phase 12: View Functions
    // ============================================================================

    function test_Phase12_ViewFunctions() public {
        _createTestToken();
        _buyTokens();

        console.log("\n--- Phase 12: View Functions ---");

        // 12.1 Core.getCurrentPrice
        uint256 corePrice = core.getCurrentPrice(token1);
        console.log("[12.1] Core.getCurrentPrice:", corePrice);
        assertGt(corePrice, 0, "Price should be > 0");

        // 12.2 Core.calculateMarketCap
        uint256 coreMarketCap = core.calculateMarketCap(token1);
        console.log("[12.2] Core.calculateMarketCap:", coreMarketCap / 1e18, "PUSH");
        assertGt(coreMarketCap, 0, "Market cap should be > 0");

        // 12.3 Core.getCurveData
        (uint256 vNative, uint256 vToken, uint256 k) = core.getCurveData(curve1);
        console.log("[12.3] Core.getCurveData:");
        console.log("       virtualNative:", vNative / 1e18);
        console.log("       virtualToken:", vToken / 1e18);
        console.log("       k:", k);
        assertGt(k, 0, "K should be > 0");

        // 12.4 Core.getAmountOut
        uint256 amountOut = core.getAmountOut(1 ether, k, vNative, vToken);
        console.log("[12.4] Core.getAmountOut (1 PUSH):", amountOut / 1e18, "tokens");
        assertGt(amountOut, 0, "Amount out should be > 0");

        // 12.5 Core.getAmountIn
        uint256 targetOut = 1000e18;
        uint256 amountIn = core.getAmountIn(targetOut, k, vNative, vToken);
        console.log("[12.5] Core.getAmountIn (1000 tokens):", amountIn / 1e18, "PUSH");
        assertGt(amountIn, 0, "Amount in should be > 0");

        // 12.6 Core.getFeeVault
        address vault = core.getFeeVault();
        console.log("[12.6] Core.getFeeVault:", vault);
        assertEq(vault, FEE_VAULT, "Vault address mismatch");

        // Additional factory views
        uint16 creatorFeeShare = factory.getCreatorFeeShare();
        console.log("       Factory.getCreatorFeeShare:", creatorFeeShare, "bps");

        uint24 dexFee = factory.getDexFee();
        console.log("       Factory.getDexFee:", dexFee);

        console.log("[PASS] Phase 12 complete");
    }

    // ============================================================================
    // Helper Functions
    // ============================================================================

    function _createTestToken() internal {
        if (token1 != address(0)) return;

        uint256 deployFee = factory.getDeployFee();

        vm.startPrank(testWallet);
        wPush.deposit{value: deployFee + 10 ether}();
        wPush.approve(CORE, deployFee);

        (address curveAddr, address tokenAddr) = core.createCurve(
            testWallet,
            "E2E Helper Token",
            "E2EHELP",
            "ipfs://QmHelper",
            0,
            deployFee
        );

        token1 = tokenAddr;
        curve1 = curveAddr;
        vm.stopPrank();
    }

    function _buyTokens() internal {
        vm.startPrank(testWallet);
        wPush.approve(CORE, BUY_AMOUNT * 2);
        core.exactInBuy(BUY_AMOUNT, 0, token1, testWallet, block.timestamp + 3600);
        vm.stopPrank();
    }
}
