# Manual Testing Guide - Creator Fee Distribution

This guide provides step-by-step instructions to manually test the creator fee distribution implementation.

---

## Prerequisites

- Foundry/Forge installed
- Access to testnet RPC (Push Chain or other)
- Test ETH/PUSH for transactions
- Creator account ready

---

## Test Scenario 1: Basic Creator Fee Distribution

### Objective
Verify that creators receive fees from token sales.

### Steps

#### 1. Create a Test Token

```bash
# 1a. Wrap native tokens for deploy fee
cast send <wNative> "deposit()" --value 0.1ether --private-key <key> --rpc-url <rpc>

# 1b. Approve Core to use wrapped tokens
cast send <wNative> "approve(address,uint256)" <core> 100000000000000000000 \
  --private-key <key> --rpc-url <rpc>

# 1c. Create token via Core
cast call <core> "createCurve(address,string,string,string,uint256,uint256)" \
  <creatorAddress> "My Token" "MTK" "ipfs://test" 0 100000000000000000 \
  --private-key <key> --rpc-url <rpc>

# Expected: Returns curve address and token address
```

#### 2. Buy Tokens (As User)

```bash
# 2a. Wrap native tokens
cast send <wNative> "deposit()" --value 1ether --private-key <userKey> --rpc-url <rpc>

# 2b. Approve Core to spend wrapped tokens
cast send <wNative> "approve(address,uint256)" <core> 1000000000000000000000 \
  --private-key <userKey> --rpc-url <rpc>

# 2c. Buy tokens
cast send <core> "exactInBuy(uint256,uint256,address,address,uint256)" \
  1000000000000000000 0 <tokenAddress> <userAddress> $(date +%s --date="+1hour") \
  --private-key <userKey> --rpc-url <rpc>

# Expected: User receives tokens (minus buy fee)
```

#### 3. Sell Tokens (As User)

```bash
# 3a. Check token balance
cast call <tokenAddress> "balanceOf(address)" <userAddress> --rpc-url <rpc>

# 3b. Approve Core to spend tokens
cast send <tokenAddress> "approve(address,uint256)" <core> \
  1000000000000000000000 --private-key <userKey> --rpc-url <rpc>

# 3c. Sell tokens (this triggers creator fee distribution!)
cast send <core> "exactInSell(uint256,uint256,address,address,address,uint256)" \
  500000000000000000000 0 <tokenAddress> <userAddress> <userAddress> $(date +%s --date="+1hour") \
  --private-key <userKey> --rpc-url <rpc>

# Expected: User receives wrapped native tokens back
```

#### 4. Verify Creator Received Fees

```bash
# 4a. Check creator's accumulated fees
cast call <factory> "creatorFees(address)" <creatorAddress> --rpc-url <rpc>

# Expected: Non-zero amount (this is the creator fee!)
# Example: 5000000000000000 (small amount in wei)
```

#### 5. Creator Claims Fees

```bash
# 5a. Claim accumulated creator fees
cast send <factory> "claimCreatorFees()" --private-key <creatorKey> --rpc-url <rpc>

# 5b. Verify creator received tokens
cast call <wNative> "balanceOf(address)" <creatorAddress> --rpc-url <rpc>

# Expected: Creator's balance increased
```

---

## Test Scenario 2: Multiple Trading Rounds

### Objective
Verify creator fees accumulate across multiple trading rounds.

### Steps

#### 1. Setup (Create token and buy as multiple users)

```bash
# User 1 buys
cast send <core> "exactInBuy(...)" 0.5ether 0 <token> <user1> <deadline> \
  --private-key <user1Key> --rpc-url <rpc>

# User 2 buys
cast send <core> "exactInBuy(...)" 0.3ether 0 <token> <user2> <deadline> \
  --private-key <user2Key> --rpc-url <rpc>

# User 3 buys
cast send <core> "exactInBuy(...)" 0.2ether 0 <token> <user3> <deadline> \
  --private-key <user3Key> --rpc-url <rpc>
```

#### 2. Selling Triggers Creator Fees

```bash
# Each user sells their tokens
for user in <user1> <user2> <user3>; do
  tokens=$(cast call <token> "balanceOf(address)" $user --rpc-url <rpc>)
  cast send <core> "exactInSell($tokens, 0, <token>, $user, $user, <deadline>)" \
    --private-key <userKey> --rpc-url <rpc>
done

# Expected: Creator fees accumulate with each sell
```

