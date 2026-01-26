# Hodl.fun Smart Contract V2 - Backend Integration Reference

## Overview

This document contains essential smart contract information for backend development of the Hodl.fun token launchpad platform.

**Platform Purpose**: Users launch and trade ERC20 tokens with bonding curve mechanics. Tokens graduate to Uniswap V3 when market cap threshold is reached.

---

## Contract Addresses (Push Chain Testnet - Chain ID: 42101)

| Contract | Address | Purpose |
|----------|---------|---------|
| Core | `0x592F8f0abbB9a3d3c425980Ac0263363C8405b03` | Main entry point for all user interactions |
| Factory | `0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8` | Creates token + bonding curve pairs |
| FeeVault | `0xbe2fd9b720d1d7fac7208523376d2a3332019928` | Collects platform and creator fees |
| WPUSH | `0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7` | Wrapped native token |

**Network RPC**: `https://evm.rpc-testnet-donut-node1.push.org/`
**Block Explorer**: `https://donut.push.network/`

---

## Events to Index

### Token Creation Events

**From Core.sol:**
```solidity
event CreateCurve(
    address indexed creator,
    address indexed curve,
    address indexed token,
    string tokenURI,
    string name,
    string symbol
);
```

**From Factory.sol:**
```solidity
event Create(
    address indexed creator,
    address indexed curve,
    address indexed token,
    string tokenURI,
    string name,
    string symbol,
    uint256 virtualNative,
    uint256 virtualToken
);
```

### Trading Events

**From Core.sol:**
```solidity
event Buy(
    address indexed token,
    address indexed to,
    uint256 amountIn,      // PUSH spent
    uint256 amountOut,     // Tokens received
    uint256 price,         // Current price (1e18 scaled)
    uint256 timestamp
);

event Sell(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountIn,      // Tokens sold
    uint256 amountOut,     // PUSH received
    uint256 price,         // Current price (1e18 scaled)
    uint256 timestamp
);
```

**From BondingCurve.sol (per-token):**
```solidity
event Buy(
    address indexed to,
    address indexed token,
    uint256 amountNativeIn,
    uint256 amountOut,
    uint256 price,
    uint256 timestamp
);

event Sell(
    address indexed to,
    address indexed token,
    uint256 amountTokenIn,
    uint256 amountOut,
    uint256 price,
    uint256 timestamp
);

event Sync(
    address indexed token,
    uint256 realNative,      // Actual WPUSH in curve
    uint256 realToken,       // Actual tokens in curve
    uint256 virtualNative,   // Virtual PUSH reserve (for pricing)
    uint256 virtualToken,    // Virtual token reserve (for pricing)
    uint256 price,
    uint256 timestamp
);
```

### Graduation Events

**From BondingCurve.sol:**
```solidity
event Lock(address indexed token);  // Trading locked on bonding curve

event Listing(
    address indexed curve,
    address indexed token,
    address indexed pool,    // Uniswap V3 pool address
    uint256 amount0,
    uint256 amount1,
    uint128 liquidity
);
```

### Price Tracking Events

**From BondingCurve.sol:**
```solidity
event NewATHPrice(
    address indexed token,
    uint256 newPrice,
    uint256 timestamp
);

event NewATHMarketCap(
    address indexed token,
    uint256 newMarketCap,
    uint256 timestamp
);
```

### Fee Events

**From Factory.sol:**
```solidity
event CreatorFeesAccumulated(
    address indexed creator,
    uint256 amount,
    uint256 totalAccumulated
);

event CreatorFeesClaimed(
    address indexed creator,
    uint256 amount
);
```

---

## View Functions for Backend Queries

### Core.sol - Main Query Functions

```solidity
// Get token's bonding curve data
function getCurveData(address curve) external view returns (
    uint256 virtualNative,
    uint256 virtualToken,
    uint256 k
);

// Calculate output for a given input
function getAmountOut(
    uint256 amountIn,
    uint256 k,
    uint256 reserveIn,
    uint256 reserveOut
) external pure returns (uint256 amountOut);

// Calculate required input for desired output
function getAmountIn(
    uint256 amountOut,
    uint256 k,
    uint256 reserveIn,
    uint256 reserveOut
) external pure returns (uint256 amountIn);

// Get current token price (PUSH per token, 1e18 scaled)
function getCurrentPrice(address token) external view returns (uint256 price);

// Get current market cap in PUSH
function calculateMarketCap(address token) external view returns (uint256 marketCap);
```

### BondingCurve.sol - Per-Token Queries

