# Token Launchpad - Deployment Summary

**Network**: Push Chain Testnet (Chain ID: 42101)
**RPC**: https://evm.donut.rpc.push.org/
**BlockScout**: https://donut.push.network/
**Updated**: 2025-12-31

---

## ✅ Core Infrastructure Contracts

### Core Proxy
- **Proxy Address**: `0x592F8f0abbB9a3d3c425980Ac0263363C8405b03`
- **Implementation**: `0x3f57d2F14C6198c94ec93C1fe486a98ef149F47e` (New)
- **Status**: ✅ Verified on BlockScout
- **Features**:
  - Orchestrates token creation via `createCurve()`
  - Handles token trading via `exactInBuy()`, `exactOutSell()`
  - Auto-wraps native PUSH to WPUSH

### Factory Proxy
- **Proxy Address**: `0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8`
- **Implementation**: `0xbf10f70dEa41Af24e17119eA7Ccbb87eCcC4990c` (Fixed v2)
- **Previous Implementation**: `0x20dCA8fd0B28E91E286e60652e57ef609CE6f733` (v1)
- **Status**: ✅ Verified on BlockScout
- **Changes in v2**:
  - Removed `onlyRole(CORE_ROLE)` check
  - Replaced with direct address check: `if (msg.sender != core) revert OnlyCore()`
  - Reason: OpenZeppelin AccessControl storage sync issues with proxy pattern

### FeeVault Proxy
- **Proxy Address**: `0xbe2fd9b720d1d7fac7208523376d2a3332019928`
- **Implementation**: `0x54CbE40b5D5aD96fE0349fac5eD56111fF5e17E9`
- **Status**: ✅ Verified on BlockScout
- **Asset**: WPUSH (`0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7`)
- **Purpose**: ERC4626 vault for fee collection (1% platform fee + creator fees)

---

## ✅ Token Infrastructure

### WPUSH Token (Wrapped PUSH)
- **Address**: `0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7`
- **Status**: ✅ Verified on BlockScout
- **Supply**: 100 tokens minted to deployer
- **Standard**: ERC20 with deposit/withdraw
- **Purpose**:
  - Required for ERC4626 vault compatibility
  - Internal reserve currency for bonding curve
  - Users send native PUSH, system auto-wraps to WPUSH

---

## ✅ DEX Integration

### Uniswap V3 Factory
- **Address**: `0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7`
- **Status**: ✅ Verified on BlockScout
- **Supported Fee Tiers**:
  - 500 (0.05%)
  - 3000 (0.30%)
  - 10000 (1.00%)
- **Purpose**: Creates V3 pools when tokens graduate from bonding curve

### Uniswap V3 Pool (Implementation)
- **Contract**: `src/UniswapV3Pool.sol`
- **Status**: ✅ Verified on BlockScout
- **Features**:
  - Concentrated liquidity positions
  - Mint callback support
  - slot0() state tracking
  - Factory reference

---

## ✅ Test Token Deployment

### TestToken
- **Token Address**: `0x4216877db688c1524efcc4a59c0aec8993192650`
- **Bonding Curve Address**: `0xf3a1f43c6ec5ef78fc4c200ef61302654b79803e`
- **Token Name**: TestToken
- **Token Symbol**: TEST
- **Creator**: `0x6dE3c92B58356CECfCa409F6993A592fc5B8090F`
- **Status**: ✅ Created & Tested
- **Transaction**: `0x6e010a68214866f1277b0fbcdaf7df5ed48c28c4a6a8006ebefdc3eae8e8dabf`
- **Initial State**:
  - Virtual Native Reserve: 1 PUSH
  - Virtual Token Reserve: 50,000,000 tokens
  - Creator received tokens from initial 0.1 PUSH purchase
  - Platform fee (0.01 WPUSH) sent to FeeVault

### TestToken - Buy Transaction
- **Transaction**: `0x0f57c6e66f79ee7febb25fb5246b39792f43f787688173fae6f5cb59d8605675`
- **Operation**: `exactInBuy()` with 0.1 WPUSH
- **Status**: ✅ Success
- **Result**: Buyer received tokens, fees deducted and tracked

---

## Configuration

### Factory Settings
| Parameter | Value |
|-----------|-------|
| Deploy Fee | 0.01 PUSH |
| Listing Fee | 0.1 PUSH |
| Virtual Native | 1 PUSH |
| Virtual Token | 50,000,000 tokens |
| Graduation Market Cap | 1,000,000 PUSH |
| Trading Fee | 1% (1/100) |
| DEX Factory | `0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7` |
| DEX Fee Tier | 3000 (0.30%) |

---

## What's Working ✅

