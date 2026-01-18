# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hodl.fun is a universal token launchpad platform built on Push Chain. Users can launch and trade ERC20 tokens with bonding curve mechanics. The platform consists of three main components:
- **frontend/**: Next.js 15 React application
- **backend-nestjs/**: NestJS enterprise backend (API, Indexer, Worker services)
- **smart-contract2/**: Foundry-based upgradeable smart contracts (v2)

## Build and Development Commands

### Frontend (`/frontend`)
```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run lint         # ESLint
```

### Backend NestJS (`/backend-nestjs`)
```bash
# Development (run services separately or together)
npm run start:dev              # All services
npm run start:dev:api          # API server only (port 3000)
npm run start:dev:indexer      # Blockchain indexer only
npm run start:dev:worker       # Background worker only

# Production
npm run build
npm run start:prod:api
npm run start:prod:indexer
npm run start:prod:worker

# Code quality
npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier formatting

# Testing
npm run test                   # Unit tests
npm run test:watch             # Watch mode
npm run test:cov               # Coverage report
npm run test:e2e               # End-to-end tests
```

### Smart Contracts (`/smart-contract2`)
```bash
forge build                    # Compile contracts
forge test                     # Run all tests
forge test -vvv                # Verbose test output
forge test --match-test <name> # Run specific test
forge coverage                 # Coverage report

# Deployment
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Architecture

### Backend Services (3-service design)
1. **API Server**: REST endpoints + WebSocket for real-time updates
2. **Blockchain Indexer**: Polls Push Chain every 5 seconds for contract events
3. **Background Workers**: Bull queue processors for metrics, cache warming, holder updates

### Backend Library Structure (Clean Architecture)
- `@core/`: Infrastructure (Prisma DB, Redis, RPC providers)
- `@domain/`: Pure business entities (Token, TokenTrade, User)
- `@application/`: Use cases with CQRS command/query handlers
- `@infrastructure/`: Prisma repositories, external adapters
- `@presentation/`: Controllers, WebSocket gateways, DTOs
- `@shared/`: Guards, interceptors, pipes, filters, decorators

### Smart Contract Architecture (UUPS Upgradeable)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CORE.sol                                 │
│  Central orchestrator - all user interactions go through here    │
│  • createCurve() - deploys new token + bonding curve            │
│  • exactInBuy() / exactOutBuy() - buy tokens with PUSH          │
│  • exactInSell() / exactOutSell() - sell tokens for PUSH        │
│  • Auto-wraps native PUSH → WPUSH                               │
│  • Validates fees, deadlines, slippage                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
│ FACTORY.sol     │ │ FEEVAULT.sol│ │ WPUSH.sol        │
│ Creates curves  │ │ ERC4626     │ │ Wrapped native   │
│ + tokens        │ │ Platform +  │ │ deposit/withdraw │
│ Stores mappings │ │ Creator fees│ │ ERC20 compatible │
│ token→curve     │ │ Fee claims  │ │                  │
└────────┬────────┘ └─────────────┘ └──────────────────┘
         │ Creates (via ERC1967Proxy)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│      BONDINGCURVE.sol       │  │         TOKEN.sol           │
│  One per token (proxy)      │  │  ERC20 Upgradeable (proxy)  │
│  • buy() / sell()           │  │  • Fixed supply: 100M       │
│  • Virtual reserves (k=x*y) │  │  • mint() - one-time        │
│  • Real reserves tracking   │  │  • burn() - for graduation  │
│  • ATH price/marketcap      │  │  • tokenURI for metadata    │
│  • Graduation threshold     │  │                             │
│  • listing() → Uniswap V3   │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
```

**Contract Hierarchy:**
- **Core.sol**: Entry point. Handles PUSH→WPUSH wrapping, routes to Factory/BondingCurve
- **BondingCurveFactory.sol**: Deploys Token+BondingCurve proxy pairs, stores global config
- **BondingCurve.sol**: Per-token AMM implementing constant product (x * y = k)
- **Token.sol**: Standard ERC20 with minting controlled by bonding curve
- **FeeVault.sol**: ERC4626 vault collecting platform fees (1%) and creator fees (10% of fee)
- **WPUSH.sol**: Wrapped native token for ERC20 compatibility

**Key Mechanics:**
- Virtual reserves enable price discovery without initial liquidity
- `k = virtualNative * virtualToken` (constant product invariant)
- Price = virtualNative / virtualToken (scaled by 1e18)
- Graduation: When marketCap >= threshold, curve locks and lists on Uniswap V3

### Data Flow
```
User Action → Smart Contract TX → Indexer detects event →
PostgreSQL update → Workers calculate metrics →
API serves data → WebSocket pushes to Frontend
```

## Key Configuration

### Network: Push Chain Testnet (Chain ID: 42101)
- RPC: `https://evm.rpc-testnet-donut-node1.push.org/`
- Explorer: `https://donut.push.network/`

### Deployed Contract Addresses
- Core: `0x592F8f0abbB9a3d3c425980Ac0263363C8405b03`
- Factory: `0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8`
- FeeVault: `0xbe2fd9b720d1d7fac7208523376d2a3332019928`
- WPUSH: `0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7`

### TypeScript Path Aliases
- Frontend: `@/*` → `./src/*`
- Backend: `@core/*`, `@domain/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`, `@shared/*`

## Database Schema (Prisma)

Key models in `backend-nestjs/prisma/schema.prisma`:
- `Token`: Blockchain tokens with bonding curve state, graduation status
- `Holder`: Token holder balances per user
- `Transaction`: Buy/sell trade history
- `UserPortfolio`: Aggregated user holdings and P&L
- `PriceHistory`: OHLC candlestick data

BigInt values are stored as strings for precision.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15, React 19, TailwindCSS 4, ethers.js 6 |
| Backend | NestJS 10, TypeScript 5.7, Prisma 5, Bull queues |
| Database | PostgreSQL 15+, Redis 7+ |
| Real-time | Socket.io with Redis adapter |
| Contracts | Solidity 0.8.22, Foundry, OpenZeppelin Upgradeable |

## Important Patterns

### Frontend
- Uses `@pushchain/ui-kit` for wallet connection (PushWalletProvider context)
- Contract interactions via custom hooks in `/frontend/src/hooks/`
- ABIs stored in `/frontend/src/config/abis.ts`

### Backend
- CQRS pattern: Commands modify state, Queries read state
- Repository pattern: Domain interfaces implemented by Prisma repositories
- Event-driven: Indexer emits events, workers process asynchronously
- JWT authentication via `@shared/guards/jwt-auth.guard.ts`

### Smart Contracts
- All contracts use UUPS proxy pattern for upgradeability
- Virtual reserves enable smooth price discovery at launch
- Bonding curves lock when graduation threshold reached, then list on Uniswap V3

## Smart Contract Deep Dive

### File Structure (`/smart-contract2/src`)
```
src/
├── Core.sol                    # Main orchestrator (entry point)
├── BondingCurveFactory.sol     # Creates token + curve pairs
├── BondingCurve.sol            # Per-token AMM logic
├── Token.sol                   # ERC20 implementation
├── FeeVault.sol                # ERC4626 fee collection
├── WPUSH.sol                   # Wrapped native token
├── UniswapV3Factory.sol        # DEX factory for graduation
├── UniswapV3Pool.sol           # DEX pool implementation
├── interfaces/
│   ├── ICore.sol               # Core interface with events
│   ├── IBondingCurve.sol       # Curve interface with events
│   ├── IBondingCurveFactory.sol # Factory interface + Config struct
│   ├── IToken.sol              # Token interface
│   ├── IFeeVault.sol           # Vault interface
│   └── IWNative.sol            # Wrapped native interface
└── utils/
    ├── BondingCurveLibrary.sol # AMM math (getAmountOut/In)
    ├── LiquidityAmounts.sol    # Uniswap V3 liquidity calc
    └── TickMath.sol            # Uniswap V3 tick math
```

### Core Functions (Entry Points)

**Token Creation:**
```solidity
Core.createCurve(creator, name, symbol, tokenURI, amountIn, fee)
// → Deploys Token proxy + BondingCurve proxy
// → Mints 100M tokens to curve
// → Optional initial buy with amountIn
// → Collects deployFee to FeeVault
// Events: CreateCurve, Buy (if amountIn > 0)
```

**Trading:**
```solidity
Core.exactInBuy(amountIn, amountOutMin, token, to, deadline)
// User specifies PUSH amount, gets maximum tokens
// Events: Buy (on Core), Buy + Sync (on BondingCurve)

Core.exactInSell(amountIn, amountOutMin, token, from, to, deadline)
// User specifies token amount, gets maximum PUSH
// Events: Sell (on Core), Sell + Sync (on BondingCurve)
```

### Key Events for Backend Indexing

**From Core.sol:**
- `CreateCurve(creator, curve, token, tokenURI, name, symbol)`
- `Buy(token, to, amountIn, amountOut, price, timestamp)`
- `Sell(token, from, to, amountIn, amountOut, price, timestamp)`

**From BondingCurve.sol:**
- `Buy(to, token, amountNativeIn, amountOut, price, timestamp)`
- `Sell(to, token, amountTokenIn, amountOut, price, timestamp)`
- `Sync(token, realNative, realToken, virtualNative, virtualToken, price, timestamp)`
- `Lock(token)` - Graduation triggered
- `Listing(curve, token, pool, amount0, amount1, liquidity)` - DEX listed
- `NewATHPrice(token, newPrice, timestamp)`
- `NewATHMarketCap(token, newMarketCap, timestamp)`

**From Factory.sol:**
- `Create(creator, curve, token, tokenURI, name, symbol, virtualNative, virtualToken)`
- `CreatorFeesAccumulated(creator, amount, totalAccumulated)`
- `CreatorFeesClaimed(creator, amount)`

### Factory Configuration (IBondingCurveFactory.Config)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| deployFee | uint256 | 0.01 PUSH | Fee to create token |
| listingFee | uint256 | 0.1 PUSH | Fee for DEX listing |
| virtualNative | uint256 | 1 PUSH | Initial virtual PUSH reserve |
| virtualToken | uint256 | 50M | Initial virtual token reserve |
| k | uint256 | calculated | virtualNative * virtualToken |
| graduationMarketCap | uint256 | 1M PUSH | Threshold to trigger listing |
| feeDenominator | uint8 | 100 | Fee calculation denominator |
| feeNumerator | uint16 | 1 | Fee = amount * 1/100 = 1% |
| dexFee | uint24 | 3000 | Uniswap V3 fee tier (0.30%) |
| creatorFeeShare | uint16 | 1000 | 10% of fees go to creator |

### Bonding Curve Math (BondingCurveLibrary.sol)

```solidity
// Constant product: k = x * y (always maintained)
// getAmountOut: How many tokens for X PUSH?
newReserveIn = reserveIn + amountIn
newReserveOut = k / newReserveIn
amountOut = reserveOut - newReserveOut

// getAmountIn: How much PUSH for X tokens?
newReserveOut = reserveOut - amountOut
newReserveIn = k / newReserveOut
amountIn = newReserveIn - reserveIn
```

### Token Lifecycle

1. **Creation**: Creator calls `Core.createCurve()` with metadata
2. **Trading Phase**: Users buy/sell via Core, BondingCurve updates reserves
3. **Graduation**: When `marketCap >= graduationMarketCap`, curve locks
4. **DEX Listing**: Anyone can call `BondingCurve.listing()` to deploy V3 pool
5. **Post-Graduation**: Trading continues on Uniswap V3

### Access Control Roles

| Contract | Role | Granted To | Purpose |
|----------|------|------------|---------|
| Core | DEFAULT_ADMIN_ROLE | Owner | Upgrade, setFactory |
| Core | FACTORY_ROLE | Factory | Internal coordination |
| Factory | DEFAULT_ADMIN_ROLE | Owner | Upgrade, configuration |
| Factory | CORE_ROLE | Core | Create curves |
| BondingCurve | CORE_ROLE | Core | Execute buy/sell |
| Token | BONDING_CURVE_ROLE | BondingCurve | Mint tokens |
| FeeVault | CORE_ROLE | Core | Deposit fees |

### Proxy Pattern Notes

- All contracts use OpenZeppelin UUPS (Universal Upgradeable Proxy Standard)
- Implementation contracts disable initializers in constructor
- Proxies are deployed via `ERC1967Proxy`
- `_authorizeUpgrade()` restricted to DEFAULT_ADMIN_ROLE
- Factory deploys BondingCurve and Token as proxies sharing implementations
