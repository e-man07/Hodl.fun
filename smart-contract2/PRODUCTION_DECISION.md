# Production Decision: Graduation Threshold

## Decision: Native Currency Threshold ✅

We have decided to use **native currency threshold** (PUSH on Push Chain, ETH on Ethereum) for token graduation, rather than USD-based threshold with oracles.

## Current Implementation

### Threshold Value
- **0.01 native currency units** (0.01 PUSH on Push Chain)
- Configured in deployment scripts as `GRADUATION_MARKET_CAP`
- Can be adjusted before deployment based on desired market cap

### How It Works

1. **Market Cap Calculation** (in native currency):
   ```solidity
   marketCap = (totalSupply × currentPrice) / 1e18
   ```

2. **Graduation Trigger**:
   ```solidity
   if (currentMarketCap >= graduationMarketCap) {
       lock = true;
       emit Lock(token);
   }
   ```

3. **After Lock**:
   - Curve locks (no more trades)
   - `listing()` can be called to migrate to DEX

## Rationale

### ✅ Advantages

1. **No External Dependencies**
   - No oracle required
   - No single point of failure
   - Works independently

2. **Lower Gas Costs**
   - No oracle calls needed
   - Simpler code execution
   - Better user experience

3. **Higher Reliability**
   - No oracle downtime risk
   - Deterministic behavior
   - Predictable outcomes

4. **Simpler Architecture**
   - Easier to audit
   - Lower maintenance burden
   - Fewer components to manage

5. **Industry Standard**
   - Similar to pump.fun (420 SOL threshold)
   - Common practice in DeFi
   - Proven approach

### 📊 Adjusting Threshold

To target a specific USD value:

```solidity
// Example: Target $69,000 graduation
// If 1 PUSH = $0.10:
GRADUATION_MARKET_CAP = 690000 ether; // $69k / $0.10

// If 1 PUSH = $1.00:
GRADUATION_MARKET_CAP = 69000 ether; // $69k / $1.00

// Current default (conservative):
GRADUATION_MARKET_CAP = 0.01 ether; // 0.01 PUSH
```

## Configuration

### Deployment Scripts
- `script/Deploy.s.sol` - General deployment
- `script/DeployPushChain.s.sol` - Push Chain specific

### Current Default
```solidity
uint256 public constant GRADUATION_MARKET_CAP = 0.01 ether;
```

## Future Considerations

1. **Governance**: Could add governance to update threshold via upgrades
2. **Dynamic Adjustment**: Could implement tiered thresholds based on market conditions
3. **Multi-Chain**: Different thresholds per chain deployment

## Status

✅ **Implementation Complete** - Native currency threshold is fully implemented and ready for production.

