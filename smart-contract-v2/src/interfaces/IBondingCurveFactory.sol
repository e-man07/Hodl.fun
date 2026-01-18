// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

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

