// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWNative
 * @notice Interface for wrapped native token
 */
interface IWNative is IERC20 {
    /**
     * @notice Deposit native tokens and mint wrapped tokens
     */
    function deposit() external payable;

    /**
     * @notice Withdraw native tokens by burning wrapped tokens
     * @param amount Amount of wrapped tokens to burn
     */
    function withdraw(uint256 amount) external;
}

