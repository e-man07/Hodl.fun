# Bonding Curve Platform v2 - Upgradeable Contracts

A complete rewrite of the bonding curve platform with proper AMM mechanics, upgradeable contracts, and all features from nad.fun reference implementation.

## 🏗️ Architecture

This implementation uses a **modular, upgradeable architecture** with separate contracts for each component:

```
┌─────────────────────────────────────────┐
│           Core Contract                 │
│  (Orchestrator - Upgradeable)           │
│  - Handles all buy/sell operations      │
│  - Fee validation                       │
│  - Wrapped token management             │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼──────────┐  ┌──────▼──────────────┐
│   Factory    │  │    FeeVault          │
│ (Upgradeable)│  │  (ERC4626 Upgradeable)│
│              │  │                      │
│ - Creates    │  │ - Fee collection     │
│   curves     │  │ - Yield generation   │
│ - Manages    │  │                      │
│   config     │  └──────────────────────┘
└───┬──────────┘
    │
    │ Creates
    │
┌───▼─────────────────────────────────────┐
│  BondingCurve (One per token)           │
│  (Upgradeable)                          │
│  - Virtual reserves                     │
│  - Constant product (x * y = k)         │
│  - Target mechanism                     │
│  - DEX listing                          │
└───┬─────────────────────────────────────┘
    │
    │ Manages
    │
┌───▼──────────┐
│ Token       │
│(Upgradeable)│
│ - ERC20     │
│ - Mintable  │
│ - Burnable  │
└─────────────┘
```

## 📦 Contracts

### Core Contracts

1. **Core.sol** - Central orchestrator for all operations
   - Exact input/output swaps
   - Fee validation
   - Wrapped native token handling
   - Deadline protection

2. **BondingCurveFactory.sol** - Factory for creating curves
   - Global configuration management
   - Creates bonding curve + token pairs
   - Stores mappings

3. **BondingCurve.sol** - Individual bonding curve per token
   - Constant product formula (x * y = k)
   - Virtual and real reserves
   - Target-based locking
   - DEX listing functionality

4. **Token.sol** - ERC20 token contract
   - Mintable by bonding curve
   - Burnable
   - Metadata URI support

5. **FeeVault.sol** - ERC4626 vault for fees
   - Professional fee management
   - Yield generation capability
   - Standardized interface

### Supporting Contracts

- **BondingCurveLibrary.sol** - Math utilities for constant product formula
- **Interfaces/** - All contract interfaces

## 🔧 Features

### ✅ Implemented Features

- ✅ **Constant Product Formula** - Proper AMM mechanics (x * y = k)
- ✅ **Virtual Reserves** - Initial price setting and smooth price discovery
- ✅ **Separate Bonding Curves** - One curve per token (better isolation)
- ✅ **Upgradeable Contracts** - UUPS pattern for all contracts
- ✅ **Core Orchestrator** - Centralized operation management
- ✅ **Fee Vault** - ERC4626 for professional fee management
- ✅ **Wrapped Native Support** - ERC20 compatibility
- ✅ **Exact Input/Output Swaps** - Flexible trading options
- ✅ **Deadline Protection** - Transaction expiration handling
- ✅ **Target Mechanism** - Lock when target reached
- ✅ **DEX Listing** - Automatic Uniswap listing

### 🔄 Upgradeability

All contracts use **UUPS (Universal Upgradeable Proxy Standard)** pattern:
- Gas efficient
- Allows contract upgrades
- Maintains state across upgrades
- Admin-controlled upgrades

## 🚀 Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
```

### Configuration

Update `script/Deploy.s.sol` with:
- `WNATIVE` - Wrapped native token address
- `DEX_FACTORY` - Uniswap/DEX factory address
- Fee parameters
- Virtual reserve amounts

### Deploy

```bash
# Set private key
export PRIVATE_KEY=your_private_key

# Deploy to testnet
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# Deploy to mainnet
forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify --slow
```

### Post-Deployment

1. Update Core factory address:
```solidity
core.setFactory(factoryAddress);
```

2. Update FeeVault core address:
```solidity
feeVault.setCore(coreAddress);
```

## 📊 Usage Examples

### Creating a Token

```solidity
// Via Core contract
core.createCurve(
    creator,
    "My Token",
    "MTK",
    "ipfs://...",
    initialLiquidity, // Optional
    deployFee
);
```

### Buying Tokens (Exact Input)

```solidity
core.exactInBuy(
    amountIn,        // ETH to spend
    amountOutMin,    // Min tokens expected
    tokenAddress,
    recipient,
    deadline
);
```

### Buying Tokens (Exact Output)

```solidity
core.exactOutBuy(
    amountOut,       // Tokens wanted
    amountInMax,     // Max ETH to spend
    tokenAddress,
    recipient,
    deadline
);
```

### Selling Tokens

```solidity
core.exactInSell(
    amountIn,        // Tokens to sell
    amountOutMin,    // Min ETH expected
    tokenAddress,
    seller,
    recipient,
    deadline
);
```

### Listing on DEX

```solidity
// After target is reached and curve is locked
bondingCurve.listing(); // Returns Uniswap pair address
```

## 🔒 Security Features

- ✅ Reentrancy protection
- ✅ Access control (OpenZeppelin)
- ✅ Input validation
- ✅ Deadline protection
- ✅ Fee validation
- ✅ Constant product invariant checks
- ✅ Upgrade authorization

## 📈 Key Improvements Over v1

1. **Proper AMM Math** - Constant product formula instead of linear approximation
2. **Virtual Reserves** - Initial price setting and better price discovery
3. **Modular Design** - Separate contracts for better scalability
4. **Upgradeability** - All contracts can be upgraded
5. **Professional Fees** - ERC4626 vault for yield generation
6. **Better Architecture** - Core orchestrator pattern
7. **More Features** - Exact swaps, deadline protection, DEX integration

## 🧪 Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Generate coverage
forge coverage
```

## 📝 Upgrade Process

To upgrade a contract:

1. Deploy new implementation
2. Call `upgradeTo(newImplementation)` on proxy (admin only)
3. If needed, call `upgradeToAndCall()` for initialization

Example:
```solidity
// Upgrade Core contract
core.upgradeTo(newCoreImplementation);
```

## 🔗 Contract Addresses

After deployment, save these addresses:
- Core Proxy
- Factory Proxy
- FeeVault Proxy
- Implementation addresses (for upgrades)

## 📚 References

- [nad.fun Contracts](https://github.com/Naddotfun/contracts)
- [OpenZeppelin Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Uniswap V2 Core](https://docs.uniswap.org/contracts/v2/overview)
- [ERC4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)

## ⚠️ Important Notes

1. **Initialization**: Contracts must be initialized after deployment
2. **Upgrades**: Only admin can upgrade contracts
3. **Configuration**: Factory config is set once during initialization
4. **Target**: Each curve locks when target token amount is reached
5. **Fees**: Fees are collected in FeeVault and can generate yield

## 📄 License

MIT License

---

**Status**: ✅ **Production Ready** (after testing and audit)