```solidity
// Real balances in the curve
function getReserves() external view returns (
    uint256 nativeReserves,
    uint256 tokenReserves
);

// Virtual reserves used for pricing
function getVirtualReserves() external view returns (
    uint256 virtualNative,
    uint256 virtualToken
);

// Constant product invariant
function getK() external view returns (uint256 k);

// Current price (1e18 scaled)
function getCurrentPrice() external view returns (uint256 price);

// Market cap in PUSH
function calculateMarketCap() external view returns (uint256 marketCap);

// All-time high tracking
function getATHPrice() external view returns (uint256 price, uint256 timestamp);
function getATHMarketCap() external view returns (uint256 marketCap, uint256 timestamp);

// Graduation status
function getLock() external view returns (bool locked);      // True = graduation triggered
function getIsListing() external view returns (bool listed); // True = listed on DEX
```

### Factory.sol - Global Queries

```solidity
// Get bonding curve address for a token
function getCurve(address token) external view returns (address curve);

// Get token address for a curve
function getToken(address curve) external view returns (address token);

// Check if address is a valid bonding curve
function isCurve(address curve) external view returns (bool);

// Get creator's accumulated fees
function getCreatorFees(address creator) external view returns (uint256);

// Get global configuration
function getConfig() external view returns (Config memory);
```

---

## Configuration Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| Total Supply | 1,000,000,000 (1B) | Fixed token supply per token |
| Deploy Fee | 0.01 PUSH | Cost to create a token |
| Listing Fee | 0.1 PUSH | Cost for DEX graduation |
| Virtual Native | 1 PUSH | Initial virtual PUSH reserve |
| Virtual Token | 50,000,000 | Initial virtual token reserve |
| Graduation Market Cap | 1,000,000 PUSH | Threshold for DEX listing |
| Trading Fee | 1% | Total fee on trades |
| Creator Fee Share | 30% | Portion of fee to creator |
| Liquidity Reserve | 20% | Portion of fee for DEX liquidity |
| Platform Fee | 50% | Portion of fee to FeeVault |
| DEX Fee Tier | 3000 (0.30%) | Uniswap V3 fee tier |

---

## Token Lifecycle States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATED   │────▶│   TRADING   │────▶│   LOCKED    │────▶│   LISTED    │
│             │     │             │     │             │     │             │
│ Token +     │     │ Buy/sell    │     │ Graduation  │     │ Trading on  │
│ curve       │     │ on bonding  │     │ triggered,  │     │ Uniswap V3  │
│ deployed    │     │ curve       │     │ curve frozen│     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                               │
                          marketCap >= 1M PUSH │
                                               ▼
                                        Lock event
                                               │
                                 listing() called
                                               │
                                               ▼
                                        Listing event
```

**State Detection:**
- `CREATED` → Token exists, no trades yet
- `TRADING` → `getLock() == false && getIsListing() == false`
- `LOCKED` → `getLock() == true && getIsListing() == false`
- `LISTED` → `getIsListing() == true`

---

## Price Calculation Formula

### Constant Product AMM: `k = virtualNative × virtualToken`

**Price Calculation:**
```
price = (virtualNative × 1e18) / virtualToken
```

**Market Cap Calculation:**
```
marketCap = (price × TOTAL_SUPPLY) / 1e18
         = (price × 1,000,000,000e18) / 1e18
```

**Buy Calculation (PUSH → Token):**
```
newVirtualNative = virtualNative + amountIn
newVirtualToken = k / newVirtualNative
amountOut = virtualToken - newVirtualToken
```

**Sell Calculation (Token → PUSH):**
```
newVirtualToken = virtualToken + amountIn
newVirtualNative = k / newVirtualToken
amountOut = virtualNative - newVirtualNative
```

---

## Fee Distribution on Sell

```
Sell Amount: 100 PUSH
         │
         ├── User Receives: 99 PUSH (99%)
         │
         └── Fee: 1 PUSH (1%)
                  │
                  ├── Liquidity Reserve: 0.2 PUSH (20% of fee)
                  │   └── Stays in BondingCurve for DEX LP
                  │
                  ├── Creator: 0.3 PUSH (30% of fee)
                  │   └── Accumulated in Factory, claimable
                  │
                  └── Platform: 0.5 PUSH (50% of fee)
                      └── Sent to FeeVault
