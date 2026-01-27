# Frontend Architecture Alignment Fixes

This document tracks the gaps identified between the frontend architecture and the actual backend/smart contract implementations, along with the fixes applied.

---

## 1. Gaps Identified

### 1.1 Missing Contract Functions

| Contract | Function | Purpose | Status |
|----------|----------|---------|--------|
| Core | `exactOutBuy()` | Buy exact amount of tokens | **ADDED** |
| Core | `exactOutSell()` | Sell for exact amount of PUSH | **ADDED** |
| Core | `getCurrentPrice()` | Get token price directly | **ADDED** |
| Core | `calculateMarketCap()` | Get market cap directly | **ADDED** |
| Core | `getAmountOut()` | Calculate output for input | **ADDED** |
| Core | `getAmountIn()` | Calculate input for output | **ADDED** |
| Core | `getCurveData()` | Get curve reserves/k | **ADDED** |
| Factory | `getCreator()` | Get token creator address | **ADDED** |
| Factory | `getConfig()` | Get platform configuration | **ADDED** |
| Factory | `getCreatorFeeShare()` | Get creator fee percentage | **ADDED** |
| BondingCurve | `getATHPrice()` | Get all-time high price | **ADDED** |
| BondingCurve | `getATHMarketCap()` | Get all-time high market cap | **ADDED** |
| BondingCurve | `getGraduationMarketCap()` | Get graduation threshold | **ADDED** |
| BondingCurve | `getLock()` | Check if curve is locked | **ADDED** |
| BondingCurve | `getIsListing()` | Check if listed on DEX | **ADDED** |

### 1.2 Missing WebSocket Events

| Event | Room | Payload | Status |
|-------|------|---------|--------|
| `graduation` | token:{address} | `{ tokenAddress, poolAddress? }` | **ADDED** |
| `listing` | token:{address} | `{ tokenAddress, poolAddress }` | **ADDED** |
| `my_trade` | wallet:{address} | `{ type, tokenAddress, trade }` | **ADDED** |

### 1.3 Missing API Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /users/:address` | Get user profile | **ADDED** |
| `PUT /users/:address/profile` | Update user profile | **ADDED** |
| `GET /users/:address/creator-fees` | Get creator fees breakdown | **ADDED** |

### 1.4 Incorrect Implementations

| Issue | Fix | Status |
|-------|-----|--------|
| `calculateBuyOutput` doesn't exist on Core | Use `getAmountOut()` with reserves | **FIXED** |
| `calculateSellOutput` doesn't exist on Core | Use `getAmountIn()` with reserves | **FIXED** |
| Token creation fee parameter order | Fixed to match actual ABI | **FIXED** |

### 1.5 Missing Types

| Type | Fields Added | Status |
|------|--------------|--------|
| Token | `athPrice`, `athPriceTimestamp`, `athMarketCap`, `athMarketCapTimestamp`, `graduatedAt`, `listedAt` | **ADDED** |
| Trade | `feeAmount`, `blockNumber` | **ADDED** |
| CreatorFee | Full model | **ADDED** |
| FactoryConfig | Full struct | **ADDED** |
| UserProfile | `displayName`, `bio`, `avatarUri`, `twitter`, `telegram`, `website` | **ADDED** |
| UpdateProfileRequest | Profile update with wallet signature | **ADDED** |
| CreatorFeeResponse | Detailed fee breakdown by token | **ADDED** |

---

## 2. Files Updated

1. **INTEGRATION.md** - Contract hooks, trading hooks, API endpoints
2. **ARCHITECTURE.md** - WebSocket events, TypeScript types
3. **PAGES.md** - Creator fees UI section

---

## 3. Verification Checklist

After implementing, verify these work correctly:

- [ ] All Core contract functions callable
- [ ] All Factory contract functions callable
- [ ] BondingCurve read functions work
- [ ] WebSocket receives all event types
- [ ] API endpoints match backend exactly
- [ ] TypeScript types match Prisma schema
- [ ] Token creation flow works end-to-end
- [ ] Trading (exactIn and exactOut) works
- [ ] Creator fee claiming works
- [ ] Profile view loads correctly
- [ ] Profile edit with wallet signature works
- [ ] Avatar upload to IPFS works
- [ ] Social links validation works
- [ ] Creator fees breakdown displays correctly