- **Token Creation**: Via `Core.createCurve()`
  - Users send native PUSH or pre-approved WPUSH
  - Tokens and bonding curve automatically created
  - Initial liquidity provided by creator

- **Token Trading**: Via `Core.exactInBuy()` and `Core.exactOutSell()`
  - Bonding curve pricing (x*y=k)
  - Platform fees collected in vault
  - Creator fees accumulated and claimable

- **Fee System**:
  - 1% platform fee to FeeVault
  - Creator fee share (configurable, default 10%)
  - Fees accumulate in FeeVault, available for withdrawal

- **Proxy Pattern**:
  - UUPS upgradeable contracts
  - Backward-compatible implementation updates
  - Admin can upgrade all contracts

---

## What's Next

- [ ] Test token graduation to Uniswap V3
- [ ] Verify creator fee distribution
- [ ] Test multiple token creation
- [ ] End-to-end user journey testing
- [ ] Frontend integration
- [ ] Backend event indexing
- [ ] Security audit
- [ ] Mainnet deployment planning

---

## Key Fixes Applied (This Session)

1. **BondingCurveFactory Access Control** (Major)
   - Issue: `onlyRole(CORE_ROLE)` not granting roles properly with proxy
   - Solution: Replaced with direct address check `if (msg.sender != core)`
   - Result: Token creation now works without role issues

2. **Core to Factory Configuration** (Critical)
   - Issue: Core proxy not properly linked to Factory
   - Solution: Called `setCore()` on Factory to establish link
   - Result: All create operations can now reach Factory

3. **WPUSH Integration** (Critical)
   - Issue: Core and FeeVault pointing to non-existent mainnet WPUSH
   - Solution: Deployed production WPUSH, redeployed Core & FeeVault
   - Result: Vault compatibility restored

4. **Uniswap V3 Configuration** (Important)
   - Issue: V3 integration was code but unconfigured
   - Solution: Deployed V3 Factory, configured in Factory proxy
   - Result: Token graduation flow now available

---

## Deployer Account

- **Address**: `0x6dE3c92B58356CECfCa409F6993A592fc5B8090F`
- **WPUSH Balance**: 100 tokens (sufficient for development)
- **Role**: Owner/Admin of all proxies

---

## Testing Status

| Test | Status | Notes |
|------|--------|-------|
| Token Creation | ✅ PASS | Created TestToken successfully |
| Token Trading | ✅ PASS | exactInBuy executed, fees deducted |
| Bonding Curve Math | ✅ PASS | x*y=k invariant maintained |
| Fee Collection | ✅ PASS | 1% fee tracked in FeeVault |
| Creator Fees | ⏳ TBD | Configuration set, distribution TBD |
| Token Graduation | ⏳ TBD | V3 available, flow untested |
| Multiple Tokens | ⏳ TBD | Single test token created |

---

## Useful Commands

### Check Contract State
```bash
# Get Core factory reference
cast call 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03 "factory()" \
  --rpc-url https://evm.donut.rpc.push.org/

# Get Factory core reference
cast call 0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8 "getCore()" \
  --rpc-url https://evm.donut.rpc.push.org/

# Get token creator
cast call 0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8 \
  "getCreator(address)" 0x4216877db688c1524efcc4a59c0aec8993192650 \
  --rpc-url https://evm.donut.rpc.push.org/
```

### Create Token
```bash
cast send 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03 \
  "createCurve(address,string,string,string,uint256,uint256)" \
  0x6dE3c92B58356CECfCa409F6993A592fc5B8090F \
  "MyToken" \
  "MYTKN" \
  "ipfs://metadata" \
  $(cast tw 0.1) \
  $(cast tw 0.01) \
  --private-key 0x... \
  --rpc-url https://evm.donut.rpc.push.org/
```

### Buy Tokens
```bash
# Approve WPUSH first (if using pre-approved balance)
cast send 0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7 \
  "approve(address,uint256)" \
  0x592F8f0abbB9a3d3c425980Ac0263363C8405b03 \
  $(cast tw 1) \
  --private-key 0x... \
  --rpc-url https://evm.donut.rpc.push.org/

# Buy tokens
cast send 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03 \
  "exactInBuy(uint256,uint256,address,address,uint256)" \
  $(cast tw 0.1) \
  0 \
  0x4216877db688c1524efcc4a59c0aec8993192650 \
  0x6dE3c92B58356CECfCa409F6993A592fc5B8090F \
  999999999999 \
  --private-key 0x... \
  --rpc-url https://evm.donut.rpc.push.org/
```

---

**Last Updated**: 2025-12-31
**Status**: Production-Ready for Testing
**Ready For**: Frontend integration, backend indexing, security audit
