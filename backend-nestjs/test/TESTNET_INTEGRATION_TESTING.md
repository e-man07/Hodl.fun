# HODL.FUN Backend & Smart Contract Integration Testing

## Overview

This document provides a comprehensive testing plan and checklist for validating the integration between the NestJS backend and the deployed smart contracts on Push Chain Testnet. It covers all API endpoints, contract interactions, event indexing, and real-time features.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Contract Configuration](#2-contract-configuration)
3. [Token Creation Flow](#3-token-creation-flow)
4. [Token Buy Flow](#4-token-buy-flow)
5. [Token Sell Flow](#5-token-sell-flow)
6. [Price & Market Data](#6-price--market-data)
7. [Token Graduation Flow](#7-token-graduation-flow)
8. [Portfolio Tracking](#8-portfolio-tracking)
9. [Trade History](#9-trade-history)
10. [Holder Data](#10-holder-data)
11. [Error Handling](#11-error-handling)
12. [Event Indexing](#12-event-indexing)
13. [WebSocket Real-time Updates](#13-websocket-real-time-updates)
14. [Performance Testing](#14-performance-testing)
15. [Security Testing](#15-security-testing)
16. [Test Execution Order](#16-test-execution-order)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Environment Setup

### Prerequisites

| Requirement | Description | Status |
|-------------|-------------|--------|
| Node.js >= 20.0.0 | Runtime environment | [ ] |
| Docker | For PostgreSQL and Redis | [ ] |
| Backend Server | Running with testnet configuration | [ ] |
| Database | PostgreSQL with Prisma migrations applied | [ ] |
| Redis | Running for caching and queues | [ ] |
| Test Wallets | Funded with testnet PUSH tokens (3 wallets) | [ ] |
| RPC URL | Testnet RPC endpoint configured | [ ] |

### Environment Variables

Create `.env.testnet` with:

```bash
# Network Configuration
PUSH_CHAIN_RPC_URL=https://rpc.push.org/testnet
PUSH_CHAIN_ID=42101

# Contract Addresses (must match deployed contracts)
V2_CORE_ADDRESS=0x592F8f0abbB9a3d3c425980Ac0263363C8405b03
V2_FACTORY_ADDRESS=0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8
V2_FEE_VAULT_ADDRESS=0xbe2fd9b720d1d7fac7208523376d2a3332019928
V2_WPUSH_ADDRESS=0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7

# Testnet Wallet (for testing - DO NOT use production keys)
TESTNET_PRIVATE_KEY=0x...
TESTNET_WALLET_ADDRESS=0x...

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/hodlfun_testnet

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3000
NODE_ENV=development
```

### Fund Test Wallets
- Get testnet PUSH from faucet: https://faucet.push.org
- Fund at least 3 test wallets:
  - Creator wallet (for token creation)
  - Trader wallet 1 (buy/sell)
  - Trader wallet 2 (additional trades)

### Setup Checklist

- [ ] Clone repository and install dependencies
- [ ] Configure `.env` with testnet values
- [ ] Run `npx prisma db push` to sync schema
- [ ] Start Redis: `docker-compose up -d redis`
- [ ] Start backend: `npm run start:dev:api`
- [ ] Verify health endpoint: `curl http://localhost:3000/health`

---

## 2. Contract Configuration

### GET /transactions/contracts

**Purpose**: Verify backend has correct contract addresses configured

**Test Command**:
```bash
curl http://localhost:3000/transactions/contracts | jq
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "core": "0x592F8f0abbB9a3d3c425980Ac0263363C8405b03",
    "factory": "0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8",
    "bondingCurve": "0x...",
    "feeVault": "0xbe2fd9b720d1d7fac7208523376d2a3332019928",
    "wpush": "0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7"
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 2.1 | Returns valid `core` contract address | [ ] | |
| 2.2 | Returns valid `factory` contract address | [ ] | |
| 2.3 | Returns valid `bondingCurve` address | [ ] | |
| 2.4 | Returns valid `feeVault` address | [ ] | |
| 2.5 | Returns valid `wpush` address | [ ] | |
| 2.6 | All addresses match deployed testnet contracts | [ ] | |
| 2.7 | Addresses are checksummed correctly | [ ] | |

### Contract Functions Reference

**Core Contract:**
- `exactInBuy(amountIn, amountOutMin, token, to, deadline)`
- `exactInSell(amountIn, amountOutMin, token, from, to, deadline)`
- `quoteExactInBuy(curve, amountIn)`
- `quoteExactInSell(curve, amountIn)`

**Factory Contract:**
- `createCurve(creator, name, symbol, tokenURI, amountIn, fee)`
- `getCurve(token)` - Returns bonding curve address
- `creatorFees(creator)` - Returns accumulated fees
- `claimCreatorFees()` - Claims accumulated fees

---

## 3. Token Creation Flow

### 3.1 Build Create Token Transaction

**Endpoint**: `POST /transactions/build/create-token`

**Test Command**:
```bash
curl -X POST http://localhost:3000/transactions/build/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "creator": "0xYourWalletAddress",
    "name": "Test Token",
    "symbol": "TEST",
    "tokenURI": "ipfs://QmTest...",
    "amountIn": "1000000000000000000"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "to": "0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8",
    "data": "0x...",
    "value": "1000000000000000000"
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 3.1.1 | Returns valid `to` (factory address) | [ ] | |
| 3.1.2 | Returns valid `data` (encoded calldata) | [ ] | |
| 3.1.3 | Returns correct `value` (initial liquidity amount) | [ ] | |
| 3.1.4 | Calldata decodes to correct function signature | [ ] | |

### 3.2 Execute Token Creation (On-Chain)

**Verification Script**:
```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Get transaction data from API
const response = await fetch(`${API_URL}/transactions/build/create-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    creator: wallet.address,
    name: 'Test Token',
    symbol: 'TEST',
    tokenURI: 'ipfs://QmTest',
    amountIn: '1000000000000000000',
  }),
});
const txData = await response.json();

// Send the transaction
const tx = await wallet.sendTransaction({
  to: txData.data.to,
  data: txData.data.data,
  value: txData.data.value,
});

console.log('Transaction hash:', tx.hash);
const receipt = await tx.wait();
console.log('Token created in block:', receipt.blockNumber);

// Parse logs to get new token address
const factoryInterface = new ethers.Interface(FACTORY_ABI);
const tokenCreatedLog = receipt.logs.find(log =>
  log.topics[0] === factoryInterface.getEvent('CreateCurve').topicHash
);
const decodedLog = factoryInterface.parseLog(tokenCreatedLog);
console.log('New token address:', decodedLog.args.token);
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 3.2.1 | Transaction is signable by wallet | [ ] | |
| 3.2.2 | Transaction executes successfully | [ ] | |
| 3.2.3 | Gas estimation is reasonable | [ ] | |
| 3.2.4 | CreateCurve event is emitted | [ ] | |
| 3.2.5 | New token address is valid | [ ] | |

### 3.3 Verify Token in Database

**Test Command**:
```bash
curl http://localhost:3000/tokens/0xNewTokenAddress | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 3.3.1 | Token appears in database within 30 seconds | [ ] | |
| 3.3.2 | `creator` matches transaction sender | [ ] | |
| 3.3.3 | `name` and `symbol` are correct | [ ] | |
| 3.3.4 | `currentPrice` reflects initial bonding curve price | [ ] | |
| 3.3.5 | `marketCap` is calculated correctly | [ ] | |
| 3.3.6 | `totalSupply` matches contract | [ ] | |
| 3.3.7 | `isLocked` is false initially | [ ] | |
| 3.3.8 | `isListed` is false initially | [ ] | |

---

## 4. Token Buy Flow

### 4.1 Build Buy Transaction

**Endpoint**: `POST /transactions/build/buy`

**Test Command**:
```bash
curl -X POST http://localhost:3000/transactions/build/buy \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0xTokenAddress",
    "to": "0xYourWalletAddress",
    "amountIn": "1000000000000000000",
    "amountOutMin": "0"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "to": "0x592F8f0abbB9a3d3c425980Ac0263363C8405b03",
    "data": "0x...",
    "value": "1000000000000000000"
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.1.1 | Returns valid `to` (core contract address) | [ ] | |
| 4.1.2 | Returns valid `data` (encoded buy calldata) | [ ] | |
| 4.1.3 | Returns correct `value` (PUSH amount to send) | [ ] | |
| 4.1.4 | `amountOutMin` slippage calculation works | [ ] | |

### 4.2 Execute Buy (On-Chain)

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.2.1 | Transaction executes successfully | [ ] | |
| 4.2.2 | Token balance increases in wallet | [ ] | |
| 4.2.3 | PUSH balance decreases correctly | [ ] | |
| 4.2.4 | Buy event is emitted | [ ] | |

### 4.3 Verify Buy in Backend

**Check Price Update**:
```bash
curl http://localhost:3000/tokens/0xTokenAddress | jq '.data.currentPrice'
```

**Check Trade History**:
```bash
curl http://localhost:3000/trades/token/0xTokenAddress | jq
```

**Check User Portfolio**:
```bash
curl http://localhost:3000/portfolios/0xYourWalletAddress | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.3.1 | Price updates after buy | [ ] | |
| 4.3.2 | Trade appears in `/trades/token/:address` | [ ] | |
| 4.3.3 | Trade appears in `/trades/user/:address` | [ ] | |
| 4.3.4 | User portfolio updates with new holding | [ ] | |
| 4.3.5 | `avgBuyPrice` is calculated correctly | [ ] | |
| 4.3.6 | `totalSpent` increases by amountIn | [ ] | |

### 4.4 Quote Validation

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.4.1 | Quoted `amountOut` approximately matches received tokens | [ ] | |
| 4.4.2 | Slippage protection works (tx reverts if exceeded) | [ ] | |
| 4.4.3 | Price impact is calculated correctly for large buys | [ ] | |

---

## 5. Token Sell Flow

### 5.1 Build Approve Transaction

**Endpoint**: `POST /transactions/build/approve`

**Test Command**:
```bash
curl -X POST http://localhost:3000/transactions/build/approve \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0xTokenAddress",
    "amount": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "to": "0xTokenAddress",
    "data": "0x095ea7b3...",
    "value": "0"
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 5.1.1 | Returns valid approval transaction | [ ] | |
| 5.1.2 | `to` is the token address | [ ] | |
| 5.1.3 | Approval targets correct spender (core contract) | [ ] | |
| 5.1.4 | Execute approval transaction on-chain | [ ] | |

### 5.2 Build Sell Transaction

**Endpoint**: `POST /transactions/build/sell`

**Test Command**:
```bash
curl -X POST http://localhost:3000/transactions/build/sell \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0xTokenAddress",
    "from": "0xYourWalletAddress",
    "to": "0xYourWalletAddress",
    "amountIn": "500000000000000000000",
    "amountOutMin": "0"
  }'
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 5.2.1 | Returns valid `to` (core contract address) | [ ] | |
| 5.2.2 | Returns valid `data` (encoded sell calldata) | [ ] | |
| 5.2.3 | `value` is "0" (no PUSH sent for sells) | [ ] | |

### 5.3 Execute Sell (On-Chain)

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 5.3.1 | Transaction executes successfully | [ ] | |
| 5.3.2 | PUSH balance increases in wallet | [ ] | |
| 5.3.3 | Token balance decreases | [ ] | |
| 5.3.4 | Sell event is emitted | [ ] | |

### 5.4 Verify Sell in Backend

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 5.4.1 | Price updates after sell | [ ] | |
| 5.4.2 | Trade appears in trade history | [ ] | |
| 5.4.3 | Portfolio balance updates | [ ] | |
| 5.4.4 | `realizedPNL` calculates correctly | [ ] | |
| 5.4.5 | `totalSold` increases | [ ] | |

---

## 6. Price & Market Data

### 6.1 Real-time Price Accuracy

**Test Script**:
```typescript
// Compare API price with on-chain price
const apiResponse = await fetch(`${API_URL}/tokens/${tokenAddress}`);
const apiPrice = (await apiResponse.json()).data.currentPrice;

const bondingCurve = new ethers.Contract(BONDING_CURVE_ADDRESS, ABI, provider);
const onChainPrice = await bondingCurve.getCurrentPrice(tokenAddress);

console.log('API Price:', apiPrice);
console.log('On-chain Price:', onChainPrice.toString());
console.log('Match:', apiPrice === onChainPrice.toString());
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 6.1.1 | `GET /tokens/:address` price matches on-chain bonding curve | [ ] | |
| 6.1.2 | Price updates within 30 seconds after trades | [ ] | |
| 6.1.3 | Market cap calculation is accurate | [ ] | |
| 6.1.4 | Price change percentage is correct | [ ] | |

### 6.2 Price History

**Test Command**:
```bash
curl "http://localhost:3000/tokens/0xTokenAddress/price-history?interval=1h&limit=24" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 6.2.1 | Returns price history data | [ ] | |
| 6.2.2 | Timestamps are accurate | [ ] | |
| 6.2.3 | Price values match historical trades | [ ] | |
| 6.2.4 | Volume data aggregates correctly | [ ] | |
| 6.2.5 | Different intervals work (1h, 4h, 1d, 1w) | [ ] | |

### 6.3 Trending Tokens

**Test Command**:
```bash
curl "http://localhost:3000/tokens/trending/24h" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 6.3.1 | Returns tokens sorted by activity | [ ] | |
| 6.3.2 | Different timeframes work (1h, 24h, 7d) | [ ] | |
| 6.3.3 | Metrics (price, marketCap, trades) sort correctly | [ ] | |

---

## 7. Token Graduation Flow

### 7.1 Pre-Graduation State

**Test Command**:
```bash
curl "http://localhost:3000/tokens/graduating?threshold=80" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 7.1.1 | Returns tokens near graduation threshold | [ ] | |
| 7.1.2 | `graduationProgress` percentage is accurate | [ ] | |
| 7.1.3 | Threshold filter works | [ ] | |

### 7.2 Locked State (At Graduation Threshold)

When a token reaches the graduation market cap threshold:

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 7.2.1 | Token becomes `isLocked: true` | [ ] | |
| 7.2.2 | Buy transactions are rejected with clear error | [ ] | |
| 7.2.3 | Sell transactions are rejected with clear error | [ ] | |
| 7.2.4 | API reflects locked status | [ ] | |
| 7.2.5 | Lock event is indexed | [ ] | |

### 7.3 Post-Graduation (Uniswap Listing)

**Test Command**:
```bash
curl "http://localhost:3000/tokens/graduated" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 7.3.1 | Token `isListed` becomes true | [ ] | |
| 7.3.2 | `uniswapV3Pool` address is populated | [ ] | |
| 7.3.3 | `listingTimestamp` is set | [ ] | |
| 7.3.4 | Bonding curve trading is disabled | [ ] | |
| 7.3.5 | Uniswap pool is tradeable | [ ] | |
| 7.3.6 | Liquidity was migrated correctly | [ ] | |
| 7.3.7 | Listing event is indexed | [ ] | |

---

## 8. Portfolio Tracking

### 8.1 User Portfolio

**Test Command**:
```bash
curl "http://localhost:3000/portfolios/0xYourWalletAddress" | jq
```

**Expected Structure**:
```json
{
  "success": true,
  "data": {
    "userId": "0x...",
    "holdings": [
      {
        "tokenAddress": "0x...",
        "tokenSymbol": "TEST",
        "balance": "1000000000000000000000",
        "avgBuyPrice": "500000000000000",
        "totalSpent": "500000000000000000",
        "totalSold": "0",
        "realizedPNL": "0"
      }
    ],
    "totalInvestedPUSH": "500000000000000000"
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 8.1.1 | Returns user's holdings | [ ] | |
| 8.1.2 | Balances match on-chain balances | [ ] | |
| 8.1.3 | `avgBuyPrice` calculated correctly (weighted average) | [ ] | |
| 8.1.4 | `totalSpent` tracks cumulative investment | [ ] | |
| 8.1.5 | `totalSold` tracks cumulative sells | [ ] | |
| 8.1.6 | `realizedPNL` updates after sells | [ ] | |
| 8.1.7 | Non-existent portfolio returns 404 | [ ] | |

### 8.2 Portfolio Summary

**Test Command**:
```bash
curl "http://localhost:3000/portfolios/0xYourWalletAddress/summary" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 8.2.1 | Holdings count is accurate | [ ] | |
| 8.2.2 | Total invested matches sum of trades | [ ] | |
| 8.2.3 | Top holding is identified correctly | [ ] | |
| 8.2.4 | PNL calculations are accurate | [ ] | |

### 8.3 Portfolio Leaderboard

**Test Command**:
```bash
curl "http://localhost:3000/portfolios/leaderboard/top?limit=10" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 8.3.1 | Returns top portfolios by value | [ ] | |
| 8.3.2 | Sorting is correct | [ ] | |
| 8.3.3 | Limit parameter works | [ ] | |

---

## 9. Trade History

### 9.1 Trades by Token

**Test Command**:
```bash
curl "http://localhost:3000/trades/token/0xTokenAddress?limit=10" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.1.1 | Returns all trades for token | [ ] | |
| 9.1.2 | Trade details match on-chain events | [ ] | |
| 9.1.3 | Pagination works (limit, offset) | [ ] | |
| 9.1.4 | Sorting by timestamp works | [ ] | |
| 9.1.5 | Both buys and sells appear | [ ] | |

### 9.2 Trades by User

**Test Command**:
```bash
curl "http://localhost:3000/trades/user/0xYourWalletAddress" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.2.1 | Returns user's trade history | [ ] | |
| 9.2.2 | All tokens traded appear | [ ] | |
| 9.2.3 | Amounts and prices are accurate | [ ] | |
| 9.2.4 | Transaction hashes are correct | [ ] | |

### 9.3 Trade Statistics

**Test Commands**:
```bash
# Global stats
curl "http://localhost:3000/trades/stats" | jq

# Token-specific stats
curl "http://localhost:3000/trades/stats?tokenId=0xTokenAddress" | jq

# User-specific stats
curl "http://localhost:3000/trades/stats?user=0xYourWalletAddress" | jq
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.3.1 | Global trade count is accurate | [ ] | |
| 9.3.2 | Total buy volume is correct | [ ] | |
| 9.3.3 | Total sell volume is correct | [ ] | |
| 9.3.4 | Token-specific filtering works | [ ] | |
| 9.3.5 | User-specific filtering works | [ ] | |

---

## 10. Holder Data

### 10.1 Token Holders

**Test Command**:
```bash
curl "http://localhost:3000/tokens/0xTokenAddress/holders?limit=50" | jq
```

**Expected Structure**:
```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x...",
    "holders": [
      {
        "address": "0x...",
        "balance": "1000000000000000000000",
        "percentage": "10.00",
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 15
  }
}
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 10.1.1 | Returns current token holders | [ ] | |
| 10.1.2 | Balances match on-chain | [ ] | |
| 10.1.3 | Percentage calculations are correct | [ ] | |
| 10.1.4 | Zero-balance holders are excluded | [ ] | |
| 10.1.5 | Sorted by balance descending | [ ] | |
| 10.1.6 | Pagination works | [ ] | |

---

## 11. Error Handling

### 11.1 Invalid Transactions

**Test Commands**:
```bash
# Insufficient balance
curl -X POST http://localhost:3000/transactions/build/buy \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0xTokenAddress",
    "to": "0xWalletWithNoBalance",
    "amountIn": "999999999999999999999999999",
    "amountOutMin": "0"
  }'

# Invalid token address
curl http://localhost:3000/tokens/0x0000000000000000000000000000000000000000

# Invalid address format
curl http://localhost:3000/tokens/not-an-address
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 11.1.1 | Invalid token address returns 404 | [ ] | |
| 11.1.2 | Malformed address returns 400 | [ ] | |
| 11.1.3 | Missing required fields returns 400 | [ ] | |
| 11.1.4 | Error messages are descriptive | [ ] | |

### 11.2 Contract Reverts

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 11.2.1 | Trading on locked token returns error | [ ] | |
| 11.2.2 | Trading on graduated token (bonding curve) returns error | [ ] | |
| 11.2.3 | Zero amount transactions rejected | [ ] | |
| 11.2.4 | Slippage exceeded returns clear error | [ ] | |
| 11.2.5 | Insufficient allowance for sell returns error | [ ] | |

---

## 12. Event Indexing

### 12.1 CreateCurve Events

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.1.1 | New tokens indexed within 30 seconds | [ ] | |
| 12.1.2 | All token metadata captured | [ ] | |
| 12.1.3 | Creator address correct | [ ] | |
| 12.1.4 | Initial price set | [ ] | |

### 12.2 Trade Events (Buy/Sell)

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.2.1 | Trades indexed within 30 seconds | [ ] | |
| 12.2.2 | Amounts and prices accurate | [ ] | |
| 12.2.3 | User portfolios update | [ ] | |
| 12.2.4 | Token prices update | [ ] | |
| 12.2.5 | Volume metrics update | [ ] | |

### 12.3 ATH Events

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.3.1 | NewATHPrice events indexed | [ ] | |
| 12.3.2 | NewATHMarketCap events indexed | [ ] | |
| 12.3.3 | ATH values stored correctly | [ ] | |
| 12.3.4 | ATH timestamps recorded | [ ] | |

### 12.4 Graduation Events

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.4.1 | Lock event indexed | [ ] | |
| 12.4.2 | Listing event indexed | [ ] | |
| 12.4.3 | Uniswap pool address captured | [ ] | |
| 12.4.4 | Token status updated | [ ] | |

### 12.5 Creator Fee Events

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.5.1 | CreatorFeeDistributed events indexed | [ ] | |
| 12.5.2 | CreatorFeesAccumulated events indexed | [ ] | |
| 12.5.3 | CreatorFeesClaimed events indexed | [ ] | |

### 12.6 Indexer Recovery

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.6.1 | Indexer recovers after restart | [ ] | |
| 12.6.2 | No duplicate events processed | [ ] | |
| 12.6.3 | Block tracking is persistent | [ ] | |

---

## 13. WebSocket Real-time Updates

### 13.1 Market Gateway Connection

**Test Script**:
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');

  // Subscribe to token updates
  socket.emit('subscribe:token', { tokenAddress: '0x...' });
});

socket.on('price:update', (data) => {
  console.log('Price update:', data);
});

socket.on('trade:new', (data) => {
  console.log('New trade:', data);
});

socket.on('token:graduated', (data) => {
  console.log('Token graduated:', data);
});
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 13.1.1 | WebSocket connection establishes | [ ] | |
| 13.1.2 | Price updates broadcast on trades | [ ] | |
| 13.1.3 | New token events broadcast | [ ] | |
| 13.1.4 | Trade events broadcast to subscribers | [ ] | |
| 13.1.5 | Graduation events broadcast | [ ] | |
| 13.1.6 | Unsubscribe works correctly | [ ] | |

---

## 14. Performance Testing

### 14.1 API Response Times

**Benchmark Commands**:
```bash
# Install hey: brew install hey

# Test token list endpoint
hey -n 100 -c 10 "http://localhost:3000/tokens"

# Test single token endpoint
hey -n 100 -c 10 "http://localhost:3000/tokens/0xTokenAddress"

# Test trade history
hey -n 100 -c 10 "http://localhost:3000/trades/token/0xTokenAddress"
```

**Target Metrics**:
| Endpoint | Target p99 Latency |
|----------|-------------------|
| GET /tokens | < 200ms |
| GET /tokens/:address | < 100ms |
| GET /trades/token/:address | < 200ms |
| POST /transactions/build/* | < 500ms |

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 14.1.1 | Token list endpoint < 200ms p99 | [ ] | |
| 14.1.2 | Single token endpoint < 100ms p99 | [ ] | |
| 14.1.3 | Trade history < 200ms p99 | [ ] | |
| 14.1.4 | Transaction building < 500ms p99 | [ ] | |
| 14.1.5 | No memory leaks under load | [ ] | |

### 14.2 Database Query Performance

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 14.2.1 | Indexes are created for common queries | [ ] | |
| 14.2.2 | No N+1 query issues | [ ] | |
| 14.2.3 | Pagination prevents full table scans | [ ] | |

---

## 15. Security Testing

### 15.1 Input Validation

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 15.1.1 | SQL injection attempts rejected | [ ] | |
| 15.1.2 | XSS payloads sanitized | [ ] | |
| 15.1.3 | Address validation enforced | [ ] | |
| 15.1.4 | Amount validation (positive, not too large) | [ ] | |

### 15.2 Rate Limiting

**Test**:
```bash
# Send many requests quickly
for i in {1..100}; do
  curl -s http://localhost:3000/tokens &
done
wait
```

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 15.2.1 | Rate limiting is enforced | [ ] | |
| 15.2.2 | 429 response returned when exceeded | [ ] | |
| 15.2.3 | Rate limit resets after window | [ ] | |

### 15.3 Authentication (if applicable)

**Checklist**:
| # | Test | Status | Notes |
|---|------|--------|-------|
| 15.3.1 | Protected endpoints require auth | [ ] | |
| 15.3.2 | Invalid tokens rejected | [ ] | |
| 15.3.3 | Expired tokens rejected | [ ] | |

---

## 16. Test Execution Order

### Phase 1: Setup & Configuration
- [ ] 1.1 Verify environment variables
- [ ] 1.2 Verify contract addresses match
- [ ] 1.3 Test health endpoint
- [ ] 1.4 Test database connectivity
- [ ] 1.5 Test Redis connectivity

### Phase 2: Read-Only Tests
- [ ] 2.1 Test RPC connection
- [ ] 2.2 Test contract reads
- [ ] 2.3 Test quote endpoints

### Phase 3: Token Creation
- [ ] 3.1 Build create token transaction
- [ ] 3.2 Execute on testnet
- [ ] 3.3 Verify token appears in API

### Phase 4: Trading
- [ ] 4.1 Build and execute buy transaction
- [ ] 4.2 Verify price update
- [ ] 4.3 Verify trade history
- [ ] 4.4 Verify portfolio update
- [ ] 4.5 Build and execute approval
- [ ] 4.6 Build and execute sell transaction
- [ ] 4.7 Verify PNL calculations

### Phase 5: Market Data
- [ ] 5.1 Verify real-time price accuracy
- [ ] 5.2 Test price history
- [ ] 5.3 Test trending tokens
- [ ] 5.4 Test holder data

### Phase 6: Advanced Flows
- [ ] 6.1 Test multiple trades (price curve movement)
- [ ] 6.2 Test ATH tracking
- [ ] 6.3 Test creator fees
- [ ] 6.4 Test near-graduation state
- [ ] 6.5 Test locked token behavior
- [ ] 6.6 Test graduation (if threshold reachable)

### Phase 7: Real-time & Performance
- [ ] 7.1 Test WebSocket connections
- [ ] 7.2 Run performance benchmarks
- [ ] 7.3 Test under load

### Phase 8: Error Handling & Security
- [ ] 8.1 Test error responses
- [ ] 8.2 Test input validation
- [ ] 8.3 Test rate limiting

---

## 17. Troubleshooting

### Common Issues

**1. RPC Connection Fails**
```
Error: Unable to connect to RPC
```
- Check PUSH_CHAIN_RPC_URL
- Verify network connectivity
- Try alternative RPC endpoint

**2. Transaction Reverts**
```
Error: execution reverted
```
- Check gas estimation
- Verify input parameters
- Check contract state (paused, etc.)
- Ensure sufficient PUSH balance

**3. Events Not Indexed**
```
Events missing from database
```
- Check indexer is running
- Verify FROM_BLOCK is correct
- Check Redis queue for pending jobs
- Look for errors in indexer logs

**4. Quote Returns Zero**
```
Quote returns 0 amount out
```
- Token may not exist
- Curve may not be initialized
- Amount too small

**5. Graduation Fails**
```
Listing transaction fails
```
- Token not locked
- Insufficient liquidity
- Uniswap pool creation issue

### Debug Commands

```bash
# Check contract deployment
cast call $V2_CORE_ADDRESS "factory()" --rpc-url $PUSH_CHAIN_RPC_URL

# Get curve for token
cast call $V2_FACTORY_ADDRESS "getCurve(address)" $TOKEN_ADDRESS --rpc-url $PUSH_CHAIN_RPC_URL

# Check token balance
cast call $TOKEN_ADDRESS "balanceOf(address)" $WALLET_ADDRESS --rpc-url $PUSH_CHAIN_RPC_URL

# Get buy quote
cast call $V2_CORE_ADDRESS "quoteExactInBuy(address,uint256)" $CURVE_ADDRESS 1000000000000000000 --rpc-url $PUSH_CHAIN_RPC_URL
```

### Database Validation Queries

```sql
-- Count tokens by state
SELECT
  COUNT(*) FILTER (WHERE "isListed" = false AND "isLocked" = false) AS active,
  COUNT(*) FILTER (WHERE "isLocked" = true AND "isListed" = false) AS locked,
  COUNT(*) FILTER (WHERE "isListed" = true) AS graduated
FROM "tokens";

-- Recent trades
SELECT "tokenAddress", "type", "amountIn", "amountOut", "createdAt"
FROM "transactions"
WHERE "type" IN ('buy', 'sell')
ORDER BY "createdAt" DESC
LIMIT 20;

-- Indexer status
SELECT * FROM "indexer_state";
```

---

## Test Results Summary

| Category | Tests | Passed | Failed |
|----------|-------|--------|--------|
| Contract Configuration | 7 | | |
| Token Creation | 13 | | |
| Token Buy | 13 | | |
| Token Sell | 12 | | |
| Price & Market Data | 12 | | |
| Graduation | 12 | | |
| Portfolio | 11 | | |
| Trade History | 12 | | |
| Holder Data | 6 | | |
| Error Handling | 9 | | |
| Event Indexing | 16 | | |
| WebSocket | 6 | | |
| Performance | 7 | | |
| Security | 7 | | |
| **Total** | **143** | | |

---

## Notes & Issues

Use this section to document any issues found during testing:

### Issue Template
```
### Issue [#]: [Title]
- **Category**: [Token Creation/Trading/Indexing/etc.]
- **Severity**: [Critical/High/Medium/Low]
- **Description**:
- **Steps to Reproduce**:
- **Expected Behavior**:
- **Actual Behavior**:
- **Transaction Hash** (if applicable):
- **Status**: Open/In Progress/Fixed
- **Resolution**:
```

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Engineer | | | |
| Tech Lead | | | |

---

## Appendix: Event Verification Matrix

| Event | Source Contract | Handler | Database Updates |
|-------|-----------------|---------|------------------|
| CreateCurve | Factory | TradeIndexingProcessor | Token, BlockchainEvent |
| Buy | Core | TradeIndexingProcessor | Transaction, Portfolio, PriceHistory |
| Sell | Core | TradeIndexingProcessor | Transaction, Portfolio, PriceHistory |
| Lock | BondingCurve | TradeIndexingProcessor | Token.isLocked |
| Listing | BondingCurve | TradeIndexingProcessor | Token.isListed, Token.uniswapV3Pool |
| NewATHPrice | BondingCurve | TradeIndexingProcessor | Token.athPrice, Token.athPriceTimestamp |
| NewATHMarketCap | BondingCurve | TradeIndexingProcessor | Token.athMarketCap, Token.athMarketCapTimestamp |
| Sync | BondingCurve | TradeIndexingProcessor | Token reserves, currentPrice |
| CreatorFeeDistributed | BondingCurve | TradeIndexingProcessor | CreatorFee |
| CreatorFeesAccumulated | Factory | TradeIndexingProcessor | CreatorFee |
| CreatorFeesClaimed | Factory | TradeIndexingProcessor | CreatorFee |