#### 3. Check Accumulated Fees

```bash
# After all sells, check accumulated fees
cast call <factory> "creatorFees(address)" <creatorAddress> --rpc-url <rpc>

# Expected: Should be sum of all individual sell fees
# Formula: totalCreatorFee = sum(sellFee * creatorFeeShare / 10000)
```

---

## Test Scenario 3: Fee Distribution Verification

### Objective
Verify that fees are properly split between creator and platform.

### Steps

#### 1. Get Initial State

```bash
# Get vault balance before sell
vaultBalanceBefore=$(cast call <wNative> "balanceOf(address)" <vault> --rpc-url <rpc>)

# Get creator fee accumulation before sell
creatorFeesBefore=$(cast call <factory> "creatorFees(address)" <creator> --rpc-url <rpc>)
```

#### 2. Execute Sell

```bash
# Get amount to sell
tokensToSell=$(cast call <token> "balanceOf(address)" <user> --rpc-url <rpc>)

# Sell (generates fees)
cast send <core> "exactInSell($tokensToSell, 0, <token>, <user>, <user>, <deadline>)" \
  --private-key <userKey> --rpc-url <rpc>
```

#### 3. Verify Fee Split

```bash
# Get final state
vaultBalanceAfter=$(cast call <wNative> "balanceOf(address)" <vault> --rpc-url <rpc>)
creatorFeesAfter=$(cast call <factory> "creatorFees(address)" <creator> --rpc-url <rpc>)

# Calculate
vaultFeeReceived=$((vaultBalanceAfter - vaultBalanceBefore))
creatorFeeReceived=$((creatorFeesAfter - creatorFeesBefore))
totalFee=$((vaultFeeReceived + creatorFeeReceived))

echo "Creator Fee: $creatorFeeReceived"
echo "Platform Fee: $vaultFeeReceived"
echo "Total Fee: $totalFee"

# Expected ratio (with default 10% creator share):
# creatorFee ≈ totalFee * 0.1
# platformFee ≈ totalFee * 0.9
```

---

## Test Scenario 4: Event Verification

### Objective
Verify that events are properly emitted for fee tracking.

### Steps

#### 1. Monitor Events During Sell

```bash
# Start listening for events
cast run --decode-revert

# Execute sell
cast send <core> "exactInSell(...)" \
  --private-key <userKey> --rpc-url <rpc>
```

#### 2. Look for These Events

```
Event: CreatorFeeDistributed
  creator: <creatorAddress>
  token: <tokenAddress>
  amount: <feeAmount>

Event: Sell
  to: <userAddress>
  token: <tokenAddress>
  amountTokenIn: <sellAmount>
  amountOut: <nativeReceived>
  price: <currentPrice>
  timestamp: <blockTimestamp>

Event: CreatorFeesAccumulated (from Factory)
  creator: <creatorAddress>
  amount: <feeAmount>
  totalAccumulated: <creatorFeesAfter>
```

---

## Test Scenario 5: Configuration Testing

### Objective
Verify creator fee share can be configured.

### Steps

#### 1. Check Default Share

```bash
cast call <factory> "getCreatorFeeShare()" --rpc-url <rpc>
# Expected: 1000 (10% in basis points)
```

#### 2. Update Creator Fee Share

```bash
# Change to 5% (500 basis points)
cast send <factory> "setCreatorFeeShare(uint16)" 500 \
  --private-key <adminKey> --rpc-url <rpc>

# Verify change
cast call <factory> "getCreatorFeeShare()" --rpc-url <rpc>
# Expected: 500
```

#### 3. Test with New Share

```bash
# Create new token
cast send <core> "createCurve(...)" --private-key <creatorKey> --rpc-url <rpc>

# Buy and sell
cast send <core> "exactInBuy(...)" --private-key <userKey> --rpc-url <rpc>
cast send <core> "exactInSell(...)" --private-key <userKey> --rpc-url <rpc>

# Verify fees follow new ratio (5% to creator)
cast call <factory> "creatorFees(address)" <creatorAddress> --rpc-url <rpc>
```

---

## Test Scenario 6: Creator Fee Claim

### Objective
Verify creators can claim their accumulated fees.

### Steps

