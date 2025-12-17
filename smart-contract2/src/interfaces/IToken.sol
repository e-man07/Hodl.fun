// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IToken
 * @notice Interface for token contracts
 */
interface IToken is IERC20 {
    /**
     * @notice Mint tokens to bonding curve
     * @param curve Bonding curve address
     */
    function mint(address curve) external;

    /**
     * @notice Burn tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external;

    /**
     * @notice Get token URI
     * @return uri Token metadata URI
     */
    function tokenURI() external view returns (string memory uri);
}

