// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WPUSH
 * @notice Wrapped PUSH token for Hodl.fun and Push Chain ecosystem
 * @dev ERC20 + ERC2612 Permit for gasless approvals
 *      Implements standard deposit/withdraw pattern for native PUSH wrapping
 *      Can be used as fallback if Push Chain doesn't deploy official WPUSH
 */
contract WPUSH is ERC20, ERC20Permit, Ownable {
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
     * @notice Emitted when tokens are minted (emergency/initialization only)
     * @param to Recipient address
     * @param amount Amount minted
     */
    event Minted(address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are burned
     * @param from Address that burned
     * @param amount Amount burned
     */
    event Burned(address indexed from, uint256 amount);

    error InsufficientBalance();

    constructor() ERC20("Wrapped PUSH", "WPUSH") ERC20Permit("Wrapped PUSH") {}

    /**
     * @notice Deposit native PUSH and receive WPUSH
     * @dev Can be called with ETH value to wrap
     */
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw WPUSH to receive native PUSH
     * @param amount Amount of WPUSH to withdraw
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdraw amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _burn(msg.sender, amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");

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
    ) external {
        require(amount > 0, "Withdraw amount must be greater than 0");
        require(balanceOf(owner) >= amount, "Insufficient balance");

        // Use permit to approve spending
        permit(owner, msg.sender, amount, deadline, v, r, s);

        _burn(owner, amount);

        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(owner, amount);
    }

    /**
     * @notice Receive function to allow direct native PUSH transfers
     * Automatically wraps received PUSH
     */
    receive() external payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Emergency mint function (only owner, for initialization or recovery)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Mint amount must be greater than 0");
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Batch mint for initial distribution
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Array length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Mint amount must be greater than 0");
            _mint(recipients[i], amounts[i]);
            emit Minted(recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        require(amount > 0, "Burn amount must be greater than 0");
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens on behalf of another address
     * @param account Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "Insufficient allowance");

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
     * @notice Emergency withdrawal by owner (in case of stuck funds)
     * @dev Only callable by owner as last resort
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }
}
