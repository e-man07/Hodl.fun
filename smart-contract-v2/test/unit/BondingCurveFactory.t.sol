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
import "../../src/interfaces/IBondingCurveFactory.sol";

contract MockWNativeFactory is ERC20 {
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

contract MockUniswapV3FactoryTest {
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

contract BondingCurveFactoryTest is Test {
    MockWNativeFactory wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3FactoryTest uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);
    address nonAdmin = address(0x4);

    // Configuration
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 10_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    function setUp() public {
        wNative = new MockWNativeFactory();

        vm.deal(admin, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(user1, 1000 ether);

        uniswapFactory = new MockUniswapV3FactoryTest();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        bytes memory initData = abi.encodeWithSelector(
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

    // ============ Test: Initialization ============

    function testInitialization() public view {
        assertEq(factory.getDeployFee(), deployFee);
        assertEq(factory.getListingFee(), listingFee);
        IBondingCurveFactory.Config memory config = factory.getConfig();
        assertEq(config.graduationMarketCap, graduationMarketCap);
        assertEq(factory.getDexFactory(), address(uniswapFactory));
        assertEq(factory.getDexFee(), dexFee);
        assertEq(factory.getCore(), address(core));
    }

    function testCannotReinitialize() public {
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

        vm.expectRevert();
        factory.initialize(params);
    }

    // ============ Test: Setter Functions ============

    function testSetDeployFee() public {
        uint256 newFee = 0.5 ether;

        vm.prank(admin);
        factory.setDeployFee(newFee);

        assertEq(factory.getDeployFee(), newFee);
    }

    function testSetDeployFeeByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setDeployFee(0.5 ether);
    }

    function testSetListingFee() public {
        uint256 newFee = 2 ether;

        vm.prank(admin);
        factory.setListingFee(newFee);

        assertEq(factory.getListingFee(), newFee);
    }

    function testSetListingFeeByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setListingFee(2 ether);
    }

    function testSetVirtualReserves() public {
        uint256 newVirtualNative = 10 ether;
        uint256 newVirtualToken = 500_000 * 1e18;

        vm.prank(admin);
        factory.setVirtualReserves(newVirtualNative, newVirtualToken);

        IBondingCurveFactory.Config memory config = factory.getConfig();
        assertEq(config.virtualNative, newVirtualNative);
        assertEq(config.virtualToken, newVirtualToken);
        assertEq(config.k, newVirtualNative * newVirtualToken);
    }

    function testSetVirtualReservesZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setVirtualReserves(0, virtualToken);

        vm.prank(admin);
        vm.expectRevert();
        factory.setVirtualReserves(virtualNative, 0);
    }

    function testSetVirtualReservesByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setVirtualReserves(10 ether, 500_000 * 1e18);
    }

    function testSetFeeConfig() public {
        uint8 newDenominator = 100;
        uint16 newNumerator = 2; // 2%

        vm.prank(admin);
        factory.setFeeConfig(newDenominator, newNumerator);

        IBondingCurveFactory.Config memory config = factory.getConfig();
        assertEq(config.feeDenominator, newDenominator);
        assertEq(config.feeNumerator, newNumerator);
    }

    function testSetFeeConfigZeroDenominatorReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setFeeConfig(0, 1);
    }

    function testSetFeeConfigNumeratorTooHighReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setFeeConfig(100, 100); // numerator must be < denominator
    }

    function testSetFeeConfigByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setFeeConfig(100, 2);
    }

    function testSetGraduationMarketCap() public {
        uint256 newMarketCap = 50_000 ether;

        vm.prank(admin);
        factory.setGraduationMarketCap(newMarketCap);

        IBondingCurveFactory.Config memory config = factory.getConfig();
        assertEq(config.graduationMarketCap, newMarketCap);
    }

    function testSetGraduationMarketCapByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setGraduationMarketCap(50_000 ether);
    }

    function testSetDexFactory() public {
        address newDexFactory = address(0x123);

        vm.prank(admin);
        factory.setDexFactory(newDexFactory);

        assertEq(factory.getDexFactory(), newDexFactory);
    }

    function testSetDexFactoryZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setDexFactory(address(0));
    }

    function testSetDexFactoryByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setDexFactory(address(0x123));
    }

    function testSetDexFee() public {
        uint24 newDexFee = 500; // 0.05%

        vm.prank(admin);
        factory.setDexFee(newDexFee);

        assertEq(factory.getDexFee(), newDexFee);
    }

    function testSetDexFeeByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setDexFee(500);
    }

    function testSetCreatorFeeShare() public {
        uint16 newShare = 2000; // 20%

        vm.prank(admin);
        factory.setCreatorFeeShare(newShare);

        assertEq(factory.getCreatorFeeShare(), newShare);
    }

    function testSetCreatorFeeShareTooHighReverts() public {
        vm.prank(admin);
        vm.expectRevert();
        factory.setCreatorFeeShare(10001); // > 100%
    }

    function testSetCreatorFeeShareByNonAdminReverts() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        factory.setCreatorFeeShare(2000);
    }

    // ============ Test: Token Creation ============

    function testCreateToken() public {
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        (address curve, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        assertTrue(curve != address(0), "Curve should be created");
        assertTrue(token != address(0), "Token should be created");
        assertEq(factory.getCurve(token), curve, "Curve mapping should be set");
        assertEq(factory.getCreator(token), creator, "Creator should be set");
    }

    function testCreateMultipleTokens() public {
        // Create first token
        vm.startPrank(creator);
        wNative.deposit{value: deployFee * 2}();
        wNative.approve(address(core), deployFee * 2);

        (address curve1, address token1) = core.createCurve(
            creator,
            "Test Token 1",
            "TEST1",
            "ipfs://test1",
            0,
            deployFee
        );

        (address curve2, address token2) = core.createCurve(
            creator,
            "Test Token 2",
            "TEST2",
            "ipfs://test2",
            0,
            deployFee
        );
        vm.stopPrank();

        assertTrue(curve1 != curve2, "Curves should be different");
        assertTrue(token1 != token2, "Tokens should be different");
        assertEq(factory.getCurve(token1), curve1);
        assertEq(factory.getCurve(token2), curve2);
    }

    // ============ Test: Creator Fee Claiming ============

    function testCreatorCanClaimFees() public {
        // Create token
        vm.startPrank(creator);
        wNative.deposit{value: deployFee + 10 ether}();
        wNative.approve(address(core), deployFee + 10 ether);

        (, address token) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // User buys tokens
        vm.startPrank(user1);
        wNative.deposit{value: 5 ether}();
        wNative.approve(address(core), 5 ether);
        core.exactInBuy(5 ether, 0, token, user1, block.timestamp + 1000);

        // User sells tokens
        uint256 tokenBalance = IERC20(token).balanceOf(user1);
        IERC20(token).approve(address(core), tokenBalance);
        core.exactInSell(tokenBalance, 0, token, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Check creator has fees
        uint256 creatorFees = factory.creatorFees(creator);
        assertGt(creatorFees, 0, "Creator should have accumulated fees");

        // Creator claims fees
        uint256 creatorBalanceBefore = wNative.balanceOf(creator);
        vm.prank(creator);
        factory.claimCreatorFees();
        uint256 creatorBalanceAfter = wNative.balanceOf(creator);

        assertEq(creatorBalanceAfter - creatorBalanceBefore, creatorFees, "Creator should receive fees");
        assertEq(factory.creatorFees(creator), 0, "Creator fees should be reset");
    }

    function testClaimFeesWhenNoFeesReverts() public {
        vm.prank(creator);
        vm.expectRevert(); // NoFeesToClaim error
        factory.claimCreatorFees();
    }

    // ============ Test: Role Constants ============

    function testCoreRoleConstant() public view {
        bytes32 expectedRole = keccak256("CORE_ROLE");
        assertEq(factory.CORE_ROLE(), expectedRole);
    }

    // ============ Test: Events ============

    function testSetDeployFeeEmitsEvent() public {
        uint256 newFee = 0.5 ether;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetDeployFee(deployFee, newFee);
        factory.setDeployFee(newFee);
    }

    function testSetListingFeeEmitsEvent() public {
        uint256 newFee = 2 ether;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetListingFee(listingFee, newFee);
        factory.setListingFee(newFee);
    }

    function testSetVirtualReservesEmitsEvent() public {
        uint256 newVirtualNative = 10 ether;
        uint256 newVirtualToken = 500_000 * 1e18;
        uint256 newK = newVirtualNative * newVirtualToken;

        vm.prank(admin);
        vm.expectEmit(true, true, true, false);
        emit IBondingCurveFactory.SetVirtualReserves(newVirtualNative, newVirtualToken, newK);
        factory.setVirtualReserves(newVirtualNative, newVirtualToken);
    }

    function testSetFeeConfigEmitsEvent() public {
        uint8 newDenominator = 100;
        uint16 newNumerator = 2;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetFeeConfig(newDenominator, newNumerator);
        factory.setFeeConfig(newDenominator, newNumerator);
    }

    function testSetGraduationMarketCapEmitsEvent() public {
        uint256 newMarketCap = 50_000 ether;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetGraduationMarketCap(graduationMarketCap, newMarketCap);
        factory.setGraduationMarketCap(newMarketCap);
    }

    function testSetDexFactoryEmitsEvent() public {
        address newDexFactory = address(0x123);

        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit IBondingCurveFactory.SetDexFactory(newDexFactory);
        factory.setDexFactory(newDexFactory);
    }

    function testSetDexFeeEmitsEvent() public {
        uint24 newDexFee = 500;

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetDexFee(dexFee, newDexFee);
        factory.setDexFee(newDexFee);
    }

    function testSetCreatorFeeShareEmitsEvent() public {
        uint16 newShare = 2000;
        uint16 oldShare = factory.getCreatorFeeShare();

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit IBondingCurveFactory.SetCreatorFeeShare(oldShare, newShare);
        factory.setCreatorFeeShare(newShare);
    }
}
