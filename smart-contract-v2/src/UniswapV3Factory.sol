// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./UniswapV3Pool.sol";

/**
 * @title UniswapV3Factory
 * @notice Minimal Uniswap V3 Factory implementation for token graduation on Push Chain testnet
 * @dev Creates V3 pools with concentrated liquidity
 */
contract UniswapV3Factory {
    /// @notice Address of the contract owner
    address public owner;

    /// @notice Fee amounts enabled (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
    mapping(uint24 => bool) public feeAmountTickSpacing;

    /// @notice Stores all created pools
    mapping(address => mapping(address => mapping(uint24 => address))) public pools;

    /// @notice Array of all pools created
    address[] public allPools;

    /// @notice Emitted when a pool is created
    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        address pool
    );

    /// @notice Emitted when fee amount is enabled/disabled
    event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing);

    error InvalidFee();
    error PoolAlreadyExists();
    error Unauthorized();

    constructor() {
        owner = msg.sender;

        // Enable standard Uniswap V3 fee tiers
        feeAmountTickSpacing[500] = true;    // 0.05% - tick spacing 10
        feeAmountTickSpacing[3000] = true;   // 0.30% - tick spacing 60
        feeAmountTickSpacing[10000] = true;  // 1.00% - tick spacing 200

        emit FeeAmountEnabled(500, 10);
        emit FeeAmountEnabled(3000, 60);
        emit FeeAmountEnabled(10000, 200);
    }

    /**
     * @notice Create a pool for the given two tokens and fee tier
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Fee tier (500, 3000, or 10000)
     * @return pool The address of the newly created pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool) {
        if (!feeAmountTickSpacing[fee]) {
            revert InvalidFee();
        }

        // Ensure token order (token0 < token1)
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        // Check pool doesn't already exist
        if (pools[token0][token1][fee] != address(0)) {
            revert PoolAlreadyExists();
        }

        // Deploy new pool
        UniswapV3Pool newPool = new UniswapV3Pool(
            token0,
            token1,
            fee
        );

        pool = address(newPool);

        // Store in mapping
        pools[token0][token1][fee] = pool;
        pools[token1][token0][fee] = pool; // Store both directions

        // Track in array
        allPools.push(pool);

        emit PoolCreated(token0, token1, fee, pool);
    }

    /**
     * @notice Get the pool address for a given pair of tokens and fee
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param fee Fee tier
     * @return pool Pool address, or address(0) if pool doesn't exist
     */
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool) {
        // Ensure consistent ordering
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pool = pools[token0][token1][fee];
    }

    /**
     * @notice Get the total number of pools created
     * @return Number of pools
     */
    function poolsLength() external view returns (uint256) {
        return allPools.length;
    }

    /**
     * @notice Get pool at specific index
     * @param index Pool index
     * @return Pool address
     */
    function getPoolAtIndex(uint256 index) external view returns (address) {
        return allPools[index];
    }

    /**
     * @notice Enable a fee amount with a tick spacing value
     * @dev Only owner can call this
     * @param fee Fee amount (in hundredths of a bip)
     * @param tickSpacing Tick spacing for the fee
     */
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        if (feeAmountTickSpacing[fee]) {
            revert InvalidFee();
        }

        feeAmountTickSpacing[fee] = true;
        emit FeeAmountEnabled(fee, tickSpacing);
    }
}
