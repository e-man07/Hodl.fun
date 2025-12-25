# Security Audit Report

**Date:** December 2024  
**Auditor:** Automated Security Analysis  
**Contracts Audited:** BondingCurve, Core, BondingCurveFactory, Token, FeeVault

---

## Executive Summary

This security audit identified **10 vulnerabilities** across the contract codebase:
- **4 CRITICAL** issues
- **3 HIGH** severity issues  
- **2 MEDIUM** severity issues
- **1 LOW** severity issue

**Overall Status: ⚠️ NOT PRODUCTION READY** - Critical vulnerabilities must be fixed before deployment.

---

## Critical Vulnerabilities

### 🔴 CRIT-1: Reentrancy Vulnerability in `buy()` Function

**Location:** `BondingCurve.sol:147-191`

**Severity:** CRITICAL

**Description:**
The `buy()` function transfers tokens to the user (`safeTransfer`) before updating state variables. This violates the Checks-Effects-Interactions (CEI) pattern and allows potential reentrancy attacks.

**Vulnerable Code:**
```solidity
function buy(address to, uint256 amountOut) external override onlyRole(CORE_ROLE) {
    // ... checks ...
    
    // ❌ Transfer happens BEFORE state update
    IERC20(_token).safeTransfer(to, tokensToUser);
    balanceNative = IERC20(_wNative).balanceOf(address(this));
    
    // State update happens AFTER
    _update(amountNativeIn, amountOut, true);
    
    if (virtualNative * virtualToken < k) {
        revert InvalidK();
    }
}
```

**Impact:**
- Attacker could call `buy()` again during the external transfer, potentially draining funds
- State inconsistencies could occur
- Loss of funds

**Recommendation:**
1. Add `ReentrancyGuard` from OpenZeppelin
2. Move transfers to AFTER state updates
3. Use CEI pattern: Checks → Effects → Interactions

**Fixed Code:**
```solidity
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract BondingCurve is IBondingCurve, Initializable, UUPSUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    // ...
    
    function buy(address to, uint256 amountOut) external override nonReentrant onlyRole(CORE_ROLE) {
        // Checks
        if (lock) revert BondingCurveLocked();
        if (amountOut == 0) revert InvalidAmountOut();
        if (to == wNative || to == token) revert InvalidTo();
        
        (uint256 _realNativeReserves, uint256 _realTokenReserves) = getReserves();
        
        Fee memory fee = feeConfig;
        uint256 feeAmount = (amountOut * fee.numerator) / fee.denominator;
        uint256 tokensToUser = amountOut - feeAmount;
        
        uint256 balanceNative = IERC20(wNative).balanceOf(address(this));
        uint256 amountNativeIn = balanceNative - _realNativeReserves;
        
        // Effects: Update state FIRST
        _update(amountNativeIn, amountOut, true);
        
        if (virtualNative * virtualToken < k) {
            revert InvalidK();
        }
        
        // Interactions: Transfer AFTER state update
        IERC20(token).safeTransfer(to, tokensToUser);
        
        uint256 price = (virtualNative * 1e18) / virtualToken;
        emit Buy(to, token, amountNativeIn, tokensToUser, price, block.timestamp);
        _checkTarget();
    }
}
```

---

### 🔴 CRIT-2: Reentrancy Vulnerability in `sell()` Function

**Location:** `BondingCurve.sol:198-252`

**Severity:** CRITICAL

**Description:**
Similar to `buy()`, the `sell()` function transfers tokens before updating state, allowing reentrancy attacks.

**Vulnerable Code:**
```solidity
function sell(address to, uint256 amountOut) external override onlyRole(CORE_ROLE) {
    // ... checks ...
    
    // ❌ Transfers happen BEFORE state update
    IERC20(_wNative).safeTransfer(to, nativeToUser);
    if (feeAmount > 0) {
        IERC20(_wNative).safeTransfer(feeVault, feeAmount);
    }
    
    // State update happens AFTER
    _update(amountTokenIn, amountOut, false);
}
```

