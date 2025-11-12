# Hodl.fun - Universal Token Launchpad

A truly universal token launchpad platform built on Push Chain, featuring token creation, marketplace listing, and bonding curve mechanics for liquidity provision. Launch, trade, and manage ERC20 tokens with enterprise-grade security and automated price discovery from any supported chain.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.22-orange.svg)
![Next.js](https://img.shields.io/badge/next.js-15.5.4-black.svg)


## 🚨 Problem Statement

### Current Challenges in Token Launches

#### 🧩 Fragmented Liquidity
- Token launches are isolated to single blockchains  
- Liquidity is split across multiple networks  
- Users can't participate if they don't have assets on the specific chain  

#### 🔗 Cross-Chain Friction
- Users must bridge assets between chains (expensive & time-consuming)  
- Network switching creates poor UX  
- High barriers to entry for new users  
- Gas fees on multiple chains  

#### 🚪 Limited Accessibility
- Users locked out if they only hold assets on different chains  
- Complex setup required (wallets, bridges, gas tokens)  
- Fragmented user base across ecosystems  

#### 💸 Inefficient Capital
- Liquidity trapped on single chains  
- Arbitrage opportunities but high friction  
- Suboptimal price discovery  

---

## 💡 Solution: Hodl.fun

**Hodl.fun** is a universal token launchpad that enables users to **launch and trade tokens using any asset from any chain** — without bridging or network switching.

---

## ⚙️ How It Works

### 🌐 Universal Asset Support
- Launch tokens and accept payments in **ETH, SOL**, or any supported asset  
- Users trade with whatever assets they already hold  
- No need to bridge or acquire specific chain tokens  

### 📈 Automated Bonding Curve
- Fair launch mechanism with automated market making  
- Price discovery through bonding curve mathematics  
- Liquidity bootstrapping without upfront capital  

### 🔀 Cross-Chain Abstraction
- Built on **Push Chain's universal account system**  
- Single wallet works across all chains  
- Seamless multi-chain experience  

### ⚡ Instant Settlement
- No waiting for bridge confirmations  
- Real-time trading execution  
- Native cross-chain liquidity  

---

## 🔑 Key Features

### 🧑‍💻 For Token Creators

#### 🎯 One-Click Token Launch
- Deploy **ERC20 tokens** with metadata (name, symbol, logo, description)  
- Automatic marketplace listing  
- Built-in bonding curve liquidity  

#### ⚖️ Fair Launch Mechanism
- No pre-mine or insider allocation  
- Bonding curve ensures fair price discovery  
- Configurable reserve ratio (10–90%)  

#### 💧 Automated Liquidity
- Bonding curve provides instant liquidity  
- No need for initial liquidity provision  
- Automatic graduation to full trading at **100 ETH market cap**  

#### 🧾 Rich Token Metadata
- **IPFS-stored metadata** (logo, description, social links)  
- Professional token pages  
- Social integration (Twitter, Telegram, Website)  

---

### 💹 For Traders

#### 🌍 Universal Trading
- Trade with any asset (**ETH, SOL**)  
- No bridging required  
- Single wallet for all chains  

#### 📊 Real-Time Price Discovery
- Bonding curve pricing  
- Live market data  
- Price charts and analytics *(coming soon)*  

#### 💼 Portfolio Management
- Track all your token holdings  
- View profit/loss  
- Transaction history *(coming soon)*  

---

## 🏪 Platform Features

### 🧭 Token Marketplace
- Browse all launched tokens  
- Filter by market cap, holders, age  
- Search by name/symbol  
- Real-time updates  

### ⚡ Instant Trading
- Buy/sell tokens directly  
- Slippage protection  
- Gas-optimized transactions  

### 📈 Analytics Dashboard
- Price charts with OHLC candles *(In Development)*  
- Trading volume metrics  
- Total portfolio value  
- Asset details  



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


**Test Coverage**: 11/11 tests passing (100%)

### Test Categories

- ✅ Token creation and validation
- ✅ Marketplace trading mechanics
- ✅ Bonding curve calculations
- ✅ Access control enforcement
- ✅ Fee collection and distribution
- ✅ Edge cases and error handling



## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


