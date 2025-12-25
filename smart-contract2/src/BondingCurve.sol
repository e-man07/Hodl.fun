// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IBondingCurve.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2ERC20.sol";
import "./interfaces/IBondingCurveFactory.sol";
import "./interfaces/ICore.sol";

/**
 * @title BondingCurve
 * @notice Upgradeable bonding curve contract implementing constant product AMM
 * @dev One bonding curve per token, uses UUPS upgradeable pattern
 */
contract BondingCurve is IBondingCurve, Initializable, UUPSUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Role for core contract
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    /// @notice Immutable factory address
    address public immutable factory;
    
    /// @notice Immutable core address
    address public immutable core;
    
    /// @notice Immutable wrapped native token
    address public immutable wNative;
    
    /// @notice Token address
    address public token;
    
    /// @notice Uniswap pair address (set after listing)
    address public pair;
    
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
     * @param _virtualNative Initial virtual native reserve
     * @param _virtualToken Initial virtual token reserve
     * @param _k Constant product parameter
     * @param _graduationMarketCap Market cap threshold for graduation (in native currency)
     * @param _feeDenominator Fee denominator
     * @param _feeNumerator Fee numerator
     */
    function initialize(
        address _token,
        uint256 _virtualNative,
        uint256 _virtualToken,
        uint256 _k,
        uint256 _graduationMarketCap,
        uint8 _feeDenominator,
        uint16 _feeNumerator
    ) external initializer {
        if (msg.sender != factory) {
            revert OnlyFactory();
        }

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

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

        _grantRole(DEFAULT_ADMIN_ROLE, core);
        _grantRole(CORE_ROLE, core);

        // Initialize real reserves
        realNativeReserves = IERC20(wNative).balanceOf(address(this));
        realTokenReserves = IERC20(_token).balanceOf(address(this));
    }

    /**
     * @notice Execute a buy order
     * @param to Recipient address
     * @param amountOut Amount of tokens to buy (before fee deduction)
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     */
    function buy(address to, uint256 amountOut) external override nonReentrant onlyRole(CORE_ROLE) {
        // Checks
        if (lock) {
            revert BondingCurveLocked();
        }
        if (amountOut == 0) {
            revert InvalidAmountOut();
        }
        if (to == wNative || to == token) {
            revert InvalidTo();
        }

        address _wNative = wNative;
        address _token = token;

        (uint256 _realNativeReserves, uint256 _realTokenReserves) = getReserves();

        // Calculate fee: deduct fee from token output
        Fee memory fee = feeConfig;
        uint256 feeAmount = (amountOut * fee.numerator) / fee.denominator;
        uint256 tokensToUser = amountOut - feeAmount;

        // Get balance of native tokens (should be increased by amount sent from Core)
        uint256 balanceNative = IERC20(_wNative).balanceOf(address(this));
        uint256 amountNativeIn = balanceNative - _realNativeReserves;
        
        // Effects: Update state FIRST (CEI pattern)
        _update(amountNativeIn, amountOut, true);
        
        if (virtualNative * virtualToken < k) {
            revert InvalidK();
        }
        
        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        uint256 price = (virtualNative * 1e18) / virtualToken;
        
        // Interactions: Transfer AFTER state update (CEI pattern)
        IERC20(_token).safeTransfer(to, tokensToUser);
        
        // Emit event with actual amounts (tokensToUser is what user receives)
        emit Buy(to, token, amountNativeIn, tokensToUser, price, block.timestamp);
        _checkTarget();
    }

    /**
     * @notice Execute a sell order
     * @param to Recipient address
     * @param amountOut Amount of native to receive (before fee deduction)
     * @dev Follows CEI pattern: Checks → Effects → Interactions
     */
    function sell(address to, uint256 amountOut) external override nonReentrant onlyRole(CORE_ROLE) {
        // Checks
        if (lock) {
            revert BondingCurveLocked();
        }
        if (amountOut == 0) {
            revert InvalidAmountOut();
        }
        if (to == wNative || to == token) {
            revert InvalidTo();
        }

        address _wNative = wNative;
        address _token = token;
        
        (uint256 _realNativeReserves, uint256 _realTokenReserves) = getReserves();
        if (amountOut > _realNativeReserves) {
            revert InvalidAmountOut();
        }

        // Calculate fee: deduct fee from native output
        Fee memory fee = feeConfig;
        uint256 feeAmount = (amountOut * fee.numerator) / fee.denominator;
        uint256 nativeToUser = amountOut - feeAmount;

        // Get balance of tokens (should be increased by amount sent from Core)
        uint256 balanceToken = IERC20(_token).balanceOf(address(this));
        uint256 amountTokenIn = balanceToken - _realTokenReserves;
        if (amountTokenIn == 0) {
            revert InvalidAmountIn();
        }

        address feeVault = ICore(core).getFeeVault();

        // Effects: Update state FIRST (CEI pattern)
        _update(amountTokenIn, amountOut, false);
        
        if (virtualNative * virtualToken < k) {
            revert InvalidK();
        }
        
        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        uint256 price = (virtualNative * 1e18) / virtualToken;
        
        // Interactions: Transfer AFTER state update (CEI pattern)
        IERC20(_wNative).safeTransfer(to, nativeToUser);
        // Transfer fee to vault
        if (feeAmount > 0) {
            IERC20(_wNative).safeTransfer(feeVault, feeAmount);
        }
        
        // Emit event with actual amounts (nativeToUser is what user receives)
        emit Sell(to, token, amountTokenIn, nativeToUser, price, block.timestamp);
        _checkTarget();
    }

    /**
     * @notice List token on Uniswap after reaching target
     * @return pair_ Address of the created pair
     * @dev Protected by nonReentrant and checks listingFee <= realNativeReserves
     */
    function listing() external override nonReentrant returns (address pair_) {
        if (!lock) {
            revert OnlyLock();
        }
        if (isListing) {
            revert AlreadyListed();
        }

        IBondingCurveFactory _factory = IBondingCurveFactory(factory);
        address dexFactory = _factory.getDexFactory();
        pair_ = IUniswapV2Factory(dexFactory).createPair(wNative, token);
        pair = pair_;

        uint256 listingFee = _factory.getListingFee();

        // Validate that listing fee doesn't exceed available reserves
        if (listingFee > realNativeReserves) {
            revert InsufficientNativeReserves();
        }

        // Calculate and burn excess tokens (with underflow protection)
        uint256 burnTokenAmount;
        {
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
                IERC20(wNative).safeTransfer(ICore(_factory.getCore()).getFeeVault(), listingFee);
            }
        }

        uint256 listingNativeAmount = IERC20(wNative).balanceOf(address(this));
        uint256 listingTokenAmount = IERC20(token).balanceOf(address(this));
        
        // Use safeTransfer instead of transfer for safety
        IERC20(wNative).safeTransfer(pair_, listingNativeAmount);
        IERC20(token).safeTransfer(pair_, listingTokenAmount);

        // Reset reserves and provide liquidity
        realNativeReserves = 0;
        realTokenReserves = 0;
        uint256 liquidity = IUniswapV2Pair(pair_).mint(address(this));

        // Burn LP tokens using safeTransfer for consistency
        IERC20(pair_).safeTransfer(address(0), liquidity);
        
        isListing = true;
        emit Listing(address(this), token, pair_, listingNativeAmount, listingTokenAmount, liquidity);
        
        return pair_;
    }

    /**
     * @notice Update virtual and real reserves after trades
     * @param amountIn Amount coming in
     * @param amountOut Amount going out
     * @param isBuy Whether this is a buy order
     */
    function _update(uint256 amountIn, uint256 amountOut, bool isBuy) private {
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

        // Calculate price from virtual reserves: price per token = virtualNative / virtualToken (scaled by 1e18)
        // virtualToken is guaranteed to be > 0 at this point (checked in initialize and maintained by logic)
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
     * @notice Get current token price
     * @return price Current price per token in native currency (scaled by 1e18)
     * @dev Price is calculated from virtual reserves: price = virtualNative / virtualToken
     */
    function getCurrentPrice() public view override returns (uint256 price) {
        if (virtualToken == 0) {
            return 0;
        }
        price = (virtualNative * 1e18) / virtualToken;
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
     * @notice Authorize upgrade (only admin)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

