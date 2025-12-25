# Cross-Chain Architecture for Push Chain

## Question: How Do Cross-Chain Operations Work?

When someone from Ethereum or Solana wants to launch a token on Push Chain, how do wrapping, unwrapping, and DEX listing work?

## Understanding Push Chain's Universal Features

### 1. Universal Fee Abstraction
- **Users pay gas fees in their native token** (ETH, SOL, PUSH)
- Push Chain handles the conversion internally
- **Does NOT mean assets are cross-chain** - it's just fee payment

### 2. Universal Smart Contracts
- Contracts work across chains for **transaction execution**
- **Assets still need to be on Push Chain** to interact with contracts
- Users from other chains can CALL contracts, but assets must be bridged/wrapped

### 3. Universal Address System
- Push Chain recognizes addresses from other chains
- Maps to Universal Executor Accounts (UEA) on Push Chain
- Enables transaction verification from other chains

## Key Insight: Fee Abstraction ≠ Asset Abstraction

**Important**: Universal Fee Abstraction lets users PAY GAS with ETH/SOL, but it doesn't automatically bring ETH/SOL assets to Push Chain for trading.

## How Cross-Chain Token Launches Work

### Scenario 1: User from Ethereum Wants to Launch Token

```
User (Ethereum) → Wants to Launch Token on Push Chain
```

**Steps:**

1. **Bridge/Wrap Assets to Push Chain**
   - User needs to bridge ETH to Push Chain
   - Or use Push Chain's bridge to wrap ETH → wETH on Push Chain
   - Assets must exist on Push Chain before interacting

2. **Launch Token**
   - User calls `Core.createCurve()` from Ethereum address
   - Push Chain recognizes Ethereum signature (Universal Signature Verification)
   - User pays gas with ETH (Universal Fee Abstraction)
   - But user must have PUSH or wrapped assets on Push Chain for:
     - Deploy fee
     - Initial liquidity (if providing)

3. **Bonding Curve Operations**
   - All operations happen on Push Chain
   - Uses assets that exist on Push Chain (PUSH, WPUSH, or wrapped tokens)

4. **DEX Listing**
   - Token pairs with assets on Push Chain
   - Could be WPUSH/Token or wETH/Token (if wETH exists on Push Chain)

### Scenario 2: User Pays with ETH, But Assets Need to Be on Push Chain

```
User sends transaction from Ethereum
  ↓
Universal Fee Abstraction: Pay gas with ETH ✅
  ↓
But for bonding curve:
  - Must have assets on Push Chain
  - Either native PUSH or wrapped tokens (wETH, etc.)
```

## Current Contract Architecture

### What Our Contracts Currently Support

```solidity
// Core.exactInBuy accepts native PUSH
function exactInBuy(...) external payable {
    // Wraps PUSH → WPUSH internally
    IWNative(wNative).deposit{value: msg.value}();
    // Uses WPUSH for operations
}
```

**Current Limitation**: Only accepts PUSH (native Push Chain token)

### What We Need for Full Cross-Chain Support

#### Option 1: Support Multiple Wrapped Assets

```solidity
// Support multiple quote tokens
mapping(address => bool) public supportedQuoteTokens; // WPUSH, wETH, wSOL, etc.

function exactInBuy(
    address quoteToken, // WPUSH, wETH, etc.
    uint256 amountIn,
    ...
) external {
    // Accept any supported wrapped token
    IERC20(quoteToken).safeTransferFrom(msg.sender, curve, amountIn);
    // Use quoteToken for bonding curve
}
```

**Pros:**
- Supports multiple chains natively
- Users can use their preferred asset

**Cons:**
- More complex (multiple quote tokens per curve)
- Need to manage multiple liquidity pools
- Price discovery becomes more complex

#### Option 2: Single Quote Token (WPUSH) - Current Approach

```solidity
// Only use WPUSH as quote token
function exactInBuy(...) external payable {
    // Always wraps to WPUSH
    // Users must bridge their assets → WPUSH first
}
```

**Pros:**
- Simpler architecture
- Single liquidity pool per token
- Standardized pricing

**Cons:**
- Users must convert their assets to WPUSH first
- Extra step for cross-chain users

## Recommended Approach

### Phase 1: Single Quote Token (WPUSH) - Current Design ✅

**Why:**
1. Simpler to implement and audit
2. Standardized pricing (all tokens priced in WPUSH)
3. Easier liquidity management
4. Works with current DEX infrastructure

**How Users Bridge Assets:**
- Users bridge ETH → Push Chain → WPUSH (via bridge)
- Users bridge SOL → Push Chain → WPUSH (via bridge)
- Users can use Push Chain's native bridge or third-party bridges

