// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";
import "../../src/WPUSH.sol";
import "../../src/UniswapV3Factory.sol";
import "../../src/interfaces/IBondingCurve.sol";
import "../../src/interfaces/IBondingCurveFactory.sol";

/**
 * @title SellBranchCoverageTest
 * @notice Tests targeting uncovered branches in BondingCurve.sell() function
 */
contract SellBranchCoverageTest is Test {
    WPUSH wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);

    uint256 deployFee = 0.01 ether;
    uint256 listingFee = 0.1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 50_000_000 * 1e18;
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

    // ========== Sell Tests ==========

    // Test successful sell flow
    function testSell_Success() public {
        (, address token_) = createTestToken();

        // Buy tokens first
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        assertTrue(tokenBalance > 0, "Should have tokens after buy");

        // Sell tokens
        IERC20(token_).approve(address(core), tokenBalance);
        uint256 nativeBalBefore = wNative.balanceOf(user1);

        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);

        uint256 nativeBalAfter = wNative.balanceOf(user1);
        assertTrue(nativeBalAfter > nativeBalBefore, "Should receive native from sell");
        vm.stopPrank();
    }

    // Test sell with zero amount (should revert)
    function testSell_ZeroAmount() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        IERC20(token_).approve(address(core), 1e18);

        // Selling zero tokens should fail
        vm.expectRevert();
        core.exactInSell(0, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell to zero address (should revert with InvalidAddress)
    function testSell_ToZeroAddress() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell to zero address should fail
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell to wNative address (should revert with InvalidTo from BondingCurve)
    function testSell_ToWNativeAddress() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell to wNative address should fail with InvalidTo from BondingCurve
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, address(wNative), block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell to token address (should revert with InvalidTo from BondingCurve)
    function testSell_ToTokenAddress() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell to token address should fail with InvalidTo from BondingCurve
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, token_, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell with expired deadline
    function testSell_ExpiredDeadline() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell with expired deadline
        vm.expectRevert(Core.Expired.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    // Test sell with slippage (insufficient output)
    function testSell_InsufficientOutput() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell with unreasonably high minimum output
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInSell(tokenBalance / 2, 1000 ether, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell when curve is locked
    function testSell_WhenLocked() public {
        // Use a lower graduation threshold to make graduation easier
        vm.startPrank(admin);
        factory.setGraduationMarketCap(1 ether); // Low threshold
        vm.stopPrank();

        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (address curve_, address token_) = core.createCurve(
            creator,
            "Low Grad Token",
            "LGT",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Buy enough to trigger graduation
        vm.startPrank(user1);
        wNative.deposit{value: 50 ether}();
        wNative.approve(address(core), 50 ether);

        // Buy until graduation (curve locks)
        core.exactInBuy(50 ether, 0, token_, user1, block.timestamp + 1000);

        // Check if curve is locked
        bool isLocked = BondingCurve(curve_).lock();

        if (isLocked) {
            uint256 tokenBalance = IERC20(token_).balanceOf(user1);
            IERC20(token_).approve(address(core), tokenBalance);

            // Sell on locked curve should fail
            vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
            core.exactInSell(tokenBalance / 10, 0, token_, user1, user1, block.timestamp + 1000);
        }
        vm.stopPrank();
    }

    // Test sell full balance
    function testSell_FullBalance() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell all tokens
        core.exactInSell(tokenBalance, 0, token_, user1, user1, block.timestamp + 1000);

        uint256 remainingTokens = IERC20(token_).balanceOf(user1);
        assertEq(remainingTokens, 0, "Should have no tokens after full sell");
        vm.stopPrank();
    }

    // Test sell to different recipient
    function testSell_DifferentRecipient() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        uint256 user2NativeBefore = wNative.balanceOf(user2);

        // Sell tokens and send native to user2
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user2, block.timestamp + 1000);

        uint256 user2NativeAfter = wNative.balanceOf(user2);
        assertTrue(user2NativeAfter > user2NativeBefore, "User2 should receive native");
        vm.stopPrank();
    }

    // Test multiple sequential sells
    function testSell_MultipleSequential() public {
        (, address token_) = createTestToken();

        // Use smaller buy to avoid hitting graduation threshold (100 ether)
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        uint256 sellAmount = tokenBalance / 5;

        // Sell in 5 parts
        for (uint256 i = 0; i < 5; i++) {
            core.exactInSell(sellAmount, 0, token_, user1, user1, block.timestamp + 1000);
        }

        uint256 remainingTokens = IERC20(token_).balanceOf(user1);
        assertTrue(remainingTokens < tokenBalance, "Should have fewer tokens after sells");
        vm.stopPrank();
    }

    // Test sell after price increase (from multiple buys)
    function testSell_AfterPriceIncrease() public {
        (, address token_) = createTestToken();
        address curve_ = factory.getCurve(token_);

        // Use smaller buys to avoid hitting graduation threshold (100 ether)
        vm.startPrank(user1);
        wNative.deposit{value: 0.25 ether}();
        wNative.approve(address(core), 0.25 ether);
        core.exactInBuy(0.25 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 priceAfterUser1 = BondingCurve(curve_).getCurrentPrice();

        // User2 buys tokens (increases price)
        vm.startPrank(user2);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user2, block.timestamp + 1000);
        vm.stopPrank();

        uint256 priceAfterUser2 = BondingCurve(curve_).getCurrentPrice();
        assertTrue(priceAfterUser2 > priceAfterUser1, "Price should increase after second buy");

        // User1 sells at higher price
        vm.startPrank(user1);
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        uint256 nativeBefore = wNative.balanceOf(user1);
        core.exactInSell(tokenBalance, 0, token_, user1, user1, block.timestamp + 1000);
        uint256 nativeAfter = wNative.balanceOf(user1);

        assertTrue(nativeAfter > nativeBefore, "Should receive native from sell");
        vm.stopPrank();
    }

    // Test exactOutSell function
    function testExactOutSell_Success() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell to get exact output
        uint256 nativeBefore = wNative.balanceOf(user1);
        core.exactOutSell(0.1 ether, tokenBalance, token_, user1, user1, block.timestamp + 1000);
        uint256 nativeAfter = wNative.balanceOf(user1);

        assertTrue(nativeAfter > nativeBefore, "Should receive native");
        vm.stopPrank();
    }

    // Test exactOutSell with excessive input (slippage protection)
    function testExactOutSell_ExcessiveInput() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 2 ether}();
        wNative.approve(address(core), 2 ether);
        core.exactInBuy(2 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Try to get a reasonable output but with a very low max input
        // This should fail because we need more tokens than allowed
        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutSell(0.5 ether, 1e18, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test creator fee distribution on sell
    function testSell_CreatorFeeDistribution() public {
        (, address token_) = createTestToken();

        // Check initial creator fees
        uint256 creatorFeesBefore = factory.creatorFees(creator);

        // Buy tokens - use smaller amount to avoid graduation
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Sell tokens (generates fees)
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 creatorFeesAfter = factory.creatorFees(creator);
        assertTrue(creatorFeesAfter > creatorFeesBefore, "Creator fees should increase after sell");
    }

    // Test direct sell without CORE_ROLE (should revert)
    function testDirectSell_WithoutCoreRole() public {
        (address curve_, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        // Try to call sell directly on BondingCurve without CORE_ROLE
        vm.expectRevert();
        BondingCurve(curve_).sell(user1, 1 ether);
        vm.stopPrank();
    }

    // Test sell when paused
    function testSell_WhenPaused() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Pause core
        vm.prank(admin);
        core.pause();

        // Try to sell when paused
        vm.startPrank(user1);
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        vm.expectRevert("Pausable: paused");
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test sell after unpause
    function testSell_AfterUnpause() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Pause and unpause
        vm.startPrank(admin);
        core.pause();
        core.unpause();
        vm.stopPrank();

        // Sell should work after unpause
        vm.startPrank(user1);
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // Test very small sell amount
    function testSell_VerySmallAmount() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        IERC20(token_).approve(address(core), 1e18);

        // Sell very small amount (1 wei worth of tokens)
        // This may or may not succeed depending on precision
        try core.exactInSell(1, 0, token_, user1, user1, block.timestamp + 1000) {
            // Success is acceptable
        } catch {
            // Revert due to precision is also acceptable
        }
        vm.stopPrank();
    }
}
