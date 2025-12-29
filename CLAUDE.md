# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hodl.fun** is a universal token launchpad platform built on Push Chain with three main components:

1. **Frontend** (Next.js 15) - User-facing application for token creation and trading
2. **Smart Contracts** (Solidity 0.8.22) - Blockchain logic using bonding curves and ERC20 tokens
3. **Backend** (Express + TypeScript) - Indexing, caching, and API layer

## Quick Commands

### Frontend
```bash
cd frontend
npm install              # Install dependencies
npm run dev             # Start dev server (localhost:3000)
npm run build           # Production build
npm run lint            # Run ESLint
```

### Smart Contracts
```bash
cd smart-contract
forge install           # Install Foundry dependencies
forge build             # Compile contracts
forge test              # Run all tests
forge test -vvv         # Run tests with verbose output
forge test --match-test TestName  # Run specific test
```

### Backend
```bash
cd backend
npm install             # Install dependencies
npm run dev             # Start dev server with watch mode (uses tsx)
npm run build           # Compile TypeScript to dist/
npm run start           # Run compiled server
npm run test            # Run tests with coverage
npm run test:watch      # Run tests in watch mode
npm run sync            # Sync tokens from blockchain events
npm run enrich          # Enrich token metadata from IPFS
npm run worker          # Start background job worker
npm run indexer         # Start blockchain event indexer
prisma studio          # Open Prisma database GUI
```

## Architecture Overview

### Smart Contract Layer (`smart-contract/`)

**Core Contracts:**
- **TokenFactory** (`src/TokenFactory.sol`) - Creates ERC20 tokens and lists them automatically on marketplace
- **TokenMarketplace** (`src/TokenMarketplace.sol`) - Implements bonding curve AMM for trading and liquidity management
- **LaunchpadToken** (`src/LaunchpadToken.sol`) - ERC20 token with enhanced features for launchpad ecosystem

**Key Architecture:**
- Bonding curve formula: `Price = (Total Supply²) / (Reserve Ratio × Reserve Balance)`
- **Liquidity Threshold**: 100 ETH market cap triggers graduation to full DEX integration (Uniswap V3)
- **Fee Structure**: 1% platform fee + 0.5% creator fee collected in ETH
- All contracts inherit from OpenZeppelin's `Ownable`, `ReentrancyGuard`, and `Pausable` for security

**Testing:**
- Single test file: `test/TokenLaunchpad.t.sol`
- Run with `forge test` - 11/11 tests passing (100% coverage)
- Tests cover token creation, marketplace trading, bonding curves, access control, and edge cases

### Frontend Layer (`frontend/`)

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript 5, TailwindCSS 4
- UI: Radix UI + shadcn/ui components
- Web3: ethers.js 6.15.0 with @pushchain/core for wallet integration

**Key Directories:**
- `src/app/` - Next.js pages and layouts
- `src/components/` - Reusable React components (mostly in `marketplace/` and `create-token/` subdirectories)
- `src/hooks/` - Custom hooks for contract interaction:
  - `useContracts.ts` - Contract instance creation and interaction
  - `useMarketplace.ts` - Fetch and manage marketplace token listings
  - `useTokenTrading.ts` - Buy/sell token logic with bonding curve calculations
  - `useUserPortfolio.ts` - Track user's token holdings and portfolio stats
  - `useWallet.ts` - Wallet connection and account management
- `src/config/` - Contract ABIs (`abis.ts`) and addresses (`contracts.ts`)
- `src/contexts/` - React context providers (wallet, theme, etc.)
- `src/lib/` - Utility functions and helpers

**Key Data Flow:**
1. User connects wallet via Push Chain integration
2. `useWallet` hook manages account state
3. `useContracts` hook creates ethers.js contract instances
4. Component hooks (useTokenTrading, useMarketplace) call contract methods
5. Results cached and displayed in real-time

### Backend Layer (`backend/`)

**Architecture:** Express.js with modular service layer, database (PostgreSQL via Prisma), and Redis caching

