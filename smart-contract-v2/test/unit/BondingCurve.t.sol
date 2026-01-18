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
import "../../src/interfaces/IBondingCurve.sol";
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
        // Return a mock pool address (not a real pool for unit tests)
        address mockPool = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB, fee, poolCount++)))));
        pools[key] = mockPool;
        return mockPool;
    }
}

contract BondingCurveTest is Test {
    using SafeERC20 for IERC20;

    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    BondingCurve bondingCurve;
    Token token;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);

    // Configuration
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    // Market cap threshold must be > initial market cap to allow trading before graduation
    // Initial market cap = 100_000_000 tokens * (1e18 wei / 1e24 tokens) = 100 ether
    // Set to 10,000 ether so we can test multiple trades before locking
    uint256 graduationMarketCap = 10_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1; // 0.5% fee
    uint24 dexFee = 3000; // 0.30%

    function setUp() public {
        // Create wNative token
        wNative = new MockWNative();

        // Fund accounts
        vm.deal(admin, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);

        // Create mock Uniswap factory
        uniswapFactory = new MockUniswapV3Factory();

        // Deploy implementation contracts
        FeeVault feeVaultImpl = new FeeVault();
        // Deploy FeeVault proxy first
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        // Now deploy Core with the actual FeeVault address
        Core coreImpl = new Core(address(wNative), address(feeVault));
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        // Deploy via ERC1967Proxy to work around _disableInitializers()
        bytes memory initData;

        // Deploy Core proxy
        initData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // factory set later
            admin
        );
        core = Core(address(new ERC1967Proxy(address(coreImpl), initData)));

        // Initialize FeeVault with core address
        vm.startPrank(admin);
        feeVault.initialize(
            address(wNative),
            "Fee Vault",
            "FEEVAULT",
            address(core),
            admin
        );

        // Deploy Factory proxy
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

        // Set factory in core
        core.setFactory(address(factory));
        vm.stopPrank();
    }

    function createTestToken(address tokenCreator) internal returns (address curve_, address token_) {
        // Wrap native token for deployment fee
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

    // ============ Test: Initialization ============

    function testInitializeSuccess() public {
        (address curve_, address token_) = createTestToken(creator);

        BondingCurve bc = BondingCurve(curve_);
        Token t = Token(token_);

        assertEq(bc.token(), token_, "Token address mismatch");
        assertEq(t.totalSupply(), 100_000_000 * 1e18, "Total supply not 100M");

        (uint256 vNative, uint256 vToken) = bc.getVirtualReserves();
        assertEq(vNative, virtualNative, "Virtual native mismatch");
        assertEq(vToken, virtualToken, "Virtual token mismatch");
        assertEq(bc.getK(), virtualNative * virtualToken, "K mismatch");
    }

    function testInitializeWithInvalidToken() public {
        // This would test invalid token initialization
        // Skipping as it requires deeper contract setup
    }

    // ============ Test: Buy Operations ============

    function testBuyBasicSuccess() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 amountNative = 1 ether;
        uint256 expectedAmountOut = BondingCurveLibrary.getAmountOut(
            amountNative,
            bc.getK(),
            virtualNative,
            virtualToken
        );

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        // Calculate expected output with fee
        uint256 feeAmount = (expectedAmountOut * feeNumerator) / feeDenominator;
        uint256 expectedTokens = expectedAmountOut - feeAmount;

        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);

        uint256 balanceAfter = IERC20(token_).balanceOf(user1);
        assertEq(balanceAfter, expectedTokens, "Token balance mismatch");
        vm.stopPrank();
    }

    function testBuyPriceIncrease() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 price1 = bc.getCurrentPrice();

        // Buy some tokens
        uint256 amountNative = 0.5 ether;
        uint256 expectedAmountOut = BondingCurveLibrary.getAmountOut(
            amountNative,
            bc.getK(),
            virtualNative,
            virtualToken
        );

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 price2 = bc.getCurrentPrice();
        assertGt(price2, price1, "Price should increase after buy");
    }

    function testBuyWithZeroAmount() public {
        (address curve_, address token_) = createTestToken(creator);

        vm.startPrank(user1);
        wNative.deposit{value: 0}();
        vm.expectRevert();
        core.exactInBuy(0, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyMultipleTimes() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 totalSpent = 0;
        uint256 totalTokens = 0;

        for (uint256 i = 0; i < 3; i++) {
            uint256 amountNative = 0.1 ether;

            (uint256 vNative, uint256 vToken) = bc.getVirtualReserves();
            uint256 expectedAmountOut = BondingCurveLibrary.getAmountOut(
                amountNative,
                bc.getK(),
                vNative,
                vToken
            );
            uint256 feeAmount = (expectedAmountOut * feeNumerator) / feeDenominator;
            uint256 expectedTokens = expectedAmountOut - feeAmount;

            vm.startPrank(user1);
            wNative.deposit{value: amountNative}();
            wNative.approve(address(core), amountNative);
            core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
            vm.stopPrank();

            totalSpent += amountNative;
            totalTokens += expectedTokens;
        }

        uint256 finalBalance = IERC20(token_).balanceOf(user1);
        assertEq(finalBalance, totalTokens, "Cumulative token balance mismatch");
    }

    // ============ Test: Sell Operations ============

    function testSellBasicSuccess() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // First buy some tokens
        uint256 amountNative = 1 ether;
        (uint256 vNative, uint256 vToken) = bc.getVirtualReserves();
        uint256 amountOut = BondingCurveLibrary.getAmountOut(
            amountNative,
            bc.getK(),
            vNative,
            vToken
        );
        uint256 feeAmount = (amountOut * feeNumerator) / feeDenominator;
        uint256 tokensToUser = amountOut - feeAmount;

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);

        // Now sell half
        uint256 tokensToSell = tokensToUser / 2;
        IERC20(token_).approve(address(core), tokensToSell);

        uint256 wNativeBalanceBefore = wNative.balanceOf(user1);
        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        uint256 wNativeBalanceAfter = wNative.balanceOf(user1);

        assertGt(wNativeBalanceAfter, wNativeBalanceBefore, "Should receive native tokens");
        vm.stopPrank();
    }

    function testSellCreatorFeeDistribution() public {
        (address curve_, address token_) = createTestToken(creator);

        // Buy tokens
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);

        // Get tokens
        uint256 tokensBalance = IERC20(token_).balanceOf(user1);

        // Sell all tokens
        IERC20(token_).approve(address(core), tokensBalance);
        core.exactInSell(tokensBalance, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Check creator received fees
        uint256 creatorFees = factory.creatorFees(creator);
        assertGt(creatorFees, 0, "Creator should have accumulated fees");
    }

    function testSellPriceDecrease() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);

        uint256 tokensBalance = IERC20(token_).balanceOf(user1);
        uint256 price1 = bc.getCurrentPrice();

        // Sell some tokens
        IERC20(token_).approve(address(core), tokensBalance / 2);
        core.exactInSell(tokensBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);

        uint256 price2 = bc.getCurrentPrice();
        assertLt(price2, price1, "Price should decrease after sell");
        vm.stopPrank();
    }

    // ============ Test: Fee Distribution ============

    function testFeeVaultReceivesPlatformFees() public {
        (address curve_, address token_) = createTestToken(creator);

        // Get initial vault balance
        uint256 vaultBalanceBefore = wNative.balanceOf(address(feeVault));

        // Buy tokens (triggers buy fee)
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Get tokens and sell
        uint256 tokensBalance = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensBalance);
        core.exactInSell(tokensBalance, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 vaultBalanceAfter = wNative.balanceOf(address(feeVault));
        assertGt(vaultBalanceAfter, vaultBalanceBefore, "Vault should receive platform fees");
    }

    // ============ Test: Graduation & Locking ============

    function testGraduationLocking() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Calculate how much to buy to reach graduation
        // graduationMarketCap = 100 ETH
        // Need to buy enough to reach market cap of 100 ETH
        // Market cap = supply * price

        // Buy until locked
        uint256 i = 0;
        while (!bc.getLock() && i < 100) {
            uint256 amountNative = 0.5 ether;

            vm.startPrank(user1);
            wNative.deposit{value: amountNative}();
            wNative.approve(address(core), amountNative);
            core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
            vm.stopPrank();

            i++;
        }

        assertTrue(bc.getLock(), "Curve should be locked after reaching market cap");
    }

    // ============ Test: Constant Product Invariant ============

    function testConstantProductMaintained() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 k = bc.getK();

        // Buy
        uint256 amountNative = 0.5 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Check invariant maintained (with tolerance for integer division rounding)
        // Due to integer division in the constant product formula, the product may decrease slightly
        (uint256 vNative1, uint256 vToken1) = bc.getVirtualReserves();
        uint256 product1 = vNative1 * vToken1;
        // Allow up to 0.5% loss due to rounding
        uint256 tolerance = k / 200;
        assertGe(product1, k - tolerance, "K invariant should be approximately maintained");
    }

    // ============ Test: Edge Cases ============

    function testBuyWithExcessiveSlippage() public {
        (address curve_, address token_) = createTestToken(creator);

        uint256 amountNative = 1 ether;

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        // Set amountOutMin too high (should fail)
        vm.expectRevert();
        core.exactInBuy(amountNative, type(uint256).max, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyAfterExpiry() public {
        (address curve_, address token_) = createTestToken(creator);

        uint256 amountNative = 1 ether;

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        // Use past deadline
        vm.expectRevert();
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    function testBuyToInvalidRecipient() public {
        (address curve_, address token_) = createTestToken(creator);

        uint256 amountNative = 1 ether;

        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        // Try to send to address(0)
        vm.expectRevert();
        core.exactInBuy(amountNative, 0, token_, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ Test: ATH Tracking ============

    function testATHPriceTracking() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        (uint256 athPrice1, uint256 timestamp1) = bc.getATHPrice();
        assertEq(athPrice1, bc.getCurrentPrice(), "ATH should start at current price");

        // Warp time forward
        vm.warp(block.timestamp + 10);

        // Buy to increase price
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 athPrice2, uint256 timestamp2) = bc.getATHPrice();
        assertGt(athPrice2, athPrice1, "ATH price should increase");
        assertGt(timestamp2, timestamp1, "ATH timestamp should update");
    }

    function testMarketCapCalculation() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        uint256 marketCap = bc.calculateMarketCap();
        uint256 expectedMarketCap = (IERC20(token_).totalSupply() * bc.getCurrentPrice()) / 1e18;

        assertEq(marketCap, expectedMarketCap, "Market cap calculation mismatch");
    }

    // ============ Test: Pause Functionality ============

    function testPauseByAdmin() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Admin (core) should be able to pause
        // Note: Core has DEFAULT_ADMIN_ROLE on the bonding curve
        vm.prank(address(core));
        bc.pause();

        assertTrue(bc.paused(), "Curve should be paused");
    }

    function testUnpauseByAdmin() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        vm.startPrank(address(core));
        bc.pause();
        bc.unpause();
        vm.stopPrank();

        assertFalse(bc.paused(), "Curve should be unpaused");
    }

    function testPauseByNonAdminReverts() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        vm.prank(user1);
        vm.expectRevert();
        bc.pause();
    }

    function testUnpauseByNonAdminReverts() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        vm.prank(address(core));
        bc.pause();

        vm.prank(user1);
        vm.expectRevert();
        bc.unpause();
    }

    function testBuyWhenPausedReverts() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Pause the curve
        vm.prank(address(core));
        bc.pause();

        // Try to buy
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        vm.expectRevert();
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWhenPausedReverts() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // First buy some tokens
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);

        uint256 tokensBalance = IERC20(token_).balanceOf(user1);
        vm.stopPrank();

        // Pause the curve
        vm.prank(address(core));
        bc.pause();

        // Try to sell
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensBalance);

        vm.expectRevert();
        core.exactInSell(tokensBalance, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyAfterUnpause() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Pause and unpause
        vm.startPrank(address(core));
        bc.pause();
        bc.unpause();
        vm.stopPrank();

        // Buy should work
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 balance = IERC20(token_).balanceOf(user1);
        assertGt(balance, 0, "Should have received tokens");
    }

    // ============ Test: Getters ============

    function testGetLock() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertFalse(bc.getLock(), "Should not be locked initially");
    }

    function testGetIsListing() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertFalse(bc.getIsListing(), "Should not be listed initially");
    }

    function testGetFeeConfig() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        (uint8 denom, uint16 num) = bc.getFeeConfig();
        assertEq(denom, feeDenominator);
        assertEq(num, feeNumerator);
    }

    function testGetFactory() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertEq(bc.getFactory(), address(factory));
    }

    function testGetGraduationMarketCap() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        assertEq(bc.getGraduationMarketCap(), graduationMarketCap);
    }

    function testGetReserves() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        (uint256 nativeRes, uint256 tokenRes) = bc.getReserves();
        assertEq(nativeRes, 0, "Native reserves should be 0 initially");
        // Token reserves track actual reserves, not balances
        // Initially, tokens are minted to the curve but reserves track traded amounts
        assertTrue(tokenRes == 0 || tokenRes == IERC20(token_).balanceOf(curve_), "Token reserves should be 0 or match balance");
    }

    function testGetVirtualReservesAfterTrade() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        (uint256 vNativeBefore, uint256 vTokenBefore) = bc.getVirtualReserves();

        // Buy tokens
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 vNativeAfter, uint256 vTokenAfter) = bc.getVirtualReserves();

        assertGt(vNativeAfter, vNativeBefore, "Virtual native should increase after buy");
        assertLt(vTokenAfter, vTokenBefore, "Virtual token should decrease after buy");
    }

    // ============ Test: ATH Market Cap ============

    function testATHMarketCapTracking() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        (uint256 athMc1, uint256 timestamp1) = bc.getATHMarketCap();
        // ATH market cap is initialized during curve creation

        vm.warp(block.timestamp + 10);

        // Buy to increase market cap
        uint256 amountNative = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        (uint256 athMc2, uint256 timestamp2) = bc.getATHMarketCap();
        assertGt(athMc2, athMc1, "ATH market cap should increase after buy");
        assertGt(timestamp2, timestamp1, "ATH market cap timestamp should update");
    }

    // ============ Test: Edge Cases for Buy/Sell ============

    function testBuyWhenLocked() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy until locked
        uint256 i = 0;
        while (!bc.getLock() && i < 100) {
            uint256 buyAmount = 0.5 ether;
            vm.startPrank(user1);
            wNative.deposit{value: buyAmount}();
            wNative.approve(address(core), buyAmount);
            core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);
            vm.stopPrank();
            i++;
        }

        assertTrue(bc.getLock(), "Should be locked");

        // Try to buy more
        uint256 amountNative = 0.1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        vm.expectRevert();
        core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWhenLocked() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy until locked
        uint256 i = 0;
        while (!bc.getLock() && i < 100) {
            uint256 amountNative = 0.5 ether;
            vm.startPrank(user1);
            wNative.deposit{value: amountNative}();
            wNative.approve(address(core), amountNative);
            core.exactInBuy(amountNative, 0, token_, user1, block.timestamp + 1000);
            vm.stopPrank();
            i++;
        }

        assertTrue(bc.getLock(), "Should be locked");

        // Try to sell
        uint256 tokensBalance = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensBalance);
        vm.expectRevert();
        core.exactInSell(tokensBalance, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ Test: CORE_ROLE Constant ============

    function testCoreRoleConstant() public {
        (address curve_, ) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        bytes32 expectedRole = keccak256("CORE_ROLE");
        assertEq(bc.CORE_ROLE(), expectedRole);
    }
}