**User Flow:**
```
1. User has ETH on Ethereum
2. Bridges ETH → Push Chain (gets wETH or converts to WPUSH)
3. Calls Core.createCurve() or Core.exactInBuy()
4. Pays with WPUSH (or native PUSH which wraps to WPUSH)
5. All operations use WPUSH/PUSH
```

### Phase 2: Multi-Asset Support (Future Enhancement)

If you want to support multiple quote tokens:

```solidity
struct BondingCurveConfig {
    address quoteToken; // WPUSH, wETH, wSOL, etc.
    // ... other config
}

// Each curve can have different quote token
function createCurve(
    address quoteToken, // Choose quote token
    ...
) external {
    // Create curve with specified quote token
}
```

## DEX Listing Considerations

### Current Design
```solidity
// BondingCurve.listing() creates Uniswap pair
pair = IUniswapV2Factory(dexFactory).createPair(wNative, token);
// Pair is WPUSH/Token
```

**For Cross-Chain:**
- Pair will be WPUSH/Token (standard)
- Users who bridged ETH would need to:
  - Convert wETH → WPUSH, OR
  - Trade on separate wETH/Token pair (if exists)

### Alternative: Multiple Pairs
If you want to support multiple quote tokens:
```solidity
// Create multiple pairs
pairWPUSH = createPair(WPUSH, token);
pairWETH = createPair(wETH, token); // if wETH exists on Push Chain
pairWSOL = createPair(wSOL, token); // if wSOL exists on Push Chain
```

**Complexity**: Each pair has different pricing, need to manage multiple pairs

## Recommended Implementation

### Current Design is Good! ✅

**For now, keep single quote token (WPUSH/PUSH):**

1. ✅ **Simplicity**: One quote token, one pricing mechanism
2. ✅ **Compatibility**: Works with existing DEX infrastructure
3. ✅ **Standard Pattern**: Similar to how Uniswap works (WETH/Token pairs)
4. ✅ **Liquidity**: Consolidated liquidity in one pool

**User Experience:**
- Users bridge their assets to Push Chain first
- Convert to WPUSH (or use native PUSH)
- Launch/trade tokens using WPUSH
- Simple and straightforward

### Future Enhancement Path

If you want multi-asset support later:

1. **Add quote token selection** to curve creation
2. **Support multiple quote tokens** in bonding curves
3. **Create multiple DEX pairs** (one per quote token)
4. **Manage cross-pair arbitrage** (complex)

## Answer to Your Question

**Q: If someone from another chain launches a token, how will wrapping/unwrapping and DEX listing work?**

**A:**

1. **Wrapping/Bridging (User's Responsibility)**
   - User bridges assets from their chain → Push Chain
   - Converts to WPUSH (or uses native PUSH)
   - This happens BEFORE interacting with your contracts

2. **Your Contracts (Simplified)**
   - Accept native PUSH (wraps to WPUSH internally)
   - All operations use WPUSH
   - All tokens priced in WPUSH

3. **DEX Listing**
   - Creates WPUSH/Token pair
   - Standard Uniswap pair
   - Users trade using WPUSH

4. **Cross-Chain Users**
   - Bridge assets first (outside your contracts)
   - Use your contracts with WPUSH
   - Simple and clean!

## Example Flow

```
Ethereum User Wants to Launch Token:
├─ Step 1: Bridge ETH → Push Chain (via bridge) → Gets WPUSH
├─ Step 2: Call Core.createCurve() from Ethereum address
│   ├─ Pays gas with ETH (Universal Fee Abstraction) ✅
│   └─ Pays deploy fee with WPUSH (on Push Chain) ✅
├─ Step 3: Users buy tokens with WPUSH (or native PUSH)
├─ Step 4: Bonding curve operates with WPUSH
└─ Step 5: DEX listing creates WPUSH/Token pair
```

## Summary

**Your current design is correct!** ✅

- Users bridge assets to Push Chain first (standard practice)
- Your contracts accept native PUSH (wraps to WPUSH internally)
- All operations use WPUSH (single quote token)
- DEX listing creates WPUSH/Token pair (standard)

**You don't need to handle cross-chain wrapping in your contracts** - that's handled by Push Chain's bridge infrastructure. Your contracts just need to work with assets that are already on Push Chain (PUSH, WPUSH, or other wrapped tokens).

The Universal Fee Abstraction is separate - it just lets users pay gas fees with ETH/SOL, but doesn't bring those assets into your contracts for trading.

