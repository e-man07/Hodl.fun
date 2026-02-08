// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// src/interfaces/IBondingCurve.sol

/**
 * @title IBondingCurve
 * @notice Interface for bonding curve contracts
 */
interface IBondingCurve {
    /// @notice Emitted when tokens are bought
    event Buy(
        address indexed to, 
        address indexed token, 
        uint256 amountNativeIn, 
        uint256 amountOut,
        uint256 price,
        uint256 timestamp
    );
    
    /// @notice Emitted when tokens are sold
    event Sell(
        address indexed to, 
        address indexed token, 
        uint256 amountTokenIn, 
        uint256 amountOut,
        uint256 price,
        uint256 timestamp
    );
    
    /// @notice Emitted when curve is locked
    event Lock(address indexed token);
    
    /// @notice Emitted when token is listed on DEX
    event Listing(address indexed curve, address indexed token, address indexed pool, uint256 amount0, uint256 amount1, uint256 liquidity);
    
    /// @notice Emitted when new ATH price is reached
    event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp);
    
    /// @notice Emitted when new ATH market cap is reached
    event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp);
    
    /// @notice Emitted when reserves are synced
    event Sync(
        address indexed token,
        uint256 realNative,
        uint256 realToken,
        uint256 virtualNative,
        uint256 virtualToken,
        uint256 price,
        uint256 timestamp
    );

    /// @notice Emitted when creator fee is distributed from sell
    event CreatorFeeDistributed(address indexed creator, address indexed token, uint256 amount);

    /// @notice Emitted when buy fee is deferred (kept in curve)
    event CreatorFeeDeferredFromBuy(address indexed token, uint256 feeTokenAmount, uint256 price);

    /// @notice Emitted when liquidity reserve is accumulated from trading fees
    event LiquidityReserveAccumulated(address indexed token, uint256 amount, uint256 totalReserve);

    /// @notice Emitted when LP is permanently locked (burned to dead address)
    event LPBurned(address indexed token, address indexed pool, int24 tickLower, int24 tickUpper, uint128 liquidity);

    /// @notice Emitted when excess tokens are burned at graduation
    event TokensBurned(address indexed token, uint256 amount);

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
    ) external;

    /**
     * @notice Execute a buy order
     * @param to Recipient address
     * @param amountOut Amount of tokens to buy
     */
    function buy(address to, uint256 amountOut) external;

    /**
     * @notice Execute a sell order
     * @param to Recipient address
     * @param amountOut Amount of native to receive
     */
    function sell(address to, uint256 amountOut) external;

    /**
     * @notice List token on DEX
     * @return pool Address of the created pool
     */
    function listing() external returns (address pool);

    /**
     * @notice Get real reserves
     * @return nativeReserves Native reserves
     * @return tokenReserves Token reserves
     */
    function getReserves() external view returns (uint256 nativeReserves, uint256 tokenReserves);

    /**
     * @notice Get virtual reserves
     * @return virtualNativeReserve Virtual native reserve
     * @return virtualTokenReserve Virtual token reserve
     */
    function getVirtualReserves() external view returns (uint256 virtualNativeReserve, uint256 virtualTokenReserve);

    /**
     * @notice Get constant product k
     * @return k Constant product value
     */
    function getK() external view returns (uint256 k);

    /**
     * @notice Get graduation market cap threshold
     * @return graduationMarketCap Market cap threshold for graduation (in native currency)
     */
    function getGraduationMarketCap() external view returns (uint256 graduationMarketCap);

    /**
     * @notice Get lock status
     * @return lock True if locked
     */
    function getLock() external view returns (bool lock);

    /**
     * @notice Get listing status
     * @return isListing True if listed
     */
    function getIsListing() external view returns (bool isListing);

    /**
     * @notice Get fee configuration
     * @return denominator Fee denominator
     * @return numerator Fee numerator
     */
    function getFeeConfig() external view returns (uint8 denominator, uint16 numerator);

    /**
     * @notice Get current token price
     * @return price Current price per token in native currency (scaled by 1e18)
     */
    function getCurrentPrice() external view returns (uint256 price);

    /**
     * @notice Calculate market cap for the token
     * @return marketCap Market cap in native currency (ETH/PUSH)
     */
    function calculateMarketCap() external view returns (uint256 marketCap);

    /**
     * @notice Get all-time high price
     * @return price ATH price per token (scaled by 1e18)
     * @return timestamp Timestamp when ATH price was reached
     */
    function getATHPrice() external view returns (uint256 price, uint256 timestamp);

    /**
     * @notice Get all-time high market cap
     * @return marketCap ATH market cap (in native currency)
     * @return timestamp Timestamp when ATH market cap was reached
     */
    function getATHMarketCap() external view returns (uint256 marketCap, uint256 timestamp);
}

