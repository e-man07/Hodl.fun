// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../interfaces/IBondingCurve.sol";
import "../interfaces/IBondingCurveFactory.sol";

/**
 * @title BondingCurveLibrary
 * @notice Library for bonding curve calculations using constant product formula
 * @dev Implements x * y = k constant product AMM mechanics
 */
library BondingCurveLibrary {
    /**
     * @notice Calculate output amount for given input using constant product formula
     * @dev Formula: (x + Δx) * (y - Δy) = k
     * @param amountIn Input amount
     * @param k Constant product value
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 k,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "BondingCurveLibrary: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        
        // Calculate new reserve after adding input
        uint256 newReserveIn = reserveIn + amountIn;
        
        // Calculate new output reserve maintaining k
        // k = reserveIn * reserveOut
        // newReserveOut = k / newReserveIn
        uint256 newReserveOut = k / newReserveIn;
        
        // Output is the difference
        require(newReserveOut < reserveOut, "BondingCurveLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        amountOut = reserveOut - newReserveOut;
    }

    /**
     * @notice Calculate input amount required for given output using constant product formula
     * @dev Formula: (x - Δx) * (y + Δy) = k
     * @param amountOut Output amount
     * @param k Constant product value
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountIn Input amount required
     */
    function getAmountIn(
        uint256 amountOut,
        uint256 k,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "BondingCurveLibrary: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "BondingCurveLibrary: INSUFFICIENT_LIQUIDITY");
        require(amountOut < reserveOut, "BondingCurveLibrary: INSUFFICIENT_OUTPUT_RESERVE");
        
        // Calculate new reserve after removing output
        uint256 newReserveOut = reserveOut - amountOut;
        
        // Calculate new input reserve maintaining k
        // k = reserveIn * reserveOut
        // newReserveIn = k / newReserveOut
        uint256 newReserveIn = k / newReserveOut;
        
        // Input is the difference
        require(newReserveIn > reserveIn, "BondingCurveLibrary: INSUFFICIENT_INPUT_AMOUNT");
        amountIn = newReserveIn - reserveIn;
    }

    /**
     * @notice Get curve data from factory
     * @param factory Factory address
     * @param token Token address
     * @return curve Bonding curve address
     * @return virtualNative Virtual native reserve
     * @return virtualToken Virtual token reserve
     * @return k Constant product value
     */
    function getCurveData(
        address factory,
        address token
    ) internal view returns (
        address curve,
        uint256 virtualNative,
        uint256 virtualToken,
        uint256 k
    ) {
        curve = IBondingCurveFactory(factory).getCurve(token);
        require(curve != address(0), "BondingCurveLibrary: CURVE_NOT_FOUND");
        
        (virtualNative, virtualToken) = IBondingCurve(curve).getVirtualReserves();
        k = IBondingCurve(curve).getK();
    }
}