**Key Directories:**
- `src/routes/` - API endpoint definitions (tokens, users, market stats, health)
- `src/services/` - Business logic (token management, marketplace data, blockchain queries)
- `src/controllers/` - Request/response handling
- `src/indexer/` - Event listener that syncs blockchain state to database
- `src/workers/` - Background job queue (Bull) for async tasks like metadata enrichment
- `src/config/` - RPC provider setup with fallback chains for resilience
- `src/middleware/` - Authentication, rate limiting, validation, error handling
- `src/utils/` - Helpers for Web3 interaction, IPFS uploads, caching

**Key Services:**
- **Blockchain Indexer** - Listens to TokenFactory and TokenMarketplace events, syncs to PostgreSQL
- **IPFS Integration** - Uploads token metadata (logo, description) to Pinata (credentials server-side only)
- **Redis Caching** - Multi-layer strategy: token lists, user portfolios, market stats with smart invalidation
- **RPC Management** - Fallback providers with rate limiting to handle Push Chain RPC limits

**Database Schema (Prisma):**
- `Token` - Stores token metadata, creator info, marketplace status
- `TokenTrade` - Event log of all buy/sell transactions
- `UserPortfolio` - User token holdings and balance tracking
- Custom models defined in `prisma/schema.prisma`

**Testing:**
- Jest configuration in `jest.config.js`
- Run with `npm run test` or `npm run test:watch`
- Unit tests in `src/__tests__/unit/`, integration tests in `src/__tests__/integration/`

## Environment Variables

**Frontend (.env in `frontend/`):**
```
NEXT_PUBLIC_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
NEXT_PUBLIC_RPC_URL_ALT=https://evm.rpc-testnet-donut-node2.push.org/
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=42101
NEXT_PUBLIC_CHAIN_NAME=Push Chain Testnet
```

**Smart Contracts (.env in `smart-contract/`):**
```
PRIVATE_KEY=your_private_key
FEE_COLLECTOR=0x_fee_collector_address
RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
ETHERSCAN_API_KEY=blockscout
```

**Backend (.env in `backend/`):**
- Database: `DATABASE_URL` (PostgreSQL connection string)
- Redis: `REDIS_URL`
- RPC: `PUSH_RPC_URL`, `PUSH_RPC_URL_ALT` with fallback support
- IPFS: `PINATA_JWT` for file uploads
- Server: `PORT`, `NODE_ENV`

## Common Development Patterns

### Adding a New Frontend Feature
1. Create component in `src/components/`
2. Add any contract interaction in `src/hooks/` or extend existing hooks
3. Import and use in a page from `src/app/`
4. Contract ABIs in `src/config/abis.ts`, addresses in `src/config/contracts.ts`

### Smart Contract Changes
1. Edit contract in `src/`
2. Update test in `test/TokenLaunchpad.t.sol`
3. Run `forge test` to verify
4. If adding new functions, update `interfaces/` and add corresponding backend service

### Backend API Changes
1. Add route in `src/routes/`
2. Implement logic in `src/services/`
3. Create controller in `src/controllers/`
4. Update Prisma schema if needed (`prisma/schema.prisma`)
5. Run `npm run build && npm run start` to test
6. Add tests in `src/__tests__/`

## Key Technical Decisions

- **Bonding Curve AMM**: Fair price discovery without requiring paired liquidity
- **Uniswap V3 Integration**: At 100 ETH market cap, tokens graduate to full DEX liquidity
- **Server-Side RPC Calls**: Backend handles all blockchain queries to reduce frontend complexity and RPC costs
- **Redis + PostgreSQL Caching**: Multi-layer strategy for performance (60s marketplace load → <1s with caching)
- **Event Indexing**: Blockchain events drive database updates, keeping data in sync
- **Modular Hooks**: Frontend hooks encapsulate contract logic, making components reusable

## Deployment Notes

- Frontend deploys to Vercel (Next.js native support)
- Backend can run in Docker (`docker-compose.yml` provided) or standalone Node.js
- Smart contracts deploy via Foundry scripts in `script/` directory
- Testnet: Push Chain (chain ID 42101)
