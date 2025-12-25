// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

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
    event Listing(address indexed curve, address indexed token, address indexed pair, uint256 nativeAmount, uint256 tokenAmount, uint256 liquidity);
    
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

    /**
     * @notice Initialize the bonding curve
     * @param _token Token address
     * @param _virtualNative Initial virtual native reserve
     * @param _virtualToken Initial virtual token reserve
     * @param _k Constant product parameter
     * @param _targetToken Target token amount for listing
     * @param _feeDenominator Fee denominator
     * @param _feeNumerator Fee numerator
     */
    function initialize(
        address _token,
        uint256 _virtualNative,
        uint256 _virtualToken,
        uint256 _k,
        uint256 _targetToken,
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
     * @return pair Address of the created pair
     */
    function listing() external returns (address pair);

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
     * @notice Get target token amount
     * @return targetToken Target token amount
     */
    function getTargetToken() external view returns (uint256 targetToken);

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
}

