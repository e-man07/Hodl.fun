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
 * @title BranchCoverageTest
 * @notice Comprehensive tests targeting branch coverage for all contracts
 */
contract BranchCoverageTest is Test {
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
    uint256 graduationMarketCap = 100 ether; // Lower for testing
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

    // Allow test contract to receive ETH (needed for emergency withdraw test)
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

    // ============ BondingCurve Branch Tests ============

    function testBuyWithInvalidTo_WNative() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Try to buy with to = wNative address (branch: to == wNative)
        // BondingCurve uses InvalidTo error
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInBuy(1 ether, 0, token_, address(wNative), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyWithInvalidTo_Token() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Try to buy with to = token address (branch: to == token)
        // BondingCurve uses InvalidTo error
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInBuy(1 ether, 0, token_, token_, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWithInvalidTo_WNative() public {
        (, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Try to sell with to = wNative (branch: to == wNative)
        // BondingCurve uses InvalidTo error
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, address(wNative), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWithInvalidTo_Token() public {
        (, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Try to sell with to = token (branch: to == token)
        // BondingCurve uses InvalidTo error
        vm.expectRevert(BondingCurve.InvalidTo.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, token_, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyWhenPaused() public {
        (, address token_) = createTestToken();

        // Pause the core
        vm.prank(admin);
        core.pause();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert("Pausable: paused");
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWhenPaused() public {
        (, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Pause the core
        vm.prank(admin);
        core.pause();

        vm.startPrank(user1);
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        vm.expectRevert("Pausable: paused");
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyWithExpiredDeadline() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Branch: deadline < block.timestamp
        vm.expectRevert(Core.Expired.selector);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    function testSellWithExpiredDeadline() public {
        (, address token_) = createTestToken();

        // First buy
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Branch: deadline < block.timestamp
        vm.expectRevert(Core.Expired.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp - 1);
        vm.stopPrank();
    }

    function testBuyWithLockedCurve() public {
        (address curve_, address token_) = createTestToken();

        // Force lock the curve by reaching graduation
        // Buy enough to trigger graduation
        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);

        // Buy large amount to trigger graduation
        core.exactInBuy(150 ether, 0, token_, user1, block.timestamp + 1000);

        // Verify curve is locked
        assertTrue(BondingCurve(curve_).lock(), "Curve should be locked");

        // Try to buy more - should fail
        vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWithLockedCurve() public {
        (address curve_, address token_) = createTestToken();

        // Buy enough to trigger graduation
        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);
        core.exactInBuy(150 ether, 0, token_, user1, block.timestamp + 1000);

        assertTrue(BondingCurve(curve_).lock(), "Curve should be locked");

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Try to sell - should fail
        vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSlippageProtectionOnBuy() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Set amountOutMin too high (branch: amountOut < amountOutMin)
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInBuy(1 ether, type(uint256).max, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSlippageProtectionOnSell() public {
        (, address token_) = createTestToken();

        // First buy
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Set amountOutMin too high (branch: amountOut < amountOutMin)
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInSell(tokenBalance / 2, type(uint256).max, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutBuySlippageExceeded() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Try exact out buy with amountInMax too low
        // Need to use a reasonable amount that exceeds amountInMax
        uint256 amountOut = 100000 * 1e18;
        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutBuy(amountOut, 0.001 ether, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutSellSlippageExceeded() public {
        (, address token_) = createTestToken();

        // First buy
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Try exact out sell with amountInMax too low
        vm.expectRevert(Core.ExcessiveInput.selector);
        core.exactOutSell(0.5 ether, 1, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ BondingCurveFactory Branch Tests ============

    function testInitializeWithZeroOwner() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: address(0), // Zero owner
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

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithZeroCore() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(0), // Zero core
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

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithZeroVirtualNative() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: 0, // Zero virtual native
            virtualToken: virtualToken,
            graduationMarketCap: graduationMarketCap,
            feeDenominator: feeDenominator,
            feeNumerator: feeNumerator,
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidReserves.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithZeroVirtualToken() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: virtualNative,
            virtualToken: 0, // Zero virtual token
            graduationMarketCap: graduationMarketCap,
            feeDenominator: feeDenominator,
            feeNumerator: feeNumerator,
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidReserves.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithZeroFeeDenominator() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: virtualNative,
            virtualToken: virtualToken,
            graduationMarketCap: graduationMarketCap,
            feeDenominator: 0, // Zero denominator
            feeNumerator: feeNumerator,
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithFeeNumeratorGTEDenominator() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: virtualNative,
            virtualToken: virtualToken,
            graduationMarketCap: graduationMarketCap,
            feeDenominator: 100,
            feeNumerator: 100, // Equal to denominator (100%)
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testInitializeWithInvalidDexFee() public {
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

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
            dexFee: 1000 // Invalid fee tier
        });

        bytes memory initData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            params
        );

        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        new ERC1967Proxy(address(factoryImpl), initData);
    }

    function testSetOwnerWithZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.setOwner(address(0));
    }

    function testSetCoreWithZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.setCore(address(0));
    }

    function testSetDexFactoryWithZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.setDexFactory(address(0));
    }

    function testSetVirtualReservesWithZeroNative() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidReserves.selector);
        factory.setVirtualReserves(0, virtualToken);
    }

    function testSetVirtualReservesWithZeroToken() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidReserves.selector);
        factory.setVirtualReserves(virtualNative, 0);
    }

    function testSetFeeConfigWithZeroDenominator() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        factory.setFeeConfig(0, 1);
    }

    function testSetFeeConfigWithNumeratorGTEDenominator() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        factory.setFeeConfig(100, 100);
    }

    function testSetDexFeeWith500() public {
        vm.prank(admin);
        factory.setDexFee(500);
        assertEq(factory.getDexFee(), 500);
    }

    function testSetDexFeeWith10000() public {
        vm.prank(admin);
        factory.setDexFee(10000);
        assertEq(factory.getDexFee(), 10000);
    }

    function testSetDexFeeWithInvalidValue() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidFeeConfig.selector);
        factory.setDexFee(2000);
    }

    function testSetCreatorFeeShareAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(BondingCurveFactory.InvalidCreatorFeeShare.selector);
        factory.setCreatorFeeShare(10001); // > 100%
    }

    function testSetCreatorFeeShareValid() public {
        vm.prank(admin);
        factory.setCreatorFeeShare(2000); // 20%
        assertEq(factory.getCreatorFeeShare(), 2000);
    }

    function testClaimCreatorFeesWithZeroBalance() public {
        vm.prank(user1);
        vm.expectRevert(BondingCurveFactory.NoFeesToClaim.selector);
        factory.claimCreatorFees();
    }

    function testAccumulateCreatorFeesFromNonCurve() public {
        vm.prank(user1);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.accumulateCreatorFees(creator, 1 ether);
    }

    function testAccumulateCreatorFeesWithZeroCreator() public {
        (address curve_, ) = createTestToken();

        vm.prank(curve_);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.accumulateCreatorFees(address(0), 1 ether);
    }

    function testAccumulateCreatorFeesWithZeroAmount() public {
        (address curve_, ) = createTestToken();

        vm.prank(curve_);
        vm.expectRevert(BondingCurveFactory.InvalidAddress.selector);
        factory.accumulateCreatorFees(creator, 0);
    }

    // ============ WPUSH Branch Tests ============
    // Note: mint(), batchMint(), emergencyWithdraw() tests removed - functions were rug pull vectors

    function testWPUSHDepositZeroAmount() public {
        vm.expectRevert(WPUSH.ZeroDeposit.selector);
        wNative.deposit{value: 0}();
    }

    function testWPUSHWithdrawZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(WPUSH.ZeroWithdraw.selector);
        wNative.withdraw(0);
    }

    function testWPUSHWithdrawInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wNative.withdraw(1 ether);
    }

    function testWPUSHBurnZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(WPUSH.ZeroBurn.selector);
        wNative.burn(0);
    }

    function testWPUSHBurnFromInsufficientAllowance() public {
        vm.prank(user1);
        wNative.deposit{value: 1 ether}();

        vm.prank(user2);
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wNative.burnFrom(user1, 1 ether);
    }

    function testWPUSHWithdrawWithPermitZeroAmount() public {
        vm.expectRevert(WPUSH.ZeroWithdraw.selector);
        wNative.withdrawWithPermit(user1, 0, block.timestamp + 1000, 0, bytes32(0), bytes32(0));
    }

    function testWPUSHWithdrawWithPermitInsufficientBalance() public {
        vm.expectRevert(WPUSH.InsufficientBalance.selector);
        wNative.withdrawWithPermit(user1, 1 ether, block.timestamp + 1000, 0, bytes32(0), bytes32(0));
    }

    function testWPUSHReceiveDirectTransfer() public {
        uint256 balanceBefore = wNative.balanceOf(user1);

        vm.prank(user1);
        (bool success,) = address(wNative).call{value: 1 ether}("");
        assertTrue(success);

        assertEq(wNative.balanceOf(user1) - balanceBefore, 1 ether);
    }

    // ============ Core Branch Tests ============

    function testCreateCurveWithZeroCreator() public {
        vm.startPrank(user1);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.createCurve(address(0), "Test", "TEST", "ipfs://", 0, deployFee);
        vm.stopPrank();
    }

    function testCalculateMarketCapZeroAddress() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.calculateMarketCap(address(0));
    }

    function testCalculateMarketCapNonExistentToken() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.calculateMarketCap(address(0x999));
    }

    function testGetCurrentPriceNonExistentToken() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.getCurrentPrice(address(0x999));
    }

    function testExactOutBuyWithZeroAmountOut() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Zero amountOut triggers library revert
        vm.expectRevert(BondingCurveLibrary.InsufficientOutputAmount.selector);
        core.exactOutBuy(0, 1 ether, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutSellWithZeroAmountOut() public {
        (, address token_) = createTestToken();

        // First buy some
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // Zero amountOut triggers library revert
        vm.expectRevert(BondingCurveLibrary.InsufficientOutputAmount.selector);
        core.exactOutSell(0, tokenBalance, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ Listing Flow Branch Tests ============

    function testListingWhenNotLocked() public {
        (, address token_) = createTestToken();

        // Direct call fails with access control, so test via Core.triggerListing
        vm.expectRevert(BondingCurve.OnlyLock.selector);
        core.triggerListing(token_);
    }

    function testListingAlreadyListed() public {
        (address curve_, address token_) = createTestToken();

        // Buy enough to trigger graduation
        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);
        core.exactInBuy(150 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        assertTrue(BondingCurve(curve_).lock());

        // First listing via Core
        core.triggerListing(token_);

        // Second listing should fail
        vm.expectRevert(BondingCurve.AlreadyListed.selector);
        core.triggerListing(token_);
    }

    // ============ getTickSpacing Branch Tests ============

    function testListingWithDifferentFeeTiers() public {
        // Test with 500 fee tier
        vm.prank(admin);
        factory.setDexFee(500);

        (address curve1, address token1) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);
        core.exactInBuy(150 ether, 0, token1, user1, block.timestamp + 1000);
        vm.stopPrank();

        assertTrue(BondingCurve(curve1).lock());
        address pool1 = core.triggerListing(token1);
        assertTrue(pool1 != address(0));

        // Test with 10000 fee tier
        vm.prank(admin);
        factory.setDexFee(10000);

        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (address curve2, address token2) = core.createCurve(
            creator,
            "Test Token 2",
            "TEST2",
            "ipfs://test2",
            0,
            deployFee
        );
        vm.stopPrank();

        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);
        core.exactInBuy(150 ether, 0, token2, user1, block.timestamp + 1000);
        vm.stopPrank();

        assertTrue(BondingCurve(curve2).lock());
        address pool2 = core.triggerListing(token2);
        assertTrue(pool2 != address(0));
    }

    // ============ ATH Tracking Branch Tests ============

    function testATHPriceNotUpdatedOnPriceDecrease() public {
        (, address token_) = createTestToken();

        // Buy to increase price and set initial ATH
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        // Record ATH after buy
        address curve = factory.getCurve(token_);
        (uint256 athPriceBefore, ) = BondingCurve(curve).getATHPrice();

        // Sell to decrease price
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);

        // ATH should remain the same
        (uint256 athPriceAfter, ) = BondingCurve(curve).getATHPrice();
        assertEq(athPriceAfter, athPriceBefore, "ATH should not decrease");
        vm.stopPrank();
    }

    // ============ Creator Fee Flow Tests ============

    function testCreatorFeeDistributionOnSell() public {
        (, address token_) = createTestToken();

        // Buy tokens
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        // Check creator fees before sell
        uint256 creatorFeesBefore = factory.creatorFees(creator);

        // Sell tokens
        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Creator should have accumulated fees
        uint256 creatorFeesAfter = factory.creatorFees(creator);
        assertTrue(creatorFeesAfter > creatorFeesBefore, "Creator should have accumulated fees");
    }

    function testCreatorCanClaimFees() public {
        (, address token_) = createTestToken();

        // Generate fees through trading
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Creator claims fees
        uint256 pendingFees = factory.creatorFees(creator);
        assertTrue(pendingFees > 0, "Should have pending fees");

        uint256 creatorBalanceBefore = wNative.balanceOf(creator);

        vm.prank(creator);
        factory.claimCreatorFees();

        uint256 creatorBalanceAfter = wNative.balanceOf(creator);
        assertEq(creatorBalanceAfter - creatorBalanceBefore, pendingFees);
        assertEq(factory.creatorFees(creator), 0, "Fees should be zeroed after claim");
    }

    // ============ Edge Case: Creator Fee Share Zero ============

    function testNoCreatorFeesWhenShareIsZero() public {
        // Set creator fee share to 0
        vm.prank(admin);
        factory.setCreatorFeeShare(0);

        // Create token
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (, address token_) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Trade
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Creator should have 0 fees
        assertEq(factory.creatorFees(creator), 0, "Creator fees should be zero when share is 0");
    }

    // ============ Pause/Unpause Tests ============

    function testPauseByNonAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        core.pause();
    }

    function testUnpauseByNonAdmin() public {
        vm.prank(admin);
        core.pause();

        vm.prank(user1);
        vm.expectRevert();
        core.unpause();
    }

    function testPauseAndUnpauseFlow() public {
        (, address token_) = createTestToken();

        // Pause
        vm.prank(admin);
        core.pause();
        assertTrue(core.paused());

        // Try to buy - should fail
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        vm.expectRevert("Pausable: paused");
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Unpause
        vm.prank(admin);
        core.unpause();
        assertFalse(core.paused());

        // Buy should work now
        vm.startPrank(user1);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);
        assertTrue(IERC20(token_).balanceOf(user1) > 0);
        vm.stopPrank();
    }

    // ============ BondingCurve Additional Branch Tests ============

    function testBuyWithZeroAmountOutReverts() public {
        (address curve_, address token_) = createTestToken();

        // Trying to directly call buy with zero should fail
        // We need to use Core which validates amountOut == 0 at library level
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // The library call for getAmountOut with 0 input returns 0 output
        // BondingCurve checks amountOut == 0 and reverts
        vm.expectRevert(BondingCurveLibrary.InsufficientInputAmount.selector);
        core.exactInBuy(0, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWithZeroAmountOutReverts() public {
        (, address token_) = createTestToken();

        // First buy some tokens
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        IERC20(token_).approve(address(core), type(uint256).max);

        // Try to sell zero amount
        vm.expectRevert(BondingCurveLibrary.InsufficientInputAmount.selector);
        core.exactInSell(0, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testBuyWithZeroToAddress() public {
        (, address token_) = createTestToken();

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // to == address(0) branch
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInBuy(1 ether, 0, token_, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testSellWithZeroToAddress() public {
        (, address token_) = createTestToken();

        // First buy
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(1 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        // to == address(0) branch
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInSell(tokenBalance / 2, 0, token_, user1, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ BondingCurveLibrary Branch Tests ============

    function testGetAmountOutWithLargeInput() public {
        (, address token_) = createTestToken();

        // Test with a large but valid input
        vm.startPrank(user1);
        wNative.deposit{value: 50 ether}();
        wNative.approve(address(core), 50 ether);

        // Should succeed with a large amount
        core.exactInBuy(50 ether, 0, token_, user1, block.timestamp + 1000);

        assertTrue(IERC20(token_).balanceOf(user1) > 0);
        vm.stopPrank();
    }

    function testGetAmountInEdgeCases() public {
        (, address token_) = createTestToken();

        // Test exactInBuy with different amounts to exercise getAmountOut
        vm.startPrank(user1);
        wNative.deposit{value: 10 ether}();
        wNative.approve(address(core), 10 ether);

        // Buy using exactInBuy which exercises the library
        core.exactInBuy(5 ether, 0, token_, user1, block.timestamp + 1000);

        assertTrue(IERC20(token_).balanceOf(user1) > 0, "Should have received tokens");
        vm.stopPrank();
    }

    function testSellAndBuyPriceImpact() public {
        (, address token_) = createTestToken();

        // Buy first
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);

        uint256 tokenBalance = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokenBalance);

        uint256 nativeBalanceBefore = wNative.balanceOf(user1);

        // Sell half of tokens to get some native back
        core.exactInSell(tokenBalance / 2, 0, token_, user1, user1, block.timestamp + 1000);

        uint256 nativeBalanceAfter = wNative.balanceOf(user1);
        assertTrue(nativeBalanceAfter > nativeBalanceBefore, "Should have received native");
        vm.stopPrank();
    }

    // ============ Listing Edge Case Tests ============

    function testListingPoolAlreadyExists() public {
        (address curve1, address token1) = createTestToken();

        // Buy enough to trigger graduation
        vm.startPrank(user1);
        wNative.deposit{value: 200 ether}();
        wNative.approve(address(core), 200 ether);
        core.exactInBuy(150 ether, 0, token1, user1, block.timestamp + 1000);
        vm.stopPrank();

        assertTrue(BondingCurve(curve1).lock());

        // First listing creates the pool
        address pool1 = core.triggerListing(token1);
        assertTrue(pool1 != address(0));
        assertTrue(BondingCurve(curve1).isListing());

        // Verify pool was created
        assertEq(BondingCurve(curve1).pool(), pool1);
    }

    function testMarketCapCalculation() public {
        (, address token_) = createTestToken();

        // Buy to increase price
        vm.startPrank(user1);
        wNative.deposit{value: 10 ether}();
        wNative.approve(address(core), 10 ether);
        core.exactInBuy(10 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Calculate market cap
        uint256 marketCap = core.calculateMarketCap(token_);
        assertTrue(marketCap > 0, "Market cap should be positive");

        // Get price directly
        uint256 price = core.getCurrentPrice(token_);
        assertTrue(price > 0, "Price should be positive");
    }

    // ============ Core Additional Branch Tests ============

    function testExactInBuyWithNonExistentToken() public {
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Non-existent token
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInBuy(1 ether, 0, address(0x9999), user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactInSellWithNonExistentToken() public {
        vm.startPrank(user1);

        // Non-existent token
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInSell(1 ether, 0, address(0x9999), user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutBuyWithNonExistentToken() public {
        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Non-existent token
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactOutBuy(1e18, 1 ether, address(0x9999), user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutSellWithNonExistentToken() public {
        vm.startPrank(user1);

        // Non-existent token
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactOutSell(1 ether, 1e18, address(0x9999), user1, user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============ Factory Getter Tests ============

    function testFactoryGetCurveNonExistent() public view {
        address curve = factory.getCurve(address(0x9999));
        assertEq(curve, address(0), "Should return zero for non-existent token");
    }

    function testFactoryGetCreatorNonExistent() public view {
        address tokenCreator = factory.getCreator(address(0x9999));
        assertEq(tokenCreator, address(0), "Should return zero for non-existent token");
    }

    function testFactoryTokenCurveMapping() public {
        (address curve_, address token_) = createTestToken();
        // Verify the reverse mapping works via getCurve
        address curveFromToken = factory.getCurve(token_);
        assertEq(curveFromToken, curve_, "Curve should match");
    }

    // ============ WPUSH Edge Case Tests ============
    // Note: testWPUSHSuccessfulBatchMint removed - batchMint was a rug pull vector

    function testWPUSHSuccessfulBurnFrom() public {
        // Deposit first
        vm.prank(user1);
        wNative.deposit{value: 2 ether}();

        // Approve user2 to burn
        vm.prank(user1);
        wNative.approve(user2, 1 ether);

        // User2 burns from user1
        vm.prank(user2);
        wNative.burnFrom(user1, 1 ether);

        assertEq(wNative.balanceOf(user1), 1 ether);
    }

    function testWPUSHGetBalance() public {
        vm.prank(user1);
        wNative.deposit{value: 1 ether}();

        uint256 contractBalance = wNative.getBalance();
        assertEq(contractBalance, 1 ether);
    }

    function testWPUSHSuccessfulWithdraw() public {
        vm.startPrank(user1);
        wNative.deposit{value: 2 ether}();

        uint256 balanceBefore = user1.balance;
        wNative.withdraw(1 ether);
        uint256 balanceAfter = user1.balance;

        assertEq(balanceAfter - balanceBefore, 1 ether);
        assertEq(wNative.balanceOf(user1), 1 ether);
        vm.stopPrank();
    }

    // ============ FeeVault Branch Tests ============

    function testFeeVaultSetCoreNewCore() public {
        address newCore = address(0x1234);

        vm.prank(admin);
        feeVault.setCore(newCore);

        assertTrue(feeVault.hasRole(feeVault.CORE_ROLE(), newCore));
    }
}
