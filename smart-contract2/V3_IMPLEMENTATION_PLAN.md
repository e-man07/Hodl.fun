# Uniswap V3 Implementation Plan

## Overview
This document outlines the plan to migrate from Uniswap V2 to Uniswap V3 for token listing/graduation, taking reference from nad.fun's implementation.

## Why V3?
1. **Capital Efficiency**: Up to 4000x more efficient than V2
2. **Scale**: Better suited for hundreds of thousands of tokens and millions in liquidity
3. **Industry Standard**: nad.fun and other major platforms use V3
4. **Better LP Economics**: Multiple fee tiers (0.05%, 0.30%, 1.00%)
5. **Improved Oracles**: Better TWAP for DeFi integrations

## Implementation Strategy

### Phase 1: Core V3 Interfaces
- Create Uniswap V3 Factory interface
- Create Uniswap V3 Pool interface
- Create NonfungiblePositionManager interface (optional, for NFT positions)
- Add TickMath library for price/tick calculations

### Phase 2: Price Range Strategy
**Option A: Full Range (Simple, like V2)**
- Provide liquidity across entire price range (0 to ∞)
- Simpler but less capital efficient
- Good for initial implementation

**Option B: Concentrated Range (Recommended)**
- Calculate price range around graduation price
- Default: ±100% from current price (±50% for tighter range)
- More capital efficient
- Better for scale

**Decision: Start with Option B (Concentrated Range)**
- Default range: ±100% from graduation price
- Configurable via factory
- Can be adjusted per token if needed

### Phase 3: Fee Tier Selection
- Default: 0.30% (medium volatility)
- Can be configured per token or globally
- Higher volatility tokens → 1.00%
- Stable pairs → 0.05%

### Phase 4: Contract Updates

#### BondingCurve.sol Changes:
1. Replace V2 interfaces with V3 interfaces
2. Update `listing()` function:
   - Use V3 Factory to get/create pool
   - Calculate price range (ticks)
   - Calculate liquidity amount
   - Mint liquidity position
   - Handle NFT position (if using NonfungiblePositionManager)
3. Update storage: `pair` → `pool`
4. Update events

#### BondingCurveFactory.sol Changes:
1. Add V3 fee tier configuration
2. Update DEX factory to V3 Factory
3. Add price range configuration options

### Phase 5: Key Differences from V2

**V2 Approach:**
```solidity
pair = factory.createPair(token0, token1);
transfer tokens to pair;
liquidity = pair.mint(address(this));
burn LP tokens;
```

**V3 Approach:**
```solidity
pool = factory.getPool(token0, token1, fee);
if (pool == address(0)) {
    pool = factory.createPool(token0, token1, fee);
    pool.initialize(sqrtPriceX96);
}
calculate ticks (price range);
calculate liquidity amount;
pool.mint(address(this), tickLower, tickUpper, liquidity, data);
// No LP tokens to burn - liquidity tracked by pool
```

## Implementation Details

### Price Range Calculation
```solidity
// Get current price from bonding curve
uint256 currentPrice = getCurrentPrice();

// Convert to sqrtPriceX96 (V3 format)
uint160 sqrtPriceX96 = getSqrtPriceX96(currentPrice);

// Calculate ticks
int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
int24 tickSpacing = 60; // For 0.30% fee tier

// Set range (±100% = ±10 ticks for 0.30% tier)
int24 tickLower = (tick / tickSpacing) * tickSpacing - (tickSpacing * 10);
int24 tickUpper = (tick / tickSpacing) * tickSpacing + (tickSpacing * 10);
```

### Liquidity Calculation
```solidity
// Calculate liquidity for amounts
uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
    sqrtPriceX96,
    TickMath.getSqrtRatioAtTick(tickLower),
    TickMath.getSqrtRatioAtTick(tickUpper),
    amount0, // native
    amount1  // token
);
```

### Gas Cost Considerations
- V3 listing: ~150k-200k gas (vs ~100k for V2)
- Users pay gas, not platform
- Capital efficiency gains offset higher gas costs

## Testing Strategy

1. **Unit Tests**:
   - Price range calculations
   - Liquidity calculations
   - Tick math
   - Edge cases (full range, narrow range)

2. **Integration Tests**:
   - Full listing flow
   - Pool creation
   - Liquidity provision
   - Trading after listing

3. **Gas Tests**:
   - Compare V2 vs V3 gas costs
   - Optimize if needed

## Migration Path

### Option 1: Direct Migration (Recommended)
- Update contracts to V3
- Deploy new version
- Old tokens stay on V2, new tokens use V3

### Option 2: Gradual Migration
- Support both V2 and V3
- Migrate existing tokens over time
- More complex but allows gradual transition

**Decision: Option 1 (Direct Migration)**
- Cleaner implementation
- All new tokens use V3
- Old tokens can be migrated separately if needed

## Reference: nad.fun Implementation

Based on research:
- nad.fun uses Uniswap V3
- They automate V3 pool setup
- Instant liquidity through bonding curves
- Auto-graduation to DEX

## Next Steps

1. ✅ Create implementation plan
2. ⏳ Create V3 interfaces
3. ⏳ Add TickMath library
4. ⏳ Update BondingCurve contract
5. ⏳ Update BondingCurveFactory
6. ⏳ Update tests
7. ⏳ Deploy and test on testnet
8. ⏳ Security audit
9. ⏳ Mainnet deployment

## Risk Mitigation

1. **Complexity**: Start with full-range liquidity, then optimize
2. **Gas Costs**: Monitor and optimize
3. **Price Range**: Use wide ranges initially (±100%)
4. **Testing**: Comprehensive test coverage
5. **Audit**: Security audit before mainnet

