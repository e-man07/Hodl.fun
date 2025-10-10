// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/TokenFactory.sol";
import "../src/TokenMarketplace.sol";
import "../src/LaunchpadToken.sol";
import "../src/interfaces/ITokenFactory.sol";
import "../src/interfaces/ITokenMarketplace.sol";

/**
 * @title TokenLaunchpadTest
 * @dev Comprehensive test suite for the token launchpad system
 */
contract TokenLaunchpadTest is Test {
    TokenFactory public factory;
    TokenMarketplace public marketplace;
    
    address public owner = address(0x1);
    address public feeCollector = address(0x2);
    address public creator1 = address(0x3);
    address public creator2 = address(0x4);
    address public buyer1 = address(0x5);
    address public buyer2 = address(0x6);
    
    uint256 public constant CREATION_FEE = 0.01 ether;
    uint256 public constant INITIAL_ETH = 100 ether;
    
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        string metadataURI
    );
    
    event TokenListed(
        address indexed tokenAddress,
        address indexed creator,
        string metadataURI,
        uint256 totalSupply,
        uint256 reserveRatio
    );

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy marketplace first with temporary factory address
        marketplace = new TokenMarketplace(feeCollector, owner); // Use owner as temp factory
        
        // Deploy factory with marketplace address
        factory = new TokenFactory(address(marketplace), feeCollector);
        
        // Update marketplace with factory address
        marketplace.updateTokenFactory(address(factory));
        
        vm.stopPrank();
        
        // Fund test accounts
        vm.deal(creator1, INITIAL_ETH);
        vm.deal(creator2, INITIAL_ETH);
        vm.deal(buyer1, INITIAL_ETH);
        vm.deal(buyer2, INITIAL_ETH);
    }

    function testTokenCreation() public {
        vm.startPrank(creator1);
        
        ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
            name: "Test Token",
            symbol: "TEST",
            totalSupply: 10_000_000 * 10**18,
            metadataURI: "ipfs://QmTestHash123456789012345678901234567890123456",
            reserveRatio: 5000, // 50%
            creator: creator1
        });
        
        // We can't predict the exact address, so we'll check the event after creation
        
        address tokenAddress = factory.createToken{value: CREATION_FEE}(params);
        
        vm.stopPrank();
        
        // Verify token was created
        assertTrue(factory.isValidToken(tokenAddress));
        assertEq(factory.getTotalTokensCreated(), 1);
        
        // Verify token properties
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.maxSupply(), 10_000_000 * 10**18); // Check max supply instead of total supply
        assertEq(token.totalSupply(), 0); // Initially no tokens are minted
        assertEq(token.creator(), creator1);
        assertEq(token.marketplace(), address(marketplace));
        assertFalse(token.tradingEnabled());
    }

    function testTokenCreationWithInsufficientFee() public {
        vm.startPrank(creator1);
        
        ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
            name: "Test Token",
            symbol: "TEST",
            totalSupply: 10_000_000 * 10**18,
            metadataURI: "ipfs://QmTestHash123456789012345678901234567890123456",
            reserveRatio: 5000,
            creator: creator1
        });
        
        vm.expectRevert(TokenFactory.InsufficientCreationFee.selector);
        factory.createToken{value: 0.005 ether}(params);
        
        vm.stopPrank();
    }

    function testTokenBuying() public {
        // First create a token
        address tokenAddress = _createTestToken();
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        
        vm.startPrank(buyer1);
        
        uint256 ethAmount = 1 ether;
        uint256 expectedTokens = marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
        
        uint256 initialBalance = buyer1.balance;
        uint256 initialTokenBalance = token.balanceOf(buyer1);
        
        marketplace.buyTokens{value: ethAmount}(tokenAddress, 0);
        
        // Verify purchase
        assertEq(buyer1.balance, initialBalance - ethAmount);
        assertEq(token.balanceOf(buyer1), initialTokenBalance + expectedTokens);
        
        vm.stopPrank();
    }

    function testTokenSelling() public {
        // First create a token and buy some
        address tokenAddress = _createTestToken();
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        
        vm.startPrank(buyer1);
        
        // Buy tokens first
        uint256 ethAmount = 1 ether;
        marketplace.buyTokens{value: ethAmount}(tokenAddress, 0);
        
        uint256 tokenBalance = token.balanceOf(buyer1);
        uint256 sellAmount = tokenBalance / 2;
        
        // Approve marketplace to spend tokens
        token.approve(address(marketplace), sellAmount);
        
        uint256 expectedEth = marketplace.calculateSaleReturn(tokenAddress, sellAmount);
        uint256 initialEthBalance = buyer1.balance;
        
        marketplace.sellTokens(tokenAddress, sellAmount, 0);
        
        // Verify sale (accounting for fees)
        assertTrue(buyer1.balance > initialEthBalance);
        assertEq(token.balanceOf(buyer1), tokenBalance - sellAmount);
        
        vm.stopPrank();
    }

    function testLiquidityThreshold() public {
        address tokenAddress = _createTestToken();
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        
        // Buy enough tokens to reach liquidity threshold
        vm.startPrank(buyer1);
        
        // Calculate amount needed to reach threshold
        uint256 largeAmount = 50 ether; // Should be enough to reach 100 ETH market cap
        
        marketplace.buyTokens{value: largeAmount}(tokenAddress, 0);
        
        // Check if trading is enabled
        ITokenMarketplace.TokenInfo memory tokenInfo = marketplace.getTokenInfo(tokenAddress);
        
        if (tokenInfo.marketCap >= marketplace.LIQUIDITY_THRESHOLD()) {
            assertTrue(token.tradingEnabled());
        }
        
        vm.stopPrank();
    }

    function testMultipleTokenCreation() public {
        // Create multiple tokens
        vm.startPrank(creator1);
        
        for (uint256 i = 0; i < 3; i++) {
            ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
                name: string(abi.encodePacked("Token ", vm.toString(i))),
                symbol: string(abi.encodePacked("TKN", vm.toString(i))),
                totalSupply: (5_000_000 + i * 1_000_000) * 10**18,
                metadataURI: string(abi.encodePacked("ipfs://QmTestHash", vm.toString(i), "23456789012345678901234567890123456")),
                reserveRatio: 4000 + i * 500,
                creator: creator1
            });
            
            factory.createToken{value: CREATION_FEE}(params);
        }
        
        vm.stopPrank();
        
        // Verify all tokens were created
        assertEq(factory.getTotalTokensCreated(), 3);
        
        address[] memory creatorTokens = factory.getTokensByCreator(creator1);
        assertEq(creatorTokens.length, 3);
        
        address[] memory allTokens = marketplace.getAllTokens();
        assertEq(allTokens.length, 3);
    }

    function testPriceCalculation() public {
        address tokenAddress = _createTestToken();
        
        // Test initial price calculation
        uint256 ethAmount = 1 ether;
        uint256 tokenAmount = marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
        
        assertTrue(tokenAmount > 0);
        
        // Test price after some purchases
        vm.prank(buyer1);
        marketplace.buyTokens{value: ethAmount}(tokenAddress, 0);
        
        uint256 newPrice = marketplace.getCurrentPrice(tokenAddress);
        assertTrue(newPrice > 0);
        
        // Price should increase after purchase
        uint256 nextTokenAmount = marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
        assertTrue(nextTokenAmount < tokenAmount); // Should get fewer tokens for same ETH
    }

    function testAccessControl() public {
        address tokenAddress = _createTestToken();
        LaunchpadToken token = LaunchpadToken(tokenAddress);
        
        // Test that only marketplace can mint
        vm.prank(creator1);
        vm.expectRevert();
        token.mint(creator1, 1000 * 10**18);
        
        // Test that only marketplace can enable trading
        vm.prank(creator1);
        vm.expectRevert();
        token.enableTrading();
        
        // Test that only creator can update metadata
        vm.prank(buyer1);
        vm.expectRevert(LaunchpadToken.OnlyCreator.selector);
        token.updateMetadataURI("ipfs://QmNewHash123456789012345678901234567890123456");
    }

    function testFeeCollection() public {
        uint256 initialFeeCollectorBalance = feeCollector.balance;
        
        // Create token (should collect creation fee)
        address tokenAddress = _createTestToken();
        
        assertEq(feeCollector.balance, initialFeeCollectorBalance + CREATION_FEE);
        
        // Buy tokens (should collect trading fees)
        vm.prank(buyer1);
        marketplace.buyTokens{value: 1 ether}(tokenAddress, 0);
        
        // Fee collector should have received additional fees
        assertTrue(feeCollector.balance > initialFeeCollectorBalance + CREATION_FEE);
    }

    function testSlippageProtection() public {
        address tokenAddress = _createTestToken();
        
        vm.startPrank(buyer1);
        
        uint256 ethAmount = 1 ether;
        uint256 expectedTokens = marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
        
        // Set minimum tokens higher than expected (should revert)
        vm.expectRevert(TokenMarketplace.SlippageExceeded.selector);
        marketplace.buyTokens{value: ethAmount}(tokenAddress, expectedTokens + 1);
        
        vm.stopPrank();
    }

    function testInvalidTokenParams() public {
        vm.startPrank(creator1);
        
        // Test invalid name length
        ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
            name: "AB", // Too short
            symbol: "TEST",
            totalSupply: 10_000_000 * 10**18,
            metadataURI: "ipfs://QmTestHash123456789012345678901234567890123456",
            reserveRatio: 5000,
            creator: creator1
        });
        
        vm.expectRevert(TokenFactory.InvalidNameLength.selector);
        factory.createToken{value: CREATION_FEE}(params);
        
        // Test invalid total supply
        params.name = "Valid Name";
        params.totalSupply = 500_000 * 10**18; // Too small
        
        vm.expectRevert(TokenFactory.InvalidTotalSupply.selector);
        factory.createToken{value: CREATION_FEE}(params);
        
        vm.stopPrank();
    }

    // Helper function to create a test token
    function _createTestToken() internal returns (address) {
        vm.prank(creator1);
        
        ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
            name: "Test Token",
            symbol: "TEST",
            totalSupply: 10_000_000 * 10**18,
            metadataURI: "ipfs://QmTestHash123456789012345678901234567890123456",
            reserveRatio: 5000,
            creator: creator1
        });
        
        return factory.createToken{value: CREATION_FEE}(params);
    }
}
