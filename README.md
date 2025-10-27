# Hodl.fun 🚀

A truly universal token launchpad platform built on Push Chain, featuring automated token creation, marketplace listing, and bonding curve mechanics for liquidity provision. Launch, trade, and manage ERC20 tokens with enterprise-grade security and automated price discovery.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.22-orange.svg)
![Next.js](https://img.shields.io/badge/next.js-15.5.4-black.svg)

## 🌟 Overview

Hodl.fun is a full-stack decentralized application that enables users to create and trade tokens with automated liquidity through bonding curves. The platform combines smart contract security with a modern, retro-styled user interface for an exceptional token launch experience.

### Key Features

- **🎯 One-Click Token Creation** - Deploy ERC20 tokens with customizable parameters in seconds
- **📈 Bonding Curve Mechanics** - Automated market making with fair price discovery
- **🔒 Enterprise Security** - Built with OpenZeppelin's battle-tested contracts
- **🏪 Automatic Marketplace** - Tokens are instantly listed and tradeable
- **💰 Revenue Sharing** - Sustainable economics with platform and creator fees
- **🌐 Push Chain Native** - Optimized for Push Chain testnet deployment
- **📊 Real-Time Analytics** - Track performance, market cap, and trading activity
- **🎨 Modern UI** - Retro-styled interface with pixel-perfect design

## 📁 Project Structure

```
hodl.fun/
├── frontend/              # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility libraries
│   │   ├── config/       # Contract ABIs and addresses
│   │   └── contexts/     # React context providers
│   └── package.json
│
└── smart-contract/       # Foundry smart contracts
    ├── src/
    │   ├── LaunchpadToken.sol      # ERC20 token implementation
    │   ├── TokenMarketplace.sol    # Bonding curve marketplace
    │   ├── TokenFactory.sol        # Token creation factory
    │   ├── interfaces/             # Contract interfaces
    │   └── utils/                  # Utility libraries
    ├── test/                       # Comprehensive test suite
    ├── script/                     # Deployment scripts
    └── foundry.toml
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn/pnpm
- **Foundry** for smart contract development
- **Git** for version control

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/Hodl.fun.git
cd hodl.fun
```

2. **Install frontend dependencies**
```bash
cd frontend
npm install
```

3. **Install smart contract dependencies**
```bash
cd ../smart-contract
forge install
```

### Running Locally

#### Frontend Development Server

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

#### Smart Contract Development

```bash
cd smart-contract

# Compile contracts
forge build

# Run tests
forge test

# Run tests with verbosity
forge test -vvv
```

## 🔧 Configuration

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
# Push Chain RPC URLs
NEXT_PUBLIC_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
NEXT_PUBLIC_RPC_URL_ALT=https://evm.rpc-testnet-donut-node2.push.org/

# Contract Addresses (update after deployment)
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...

# Chain Configuration
NEXT_PUBLIC_CHAIN_ID=42101
NEXT_PUBLIC_CHAIN_NAME=Push Chain Testnet
```

### Smart Contract Environment Variables

Create a `.env` file in the `smart-contract` directory:

```env
# Deployment Configuration
PRIVATE_KEY=your_private_key_here
FEE_COLLECTOR=0x_your_fee_collector_address

# RPC URLs
RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/

# BlockScout API (for verification)
ETHERSCAN_API_KEY=blockscout
```

## 📊 Smart Contract Architecture

### Core Contracts

| Contract | Description | Size | Gas Cost |
|----------|-------------|------|----------|
| **TokenFactory** | Creates and deploys new tokens | ~12KB | 2.8M |
| **TokenMarketplace** | Handles bonding curve trading | ~20KB | 3.5M |
| **LaunchpadToken** | ERC20 token with enhanced features | ~15KB | 2.7M |

### Contract Flow

```
User Request
    ↓
TokenFactory.createToken()
    ↓
Deploy LaunchpadToken
    ↓
Auto-list on TokenMarketplace
    ↓
Bonding Curve Trading
    ↓
Liquidity Threshold (100 ETH)
    ↓
Full Trading Enabled
```

### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Creation Fee | 0.01 ETH | Fee to create a new token |
| Platform Fee | 1% | Platform fee on trades |
| Creator Fee | 0.5% | Creator fee on trades |
| Min Supply | 1M tokens | Minimum token supply |
| Max Supply | 100M tokens | Maximum token supply |
| Reserve Ratio | 10%-90% | Bonding curve parameter |
| Liquidity Threshold | 100 ETH | Market cap for full trading |

## 🎨 Frontend Stack

### Technologies

- **Framework**: Next.js 15.5.4 with App Router
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4
- **UI Components**: Radix UI + shadcn/ui
- **Web3**: ethers.js 6.15.0
- **Wallet**: @pushchain/core & @pushchain/ui-kit
- **Icons**: Lucide React
- **Retro UI**: pixel-retroui

### Key Features

- **Server-Side Rendering** - Fast initial page loads
- **Real-Time Updates** - Live token data and trading
- **Responsive Design** - Mobile-first approach
- **Wallet Integration** - Push Chain wallet support
- **IPFS Integration** - Decentralized metadata storage
- **Token Caching** - Optimized data fetching

## 🧪 Testing

### Smart Contract Tests

```bash
cd smart-contract

# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testTokenCreation

# Generate coverage report
forge coverage
```

**Test Coverage**: 11/11 tests passing (100%)

### Test Categories

- ✅ Token creation and validation
- ✅ Marketplace trading mechanics
- ✅ Bonding curve calculations
- ✅ Access control enforcement
- ✅ Fee collection and distribution
- ✅ Edge cases and error handling

## 🚢 Deployment

### Smart Contract Deployment

#### Push Chain Testnet

```bash
cd smart-contract

# Deploy to Push Chain Testnet
forge script script/Deploy.s.sol \
  --rpc-url push_testnet \
  --broadcast \
  --verify

# Verify contracts on BlockScout
forge verify-contract <CONTRACT_ADDRESS> \
  --chain push_testnet \
  --constructor-args $(cast abi-encode "constructor(address,address)" <ARG1> <ARG2>)
```

### Frontend Deployment

#### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

```bash
# Or deploy via CLI
cd frontend
npm install -g vercel
vercel
```

#### Manual Deployment

```bash
cd frontend

# Build production bundle
npm run build

# Start production server
npm start
```

## 💰 Economics & Tokenomics

### Revenue Model

1. **Token Creation Fees**: 0.01 ETH per token
2. **Trading Fees**: 1.5% total (1% platform + 0.5% creator)
3. **Scalable Growth**: Revenue increases with platform usage

### Bonding Curve Mechanics

- **Automated Pricing**: Price increases as more tokens are purchased
- **Fair Distribution**: Early buyers get better prices
- **Liquidity Provision**: ETH reserves back token value
- **Threshold System**: Graduates to full trading at 100 ETH market cap

### Value Proposition

- **For Creators**: Easy token launch, revenue sharing, no technical knowledge required
- **For Traders**: Fair pricing, automated liquidity, slippage protection
- **For Platform**: Sustainable fee model, growing ecosystem

## 🔒 Security

### Smart Contract Security

- ✅ **OpenZeppelin Contracts** - Industry-standard security
- ✅ **Reentrancy Guards** - Protection against reentrancy attacks
- ✅ **Access Control** - Role-based permissions
- ✅ **Pausable** - Emergency circuit breaker
- ✅ **Input Validation** - Comprehensive parameter checks
- ✅ **Custom Errors** - Gas-efficient error handling
- ✅ **Slippage Protection** - Minimum output guarantees

### Best Practices

- Solidity 0.8+ with built-in overflow protection
- Comprehensive test coverage (100%)
- Custom errors for gas efficiency
- Emergency pause functionality
- Upgradeable architecture considerations




### API Reference

#### TokenFactory

```solidity
function createToken(TokenParams calldata params) external payable returns (address)
function getTokensByCreator(address creator) external view returns (address[] memory)
function isValidToken(address tokenAddress) external view returns (bool)
```

#### TokenMarketplace

```solidity
function buyTokens(address token, uint256 minTokens) external payable
function sellTokens(address token, uint256 amount, uint256 minETH) external
function calculatePurchaseReturn(address token, uint256 ethAmount) external view returns (uint256)
function calculateSaleReturn(address token, uint256 tokenAmount) external view returns (uint256)
```


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


