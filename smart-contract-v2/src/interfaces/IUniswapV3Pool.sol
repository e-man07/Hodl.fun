// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IUniswapV3Pool
 * @notice Interface for Uniswap V3 Pool
 */
interface IUniswapV3Pool {
    /**
     * @notice Initialize the pool with a starting price
     * @param sqrtPriceX96 The initial price of the pool as a sqrt(price) encoded as a Q64.96
     */
    function initialize(uint160 sqrtPriceX96) external;

    /**
     * @notice The 0th storage slot in the pool stores many values, and is exposed as a single method to save gas
     * @return sqrtPriceX96 The current price of the pool as a sqrt(price) encoded as a Q64.96
     * @return tick The current tick of the pool
     * @return observationIndex The index of the last oracle observation
     * @return observationCardinality The current maximum number of observations stored
     * @return observationCardinalityNext The next maximum number of observations
     * @return feeProtocol The protocol fee for both tokens of the pool
     * @return unlocked Whether the pool is currently locked to reentrancy
     */
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    /**
     * @notice The fee growth as a Q128.128 fees of token0 collected per unit of liquidity
     * @return The fee growth of token0
     */
    function feeGrowthGlobal0X128() external view returns (uint256);

    /**
     * @notice The fee growth as a Q128.128 fees of token1 collected per unit of liquidity
     * @return The fee growth of token1
     */
    function feeGrowthGlobal1X128() external view returns (uint256);

    /**
     * @notice The liquidity amount
     * @return The amount of liquidity in the pool
     */
    function liquidity() external view returns (uint128);

    /**
     * @notice Add liquidity to a position
     * @param recipient The address for which the liquidity will be created
     * @param tickLower The lower tick of the position in which to add liquidity
     * @param tickUpper The upper tick of the position in which to add liquidity
     * @param amount The amount of liquidity to mint
     * @param data Any data that should be passed to the callback
     * @return amount0 The amount of token0 that was paid to mint the given amount of liquidity
     * @return amount1 The amount of token1 that was paid to mint the given amount of liquidity
     */
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external returns (uint256 amount0, uint256 amount1);

    /**
     * @notice Collects tokens owed to a position
     * @param recipient The address which should receive the fees collected
     * @param tickLower The lower tick of the position for which to collect fees
     * @param tickUpper The upper tick of the position for which to collect fees
     * @param amount0Requested How much token0 should be withdrawn from the fees owed
     * @param amount1Requested How much token1 should be withdrawn from the fees owed
     * @return amount0 The amount of fees collected in token0
     * @return amount1 The amount of fees collected in token1
     */
    function collect(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external returns (uint256 amount0, uint256 amount1);

    /**
     * @notice Burn liquidity from the sender and account tokens owed for the liquidity to the position
     * @param tickLower The lower tick of the position for which to burn liquidity
     * @param tickUpper The upper tick of the position for which to burn liquidity
     * @param amount How much liquidity to burn
     * @return amount0 The amount of token0 owed to the position
     * @return amount1 The amount of token1 owed to the position
     */
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external returns (uint256 amount0, uint256 amount1);

    /**
     * @notice The first of the two tokens of the pool, sorted by address
     * @return The token contract address
     */
    function token0() external view returns (address);

    /**
     * @notice The second of the two tokens of the pool, sorted by address
     * @return The token contract address
     */
    function token1() external view returns (address);

    /**
     * @notice The pool's fee in hundredths of a bip, i.e. 1e-6
     * @return The fee
     */
    function fee() external view returns (uint24);
}

