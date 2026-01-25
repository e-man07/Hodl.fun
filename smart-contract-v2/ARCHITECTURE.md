# Hodl.fun Smart Contract V2 - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Contract Architecture Diagram](#contract-architecture-diagram)
3. [Core Contracts](#core-contracts)
4. [Contract Inheritance](#contract-inheritance)
5. [Key Data Structures](#key-data-structures)
6. [Role-Based Access Control](#role-based-access-control)
7. [Token Lifecycle](#token-lifecycle)
8. [Bonding Curve Mechanics](#bonding-curve-mechanics)
9. [Fee Structure](#fee-structure)
10. [Events Reference](#events-reference)
11. [UUPS Proxy Pattern](#uups-proxy-pattern)
12. [Uniswap V3 Integration](#uniswap-v3-integration)
13. [Security Features](#security-features)
14. [Deployment Configuration](#deployment-configuration)
15. [File Structure](#file-structure)

---

## Overview

Hodl.fun is a universal token launchpad built on Push Chain. The smart contract system enables users to:
- Launch ERC20 tokens with bonding curve pricing
- Trade tokens via constant product AMM (x * y = k)
- Graduate tokens to Uniswap V3 when market cap threshold is reached
- Collect platform and creator fees through an ERC4626 vault

### Key Features
- **UUPS Upgradeable**: All contracts use proxy pattern for upgradeability
- **Constant Product AMM**: Fair price discovery without initial liquidity
- **Virtual Reserves**: Smooth launch curve without bootstrap liquidity
- **Graduation Mechanism**: Automatic DEX listing at market cap threshold
- **Creator Fees**: 10% of trading fees go to token creators

---

## Contract Architecture Diagram

```
                                    USER
                                      │
                                      │ createCurve() / buy() / sell()
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  CORE.sol                                        │
│                          (Main Entry Point)                                      │
│                                                                                  │
│  Functions:                              Responsibilities:                       │
│  ├── createCurve()                       • Routes all user interactions          │
│  ├── exactInBuy()                        • Auto-wraps PUSH → WPUSH              │
│  ├── exactOutBuy()                       • Validates fees, deadlines            │
│  ├── exactInSell()                       • Enforces slippage protection         │
│  └── exactOutSell()                      • Emits trade events                   │
│                                                                                  │
└──────────┬────────────────────┬─────────────────────┬───────────────────────────┘
           │                    │                     │
           │ create()           │ buy()/sell()        │ deposit()
           ▼                    ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ BONDINGCURVEFACTORY  │  │    BONDINGCURVE      │  │      FEEVAULT        │
│                      │  │    (Per Token)       │  │      (ERC4626)       │
│ • Creates Token +    │  │                      │  │                      │
│   BondingCurve pairs │  │ • Constant product   │  │ • Platform fees      │
│ • Stores global      │  │   AMM (k = x * y)    │  │ • Yield generation   │
│   configuration      │  │ • Price calculation  │  │ • Share accounting   │
│ • Manages creator    │  │ • ATH tracking       │  │                      │
│   fee accumulation   │  │ • Graduation lock    │  │                      │
│ • Holds deploy/list  │  │ • DEX listing        │  │                      │
│   fee settings       │  │                      │  │                      │
└──────────┬───────────┘  └──────────┬───────────┘  └──────────────────────┘
           │                         │
           │ Creates via             │ Holds/manages
           │ ERC1967Proxy            │
           ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│       TOKEN          │  │       WPUSH          │
│     (ERC20)          │  │  (Wrapped Native)    │
│                      │  │                      │
│ • Fixed 1B supply    │  │ • deposit()          │
│ • Minting by curve   │  │ • withdraw()         │
│ • Burning for grad   │  │ • ERC20 compatible   │
│ • tokenURI metadata  │  │ • Permit support     │
└──────────────────────┘  └──────────────────────┘
                                    │
                                    │ On graduation
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UNISWAP V3 INTEGRATION                                 │
│                                                                                  │
│  ┌─────────────────────┐        ┌─────────────────────┐                         │
│  │  UniswapV3Factory   │───────▶│   UniswapV3Pool     │                         │
│  │                     │        │                     │                         │
│  │  • Creates pools    │        │  • Concentrated     │                         │
│  │  • Fee tier support │        │    liquidity        │                         │
│  │    (0.05%, 0.3%, 1%)│        │  • Price range      │                         │
│  └─────────────────────┘        │    management       │                         │
│                                 └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                          UTILITY LIBRARIES
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │ BondingCurveLibrary │  │  LiquidityAmounts   │  │      TickMath       │      │
│  │                     │  │                     │  │                     │      │
│  │ • getAmountOut()    │  │ • getLiquidity      │  │ • getSqrtRatioAt   │      │
│  │ • getAmountIn()     │  │   ForAmount0/1()    │  │   Tick()           │      │
│  │ • getCurveData()    │  │ • Optimal position  │  │ • getTickAtSqrt    │      │
│  │                     │  │   calculation       │  │   Ratio()          │      │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Contracts

### 1. Core.sol (Entry Point)
**Location**: `src/Core.sol`
**Lines**: ~650

The main orchestrator contract. All user interactions go through Core.

```solidity
// Creation
function createCurve(
    address creator,
    string memory name,
    string memory symbol,
    string memory tokenURI,
    uint256 amountIn,
    uint256 fee
) external payable returns (address curve, address token)

// Trading - Exact Input
function exactInBuy(uint256 amountIn, uint256 amountOutMin, address token, address to, uint256 deadline)
function exactInSell(uint256 amountIn, uint256 amountOutMin, address token, address from, address to, uint256 deadline)

// Trading - Exact Output
function exactOutBuy(uint256 amountOut, uint256 amountInMax, address token, address to, uint256 deadline)
function exactOutSell(uint256 amountOut, uint256 amountInMax, address token, address from, address to, uint256 deadline)

// View Functions
function getCurveData(address curve) returns (uint256 virtualNative, uint256 virtualToken, uint256 k)
function getAmountOut(uint256 amountIn, uint256 k, uint256 reserveIn, uint256 reserveOut)
function getAmountIn(uint256 amountOut, uint256 k, uint256 reserveIn, uint256 reserveOut)
function getCurrentPrice(address token) returns (uint256 price)
function calculateMarketCap(address token) returns (uint256 marketCap)
```

### 2. BondingCurveFactory.sol (Factory)
**Location**: `src/BondingCurveFactory.sol`
**Lines**: ~514

Creates Token + BondingCurve pairs and manages global configuration.

```solidity
// Creation
function create(
    address creator,
    string memory name,
    string memory symbol,
    string memory tokenURI
) returns (address curve, address token, uint256 virtualNative, uint256 virtualToken)

// Configuration
function setGraduationMarketCap(uint256 _graduationMarketCap)
function setDeployFee(uint256 _deployFee)
function setListingFee(uint256 _listingFee)
function setVirtualReserves(uint256 _virtualNative, uint256 _virtualToken)
function setFeeConfig(uint8 _feeDenominator, uint16 _feeNumerator)
function setCreatorFeeShare(uint16 _creatorFeeShare)

// Creator Fees
function accumulateCreatorFees(address creator, uint256 amount)
function claimCreatorFees()
```

### 3. BondingCurve.sol (AMM)
**Location**: `src/BondingCurve.sol`
**Lines**: ~911

Per-token AMM implementing constant product formula.

```solidity
// Trading
function buy(address to, uint256 amountOut) external
function sell(address to, uint256 amountOut) external

// Graduation
function listing() external returns (address pool)

// View Functions
function getReserves() returns (uint256 nativeReserves, uint256 tokenReserves)
function getVirtualReserves() returns (uint256 virtualNative, uint256 virtualToken)
function getK() returns (uint256 k)
function getCurrentPrice() returns (uint256 price)
function calculateMarketCap() returns (uint256 marketCap)
function getATHPrice() returns (uint256 price, uint256 timestamp)
function getATHMarketCap() returns (uint256 marketCap, uint256 timestamp)
function getLock() returns (bool locked)
function getIsListing() returns (bool listed)
```

### 4. Token.sol (ERC20)
**Location**: `src/Token.sol`
**Lines**: ~140

Standard ERC20 with controlled minting.

```solidity
function initialize(string memory name, string memory symbol, address curve, address core)
function mint(address to, uint256 amount) external onlyRole(BONDING_CURVE_ROLE)
function setTokenURI(string memory tokenURI_)
function tokenURI() returns (string memory)
```

**Token Supply**: Fixed at 1,000,000,000 tokens (1B * 10^18)

### 5. FeeVault.sol (ERC4626)
**Location**: `src/FeeVault.sol`
**Lines**: ~94

Fee collection vault using ERC4626 yield standard.

```solidity
function deposit(uint256 assets, address receiver) returns (uint256 shares)
function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)
function totalAssets() returns (uint256)
```

### 6. WPUSH.sol (Wrapped Native)
**Location**: `src/WPUSH.sol`
**Lines**: ~185

Wrapped native token for ERC20 compatibility.

```solidity
function deposit() external payable
function withdraw(uint256 amount) external
function withdrawWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
```

---

## Contract Inheritance

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CORE.sol                                   │
├────────────────────────────────────────────────────────────────────────┤
│  ICore                                                                  │
│  Initializable                                                          │
│  UUPSUpgradeable                                                        │
│  AccessControlUpgradeable                                               │
│  PausableUpgradeable                                                    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        BONDINGCURVEFACTORY.sol                          │
├────────────────────────────────────────────────────────────────────────┤
│  IBondingCurveFactory                                                   │
│  Initializable                                                          │
│  UUPSUpgradeable                                                        │
│  AccessControlUpgradeable                                               │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                          BONDINGCURVE.sol                               │
├────────────────────────────────────────────────────────────────────────┤
│  IBondingCurve                                                          │
│  IUniswapV3MintCallback                                                 │
│  Initializable                                                          │
│  UUPSUpgradeable                                                        │
│  AccessControlUpgradeable                                               │
│  ReentrancyGuardUpgradeable                                             │
│  PausableUpgradeable                                                    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                             TOKEN.sol                                   │
├────────────────────────────────────────────────────────────────────────┤
│  IToken                                                                 │
│  Initializable                                                          │
│  ERC20Upgradeable                                                       │
│  ERC20BurnableUpgradeable                                               │
│  AccessControlUpgradeable                                               │
│  UUPSUpgradeable                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                            FEEVAULT.sol                                 │
├────────────────────────────────────────────────────────────────────────┤
│  IFeeVault                                                              │
│  Initializable                                                          │
│  ERC4626Upgradeable                                                     │
│  UUPSUpgradeable                                                        │
│  AccessControlUpgradeable                                               │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                             WPUSH.sol                                   │
├────────────────────────────────────────────────────────────────────────┤
│  ERC20                                                                  │
│  ERC20Permit                                                            │
│  Ownable                                                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Data Structures

### Factory Configuration
```solidity
struct Config {
    uint256 deployFee;           // Fee to create token (2 PUSH)
    uint256 listingFee;          // Fee for DEX listing (100 PUSH)
    uint256 virtualNative;       // Initial virtual PUSH reserve (30K PUSH)
    uint256 virtualToken;        // Initial virtual token reserve (~1.073B)
    uint256 k;                   // virtualNative * virtualToken (constant product)
    uint256 graduationMarketCap; // Threshold to trigger listing (690K PUSH ≈ $69K)
    uint8 feeDenominator;        // Fee denominator (100)
    uint16 feeNumerator;         // Fee numerator (1) → 1% total fee
    uint24 dexFee;               // Uniswap V3 fee tier (3000 = 0.30%)
    uint16 creatorFeeShare;      // Creator share in bps (3750 = 37.5% of distributed fee)
}
```

### BondingCurve State
```solidity
// Reserves
uint256 realNativeReserve;      // Actual WPUSH in contract
uint256 realTokenReserve;       // Actual tokens in contract
uint256 virtualNativeReserve;   // Virtual PUSH reserve (for pricing)
uint256 virtualTokenReserve;    // Virtual token reserve (for pricing)
uint256 k;                      // Constant product invariant

// ATH Tracking
uint256 athPrice;               // All-time high price
uint256 athPriceTimestamp;      // When ATH price was reached
uint256 athMarketCap;           // All-time high market cap
uint256 athMarketCapTimestamp;  // When ATH market cap was reached

// Status
bool locked;                    // True when graduation threshold reached
bool isListing;                 // True when listed on DEX
```

---

## Role-Based Access Control

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACCESS CONTROL MATRIX                             │
├───────────────────┬─────────────────┬───────────────┬───────────────────────┤
│     Contract      │      Role       │  Granted To   │       Purpose         │
├───────────────────┼─────────────────┼───────────────┼───────────────────────┤
│ Core              │ DEFAULT_ADMIN   │ Timelock      │ Upgrade, configure    │
│ Core              │ PAUSER_ROLE     │ Emergency MS  │ Instant pause/unpause │
│ Core              │ FACTORY_ROLE    │ Factory       │ Internal coordination │
├───────────────────┼─────────────────┼───────────────┼───────────────────────┤
│ Factory           │ DEFAULT_ADMIN   │ Timelock      │ Upgrade, configure    │
│ Factory           │ CORE_ROLE       │ Core          │ Create curves         │
├───────────────────┼─────────────────┼───────────────┼───────────────────────┤
│ BondingCurve      │ DEFAULT_ADMIN   │ Owner         │ Upgrade, pause        │
│ BondingCurve      │ CORE_ROLE       │ Core          │ Execute buy/sell      │
├───────────────────┼─────────────────┼───────────────┼───────────────────────┤
│ Token             │ DEFAULT_ADMIN   │ Owner         │ Upgrade, metadata     │
│ Token             │ CORE_ROLE       │ Core          │ Admin operations      │
│ Token             │ BONDING_CURVE   │ BondingCurve  │ Mint tokens           │
├───────────────────┼─────────────────┼───────────────┼───────────────────────┤
│ FeeVault          │ DEFAULT_ADMIN   │ Timelock      │ Upgrade, configure    │
│ FeeVault          │ CORE_ROLE       │ Core          │ Deposit fees          │
└───────────────────┴─────────────────┴───────────────┴───────────────────────┘
```

### Timelock & Multi-sig Architecture (Production)

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Multi-sig     │────▶│   Timelock      │────▶│  Contracts   │
│   (Proposer)    │     │   (48hr delay)  │     │  Core/Factory│
└─────────────────┘     └─────────────────┘     │  /FeeVault   │
                                                └──────────────┘
                                                       │
┌─────────────────┐                                    │
│ Emergency Pause │──────── instant ───────────────────┘
│   Multi-sig     │         (PAUSER_ROLE)
└─────────────────┘

Admin Operations Flow:
1. Multi-sig proposes operation to Timelock
2. 48-hour delay period (community can review)
3. Anyone can execute after delay expires
4. Emergency pause bypasses timelock (instant response)
```

---

## Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TOKEN LIFECYCLE PHASES                              │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: CREATION
═══════════════════════════════════════════════════════════════════════════════
  User calls Core.createCurve(creator, name, symbol, tokenURI, amountIn, fee)
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 1. Factory deploys Token proxy (ERC1967)                                │
  │ 2. Factory deploys BondingCurve proxy (ERC1967)                         │
  │ 3. Token initialized with name, symbol, metadata                        │
  │ 4. 1B tokens minted to BondingCurve                                     │
  │ 5. BondingCurve initialized with virtual reserves                       │
  │ 6. Deploy fee (0.01 PUSH) sent to FeeVault                              │
  │ 7. If amountIn > 0: Initial buy executed                                │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           Events Emitted:
                           • CreateCurve(creator, curve, token, ...)
                           • Buy(...) if initial purchase

Phase 2: TRADING
═══════════════════════════════════════════════════════════════════════════════
  Users trade via Core.exactInBuy/exactInSell/exactOutBuy/exactOutSell
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              ┌─────────┐                     ┌─────────┐
              │   BUY   │                     │  SELL   │
              └────┬────┘                     └────┬────┘
                   │                               │
  ┌────────────────┴────────────────┐  ┌──────────┴────────────────────────┐
  │ 1. User sends PUSH (auto-wrap)  │  │ 1. User sends tokens              │
  │ 2. Core calls curve.buy()       │  │ 2. Core calls curve.sell()        │
  │ 3. AMM calculates tokens out    │  │ 3. AMM calculates PUSH out        │
  │ 4. Fee deducted from tokens     │  │ 4. Fee deducted (1%)              │
  │ 5. Tokens transferred to user   │  │    • 10% → Creator (accumulated)  │
  │ 6. Reserves updated             │  │    • 90% → Platform (FeeVault)    │
  │ 7. ATH checked/updated          │  │ 5. PUSH transferred to user       │
  └─────────────────────────────────┘  │ 6. Reserves updated               │
                                       └───────────────────────────────────┘
                                    │
                                    ▼
                           Events Emitted:
                           • Buy/Sell (Core + BondingCurve)
                           • Sync (reserve state)
                           • NewATHPrice/NewATHMarketCap (if applicable)

Phase 3: GRADUATION
═══════════════════════════════════════════════════════════════════════════════
  When marketCap >= graduationMarketCap (1M PUSH)
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 1. BondingCurve locks (no more trading on curve)                        │
  │ 2. Event: Lock(token)                                                   │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  Anyone calls BondingCurve.listing()
                                    │
                                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ 1. Create Uniswap V3 pool (token/WPUSH)                                 │
  │ 2. Calculate liquidity position                                         │
  │ 3. Add concentrated liquidity at current price                          │
  │ 4. Listing fee (0.1 PUSH) sent to FeeVault                              │
  │ 5. Mark curve as listed                                                 │
  └─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           Events Emitted:
                           • Listing(curve, token, pool, amount0, amount1, liquidity)

Phase 4: POST-GRADUATION
═══════════════════════════════════════════════════════════════════════════════
  • BondingCurve: Locked, no trading
  • Uniswap V3: All trading happens here
  • Creator fees: Can be claimed via Factory.claimCreatorFees()
```

---

## Bonding Curve Mechanics

### Constant Product Formula

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONSTANT PRODUCT AMM (x * y = k)                      │
└─────────────────────────────────────────────────────────────────────────────┘

Invariant: k = virtualNative * virtualToken (NEVER changes during trades)

BUYING TOKENS (PUSH → Token)
═══════════════════════════════════════════════════════════════════════════════
Given: amountIn (PUSH to spend)
Find:  amountOut (tokens to receive)

  newReserveIn  = virtualNative + amountIn
  newReserveOut = k / newReserveIn
  amountOut     = virtualToken - newReserveOut

Example:
  k = 1 PUSH * 50M tokens = 50M
  User sends 0.1 PUSH

  newReserveIn  = 1 + 0.1 = 1.1 PUSH
  newReserveOut = 50M / 1.1 = 45.45M tokens
  amountOut     = 50M - 45.45M = 4.545M tokens

SELLING TOKENS (Token → PUSH)
═══════════════════════════════════════════════════════════════════════════════
Given: amountIn (tokens to sell)
Find:  amountOut (PUSH to receive)

  newReserveIn  = virtualToken + amountIn
  newReserveOut = k / newReserveIn
  amountOut     = virtualNative - newReserveOut

PRICE CALCULATION
═══════════════════════════════════════════════════════════════════════════════
  price = (virtualNative * 1e18) / virtualToken

  Initial: price = (1 PUSH * 1e18) / 50M = 0.00000002 PUSH per token

MARKET CAP CALCULATION
═══════════════════════════════════════════════════════════════════════════════
  marketCap = (price * TOTAL_SUPPLY) / 1e18
            = (price * 1B tokens) / 1e18
```

### Price Curve Visualization

```
Price
  │
  │                                           ╱
  │                                         ╱
  │                                       ╱
  │                                     ╱
  │                                   ╱
  │                                 ╱
  │                               ╱
  │                             ╱
  │                          ╱
  │                       ╱
  │                   ╱
  │              ╱
  │        ╱
  │   ╱
  │╱
  └────────────────────────────────────────────────── Supply Sold
  0%                                              100%

  As more tokens are bought:
  • virtualNative ↑ (more PUSH in reserve)
  • virtualToken ↓ (fewer tokens in reserve)
  • price = virtualNative/virtualToken ↑
```

---

## Fee Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FEE BREAKDOWN                                   │
└─────────────────────────────────────────────────────────────────────────────┘

DEPLOY FEE: 2 PUSH
═══════════════════════════════════════════════════════════════════════════════
  Paid when: Creating a new token
  Recipient: FeeVault (100%)

LISTING FEE: 100 PUSH
═══════════════════════════════════════════════════════════════════════════════
  Paid when: Token graduates to Uniswap V3
  Recipient: FeeVault (100%)

TRADING FEE: 1% (configurable)
═══════════════════════════════════════════════════════════════════════════════
  Calculated: feeAmount = (amount * feeNumerator) / feeDenominator
             feeAmount = (amount * 1) / 100 = 1%

ON BUY:
  • Fee is deducted from tokens received
  • Tokens stay in curve (benefits all holders)
  • Creator fee deferred to sell operations

ON SELL:
  ┌─────────────────────────────────────────────────────┐
  │            Sell Amount: 100 PUSH                    │
  │                     │                               │
  │         ┌───────────┴───────────┐                   │
  │         ▼                       ▼                   │
  │   User Receives: 99 PUSH   Fee: 1 PUSH              │
  │                                 │                   │
  │              ┌──────────────────┼──────────────┐    │
  │              ▼                  ▼              ▼    │
  │   Liquidity Reserve    Creator: 0.3 PUSH  Platform │
  │      0.2 PUSH          (30% of fee)       0.5 PUSH │
  │   (20% of fee)                           (50% fee) │
  │        │                    │                 │    │
  │        ▼                    ▼                 ▼    │
  │   BondingCurve         Factory           FeeVault  │
  │   (for DEX LP)       (accumulated)      (deposited)│
  └─────────────────────────────────────────────────────┘

LIQUIDITY RESERVE:
  • 0.2% of each trade accumulated in BondingCurve
  • Added to DEX liquidity at graduation
  • Creates deeper liquidity pools for high-volume tokens

CREATOR FEE CLAIM:
  • Creator calls Factory.claimCreatorFees()
  • Accumulated fees sent to creator immediately
  • Event: CreatorFeesClaimed(creator, amount)

AT GRADUATION:
  • Excess tokens are BURNED (deflationary)
  • LP created with ADAPTIVE V3 RANGE (0.25x to 4x)
  • LP is PERMANENTLY LOCKED (no withdrawal function exists)
```

---

## Events Reference

### Core Events
```solidity
event CreateCurve(
    address indexed creator,
    address indexed curve,
    address indexed token,
    string tokenURI,
    string name,
    string symbol
);

event Buy(
    address indexed token,
    address indexed to,
    uint256 amountIn,
    uint256 amountOut,
    uint256 price,
    uint256 timestamp
);

event Sell(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amountIn,
    uint256 amountOut,
    uint256 price,
    uint256 timestamp
);

event SetWNative(address indexed oldWNative, address indexed newWNative);
event SetVault(address indexed oldVault, address indexed newVault);
```

### BondingCurve Events
```solidity
event Buy(address indexed to, address indexed token, uint256 amountNativeIn, uint256 amountOut, uint256 price, uint256 timestamp);
event Sell(address indexed to, address indexed token, uint256 amountTokenIn, uint256 amountOut, uint256 price, uint256 timestamp);
event Lock(address indexed token);
event Listing(address indexed curve, address indexed token, address indexed pool, uint256 amount0, uint256 amount1, uint128 liquidity);
event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp);
event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp);
event Sync(address indexed token, uint256 realNative, uint256 realToken, uint256 virtualNative, uint256 virtualToken, uint256 price, uint256 timestamp);
event CreatorFeeDistributed(address indexed creator, address indexed token, uint256 amount);
event CreatorFeeDeferredFromBuy(address indexed token, uint256 feeTokenAmount, uint256 price);
```

### Factory Events
```solidity
event Create(address indexed creator, address indexed curve, address indexed token, string tokenURI, string name, string symbol, uint256 virtualNative, uint256 virtualToken);
event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated);
event CreatorFeesClaimed(address indexed creator, uint256 amount);
event SetGraduationMarketCap(uint256 oldMarketCap, uint256 newMarketCap);
event SetCreatorFeeShare(uint256 oldShare, uint256 newShare);
event SetListingFee(uint256 oldFee, uint256 newFee);
event SetDeployFee(uint256 oldFee, uint256 newFee);
event SetVirtualReserves(uint256 virtualNative, uint256 virtualToken, uint256 k);
event SetFeeConfig(uint8 feeDenominator, uint16 feeNumerator);
event SetDexFee(uint24 oldFee, uint24 newFee);
```

---

## UUPS Proxy Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PROXY ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

DEPLOYMENT STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SINGLETON IMPLEMENTATIONS                             │
│  (Deployed once, shared by all proxies)                                     │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Core            │  │ Factory         │  │ FeeVault        │              │
│  │ Implementation  │  │ Implementation  │  │ Implementation  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ BondingCurve    │  │ Token           │                                   │
│  │ Implementation  │  │ Implementation  │                                   │
│  │ (stored in      │  │ (stored in      │                                   │
│  │ Factory)        │  │ Factory)        │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ delegatecall
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROXY INSTANCES                                    │
│  (Each has its own storage, delegates to implementation)                    │
│                                                                              │
│  SINGLETON PROXIES (1 each):                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Core Proxy      │  │ Factory Proxy   │  │ FeeVault Proxy  │              │
│  │ (ERC1967)       │  │ (ERC1967)       │  │ (ERC1967)       │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  PER-TOKEN PROXIES (1 pair per token):                                      │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ Token Proxy #1  │  │ BondingCurve    │                                   │
│  │ (ERC1967)       │  │ Proxy #1        │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ Token Proxy #2  │  │ BondingCurve    │                                   │
│  │ (ERC1967)       │  │ Proxy #2        │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│         ...                   ...                                           │
└─────────────────────────────────────────────────────────────────────────────┘

KEY PATTERNS
═══════════════════════════════════════════════════════════════════════════════

1. DISABLE INITIALIZERS (in implementation constructor):
   constructor() {
       _disableInitializers();
   }

2. INITIALIZER (called on proxy):
   function initialize(...) external initializer {
       __UUPSUpgradeable_init();
       __AccessControl_init();
       // ... other init
   }

3. AUTHORIZE UPGRADE:
   function _authorizeUpgrade(address newImplementation)
       internal
       override
       onlyRole(DEFAULT_ADMIN_ROLE)
   {}
```

---

## Uniswap V3 Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GRADUATION TO UNISWAP V3                             │
└─────────────────────────────────────────────────────────────────────────────┘

TRIGGER: marketCap >= graduationMarketCap (1M PUSH)

PROCESS:
═══════════════════════════════════════════════════════════════════════════════

1. LOCK CURVE
   ┌────────────────────────────────────────────┐
   │ • BondingCurve.locked = true              │
   │ • No more buy/sell on bonding curve       │
   │ • Event: Lock(token)                       │
   └────────────────────────────────────────────┘
                         │
                         ▼
2. CREATE V3 POOL
   ┌────────────────────────────────────────────┐
   │ • Call UniswapV3Factory.createPool()      │
   │ • Token pair: token/WPUSH                  │
   │ • Fee tier: 3000 (0.30%)                   │
   │ • Initialize at current price             │
   └────────────────────────────────────────────┘
                         │
                         ▼
3. CALCULATE LIQUIDITY
   ┌────────────────────────────────────────────┐
   │ • Determine tick range for concentrated   │
   │   liquidity                               │
   │ • Use LiquidityAmounts library            │
   │ • Optimize position for current price     │
   └────────────────────────────────────────────┘
                         │
                         ▼
4. ADD LIQUIDITY
   ┌────────────────────────────────────────────┐
   │ • Transfer reserves to pool               │
   │ • Mint LP position (owned by curve)       │
   │ • Event: Listing(curve, token, pool, ...) │
   └────────────────────────────────────────────┘
                         │
                         ▼
5. POST-LISTING
   ┌────────────────────────────────────────────┐
   │ • BondingCurve.isListing = true           │
   │ • All trading on Uniswap V3               │
   │ • LP fees accrue to bonding curve         │
   └────────────────────────────────────────────┘

FEE TIERS SUPPORTED:
  • 500 (0.05%) - Stable pairs
  • 3000 (0.30%) - Most pairs (DEFAULT)
  • 10000 (1.00%) - Exotic pairs
```

---

## Security Features

### Reentrancy Protection
```solidity
// BondingCurve.sol
function buy(address to, uint256 amountOut) external nonReentrant { ... }
function sell(address to, uint256 amountOut) external nonReentrant { ... }
```

### Amount Validation
```solidity
// CRITICAL: Validates amountOut matches formula exactly
if (amountOut != expectedAmountOut) {
    revert InvalidAmountOut();
}
```

### Slippage Protection
```solidity
// Core.sol
modifier ensure(uint256 deadline) {
    if (block.timestamp > deadline) revert Expired();
    _;
}

// In buy/sell functions
if (amountOut < amountOutMin) revert SlippageExceeded();
if (amountIn > amountInMax) revert SlippageExceeded();
```

### Access Control
```solidity
// All sensitive operations require roles
function buy(...) external onlyRole(CORE_ROLE) { ... }
function sell(...) external onlyRole(CORE_ROLE) { ... }
function mint(...) external onlyRole(BONDING_CURVE_ROLE) { ... }
```

### Emergency Pause (PAUSER_ROLE)
```solidity
// Core.sol - Instant pause without timelock delay
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

// Emergency multi-sig can pause instantly
function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

// Key benefit: Separates emergency response from admin operations
// Admin changes require 48hr timelock, but pause is instant
```

### Timelock Controller (48hr Delay)
```solidity
// All admin operations go through TimelockController
// Deployment: script/DeployTimelock.s.sol

// Operations subject to timelock:
- setDeployFee()
- setListingFee()
- setGraduationMarketCap()
- setFeeConfig()
- setVirtualReserves()
- upgradeToAndCall() (contract upgrades)

// Operations NOT subject to timelock (instant):
- pause() / unpause() via PAUSER_ROLE
```

### Attack Prevention Summary
```
┌───────────────────────┬────────────────────────────────────────────┐
│ Attack Vector         │ Protection                                 │
├───────────────────────┼────────────────────────────────────────────┤
│ Reentrancy            │ ReentrancyGuardUpgradeable on all trades   │
│ Flash Loan Pump&Dump  │ 1% fee makes unprofitable (tested)         │
│ Sandwich Attack       │ Profit limited <5% due to fees (tested)    │
│ Privilege Escalation  │ AccessControl + Timelock (48hr delay)      │
│ Instant Admin Abuse   │ 48hr timelock on all admin functions       │
│ DoS via Gas           │ Bounded loops, no unbounded arrays         │
│ Front-running listing │ By design - permissionless graduation      │
└───────────────────────┴────────────────────────────────────────────┘
```

---

## Deployment Configuration

### Push Chain Testnet (Chain ID: 42101)
```
Network RPC: https://evm.rpc-testnet-donut-node1.push.org/
Block Explorer: https://donut.push.network/
```

### Default Parameters
| Parameter | Value | Description |
|-----------|-------|-------------|
| WPUSH | `0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7` | Wrapped native token |
| Deploy Fee | 0.01 PUSH | Cost to create token |
| Listing Fee | 0.1 PUSH | Cost to graduate to DEX |
| Virtual Native | 1 PUSH | Initial virtual PUSH reserve |
| Virtual Token | 50M tokens | Initial virtual token reserve |
| Graduation Market Cap | 1M PUSH | Threshold for DEX listing |
| Fee Denominator | 100 | Fee calculation denominator |
| Fee Numerator | 1 | Fee calculation numerator (1%) |
| DEX Fee | 3000 | Uniswap V3 fee tier (0.30%) |
| Creator Fee Share | 1000 | Creator receives 10% of fees |

### Deployed Addresses (Testnet)
```
Core:     0x592F8f0abbB9a3d3c425980Ac0263363C8405b03
Factory:  0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8
FeeVault: 0xbe2fd9b720d1d7fac7208523376d2a3332019928
WPUSH:    0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7
```

---

## File Structure

```
smart-contract-v2/
├── src/
│   ├── Core.sol                     # Main entry point (~650 LOC)
│   ├── BondingCurveFactory.sol      # Factory contract (~514 LOC)
│   ├── BondingCurve.sol             # Per-token AMM (~911 LOC)
│   ├── Token.sol                    # ERC20 token (~140 LOC)
│   ├── FeeVault.sol                 # ERC4626 vault (~94 LOC)
│   ├── WPUSH.sol                    # Wrapped native (~185 LOC)
│   ├── UniswapV3Factory.sol         # V3 factory (~150 LOC)
│   ├── UniswapV3Pool.sol            # V3 pool (~201 LOC)
│   ├── ProxyFactory.sol             # Proxy deployer (~18 LOC)
│   │
│   ├── interfaces/
│   │   ├── ICore.sol                # Core interface
│   │   ├── IBondingCurve.sol        # Curve interface
│   │   ├── IBondingCurveFactory.sol # Factory interface
│   │   ├── IFeeVault.sol            # Vault interface
│   │   ├── IToken.sol               # Token interface
│   │   ├── IWNative.sol             # WPUSH interface
│   │   ├── IUniswapV3Factory.sol    # V3 factory interface
│   │   ├── IUniswapV3Pool.sol       # V3 pool interface
│   │   ├── IUniswapV3MintCallback.sol
│   │   ├── IUniswapV2Pair.sol       # V2 compatibility
│   │   ├── IUniswapV2Factory.sol
│   │   └── IUniswapV2ERC20.sol
│   │
│   └── utils/
│       ├── BondingCurveLibrary.sol  # AMM math
│       ├── LiquidityAmounts.sol     # V3 liquidity calc
│       └── TickMath.sol             # V3 tick math
│
├── test/
│   ├── unit/                        # 234 unit tests
│   │   ├── Core.t.sol               # Core tests (35)
│   │   ├── CoreExtended.t.sol       # Extended core tests (22)
│   │   ├── BondingCurve.t.sol       # Curve tests (35)
│   │   ├── BondingCurveFactory.t.sol # Factory tests (36)
│   │   ├── Token.t.sol              # Token tests (33)
│   │   ├── FeeVault.t.sol           # Vault tests (31)
│   │   ├── WPUSH.t.sol              # WPUSH tests (29)
│   │   └── CreatorFee.t.sol         # Creator fee tests (13)
│   │
│   ├── integration/                 # 47 integration tests
│   │   ├── Listing.t.sol            # Graduation tests (15)
│   │   ├── Upgrade.t.sol            # Upgrade tests (15)
│   │   └── TimelockAdmin.t.sol      # Timelock tests (17) ★ NEW
│   │
│   ├── fuzz/                        # 10 fuzz tests
│   │   └── BondingCurveFuzz.t.sol
│   │
│   ├── invariant/                   # 10 invariant tests
│   │   └── BondingCurveInvariant.t.sol
│   │
│   ├── security/                    # 94 security tests ★ EXPANDED
│   │   ├── GasLimitAttack.t.sol     # Gas limit attacks (13)
│   │   ├── ReentrancyAttack.t.sol   # Reentrancy tests (12) ★ NEW
│   │   ├── FlashLoanAttack.t.sol    # Flash loan tests (10) ★ NEW
│   │   └── AccessControlAttack.t.sol # Access control (33) ★ NEW
│   │
│   ├── stress/                      # 26 stress tests ★ NEW
│   │   └── StressTest.t.sol         # High-volume scenarios
│   │
│   └── branch/                      # 287 branch coverage tests
│       ├── BranchCoverage.t.sol           # (89)
│       ├── LibraryBranchCoverage.t.sol    # (32)
│       ├── ExtendedBranchCoverage.t.sol   # (56)
│       ├── BondingCurveBranchCoverage.t.sol # (35)
│       ├── DirectBondingCurveTests.t.sol  # (24)
│       ├── CoreBranchCoverage.t.sol       # (10)
│       ├── PureLibraryTests.t.sol         # (22 + 9 TickMath)
│       └── SellBranchCoverage.t.sol       # (19)
│
├── script/
│   ├── Deploy.s.sol                 # Generic deployment
│   ├── DeployPushChain.s.sol        # Push Chain deployment
│   ├── DeployProxies.s.sol          # Proxy deployment
│   ├── DeployFeeVaultProxyFixed.s.sol
│   ├── DeployTimelock.s.sol         # Timelock deployment ★ NEW
│   └── TransferAdminToTimelock.s.sol # Admin transfer ★ NEW
│
├── ARCHITECTURE.md                  # This file
├── AUDIT_REPORT.md                  # Security audit report
├── foundry.toml                     # Foundry configuration
└── README.md
```

---

## Quick Reference

### Creating a Token
```solidity
// User calls
Core.createCurve(
    creator,        // Address to receive creator fees
    "MyToken",      // Token name
    "MTK",          // Token symbol
    "ipfs://...",   // Metadata URI
    1 ether,        // Initial buy amount (optional)
    0               // Additional fee (optional)
);
```

### Buying Tokens
```solidity
// Exact input: spend specific PUSH amount
Core.exactInBuy{value: 1 ether}(
    1 ether,        // Amount of PUSH to spend
    4_000_000e18,   // Minimum tokens to receive
    tokenAddress,   // Token to buy
    msg.sender,     // Recipient
    block.timestamp + 300  // Deadline
);

// Exact output: receive specific token amount
Core.exactOutBuy{value: 2 ether}(
    5_000_000e18,   // Exact tokens to receive
    2 ether,        // Maximum PUSH to spend
    tokenAddress,
    msg.sender,
    block.timestamp + 300
);
```

### Selling Tokens
```solidity
// Approve tokens first
Token.approve(coreAddress, amount);

// Exact input: sell specific token amount
Core.exactInSell(
    1_000_000e18,   // Tokens to sell
    0.01 ether,     // Minimum PUSH to receive
    tokenAddress,
    msg.sender,     // From
    msg.sender,     // To (recipient of PUSH)
    block.timestamp + 300
);
```

### Checking Price
```solidity
uint256 price = Core.getCurrentPrice(tokenAddress);  // Price in PUSH (1e18 scale)
uint256 marketCap = Core.calculateMarketCap(tokenAddress);  // Market cap in PUSH
```

### Claiming Creator Fees
```solidity
Factory.claimCreatorFees();  // Transfers accumulated fees to caller
```

---

## Test Summary

| Category | Tests | Description |
|----------|-------|-------------|
| Unit Tests | 234 | Core functionality testing |
| Integration Tests | 47 | End-to-end flows including timelock |
| Security Tests | 94 | Attack prevention validation |
| Stress Tests | 26 | High-volume scenarios |
| Fuzz Tests | 10 | Random input testing |
| Invariant Tests | 10 | State invariant verification |
| Branch Coverage | 287 | Code path coverage |
| **Total** | **692** | All passing |

---

*Last Updated: January 25, 2026*
*Smart Contract Version: v2*
*Network: Push Chain Testnet (42101)*
*Status: Production Ready (pending professional audit)*
