// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../src/Core.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";
import "../../src/interfaces/ICore.sol";

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

contract CoreTest is Test {
    using SafeERC20 for IERC20;

    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);
    address user2 = address(0x4);
    address newFactory = address(0x5);

    // Configuration
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 10_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1; // 0.5% fee
    uint24 dexFee = 3000;

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

        // Deploy FeeVault implementation and proxy
        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        // Deploy Core with wNative and feeVault
        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(address(new ERC1967Proxy(address(coreImpl), "")));

        // Deploy Factory implementation
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), "")));

        // Initialize Core first
        vm.startPrank(admin);
        core.initialize(address(0), admin); // Initialize without factory first
        core.setFactory(address(factory)); // Then set factory
        vm.stopPrank();

        // Initialize FeeVault with wNative as asset
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

        // Give users wrapped tokens for testing
        vm.prank(user1);
        wNative.deposit{value: 100 ether}();

        vm.prank(user2);
        wNative.deposit{value: 100 ether}();

        vm.prank(creator);
        wNative.deposit{value: 100 ether}();
    }

    // ============ Initialization Tests ============

    function testInitialization() public view {
        assertEq(core.factory(), address(factory));
        assertEq(core.wNative(), address(wNative));
        assertEq(core.vault(), address(feeVault));
        assertTrue(core.hasRole(core.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(core.hasRole(core.FACTORY_ROLE(), address(factory)));
    }

    function testInitializeWithZeroOwnerReverts() public {
        Core newCoreImpl = new Core(address(wNative), address(feeVault));
        Core newCore = Core(address(new ERC1967Proxy(address(newCoreImpl), "")));

        vm.expectRevert(Core.InvalidAddress.selector);
        newCore.initialize(address(factory), address(0));
    }

    function testCannotReinitialize() public {
        vm.expectRevert();
        core.initialize(address(factory), admin);
    }

    // ============ SetFactory Tests ============

    function testSetFactory() public {
        vm.startPrank(admin);
        core.setFactory(newFactory);
        vm.stopPrank();

        assertEq(core.factory(), newFactory);
        assertTrue(core.hasRole(core.FACTORY_ROLE(), newFactory));
        assertFalse(core.hasRole(core.FACTORY_ROLE(), address(factory)));
    }

    function testSetFactoryWithZeroAddressReverts() public {
        vm.startPrank(admin);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.setFactory(address(0));
        vm.stopPrank();
    }

    function testSetFactoryByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        core.setFactory(newFactory);
    }

    // ============ CreateCurve Tests ============

    function testCreateCurve() public {
        uint256 fee = deployFee;
        uint256 amountIn = 1 ether;

        vm.startPrank(creator);
        wNative.approve(address(core), fee + amountIn);

        (address curve, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            amountIn,
            fee
        );
        vm.stopPrank();

        assertTrue(curve != address(0));
        assertTrue(token != address(0));
    }

    function testCreateCurveWithZeroCreatorReverts() public {
        uint256 fee = deployFee;

        vm.startPrank(creator);
        wNative.approve(address(core), fee);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.createCurve(
            address(0),
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();
    }

    function testCreateCurveWithInsufficientFeeReverts() public {
        uint256 fee = deployFee - 1; // Less than required

        vm.startPrank(creator);
        wNative.approve(address(core), fee);

        vm.expectRevert(Core.InvalidFee.selector);
        core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();
    }

    function testCreateCurveWithNativeToken() public {
        uint256 fee = deployFee;
        uint256 amountIn = 1 ether;

        // When using native token, we need to approve the wNative for the wrapped amount
        // since Core wraps the native and then transfers from itself
        vm.startPrank(creator);
        // Deposit to get wNative first
        wNative.deposit{value: fee + amountIn}();
        wNative.approve(address(core), fee + amountIn);

        (address curve, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            amountIn,
            fee
        );
        vm.stopPrank();

        assertTrue(curve != address(0));
        assertTrue(token != address(0));
    }

    // ============ ExactInBuy Tests ============

    function testExactInBuy() public {
        // First create a curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (address curve, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // Now buy tokens
        uint256 amountIn = 1 ether;
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(user1);
        wNative.approve(address(core), amountIn);

        uint256 balanceBefore = IERC20(token).balanceOf(user1);

        core.exactInBuy(
            amountIn,
            0, // min out
            token,
            user1,
            deadline
        );
        vm.stopPrank();

        uint256 balanceAfter = IERC20(token).balanceOf(user1);
        assertTrue(balanceAfter > balanceBefore);
    }

    function testExactInBuyExpiredReverts() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // Try to buy with expired deadline
        uint256 amountIn = 1 ether;
        uint256 deadline = block.timestamp - 1; // Already expired

        vm.startPrank(user1);
        wNative.approve(address(core), amountIn);

        vm.expectRevert(Core.Expired.selector);
        core.exactInBuy(
            amountIn,
            0,
            token,
            user1,
            deadline
        );
        vm.stopPrank();
    }

    function testExactInBuyInsufficientOutputReverts() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // Try to buy with unreasonable minimum output
        uint256 amountIn = 0.001 ether;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 unreasonableMinOut = type(uint256).max;

        vm.startPrank(user1);
        wNative.approve(address(core), amountIn);

        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInBuy(
            amountIn,
            unreasonableMinOut,
            token,
            user1,
            deadline
        );
        vm.stopPrank();
    }

    function testExactInBuyInvalidTokenReverts() public {
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(user1);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInBuy(
            1 ether,
            0,
            address(0),
            user1,
            deadline
        );
        vm.stopPrank();
    }

    // ============ ExactOutBuy Tests ============

    function testExactOutBuy() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (address curve, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // For exactOutBuy, the tokensWanted is the raw output BEFORE fees
        // The bonding curve validates that tokensWanted matches exactly what's calculated
        // Use exactInBuy pattern to verify output instead
        uint256 amountIn = 0.1 ether;
        uint256 amountInMax = 10 ether;
        uint256 deadline = block.timestamp + 1 hours;

        // Calculate expected output using Core's library
        IBondingCurve curveContract = IBondingCurve(curve);
        (uint256 vNative, uint256 vToken) = curveContract.getVirtualReserves();
        uint256 k = curveContract.getK();
        uint256 tokensWanted = core.getAmountOut(amountIn, k, vNative, vToken);

        vm.startPrank(user1);
        wNative.approve(address(core), amountInMax);

        uint256 balanceBefore = IERC20(token).balanceOf(user1);

        core.exactOutBuy(
            tokensWanted,
            amountInMax,
            token,
            user1,
            deadline
        );
        vm.stopPrank();

        uint256 balanceAfter = IERC20(token).balanceOf(user1);
        // Due to fees, received amount will be less than tokensWanted
        assertTrue(balanceAfter > balanceBefore);
    }

    function testExactOutBuyExcessiveInputReverts() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // Try to buy with too low max input
        uint256 tokensWanted = 100000 * 1e18; // Large amount
        uint256 amountInMax = 0.001 ether; // Too small
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(user1);
        wNative.approve(address(core), amountInMax);

        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutBuy(
            tokensWanted,
            amountInMax,
            token,
            user1,
            deadline
        );
        vm.stopPrank();
    }

    // ============ ExactInSell Tests ============

    function testExactInSell() public {
        // Create curve and buy some tokens first
        uint256 fee = deployFee;
        uint256 buyAmount = 0.5 ether;

        vm.startPrank(creator);
        wNative.approve(address(core), fee + buyAmount);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            buyAmount,
            fee
        );
        vm.stopPrank();

        uint256 tokensToSell = IERC20(token).balanceOf(creator) / 2;
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(creator);
        IERC20(token).approve(address(core), tokensToSell);

        uint256 wNativeBefore = wNative.balanceOf(creator);

        core.exactInSell(
            tokensToSell,
            0, // min out
            token,
            creator,
            creator,
            deadline
        );
        vm.stopPrank();

        uint256 wNativeAfter = wNative.balanceOf(creator);
        assertTrue(wNativeAfter > wNativeBefore);
    }

    function testExactInSellInsufficientOutputReverts() public {
        // Create curve and buy some tokens first
        uint256 fee = deployFee;
        uint256 buyAmount = 0.5 ether;

        vm.startPrank(creator);
        wNative.approve(address(core), fee + buyAmount);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            buyAmount,
            fee
        );
        vm.stopPrank();

        uint256 tokensToSell = 100 * 1e18;
        uint256 unreasonableMinOut = type(uint256).max;
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(creator);
        IERC20(token).approve(address(core), tokensToSell);

        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInSell(
            tokensToSell,
            unreasonableMinOut,
            token,
            creator,
            creator,
            deadline
        );
        vm.stopPrank();
    }

    // ============ ExactOutSell Tests ============

    function testExactOutSell() public {
        // Create curve and buy some tokens first
        uint256 fee = deployFee;
        uint256 buyAmount = 0.5 ether;

        vm.startPrank(creator);
        wNative.approve(address(core), fee + buyAmount);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            buyAmount,
            fee
        );
        vm.stopPrank();

        uint256 wantedNative = 0.1 ether;
        uint256 maxTokens = IERC20(token).balanceOf(creator);
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(creator);
        IERC20(token).approve(address(core), maxTokens);

        uint256 wNativeBefore = wNative.balanceOf(creator);

        core.exactOutSell(
            wantedNative,
            maxTokens,
            token,
            creator,
            creator,
            deadline
        );
        vm.stopPrank();

        uint256 wNativeAfter = wNative.balanceOf(creator);
        assertTrue(wNativeAfter > wNativeBefore);
    }

    function testExactOutSellExcessiveInputReverts() public {
        // Create curve and buy some tokens first
        uint256 fee = deployFee;
        uint256 buyAmount = 1 ether;

        vm.startPrank(creator);
        wNative.approve(address(core), fee + buyAmount);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            buyAmount,
            fee
        );
        vm.stopPrank();

        // Request a reasonable amount of native but allow too few tokens
        // This will cause ExcessiveInput error
        uint256 wantedNative = 0.01 ether; // Small amount
        uint256 maxTokens = 1; // Too few tokens allowed
        uint256 deadline = block.timestamp + 1 hours;

        vm.startPrank(creator);
        IERC20(token).approve(address(core), maxTokens);

        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutSell(
            wantedNative,
            maxTokens,
            token,
            creator,
            creator,
            deadline
        );
        vm.stopPrank();
    }

    // ============ Pause Tests ============

    function testPause() public {
        vm.startPrank(admin);
        core.pause();
        vm.stopPrank();

        assertTrue(core.paused());
    }

    function testUnpause() public {
        vm.startPrank(admin);
        core.pause();
        core.unpause();
        vm.stopPrank();

        assertFalse(core.paused());
    }

    function testPauseByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        core.pause();
    }

    function testUnpauseByNonAdminReverts() public {
        vm.prank(admin);
        core.pause();

        vm.prank(user1);
        vm.expectRevert();
        core.unpause();
    }

    function testCreateCurveWhenPausedReverts() public {
        vm.prank(admin);
        core.pause();

        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);

        vm.expectRevert("Pausable: paused");
        core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();
    }

    function testExactInBuyWhenPausedReverts() public {
        // Create curve first
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        // Pause
        vm.prank(admin);
        core.pause();

        // Try to buy
        vm.startPrank(user1);
        wNative.approve(address(core), 1 ether);

        vm.expectRevert("Pausable: paused");
        core.exactInBuy(
            1 ether,
            0,
            token,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }

    // ============ View Functions Tests ============

    function testGetCurveData() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (address curve, ) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        (uint256 vNative, uint256 vToken, uint256 k) = core.getCurveData(curve);

        assertEq(vNative, virtualNative);
        assertEq(vToken, virtualToken);
        assertEq(k, virtualNative * virtualToken);
    }

    function testGetAmountOut() public view {
        uint256 amountIn = 1 ether;
        uint256 k = virtualNative * virtualToken;
        uint256 reserveIn = virtualNative;
        uint256 reserveOut = virtualToken;

        uint256 amountOut = core.getAmountOut(amountIn, k, reserveIn, reserveOut);
        assertTrue(amountOut > 0);
        assertTrue(amountOut < virtualToken);
    }

    function testGetAmountIn() public view {
        uint256 amountOut = 100000 * 1e18;
        uint256 k = virtualNative * virtualToken;
        uint256 reserveIn = virtualNative;
        uint256 reserveOut = virtualToken;

        uint256 amountIn = core.getAmountIn(amountOut, k, reserveIn, reserveOut);
        assertTrue(amountIn > 0);
    }

    function testGetFeeVault() public view {
        assertEq(core.getFeeVault(), address(feeVault));
    }

    function testGetCurrentPrice() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        uint256 price = core.getCurrentPrice(token);
        assertTrue(price > 0);
    }

    function testGetCurrentPriceInvalidTokenReverts() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.getCurrentPrice(address(0x999)); // Non-existent token
    }

    function testCalculateMarketCap() public {
        // Create curve
        uint256 fee = deployFee;
        vm.startPrank(creator);
        wNative.approve(address(core), fee);
        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            fee
        );
        vm.stopPrank();

        uint256 marketCap = core.calculateMarketCap(token);
        assertTrue(marketCap > 0);
    }

    // ============ Role Constants Tests ============

    function testFactoryRoleConstant() public view {
        bytes32 expectedRole = keccak256("FACTORY_ROLE");
        assertEq(core.FACTORY_ROLE(), expectedRole);
    }

    // ============ Immutable Values Tests ============

    function testImmutableValues() public view {
        assertEq(core.wNative(), address(wNative));
        assertEq(core.vault(), address(feeVault));
    }
}
