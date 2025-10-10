// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ITokenMarketplace
 * @dev Interface for the token marketplace with bonding curve
 */
interface ITokenMarketplace {
    /// @notice Token information structure
    struct TokenInfo {
        address tokenAddress;
        address creator;
        string metadataURI;
        uint256 totalSupply;
        uint256 currentSupply;
        uint256 reserveBalance;
        uint256 reserveRatio;
        bool tradingEnabled;
        uint256 launchTimestamp;
        uint256 marketCap;
    }
    
    /// @notice Emitted when a new token is listed
    event TokenListed(
        address indexed tokenAddress,
        address indexed creator,
        string metadataURI,
        uint256 totalSupply,
        uint256 reserveRatio
    );
    
    /// @notice Emitted when tokens are bought
    event TokensBought(
        address indexed tokenAddress,
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    
    /// @notice Emitted when tokens are sold
    event TokensSold(
        address indexed tokenAddress,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 newPrice
    );
    
    /// @notice Emitted when trading is enabled for a token
    event TradingEnabled(address indexed tokenAddress, uint256 timestamp);
    
    /// @notice Emitted when liquidity threshold is reached
    event LiquidityThresholdReached(address indexed tokenAddress, uint256 marketCap);

    /**
     * @notice List a new token on the marketplace
     * @param tokenAddress Address of the token contract
     * @param metadataURI IPFS URI containing token metadata
     * @param totalSupply Total supply of the token
     * @param reserveRatio Reserve ratio for bonding curve (in basis points)
     */
    function listToken(
        address tokenAddress,
        string calldata metadataURI,
        uint256 totalSupply,
        uint256 reserveRatio
    ) external;
    
    /**
     * @notice Buy tokens using bonding curve pricing
     * @param tokenAddress Address of the token to buy
     * @param minTokensOut Minimum tokens expected (slippage protection)
     */
    function buyTokens(address tokenAddress, uint256 minTokensOut) external payable;
    
    /**
     * @notice Sell tokens using bonding curve pricing
     * @param tokenAddress Address of the token to sell
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH expected (slippage protection)
     */
    function sellTokens(address tokenAddress, uint256 tokenAmount, uint256 minEthOut) external;
    
    /**
     * @notice Calculate token purchase price
     * @param tokenAddress Address of the token
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Amount of tokens that can be bought
     */
    function calculatePurchaseReturn(address tokenAddress, uint256 ethAmount) 
        external view returns (uint256 tokenAmount);
    
    /**
     * @notice Calculate token sale return
     * @param tokenAddress Address of the token
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount Amount of ETH that will be received
     */
    function calculateSaleReturn(address tokenAddress, uint256 tokenAmount) 
        external view returns (uint256 ethAmount);
    
    /**
     * @notice Get current token price
     * @param tokenAddress Address of the token
     * @return price Current price in ETH per token
     */
    function getCurrentPrice(address tokenAddress) external view returns (uint256 price);
    
    /**
     * @notice Get token information
     * @param tokenAddress Address of the token
     * @return tokenInfo Complete token information
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory tokenInfo);
    
    /**
     * @notice Get all listed tokens
     * @return tokens Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory tokens);
    
    /**
     * @notice Check if liquidity threshold is reached
     * @param tokenAddress Address of the token
     * @return True if threshold is reached
     */
    function isLiquidityThresholdReached(address tokenAddress) external view returns (bool);
}
