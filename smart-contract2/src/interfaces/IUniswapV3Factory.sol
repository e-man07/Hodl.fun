// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IUniswapV3Factory
 * @notice Interface for Uniswap V3 Factory
 */
interface IUniswapV3Factory {
    /**
     * @notice Get the pool address for a given pair of tokens and a fee
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
     * @return pool Pool address, or address(0) if pool doesn't exist
     */
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);

    /**
     * @notice Create a pool for the given two tokens and fee
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
     * @return pool The address of the newly created pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool);
}