// src/interfaces/IBondingCurveFactory.sol

/**
 * @title IBondingCurveFactory
 * @notice Interface for bonding curve factory
 */
interface IBondingCurveFactory {
    /// @notice Configuration structure
    struct Config {
        uint256 deployFee;
        uint256 listingFee;
        uint256 virtualNative;
        uint256 virtualToken;
        uint256 k;
        uint256 graduationMarketCap;
        uint8 feeDenominator;
        uint16 feeNumerator;
        uint24 dexFee; // Uniswap V3 fee tier (500, 3000, or 10000)
        uint16 creatorFeeShare; // Creator fee share in basis points (e.g., 1000 = 10%)
    }

    /// @notice Initialization parameters
    struct InitializeParams {
        address owner;
        address core;
        uint256 deployFee;
        uint256 listingFee;
        uint256 virtualNative;
        uint256 virtualToken;
        uint256 graduationMarketCap;
        uint8 feeDenominator;
        uint16 feeNumerator;
        address dexFactory;
        uint24 dexFee; // Uniswap V3 fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
    }

    /// @notice Emitted when factory is initialized
    event SetInitialize(
        uint256 deployFee,
        uint256 listingFee,
        uint256 virtualNative,
        uint256 virtualToken,
        uint256 k,
        uint256 graduationMarketCap,
        uint16 feeNumerator,
        uint8 feeDenominator,
        address dexFactory
    );

    /// @notice Emitted when a curve is created
    event Create(
        address indexed creator,
        address indexed curve,
        address indexed token,
        string tokenURI,
        string name,
        string symbol,
        uint256 virtualNative,
        uint256 virtualToken
    );

    /// @notice Emitted when core is updated
    event SetCore(address indexed core);

    /// @notice Emitted when DEX factory is updated
    event SetDexFactory(address indexed dexFactory);

    /// @notice Emitted when graduation market cap is updated
    event SetGraduationMarketCap(uint256 oldMarketCap, uint256 newMarketCap);

    /// @notice Emitted when creator fee share is updated
    event SetCreatorFeeShare(uint16 oldShare, uint16 newShare);

    /// @notice Emitted when owner is updated
    event SetOwner(address indexed newOwner);

