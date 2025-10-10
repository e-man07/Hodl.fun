// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/TokenFactory.sol";
import "../src/TokenMarketplace.sol";
import "../src/LaunchpadToken.sol";
import "../src/interfaces/ITokenFactory.sol";

/**
 * @title InteractScript
 * @dev Script for interacting with deployed contracts
 */
contract InteractScript is Script {
    TokenFactory public factory;
    TokenMarketplace public marketplace;
    
    function setUp() public {
        // Load deployed contract addresses
        // These should be set as environment variables or loaded from deployment files
        address payable factoryAddress = payable(vm.envAddress("FACTORY_ADDRESS"));
        address payable marketplaceAddress = payable(vm.envAddress("MARKETPLACE_ADDRESS"));
        
        factory = TokenFactory(factoryAddress);
        marketplace = TokenMarketplace(marketplaceAddress);
    }
    
    function createSampleToken() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Creating sample token with deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
            name: "Sample Launchpad Token",
            symbol: "SLT",
            totalSupply: 10_000_000 * 10**18,
            metadataURI: "ipfs://QmSampleMetadataHash123456789012345678901234567890",
            reserveRatio: 5000, // 50%
            creator: deployer
        });
        
        uint256 creationFee = factory.creationFee();
        address tokenAddress = factory.createToken{value: creationFee}(params);
        
        console.log("Token created at:", tokenAddress);
        
        vm.stopBroadcast();
    }
    
    function buyTokens() external {
        uint256 buyerPrivateKey = vm.envUint("BUYER_PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 ethAmount = vm.envUint("ETH_AMOUNT"); // Amount in wei
        
        address buyer = vm.addr(buyerPrivateKey);
        console.log("Buying tokens with buyer:", buyer);
        console.log("Token address:", tokenAddress);
        console.log("ETH amount:", ethAmount);
        
        vm.startBroadcast(buyerPrivateKey);
        
        // Calculate expected tokens
        uint256 expectedTokens = marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
        console.log("Expected tokens:", expectedTokens);
        
        // Buy with 5% slippage tolerance
        uint256 minTokens = expectedTokens * 95 / 100;
        marketplace.buyTokens{value: ethAmount}(tokenAddress, minTokens);
        
        console.log("Tokens purchased successfully");
        
        vm.stopBroadcast();
    }
    
    function sellTokens() external {
        uint256 sellerPrivateKey = vm.envUint("SELLER_PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 tokenAmount = vm.envUint("TOKEN_AMOUNT"); // Amount in wei
        
        address seller = vm.addr(sellerPrivateKey);
        console.log("Selling tokens with seller:", seller);
        console.log("Token address:", tokenAddress);
        console.log("Token amount:", tokenAmount);
        
        vm.startBroadcast(sellerPrivateKey);
        
        // Approve marketplace to spend tokens
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        token.approve(address(marketplace), tokenAmount);
        
        // Calculate expected ETH
        uint256 expectedETH = marketplace.calculateSaleReturn(tokenAddress, tokenAmount);
        console.log("Expected ETH:", expectedETH);
        
        // Sell with 5% slippage tolerance
        uint256 minETH = expectedETH * 95 / 100;
        marketplace.sellTokens(tokenAddress, tokenAmount, minETH);
        
        console.log("Tokens sold successfully");
        
        vm.stopBroadcast();
    }
    
    function getTokenInfo() external view {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        
        console.log("=== TOKEN INFORMATION ===");
        console.log("Token Address:", tokenAddress);
        
        // Get token info from marketplace
        ITokenMarketplace.TokenInfo memory tokenInfo = marketplace.getTokenInfo(tokenAddress);
        
        console.log("Creator:", tokenInfo.creator);
        console.log("Total Supply:", tokenInfo.totalSupply);
        console.log("Current Supply:", tokenInfo.currentSupply);
        console.log("Reserve Balance:", tokenInfo.reserveBalance);
        console.log("Reserve Ratio:", tokenInfo.reserveRatio);
        console.log("Trading Enabled:", tokenInfo.tradingEnabled);
        console.log("Market Cap:", tokenInfo.marketCap);
        
        // Get current price
        uint256 currentPrice = marketplace.getCurrentPrice(tokenAddress);
        console.log("Current Price (ETH per token):", currentPrice);
        
        // Get token contract info
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        console.log("Token Name:", token.name());
        console.log("Token Symbol:", token.symbol());
        console.log("Metadata URI:", token.metadataURI());
        console.log("Launch Timestamp:", token.launchTimestamp());
    }
    
    function getCreatorStats() external view {
        address creator = vm.envAddress("CREATOR_ADDRESS");
        
        console.log("=== CREATOR STATISTICS ===");
        console.log("Creator Address:", creator);
        
        address[] memory creatorTokens = factory.getTokensByCreator(creator);
        console.log("Total Tokens Created:", creatorTokens.length);
        
        for (uint256 i = 0; i < creatorTokens.length; i++) {
            console.log("Token", i + 1, ":", creatorTokens[i]);
            
            LaunchpadToken token = LaunchpadToken(creatorTokens[i]);
            console.log("  Name:", token.name());
            console.log("  Symbol:", token.symbol());
            console.log("  Total Supply:", token.totalSupply());
            console.log("  Trading Enabled:", token.tradingEnabled());
        }
    }
    
    function getMarketplaceStats() external view {
        console.log("=== MARKETPLACE STATISTICS ===");
        
        address[] memory allTokens = marketplace.getAllTokens();
        console.log("Total Listed Tokens:", allTokens.length);
        
        uint256 totalMarketCap = 0;
        uint256 tradingEnabledCount = 0;
        
        for (uint256 i = 0; i < allTokens.length; i++) {
            ITokenMarketplace.TokenInfo memory tokenInfo = marketplace.getTokenInfo(allTokens[i]);
            totalMarketCap += tokenInfo.marketCap;
            
            if (tokenInfo.tradingEnabled) {
                tradingEnabledCount++;
            }
        }
        
        console.log("Total Market Cap:", totalMarketCap);
        console.log("Tokens with Trading Enabled:", tradingEnabledCount);
        console.log("Platform Fee:", marketplace.platformFee());
        console.log("Creator Fee:", marketplace.creatorFee());
        console.log("Liquidity Threshold:", marketplace.LIQUIDITY_THRESHOLD());
    }
}