```

---

## Backend Database Schema Recommendations

### Tokens Table
```sql
- id: UUID
- address: string (token contract address)
- curve_address: string (bonding curve address)
- creator_address: string
- name: string
- symbol: string
- token_uri: string (metadata URI)
- virtual_native: bigint (current virtual PUSH reserve)
- virtual_token: bigint (current virtual token reserve)
- real_native: bigint (actual PUSH in curve)
- real_token: bigint (actual tokens in curve)
- current_price: bigint (1e18 scaled)
- market_cap: bigint
- ath_price: bigint
- ath_price_timestamp: timestamp
- ath_market_cap: bigint
- ath_market_cap_timestamp: timestamp
- status: enum (TRADING, LOCKED, LISTED)
- pool_address: string (Uniswap V3 pool, if listed)
- created_at: timestamp
- created_block: bigint
- graduated_at: timestamp (nullable)
- listed_at: timestamp (nullable)
```

### Trades Table
```sql
- id: UUID
- token_address: string
- type: enum (BUY, SELL)
- trader_address: string
- amount_in: bigint
- amount_out: bigint
- price: bigint (1e18 scaled)
- fee_amount: bigint
- tx_hash: string
- block_number: bigint
- timestamp: timestamp
```

### Holders Table
```sql
- id: UUID
- token_address: string
- holder_address: string
- balance: bigint
- first_buy_timestamp: timestamp
- last_activity_timestamp: timestamp
```

### Creator Fees Table
```sql
- id: UUID
- creator_address: string
- accumulated_fees: bigint
- claimed_fees: bigint
- last_accumulation_timestamp: timestamp
- last_claim_timestamp: timestamp (nullable)
```

### Price History Table (for charts)
```sql
- id: UUID
- token_address: string
- timestamp: timestamp
- open: bigint
- high: bigint
- low: bigint
- close: bigint
- volume_native: bigint
- volume_token: bigint
- trade_count: int
- interval: enum (1m, 5m, 15m, 1h, 4h, 1d)
```

---

## Indexer Implementation Notes

### Event Processing Order
1. **CreateCurve/Create** → Insert new token record
2. **Buy/Sell** → Update reserves, insert trade, update holder balances
3. **Sync** → Update reserves (authoritative source of reserve state)
4. **NewATHPrice/NewATHMarketCap** → Update ATH fields
5. **Lock** → Update token status to LOCKED
6. **Listing** → Update token status to LISTED, store pool address

### Handling Reorgs
- Store block number and block hash with each record
- On reorg detection, delete records from affected blocks
- Re-index from the fork point

### Rate Limiting Considerations
- Poll for new blocks every 3-5 seconds
- Batch RPC calls when querying multiple tokens
- Cache view function results with short TTL

### WebSocket Events to Push
```json
// New token created
{ "type": "token_created", "token": {...} }

// Trade executed
{ "type": "trade", "token_address": "0x...", "trade": {...} }

// Price update
{ "type": "price_update", "token_address": "0x...", "price": "...", "market_cap": "..." }

// Token graduated
{ "type": "graduation", "token_address": "0x...", "status": "LOCKED" }

// Token listed on DEX
{ "type": "listing", "token_address": "0x...", "pool_address": "0x...", "status": "LISTED" }

// New ATH
{ "type": "ath", "token_address": "0x...", "ath_type": "price|market_cap", "value": "..." }
```

---

## API Endpoint Suggestions

### Token Endpoints
- `GET /tokens` - List all tokens (paginated, filterable by status)
- `GET /tokens/:address` - Get token details
- `GET /tokens/:address/trades` - Get trade history
- `GET /tokens/:address/holders` - Get holder list
- `GET /tokens/:address/price-history` - Get OHLC data

### User Endpoints
- `GET /users/:address/holdings` - Get user's token holdings
- `GET /users/:address/trades` - Get user's trade history
- `GET /users/:address/creator-fees` - Get creator fee info

### Platform Endpoints
- `GET /stats` - Platform statistics (total tokens, volume, etc.)
- `GET /trending` - Trending tokens by volume/activity
- `GET /new` - Recently created tokens

---

## Error Codes Reference

| Error | Description | Backend Handling |
|-------|-------------|------------------|
| `InvalidTo()` | Zero address recipient | Validate addresses before TX |
| `Expired()` | Transaction past deadline | Check timestamp before sending |
| `ExcessiveInput()` | Slippage exceeded | Calculate expected output, add buffer |
| `BondingCurveLocked()` | Curve graduated | Check status before trading |
| `InsufficientOutput()` | Not enough reserves | Validate against reserves |
| `CallerNotCore()` | Direct curve call | Always route through Core |

---

## Contract Interaction Patterns

### Reading Current State
```typescript
// Get token info
const curve = await factory.getCurve(tokenAddress);
const [virtualNative, virtualToken, k] = await core.getCurveData(curve);
const price = await core.getCurrentPrice(tokenAddress);
const marketCap = await core.calculateMarketCap(tokenAddress);
const isLocked = await bondingCurve.getLock();
const isListed = await bondingCurve.getIsListing();
```

### Simulating Trades
```typescript
// Simulate buy: How many tokens for X PUSH?
const amountOut = await core.getAmountOut(amountIn, k, virtualNative, virtualToken);

// Simulate sell: How much PUSH for X tokens?
const amountOut = await core.getAmountOut(amountIn, k, virtualToken, virtualNative);
```

---

*Last Updated: January 26, 2026*
*For: Backend Development Reference*
