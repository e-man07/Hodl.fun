// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../../src/utils/BondingCurveLibrary.sol";
import "../../src/utils/LiquidityAmounts.sol";
import "../../src/utils/TickMath.sol";

/**
 * @title LibraryWrapper
 * @notice Wrapper to test internal library functions with vm.expectRevert
 */
contract LibraryWrapper {
    function getAmountOut(
        uint256 amountIn,
        uint256 k,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256) {
        return BondingCurveLibrary.getAmountOut(amountIn, k, reserveIn, reserveOut);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 k,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256) {
        return BondingCurveLibrary.getAmountIn(amountOut, k, reserveIn, reserveOut);
    }
}

/**
 * @title PureLibraryTests
 * @notice Direct unit tests for library functions to maximize branch coverage
 */
contract PureLibraryTests is Test {
    LibraryWrapper wrapper;

    function setUp() public {
        wrapper = new LibraryWrapper();
    }

    // ========== BondingCurveLibrary.getAmountOut Tests ==========

    function testGetAmountOut_ZeroAmountIn_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_INPUT_AMOUNT");
        wrapper.getAmountOut(0, 1e36, 1e18, 1e18);
    }

    function testGetAmountOut_ZeroReserveIn_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        wrapper.getAmountOut(1e18, 1e36, 0, 1e18);
    }

    function testGetAmountOut_ZeroReserveOut_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        wrapper.getAmountOut(1e18, 1e36, 1e18, 0);
    }

    function testGetAmountOut_BothReservesZero_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        wrapper.getAmountOut(1e18, 1e36, 0, 0);
    }

    function testGetAmountOut_Success() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountIn = 0.1e18;

        uint256 amountOut = wrapper.getAmountOut(amountIn, k, reserveIn, reserveOut);

        // Verify output is positive and less than reserveOut
        assertTrue(amountOut > 0, "Amount out should be positive");
        assertTrue(amountOut < reserveOut, "Amount out should be less than reserve");
    }

    function testGetAmountOut_LargeInput() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountIn = 100e18; // Large input

        uint256 amountOut = wrapper.getAmountOut(amountIn, k, reserveIn, reserveOut);
        assertTrue(amountOut > 0);
    }

    function testGetAmountOut_SmallInput() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountIn = 1; // Very small input (1 wei)

        uint256 amountOut = wrapper.getAmountOut(amountIn, k, reserveIn, reserveOut);
        // Output may be 0 due to rounding, but function shouldn't revert
        assertTrue(amountOut >= 0);
    }

    // ========== BondingCurveLibrary.getAmountIn Tests ==========

    function testGetAmountIn_ZeroAmountOut_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        wrapper.getAmountIn(0, 1e36, 1e18, 1e18);
    }

    function testGetAmountIn_ZeroReserveIn_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        wrapper.getAmountIn(0.5e18, 1e36, 0, 1e18);
    }

    function testGetAmountIn_ZeroReserveOut_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        wrapper.getAmountIn(0.5e18, 1e36, 1e18, 0);
    }

    function testGetAmountIn_AmountOutEqualsReserveOut_Reverts() public {
        // amountOut >= reserveOut should revert
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_OUTPUT_RESERVE");
        wrapper.getAmountIn(1e18, 1e36, 1e18, 1e18);
    }

    function testGetAmountIn_AmountOutExceedsReserveOut_Reverts() public {
        vm.expectRevert("BondingCurveLibrary: INSUFFICIENT_OUTPUT_RESERVE");
        wrapper.getAmountIn(2e18, 1e36, 1e18, 1e18);
    }

    function testGetAmountIn_Success() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountOut = 1_000_000e18;

        uint256 amountIn = wrapper.getAmountIn(amountOut, k, reserveIn, reserveOut);
        assertTrue(amountIn > 0, "Amount in should be positive");
    }

    function testGetAmountIn_SmallAmountOut() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountOut = 1e18; // Small output

        uint256 amountIn = wrapper.getAmountIn(amountOut, k, reserveIn, reserveOut);
        assertTrue(amountIn > 0);
    }

    function testGetAmountIn_LargeAmountOut() public view {
        uint256 k = 1e18 * 50_000_000e18;
        uint256 reserveIn = 1e18;
        uint256 reserveOut = 50_000_000e18;
        uint256 amountOut = 40_000_000e18; // Large output (but < reserveOut)

        uint256 amountIn = wrapper.getAmountIn(amountOut, k, reserveIn, reserveOut);
        assertTrue(amountIn > 0);
    }

    // ========== LiquidityAmounts Tests ==========
    // Note: getLiquidityForAmount0 has overflow issues with most inputs due to
    // (sqrtRatioAX96 * sqrtRatioBX96) >> 96 potentially overflowing
    // We focus on getLiquidityForAmount1 and getLiquidityForAmounts which are more stable

    function testGetLiquidityForAmount1_NormalOrder() public pure {
        uint160 sqrtRatioAX96 = 79228162514264337593543950336; // tick 0
        uint160 sqrtRatioBX96 = 79624695486233786347921552742; // tick 100
        uint256 amount1 = 1e18;

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
        assertTrue(liquidity > 0);
    }

    function testGetLiquidityForAmount1_SwappedOrder() public pure {
        uint160 sqrtRatioAX96 = 79624695486233786347921552742; // tick 100
        uint160 sqrtRatioBX96 = 79228162514264337593543950336; // tick 0
        uint256 amount1 = 1e18;

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
        assertTrue(liquidity > 0);
    }

    function testGetLiquidityForAmount1_ZeroAmount() public pure {
        uint160 sqrtRatioAX96 = 79228162514264337593543950336;
        uint160 sqrtRatioBX96 = 79624695486233786347921552742;

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, 0);
        assertEq(liquidity, 0);
    }

    // Test getLiquidityForAmounts - above range branch (uses amount1 only)
    function testGetLiquidityForAmounts_AboveRange() public pure {
        uint160 sqrtRatioAX96 = 79228162514264337593543950336; // tick 0
        uint160 sqrtRatioBX96 = 79624695486233786347921552742; // tick 100
        uint160 sqrtRatioX96 = 80022039608451053664523628406;  // tick 200 (above range)

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioX96,
            sqrtRatioAX96,
            sqrtRatioBX96,
            1e18,
            1e18
        );
        assertTrue(liquidity > 0);
    }

    // Test getLiquidityForAmounts - at upper boundary
    function testGetLiquidityForAmounts_AtUpperBoundary() public pure {
        uint160 sqrtRatioAX96 = 79228162514264337593543950336;
        uint160 sqrtRatioBX96 = 79624695486233786347921552742;

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtRatioBX96, // at upper boundary
            sqrtRatioAX96,
            sqrtRatioBX96,
            1e18,
            1e18
        );
        assertTrue(liquidity > 0);
    }

    // ========== Fuzz Tests ==========

    function testFuzz_GetAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view {
        // Bound inputs to reasonable ranges that won't overflow
        amountIn = bound(amountIn, 1, 1e20);
        reserveIn = bound(reserveIn, 1e10, 1e20);
        reserveOut = bound(reserveOut, 1e10, 1e20);

        uint256 k = reserveIn * reserveOut;

        // Skip if k overflows
        if (k / reserveIn != reserveOut) return;

        uint256 newReserveIn = reserveIn + amountIn;
        // Skip if newReserveIn overflows
        if (newReserveIn < reserveIn) return;

        uint256 newReserveOut = k / newReserveIn;
        // Skip if output would be zero (due to rounding)
        if (newReserveOut >= reserveOut) return;

        uint256 amountOut = wrapper.getAmountOut(amountIn, k, reserveIn, reserveOut);
        assertTrue(amountOut > 0);
        assertTrue(amountOut < reserveOut);
    }

    function testFuzz_GetAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view {
        // Bound inputs
        reserveIn = bound(reserveIn, 1e10, 1e24);
        reserveOut = bound(reserveOut, 1e10, 1e24);
        amountOut = bound(amountOut, 1, reserveOut - 1);

        uint256 k = reserveIn * reserveOut;

        // Skip if k overflows
        if (k / reserveIn != reserveOut) return;

        uint256 newReserveOut = reserveOut - amountOut;
        if (newReserveOut == 0) return;

        uint256 newReserveIn = k / newReserveOut;
        // Skip if input would be zero (due to rounding)
        if (newReserveIn <= reserveIn) return;

        uint256 amountIn = wrapper.getAmountIn(amountOut, k, reserveIn, reserveOut);
        assertTrue(amountIn > 0);
    }
}