#### 1. Accumulate Fees

```bash
# From previous scenarios, creator has accumulated fees
cast call <factory> "creatorFees(address)" <creatorAddress> --rpc-url <rpc>
# Expected: Non-zero amount
```

#### 2. Get Balance Before Claim

```bash
nativeBefore=$(cast call <wNative> "balanceOf(address)" <creatorAddress> --rpc-url <rpc>)
echo "Native balance before: $nativeBefore"
```

#### 3. Claim Fees

```bash
cast send <factory> "claimCreatorFees()" \
  --private-key <creatorKey> --rpc-url <rpc>

# Expected: Transaction succeeds, Creator receives tokens
```

#### 4. Verify Claim

```bash
# Check accumulated fees (should be 0 now)
cast call <factory> "creatorFees(address)" <creatorAddress> --rpc-url <rpc>
# Expected: 0

# Check native balance (should have increased)
nativeAfter=$(cast call <wNative> "balanceOf(address)" <creatorAddress> --rpc-url <rpc>)
echo "Native balance after: $nativeAfter"
# Expected: $nativeAfter > $nativeBefore
```

---

## Troubleshooting

### Issue: "Creator fee is 0"

**Possible Causes:**
1. Creator fee share is set to 0
   - Check: `factory.getCreatorFeeShare()`
   - Fix: `factory.setCreatorFeeShare(1000)`

2. No sells have occurred (buy fees stay in curve)
   - Solution: Perform a sell transaction

3. Creator address mismatch
   - Check: `factory.getCreator(tokenAddress)`
   - Verify it matches the actual creator

### Issue: "Fees went only to vault, not creator"

**Possible Causes:**
1. Creator fee share is 0
   - Check and fix as above

2. Sell transaction didn't happen (only buys)
   - Solution: Perform actual sell transactions

**Solution:** Check events to see if `CreatorFeeDistributed` was emitted

### Issue: "claimCreatorFees() reverts with 'NoFeesToClaim'"

**Possible Causes:**
1. No fees accumulated yet
   - Check: `factory.creatorFees(creatorAddress)`

2. Already claimed (balance reset to 0)
   - Solution: Perform more trades to accumulate new fees

3. Wrong address (not the token creator)
   - Check: `factory.getCreator(tokenAddress)`

---

## Expected Behavior Summary

| Action | Expected Result |
|--------|-----------------|
| Buy tokens | Fees stay in curve; price increases |
| Sell tokens | Fees split to creator + platform |
| Creator fee share 10% | Creator gets 10% of sell fees |
| Creator fee share 5% | Creator gets 5% of sell fees |
| Claim fees | Creator receives accumulated fees; balance resets |
| Check events | CreatorFeeDistributed event emitted on sell |
| Multiple sells | Fees accumulate; creator can claim sum |

---

## Quick Reference Commands

```bash
# Create token
cast send <core> "createCurve(address,string,string,string,uint256,uint256)" \
  <creator> "Name" "SYM" "uri" 0 <deployFee> \
  --private-key <key> --rpc-url <rpc>

# Buy tokens
cast send <core> "exactInBuy(uint256,uint256,address,address,uint256)" \
  <amountIn> 0 <token> <recipient> <deadline> \
  --private-key <key> --rpc-url <rpc>

# Sell tokens
cast send <core> "exactInSell(uint256,uint256,address,address,address,uint256)" \
  <amountIn> 0 <token> <from> <to> <deadline> \
  --private-key <key> --rpc-url <rpc>

# Check creator fees
cast call <factory> "creatorFees(address)" <creator> --rpc-url <rpc>

# Claim fees
cast send <factory> "claimCreatorFees()" --private-key <creatorKey> --rpc-url <rpc>

# Check fee share
cast call <factory> "getCreatorFeeShare()" --rpc-url <rpc>

# Set fee share
cast send <factory> "setCreatorFeeShare(uint16)" <newShare> \
  --private-key <adminKey> --rpc-url <rpc>
```

---

## Success Criteria

✅ Creator receives fees from token sales
✅ Fees are properly split (configurable percentage)
✅ Creator can claim accumulated fees
✅ Events are emitted for tracking
✅ No breaking changes to existing functionality
✅ All transactions execute successfully

---

**Testing Status:** Ready for manual validation
**Next:** External audit and comprehensive test suite
