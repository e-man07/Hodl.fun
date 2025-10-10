// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/ITokenFactory.sol";
import "./interfaces/ITokenMarketplace.sol";
import "./LaunchpadToken.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for creating and deploying launchpad tokens
 * @notice Handles token creation and automatic marketplace listing
 */
contract TokenFactory is ITokenFactory, Ownable, ReentrancyGuard, Pausable {
    /// @notice Counter for tracking total tokens created
    uint256 private _tokenCounter;
    
    /// @notice Marketplace contract address
    address private _marketplace;
    
    /// @notice Array of all created tokens
    address[] private _allTokens;
    
    /// @notice Mapping from creator to their tokens
    mapping(address => address[]) private _tokensByCreator;
    
    /// @notice Mapping to check if token is valid
    mapping(address => bool) private _validTokens;
    
    /// @notice Token creation fee in ETH
    uint256 public creationFee = 0.01 ether;
    
    /// @notice Minimum name length
    uint256 public constant MIN_NAME_LENGTH = 3;
    
    /// @notice Maximum name length
    uint256 public constant MAX_NAME_LENGTH = 50;
    
    /// @notice Minimum symbol length
    uint256 public constant MIN_SYMBOL_LENGTH = 2;
    
    /// @notice Maximum symbol length
    uint256 public constant MAX_SYMBOL_LENGTH = 10;
    
    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Custom errors for gas efficiency
    error InvalidMarketplace();
    error InvalidTokenParams();
    error InvalidNameLength();
    error InvalidSymbolLength();
    error InvalidTotalSupply();
    error InvalidReserveRatio();
    error InsufficientCreationFee();
    error InvalidAddress();
    error TokenNotFound();
    error EmptyMetadataURI();

    /// @notice Events for better indexing
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /**
     * @notice Constructor
     * @param marketplace_ Address of the marketplace contract
     * @param feeCollector_ Address to collect creation fees
     */
    constructor(address marketplace_, address feeCollector_) Ownable(msg.sender) {
        if (marketplace_ == address(0) || feeCollector_ == address(0)) {
            revert InvalidAddress();
        }
        _marketplace = marketplace_;
        feeCollector = feeCollector_;
    }

    /**
     * @notice Create a new launchpad token
     * @param params Token creation parameters
     * @return tokenAddress Address of the created token
     */
    function createToken(TokenParams calldata params) 
        external 
        payable 
        override 
        nonReentrant 
        whenNotPaused 
        returns (address tokenAddress) 
    {
        // Validate creation fee
        if (msg.value < creationFee) {
            revert InsufficientCreationFee();
        }

        // Validate parameters
        _validateTokenParams(params);

        // Create new token contract
        LaunchpadToken newToken = new LaunchpadToken(
            params.name,
            params.symbol,
            params.totalSupply,
            params.metadataURI,
            params.creator,
            _marketplace
        );

        tokenAddress = address(newToken);

        // Update mappings and arrays
        _allTokens.push(tokenAddress);
        _tokensByCreator[params.creator].push(tokenAddress);
        _validTokens[tokenAddress] = true;
        _tokenCounter++;

        // List token on marketplace
        ITokenMarketplace(_marketplace).listToken(
            tokenAddress,
            params.metadataURI,
            params.totalSupply,
            params.reserveRatio
        );

        // Transfer creation fee
        payable(feeCollector).transfer(msg.value);

        emit TokenCreated(
            tokenAddress,
            params.creator,
            params.name,
            params.symbol,
            params.totalSupply,
            params.metadataURI
        );
    }

    /**
     * @notice Validate token creation parameters
     * @param params Token parameters to validate
     */
    function _validateTokenParams(TokenParams calldata params) internal pure {
        // Validate name
        if (bytes(params.name).length < MIN_NAME_LENGTH || 
            bytes(params.name).length > MAX_NAME_LENGTH) {
            revert InvalidNameLength();
        }

        // Validate symbol
        if (bytes(params.symbol).length < MIN_SYMBOL_LENGTH || 
            bytes(params.symbol).length > MAX_SYMBOL_LENGTH) {
            revert InvalidSymbolLength();
        }

        // Validate total supply (1M - 100M tokens)
        uint256 MIN_TOTAL_SUPPLY = 1_000_000 * 10**18;
        uint256 MAX_TOTAL_SUPPLY = 100_000_000 * 10**18;
        if (params.totalSupply < MIN_TOTAL_SUPPLY || 
            params.totalSupply > MAX_TOTAL_SUPPLY) {
            revert InvalidTotalSupply();
        }

        // Validate reserve ratio (10% to 90%)
        if (params.reserveRatio < 1000 || params.reserveRatio > 9000) {
            revert InvalidReserveRatio();
        }

        // Validate creator address
        if (params.creator == address(0)) {
            revert InvalidAddress();
        }

        // Validate metadata URI
        if (bytes(params.metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }
    }

    /**
     * @notice Get marketplace contract address
     * @return The marketplace contract address
     */
    function marketplace() external view override returns (address) {
        return _marketplace;
    }

    /**
     * @notice Get all created tokens by a creator
     * @param creator Address of the creator
     * @return tokens Array of token addresses created by the creator
     */
    function getTokensByCreator(address creator) 
        external 
        view 
        override 
        returns (address[] memory tokens) 
    {
        return _tokensByCreator[creator];
    }

    /**
     * @notice Get total number of created tokens
     * @return count Total number of tokens created
     */
    function getTotalTokensCreated() external view override returns (uint256 count) {
        return _tokenCounter;
    }

    /**
     * @notice Get token at specific index
     * @param index Index of the token
     * @return tokenAddress Address of the token at the given index
     */
    function getTokenAtIndex(uint256 index) external view override returns (address tokenAddress) {
        if (index >= _allTokens.length) {
            revert TokenNotFound();
        }
        return _allTokens[index];
    }

    /**
     * @notice Check if an address is a valid launchpad token
     * @param tokenAddress Address to check
     * @return True if it's a valid launchpad token
     */
    function isValidToken(address tokenAddress) external view override returns (bool) {
        return _validTokens[tokenAddress];
    }

    /**
     * @notice Get all created tokens
     * @return tokens Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory tokens) {
        return _allTokens;
    }

    /**
     * @notice Get creation statistics for a creator
     * @param creator Address of the creator
     * @return tokenCount Number of tokens created
     * @return totalSupply Total supply across all tokens
     */
    function getCreatorStats(address creator) 
        external 
        view 
        returns (uint256 tokenCount, uint256 totalSupply) 
    {
        address[] memory creatorTokens = _tokensByCreator[creator];
        tokenCount = creatorTokens.length;
        
        for (uint256 i = 0; i < creatorTokens.length; i++) {
            LaunchpadToken token = LaunchpadToken(creatorTokens[i]);
            totalSupply += token.totalSupply();
        }
    }

    /**
     * @notice Update marketplace address (only owner)
     * @param newMarketplace New marketplace address
     */
    function updateMarketplace(address newMarketplace) external onlyOwner {
        if (newMarketplace == address(0)) {
            revert InvalidAddress();
        }
        address oldMarketplace = _marketplace;
        _marketplace = newMarketplace;
        emit MarketplaceUpdated(oldMarketplace, newMarketplace);
    }

    /**
     * @notice Update creation fee (only owner)
     * @param newFee New creation fee in ETH
     */
    function updateCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update fee collector address (only owner)
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) {
            revert InvalidAddress();
        }
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @notice Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
