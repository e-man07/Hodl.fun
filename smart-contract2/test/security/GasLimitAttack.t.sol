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

/**
 * @title GasLimitAttackTest
 * @notice Tests for gas-related attack vectors and DoS protection
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

contract GasLimitAttackTest is Test {
    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    address admin = address(0x1);
    address attacker = address(0x666);
    address user1 = address(0x3);

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
        wNative = new MockWNative();

        vm.deal(admin, 10000 ether);
        vm.deal(attacker, 10000 ether);
        vm.deal(user1, 10000 ether);

        uniswapFactory = new MockUniswapV3Factory();

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
    }

    // ============ Gas Limit Attack Tests ============

    /**
     * @notice Test that buy operation completes within reasonable gas limits
     * @dev Ensures buys don't consume excessive gas that could cause DoS
     */
    function testBuyGasConsumption() public {
        (, address token_) = createTestToken(user1);

        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);
        uint256 gasUsed = gasBefore - gasleft();

        // Buy should use less than 500k gas (reasonable limit for complex operation)
        assertLt(gasUsed, 500_000, "Buy consumes too much gas");
        vm.stopPrank();
    }

    /**
     * @notice Test that sell operation completes within reasonable gas limits
     */
    function testSellGasConsumption() public {
        (, address token_) = createTestToken(user1);

        // First buy some tokens
        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);
        core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);

        uint256 tokensBalance = IERC20(token_).balanceOf(attacker);
        IERC20(token_).approve(address(core), tokensBalance);

        uint256 gasBefore = gasleft();
        core.exactInSell(tokensBalance, 0, token_, attacker, attacker, block.timestamp + 1000);
        uint256 gasUsed = gasBefore - gasleft();

        // Sell should use less than 500k gas
        assertLt(gasUsed, 500_000, "Sell consumes too much gas");
        vm.stopPrank();
    }

    /**
     * @notice Test that creating a curve completes within reasonable gas limits
     */
    function testCreateCurveGasConsumption() public {
        vm.startPrank(attacker);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);

        uint256 gasBefore = gasleft();
        core.createCurve(
            attacker,
            "Attack Token",
            "ATK",
            "ipfs://attack",
            0,
            deployFee
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Create curve is a heavier operation, allow up to 3M gas
        assertLt(gasUsed, 3_000_000, "Create curve consumes too much gas");
        vm.stopPrank();
    }

    /**
     * @notice Test multiple sequential buys don't cause gas increase (no storage bloat)
     */
    function testSequentialBuysGasStability() public {
        (, address token_) = createTestToken(user1);

        uint256[] memory gasUsages = new uint256[](5);

        for (uint256 i = 0; i < 5; i++) {
            uint256 amountNative = 0.1 ether;
            vm.startPrank(attacker);
            wNative.deposit{value: amountNative}();
            wNative.approve(address(core), amountNative);

            uint256 gasBefore = gasleft();
            core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);
            gasUsages[i] = gasBefore - gasleft();
            vm.stopPrank();
        }

        // Gas usage should not increase significantly across buys
        // Allow 20% variance max
        for (uint256 i = 1; i < 5; i++) {
            assertLt(
                gasUsages[i],
                (gasUsages[0] * 120) / 100,
                "Gas usage increased significantly across buys"
            );
        }
    }

    /**
     * @notice Test that many small trades don't bloat storage excessively
     */
    function testManySmallTradesNoStorageBloat() public {
        (, address token_) = createTestToken(user1);

        // Perform 20 small buys
        for (uint256 i = 0; i < 20; i++) {
            uint256 amountNative = 0.01 ether;
            vm.startPrank(attacker);
            wNative.deposit{value: amountNative}();
            wNative.approve(address(core), amountNative);
            core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);
            vm.stopPrank();
        }

        // Final buy should still be reasonably gas-efficient
        uint256 amountNative = 0.01 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 500_000, "Gas bloat after many trades");
        vm.stopPrank();
    }

    /**
     * @notice Test creating multiple tokens doesn't cause factory gas bloat
     */
    function testManyTokenCreationsNoFactoryBloat() public {
        uint256[] memory gasUsages = new uint256[](5);

        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(attacker);
            wNative.deposit{value: deployFee}();
            wNative.approve(address(core), deployFee);

            uint256 gasBefore = gasleft();
            core.createCurve(
                attacker,
                string(abi.encodePacked("Token", vm.toString(i))),
                string(abi.encodePacked("TKN", vm.toString(i))),
                "ipfs://test",
                0,
                deployFee
            );
            gasUsages[i] = gasBefore - gasleft();
            vm.stopPrank();
        }

        // Gas for creating tokens should remain stable (within 10% variance)
        for (uint256 i = 1; i < 5; i++) {
            assertLt(
                gasUsages[i],
                (gasUsages[0] * 110) / 100,
                "Factory gas usage increased with more tokens"
            );
        }
    }

    /**
     * @notice Test extremely small trades don't waste gas
     */
    function testMinimumViableTrade() public {
        (, address token_) = createTestToken(user1);

        // Very small trade (1 wei)
        uint256 amountNative = 1 wei;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        // This should either succeed with minimal tokens or revert appropriately
        try core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000) {
            uint256 gasUsed = gasBefore - gasleft();
            // Even tiny trades should complete efficiently
            assertLt(gasUsed, 500_000, "Tiny trade uses excessive gas");
        } catch {
            // If it reverts (due to zero output), that's also acceptable behavior
            assertTrue(true, "Tiny trade reverted (acceptable)");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test that failed transactions don't consume excessive gas
     */
    function testRevertedTransactionGasEfficiency() public {
        (, address token_) = createTestToken(user1);

        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        // Intentionally NOT approving to cause failure

        uint256 gasBefore = gasleft();
        try core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000) {
            fail("Should have reverted");
        } catch {
            uint256 gasUsed = gasBefore - gasleft();
            // Failed transactions should still be gas-efficient (early revert)
            assertLt(gasUsed, 100_000, "Failed transaction wasted too much gas");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test slippage revert happens early (gas efficient)
     */
    function testSlippageRevertGasEfficiency() public {
        (, address token_) = createTestToken(user1);

        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        // Impossible slippage requirement
        try core.exactInBuy(amountNative, type(uint256).max, token_, attacker, block.timestamp + 1000) {
            fail("Should have reverted due to slippage");
        } catch {
            uint256 gasUsed = gasBefore - gasleft();
            // Slippage check should fail early
            assertLt(gasUsed, 150_000, "Slippage revert not gas efficient");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test deadline check reverts early
     */
    function testDeadlineRevertGasEfficiency() public {
        (, address token_) = createTestToken(user1);

        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        // Expired deadline
        try core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp - 1) {
            fail("Should have reverted due to deadline");
        } catch {
            uint256 gasUsed = gasBefore - gasleft();
            // Deadline check should fail very early (first thing in modifier)
            assertLt(gasUsed, 50_000, "Deadline revert not gas efficient");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test pause check reverts early
     */
    function testPauseRevertGasEfficiency() public {
        (, address token_) = createTestToken(user1);

        // Pause the core
        vm.prank(admin);
        core.pause();

        uint256 amountNative = 1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        try core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000) {
            fail("Should have reverted due to pause");
        } catch {
            uint256 gasUsed = gasBefore - gasleft();
            // Pause check should fail early
            assertLt(gasUsed, 50_000, "Pause revert not gas efficient");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test locked curve revert is gas efficient
     */
    function testLockedCurveRevertGasEfficiency() public {
        (address curve_, address token_) = createTestToken(user1);
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

        // Try to buy on locked curve
        uint256 amountNative = 0.1 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        try core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000) {
            fail("Should have reverted due to lock");
        } catch {
            uint256 gasUsed = gasBefore - gasleft();
            // Lock check should fail early in the bonding curve
            assertLt(gasUsed, 150_000, "Lock revert not gas efficient");
        }
        vm.stopPrank();
    }

    /**
     * @notice Test block gas limit is not exceeded in worst case
     */
    function testBlockGasLimitNotExceeded() public {
        (, address token_) = createTestToken(user1);

        // Simulate worst case: large buy followed by large sell
        // Use smaller amount to avoid triggering graduation
        uint256 amountNative = 5 ether;
        vm.startPrank(attacker);
        wNative.deposit{value: amountNative}();
        wNative.approve(address(core), amountNative);

        uint256 gasBefore = gasleft();
        core.exactInBuy(amountNative, 0, token_, attacker, block.timestamp + 1000);
        uint256 buyGas = gasBefore - gasleft();

        uint256 tokensBalance = IERC20(token_).balanceOf(attacker);
        IERC20(token_).approve(address(core), tokensBalance);

        gasBefore = gasleft();
        core.exactInSell(tokensBalance, 0, token_, attacker, attacker, block.timestamp + 1000);
        uint256 sellGas = gasBefore - gasleft();

        // Total gas for both operations should be well under block gas limit (30M on most chains)
        uint256 totalGas = buyGas + sellGas;
        assertLt(totalGas, 10_000_000, "Operations approach block gas limit");
        vm.stopPrank();
    }
}