**Impact:**
- Same as CRIT-1: potential fund drainage via reentrancy

**Recommendation:**
Apply same fix as CRIT-1: add `ReentrancyGuard` and follow CEI pattern.

---

### 🔴 CRIT-3: Unsafe `transfer()` Calls in `listing()` Function

**Location:** `BondingCurve.sol:286-287`

**Severity:** CRITICAL

**Description:**
The `listing()` function uses `transfer()` instead of `safeTransfer()`, which can fail silently if the recipient is a contract that doesn't handle transfers properly.

**Vulnerable Code:**
```solidity
IERC20(wNative).transfer(pair_, listingNativeAmount);  // ❌ Unsafe
IERC20(token).transfer(pair_, listingTokenAmount);     // ❌ Unsafe
```

**Impact:**
- Silent failures if pair contract doesn't handle transfers
- Lost funds if transfer fails but contract continues execution
- Potential DoS if pair is not properly initialized

**Recommendation:**
Use `safeTransfer()` instead:
```solidity
IERC20(wNative).safeTransfer(pair_, listingNativeAmount);
IERC20(token).safeTransfer(pair_, listingTokenAmount);
```

---

### 🔴 CRIT-4: Potential Underflow in `listing()` Burn Calculation

**Location:** `BondingCurve.sol:276`

**Severity:** CRITICAL

**Description:**
The burn amount calculation can underflow if `realTokenReserves < ((realNativeReserves - listingFee) * virtualToken) / virtualNative`.

**Vulnerable Code:**
```solidity
burnTokenAmount = realTokenReserves - ((realNativeReserves - listingFee) * virtualToken) / virtualNative;
if (burnTokenAmount > 0) {
    IToken(token).burn(burnTokenAmount);
}
```

**Impact:**
- Underflow will revert the transaction (in Solidity 0.8+)
- But if calculation is wrong, incorrect tokens could be burned
- Listing could fail unexpectedly

**Recommendation:**
Add explicit check and use SafeMath-like patterns:
```solidity
uint256 expectedTokenAmount = ((realNativeReserves - listingFee) * virtualToken) / virtualNative;
if (realTokenReserves > expectedTokenAmount) {
    burnTokenAmount = realTokenReserves - expectedTokenAmount;
    if (burnTokenAmount > 0) {
        IToken(token).burn(burnTokenAmount);
    }
} else {
    // Handle case where actual reserves are less than expected
    // This should not happen in normal flow, but handle gracefully
    burnTokenAmount = 0;
}
```

---

## High Severity Issues

### 🟠 HIGH-1: Missing Division by Zero Check in `initialize()`

**Location:** `BondingCurve.sol:126`

**Severity:** HIGH

**Description:**
The `initialize()` function calculates `initialPrice` without checking if `virtualToken` is zero, which would cause a division by zero revert.

**Vulnerable Code:**
```solidity
uint256 initialPrice = (virtualNative * 1e18) / virtualToken;  // ❌ No check for virtualToken == 0
```

**Impact:**
- Revert during initialization if `virtualToken` is 0
- Could prevent token deployment

**Recommendation:**
Add validation in `initialize()`:
```solidity
function initialize(...) external initializer {
    if (msg.sender != factory) revert OnlyFactory();
    if (_virtualToken == 0 || _virtualNative == 0) revert InvalidReserves();
    if (_k == 0) revert InvalidK();
    // ... rest of code
}
```

---

### 🟠 HIGH-2: Missing Fee Configuration Validation

**Location:** `BondingCurve.sol:121`, `BondingCurveFactory.sol:74-84`

**Severity:** HIGH

**Description:**
No validation that `feeNumerator < feeDenominator` and that `feeDenominator != 0`. This could lead to fees >= 100% or division by zero.

**Vulnerable Code:**
```solidity
feeConfig = Fee(_feeDenominator, _feeNumerator);  // ❌ No validation
```

