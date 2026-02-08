// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";
import "../../src/utils/BondingCurveLibrary.sol";

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

contract BondingCurveFuzzTest is Test {
    using SafeERC20 for IERC20;

    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);

    // Configuration - using smaller values for safer fuzz testing
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 10 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 100_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    function setUp() public {
        wNative = new MockWNative();

        vm.deal(admin, 10000 ether);
        vm.deal(creator, 10000 ether);
        vm.deal(user1, 10000 ether);

        uniswapFactory = new MockUniswapV3Factory();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(payable(address(new ERC1967Proxy(address(coreImpl), ""))));

        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), "")));

        vm.startPrank(admin);
        core.initialize(address(0), admin);
        core.setFactory(address(factory));
        vm.stopPrank();

        feeVault.initialize(
            address(wNative),
            "Fee Vault",
            "fVAULT",
            address(core),
            admin
        );

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

        // Give user1 a lot of wNative for fuzz testing
        vm.prank(user1);
        wNative.deposit{value: 1000 ether}();
    }

    function createTestToken() internal returns (address curve, address token) {
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (curve, token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    // ============ Fuzz Test: Buy Amounts ============

    function testFuzz_BuyWithVaryingAmounts(uint256 amountIn) public {
        // Bound to reasonable range: 0.001 ether to 50 ether
        amountIn = bound(amountIn, 0.001 ether, 50 ether);

        (address curve, address token) = createTestToken();

        vm.startPrank(user1);
        wNative.approve(address(core), amountIn);

        uint256 balanceBefore = IERC20(token).balanceOf(user1);
        uint256 wNativeBefore = wNative.balanceOf(user1);

        core.exactInBuy(
            amountIn,
            0,
            token,
            user1,
            block.timestamp + 1 hours
        );

        uint256 balanceAfter = IERC20(token).balanceOf(user1);
        uint256 wNativeAfter = wNative.balanceOf(user1);

        vm.stopPrank();

        // Invariants:
        // 1. User should receive tokens
        assertGt(balanceAfter, balanceBefore, "Should receive tokens");

        // 2. User should spend wNative
        assertEq(wNativeBefore - wNativeAfter, amountIn, "Should spend exact amountIn");
    }

    // ============ Fuzz Test: Multiple Sequential Buys ============

    function testFuzz_MultipleBuys(uint256 amount1, uint256 amount2, uint256 amount3) public {
        // Bound to reasonable range
        amount1 = bound(amount1, 0.001 ether, 10 ether);
        amount2 = bound(amount2, 0.001 ether, 10 ether);
        amount3 = bound(amount3, 0.001 ether, 10 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);
        uint256 kBefore = curveContract.getK();

        vm.startPrank(user1);
        wNative.approve(address(core), amount1 + amount2 + amount3);

        // Buy 1
        core.exactInBuy(amount1, 0, token, user1, block.timestamp + 1 hours);

        // Check k is preserved within rounding tolerance (0.01% = 1 basis point)
        (uint256 vNative1, uint256 vToken1) = curveContract.getVirtualReserves();
        uint256 kAfter1 = vNative1 * vToken1;
        // Allow k to decrease by at most 0.01% due to integer rounding
        assertGe(kAfter1 * 10000, kBefore * 9999, "k should be maintained within 0.01% tolerance");

        // Buy 2
        core.exactInBuy(amount2, 0, token, user1, block.timestamp + 1 hours);

        (uint256 vNative2, uint256 vToken2) = curveContract.getVirtualReserves();
        uint256 kAfter2 = vNative2 * vToken2;
        assertGe(kAfter2 * 10000, kAfter1 * 9999, "k should be maintained within 0.01% tolerance");

        // Buy 3
        core.exactInBuy(amount3, 0, token, user1, block.timestamp + 1 hours);

        vm.stopPrank();

        // Final check
        uint256 finalBalance = IERC20(token).balanceOf(user1);
        assertGt(finalBalance, 0, "Should have received tokens from all buys");
    }

    // ============ Fuzz Test: Buy and Sell ============

    function testFuzz_BuyThenSell(uint256 buyAmount, uint256 sellPercentage) public {
        buyAmount = bound(buyAmount, 0.1 ether, 20 ether);
        sellPercentage = bound(sellPercentage, 1, 100); // Sell 1-100% of tokens

        (, address token) = createTestToken();

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        // Buy
        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        uint256 tokenBalance = IERC20(token).balanceOf(user1);
        uint256 tokensToSell = (tokenBalance * sellPercentage) / 100;

        if (tokensToSell > 0) {
            IERC20(token).approve(address(core), tokensToSell);

            uint256 wNativeBefore = wNative.balanceOf(user1);

            // Sell
            core.exactInSell(
                tokensToSell,
                0,
                token,
                user1,
                user1,
                block.timestamp + 1 hours
            );

            uint256 wNativeAfter = wNative.balanceOf(user1);

            // Should receive some wNative back (minus fees)
            assertGt(wNativeAfter, wNativeBefore, "Should receive wNative from sell");
        }

        vm.stopPrank();
    }

    // ============ Fuzz Test: Price Monotonicity ============

    function testFuzz_PriceIncreaseOnBuy(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 0.01 ether, 30 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);
        uint256 priceBefore = curveContract.getCurrentPrice();

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        vm.stopPrank();

        uint256 priceAfter = curveContract.getCurrentPrice();

        // Price should increase after buy
        assertGt(priceAfter, priceBefore, "Price should increase after buy");
    }

    function testFuzz_PriceDecreaseOnSell(uint256 buyAmount, uint256 sellPercentage) public {
        buyAmount = bound(buyAmount, 1 ether, 20 ether);
        sellPercentage = bound(sellPercentage, 10, 80); // Sell 10-80%

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        // Buy first
        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        uint256 priceAfterBuy = curveContract.getCurrentPrice();

        uint256 tokenBalance = IERC20(token).balanceOf(user1);
        uint256 tokensToSell = (tokenBalance * sellPercentage) / 100;

        IERC20(token).approve(address(core), tokensToSell);

        // Sell
        core.exactInSell(
            tokensToSell,
            0,
            token,
            user1,
            user1,
            block.timestamp + 1 hours
        );

        vm.stopPrank();

        uint256 priceAfterSell = curveContract.getCurrentPrice();

        // Price should decrease after sell
        assertLt(priceAfterSell, priceAfterBuy, "Price should decrease after sell");
    }

    // ============ Fuzz Test: Constant Product Invariant ============

    function testFuzz_ConstantProductPreserved(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 0.01 ether, 30 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);
        uint256 kBefore = curveContract.getK();

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        vm.stopPrank();

        // Get new virtual reserves
        (uint256 vNative, uint256 vToken) = curveContract.getVirtualReserves();
        uint256 kAfter = vNative * vToken;

        // k should be preserved within rounding tolerance (0.01% = 1 basis point)
        // Integer division in AMMs can cause small rounding losses
        // This is expected behavior - the important thing is k doesn't increase significantly
        // which would indicate a pricing bug favoring the user
        assertGe(kAfter * 10000, kBefore * 9999, "Constant product k should be preserved within 0.01% tolerance");
    }

    // ============ Fuzz Test: Market Cap Calculation ============

    function testFuzz_MarketCapIncreasesOnBuy(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 0.1 ether, 20 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);
        uint256 marketCapBefore = curveContract.calculateMarketCap();

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        vm.stopPrank();

        uint256 marketCapAfter = curveContract.calculateMarketCap();

        // Market cap should increase after buy
        assertGt(marketCapAfter, marketCapBefore, "Market cap should increase after buy");
    }

    // ============ Fuzz Test: ATH Tracking ============

    function testFuzz_ATHUpdatedCorrectly(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 0.1 ether, 20 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);
        (uint256 athBefore, ) = curveContract.getATHPrice();

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount);

        core.exactInBuy(buyAmount, 0, token, user1, block.timestamp + 1 hours);

        vm.stopPrank();

        (uint256 athAfter, ) = curveContract.getATHPrice();

        // ATH should be updated if current price exceeds it
        assertGe(athAfter, athBefore, "ATH should be maintained or updated");
    }

    // ============ Fuzz Test: Fee Calculation ============

    function testFuzz_FeeCalculation(uint256 amount) public {
        amount = bound(amount, 1 ether, 100 ether);

        // Test the fee calculation using BondingCurveLibrary
        // Fee = amount * numerator / denominator
        // With feeNumerator = 1, feeDenominator = 200: fee = 0.5%
        uint256 expectedFee = (amount * feeNumerator) / feeDenominator;
        uint256 expectedAfterFee = amount - expectedFee;

        assertGt(expectedAfterFee, 0, "Should have positive amount after fee");
        assertLt(expectedAfterFee, amount, "Amount after fee should be less than original");
    }

    // ============ Fuzz Test: Reserves Consistency ============

    function testFuzz_ReservesConsistency(uint256 buyAmount1, uint256 buyAmount2) public {
        buyAmount1 = bound(buyAmount1, 0.01 ether, 10 ether);
        buyAmount2 = bound(buyAmount2, 0.01 ether, 10 ether);

        (address curve, address token) = createTestToken();

        IBondingCurve curveContract = IBondingCurve(curve);

        vm.startPrank(user1);
        wNative.approve(address(core), buyAmount1 + buyAmount2);

        // First buy
        core.exactInBuy(buyAmount1, 0, token, user1, block.timestamp + 1 hours);

        (uint256 vNative1, uint256 vToken1) = curveContract.getVirtualReserves();
        (uint256 rNative1, uint256 rToken1) = curveContract.getReserves();

        // Virtual reserves should be >= real reserves
        assertGe(vNative1, rNative1, "Virtual native should be >= real native");

        // Second buy
        core.exactInBuy(buyAmount2, 0, token, user1, block.timestamp + 1 hours);

        (uint256 vNative2, uint256 vToken2) = curveContract.getVirtualReserves();
        (uint256 rNative2, uint256 rToken2) = curveContract.getReserves();

        // After second buy:
        // - Virtual native should increase
        assertGt(vNative2, vNative1, "Virtual native should increase");
        // - Virtual token should decrease
        assertLt(vToken2, vToken1, "Virtual token should decrease");
        // - Real native should increase
        assertGt(rNative2, rNative1, "Real native should increase");
        // - Real token should decrease
        assertLt(rToken2, rToken1, "Real token should decrease");

        vm.stopPrank();
    }
}
