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

    /// @notice Disable initializers in implementation
    constructor(address _wNative) {
        wNative = _wNative;
        _disableInitializers();
    }

    /**
     * @notice Initialize the factory
     * @param _owner Owner address
     * @param _core Core contract address
     * @param params Initialization parameters
     */
    function initialize(
        address _owner,
        address _core,
        InitializeParams memory params
    ) external initializer {
        if (_owner == address(0) || _core == address(0)) {
            revert InvalidAddress();
        }

        __UUPSUpgradeable_init();
        __AccessControl_init();

        owner = _owner;
        core = _core;
        dexFactory = params.dexFactory;

        uint256 k = params.virtualNative * params.virtualToken;
        config = Config(
            params.deployFee,
            params.listingFee,
            params.tokenTotalSupply,
            params.virtualNative,
            params.virtualToken,
            k,
            params.targetToken,
            params.feeDenominator,
            params.feeNumerator
        );

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(CORE_ROLE, _core);

        emit SetInitialize(
            params.deployFee,
            params.listingFee,
            params.tokenTotalSupply,
            params.virtualNative,
            params.virtualToken,
            k,
            params.targetToken,
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
        
        // Mint tokens to bonding curve
        IToken(token_).mint(curve);
        
        // Set bonding curve role on token
        tokenContract.setBondingCurve(curve);

        // Initialize bonding curve
        IBondingCurve(curve).initialize(
            token_,
            _config.virtualNative,
            _config.virtualToken,
            _config.k,
            _config.targetToken,
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
    function getDelpyFee() external view override returns (uint256 deployFee) {
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

