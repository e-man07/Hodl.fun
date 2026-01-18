// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IUniswapV3MintCallback.sol";

/**
 * @title UniswapV3Pool
 * @notice Minimal Uniswap V3 Pool implementation for token graduation on Push Chain testnet
 * @dev Handles concentrated liquidity positions with mint callbacks
 */
contract UniswapV3Pool is IUniswapV3Pool {
    using SafeERC20 for IERC20;

    /// @notice Token0 (lower address)
    address public override token0;

    /// @notice Token1 (higher address)
    address public override token1;

    /// @notice Fee of the pool
    uint24 public override fee;

    /// @notice Current pool state
    uint160 private sqrtPriceX96_;
    int24 private tick_;
    uint16 private observationIndex_;
    uint16 private observationCardinality_;
    uint16 private observationCardinalityNext_;
    uint8 private feeProtocol_;
    bool private unlocked_;

    /// @notice Total liquidity in the pool
    uint128 public override liquidity;

    /// @notice Fee growth accumulators
    uint256 public override feeGrowthGlobal0X128;
    uint256 public override feeGrowthGlobal1X128;

    /// @notice Liquidity by position
    mapping(bytes32 => uint128) public positions;

    error InvalidPrice();
    error Locked();
    error InvalidAmount();
    error InvalidTick();

    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        unlocked_ = true;
    }

    /**
     * @notice Initialize the pool with a starting price
     * @param sqrtPriceX96 The initial price as a Q64.96
     */
    function initialize(uint160 sqrtPriceX96) external override {
        if (sqrtPriceX96_ != 0) {
            revert InvalidPrice();
        }
        if (sqrtPriceX96 == 0) {
            revert InvalidPrice();
        }

        sqrtPriceX96_ = sqrtPriceX96;

        // Calculate initial tick from price
        // tick = log1.0001(price)
        // For simplicity, we'll just store sqrtPriceX96 and use it
        tick_ = 0;
        observationIndex_ = 0;
        observationCardinality_ = 1;
        observationCardinalityNext_ = 1;
        feeProtocol_ = 0;
    }

    /**
     * @notice Return the pool's current state
     */
    function slot0()
        external
        view
        override
        returns (
            uint160 _sqrtPriceX96,
            int24 _tick,
            uint16 _observationIndex,
            uint16 _observationCardinality,
            uint16 _observationCardinalityNext,
            uint8 _feeProtocol,
            bool _unlocked
        )
    {
        return (
            sqrtPriceX96_,
            tick_,
            observationIndex_,
            observationCardinality_,
            observationCardinalityNext_,
            feeProtocol_,
            unlocked_
        );
    }

    /**
     * @notice Add liquidity to a position
     * @param recipient Address for the liquidity
     * @param tickLower Lower tick of position
     * @param tickUpper Upper tick of position
     * @param amount Amount of liquidity to mint
     * @param data Callback data
     */
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external override returns (uint256 amount0, uint256 amount1) {
        if (!unlocked_) {
            revert Locked();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (tickLower >= tickUpper) {
            revert InvalidTick();
        }

        unlocked_ = false;

        // Calculate token amounts needed
        // Simplified calculation for testnet
        // In reality this would use complex math with sqrtPriceX96
        amount0 = uint256(amount) / 2;
        amount1 = uint256(amount) / 2;

        // Update liquidity
        bytes32 positionKey = keccak256(abi.encodePacked(recipient, tickLower, tickUpper));
        positions[positionKey] += amount;
        liquidity += amount;

        // Call callback to get tokens from minter
        IUniswapV3MintCallback(msg.sender).uniswapV3MintCallback(amount0, amount1, data);

        unlocked_ = true;
    }

    /**
     * @notice Collect fees from a position
     */
    function collect(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount0Requested,
        uint128 amount1Requested
    ) external override returns (uint256 amount0, uint256 amount1) {
        // Simplified implementation - just return requested amounts
        amount0 = uint256(amount0Requested);
        amount1 = uint256(amount1Requested);

        if (amount0 > 0) {
            IERC20(token0).safeTransfer(recipient, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).safeTransfer(recipient, amount1);
        }
    }

    /**
     * @notice Burn liquidity from a position
     */
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override returns (uint256 amount0, uint256 amount1) {
        if (amount == 0) {
            revert InvalidAmount();
        }

        bytes32 positionKey = keccak256(abi.encodePacked(msg.sender, tickLower, tickUpper));
        uint128 positionLiquidity = positions[positionKey];

        if (positionLiquidity < amount) {
            revert InvalidAmount();
        }

        positions[positionKey] -= amount;
        liquidity -= amount;

        // Calculate amounts to return (simplified)
        amount0 = uint256(amount) / 2;
        amount1 = uint256(amount) / 2;
    }
}
