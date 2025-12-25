# Market Cap-Based Graduation Implementation

## Summary

The graduation mechanism has been updated from **token amount-based** to **market cap-based**, aligning with the approach used by platforms like `pump.fun` and `nad.fun`.

## Changes Made

### 1. Configuration Updates

**Before:**
- Used `targetToken` (token amount threshold)
- Set to 25M tokens (50% of virtual reserve)
- Graduation triggered when `realTokenReserves <= targetToken`

**After:**
- Uses `graduationMarketCap` (market cap threshold)
- Set to `0.01 ETH/PUSH` (5x initial market cap of ~0.002 ETH/PUSH)
- Graduation triggered when `currentMarketCap >= graduationMarketCap`

### 2. Contract Updates

#### IBondingCurveFactory Interface
- `Config.targetToken` → `Config.graduationMarketCap`
- `InitializeParams.targetToken` → `InitializeParams.graduationMarketCap`
- `SetInitialize` event updated to emit `graduationMarketCap` instead of `targetToken`

#### BondingCurve Contract
- Storage: `targetToken` → `graduationMarketCap`
- `initialize()` parameter: `_targetToken` → `_graduationMarketCap`
- `_checkTarget()` now calculates and checks market cap:
  ```solidity
  function _checkTarget() private {
      uint256 currentPrice = getCurrentPrice();
      uint256 totalSupply = IERC20(token).totalSupply();
      uint256 currentMarketCap = (totalSupply * currentPrice) / 1e18;
      
      if (currentMarketCap >= graduationMarketCap) {
          lock = true;
          emit Lock(token);
      }
  }
  ```
- Removed `OverflowTarget` error and related check from `buy()` function
- `getTargetToken()` → `getGraduationMarketCap()`

#### BondingCurveFactory Contract
- Updated to use `graduationMarketCap` in config initialization
- Updated curve creation to pass `graduationMarketCap` instead of `targetToken`

### 3. Deployment Script Updates

#### Deploy.s.sol & DeployPushChain.s.sol
- `TARGET_TOKEN` constant removed
- `GRADUATION_MARKET_CAP` constant added:
  ```solidity
  uint256 public constant GRADUATION_MARKET_CAP = 0.01 ether;
  ```
- Updated `InitializeParams` to use `graduationMarketCap`

## Market Cap Threshold

### Default Value
- **0.01 ETH/PUSH** (configured in deployment scripts)

### Rationale
- Initial market cap: ~0.002 ETH/PUSH (at launch)
- Graduation threshold: 0.01 ETH/PUSH (5x initial)
- Similar to `pump.fun`'s ~$69k graduation threshold
- Provides significant growth milestone before DEX migration

### Calculation
Market cap is calculated as:
```solidity
marketCap = (totalSupply * currentPrice) / 1e18
```

Where:
- `totalSupply` = 100M tokens (fixed)
- `currentPrice` = `virtualNative / virtualToken` (from bonding curve)

## Benefits

1. **Market-Driven**: Graduation based on actual market value, not just token volume
2. **Aligns with Industry**: Matches approach used by `pump.fun` and `nad.fun`
3. **Price Discovery**: Encourages organic price discovery through trading
4. **Fair Graduation**: Tokens graduate when they achieve meaningful market cap

## Migration Notes

For existing deployments:
- Old contracts using `targetToken` will need to be redeployed or upgraded
- No automatic migration path - new parameter structure requires reinitialization
- Existing tokens on old contracts will continue using token-amount-based graduation

## Testing Recommendations

1. Test graduation trigger at exact market cap threshold
2. Verify market cap calculation accuracy
3. Test edge cases (very low/high prices)
4. Verify `_checkTarget()` is called after each buy/sell
5. Test that locked curves cannot be traded
6. Verify listing function works correctly after lock

