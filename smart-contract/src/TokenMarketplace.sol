// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ITokenMarketplace.sol";
import "./interfaces/ILaunchpadToken.sol";

/**
 * @title TokenMarketplace
 * @dev Marketplace contract with bonding curve mechanics for token trading
 * @notice Implements automated market making using bonding curves
 */
contract TokenMarketplace is ITokenMarketplace, Ownable, ReentrancyGuard, Pausable {
    // SafeMath not needed in Solidity 0.8+ due to built-in overflow protection
    using SafeERC20 for IERC20;

    /// @notice Basis points for percentage calculations (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Maximum reserve ratio (90%)
    uint256 public constant MAX_RESERVE_RATIO = 9000;
    
    /// @notice Minimum reserve ratio (10%)
    uint256 public constant MIN_RESERVE_RATIO = 1000;
    
    /// @notice Liquidity threshold for enabling trading (100 ETH market cap)
    uint256 public constant LIQUIDITY_THRESHOLD = 100 ether;
    
    /// @notice Platform fee in basis points (1% = 100 bp)
    uint256 public platformFee = 100;
    
    /// @notice Creator fee in basis points (0.5% = 50 bp)
    uint256 public creatorFee = 50;

    /// @notice Mapping of token address to token information
    mapping(address => TokenInfo) public tokenInfos;
    
    /// @notice Array of all listed tokens
    address[] public listedTokens;
    
    /// @notice Mapping to check if token is listed
    mapping(address => bool) public isTokenListed;
    
    /// @notice Platform fee collector address
    address public feeCollector;
    
    /// @notice Token factory address
    address public tokenFactory;

    /// @notice Custom errors for gas efficiency
    error TokenNotListed();
    error TokenAlreadyListed();
    error InvalidReserveRatio();
    error InsufficientETH();
    error InsufficientTokens();
    error SlippageExceeded();
    error TradingAlreadyEnabled();
    error InvalidFeePercentage();
    error InvalidAddress();
    error OnlyTokenFactory();
    error LiquidityThresholdNotReached();

    /// @notice Events for better indexing
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event CreatorFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /**
     * @notice Constructor
     * @param _feeCollector Address to collect platform fees
     * @param _tokenFactory Address of the token factory
     */
    constructor(address _feeCollector, address _tokenFactory) Ownable(msg.sender) {
        if (_feeCollector == address(0) || _tokenFactory == address(0)) {
            revert InvalidAddress();
        }
        feeCollector = _feeCollector;
        tokenFactory = _tokenFactory;
    }

    /**
     * @notice Modifier to check if caller is token factory
     */
    modifier onlyTokenFactory() {
        if (msg.sender != tokenFactory) {
            revert OnlyTokenFactory();
        }
        _;
    }

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
    ) external override onlyTokenFactory {
        if (isTokenListed[tokenAddress]) {
            revert TokenAlreadyListed();
        }
        if (reserveRatio < MIN_RESERVE_RATIO || reserveRatio > MAX_RESERVE_RATIO) {
            revert InvalidReserveRatio();
        }

        ILaunchpadToken token = ILaunchpadToken(tokenAddress);
        
        tokenInfos[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: token.creator(),
            metadataURI: metadataURI,
            totalSupply: totalSupply,
            currentSupply: 0,
            reserveBalance: 0,
            reserveRatio: reserveRatio,
            tradingEnabled: false,
            launchTimestamp: block.timestamp,
            marketCap: 0
        });

        listedTokens.push(tokenAddress);
        isTokenListed[tokenAddress] = true;

        emit TokenListed(tokenAddress, token.creator(), metadataURI, totalSupply, reserveRatio);
    }

    /**
     * @notice Buy tokens using bonding curve pricing
     * @param tokenAddress Address of the token to buy
     * @param minTokensOut Minimum tokens expected (slippage protection)
     */
    function buyTokens(
        address tokenAddress, 
        uint256 minTokensOut
    ) external payable override nonReentrant whenNotPaused {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }
        if (msg.value == 0) {
            revert InsufficientETH();
        }

        TokenInfo storage tokenInfo = tokenInfos[tokenAddress];
        ILaunchpadToken token = ILaunchpadToken(tokenAddress);

        // Calculate tokens to mint based on bonding curve
        uint256 tokensToMint = calculatePurchaseReturn(tokenAddress, msg.value);
        
        if (tokensToMint < minTokensOut) {
            revert SlippageExceeded();
        }

        // Calculate fees
        uint256 platformFeeAmount = (msg.value * platformFee) / BASIS_POINTS;
        uint256 creatorFeeAmount = (msg.value * creatorFee) / BASIS_POINTS;
        uint256 reserveAmount = msg.value - platformFeeAmount - creatorFeeAmount;

        // Update token info
        tokenInfo.currentSupply = tokenInfo.currentSupply + tokensToMint;
        tokenInfo.reserveBalance = tokenInfo.reserveBalance + reserveAmount;
        tokenInfo.marketCap = calculateMarketCap(tokenAddress);

        // Mint tokens to buyer
        token.mint(msg.sender, tokensToMint);

        // Transfer fees
        payable(feeCollector).transfer(platformFeeAmount);
        payable(tokenInfo.creator).transfer(creatorFeeAmount);

        // Check if liquidity threshold is reached
        if (!tokenInfo.tradingEnabled && tokenInfo.marketCap >= LIQUIDITY_THRESHOLD) {
            tokenInfo.tradingEnabled = true;
            token.enableTrading();
            emit TradingEnabled(tokenAddress, block.timestamp);
            emit LiquidityThresholdReached(tokenAddress, tokenInfo.marketCap);
        }

        emit TokensBought(
            tokenAddress,
            msg.sender,
            msg.value,
            tokensToMint,
            getCurrentPrice(tokenAddress)
        );
    }

    /**
     * @notice Sell tokens using bonding curve pricing
     * @param tokenAddress Address of the token to sell
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH expected (slippage protection)
     */
    function sellTokens(
        address tokenAddress,
        uint256 tokenAmount,
        uint256 minEthOut
    ) external override nonReentrant whenNotPaused {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }
        if (tokenAmount == 0) {
            revert InsufficientTokens();
        }

        TokenInfo storage tokenInfo = tokenInfos[tokenAddress];
        ILaunchpadToken token = ILaunchpadToken(tokenAddress);

        if (token.balanceOf(msg.sender) < tokenAmount) {
            revert InsufficientTokens();
        }

        // Calculate ETH to return based on bonding curve
        uint256 ethToReturn = calculateSaleReturn(tokenAddress, tokenAmount);
        
        if (ethToReturn < minEthOut) {
            revert SlippageExceeded();
        }

        // Calculate fees
        uint256 platformFeeAmount = (ethToReturn * platformFee) / BASIS_POINTS;
        uint256 creatorFeeAmount = (ethToReturn * creatorFee) / BASIS_POINTS;
        uint256 userAmount = ethToReturn - platformFeeAmount - creatorFeeAmount;

        // Update token info
        tokenInfo.currentSupply = tokenInfo.currentSupply - tokenAmount;
        tokenInfo.reserveBalance = tokenInfo.reserveBalance - ethToReturn;
        tokenInfo.marketCap = calculateMarketCap(tokenAddress);

        // Burn tokens from seller
        token.burn(msg.sender, tokenAmount);

        // Transfer ETH to seller and fees
        payable(msg.sender).transfer(userAmount);
        payable(feeCollector).transfer(platformFeeAmount);
        payable(tokenInfo.creator).transfer(creatorFeeAmount);

        emit TokensSold(
            tokenAddress,
            msg.sender,
            tokenAmount,
            ethToReturn,
            getCurrentPrice(tokenAddress)
        );
    }

    /**
     * @notice Calculate token purchase return using bonding curve formula
     * @param tokenAddress Address of the token
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Amount of tokens that can be bought
     */
    function calculatePurchaseReturn(
        address tokenAddress, 
        uint256 ethAmount
    ) public view override returns (uint256 tokenAmount) {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }

        TokenInfo memory tokenInfo = tokenInfos[tokenAddress];
        
        if (tokenInfo.currentSupply == 0) {
            // Initial purchase calculation
            return ethAmount * 1000; // 1 ETH = 1000 tokens initially
        }

        // Bonding curve formula: tokens = supply * ((1 + eth/reserve)^(reserve_ratio/100) - 1)
        uint256 reserveRatio = tokenInfo.reserveRatio;
        uint256 currentSupply = tokenInfo.currentSupply;
        uint256 reserveBalance = tokenInfo.reserveBalance;

        // Simplified bonding curve calculation
        uint256 priceImpact = (ethAmount * BASIS_POINTS) / (reserveBalance + ethAmount);
        uint256 baseTokens = (ethAmount * currentSupply) / reserveBalance;
        
        // Apply reserve ratio effect
        tokenAmount = (baseTokens * reserveRatio) / BASIS_POINTS;
        
        // Apply price impact
        tokenAmount = tokenAmount - (tokenAmount * priceImpact) / (BASIS_POINTS * 2);
    }

    /**
     * @notice Calculate token sale return using bonding curve formula
     * @param tokenAddress Address of the token
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount Amount of ETH that will be received
     */
    function calculateSaleReturn(
        address tokenAddress, 
        uint256 tokenAmount
    ) public view override returns (uint256 ethAmount) {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }

        TokenInfo memory tokenInfo = tokenInfos[tokenAddress];
        
        if (tokenInfo.currentSupply == 0 || tokenAmount > tokenInfo.currentSupply) {
            return 0;
        }

        // Bonding curve formula for selling
        uint256 reserveRatio = tokenInfo.reserveRatio;
        uint256 currentSupply = tokenInfo.currentSupply;
        uint256 reserveBalance = tokenInfo.reserveBalance;

        // Simplified bonding curve calculation for selling
        ethAmount = (tokenAmount * reserveBalance) / currentSupply;
        
        // Apply reserve ratio effect
        ethAmount = (ethAmount * reserveRatio) / BASIS_POINTS;
        
        // Apply selling pressure discount
        uint256 sellPressure = (tokenAmount * BASIS_POINTS) / currentSupply;
        ethAmount = ethAmount - (ethAmount * sellPressure) / (BASIS_POINTS * 10);
    }

    /**
     * @notice Get current token price
     * @param tokenAddress Address of the token
     * @return price Current price in ETH per token (scaled by 1e18)
     */
    function getCurrentPrice(address tokenAddress) public view override returns (uint256 price) {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }

        TokenInfo memory tokenInfo = tokenInfos[tokenAddress];
        
        if (tokenInfo.currentSupply == 0) {
            return 1e15; // 0.001 ETH initial price
        }

        price = (tokenInfo.reserveBalance * 1e18) / tokenInfo.currentSupply;
    }

    /**
     * @notice Calculate market cap for a token
     * @param tokenAddress Address of the token
     * @return marketCap Current market cap in ETH
     */
    function calculateMarketCap(address tokenAddress) public view returns (uint256 marketCap) {
        TokenInfo memory tokenInfo = tokenInfos[tokenAddress];
        uint256 currentPrice = getCurrentPrice(tokenAddress);
        marketCap = (tokenInfo.currentSupply * currentPrice) / 1e18;
    }

    /**
     * @notice Get token information
     * @param tokenAddress Address of the token
     * @return tokenInfo Complete token information
     */
    function getTokenInfo(address tokenAddress) external view override returns (TokenInfo memory tokenInfo) {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }
        return tokenInfos[tokenAddress];
    }

    /**
     * @notice Get all listed tokens
     * @return tokens Array of all token addresses
     */
    function getAllTokens() external view override returns (address[] memory tokens) {
        return listedTokens;
    }

    /**
     * @notice Check if liquidity threshold is reached
     * @param tokenAddress Address of the token
     * @return True if threshold is reached
     */
    function isLiquidityThresholdReached(address tokenAddress) external view override returns (bool) {
        if (!isTokenListed[tokenAddress]) {
            revert TokenNotListed();
        }
        return tokenInfos[tokenAddress].marketCap >= LIQUIDITY_THRESHOLD;
    }

    /**
     * @notice Update platform fee (only owner)
     * @param newFee New platform fee in basis points
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        if (newFee > 1000) { // Max 10%
            revert InvalidFeePercentage();
        }
        uint256 oldFee = platformFee;
        platformFee = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update creator fee (only owner)
     * @param newFee New creator fee in basis points
     */
    function updateCreatorFee(uint256 newFee) external onlyOwner {
        if (newFee > 500) { // Max 5%
            revert InvalidFeePercentage();
        }
        uint256 oldFee = creatorFee;
        creatorFee = newFee;
        emit CreatorFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update fee collector address (only owner)
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) {
            revert InvalidAddress();
        }
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @notice Update token factory address (only owner)
     * @param newFactory New token factory address
     */
    function updateTokenFactory(address newFactory) external onlyOwner {
        if (newFactory == address(0)) {
            revert InvalidAddress();
        }
        tokenFactory = newFactory;
    }

    /**
     * @notice Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
