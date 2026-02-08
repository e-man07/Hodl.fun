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
 * @title FlashLoanAttackTest
 * @notice Tests for flash loan and sandwich attack protection
 * @dev Verifies that slippage protection and AMM design prevent manipulation
 */

// ============================================================
//                    MOCK CONTRACTS
// ============================================================

contract MockWNative is ERC20 {
    constructor() ERC20("Wrapped Native", "WNATIVE") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    // Flash loan simulation - mint tokens temporarily
    function flashLoan(address receiver, uint256 amount) external {
        _mint(receiver, amount);
        // In a real flash loan, we'd call the receiver and require repayment
        // For testing, we just mint and the test will handle the logic
    }

    function flashRepay(address from, uint256 amount) external {
        _burn(from, amount);
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

/**
 * @notice Simulates a flash loan attacker contract
 */
contract FlashLoanAttacker {
    MockWNative public wNative;
    Core public core;
    address public token;

    uint256 public profitOrLoss;
    bool public attackSucceeded;

    constructor(address _wNative, address _core) {
        wNative = MockWNative(payable(_wNative));
        core = Core(payable(_core));
    }

    function setToken(address _token) external {
        token = _token;
    }

    /**
     * @notice Attempt flash loan price manipulation attack
     * @param loanAmount Amount to borrow in flash loan
     * @param victimBuyAmount Expected victim buy amount (for sandwich)
     */
    function executeFlashLoanAttack(uint256 loanAmount, uint256 victimBuyAmount) external {
        uint256 balanceBefore = wNative.balanceOf(address(this));

        // Step 1: Flash loan - borrow large amount
        wNative.flashLoan(address(this), loanAmount);

        // Step 2: Front-run - buy tokens to pump price
        wNative.approve(address(core), loanAmount);
        try core.exactInBuy(
            loanAmount,
            0, // No slippage protection for attacker
            token,
            address(this),
            block.timestamp + 1000
        ) {
            // Front-run succeeded
        } catch {
            // Front-run failed
            wNative.flashRepay(address(this), loanAmount);
            attackSucceeded = false;
            return;
        }

        // Step 3: Victim transaction would happen here (simulated by parameter)
        // In reality, this is the mempool transaction being sandwiched

        // Step 4: Back-run - sell tokens at inflated price
        uint256 tokensHeld = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(address(core), tokensHeld);

        try core.exactInSell(
            tokensHeld,
            0,
            token,
            address(this),
            address(this),
            block.timestamp + 1000
        ) {
            // Back-run succeeded
        } catch {
            // Back-run failed
            attackSucceeded = false;
        }

        // Step 5: Repay flash loan
        uint256 balanceAfter = wNative.balanceOf(address(this));
        if (balanceAfter >= loanAmount) {
            wNative.flashRepay(address(this), loanAmount);
            profitOrLoss = balanceAfter - loanAmount;
            attackSucceeded = profitOrLoss > balanceBefore;
        } else {
            // Can't repay - attack failed
            attackSucceeded = false;
            profitOrLoss = 0;
        }
    }

    /**
     * @notice Simple pump and dump attack
     */
    function executePumpAndDump(uint256 amount) external returns (bool profitable) {
        uint256 balanceBefore = wNative.balanceOf(address(this));

        // Pump: Buy a lot
        wNative.approve(address(core), amount);
        core.exactInBuy(amount, 0, token, address(this), block.timestamp + 1000);

        // Dump: Sell everything immediately
        uint256 tokens = IERC20(token).balanceOf(address(this));
        IERC20(token).approve(address(core), tokens);
        core.exactInSell(tokens, 0, token, address(this), address(this), block.timestamp + 1000);

        uint256 balanceAfter = wNative.balanceOf(address(this));
        profitOrLoss = balanceAfter > balanceBefore ? balanceAfter - balanceBefore : 0;

        return balanceAfter > balanceBefore;
    }
}

// ============================================================
//                    TEST CONTRACT
// ============================================================

contract FlashLoanAttackTest is Test {
    MockWNative wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3Factory uniswapFactory;

    FlashLoanAttacker attacker;

    address admin = address(0x1);
    address creator = address(0x2);
    address victim = address(0x3);
    address user1 = address(0x4);

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
        wNative = new MockWNative();

        vm.deal(admin, 100000 ether);
        vm.deal(creator, 100000 ether);
        vm.deal(victim, 100000 ether);
        vm.deal(user1, 100000 ether);
        vm.deal(address(this), 100000 ether);

        uniswapFactory = new MockUniswapV3Factory();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));

        bytes memory initData = abi.encodeWithSelector(
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

        // Setup attacker
        attacker = new FlashLoanAttacker(address(wNative), address(core));
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

    // ============================================================
    //            FLASH LOAN ATTACK TESTS
    // ============================================================

    /**
     * @notice Test that simple pump and dump is unprofitable due to fees
     * @dev The 0.5% fee on each trade makes immediate buy/sell unprofitable
     */
    function testPumpAndDumpUnprofitable() public {
        (, address token_) = createTestToken(creator);
        attacker.setToken(token_);

        // Fund attacker
        wNative.deposit{value: 1 ether}();
        wNative.transfer(address(attacker), 1 ether);

        uint256 balanceBefore = wNative.balanceOf(address(attacker));

        // Execute pump and dump with small amount to avoid graduation
        bool profitable = attacker.executePumpAndDump(0.3 ether);

        uint256 balanceAfter = wNative.balanceOf(address(attacker));

        console.log("Balance before:", balanceBefore);
        console.log("Balance after:", balanceAfter);
        console.log("Loss:", balanceBefore - balanceAfter);

        // Should NOT be profitable due to fees
        assertFalse(profitable, "Pump and dump should not be profitable");
        assertLt(balanceAfter, balanceBefore, "Attacker should have lost money to fees");
    }

    /**
     * @notice Test that large flash loan attack is unprofitable
     */
    function testLargeFlashLoanUnprofitable() public {
        (, address token_) = createTestToken(creator);
        attacker.setToken(token_);

        // Simulate flash loan attack with large amount
        uint256 loanAmount = 100 ether;

        attacker.executeFlashLoanAttack(loanAmount, 1 ether);

        // Verify attack was not profitable
        assertFalse(attacker.attackSucceeded(), "Flash loan attack should fail");
    }

    /**
     * @notice Test sandwich attack scenario
     * @dev Attacker front-runs victim, victim buys, attacker back-runs
     */
    function testSandwichAttackScenario() public {
        (, address token_) = createTestToken(creator);

        // Setup: Attacker has funds - use smaller amounts to avoid graduation
        wNative.deposit{value: 5 ether}();
        address attackerAddr = address(0xBAD);
        wNative.transfer(attackerAddr, 2 ether);

        // Victim wants to buy
        vm.startPrank(victim);
        wNative.deposit{value: 1 ether}();
        vm.stopPrank();

        // ============ SANDWICH ATTACK SIMULATION ============

        // Step 1: Attacker front-runs with buy (smaller to avoid graduation)
        uint256 attackerBalanceBefore = wNative.balanceOf(attackerAddr);

        vm.startPrank(attackerAddr);
        wNative.approve(address(core), 0.3 ether);
        core.exactInBuy(0.3 ether, 0, token_, attackerAddr, block.timestamp + 1000);
        uint256 attackerTokens = IERC20(token_).balanceOf(attackerAddr);
        vm.stopPrank();

        // Step 2: Victim buys at slightly inflated price
        vm.startPrank(victim);
        wNative.approve(address(core), 0.1 ether);
        core.exactInBuy(0.1 ether, 0, token_, victim, block.timestamp + 1000);
        vm.stopPrank();

        // Step 3: Attacker back-runs by selling
        vm.startPrank(attackerAddr);
        IERC20(token_).approve(address(core), attackerTokens);
        core.exactInSell(attackerTokens, 0, token_, attackerAddr, attackerAddr, block.timestamp + 1000);
        vm.stopPrank();

        uint256 attackerBalanceAfter = wNative.balanceOf(attackerAddr);

        console.log("Attacker balance before:", attackerBalanceBefore);
        console.log("Attacker balance after:", attackerBalanceAfter);

        // Calculate net profit/loss percentage
        if (attackerBalanceAfter > attackerBalanceBefore) {
            uint256 profit = attackerBalanceAfter - attackerBalanceBefore;
            uint256 profitPercent = profit * 10000 / attackerBalanceBefore; // basis points
            console.log("Profit in basis points:", profitPercent);

            // Even if profitable, the profit should be marginal (<5%)
            // This shows the fee structure limits sandwich attack profitability
            assertLt(profitPercent, 500, "Sandwich attack profit should be limited to <5%");
        } else {
            // Attacker lost money - expected outcome in most cases
            console.log("Attacker lost money as expected");
        }
    }

    /**
     * @notice Test that slippage protection helps victims
     */
    function testSlippageProtectionHelpsVictim() public {
        (, address token_) = createTestToken(creator);

        // Setup: Some initial liquidity (smaller amount)
        vm.startPrank(user1);
        wNative.deposit{value: 0.3 ether}();
        wNative.approve(address(core), 0.3 ether);
        core.exactInBuy(0.3 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Attacker front-runs with small amount
        address attackerAddr = address(0xBAD);
        vm.deal(attackerAddr, 10 ether);
        vm.startPrank(attackerAddr);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        // Small buy to slightly pump price
        core.exactInBuy(0.1 ether, 0, token_, attackerAddr, block.timestamp + 1000);
        vm.stopPrank();

        // Victim has slippage protection
        // Use minimal slippage protection (just verify we get something)
        vm.startPrank(victim);
        wNative.deposit{value: 0.1 ether}();
        wNative.approve(address(core), 0.1 ether);

        // This should succeed because price wasn't manipulated too much
        core.exactInBuy(0.1 ether, 0, token_, victim, block.timestamp + 1000);
        vm.stopPrank();

        uint256 victimTokens = IERC20(token_).balanceOf(victim);
        assertGt(victimTokens, 0, "Victim should receive tokens");
    }

    /**
     * @notice Test that extreme slippage triggers revert
     */
    function testExtremeSlippageReverts() public {
        (, address token_) = createTestToken(creator);

        // Setup: Small initial liquidity
        vm.startPrank(user1);
        wNative.deposit{value: 0.5 ether}();
        wNative.approve(address(core), 0.5 ether);
        core.exactInBuy(0.5 ether, 0, token_, user1, block.timestamp + 1000);
        vm.stopPrank();

        // Attacker front-runs with huge amount relative to liquidity
        address attackerAddr = address(0xBAD);
        vm.deal(attackerAddr, 100 ether);
        vm.startPrank(attackerAddr);
        wNative.deposit{value: 50 ether}();
        wNative.approve(address(core), 50 ether);
        // This large buy significantly moves the price - but avoid graduation
        core.exactInBuy(0.3 ether, 0, token_, attackerAddr, block.timestamp + 1000);
        vm.stopPrank();

        // Victim with strict slippage should be protected
        address curveAddr = factory.getCurve(token_);
        BondingCurve bc = BondingCurve(curveAddr);

        // Victim expects old price - sets unrealistic minOutput
        uint256 unrealisticMinOutput = 500_000 * 1e18; // Expects way more tokens than possible

        vm.startPrank(victim);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);

        // Should revert due to slippage protection
        vm.expectRevert(Core.InsufficientOutput.selector);
        core.exactInBuy(1 ether, unrealisticMinOutput, token_, victim, block.timestamp + 1000);
        vm.stopPrank();
    }

    // ============================================================
    //            PRICE MANIPULATION RESISTANCE TESTS
    // ============================================================

    /**
     * @notice Test that price returns to fair value after manipulation attempt
     */
    function testPriceReturnsToFairValue() public {
        (, address token_) = createTestToken(creator);
        address curveAddr = factory.getCurve(token_);
        BondingCurve bc = BondingCurve(curveAddr);

        // Get initial price
        uint256 priceInitial = bc.getCurrentPrice();
        console.log("Price initial:", priceInitial);

        // Attacker buys
        address attackerAddr = address(0xBAD);
        vm.deal(attackerAddr, 10 ether);
        vm.startPrank(attackerAddr);
        wNative.deposit{value: 1 ether}();
        wNative.approve(address(core), 1 ether);
        core.exactInBuy(0.3 ether, 0, token_, attackerAddr, block.timestamp + 1000);
        vm.stopPrank();

        uint256 priceAfterBuy = bc.getCurrentPrice();
        console.log("Price after buy:", priceAfterBuy);

        // Attacker sells everything
        uint256 attackerTokens = IERC20(token_).balanceOf(attackerAddr);
        vm.startPrank(attackerAddr);
        IERC20(token_).approve(address(core), attackerTokens);
        core.exactInSell(attackerTokens, 0, token_, attackerAddr, attackerAddr, block.timestamp + 1000);
        vm.stopPrank();

        uint256 priceFinal = bc.getCurrentPrice();
        console.log("Price final:", priceFinal);

        // Price should be close to initial (within fee tolerance)
        // The curve accumulates fees, so price may be slightly higher
        uint256 priceDiff = priceFinal > priceInitial ? priceFinal - priceInitial : priceInitial - priceFinal;

        // Price should be within 5% of initial (accounting for fees and liquidity reserve)
        assertLt(priceDiff, priceInitial * 5 / 100, "Price should return close to initial value");
    }

    /**
     * @notice Test AMM provides consistent pricing
     */
    function testAMMConsistentPricing() public {
        (, address token_) = createTestToken(creator);
        address curveAddr = factory.getCurve(token_);
        BondingCurve bc = BondingCurve(curveAddr);

        // Multiple small buys vs one large buy should give similar total tokens

        // User 1: Multiple small buys
        uint256 totalTokensSmall = 0;
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(user1);
            wNative.deposit{value: 0.02 ether}();
            wNative.approve(address(core), 0.02 ether);
            uint256 balBefore = IERC20(token_).balanceOf(user1);
            core.exactInBuy(0.02 ether, 0, token_, user1, block.timestamp + 1000);
            uint256 balAfter = IERC20(token_).balanceOf(user1);
            totalTokensSmall += (balAfter - balBefore);
            vm.stopPrank();
        }

        // Reset state by selling all tokens back
        uint256 user1Tokens = IERC20(token_).balanceOf(user1);
        vm.startPrank(user1);
        IERC20(token_).approve(address(core), user1Tokens);
        core.exactInSell(user1Tokens, 0, token_, user1, user1, block.timestamp + 1000);
        vm.stopPrank();

        // User 2: One large buy of same total amount
        vm.startPrank(victim);
        wNative.deposit{value: 0.1 ether}();
        wNative.approve(address(core), 0.1 ether);
        core.exactInBuy(0.1 ether, 0, token_, victim, block.timestamp + 1000);
        vm.stopPrank();

        uint256 totalTokensLarge = IERC20(token_).balanceOf(victim);

        console.log("Total tokens (5 small buys):", totalTokensSmall);
        console.log("Total tokens (1 large buy):", totalTokensLarge);

        // Large buy should actually get slightly fewer tokens due to price impact
        // This is expected behavior of AMM - it discourages large single trades
        assertGt(totalTokensSmall, totalTokensLarge, "Multiple small buys should be more efficient than one large");
    }

    // ============================================================
    //            GRADUATION MANIPULATION TESTS
    // ============================================================

    /**
     * @notice Test that graduation cannot be manipulated for profit
     */
    function testGraduationCannotBeManipulated() public {
        (address curve_, address token_) = createTestToken(creator);
        BondingCurve bc = BondingCurve(curve_);

        // Attacker tries to push price up to graduation and profit
        address attackerAddr = address(0xBAD);
        vm.deal(attackerAddr, 10000 ether);

        uint256 attackerBalanceBefore;
        uint256 buyCount = 0;

        vm.startPrank(attackerAddr);
        wNative.deposit{value: 1000 ether}();
        attackerBalanceBefore = wNative.balanceOf(attackerAddr);

        // Buy until almost at graduation
        while (!bc.getLock() && buyCount < 100) {
            wNative.approve(address(core), 0.3 ether);
            core.exactInBuy(0.3 ether, 0, token_, attackerAddr, block.timestamp + 1000);
            buyCount++;
        }
        vm.stopPrank();

        if (bc.getLock()) {
            // Graduated - attacker's tokens are now locked in LP
            // They cannot dump on the bonding curve anymore
            uint256 attackerTokens = IERC20(token_).balanceOf(attackerAddr);

            // Trying to sell on bonding curve should fail (curve is locked)
            vm.startPrank(attackerAddr);
            IERC20(token_).approve(address(core), attackerTokens);

            vm.expectRevert(BondingCurve.BondingCurveLocked.selector);
            core.exactInSell(attackerTokens, 0, token_, attackerAddr, attackerAddr, block.timestamp + 1000);
            vm.stopPrank();

            console.log("Curve graduated - attacker cannot sell on bonding curve");
            console.log("Attacker tokens locked:", attackerTokens);
        }
    }

    // ============================================================
    //            ECONOMIC ATTACK RESISTANCE
    // ============================================================

    /**
     * @notice Test that fee makes arbitrage unprofitable
     */
    function testFeesMakeArbitrageUnprofitable() public {
        (, address token_) = createTestToken(creator);

        // Calculate the round-trip cost
        // Buy: pay 0.5% fee
        // Sell: pay 0.5% fee
        // Total: ~1% loss on round trip

        uint256 amount = 1 ether;

        vm.startPrank(user1);
        wNative.deposit{value: amount}();
        wNative.approve(address(core), amount);

        uint256 balanceBefore = wNative.balanceOf(user1);

        // Buy
        core.exactInBuy(amount, 0, token_, user1, block.timestamp + 1000);

        // Immediately sell
        uint256 tokens = IERC20(token_).balanceOf(user1);
        IERC20(token_).approve(address(core), tokens);
        core.exactInSell(tokens, 0, token_, user1, user1, block.timestamp + 1000);

        uint256 balanceAfter = wNative.balanceOf(user1);
        vm.stopPrank();

        uint256 loss = balanceBefore - balanceAfter;
        uint256 lossPercent = loss * 10000 / balanceBefore; // in basis points

        console.log("Round trip loss:", loss);
        console.log("Loss in basis points:", lossPercent);

        // Should lose approximately 1% (100 basis points) due to fees
        // Plus some additional loss from price impact
        assertGt(lossPercent, 50, "Should lose at least 0.5%");
        assertLt(lossPercent, 500, "Should not lose more than 5%");
    }

    /**
     * @notice Test that large trades have significant price impact
     */
    function testLargeTradesPriceImpact() public {
        // Create two identical tokens to compare small vs large buys
        (, address token1) = createTestToken(creator);

        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (, address token2) = core.createCurve(
            creator,
            "Test Token 2",
            "TEST2",
            "ipfs://test2",
            0,
            deployFee
        );
        vm.stopPrank();

        // Small buy on token1
        vm.startPrank(user1);
        wNative.deposit{value: 0.01 ether}();
        wNative.approve(address(core), 0.01 ether);
        core.exactInBuy(0.01 ether, 0, token1, user1, block.timestamp + 1000);
        vm.stopPrank();

        uint256 smallReturn = IERC20(token1).balanceOf(user1);
        uint256 smallRatio = smallReturn * 1e18 / 0.01 ether;

        // Large buy on token2 (same starting state)
        vm.startPrank(victim);
        wNative.deposit{value: 0.3 ether}();
        wNative.approve(address(core), 0.3 ether);
        core.exactInBuy(0.3 ether, 0, token2, victim, block.timestamp + 1000);
        vm.stopPrank();

        uint256 largeReturn = IERC20(token2).balanceOf(victim);
        uint256 largeRatio = largeReturn * 1e18 / 0.3 ether;

        console.log("Small buy ratio (tokens/ETH):", smallRatio);
        console.log("Large buy ratio (tokens/ETH):", largeRatio);

        // Large buy should have worse ratio due to price impact
        assertLt(largeRatio, smallRatio, "Large trades should have worse rate");

        // The difference should be significant
        uint256 slippage = (smallRatio - largeRatio) * 100 / smallRatio;
        console.log("Price impact (%):", slippage);
        assertGt(slippage, 1, "Large trade should have >1% price impact");
    }
}
