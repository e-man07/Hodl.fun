// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/FeeVault.sol";
import "../../src/WPUSH.sol";
import "../../src/UniswapV3Factory.sol";
import "../../src/interfaces/IBondingCurveFactory.sol";

/**
 * @title CoreBranchCoverageTest
 * @notice Tests targeting uncovered branches in Core.sol
 */
contract CoreBranchCoverageTest is Test {
    WPUSH wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    UniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);

    uint256 deployFee = 0.01 ether;

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

        // Initialize with factory = address(0) to test that branch
        initData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // factory is zero!
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
            listingFee: 0.1 ether,
            virtualNative: 1 ether,
            virtualToken: 50_000_000 * 1e18,
            graduationMarketCap: 100 ether,
            feeDenominator: 100,
            feeNumerator: 1,
            dexFactory: address(uniswapFactory),
            dexFee: 3000
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

    // Test initialize with factory = address(0)
    // This was done in setUp() above

    // Test createCurve with msg.value = 0 but using approved wNative
    function testCreateCurve_WithoutNativeValue() public {
        vm.startPrank(creator);
        // Deposit and approve WETH manually
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Create curve with amountIn but NO msg.value (tests msg.value == 0 branch)
        (address curve_, address token_) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0.5 ether, // Initial buy
            deployFee
        );

        assertTrue(curve_ != address(0));
        assertTrue(token_ != address(0));
        vm.stopPrank();
    }

    // Test setWNative function
    function testSetWNative() public {
        WPUSH newWNative = new WPUSH();

        vm.prank(admin);
        core.setWNative(address(newWNative));

        assertEq(core.wNative(), address(newWNative));
    }

    function testSetWNative_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.setWNative(address(0));
    }

    // Test setVault function
    function testSetVault() public {
        FeeVault newVault = new FeeVault();

        vm.prank(admin);
        core.setVault(address(newVault));

        assertEq(core.vault(), address(newVault));
    }

    function testSetVault_ZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.setVault(address(0));
    }

    // Test createCurve with invalid creator address
    function testCreateCurve_InvalidCreator() public {
        vm.startPrank(user1);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.createCurve(
            address(0), // Invalid creator
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    // Test createCurve with insufficient fee
    function testCreateCurve_InsufficientFee() public {
        vm.startPrank(creator);
        wNative.deposit{value: 0.001 ether}();
        wNative.approve(address(core), 0.001 ether);

        vm.expectRevert(Core.InvalidFee.selector);
        core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            0.001 ether // Less than deployFee
        );
        vm.stopPrank();
    }

    // Test pause/unpause
    function testPause() public {
        vm.prank(admin);
        core.pause();

        assertTrue(core.paused());

        // createCurve should fail when paused
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        vm.expectRevert("Pausable: paused");
        core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    function testUnpause() public {
        vm.startPrank(admin);
        core.pause();
        core.unpause();
        vm.stopPrank();

        assertFalse(core.paused());
    }

    // Test getFeeVault
    function testGetFeeVault() public {
        assertEq(core.getFeeVault(), address(feeVault));
    }
}

/**
 * @title CoreNotInitializedTest
 * @notice Test the NotInitialized branch by creating Core without initializing
 */
contract CoreNotInitializedTest is Test {
    WPUSH wNative;
    FeeVault feeVault;

    function setUp() public {
        wNative = new WPUSH();
        feeVault = new FeeVault();
    }

    // This test is tricky because the proxy forces initialization
    // The NotInitialized branch can only be triggered in specific scenarios
    // Let's test it by checking we can't call functions before setFactory is called
    function testCore_FactoryRequired() public {
        Core coreImpl = new Core(address(wNative), address(feeVault));

        // Initialize with factory = address(0)
        bytes memory initData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0),
            address(this)
        );
        Core core = Core(address(new ERC1967Proxy(address(coreImpl), initData)));

        // Try to create curve without setting factory - will fail due to factory being 0
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // This should revert because factory is address(0)
        vm.expectRevert();
        core.createCurve(
            address(this),
            "Test",
            "TEST",
            "uri",
            0,
            0.01 ether
        );
    }

    receive() external payable {}
}
