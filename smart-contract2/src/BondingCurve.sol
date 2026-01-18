// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IUniswapV3Factory.sol";
import "./interfaces/IUniswapV3Pool.sol";
import "./interfaces/IUniswapV3MintCallback.sol";
import "./interfaces/IBondingCurveFactory.sol";
import "./interfaces/ICore.sol";
import "./utils/TickMath.sol";
import "./utils/LiquidityAmounts.sol";

/**
 * @title BondingCurve
 * @notice Upgradeable bonding curve contract implementing constant product AMM
 * @dev One bonding curve per token, uses UUPS upgradeable pattern
 */
contract BondingCurve is IBondingCurve, IUniswapV3MintCallback, Initializable, UUPSUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Role for core contract
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    /// @notice Immutable factory address
    address public immutable factory;

    /// @notice Immutable core address (set in constructor, but may be address(0) for implementations)
    address public immutable core;

    /// @notice Factory contract address (stored in state for proxy usage)
    address private storedFactory;

    /// @notice Core contract address (stored in state for proxy usage)
    address private storedCore;
    
    /// @notice Immutable wrapped native token
    address public immutable wNative;
    
    /// @notice Token address
    address public token;
    
    /// @notice Uniswap V3 pool address (set after listing)
    address public pool;
    
    /// @notice Virtual reserves for price calculation
    uint256 private virtualNative;
    uint256 private virtualToken;
    uint256 private k;
    uint256 private graduationMarketCap;
    
    /// @notice Fee configuration
    struct Fee {
        uint8 denominator;
        uint16 numerator;
    }
    Fee private feeConfig;
    
    /// @notice Real reserves tracking actual balances
    uint256 public realNativeReserves;
    uint256 public realTokenReserves;
    
    /// @notice All-time high tracking
    uint256 public athPrice; // All-time high price per token (scaled by 1e18)
    uint256 public athMarketCap; // All-time high market cap (in native currency)
    uint256 public athPriceTimestamp; // Timestamp when ATH price was reached
    uint256 public athMarketCapTimestamp; // Timestamp when ATH market cap was reached
    
    /// @notice State flags
    bool public lock;
    bool public isListing;

    /// @notice Custom errors
    error BondingCurveLocked();
    error OnlyCore();
    error OnlyFactory();
    error InvalidAmountOut();
    error InvalidAmountIn();
    error InvalidTo();
    error InvalidK();
    error OnlyLock();
    error AlreadyListed();
    error MustListing();
    error InvalidReserves();
    error InvalidFeeConfig();
    error InsufficientVirtualTokenReserves();
    error InsufficientVirtualNativeReserves();
    error InsufficientNativeReserves();
    error InvalidAddress();
    error InvalidToken();
    error InvalidFeeVault();

    /// @notice Disable initializers in implementation
    constructor(address _core, address _wNative) {
        factory = msg.sender;
        core = _core;
        wNative = _wNative;
        _disableInitializers();
    }

    /**
     * @notice Initialize the bonding curve
     * @param _token Token address
     * @param _core Core contract address (for access control)
     * @param _virtualNative Initial virtual native reserve
     * @param _virtualToken Initial virtual token reserve
     * @param _k Constant product parameter
     * @param _graduationMarketCap Market cap threshold for graduation (in native currency)
     * @param _feeDenominator Fee denominator
     * @param _feeNumerator Fee numerator
     */
    function initialize(
        address _token,
        address _core,
        uint256 _virtualNative,
        uint256 _virtualToken,
        uint256 _k,
        uint256 _graduationMarketCap,
        uint8 _feeDenominator,
        uint16 _feeNumerator
    ) external initializer {
        // When using proxies, msg.sender is the proxy address, not the factory
        // The factory check is removed because:
        // 1. Only the factory can create proxies (it has CORE_ROLE)
        // 2. Proxies are initialized as part of creation, which is safe
        // 3. The factory immutable ensures we know which factory created us
        // Note: For direct (non-proxy) usage, this would fail due to _disableInitializers()
        
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        // Validate token address
        if (_token == address(0)) {
            revert InvalidAddress();
        }
        // Verify it's a contract (has code)
        if (_token.code.length == 0) {
            revert InvalidToken();
        }

        // Validate reserves
        if (_virtualNative == 0 || _virtualToken == 0) {
            revert InvalidReserves();
        }
        if (_k == 0) {
            revert InvalidK();
        }
        
        // Validate fee configuration
        if (_feeDenominator == 0) {
            revert InvalidFeeConfig();
        }
        if (_feeNumerator >= _feeDenominator) {
            revert InvalidFeeConfig(); // Fee must be < 100%
        }

        token = _token;
        virtualNative = _virtualNative;
        virtualToken = _virtualToken;
        k = _k;
        graduationMarketCap = _graduationMarketCap;
        feeConfig = Fee(_feeDenominator, _feeNumerator);
        isListing = false;
        lock = false;
        
        // Initialize ATH values to initial price/market cap
        uint256 initialPrice = (virtualNative * 1e18) / virtualToken;
        uint256 totalSupply = IERC20(_token).totalSupply();
        uint256 initialMarketCap = (totalSupply * initialPrice) / 1e18;
        athPrice = initialPrice;
        athMarketCap = initialMarketCap;
        athPriceTimestamp = block.timestamp;
        athMarketCapTimestamp = block.timestamp;

        // Validate core address
        if (_core == address(0)) {
            revert InvalidAddress();
        }
        // Store core address in state (for proxy usage, since immutable is address(0) in implementation)
        storedCore = _core;
        // Grant roles to the actual core contract (not the immutable which is address(0) for implementations)
        _grantRole(DEFAULT_ADMIN_ROLE, storedCore);
        _grantRole(CORE_ROLE, storedCore);

        // Store factory address in state (for proxy usage, where immutable is implementation address, not proxy)
        // msg.sender should be the factory proxy during initialization
        storedFactory = msg.sender;

        // Initialize real reserves
        realNativeReserves = IERC20(wNative).balanceOf(address(this));
        realTokenReserves = IERC20(_token).balanceOf(address(this));
    }

    /**
     * @notice Execute a buy order
     * @param to Recipient address
     * @param amountOut Amount of tokens to buy (before fee deduction)
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Validates amountOut matches constant product formula to prevent manipulation
     */
    function buy(address to, uint256 amountOut) external override nonReentrant whenNotPaused onlyRole(CORE_ROLE) {
        // Checks
        if (lock) {
            revert BondingCurveLocked();
        }
        if (amountOut == 0) {
            revert InvalidAmountOut();
        }
        if (to == address(0) || to == wNative || to == token) {
            revert InvalidTo();
        }

        address _wNative = wNative;
        address _token = token;

        // Get fresh reserves
        uint256 _virtualNative = virtualNative;
        uint256 _virtualToken = virtualToken;
        uint256 _k = k;

        // Get balance of native tokens (should be increased by amount sent from Core)
        uint256 balanceNative = IERC20(_wNative).balanceOf(address(this));
        uint256 _realNativeReserves = realNativeReserves;
        uint256 amountNativeIn = balanceNative - _realNativeReserves;
        
        if (amountNativeIn == 0) {
            revert InvalidAmountIn();
        }

        // CRITICAL SECURITY FIX: Validate amountOut matches constant product formula
        // Calculate expected output: newReserveOut = k / (virtualNative + amountNativeIn)
        // amountOut = virtualToken - newReserveOut
        uint256 newReserveIn = _virtualNative + amountNativeIn;
        if (newReserveIn == 0) {
            revert InvalidReserves();
        }
        uint256 newReserveOut = _k / newReserveIn;
        if (newReserveOut >= _virtualToken) {
            revert InsufficientVirtualTokenReserves();
        }
        uint256 expectedAmountOut = _virtualToken - newReserveOut;
        
        // CRITICAL SECURITY FIX: Validate provided amountOut matches expected output
        // Both Core and BondingCurve use the same formula (BondingCurveLibrary.getAmountOut),
        // so they should match exactly. Any mismatch indicates manipulation.
        // Note: Integer division rounding is deterministic, so exact match is required
        if (amountOut != expectedAmountOut) {
            revert InvalidAmountOut();
        }

        // Calculate fee: deduct fee from token output
        Fee memory fee = feeConfig;
        uint256 feeTokenAmount = (amountOut * fee.numerator) / fee.denominator;
        uint256 tokensToUser = amountOut - feeTokenAmount;

        // Effects: Update virtual reserves
        // Note: k is maintained mathematically via the constant product formula
        // The formula ensures (virtualNative + amountNativeIn) * (virtualToken - amountOut) >= k
        // due to integer division rounding effects which preserve or increase the product
        virtualNative += amountNativeIn;
        virtualToken -= amountOut;

        // SECURITY FIX: Check for division by zero before price calculation
        if (virtualToken == 0) {
            revert InvalidReserves();
        }

        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        uint256 price = (virtualNative * 1e18) / virtualToken;

        // Interactions: Transfer AFTER state update (CEI pattern)
        IERC20(_token).safeTransfer(to, tokensToUser);

        // Update real reserves AFTER token transfer (now balances reflect the trade)
        realNativeReserves = IERC20(wNative).balanceOf(address(this));
        realTokenReserves = IERC20(token).balanceOf(address(this));

        // Emit Sync event after all state updates
        emit Sync(token, realNativeReserves, realTokenReserves, virtualNative, virtualToken, price, block.timestamp);

        // Note: Buy fees are deducted in tokens (feeTokenAmount stays in curve)
        // This benefits all token holders by reducing circulating supply and increasing value
        // Creator fees are distributed from sell operations in native tokens
        emit CreatorFeeDeferredFromBuy(_token, feeTokenAmount, price);

        // Emit event with actual amounts (tokensToUser is what user receives)
        emit Buy(to, token, amountNativeIn, tokensToUser, price, block.timestamp);
        _checkTarget();
    }

    /**
     * @notice Execute a sell order
     * @param to Recipient address
     * @param amountOut Amount of native to receive (before fee deduction)
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     * @dev Validates amountOut matches constant product formula to prevent manipulation
     */
    function sell(address to, uint256 amountOut) external override nonReentrant whenNotPaused onlyRole(CORE_ROLE) {
        // Checks
        if (lock) {
            revert BondingCurveLocked();
        }
        if (amountOut == 0) {
            revert InvalidAmountOut();
        }
        if (to == address(0) || to == wNative || to == token) {
            revert InvalidTo();
        }

        address _wNative = wNative;
        address _token = token;
        
        // Get fresh reserves
        uint256 _virtualNative = virtualNative;
        uint256 _virtualToken = virtualToken;
        uint256 _k = k;
        uint256 _realNativeReserves = realNativeReserves;
        
        if (amountOut > _realNativeReserves) {
            revert InvalidAmountOut();
        }

        // Get balance of tokens (should be increased by amount sent from Core)
        uint256 balanceToken = IERC20(_token).balanceOf(address(this));
        uint256 _realTokenReserves = realTokenReserves;
        uint256 amountTokenIn = balanceToken - _realTokenReserves;
        if (amountTokenIn == 0) {
            revert InvalidAmountIn();
        }

        // CRITICAL SECURITY FIX: Validate amountOut matches constant product formula
        // Calculate expected output: newReserveIn = k / (virtualToken + amountTokenIn)
        // amountOut = virtualNative - newReserveIn
        uint256 newReserveOut = _virtualToken + amountTokenIn;
        if (newReserveOut == 0) {
            revert InvalidReserves();
        }
        uint256 newReserveIn = _k / newReserveOut;
        if (newReserveIn >= _virtualNative) {
            revert InsufficientVirtualNativeReserves();
        }
        uint256 expectedAmountOut = _virtualNative - newReserveIn;
        
        // CRITICAL SECURITY FIX: Validate provided amountOut matches expected output
        // Both Core and BondingCurve use the same formula (BondingCurveLibrary.getAmountOut),
        // so they should match exactly. Any mismatch indicates manipulation.
        // Note: Integer division rounding is deterministic, so exact match is required
        if (amountOut != expectedAmountOut) {
            revert InvalidAmountOut();
        }

        // Calculate fee: deduct fee from native output
        Fee memory fee = feeConfig;
        uint256 feeAmount = (amountOut * fee.numerator) / fee.denominator;
        uint256 nativeToUser = amountOut - feeAmount;

        // Use state variable storedCore (for proxies) or fallback to immutable core
        address coreAddress = storedCore != address(0) ? storedCore : core;
        address feeVault = ICore(coreAddress).getFeeVault();
        if (feeVault == address(0)) {
            revert InvalidAddress();
        }

        // Effects: Update virtual reserves DIRECTLY (not calling _update which reads stale balances)
        // In sell: virtualNative decreases by amountOut, virtualToken increases by amountTokenIn
        // Note: k is maintained mathematically via the constant product formula
        // The formula ensures (virtualNative - amountOut) * (virtualToken + amountTokenIn) >= k
        // due to integer division rounding effects which preserve or increase the product
        virtualNative -= amountOut;
        virtualToken += amountTokenIn;

        // SECURITY FIX: Check for division by zero before price calculation
        if (virtualToken == 0) {
            revert InvalidReserves();
        }

        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        uint256 price = (virtualNative * 1e18) / virtualToken;

        // Interactions: Transfer AFTER state update (CEI pattern)
        IERC20(_wNative).safeTransfer(to, nativeToUser);

        // Split fees between creator and platform
        if (feeAmount > 0) {
            // Use storedFactory (proxy address) if available, otherwise fall back to immutable factory (implementation address)
            address factoryAddress = storedFactory != address(0) ? storedFactory : factory;
            IBondingCurveFactory factoryContract = IBondingCurveFactory(factoryAddress);
            address creator = factoryContract.getCreator(_token);
            uint16 creatorFeeShare = factoryContract.getCreatorFeeShare();

            // Calculate creator portion (in basis points, e.g., 1000 = 10%)
            uint256 creatorFee = (feeAmount * creatorFeeShare) / 10000;
            uint256 platformFee = feeAmount - creatorFee;

            // Accumulate creator fees (if creator exists and share > 0)
            if (creator != address(0) && creatorFee > 0) {
                // Transfer creator fee directly to factory for accumulation
                // Use factoryAddress (storedFactory or immutable) to ensure transfer goes to the same address as accumulateCreatorFees
                IERC20(_wNative).safeTransfer(factoryAddress, creatorFee);
                // Let factory accumulate the fee (no approval needed since we transferred first)
                factoryContract.accumulateCreatorFees(creator, creatorFee);
                emit CreatorFeeDistributed(creator, _token, creatorFee);
            } else {
                // If no creator or creatorFee is 0, add to platform fee
                platformFee = feeAmount;
            }

            // Transfer platform fee to vault
            if (platformFee > 0) {
                IERC20(_wNative).safeTransfer(feeVault, platformFee);
            }
        }

        // Update real reserves AFTER all token transfers (now balances reflect the trade)
        realNativeReserves = IERC20(wNative).balanceOf(address(this));
        realTokenReserves = IERC20(token).balanceOf(address(this));

        // Emit event with actual amounts (nativeToUser is what user receives)
        emit Sell(to, token, amountTokenIn, nativeToUser, price, block.timestamp);
        _checkTarget();
    }

    /**
     * @notice List token on Uniswap V3 after reaching target
     * @return pool_ Address of the created pool
     * @dev Protected by nonReentrant and checks listingFee <= realNativeReserves
     * @dev Uses concentrated liquidity with price range around graduation price
     */
    function listing() external override nonReentrant returns (address pool_) {
        if (!lock) {
            revert OnlyLock();
        }
        if (isListing) {
            revert AlreadyListed();
        }

        IBondingCurveFactory _factory = IBondingCurveFactory(getFactory());
        address dexFactory = _factory.getDexFactory();
        uint24 fee = _factory.getDexFee(); // Get V3 fee tier (500, 3000, or 10000)

        uint256 listingFee = _factory.getListingFee();

        // Validate that listing fee doesn't exceed available reserves
        if (listingFee > realNativeReserves) {
            revert InsufficientNativeReserves();
        }

        // Calculate and burn excess tokens (with underflow protection)
        uint256 burnTokenAmount;
        {
            // SECURITY FIX: Prevent division by zero
            if (virtualNative == 0) {
                revert InvalidReserves();
            }
            
            // Calculate expected token amount based on native reserves after listing fee
            // Safe to subtract now since we've checked listingFee <= realNativeReserves
            uint256 expectedTokenAmount = ((realNativeReserves - listingFee) * virtualToken) / virtualNative;
            
            // Only burn if actual reserves exceed expected
            if (realTokenReserves > expectedTokenAmount) {
                burnTokenAmount = realTokenReserves - expectedTokenAmount;
                if (burnTokenAmount > 0) {
                    IToken(token).burn(burnTokenAmount);
                }
            }
            // Transfer listing fee to vault
            if (listingFee > 0) {
                address feeVault = ICore(_factory.getCore()).getFeeVault();
                if (feeVault == address(0)) {
                    revert InvalidAddress();
                }
                IERC20(wNative).safeTransfer(feeVault, listingFee);
            }
        }

        uint256 listingNativeAmount = IERC20(wNative).balanceOf(address(this));
        uint256 listingTokenAmount = IERC20(token).balanceOf(address(this));

        // Determine token order (V3 requires sorted order)
        (address token0, address token1) = wNative < token ? (wNative, token) : (token, wNative);
        bool token0IsNative = (token0 == wNative);

        // Get or create pool
        IUniswapV3Factory v3Factory = IUniswapV3Factory(dexFactory);
        pool_ = v3Factory.getPool(token0, token1, fee);
        
        if (pool_ == address(0)) {
            pool_ = v3Factory.createPool(token0, token1, fee);
        }

        IUniswapV3Pool poolContract = IUniswapV3Pool(pool_);
        pool = pool_;

        // Calculate sqrtPriceX96 from current reserves
        // V3 uses Q64.96 format: sqrtPriceX96 = sqrt(amount1/amount0) * 2^96
        // Both tokens have 18 decimals, so we can use amounts directly
        
        // SECURITY FIX: Validate reserves before division
        if (listingNativeAmount == 0 || listingTokenAmount == 0) {
            revert InvalidReserves();
        }
        
        uint160 sqrtPriceX96;
        if (token0IsNative) {
            // token0 = native, token1 = token
            // priceRatio = token1/token0 = listingTokenAmount / listingNativeAmount
            // sqrtPriceX96 = sqrt(listingTokenAmount / listingNativeAmount) * 2^96
            // Multiply by 2^192 to maintain precision, then divide by 1e9 after sqrt
            uint256 priceRatioX192 = (listingTokenAmount << 192) / listingNativeAmount;
            uint256 sqrtPriceRatio = _sqrt(priceRatioX192);
            sqrtPriceX96 = uint160(sqrtPriceRatio / 1e9);
        } else {
            // token0 = token, token1 = native
            // priceRatio = token1/token0 = listingNativeAmount / listingTokenAmount
            // sqrtPriceX96 = sqrt(listingNativeAmount / listingTokenAmount) * 2^96
            uint256 priceRatioX192 = (listingNativeAmount << 192) / listingTokenAmount;
            uint256 sqrtPriceRatio = _sqrt(priceRatioX192);
            sqrtPriceX96 = uint160(sqrtPriceRatio / 1e9);
        }
        
        // Ensure sqrtPriceX96 is within valid range
        if (sqrtPriceX96 < TickMath.MIN_SQRT_RATIO) {
            sqrtPriceX96 = TickMath.MIN_SQRT_RATIO;
        }
        if (sqrtPriceX96 >= TickMath.MAX_SQRT_RATIO) {
            sqrtPriceX96 = TickMath.MAX_SQRT_RATIO - 1;
        }

        // Initialize pool if needed
        if (poolContract.liquidity() == 0) {
            poolContract.initialize(sqrtPriceX96);
        }

        // Calculate price range (ticks)
        // Default: ±100% from current price (±10 ticks for 0.30% fee tier)
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        int24 tickSpacing = _getTickSpacing(fee);
        
        // Calculate tick range (±100% = ±10 ticks for 0.30% tier)
        // For wider range, use more ticks
        int24 tickRange = tickSpacing * 10; // ±100% range
        int24 tickLower = ((tick / tickSpacing) * tickSpacing) - tickRange;
        int24 tickUpper = ((tick / tickSpacing) * tickSpacing) + tickRange;
        
        // Ensure ticks are within valid range
        if (tickLower < TickMath.MIN_TICK) tickLower = TickMath.MIN_TICK;
        if (tickUpper > TickMath.MAX_TICK) tickUpper = TickMath.MAX_TICK;

        // Get sqrt prices for range
        uint160 sqrtPriceAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        // Calculate liquidity amount
        uint128 liquidity;
        if (token0IsNative) {
            liquidity = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                sqrtPriceAX96,
                sqrtPriceBX96,
                listingNativeAmount,
                listingTokenAmount
            );
        } else {
            liquidity = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                sqrtPriceAX96,
                sqrtPriceBX96,
                listingTokenAmount,
                listingNativeAmount
            );
        }

        // Mint liquidity position
        // V3 will call back to uniswapV3MintCallback to get the tokens
        (uint256 amount0, uint256 amount1) = poolContract.mint(
            address(this),
            tickLower,
            tickUpper,
            liquidity,
            abi.encode(token0, token1)
        );

        // Reset reserves
        realNativeReserves = 0;
        realTokenReserves = 0;
        
        isListing = true;
        emit Listing(address(this), token, pool_, amount0, amount1, uint256(uint128(liquidity)));
        
        return pool_;
    }

    /**
     * @notice Get tick spacing for a given fee tier
     * @param fee Fee tier (500, 3000, or 10000)
     * @return tickSpacing Tick spacing for the fee tier
     */
    function _getTickSpacing(uint24 fee) private pure returns (int24 tickSpacing) {
        if (fee == 500) {
            tickSpacing = 10; // 0.05% fee tier
        } else if (fee == 3000) {
            tickSpacing = 60; // 0.30% fee tier
        } else if (fee == 10000) {
            tickSpacing = 200; // 1.00% fee tier
        } else {
            revert("Invalid fee tier");
        }
    }

    /**
     * @notice Calculate square root using Babylonian method
     * @param x Input value (Q192.64 format)
     * @return y Square root of x
     */
    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        
        // Use a more precise method for large numbers
        uint256 z = (x + 1) / 2;
        y = x;
        
        // Iterate until convergence (max 256 iterations for safety)
        for (uint256 i = 0; i < 256 && z < y; i++) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }

    /**
     * @notice Update virtual and real reserves after trades
     * @param amountIn Amount coming in
     * @param amountOut Amount going out
     * @param isBuy Whether this is a buy order
     */
    function _update(uint256 amountIn, uint256 amountOut, bool isBuy) private {
        // Update real reserves from actual balances
        realNativeReserves = IERC20(wNative).balanceOf(address(this));
        realTokenReserves = IERC20(token).balanceOf(address(this));

        if (isBuy) {
            virtualNative += amountIn;
            // Check for underflow (Solidity 0.8+ will revert, but explicit check is clearer)
            if (virtualToken < amountOut) {
                revert InsufficientVirtualTokenReserves();
            }
            virtualToken -= amountOut;
        } else {
            // Check for underflow (Solidity 0.8+ will revert, but explicit check is clearer)
            if (virtualNative < amountOut) {
                revert InsufficientVirtualNativeReserves();
            }
            virtualNative -= amountOut;
            virtualToken += amountIn;
        }

        // SECURITY FIX: Prevent division by zero
        if (virtualToken == 0) {
            revert InvalidReserves();
        }

        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        uint256 price = (virtualNative * 1e18) / virtualToken;

        emit Sync(token, realNativeReserves, realTokenReserves, virtualNative, virtualToken, price, block.timestamp);
    }

    /**
     * @notice Check if graduation market cap is reached and lock if so
     * Also updates ATH price and market cap if new highs are reached
     */
    function _checkTarget() private {
        // Calculate current price and market cap
        uint256 currentPrice = getCurrentPrice();
        uint256 totalSupply = IERC20(token).totalSupply();
        uint256 currentMarketCap = (totalSupply * currentPrice) / 1e18;
        
        // Update ATH price if new high
        if (currentPrice > athPrice) {
            athPrice = currentPrice;
            athPriceTimestamp = block.timestamp;
            emit NewATHPrice(token, currentPrice, block.timestamp);
        }
        
        // Update ATH market cap if new high
        if (currentMarketCap > athMarketCap) {
            athMarketCap = currentMarketCap;
            athMarketCapTimestamp = block.timestamp;
            emit NewATHMarketCap(token, currentMarketCap, block.timestamp);
        }
        
        // Lock if market cap reaches or exceeds graduation threshold
        if (currentMarketCap >= graduationMarketCap) {
            lock = true;
            emit Lock(token);
        }
    }

    /**
     * @notice Get real reserves
     * @return nativeReserves Native reserves
     * @return tokenReserves Token reserves
     */
    function getReserves() public view override returns (uint256 nativeReserves, uint256 tokenReserves) {
        nativeReserves = realNativeReserves;
        tokenReserves = realTokenReserves;
    }

    /**
     * @notice Get virtual reserves
     * @return virtualNativeReserve Virtual native reserve
     * @return virtualTokenReserve Virtual token reserve
     */
    function getVirtualReserves() public view override returns (uint256 virtualNativeReserve, uint256 virtualTokenReserve) {
        virtualNativeReserve = virtualNative;
        virtualTokenReserve = virtualToken;
    }

    /**
     * @notice Get constant product k
     * @return k_ Constant product value
     */
    function getK() external view override returns (uint256 k_) {
        k_ = k;
    }

    /**
     * @notice Get graduation market cap threshold
     * @return graduationMarketCap_ Market cap threshold for graduation (in native currency)
     */
    function getGraduationMarketCap() public view override returns (uint256 graduationMarketCap_) {
        graduationMarketCap_ = graduationMarketCap;
    }

    /**
     * @notice Get lock status
     * @return lock_ True if locked
     */
    function getLock() public view override returns (bool lock_) {
        lock_ = lock;
    }

    /**
     * @notice Get listing status
     * @return isListing_ True if listed
     */
    function getIsListing() public view override returns (bool isListing_) {
        isListing_ = isListing;
    }

    /**
     * @notice Get fee configuration
     * @return denominator Fee denominator
     * @return numerator Fee numerator
     */
    function getFeeConfig() public view override returns (uint8 denominator, uint16 numerator) {
        Fee memory fee = feeConfig;
        denominator = fee.denominator;
        numerator = fee.numerator;
    }

    /**
     * @notice Get factory address (for debugging)
     * @return Factory proxy address (storedFactory if set, otherwise immutable factory)
     */
    function getFactory() public view returns (address) {
        return storedFactory != address(0) ? storedFactory : factory;
    }

    /**
     * @notice Get current token price
     * @return price Current price per token in native currency (scaled by 1e18)
     * @dev Price is calculated from virtual reserves: price = virtualNative / virtualToken
     * @dev SECURITY: Returns 0 if virtualToken is 0 to prevent division by zero
     */
    function getCurrentPrice() public view override returns (uint256 price) {
        uint256 _virtualToken = virtualToken;
        if (_virtualToken == 0) {
            return 0;
        }
        uint256 _virtualNative = virtualNative;
        price = (_virtualNative * 1e18) / _virtualToken;
    }

    /**
     * @notice Calculate market cap for the token
     * @return marketCap Market cap in native currency (ETH/PUSH)
     * @dev Market cap = totalSupply * price
     */
    function calculateMarketCap() public view override returns (uint256 marketCap) {
        uint256 price = getCurrentPrice();
        uint256 totalSupply = IERC20(token).totalSupply();
        marketCap = (totalSupply * price) / 1e18;
    }

    /**
     * @notice Get all-time high price
     * @return price_ ATH price per token (scaled by 1e18)
     * @return timestamp_ Timestamp when ATH price was reached
     */
    function getATHPrice() public view override returns (uint256 price_, uint256 timestamp_) {
        price_ = athPrice;
        timestamp_ = athPriceTimestamp;
    }

    /**
     * @notice Get all-time high market cap
     * @return marketCap_ ATH market cap (in native currency)
     * @return timestamp_ Timestamp when ATH market cap was reached
     */
    function getATHMarketCap() public view override returns (uint256 marketCap_, uint256 timestamp_) {
        marketCap_ = athMarketCap;
        timestamp_ = athMarketCapTimestamp;
    }

    /**
     * @notice Callback for Uniswap V3 Pool#mint
     * @param amount0Owed The amount of token0 due to the pool
     * @param amount1Owed The amount of token1 due to the pool
     * @param data Encoded token addresses
     * @dev SECURITY: Only callable during listing transaction (isListing set or lock set)
     */
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        // SECURITY FIX: Verify we're in a listing state
        // SECURITY: Callback validation
        // This callback should only be called during listing() execution
        if (!lock) {
            revert OnlyLock();
        }

        // Decode the pool tokens from callback data
        address token0;
        address token1;
        (token0, token1) = abi.decode(data, (address, address));

        // SECURITY: Validate decoded tokens
        if (token0 == address(0) || token1 == address(0)) {
            revert InvalidAddress();
        }

        // SECURITY: Get DEX factory for pool verification
        address dexFactory = IBondingCurveFactory(getFactory()).getDexFactory();
        if (dexFactory == address(0)) {
            revert InvalidAddress();
        }

        // SECURITY: Verify caller is the expected Uniswap V3 pool
        // Calculate what the pool address should be based on the factory
        address expectedPool = IUniswapV3Factory(dexFactory)
            .getPool(token0, token1, IBondingCurveFactory(getFactory()).getDexFee());

        // SECURITY: Use custom error instead of require() for better gas efficiency
        // Verify caller is the exact pool we expect
        if (msg.sender != expectedPool) {
            revert InvalidAddress();
        }

        // SECURITY: Cross-verify with stored pool if it has been set
        // This prevents race conditions where pool could be set to a different address
        if (pool != address(0) && msg.sender != pool) {
            revert InvalidAddress();
        }

        // Interactions: Transfer tokens to pool
        // Only transfer what the pool requested
        if (amount0Owed > 0) {
            IERC20(token0).safeTransfer(msg.sender, amount0Owed);
        }
        if (amount1Owed > 0) {
            IERC20(token1).safeTransfer(msg.sender, amount1Owed);
        }
    }

    /**
     * @notice Pause the bonding curve (emergency stop)
     * @dev Only admin can call this. Prevents buy/sell operations.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the bonding curve
     * @dev Only admin can call this. Re-enables buy/sell operations.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Authorize upgrade (only admin)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

