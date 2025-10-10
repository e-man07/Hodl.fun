// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ITokenFactory
 * @dev Interface for the token factory contract
 */
interface ITokenFactory {
    /// @notice Token creation parameters
    struct TokenParams {
        string name;
        string symbol;
        uint256 totalSupply;
        string metadataURI;
        uint256 reserveRatio;
        address creator;
    }
    
    /// @notice Emitted when a new token is created
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        string metadataURI
    );
    
    /// @notice Emitted when marketplace address is updated
    event MarketplaceUpdated(address indexed oldMarketplace, address indexed newMarketplace);

    /**
     * @notice Create a new launchpad token
     * @param params Token creation parameters
     * @return tokenAddress Address of the created token
     */
    function createToken(TokenParams calldata params) external payable returns (address tokenAddress);
    
    /**
     * @notice Get marketplace contract address
     * @return The marketplace contract address
     */
    function marketplace() external view returns (address);
    
    /**
     * @notice Get all created tokens by a creator
     * @param creator Address of the creator
     * @return tokens Array of token addresses created by the creator
     */
    function getTokensByCreator(address creator) external view returns (address[] memory tokens);
    
    /**
     * @notice Get total number of created tokens
     * @return count Total number of tokens created
     */
    function getTotalTokensCreated() external view returns (uint256 count);
    
    /**
     * @notice Get token at specific index
     * @param index Index of the token
     * @return tokenAddress Address of the token at the given index
     */
    function getTokenAtIndex(uint256 index) external view returns (address tokenAddress);
    
    /**
     * @notice Check if an address is a valid launchpad token
     * @param tokenAddress Address to check
     * @return True if it's a valid launchpad token
     */
    function isValidToken(address tokenAddress) external view returns (bool);
}
