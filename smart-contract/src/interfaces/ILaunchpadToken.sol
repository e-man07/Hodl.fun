// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ILaunchpadToken
 * @dev Interface for tokens created through the launchpad
 */
interface ILaunchpadToken is IERC20 {
    /// @notice Emitted when token metadata is updated
    event MetadataUpdated(string indexed metadataURI);
    
    /// @notice Emitted when trading is enabled
    event TradingEnabled(uint256 timestamp);
    
    /// @notice Emitted when liquidity is added
    event LiquidityAdded(uint256 amount, uint256 timestamp);

    /**
     * @notice Get token metadata URI (IPFS hash)
     * @return The IPFS URI containing token metadata
     */
    function metadataURI() external view returns (string memory);
    
    /**
     * @notice Get token creator address
     * @return The address of the token creator
     */
    function creator() external view returns (address);
    
    /**
     * @notice Get marketplace contract address
     * @return The address of the associated marketplace
     */
    function marketplace() external view returns (address);
    
    /**
     * @notice Check if trading is enabled
     * @return True if trading is enabled
     */
    function tradingEnabled() external view returns (bool);
    
    /**
     * @notice Get token launch timestamp
     * @return The timestamp when token was launched
     */
    function launchTimestamp() external view returns (uint256);
    
    /**
     * @notice Enable trading (only marketplace can call)
     */
    function enableTrading() external;
    
    /**
     * @notice Mint tokens (only marketplace can call during bonding curve phase)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @notice Burn tokens (only marketplace can call)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external;
}
