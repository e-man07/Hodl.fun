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
import "../../src/interfaces/ICore.sol";

/**
 * @title CoreExtendedTest
 * @notice Extended tests for Core.sol covering setters and edge cases
 */
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

contract CoreExtendedTest is Test {
    MockWNative wNative;
    MockWNative wNative2; // Second wNative for testing setWNative
    FeeVault feeVault;
    FeeVault feeVault2; // Second vault for testing setVault
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address creator = address(0x2);
    address user1 = address(0x3);

    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 1 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 10_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    function setUp() public {
        wNative = new MockWNative();
        wNative2 = new MockWNative();

        vm.deal(admin, 1000 ether);
        vm.deal(creator, 1000 ether);
        vm.deal(user1, 1000 ether);

        uniswapFactory = new MockUniswapV3Factory();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));
        feeVault2 = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

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

        feeVault2.initialize(
            address(wNative),
            "Fee Vault 2",
            "FEEVAULT2",
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

    // ============ Test: setWNative ============

    function testSetWNativeByAdmin() public {
        vm.prank(admin);
        core.setWNative(address(wNative2));

        assertEq(core.wNative(), address(wNative2), "wNative should be updated");
    }

    function testSetWNativeEmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit ICore.SetWNative(address(wNative), address(wNative2));
        core.setWNative(address(wNative2));
    }

    function testSetWNativeByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        core.setWNative(address(wNative2));
    }

    function testSetWNativeZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.setWNative(address(0));
    }

    // ============ Test: setVault ============

    function testSetVaultByAdmin() public {
        vm.prank(admin);
        core.setVault(address(feeVault2));

        assertEq(core.vault(), address(feeVault2), "vault should be updated");
    }

    function testSetVaultEmitsEvent() public {
        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit ICore.SetVault(address(feeVault), address(feeVault2));
        core.setVault(address(feeVault2));
    }

    function testSetVaultByNonAdminReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        core.setVault(address(feeVault2));
    }

    function testSetVaultZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.setVault(address(0));
    }

    // ============ Test: wNative and vault getters ============

    function testWNativeGetter() public view {
        assertEq(core.wNative(), address(wNative), "wNative getter should return correct address");
    }

    function testVaultGetter() public view {
        assertEq(core.vault(), address(feeVault), "vault getter should return correct address");
    }

    function testGetFeeVault() public view {
        assertEq(core.getFeeVault(), address(feeVault), "getFeeVault should return correct address");
    }

    // ============ Test: Trading after changing wNative ============

    function testTradingAfterChangingWNative() public {
        // First create a token with original wNative
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (address curve_, address token_) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Change wNative (in practice, you'd need to migrate funds too)
        // This test just verifies the setter works and doesn't break things
        vm.prank(admin);
        core.setWNative(address(wNative2));

        // Verify the new wNative is being used
        assertEq(core.wNative(), address(wNative2));
    }

    // ============ Test: Fee distribution after changing vault ============

    function testFeeDistributionAfterChangingVault() public {
        // Create token
        vm.startPrank(creator);
        wNative.deposit{value: deployFee + 1 ether}();
        wNative.approve(address(core), deployFee + 1 ether);
        (, address token_) = core.createCurve(
            creator,
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Record initial vault balance
        uint256 vault1BalanceBefore = wNative.balanceOf(address(feeVault));

        // Change vault
        vm.prank(admin);
        core.setVault(address(feeVault2));

        // Create another token - fee should go to new vault
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        core.createCurve(
            creator,
            "Test Token 2",
            "TEST2",
            "ipfs://test2",
            0,
            deployFee
        );
        vm.stopPrank();

        // Check that fees went to the new vault
        uint256 vault2Balance = wNative.balanceOf(address(feeVault2));
        assertEq(vault2Balance, deployFee, "Fees should go to new vault");
    }

    // ============ Test: Multiple setter changes ============

    function testMultipleWNativeChanges() public {
        MockWNative wNative3 = new MockWNative();

        vm.startPrank(admin);
        core.setWNative(address(wNative2));
        assertEq(core.wNative(), address(wNative2));

        core.setWNative(address(wNative3));
        assertEq(core.wNative(), address(wNative3));

        // Change back to original
        core.setWNative(address(wNative));
        assertEq(core.wNative(), address(wNative));
        vm.stopPrank();
    }

    function testMultipleVaultChanges() public {
        FeeVault feeVaultImpl = new FeeVault();
        FeeVault feeVault3 = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        vm.startPrank(admin);
        feeVault3.initialize(
            address(wNative),
            "Fee Vault 3",
            "FEEVAULT3",
            address(core),
            admin
        );

        core.setVault(address(feeVault2));
        assertEq(core.vault(), address(feeVault2));

        core.setVault(address(feeVault3));
        assertEq(core.vault(), address(feeVault3));

        // Change back to original
        core.setVault(address(feeVault));
        assertEq(core.vault(), address(feeVault));
        vm.stopPrank();
    }

    // ============ Test: Edge cases ============

    function testCalculateMarketCapInvalidToken() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.calculateMarketCap(address(0));
    }

    function testCalculateMarketCapNonExistentToken() public {
        vm.expectRevert(Core.InvalidAddress.selector);
        core.calculateMarketCap(address(0x999));
    }

    function testCreateCurveWithZeroCreator() public {
        vm.startPrank(user1);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.createCurve(
            address(0),
            "Test Token",
            "TEST",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();
    }

    function testExactInBuyWithZeroTo() public {
        // Create token first
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

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInBuy(1 ether, 0, token_, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactInSellWithZeroFrom() public {
        // Create token first
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

        vm.startPrank(user1);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactInSell(1e18, 0, token_, address(0), user1, block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutBuyWithZeroTo() public {
        // Create token first
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

        vm.startPrank(user1);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactOutBuy(1e18, 1 ether, token_, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }

    function testExactOutSellWithZeroTo() public {
        // Create token first
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

        vm.startPrank(user1);
        vm.expectRevert(Core.InvalidAddress.selector);
        core.exactOutSell(1e18, 1e18, token_, user1, address(0), block.timestamp + 1000);
        vm.stopPrank();
    }
}
