// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title WPUSH
 * @notice Wrapped PUSH token for Hodl.fun and Push Chain ecosystem
 * @dev ERC20 + ERC2612 Permit for gasless approvals
 *      Implements standard deposit/withdraw pattern for native PUSH wrapping
 *      SECURITY: Maintains strict 1:1 backing - tokens only created via deposit
 *      REMOVED: mint(), batchMint(), emergencyWithdraw() functions (rug pull vectors)
 */
contract WPUSH is ERC20, ERC20Permit, ReentrancyGuard {
    /**
     * @notice Emitted when native PUSH is deposited and wrapped
     * @param sender Address that deposited
     * @param amount Amount of PUSH wrapped to WPUSH
     */
    event Deposit(address indexed sender, uint256 amount);

    /**
     * @notice Emitted when WPUSH is withdrawn back to native PUSH
     * @param recipient Address that withdrew
     * @param amount Amount of WPUSH unwrapped to PUSH
     */
    event Withdrawal(address indexed recipient, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     * @param from Address that burned
     * @param amount Amount burned
     */
    event Burned(address indexed from, uint256 amount);

    /// @notice Custom errors for gas efficiency
    error ZeroDeposit();
    error ZeroWithdraw();
    error InsufficientBalance();
    error WithdrawalFailed();
    error ZeroBurn();

    constructor() ERC20("Wrapped PUSH", "WPUSH") ERC20Permit("Wrapped PUSH") {}

    /**
     * @notice Deposit native PUSH and receive WPUSH
     * @dev Can be called with ETH value to wrap
     */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroDeposit();
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw WPUSH to receive native PUSH
     * @param amount Amount of WPUSH to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroWithdraw();
        if (balanceOf(msg.sender) < amount) revert InsufficientBalance();

        _burn(msg.sender, amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawalFailed();

        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @notice Withdraw WPUSH on behalf of another address (with permit)
     * @param owner Address that owns the WPUSH
     * @param amount Amount to withdraw
     * @param deadline Permit deadline
     * @param v Permit signature v
     * @param r Permit signature r
     * @param s Permit signature s
     */
    function withdrawWithPermit(
        address owner,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (amount == 0) revert ZeroWithdraw();
        if (balanceOf(owner) < amount) revert InsufficientBalance();

        // Use permit to approve spending
        permit(owner, msg.sender, amount, deadline, v, r, s);

        _burn(owner, amount);

        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert WithdrawalFailed();

        emit Withdrawal(owner, amount);
    }

    /**
     * @notice Receive function to allow direct native PUSH transfers
     * Automatically wraps received PUSH
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        if (amount == 0) revert ZeroBurn();
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens on behalf of another address
     * @param account Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address account, uint256 amount) external {
        if (amount == 0) revert ZeroBurn();
        uint256 currentAllowance = allowance(account, msg.sender);
        if (currentAllowance < amount) revert InsufficientBalance();

        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
        emit Burned(account, amount);
    }

    /**
     * @notice Get contract balance (native PUSH held)
     * @return Native PUSH balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Verify 1:1 backing (view function for transparency)
     * @return isFullyBacked True if totalSupply <= contract balance
     */
    function isFullyBacked() external view returns (bool) {
        return totalSupply() <= address(this).balance;
    }
}
