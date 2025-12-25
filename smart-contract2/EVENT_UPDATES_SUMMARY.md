# Event Updates for Candle Chart Data

## Summary

Successfully updated all trade events to include **price** and **timestamp** for easy candle chart data extraction.

## Changes Made

### 1. Interface Updates

#### ICore.sol
- ✅ Added `price` (uint256) to `Buy` event
- ✅ Added `timestamp` (uint256) to `Buy` event
- ✅ Added `price` (uint256) to `Sell` event
- ✅ Added `timestamp` (uint256) to `Sell` event

#### IBondingCurve.sol
- ✅ Added `price` (uint256) to `Buy` event
- ✅ Added `timestamp` (uint256) to `Buy` event
- ✅ Added `price` (uint256) to `Sell` event
- ✅ Added `timestamp` (uint256) to `Sell` event
- ✅ Added `price` (uint256) to `Sync` event
- ✅ Added `timestamp` (uint256) to `Sync` event

### 2. Contract Implementation Updates

#### Core.sol
- ✅ `exactInBuy()`: Calculates and emits price + timestamp
  - Price formula: `price = (amountIn * 1e18) / amountOut`
- ✅ `exactOutBuy()`: Calculates and emits price + timestamp
  - Price formula: `price = (amountIn * 1e18) / amountOut`
- ✅ `exactInSell()`: Calculates and emits price + timestamp
  - Price formula: `price = (amountOut * 1e18) / amountIn`
- ✅ `exactOutSell()`: Calculates and emits price + timestamp
  - Price formula: `price = (amountOut * 1e18) / amountIn`

#### BondingCurve.sol
- ✅ `buy()`: Calculates and emits price + timestamp
  - Price formula: `price = (virtualNative * 1e18) / virtualToken` (from updated virtual reserves)
- ✅ `sell()`: Calculates and emits price + timestamp
  - Price formula: `price = (virtualNative * 1e18) / virtualToken` (from updated virtual reserves)
- ✅ `_update()`: Calculates and emits price + timestamp in Sync event
  - Price formula: `price = (virtualNative * 1e18) / virtualToken` (from updated virtual reserves)

## Event Signatures

### Core.Buy Event
```solidity
event Buy(
    address indexed token,
    address indexed to,
    uint256 amountIn,
    uint256 amountOut,
    uint256 price,        // NEW: Price per token (scaled by 1e18)
    uint256 timestamp     // NEW: Block timestamp
);
```

### Core.Sell Event
```solidity
event Sell(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountIn,
    uint256 amountOut,
    uint256 price,        // NEW: Price per token (scaled by 1e18)
    uint256 timestamp     // NEW: Block timestamp
);
```

### BondingCurve.Buy Event
```solidity
event Buy(
    address indexed to,
    address indexed token,
    uint256 amountNativeIn,
    uint256 amountOut,
    uint256 price,        // NEW: Price per token (scaled by 1e18)
    uint256 timestamp     // NEW: Block timestamp
);
```

### BondingCurve.Sell Event
```solidity
event Sell(
    address indexed to,
    address indexed token,
    uint256 amountTokenIn,
    uint256 amountOut,
    uint256 price,        // NEW: Price per token (scaled by 1e18)
    uint256 timestamp     // NEW: Block timestamp
);
```

### BondingCurve.Sync Event
```solidity
event Sync(
    address indexed token,
    uint256 realNative,
    uint256 realToken,
    uint256 virtualNative,
    uint256 virtualToken,
    uint256 price,        // NEW: Price per token (scaled by 1e18)
    uint256 timestamp     // NEW: Block timestamp
);
```

## Price Calculation

### Price Formula
All prices are calculated as: `price = (quote * 1e18) / base`

Where:
- For **Buy**: `price = (amountIn * 1e18) / amountOut` (WPUSH per token)
- For **Sell**: `price = (amountOut * 1e18) / amountIn` (WPUSH per token)
- For **Sync**: `price = (virtualNative * 1e18) / virtualToken` (WPUSH per token)

### Price Accuracy
- **BondingCurve events**: Use virtual reserves (most accurate, reflects AMM pricing)
- **Core events**: Use trade amounts (accurate for that specific trade)
- **Sync event**: Uses virtual reserves (best for OHLC calculations)

## Data Extraction for Candle Charts

### Using Sync Events (Recommended for OHLC)

```typescript
// Index Sync events for accurate OHLC
const syncEvents = await bondingCurve.queryFilter(
  bondingCurve.filters.Sync(tokenAddress),
  fromBlock,
  toBlock
);

const candles = new Map();

syncEvents.forEach(event => {
  const { price, timestamp } = event.args;
  const candleKey = getCandleKey(timestamp, timeframe);
  
  if (!candles.has(candleKey)) {
    candles.set(candleKey, {
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      timestamp: getCandleStart(timestamp, timeframe)
    });
  }
  
  const candle = candles.get(candleKey);
  candle.high = Math.max(candle.high, price);
  candle.low = Math.min(candle.low, price);
  candle.close = price; // Last sync in period is close
});
```

### Using Buy/Sell Events (For Volume)

```typescript
// Index Buy/Sell events for volume
const buyEvents = await core.queryFilter(
  core.filters.Buy(tokenAddress, null),
  fromBlock,
  toBlock
);

buyEvents.forEach(event => {
  const { amountIn, price, timestamp } = event.args;
  const candleKey = getCandleKey(timestamp, timeframe);
  const candle = candles.get(candleKey);
  if (candle) {
    candle.volume += Number(amountIn); // WPUSH volume
  }
});
```

## Benefits

1. ✅ **Explicit Price**: No need to calculate from amounts
2. ✅ **Explicit Timestamp**: No need to fetch from block
3. ✅ **Accurate Pricing**: Uses virtual reserves for BondingCurve events
4. ✅ **Easy Indexing**: All data in events, simpler backend code
5. ✅ **OHLC Ready**: Sync events provide perfect data for candles
6. ✅ **Volume Tracking**: Buy/Sell events provide volume data

## Migration Notes

- **Breaking Change**: Event signatures have changed
- **Indexers**: Must update to handle new event parameters
- **Frontend**: Can directly read price/timestamp from events
- **Backward Compatible**: Old events still exist, just with additional fields

---

**Status**: ✅ **Complete** - All events updated with price and timestamp

