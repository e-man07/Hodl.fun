// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IFeeVault
 * @notice Interface for fee vault
 */
interface IFeeVault {
    /**
     * @notice Deposit fees
     * @param amount Amount to deposit
     */
    function depositFees(uint256 amount) external;
}

