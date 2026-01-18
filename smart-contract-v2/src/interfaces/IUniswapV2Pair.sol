// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IUniswapV2Pair
 * @notice Interface for Uniswap V2 Pair
 */
interface IUniswapV2Pair {
    /**
     * @notice Mint liquidity tokens
     * @param to Recipient address
     * @return liquidity Amount of liquidity tokens minted
     */
    function mint(address to) external returns (uint256 liquidity);
}

