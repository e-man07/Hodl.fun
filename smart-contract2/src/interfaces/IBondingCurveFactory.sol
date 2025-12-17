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
        uint256 tokenTotalSupply;
        uint256 virtualNative;
        uint256 virtualToken;
        uint256 k;
        uint256 targetToken;
        uint8 feeDenominator;
        uint16 feeNumerator;
    }

    /// @notice Initialization parameters
    struct InitializeParams {
        uint256 deployFee;
        uint256 listingFee;
        uint256 tokenTotalSupply;
        uint256 virtualNative;
        uint256 virtualToken;
        uint256 targetToken;
        uint8 feeDenominator;
        uint16 feeNumerator;
        address dexFactory;
    }

    /// @notice Emitted when factory is initialized
    event SetInitialize(
        uint256 deployFee,
        uint256 listingFee,
        uint256 tokenTotalSupply,
        uint256 virtualNative,
        uint256 virtualToken,
        uint256 k,
        uint256 targetToken,
        uint8 feeNumerator,
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
    function getDelpyFee() external view returns (uint256 deployFee);

    /**
     * @notice Get listing fee
     * @return listingFee Listing fee amount
     */
    function getListingFee() external view returns (uint256 listingFee);
}