    /// @notice Emitted when creator fees are accumulated
    event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated);

    /// @notice Emitted when creator fees are claimed
    event CreatorFeesClaimed(address indexed creator, uint256 amount);

    /// @notice Emitted when listing fee is updated
    event SetListingFee(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when deploy fee is updated
    event SetDeployFee(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when virtual reserves are updated
    event SetVirtualReserves(uint256 virtualNative, uint256 virtualToken, uint256 k);

    /// @notice Emitted when fee configuration is updated
    event SetFeeConfig(uint8 feeDenominator, uint16 feeNumerator);

    /// @notice Emitted when DEX fee tier is updated
    event SetDexFee(uint24 oldFee, uint24 newFee);

    /**
     * @notice Initialize factory with configuration
     * @param params Initialization parameters
     */
    function initialize(InitializeParams memory params) external;

    /**
     * @notice Create a new bonding curve and token
     * @param creator Creator address
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI Token metadata URI
     * @return curve Bonding curve address
     * @return token Token address
     * @return virtualNative Initial virtual native reserve
     * @return virtualToken Initial virtual token reserve
     */
    function create(
        address creator,
        string memory name,
        string memory symbol,
        string memory tokenURI
    ) external returns (address curve, address token, uint256 virtualNative, uint256 virtualToken);

    /**
     * @notice Get bonding curve for a token
     * @param token Token address
     * @return curve Bonding curve address
     */
    function getCurve(address token) external view returns (address curve);

    /**
     * @notice Get current configuration
     * @return config Current configuration
     */
    function getConfig() external view returns (Config memory config);

    /**
     * @notice Get core contract address
     * @return core Core contract address
     */
    function getCore() external view returns (address core);

    /**
     * @notice Get DEX factory address
     * @return dexFactory DEX factory address
     */
    function getDexFactory() external view returns (address dexFactory);

    /**
     * @notice Get deploy fee
     * @return deployFee Deploy fee amount
     */
    function getDeployFee() external view returns (uint256 deployFee);

    /**
     * @notice Get listing fee
     * @return listingFee Listing fee amount
     */
    function getListingFee() external view returns (uint256 listingFee);

    /**
     * @notice Get DEX fee tier (Uniswap V3)
     * @return dexFee Fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
     */
    function getDexFee() external view returns (uint24 dexFee);

    /**
     * @notice Get creator address for a token
     * @param token Token address
     * @return creator Creator address
     */
    function getCreator(address token) external view returns (address creator);
    
    /**
     * @notice Get creator fee share (percentage of trading fees that go to creator)
     * @return creatorFeeShare Creator fee share in basis points (e.g., 1000 = 10%)
     */
    function getCreatorFeeShare() external view returns (uint16 creatorFeeShare);

    /**
     * @notice Accumulate fees for a creator
     * @param creator Creator address
     * @param amount Fee amount to accumulate (must be approved by caller)
     * @dev Transfers tokens from caller and accumulates them for the creator
     */
    function accumulateCreatorFees(address creator, uint256 amount) external;

    /**
     * @notice Update graduation market cap threshold
     * @param _graduationMarketCap New graduation market cap threshold
     * @dev Only admin can call this. Only affects new curves created after update.
     */
    function setGraduationMarketCap(uint256 _graduationMarketCap) external;

    /**
     * @notice Update listing fee
     * @param _listingFee New listing fee amount
     * @dev Only admin can call this.
     */
    function setListingFee(uint256 _listingFee) external;

    /**
     * @notice Update deploy fee
     * @param _deployFee New deploy fee amount
     * @dev Only admin can call this.
     */
    function setDeployFee(uint256 _deployFee) external;

    /**
     * @notice Update virtual reserves for new curves
     * @param _virtualNative New virtual native reserve
     * @param _virtualToken New virtual token reserve
     * @dev Only admin can call this. Only affects new curves created after update.
     */
    function setVirtualReserves(uint256 _virtualNative, uint256 _virtualToken) external;

    /**
     * @notice Update fee configuration
     * @param _feeDenominator New fee denominator
     * @param _feeNumerator New fee numerator
     * @dev Only admin can call this. Only affects new curves created after update.
     */
    function setFeeConfig(uint8 _feeDenominator, uint16 _feeNumerator) external;

    /**
     * @notice Update DEX fee tier
     * @param _dexFee New DEX fee tier (500, 3000, or 10000)
     * @dev Only admin can call this. Only affects new curves created after update.
     */
    function setDexFee(uint24 _dexFee) external;
}

// src/utils/BondingCurveLibrary.sol

/**
 * @title BondingCurveLibrary
 * @notice Library for bonding curve calculations using constant product formula
 * @dev Implements x * y = k constant product AMM mechanics
 */
library BondingCurveLibrary {
    /// @notice Custom errors for gas efficiency
    error InsufficientInputAmount();
    error InsufficientLiquidity();
    error InsufficientOutputAmount();
    error InsufficientOutputReserve();
    error CurveNotFound();

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
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        // Calculate new reserve after adding input
        uint256 newReserveIn = reserveIn + amountIn;

        // Calculate new output reserve maintaining k
        uint256 newReserveOut = k / newReserveIn;

        // Output is the difference
        if (newReserveOut >= reserveOut) revert InsufficientOutputAmount();
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
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        if (amountOut >= reserveOut) revert InsufficientOutputReserve();

        // Calculate new reserve after removing output
        uint256 newReserveOut = reserveOut - amountOut;

        // Calculate new input reserve maintaining k
        uint256 newReserveIn = k / newReserveOut;

        // Input is the difference
        if (newReserveIn <= reserveIn) revert InsufficientInputAmount();
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
        if (curve == address(0)) revert CurveNotFound();

        (virtualNative, virtualToken) = IBondingCurve(curve).getVirtualReserves();
        k = IBondingCurve(curve).getK();
    }
}

