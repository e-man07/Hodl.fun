// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IUniswapV2Factory
 * @notice Interface for Uniswap V2 Factory
 */
interface IUniswapV2Factory {
    /**
     * @notice Create a pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return pair Pair address
     */
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

