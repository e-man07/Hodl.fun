# Token Launchpad Smart Contracts

A comprehensive token launchpad platform built on Ethereum using Foundry, featuring automated token creation, marketplace listing, and bonding curve mechanics for liquidity provision.

## 🚀 Features

### Core Functionality
- **Token Creation**: Deploy ERC20 tokens with customizable parameters
- **Automated Marketplace Listing**: Tokens are automatically listed on the marketplace
- **Bonding Curve Mechanics**: Automated market making with price discovery
- **IPFS Metadata Storage**: Decentralized metadata storage for token information
- **Liquidity Threshold**: Automatic trading enablement when market cap reaches threshold
- **Fee Structure**: Platform and creator fees for sustainable ecosystem

### Security Features
- **Access Control**: Role-based permissions using OpenZeppelin's AccessControl
- **Reentrancy Protection**: Guards against reentrancy attacks
- **Pausable Contracts**: Emergency pause functionality
- **Slippage Protection**: Minimum output guarantees for trades
- **Input Validation**: Comprehensive parameter validation
- **Custom Errors**: Gas-efficient error handling

## 📁 Contract Architecture

```
src/
├── interfaces/
│   ├── ILaunchpadToken.sol      # Token interface
│   ├── ITokenMarketplace.sol    # Marketplace interface
│   └── ITokenFactory.sol        # Factory interface
├── utils/
│   └── IPFSMetadata.sol         # IPFS utility functions
├── LaunchpadToken.sol           # ERC20 token implementation
├── TokenMarketplace.sol         # Marketplace with bonding curves
└── TokenFactory.sol             # Token creation factory
```

## 🔧 Contract Details

### LaunchpadToken.sol
- **Standard**: ERC20 with extensions (Burnable, AccessControl, Pausable)
- **Features**: 
  - IPFS metadata URI storage
  - Trading enablement controls
  - Marketplace integration
  - Creator permissions
- **Supply Limits**: 1M - 100M tokens
- **Roles**: MARKETPLACE_ROLE, FACTORY_ROLE, DEFAULT_ADMIN_ROLE

### TokenMarketplace.sol
- **Bonding Curve**: Automated price discovery mechanism
- **Reserve Ratio**: 10% - 90% configurable
- **Liquidity Threshold**: 100 ETH market cap for trading enablement
- **Fees**: 1% platform fee, 0.5% creator fee
- **Features**:
  - Buy/sell with slippage protection
  - Price calculation functions
  - Market cap tracking
  - Fee collection

### TokenFactory.sol
- **Creation Fee**: 0.01 ETH (configurable)
- **Validation**: Comprehensive parameter validation
- **Tracking**: Creator statistics and token registry
- **Integration**: Automatic marketplace listing

## 🛠 Setup & Deployment

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

### Environment Setup
Create a `.env` file:
```bash
PRIVATE_KEY=your_private_key_here
FEE_COLLECTOR=0x_your_fee_collector_address
RPC_URL=your_ethereum_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Compilation
```bash
forge build
```

### Testing
```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testTokenCreation

# Generate coverage report
forge coverage
```

### Deployment

#### Local Deployment (Anvil)
```bash
# Start local node
anvil

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

#### Testnet Deployment
```bash
# Deploy to Goerli
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
```

#### Mainnet Deployment
```bash
forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify --slow
```

## 📊 Usage Examples

### Creating a Token
```solidity
ITokenFactory.TokenParams memory params = ITokenFactory.TokenParams({
    name: "My Awesome Token",
    symbol: "MAT",
    totalSupply: 10_000_000 * 10**18,
    metadataURI: "ipfs://QmYourIPFSHashHere",
    reserveRatio: 5000, // 50%
    creator: msg.sender
});

address tokenAddress = factory.createToken{value: 0.01 ether}(params);
```

### Buying Tokens
```solidity
// Calculate expected tokens
uint256 expectedTokens = marketplace.calculatePurchaseReturn(tokenAddress, 1 ether);

// Buy with slippage protection
marketplace.buyTokens{value: 1 ether}(tokenAddress, expectedTokens * 95 / 100);
```

### Selling Tokens
```solidity
// Approve marketplace
IERC20(tokenAddress).approve(address(marketplace), tokenAmount);

// Calculate expected ETH
uint256 expectedETH = marketplace.calculateSaleReturn(tokenAddress, tokenAmount);

// Sell with slippage protection
marketplace.sellTokens(tokenAddress, tokenAmount, expectedETH * 95 / 100);
```

## 🔍 Key Functions

### TokenFactory
- `createToken(TokenParams)`: Create new launchpad token
- `getTokensByCreator(address)`: Get tokens created by address
- `isValidToken(address)`: Check if token is valid launchpad token

### TokenMarketplace
- `buyTokens(address, uint256)`: Purchase tokens with ETH
- `sellTokens(address, uint256, uint256)`: Sell tokens for ETH
- `calculatePurchaseReturn(address, uint256)`: Calculate tokens for ETH amount
- `calculateSaleReturn(address, uint256)`: Calculate ETH for token amount
- `getCurrentPrice(address)`: Get current token price

### LaunchpadToken
- `mint(address, uint256)`: Mint tokens (marketplace only)
- `burn(address, uint256)`: Burn tokens (marketplace only)
- `enableTrading()`: Enable trading (marketplace only)
- `updateMetadataURI(string)`: Update metadata (creator only)

## 💰 Economics

### Fee Structure
- **Creation Fee**: 0.01 ETH per token
- **Platform Fee**: 1% of trade volume
- **Creator Fee**: 0.5% of trade volume

### Bonding Curve
- **Formula**: Bancor-inspired bonding curve
- **Reserve Ratio**: Configurable 10%-90%
- **Price Impact**: Automatic slippage based on trade size
- **Liquidity Threshold**: 100 ETH market cap for full trading

## 🔒 Security Considerations

### Access Control
- Factory can create tokens and list on marketplace
- Marketplace can mint/burn tokens during bonding curve phase
- Creators can update metadata and pause their tokens
- Owners can pause contracts and update fees

### Safety Measures
- Reentrancy guards on all state-changing functions
- Slippage protection for trades
- Input validation and custom errors
- Emergency pause functionality
- Maximum supply limits

## 🧪 Testing

The test suite covers:
- Token creation and validation
- Marketplace trading mechanics
- Bonding curve calculations
- Access control enforcement
- Fee collection
- Edge cases and error conditions

Run specific test categories:
```bash
# Test token creation
forge test --match-test testTokenCreation

# Test marketplace functionality
forge test --match-test testTokenBuying

# Test access control
forge test --match-test testAccessControl
```

## 📈 Gas Optimization

- Custom errors instead of revert strings
- Efficient storage packing
- Minimal external calls
- Optimized loops and calculations
- Assembly for gas-intensive operations where safe

## 🔮 Future Enhancements

- [ ] Governance token integration
- [ ] Liquidity pool creation post-threshold
- [ ] Advanced bonding curve models
- [ ] Cross-chain token deployment
- [ ] NFT metadata integration
- [ ] Staking mechanisms
- [ ] DAO treasury integration

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add comprehensive tests
4. Follow Solidity style guide
5. Submit pull request

## 📞 Support

For questions and support:
- Create GitHub issues for bugs
- Join our Discord for discussions
- Check documentation for common questions

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk. Always audit smart contracts before mainnet deployment.