**Impact:**
- Fees could be 100% or more, making trades unprofitable
- Division by zero if `feeDenominator` is 0
- Poor user experience

**Recommendation:**
Add validation:
```solidity
function initialize(...) external initializer {
    // ...
    if (_feeDenominator == 0) revert InvalidFeeConfig();
    if (_feeNumerator >= _feeDenominator) revert InvalidFeeConfig();  // Fee must be < 100%
    if (_feeNumerator == 0) revert InvalidFeeConfig();  // Fee must be > 0 (if fees are required)
    feeConfig = Fee(_feeDenominator, _feeNumerator);
}
```

---

### 🟠 HIGH-3: Missing Validation in `_update()` Function

**Location:** `BondingCurve.sol:309-325`

**Severity:** HIGH

**Description:**
The `_update()` function doesn't validate that `virtualToken` won't underflow when subtracting `amountOut` in buy operations, or that `virtualNative` won't underflow when subtracting `amountOut` in sell operations.

**Vulnerable Code:**
```solidity
function _update(uint256 amountIn, uint256 amountOut, bool isBuy) private {
    realNativeReserves = IERC20(wNative).balanceOf(address(this));
    realTokenReserves = IERC20(token).balanceOf(address(this));

    if (isBuy) {
        virtualNative += amountIn;
        virtualToken -= amountOut;  // ❌ Could underflow
    } else {
        virtualNative -= amountOut;  // ❌ Could underflow
        virtualToken += amountIn;
    }
}
```

**Impact:**
- Underflow will revert (in Solidity 0.8+), but indicates logic error
- Could prevent trades that should be valid

**Recommendation:**
Add explicit checks (though Solidity 0.8+ will revert on underflow, explicit checks are clearer):
```solidity
function _update(uint256 amountIn, uint256 amountOut, bool isBuy) private {
    realNativeReserves = IERC20(wNative).balanceOf(address(this));
    realTokenReserves = IERC20(token).balanceOf(address(this));

    if (isBuy) {
        virtualNative += amountIn;
        if (virtualToken < amountOut) revert InsufficientVirtualTokenReserves();
        virtualToken -= amountOut;
    } else {
        if (virtualNative < amountOut) revert InsufficientVirtualNativeReserves();
        virtualNative -= amountOut;
        virtualToken += amountIn;
    }
    
    // ... emit event
}
```

---

## Medium Severity Issues

### 🟡 MED-1: Potential Overflow in Price Calculation

**Location:** `BondingCurve.sol:186, 247, 322`

**Severity:** MEDIUM

**Description:**
Price calculation `(virtualNative * 1e18) / virtualToken` could overflow if `virtualNative` is very large (close to `type(uint256).max / 1e18`).

**Impact:**
- Price calculation would overflow and revert
- Unlikely in practice but theoretically possible

**Recommendation:**
Add overflow protection or use unchecked math with validation:
```solidity
// Check for potential overflow
if (virtualNative > type(uint256).max / 1e18) {
    // Handle edge case - price is extremely high
    // Could cap at max value or use alternative calculation
}
uint256 price = (virtualNative * 1e18) / virtualToken;
```

---

### 🟡 MED-2: Missing Initialization Validation in Factory

**Location:** `BondingCurveFactory.sol:58-100`

**Severity:** MEDIUM

**Description:**
The `initialize()` function doesn't validate that `virtualNative` and `virtualToken` are non-zero, which could lead to invalid curve initialization.

**Recommendation:**
Add validation:
```solidity
function initialize(...) external initializer {
    if (_owner == address(0) || _core == address(0)) revert InvalidAddress();
    if (params.virtualNative == 0 || params.virtualToken == 0) revert InvalidReserves();
    if (params.feeDenominator == 0) revert InvalidFeeConfig();
    if (params.feeNumerator >= params.feeDenominator) revert InvalidFeeConfig();
    // ... rest
}
```

---

## Low Severity Issues

### 🔵 LOW-1: Typo in Function Name

