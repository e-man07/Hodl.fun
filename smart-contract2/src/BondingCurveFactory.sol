// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IBondingCurveFactory.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/IToken.sol";
import "./BondingCurve.sol";
import "./Token.sol";

/**
 * @title BondingCurveFactory
 * @notice Upgradeable factory for creating bonding curves and tokens
 * @dev Uses UUPS upgradeable pattern, manages global configuration
 */
contract BondingCurveFactory is IBondingCurveFactory, Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    /// @notice Role for core contract
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    /// @notice Owner address
    address private owner;
    
    /// @notice Core contract address
    address private core;
    
    /// @notice DEX factory address
    address private dexFactory;
    
    /// @notice Wrapped native token address
    address public immutable wNative;
    
    /// @notice Global configuration
    Config private config;
    
    /// @notice Mapping from token to bonding curve
    mapping(address => address) private curves;

    /// @notice Custom errors
    error OnlyOwner();
    error OnlyCore();
    error InvalidAddress();
    error NotInitialized();
    error InvalidReserves();
    error InvalidFeeConfig();

    /// @notice Disable initializers in implementation
    constructor(address _wNative) {
        wNative = _wNative;
        _disableInitializers();
    }

    /**
     * @notice Initialize the factory
     * @param params Initialization parameters
     */
    function initialize(InitializeParams memory params) external initializer {
        if (params.owner == address(0) || params.core == address(0)) {
            revert InvalidAddress();
        }

        __UUPSUpgradeable_init();
        __AccessControl_init();

        // Validate reserves
        if (params.virtualNative == 0 || params.virtualToken == 0) {
            revert InvalidReserves();
        }
        
        // Validate fee configuration
        if (params.feeDenominator == 0) {
            revert InvalidFeeConfig();
        }
        if (params.feeNumerator >= params.feeDenominator) {
            revert InvalidFeeConfig(); // Fee must be < 100%
        }

        owner = params.owner;
        core = params.core;
        dexFactory = params.dexFactory;

        // Validate DEX fee tier
        if (params.dexFee != 500 && params.dexFee != 3000 && params.dexFee != 10000) {
            revert InvalidFeeConfig(); // Must be valid V3 fee tier
        }

        uint256 k = params.virtualNative * params.virtualToken;
        config = Config(
            params.deployFee,
            params.listingFee,
            params.virtualNative,
            params.virtualToken,
            k,
            params.graduationMarketCap,
            params.feeDenominator,
            params.feeNumerator,
            params.dexFee
        );

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner);
        _grantRole(CORE_ROLE, params.core);

        emit SetInitialize(
            params.deployFee,
            params.listingFee,
            params.virtualNative,
            params.virtualToken,
            k,
            params.graduationMarketCap,
            params.feeNumerator,
            params.feeDenominator,
            dexFactory
        );
    }

    /**
     * @notice Create a new bonding curve and token
     * @param creator Creator address
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI Token metadata URI
     * @return curve Bonding curve address
     * @return token_ Token address
     * @return virtualNative Initial virtual native reserve
     * @return virtualToken Initial virtual token reserve
     */
    function create(
        address creator,
        string memory name,
        string memory symbol,
        string memory tokenURI
    ) external override onlyRole(CORE_ROLE) returns (
        address curve,
        address token_,
        uint256 virtualNative,
        uint256 virtualToken
    ) {
        // SECURITY FIX: Validate creator address
        if (creator == address(0)) {
            revert InvalidAddress();
        }
        
        Config memory _config = getConfig();
        if (_config.virtualNative == 0) {
            revert NotInitialized();
        }

        // Deploy bonding curve
        curve = address(new BondingCurve(core, wNative));
        
        // Deploy token
        Token tokenContract = new Token();
        token_ = address(tokenContract);
        
        // Initialize token
        tokenContract.initialize(name, symbol, tokenURI, core);
        
        // Set bonding curve role on token FIRST (required for mint)
        tokenContract.setBondingCurve(curve);
        
        // Mint tokens to bonding curve (now curve has the role)
        IToken(token_).mint(curve);

        // Initialize bonding curve
        IBondingCurve(curve).initialize(
            token_,
            _config.virtualNative,
            _config.virtualToken,
            _config.k,
            _config.graduationMarketCap,
            _config.feeDenominator,
            _config.feeNumerator
        );

        curves[token_] = curve;
        virtualNative = _config.virtualNative;
        virtualToken = _config.virtualToken;

        emit Create(creator, curve, token_, tokenURI, name, symbol, virtualNative, virtualToken);
    }

    /**
     * @notice Update owner
     * @param _owner New owner address
     */
    function setOwner(address _owner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_owner == address(0)) {
            revert InvalidAddress();
        }
        owner = _owner;
    }

    /**
     * @notice Update core contract
     * @param _core New core address
     */
    function setCore(address _core) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_core == address(0)) {
            revert InvalidAddress();
        }
        address oldCore = core;
        core = _core;
        _grantRole(CORE_ROLE, _core);
        _revokeRole(CORE_ROLE, oldCore);
        emit SetCore(_core);
    }

    /**
     * @notice Update DEX factory
     * @param _dexFactory New DEX factory address
     */
    function setDexFactory(address _dexFactory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_dexFactory == address(0)) {
            revert InvalidAddress();
        }
        dexFactory = _dexFactory;
        emit SetDexFactory(_dexFactory);
    }

    /**
     * @notice Get bonding curve for a token
     * @param token Token address
     * @return curve Bonding curve address
     */
    function getCurve(address token) external view override returns (address curve) {
        curve = curves[token];
    }

    /**
     * @notice Get current configuration
     * @return config_ Current configuration
     */
    function getConfig() public view override returns (Config memory config_) {
        config_ = config;
    }

    /**
     * @notice Get core contract address
     * @return core_ Core contract address
     */
    function getCore() external view override returns (address core_) {
        core_ = core;
    }

    /**
     * @notice Get DEX factory address
     * @return dexFactory_ DEX factory address
     */
    function getDexFactory() external view override returns (address dexFactory_) {
        dexFactory_ = dexFactory;
    }

    /**
     * @notice Get deploy fee
     * @return deployFee Deploy fee amount
     */
    function getDeployFee() external view override returns (uint256 deployFee) {
        deployFee = config.deployFee;
    }

    /**
     * @notice Get deploy fee (legacy typo support for backward compatibility)
     * @return deployFee Deploy fee amount
     * @dev Deprecated: Use getDeployFee() instead
     */
    function getDelpyFee() external view returns (uint256 deployFee) {
        deployFee = config.deployFee;
    }

    /**
     * @notice Get listing fee
     * @return listingFee Listing fee amount
     */
    function getListingFee() external view override returns (uint256 listingFee) {
        listingFee = config.listingFee;
    }

    /**
     * @notice Get DEX fee tier (Uniswap V3)
     * @return dexFee_ Fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
     */
    function getDexFee() external view override returns (uint24 dexFee_) {
        dexFee_ = config.dexFee;
    }

    /**
     * @notice Update graduation market cap threshold
     * @param _graduationMarketCap New graduation market cap threshold (in native currency)
     * @dev Only admin can call this. Only affects new curves created after this update.
     *      Existing curves keep their original threshold.
     */
    function setGraduationMarketCap(uint256 _graduationMarketCap) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldMarketCap = config.graduationMarketCap;
        config.graduationMarketCap = _graduationMarketCap;
        emit SetGraduationMarketCap(oldMarketCap, _graduationMarketCap);
    }

    /**
     * @notice Get owner address
     * @return owner_ Owner address
     */
    function getOwner() external view returns (address owner_) {
        owner_ = owner;
    }

    /**
     * @notice Authorize upgrade (only admin)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