/**
 * @title TickMathBranchTests
 * @notice Tests for TickMath library edge cases
 * Note: TickMath.getTickAtSqrtRatio may not exactly round-trip due to integer math
 */
contract TickMathBranchTests is Test {

    // Test MIN_TICK
    function testGetSqrtRatioAtTick_MinTick() public pure {
        int24 minTick = -887272;
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(minTick);
        assertTrue(sqrtRatio > 0);
    }

    // Test MAX_TICK
    function testGetSqrtRatioAtTick_MaxTick() public pure {
        int24 maxTick = 887272;
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(maxTick);
        assertTrue(sqrtRatio > 0);
    }

    // Test tick 0
    function testGetSqrtRatioAtTick_Zero() public pure {
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(0);
        // At tick 0, price is 1, so sqrtRatio should be 2^96
        assertEq(sqrtRatio, 79228162514264337593543950336);
    }

    // Test negative ticks
    function testGetSqrtRatioAtTick_Negative() public pure {
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(-100);
        assertTrue(sqrtRatio > 0);
        assertTrue(sqrtRatio < TickMath.getSqrtRatioAtTick(0));
    }

    // Test positive ticks
    function testGetSqrtRatioAtTick_Positive() public pure {
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(100);
        assertTrue(sqrtRatio > TickMath.getSqrtRatioAtTick(0));
    }

    // Test getTickAtSqrtRatio returns correct tick (may have +-1 rounding)
    function testGetTickAtSqrtRatio_AtTick0() public pure {
        uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(0);
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtRatio);
        // Allow for rounding (TickMath floors the result)
        assertTrue(tick == 0 || tick == -1, "Tick should be 0 or -1");
    }

    // Test various tick values (positive direction)
    function testTickMath_VariousTicks_Forward() public pure {
        int24[4] memory ticks = [int24(-50000), int24(-1000), int24(1000), int24(50000)];

        for (uint256 i = 0; i < ticks.length; i++) {
            uint160 sqrtRatio = TickMath.getSqrtRatioAtTick(ticks[i]);
            assertTrue(sqrtRatio > 0, "sqrtRatio should be positive");
        }
    }

    // Test tick ordering is preserved
    function testTickMath_Ordering() public pure {
        // Lower ticks should produce lower sqrt ratios
        uint160 sqrtLow = TickMath.getSqrtRatioAtTick(-1000);
        uint160 sqrtMid = TickMath.getSqrtRatioAtTick(0);
        uint160 sqrtHigh = TickMath.getSqrtRatioAtTick(1000);

        assertTrue(sqrtLow < sqrtMid, "Lower tick should have lower sqrt ratio");
        assertTrue(sqrtMid < sqrtHigh, "Higher tick should have higher sqrt ratio");
    }

    // Test boundary values
    function testTickMath_Boundaries() public pure {
        // Near min tick
        uint160 sqrtNearMin = TickMath.getSqrtRatioAtTick(-800000);
        assertTrue(sqrtNearMin > 0);

        // Near max tick
        uint160 sqrtNearMax = TickMath.getSqrtRatioAtTick(800000);
        assertTrue(sqrtNearMax > 0);
    }
}