**Location:** `BondingCurveFactory.sol:238`, `Core.sol:131`

**Severity:** LOW

**Description:**
Function is named `getDelpyFee()` instead of `getDeployFee()` (typo: "Delpy" vs "Deploy").

**Impact:**
- Confusing naming, doesn't affect functionality
- Could cause confusion for developers

**Recommendation:**
Rename to `getDeployFee()`.

---

## Additional Security Recommendations

### 1. Add Event Emissions for Critical State Changes

**Recommendation:**
Ensure all critical state changes emit events for off-chain monitoring:
- ✅ Already present for most operations
- Consider adding events for fee config changes (if implemented)

### 2. Add Circuit Breakers

**Recommendation:**
Consider adding pause functionality for emergency situations:
```solidity
bool public paused;

modifier whenNotPaused() {
    require(!paused, "Contract paused");
    _;
}

function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    paused = true;
    emit Paused();
}
```

### 3. Time-locked Upgrades

**Recommendation:**
For production, consider implementing time-locked upgrades to prevent sudden malicious upgrades:
- Use OpenZeppelin's `TimelockController`
- Require multi-sig for admin operations

### 4. Comprehensive Input Validation

**Recommendation:**
Add validation for all user inputs:
- Validate addresses are not zero
- Validate amounts are within reasonable bounds
- Validate string lengths for name/symbol/URI

### 5. Gas Optimization

**Recommendation:**
Review gas usage:
- Consider using `unchecked` blocks for arithmetic that's guaranteed to be safe
- Cache repeated storage reads
- Pack structs efficiently

---

## Testing Recommendations

### 1. Unit Tests

- Test all functions with edge cases
- Test reentrancy scenarios (should fail with ReentrancyGuard)
- Test division by zero cases
- Test overflow/underflow cases
- Test fee calculations
- Test access control

### 2. Integration Tests

- Test full token creation flow
- Test buy/sell operations
- Test DEX listing
- Test upgrade mechanisms

### 3. Fuzz Testing

- Use Foundry's fuzzing capabilities
- Test with random amounts and addresses
- Test edge cases with extreme values

### 4. Formal Verification

- Consider formal verification for critical functions (bonding curve math)
- Verify constant product formula correctness

---

## Summary of Required Fixes

### Must Fix Before Production:

1. ✅ Add `ReentrancyGuard` to `BondingCurve.buy()` and `sell()`
2. ✅ Fix CEI pattern violations (move transfers after state updates)
3. ✅ Replace `transfer()` with `safeTransfer()` in `listing()`
4. ✅ Add underflow protection in `listing()` burn calculation
5. ✅ Add division by zero checks in `initialize()`
6. ✅ Add fee configuration validation
7. ✅ Add reserve validation in factory initialization

### Recommended Fixes:

8. Add overflow protection for price calculations
9. Fix typo: `getDelpyFee()` → `getDeployFee()`
10. Add comprehensive input validation
11. Consider pause functionality
12. Consider time-locked upgrades

---

## Conclusion

The contracts have a solid foundation but **require critical security fixes** before production deployment. The most critical issues are:

1. **Reentrancy vulnerabilities** (CRIT-1, CRIT-2)
2. **Unsafe transfer calls** (CRIT-3)
3. **Underflow risks** (CRIT-4)

Once these issues are addressed, the contracts should be:
- ✅ Re-audited
- ✅ Tested thoroughly
- ✅ Considered for external professional audit
- ✅ Tested on testnet extensively
- ✅ Only then deployed to mainnet

**Status: ⚠️ NOT PRODUCTION READY - Critical fixes required**

---

## Audit Methodology

1. Manual code review of all contracts
2. Analysis of access control patterns
3. Review of upgradeability mechanisms
4. Analysis of mathematical operations for overflow/underflow
5. Review of state management and CEI pattern compliance
6. Analysis of external call safety
7. Review of event emissions

---

*This audit was conducted automatically. For production deployment, a professional security audit by a reputable firm is highly recommended.*

