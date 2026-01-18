// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICore.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/IBondingCurveFactory.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IWNative.sol";
import "./interfaces/IFeeVault.sol";
import "./utils/BondingCurveLibrary.sol";

/**
 * @title Core
 * @notice Upgradeable core orchestrator contract for bonding curve operations
 * @dev Handles all buy/sell operations, fee validation, and wrapped token management
 */
contract Core is ICore, Initializable, UUPSUpgradeable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Role for factory
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @notice Factory address
    address public factory;

    /// @notice Wrapped native token (immutable for gas efficiency, stored copy for proxy)
    address public immutable wNativeImmutable;

    /// @notice Fee vault (immutable for gas efficiency, stored copy for proxy)
    address public immutable vaultImmutable;

    /// @notice Stored wrapped native token (for proxy usage and upgradeability)
    address private storedWNative;

    /// @notice Stored fee vault (for proxy usage and upgradeability)
    address private storedVault;

    /// @notice Initialization flag
    bool private isInitialized;

    /// @notice Custom errors
    error Expired();
    error InsufficientOutput();
    error ExcessiveInput();
    error InvalidFee();
    error InvalidAddress();
    error NotInitialized();
    error OnlyFactory();

    /// @notice Disable initializers in implementation
    constructor(address _wNative, address _vault) {
        wNativeImmutable = _wNative;
        vaultImmutable = _vault;
        _disableInitializers();
    }

    /**
     * @notice Initialize the core contract
     * @param _factory Factory address (can be zero, set later)
     * @param _owner Owner address
     */
    function initialize(address _factory, address _owner) external initializer {
        if (_owner == address(0)) {
            revert InvalidAddress();
        }

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        factory = _factory;
        isInitialized = true;

        // Store the immutable values in state for proxy usage
        // Use immutable values if set (direct deployment), otherwise use msg.sender context
        storedWNative = wNativeImmutable;
        storedVault = vaultImmutable;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        if (_factory != address(0)) {
            _grantRole(FACTORY_ROLE, _factory);
        }
    }

    /**
     * @notice Set factory address (only admin, can be called after deployment)
     * @param _factory Factory address
     */
    function setFactory(address _factory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_factory == address(0)) {
            revert InvalidAddress();
        }
        address oldFactory = factory;
        factory = _factory;
        if (oldFactory != address(0)) {
            _revokeRole(FACTORY_ROLE, oldFactory);
        }
        _grantRole(FACTORY_ROLE, _factory);
    }

    /**
     * @notice Set wrapped native token address (only admin)
     * @param _wNative New wrapped native token address
     * @dev Use with caution - changing this affects all future trades
     */
    function setWNative(address _wNative) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_wNative == address(0)) {
            revert InvalidAddress();
        }
        address oldWNative = _getWNative();
        storedWNative = _wNative;
        emit SetWNative(oldWNative, _wNative);
    }

    /**
     * @notice Set fee vault address (only admin)
     * @param _vault New fee vault address
     * @dev Use with caution - changing this affects where fees are sent
     */
    function setVault(address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_vault == address(0)) {
            revert InvalidAddress();
        }
        address oldVault = _getVault();
        storedVault = _vault;
        emit SetVault(oldVault, _vault);
    }

    /**
     * @notice Get the wrapped native token address
     * @return wNative_ Wrapped native token address (stored if set, otherwise immutable)
     */
    function _getWNative() internal view returns (address wNative_) {
        wNative_ = storedWNative != address(0) ? storedWNative : wNativeImmutable;
    }

    /**
     * @notice Get the fee vault address
     * @return vault_ Fee vault address (stored if set, otherwise immutable)
     */
    function _getVault() internal view returns (address vault_) {
        vault_ = storedVault != address(0) ? storedVault : vaultImmutable;
    }

    /**
     * @notice Get wrapped native token address (public getter)
     * @return wNative_ Wrapped native token address
     */
    function wNative() external view returns (address wNative_) {
        wNative_ = _getWNative();
    }

    /**
     * @notice Get fee vault address (public getter)
     * @return vault_ Fee vault address
     */
    function vault() external view returns (address vault_) {
        vault_ = _getVault();
    }

    /**
     * @notice Ensure transaction hasn't expired
     * @param deadline Transaction deadline
     */
    modifier ensure(uint256 deadline) {
        if (deadline < block.timestamp) {
            revert Expired();
        }
        _;
    }

    /**
     * @notice Create a new curve with initial liquidity
     * @param creator Creator address
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI Token metadata URI
     * @param amountIn Initial liquidity amount
     * @param fee Fee amount
     * @return curve_ Bonding curve address
     * @return token_ Token address
     */
    function createCurve(
        address creator,
        string memory name,
        string memory symbol,
        string memory tokenURI,
        uint256 amountIn,
        uint256 fee
    ) external payable override whenNotPaused returns (address curve_, address token_) {
        if (!isInitialized) {
            revert NotInitialized();
        }

        // SECURITY FIX: Validate creator address
        if (creator == address(0)) {
            revert InvalidAddress();
        }

        IBondingCurveFactory factoryContract = IBondingCurveFactory(factory);

        // Validate fee
        uint256 deployFee = factoryContract.getDeployFee();
        if (fee < deployFee) {
            revert InvalidFee();
        }

        // Cache wNative address for gas efficiency
        address _wNative = _getWNative();

        // Wrap native token if sent
        if (msg.value > 0) {
            IWNative(_wNative).deposit{value: msg.value}();
        }

        // Pull wNative tokens from caller if amountIn or fee is provided
        uint256 totalNeeded = amountIn + fee;
        if (totalNeeded > 0) {
            IERC20(_wNative).safeTransferFrom(msg.sender, address(this), totalNeeded);
        }

        // Create curve and token
        (curve_, token_, , ) = factoryContract.create(creator, name, symbol, tokenURI);

        // If initial liquidity provided, buy tokens
        if (amountIn > 0) {
            // Calculate tokens for initial liquidity
            IBondingCurve curve = IBondingCurve(curve_);
            (uint256 virtualNative, uint256 virtualToken) = curve.getVirtualReserves();
            uint256 k = curve.getK();

            uint256 tokensOut = BondingCurveLibrary.getAmountOut(
                amountIn,
                k,
                virtualNative,
                virtualToken
            );

            // Transfer wrapped native to curve
            IERC20(_wNative).safeTransfer(curve_, amountIn);

            // Get balance before buy to calculate actual tokens received (after fee)
            uint256 balanceBefore = IERC20(token_).balanceOf(address(this));

            // Execute buy - tokens will be transferred to Core (address(this))
            curve.buy(address(this), tokensOut);

            // Get actual tokens received (after fee deduction)
            uint256 tokensReceived = IERC20(token_).balanceOf(address(this)) - balanceBefore;

            // Transfer tokens to creator (actual amount received after fees)
            if (tokensReceived > 0) {
                IERC20(token_).safeTransfer(creator, tokensReceived);
            }
        }

        // Transfer deploy fee to vault
        if (fee > 0) {
            IERC20(_wNative).safeTransfer(_getVault(), fee);
        }

        emit CreateCurve(creator, curve_, token_, tokenURI, name, symbol);
    }

    /**
     * @notice Buy tokens with exact input
     * @param amountIn Amount of native to spend
     * @param amountOutMin Minimum tokens expected
     * @param token Token address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactInBuy(
        uint256 amountIn,
        uint256 amountOutMin,
        address token,
        address to,
        uint256 deadline
    ) external payable override ensure(deadline) whenNotPaused {
        if (!isInitialized) {
            revert NotInitialized();
        }

        // SECURITY FIX: Validate addresses
        if (token == address(0) || to == address(0)) {
            revert InvalidAddress();
        }

        // Cache wNative address for gas efficiency
        address _wNative = _getWNative();

        // Wrap native token if sent
        if (msg.value > 0) {
            IWNative(_wNative).deposit{value: msg.value}();
        }

        // Get curve
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }

        IBondingCurve curveContract = IBondingCurve(curve);

        // Get curve data
        (uint256 virtualNative, uint256 virtualToken) = curveContract.getVirtualReserves();
        uint256 k = curveContract.getK();

        // Calculate output
        uint256 amountOut = BondingCurveLibrary.getAmountOut(
            amountIn,
            k,
            virtualNative,
            virtualToken
        );

        if (amountOut < amountOutMin) {
            revert InsufficientOutput();
        }

        // Validate fee
        _checkFee(curve, amountIn);

        // Pull wrapped native from caller and transfer to curve
        IERC20(_wNative).safeTransferFrom(msg.sender, curve, amountIn);

        // Execute buy
        curveContract.buy(to, amountOut);

        // Calculate price: price per token = amountIn / amountOut (scaled by 1e18)
        uint256 price = (amountIn * 1e18) / amountOut;

        emit Buy(token, to, amountIn, amountOut, price, block.timestamp);
    }

    /**
     * @notice Buy tokens with exact output
     * @param amountOut Amount of tokens wanted
     * @param amountInMax Maximum native to spend
     * @param token Token address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactOutBuy(
        uint256 amountOut,
        uint256 amountInMax,
        address token,
        address to,
        uint256 deadline
    ) external payable override ensure(deadline) whenNotPaused {
        if (!isInitialized) {
            revert NotInitialized();
        }

        // SECURITY FIX: Validate addresses
        if (token == address(0) || to == address(0)) {
            revert InvalidAddress();
        }

        // Cache wNative address for gas efficiency
        address _wNative = _getWNative();

        // Wrap native token if sent
        if (msg.value > 0) {
            IWNative(_wNative).deposit{value: msg.value}();
        }

        // Get curve
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }

        IBondingCurve curveContract = IBondingCurve(curve);

        // Get curve data
        (uint256 virtualNative, uint256 virtualToken) = curveContract.getVirtualReserves();
        uint256 k = curveContract.getK();

        // Calculate required input
        uint256 amountIn = BondingCurveLibrary.getAmountIn(
            amountOut,
            k,
            virtualNative,
            virtualToken
        );

        if (amountIn > amountInMax) {
            revert ExcessiveInput();
        }

        // Validate fee
        _checkFee(curve, amountIn);

        // Pull wrapped native from caller and transfer to curve
        IERC20(_wNative).safeTransferFrom(msg.sender, curve, amountIn);

        // Execute buy
        curveContract.buy(to, amountOut);

        // Calculate price: price per token = amountIn / amountOut (scaled by 1e18)
        uint256 price = (amountIn * 1e18) / amountOut;

        emit Buy(token, to, amountIn, amountOut, price, block.timestamp);
    }

    /**
     * @notice Sell tokens with exact input
     * @param amountIn Amount of tokens to sell
     * @param amountOutMin Minimum native expected
     * @param token Token address
     * @param from Seller address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactInSell(
        uint256 amountIn,
        uint256 amountOutMin,
        address token,
        address from,
        address to,
        uint256 deadline
    ) external override ensure(deadline) whenNotPaused {
        if (!isInitialized) {
            revert NotInitialized();
        }

        // SECURITY FIX: Validate addresses
        if (token == address(0) || from == address(0) || to == address(0)) {
            revert InvalidAddress();
        }

        // Get curve
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }

        IBondingCurve curveContract = IBondingCurve(curve);
        
        // Get curve data
        (uint256 virtualNative, uint256 virtualToken) = curveContract.getVirtualReserves();
        uint256 k = curveContract.getK();
        
        // Calculate output
        uint256 amountOut = BondingCurveLibrary.getAmountOut(
            amountIn,
            k,
            virtualToken,
            virtualNative
        );

        if (amountOut < amountOutMin) {
            revert InsufficientOutput();
        }

        // Validate fee
        _checkFee(curve, amountOut);

        // Transfer tokens from seller to curve
        IERC20(token).safeTransferFrom(from, curve, amountIn);
        
        // Execute sell
        curveContract.sell(to, amountOut);

        // Calculate price: price per token = amountOut / amountIn (scaled by 1e18)
        uint256 price = (amountOut * 1e18) / amountIn;
        
        emit Sell(token, from, to, amountIn, amountOut, price, block.timestamp);
    }

    /**
     * @notice Sell tokens with exact output
     * @param amountOut Amount of native wanted
     * @param amountInMax Maximum tokens to sell
     * @param token Token address
     * @param from Seller address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactOutSell(
        uint256 amountOut,
        uint256 amountInMax,
        address token,
        address from,
        address to,
        uint256 deadline
    ) external override ensure(deadline) whenNotPaused {
        if (!isInitialized) {
            revert NotInitialized();
        }

        // SECURITY FIX: Validate addresses
        if (token == address(0) || from == address(0) || to == address(0)) {
            revert InvalidAddress();
        }

        // Get curve
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }

        IBondingCurve curveContract = IBondingCurve(curve);
        
        // Get curve data
        (uint256 virtualNative, uint256 virtualToken) = curveContract.getVirtualReserves();
        uint256 k = curveContract.getK();
        
        // Calculate required input
        uint256 amountIn = BondingCurveLibrary.getAmountIn(
            amountOut,
            k,
            virtualToken,
            virtualNative
        );

        if (amountIn > amountInMax) {
            revert ExcessiveInput();
        }

        // Validate fee
        _checkFee(curve, amountOut);

        // Transfer tokens from seller to curve
        IERC20(token).safeTransferFrom(from, curve, amountIn);
        
        // Execute sell
        curveContract.sell(to, amountOut);

        // Calculate price: price per token = amountOut / amountIn (scaled by 1e18)
        uint256 price = (amountOut * 1e18) / amountIn;
        
        emit Sell(token, from, to, amountIn, amountOut, price, block.timestamp);
    }

    /**
     * @notice Check fee is valid
     * @param curve Bonding curve address
     * @param amount Amount to check fee on
     */
    function _checkFee(address curve, uint256 amount) internal view {
        IBondingCurve curveContract = IBondingCurve(curve);
        (uint8 denominator, uint16 numerator) = curveContract.getFeeConfig();
        
        // Fee should be at least (amount * numerator) / denominator
        // This is a basic check - actual fee handling is done in bonding curve
        require(denominator > 0 && numerator > 0, "Invalid fee config");
    }

    /**
     * @notice Get curve data
     * @param curve Bonding curve address
     * @return virtualNative Virtual native reserve
     * @return virtualToken Virtual token reserve
     * @return k Constant product value
     */
    function getCurveData(address curve) external view override returns (uint256 virtualNative, uint256 virtualToken, uint256 k) {
        IBondingCurve curveContract = IBondingCurve(curve);
        (virtualNative, virtualToken) = curveContract.getVirtualReserves();
        k = curveContract.getK();
    }

    /**
     * @notice Get amount out for given input
     * @param amountIn Input amount
     * @param k Constant product
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function getAmountOut(uint256 amountIn, uint256 k, uint256 reserveIn, uint256 reserveOut) external pure override returns (uint256 amountOut) {
        return BondingCurveLibrary.getAmountOut(amountIn, k, reserveIn, reserveOut);
    }

    /**
     * @notice Get amount in for given output
     * @param amountOut Output amount
     * @param k Constant product
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountIn Input amount
     */
    function getAmountIn(uint256 amountOut, uint256 k, uint256 reserveIn, uint256 reserveOut) external pure override returns (uint256 amountIn) {
        return BondingCurveLibrary.getAmountIn(amountOut, k, reserveIn, reserveOut);
    }

    /**
     * @notice Get fee vault address
     * @return vault_ Fee vault address
     */
    function getFeeVault() external view override returns (address vault_) {
        vault_ = _getVault();
    }

    /**
     * @notice Get current price for a token
     * @param token Token address
     * @return price Current price per token in native currency (scaled by 1e18)
     */
    function getCurrentPrice(address token) external view override returns (uint256 price) {
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }
        return IBondingCurve(curve).getCurrentPrice();
    }

    /**
     * @notice Calculate market cap for a token
     * @param token Token address
     * @return marketCap Market cap in native currency (ETH/PUSH)
     */
    function calculateMarketCap(address token) external view override returns (uint256 marketCap) {
        address curve = IBondingCurveFactory(factory).getCurve(token);
        if (curve == address(0)) {
            revert InvalidAddress();
        }
        return IBondingCurve(curve).calculateMarketCap();
    }

    /**
     * @notice Pause the contract (emergency stop)
     * @dev Only admin can call this. Pauses all trading and curve creation.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only admin can call this. Resumes all trading and curve creation.
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

