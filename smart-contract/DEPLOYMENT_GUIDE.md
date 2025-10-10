# Token Launchpad Deployment Guide

## 🚀 Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Ethereum wallet with ETH for deployment
- RPC endpoint for your target network
- Etherscan API key (optional, for verification)

### Environment Setup

Create a `.env` file in the project root:

```bash
# Required
PRIVATE_KEY=your_private_key_here
FEE_COLLECTOR=0x_your_fee_collector_address

# Network RPCs
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
GOERLI_RPC_URL=https://eth-goerli.g.alchemy.com/v2/your_key

# Optional - for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Installation

```bash
# Clone and setup
cd smart-contract
forge install

# Compile contracts
forge build

# Run tests
forge test
```

## 📋 Deployment Steps

### 1. Local Testing (Anvil)

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy to local network
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 2. Testnet Deployment

#### Sepolia Testnet
```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

#### Goerli Testnet
```bash
forge script script/Deploy.s.sol \
  --rpc-url $GOERLI_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 3. Mainnet Deployment

⚠️ **IMPORTANT**: Always test thoroughly on testnets first!

```bash
forge script script/Deploy.s.sol \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --slow
```

## 🔧 Post-Deployment Configuration

### 1. Verify Deployment

After deployment, verify the contracts are working:

```bash
# Set environment variables
export FACTORY_ADDRESS=0x_deployed_factory_address
export MARKETPLACE_ADDRESS=0x_deployed_marketplace_address

# Test contract interaction
forge script script/Interact.s.sol:InteractScript --sig "getMarketplaceStats()" --rpc-url $RPC_URL
```

### 2. Create Sample Token

```bash
# Set additional environment variables
export PRIVATE_KEY=your_private_key
export BUYER_PRIVATE_KEY=buyer_private_key

# Create a sample token
forge script script/Interact.s.sol:InteractScript --sig "createSampleToken()" --rpc-url $RPC_URL --broadcast
```

### 3. Test Token Trading

```bash
# Set token address from previous step
export TOKEN_ADDRESS=0x_created_token_address
export ETH_AMOUNT=1000000000000000000  # 1 ETH in wei

# Buy tokens
forge script script/Interact.s.sol:InteractScript --sig "buyTokens()" --rpc-url $RPC_URL --broadcast
```

## 📊 Contract Addresses

After deployment, addresses will be saved to `deployments/{chainId}.json`:

```json
{
  "chainId": 1,
  "marketplace": "0x...",
  "factory": "0x...",
  "feeCollector": "0x...",
  "deployedAt": 1234567890
}
```

## 🔍 Verification Commands

### Manual Verification

If automatic verification fails:

```bash
# Verify TokenMarketplace
forge verify-contract \
  --chain-id 1 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address,address)" $FEE_COLLECTOR $FACTORY_ADDRESS) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version v0.8.19+commit.7dd6d404 \
  $MARKETPLACE_ADDRESS \
  src/TokenMarketplace.sol:TokenMarketplace

# Verify TokenFactory
forge verify-contract \
  --chain-id 1 \
  --num-of-optimizations 200 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address,address)" $MARKETPLACE_ADDRESS $FEE_COLLECTOR) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version v0.8.19+commit.7dd6d404 \
  $FACTORY_ADDRESS \
  src/TokenFactory.sol:TokenFactory
```

## 🛡️ Security Checklist

Before mainnet deployment:

- [ ] All tests passing (`forge test`)
- [ ] Code coverage > 90% (`forge coverage`)
- [ ] Static analysis clean (`slither .`)
- [ ] Testnet deployment successful
- [ ] Token creation tested
- [ ] Token trading tested
- [ ] Fee collection verified
- [ ] Access controls verified
- [ ] Emergency functions tested
- [ ] Gas optimization reviewed
- [ ] External audit completed (recommended)

## 📈 Gas Estimates

Approximate gas costs (at 20 gwei):

| Operation | Gas Used | Cost (ETH) | Cost (USD @$2000) |
|-----------|----------|------------|-------------------|
| Deploy Marketplace | ~3,500,000 | 0.07 | $140 |
| Deploy Factory | ~2,800,000 | 0.056 | $112 |
| Create Token | ~2,700,000 | 0.054 | $108 |
| Buy Tokens | ~180,000 | 0.0036 | $7.20 |
| Sell Tokens | ~160,000 | 0.0032 | $6.40 |

## 🔧 Configuration Options

### Platform Fees
- Default: 1% platform fee, 0.5% creator fee
- Adjustable by contract owner
- Maximum: 10% platform, 5% creator

### Token Parameters
- Supply: 1M - 100M tokens
- Reserve Ratio: 10% - 90%
- Creation Fee: 0.01 ETH (adjustable)

### Liquidity Threshold
- Default: 100 ETH market cap
- Enables full trading when reached
- Configurable by contract owner

## 🚨 Emergency Procedures

### Pause Contracts
```bash
# Pause marketplace
cast send $MARKETPLACE_ADDRESS "pause()" --private-key $PRIVATE_KEY --rpc-url $RPC_URL

# Pause factory
cast send $FACTORY_ADDRESS "pause()" --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

### Update Fees
```bash
# Update platform fee (in basis points, 100 = 1%)
cast send $MARKETPLACE_ADDRESS "updatePlatformFee(uint256)" 150 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

### Emergency Withdraw
```bash
# Withdraw ETH from marketplace (owner only)
cast send $MARKETPLACE_ADDRESS "emergencyWithdraw()" --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

## 📞 Support

For deployment issues:
1. Check the deployment logs
2. Verify environment variables
3. Ensure sufficient ETH balance
4. Check network connectivity
5. Review gas price settings

## 🔄 Upgrade Path

The contracts are not upgradeable by design for security. For updates:
1. Deploy new contracts
2. Migrate liquidity (if needed)
3. Update frontend to use new addresses
4. Communicate changes to users

---

**⚠️ Disclaimer**: Always test thoroughly before mainnet deployment. Smart contracts are immutable once deployed.
