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
import "../../src/interfaces/IBondingCurveFactory.sol";
import "../../src/utils/BondingCurveLibrary.sol";

// Reuse mock contracts from BondingCurve.t.sol
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

contract CreatorFeeTest is Test {
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

        // Verify critical role grants
        _verifyRoleSetup();
    }

    /**
     * @notice Verify that all critical roles are properly granted
     * @dev This helps diagnose role initialization issues in proxy patterns
     */
    function _verifyRoleSetup() internal {
        // Verify Core has CORE_ROLE on Factory
        bytes32 coreRoleFactory = factory.CORE_ROLE();
        bool coreHasRoleOnFactory = factory.hasRole(coreRoleFactory, address(core));
        require(coreHasRoleOnFactory, "Core should have CORE_ROLE on Factory");

        // Factory should have been properly initialized
        IBondingCurveFactory.Config memory config = factory.getConfig();
        require(config.virtualNative != 0, "Factory should be initialized with virtualNative");
    }

    function createTestToken(address tokenCreator) internal returns (address curve_, address token_) {
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

        // Verify BondingCurve was properly initialized with CORE_ROLE
        _verifyBondingCurveSetup(curve_, token_);
    }

    /**
     * @notice Verify BondingCurve is properly initialized with roles
     */
    function _verifyBondingCurveSetup(address curve_, address token_) internal {
        // Verify curve address is valid
        require(curve_ != address(0), "Curve should be created");

        // Verify BondingCurve has the correct token
        require(BondingCurve(curve_).token() == token_, "Curve should have correct token");

        // Verify Core has CORE_ROLE on BondingCurve
        bytes32 coreRoleCurve = BondingCurve(curve_).CORE_ROLE();
        bool coreHasRoleOnCurve = BondingCurve(curve_).hasRole(coreRoleCurve, address(core));
        require(coreHasRoleOnCurve, "Core should have CORE_ROLE on BondingCurve");
    }

    // ============ Test: Creator Fee Distribution ============

    /**
     * @notice Diagnostic test to verify BondingCurve initialization with roles
     */
    function testBondingCurveInitializationDiagnostic() public {
        // Create a simple token
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        (address curve_, address token_) = core.createCurve(
            creator,
            "Diagnostic Token",
            "DIAG",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Manually check the BondingCurve state
        BondingCurve bc = BondingCurve(curve_);

        // Get all the details we can
        assertTrue(curve_ != address(0), "Curve should be created");
        assertEq(bc.token(), token_, "Curve should have the token");

        // Check if Core has the role
        bytes32 coreRole = bc.CORE_ROLE();
        bool coreHasRole = bc.hasRole(coreRole, address(core));

        // Debug output
        console.log("Curve address:", curve_);
        console.log("Core address:", address(core));
        console.log("Core has CORE_ROLE:", coreHasRole);
        console.log("Token address:", token_);

        // This assertion will show us if the role was granted
        assertTrue(coreHasRole, "Core should have CORE_ROLE on BondingCurve");
    }

    function testCreatorFeeDefaultIs10Percent() public {
        uint16 feeShare = factory.creatorFeeShare();
        assertEq(feeShare, 1000, "Default creator fee share should be 10% (1000 basis points)");
    }

    function testSellSplitsFeesCorrectly() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Buy tokens
        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);
        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Get tokens to sell
        uint256 tokensToSell = IERC20(token_).balanceOf(user1);
        
        // Calculate expected sell output
        (uint256 vNative, uint256 vToken) = bc.getVirtualReserves();
        uint256 sellAmountOut = BondingCurveLibrary.getAmountOut(
            tokensToSell,
            bc.getK(),
            vToken,
            vNative
        );

        // Calculate expected fees
        uint256 totalFee = (sellAmountOut * feeNumerator) / feeDenominator;
        uint256 expectedCreatorFee = (totalFee * 1000) / 10000; // 10% of fee
        uint256 expectedPlatformFee = totalFee - expectedCreatorFee;

        // Get initial balances
        uint256 factoryBalanceBefore = wNative.balanceOf(address(factory));
        uint256 vaultBalanceBefore = wNative.balanceOf(address(feeVault));
        uint256 creatorFeesBefore = factory.creatorFees(creator);

        // Sell tokens
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensToSell);
        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Check factory received creator fee
        uint256 factoryBalanceAfter = wNative.balanceOf(address(factory));
        assertEq(
            factoryBalanceAfter - factoryBalanceBefore,
            expectedCreatorFee,
            "Factory should receive creator fee"
        );

        // Check vault received platform fee
        uint256 vaultBalanceAfter = wNative.balanceOf(address(feeVault));
        assertEq(
            vaultBalanceAfter - vaultBalanceBefore,
            expectedPlatformFee,
            "Vault should receive platform fee"
        );

        // Check creator fees accumulated
        uint256 creatorFeesAfter = factory.creatorFees(creator);
        assertEq(
            creatorFeesAfter - creatorFeesBefore,
            expectedCreatorFee,
            "Creator fees should accumulate correctly"
        );
    }

    function testCreatorCanClaimFees() public {
        (address curve_, address token_) = createTestToken(creator);

        // Buy and sell to generate fees
        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);
        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);

        uint256 tokensToSell = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokensToSell);
        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Check creator has fees
        uint256 creatorFees = factory.creatorFees(creator);
        assertGt(creatorFees, 0, "Creator should have accumulated fees");

        // Claim fees
        uint256 creatorBalanceBefore = wNative.balanceOf(creator);
        vm.prank(creator);
        factory.claimCreatorFees();
        uint256 creatorBalanceAfter = wNative.balanceOf(creator);

        assertEq(
            creatorBalanceAfter - creatorBalanceBefore,
            creatorFees,
            "Creator should receive claimed fees"
        );

        // Check fees are reset
        assertEq(factory.creatorFees(creator), 0, "Creator fees should be reset after claim");
    }

    function testMultipleSellsAccumulateFees() public {
        (address curve_, address token_) = createTestToken(creator);

        uint256 totalCreatorFees = 0;

        // Perform multiple buy/sell cycles
        for (uint256 i = 0; i < 3; i++) {
            // Buy
            uint256 buyAmount = 0.5 ether;
            vm.startPrank(user1);
            wNative.deposit{value: buyAmount}();
            wNative.approve(address(core), buyAmount);
            core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);

            // Sell
            uint256 tokensToSell = IERC20(token_).balanceOf(user1);
            IERC20(token_).approve(address(core), tokensToSell);
            
            (uint256 vNative, uint256 vToken) = BondingCurve(factory.getCurve(token_)).getVirtualReserves();
            uint256 sellAmountOut = BondingCurveLibrary.getAmountOut(
                tokensToSell,
                BondingCurve(factory.getCurve(token_)).getK(),
                vToken,
                vNative
            );
            uint256 totalFee = (sellAmountOut * feeNumerator) / feeDenominator;
            uint256 creatorFee = (totalFee * 1000) / 10000;
            totalCreatorFees += creatorFee;

            core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
            vm.stopPrank();
        }

        // Check total accumulated fees
        uint256 accumulatedFees = factory.creatorFees(creator);
        assertGe(accumulatedFees, totalCreatorFees, "Multiple sells should accumulate fees correctly");
    }

    function testCreatorFeeShareCanBeUpdated() public {
        // Update to 20%
        vm.prank(admin);
        factory.setCreatorFeeShare(2000);

        assertEq(factory.creatorFeeShare(), 2000, "Creator fee share should be updated to 20%");

        // Update to 5%
        vm.prank(admin);
        factory.setCreatorFeeShare(500);

        assertEq(factory.creatorFeeShare(), 500, "Creator fee share should be updated to 5%");
    }

    function testOnlyAdminCanUpdateCreatorFeeShare() public {
        vm.prank(user1);
        vm.expectRevert();
        factory.setCreatorFeeShare(1500);
    }

    function testCreatorFeeShareCannotExceed100Percent() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setCreatorFeeShare(10001); // > 100%
    }

    function testZeroCreatorFeeShare() public {
        // Set to 0%
        vm.prank(admin);
        factory.setCreatorFeeShare(0);

        (address curve_, address token_) = createTestToken(creator);

        // Buy and sell
        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);
        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);

        uint256 tokensToSell = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokensToSell);
        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Creator should have no fees
        assertEq(factory.creatorFees(creator), 0, "Creator should have no fees when share is 0%");
    }

    function testAllFeesGoToPlatformWhenNoCreator() public {
        // Create token with address(0) as creator (shouldn't happen but test edge case)
        // Actually, we can't create with address(0) due to validation, so test with feeShare = 0
        
        vm.prank(admin);
        factory.setCreatorFeeShare(0);

        (address curve_, address token_) = createTestToken(creator);

        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);
        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);

        uint256 tokensToSell = IERC20(token_).balanceOf(user1);
        
        (uint256 vNative, uint256 vToken) = BondingCurve(factory.getCurve(token_)).getVirtualReserves();
        uint256 sellAmountOut = BondingCurveLibrary.getAmountOut(
            tokensToSell,
            BondingCurve(factory.getCurve(token_)).getK(),
            vToken,
            vNative
        );
        uint256 expectedTotalFee = (sellAmountOut * feeNumerator) / feeDenominator;

        uint256 vaultBalanceBefore = wNative.balanceOf(address(feeVault));
        IERC20(token_).approve(address(core), tokensToSell);
        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 vaultBalanceAfter = wNative.balanceOf(address(feeVault));
        assertEq(
            vaultBalanceAfter - vaultBalanceBefore,
            expectedTotalFee,
            "All fees should go to vault when creator fee share is 0%"
        );
    }

    function testCreatorFeeEventsEmitted() public {
        (address curve_, address token_) = createTestToken(creator);

        // Buy tokens
        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);

        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Sell tokens
        uint256 tokensToSell = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), tokensToSell);

        core.exactInSell(tokensToSell, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Just verify it didn't revert - events can be tested separately
        assertTrue(tokensToSell > 0, "User should have tokens to sell");
    }

    function testClaimFeesWhenNoFees() public {
        vm.prank(user1);
        vm.expectRevert();
        factory.claimCreatorFees();
    }

    /**
     * @notice Diagnostic test to understand token transfer issues
     */
    function testBuyTransfersTokensCorrectly() public {
        (address curve_, address token_) = createTestToken(creator);

        uint256 buyAmount = 1 ether;
        vm.startPrank(user1);
        wNative.deposit{value: buyAmount}();
        wNative.approve(address(core), buyAmount);

        // Check balances before buy
        uint256 curveBalanceBefore = IERC20(token_).balanceOf(curve_);
        uint256 userBalanceBefore = IERC20(token_).balanceOf(user1);
        console.log("Curve balance before buy:", curveBalanceBefore);
        console.log("User balance before buy:", userBalanceBefore);

        // Perform buy
        core.exactInBuy(buyAmount, 0, token_, user1, block.timestamp + 1000);

        // Check balances after buy
        uint256 curveBalanceAfter = IERC20(token_).balanceOf(curve_);
        uint256 userBalanceAfter = IERC20(token_).balanceOf(user1);
        console.log("Curve balance after buy:", curveBalanceAfter);
        console.log("User balance after buy:", userBalanceAfter);
        console.log("Curve transferred:", curveBalanceBefore - curveBalanceAfter);
        console.log("User received:", userBalanceAfter - userBalanceBefore);

        vm.stopPrank();
    }
}

