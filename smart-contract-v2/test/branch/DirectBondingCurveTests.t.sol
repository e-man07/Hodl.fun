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
import "../../src/UniswapV3Factory.sol";
import "../../src/interfaces/IBondingCurve.sol";
import "../../src/interfaces/IBondingCurveFactory.sol";

/**
 * @title DirectBondingCurveTests
 * @notice Tests that directly call BondingCurve functions to cover edge case branches
 * @dev These tests bypass Core to directly test BondingCurve validation branches
 */
contract DirectBondingCurveTests is Test {
    WPUSH wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);

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

    // ============ Direct BondingCurve.buy() Tests ============
    // These tests call buy() directly with CORE_ROLE

    function testDirectBuy_ZeroAmountOut() public {
        (address curve_, ) = createTestToken();

        // Give user WETH and send to curve
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.transfer(curve_, 1 ether);
        vm.stopPrank();

        // Call buy directly from core address
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountOut.selector);
        BondingCurve(curve_).buy(user1, 0);
    }

    function testDirectBuy_InvalidTo_WNative() public {
        (address curve_, ) = createTestToken();

        // Give user WETH and send to curve
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.transfer(curve_, 1 ether);
        vm.stopPrank();

        // Call buy directly from core address with wNative as recipient
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        BondingCurve(curve_).buy(address(wNative), 1000 * 1e18);
    }

    function testDirectBuy_InvalidTo_Token() public {
        (address curve_, address token_) = createTestToken();

        // Give user WETH and send to curve
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.transfer(curve_, 1 ether);
        vm.stopPrank();

        // Call buy directly from core address with token as recipient
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        BondingCurve(curve_).buy(token_, 1000 * 1e18);
    }

    function testDirectBuy_ZeroAmountNativeIn() public {
        (address curve_, ) = createTestToken();

        // Don't send any WETH to the curve - this tests amountNativeIn == 0
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountIn.selector);
        BondingCurve(curve_).buy(user1, 1000 * 1e18);
    }

    function testDirectBuy_MismatchedAmountOut() public {
        (address curve_, ) = createTestToken();

        // Send WETH to curve
        vm.startPrank(user1);
        wNative.deposit{value: 0.1 ether}();
        wNative.transfer(curve_, 0.1 ether);
        vm.stopPrank();

        // Call buy with wrong amountOut (should not match calculated amount)
        // The correct amountOut for 0.1 ether input should be calculated
        // But we pass a wrong value to trigger InvalidAmountOut
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountOut.selector);
        BondingCurve(curve_).buy(user1, 999999999 * 1e18); // Way more than possible
    }

    function testDirectBuy_OnlyCore() public {
        (address curve_, ) = createTestToken();

        // Try to call buy from non-core address
        vm.prank(user1);
        vm.expectRevert();
        BondingCurve(curve_).buy(user1, 1000 * 1e18);
    }

    // ============ Direct BondingCurve.sell() Tests ============

    function testDirectSell_ZeroAmountOut() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Transfer tokens to curve
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).transfer(curve_, balance / 2);
        vm.stopPrank();

        // Call sell directly from core with 0 amountOut
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountOut.selector);
        BondingCurve(curve_).sell(user1, 0);
    }

    function testDirectSell_InvalidTo_WNative() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Transfer tokens to curve
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).transfer(curve_, balance / 2);
        vm.stopPrank();

        // Call sell with wNative as recipient
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        BondingCurve(curve_).sell(address(wNative), 0.01 ether);
    }

    function testDirectSell_InvalidTo_Token() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Transfer tokens to curve
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).transfer(curve_, balance / 2);
        vm.stopPrank();

        // Call sell with token as recipient
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        BondingCurve(curve_).sell(token_, 0.01 ether);
    }

    function testDirectSell_AmountOutExceedsReserves() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Transfer tokens to curve
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).transfer(curve_, balance);
        vm.stopPrank();

        // Try to sell for more WETH than in reserves
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountOut.selector);
        BondingCurve(curve_).sell(user1, 1000 ether); // Way more than available
    }

    function testDirectSell_ZeroTokensIn() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Don't transfer any tokens to curve - tests amountTokenIn == 0
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountIn.selector);
        BondingCurve(curve_).sell(user1, 0.01 ether);
    }

    function testDirectSell_MismatchedAmountOut() public {
        (address curve_, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        // Transfer a small amount of tokens to curve
        uint256 balance = IERC20(token_).balanceOf(user1);
        IERC20(token_).transfer(curve_, balance / 10);
        vm.stopPrank();

        // Try to sell with wrong amountOut (doesn't match formula)
        vm.prank(address(core));
        vm.expectRevert(BondingCurve.InvalidAmountOut.selector);
        BondingCurve(curve_).sell(user1, 100 ether); // Way more than calculated
    }

    function testDirectSell_OnlyCore() public {
        (address curve_, ) = createTestToken();

        // Try to call sell from non-core address
        vm.prank(user1);
        vm.expectRevert();
        BondingCurve(curve_).sell(user1, 0.01 ether);
    }

    // ============ BondingCurve Listing Branch Tests ============

    function testListing_WithZeroListingFee() public {
        // Set listing fee to 0
        vm.prank(admin);
        factory.setListingFee(0);

        (address curve_, address token_) = createTestToken();

        // Buy enough to graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // List should succeed
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));
    }

    function testListing_BurnTokensWhenExcess() public {
        (address curve_, address token_) = createTestToken();

        // Buy to graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Get token supply before listing
        uint256 supplyBefore = IERC20(token_).totalSupply();

        // List - this may burn excess tokens
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));

        // Supply may be different after listing due to burns
        uint256 supplyAfter = IERC20(token_).totalSupply();
        assertTrue(supplyAfter <= supplyBefore);
    }

    // ============ BondingCurve sqrt function test ============

    function testSqrt_EdgeCases() public {
        (address curve_, address token_) = createTestToken();

        // Graduate the curve
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // The sqrt function is used during listing
        // Testing that listing completes successfully tests sqrt
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));
    }

    // ============ _checkTarget Tests ============

    function testCheckTarget_MultipleATHUpdates() public {
        (address curve_, address token_) = createTestToken();

        // Series of buys to trigger multiple ATH updates
        vm.startPrank(user1);
        wNative.deposit{value: 10 ether}();
        wNative.approve(address(core), 10 ether);

        // First buy
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        (uint256 athPrice1, ) = BondingCurve(curve_).getATHPrice();
        (uint256 athMc1, ) = BondingCurve(curve_).getATHMarketCap();

        // Second buy - should update ATH again
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        (uint256 athPrice2, ) = BondingCurve(curve_).getATHPrice();
        (uint256 athMc2, ) = BondingCurve(curve_).getATHMarketCap();

        assertTrue(athPrice2 > athPrice1);
        assertTrue(athMc2 > athMc1);
        vm.stopPrank();
    }

    // ============ Different Fee Tier Tests for _getTickSpacing ============

    function testGetTickSpacing_500Fee() public {
        vm.prank(admin);
        factory.setDexFee(500);

        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Listing uses 500 fee tier
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));
    }

    function testGetTickSpacing_3000Fee() public {
        // Default is 3000
        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Listing uses 3000 fee tier
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));
    }

    function testGetTickSpacing_10000Fee() public {
        vm.prank(admin);
        factory.setDexFee(10000);

        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Listing uses 10000 fee tier
        address pool = BondingCurve(curve_).listing();
        assertTrue(pool != address(0));
    }

    // ============ uniswapV3MintCallback Additional Tests ============

    function testMintCallback_WithZeroToken0() public {
        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Try to call callback with invalid data (address(0) for token)
        vm.expectRevert(BondingCurve.InvalidAddress.selector);
        BondingCurve(curve_).uniswapV3MintCallback(
            1 ether,
            1 ether,
            abi.encode(address(0), token_)
        );
    }

    function testMintCallback_WithInvalidDexFactory() public {
        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Call from a fake pool (wrong caller)
        vm.prank(address(0x9999));
        vm.expectRevert(BondingCurve.InvalidAddress.selector);
        BondingCurve(curve_).uniswapV3MintCallback(
            1 ether,
            1 ether,
            abi.encode(address(wNative), token_)
        );
    }

    // ============ View Functions Edge Case Tests ============

    function testGetCurrentPrice_AfterGraduation() public {
        (address curve_, address token_) = createTestToken();

        // Graduate
        vm.startPrank(user1);
        wNative.deposit{value: 100 ether}();
        wNative.approve(address(core), 100 ether);

        while (!BondingCurve(curve_).getLock()) {
            core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        }
        vm.stopPrank();

        // Price should still be readable after lock
        uint256 price = BondingCurve(curve_).getCurrentPrice();
        assertTrue(price > 0);
    }

    function testCalculateMarketCap_AtVariousStages() public {
        (address curve_, address token_) = createTestToken();

        // Initial market cap
        uint256 initialMc = BondingCurve(curve_).calculateMarketCap();
        assertTrue(initialMc > 0);

        // Buy and check market cap increases
        vm.startPrank(user1);
        wNative.deposit{value: 5 ether}();
        wNative.approve(address(core), 5 ether);
        core.exactInBuy(5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 mcAfterBuy = BondingCurve(curve_).calculateMarketCap();
        assertTrue(mcAfterBuy > initialMc);
    }
}
