// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ILaunchpadToken.sol";

/**
 * @title LaunchpadToken
 * @dev ERC20 token created through the launchpad with bonding curve mechanics
 * @notice This contract represents tokens that can be traded on the marketplace
 */
contract LaunchpadToken is 
    ERC20, 
    ERC20Burnable, 
    AccessControl, 
    Pausable, 
    ReentrancyGuard, 
    ILaunchpadToken 
{
    /// @notice Role for marketplace contract
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");
    
    /// @notice Role for factory contract
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    
    /// @notice Maximum total supply (100 million tokens)
    uint256 public constant MAX_TOTAL_SUPPLY = 100_000_000 * 10**18;
    
    /// @notice Minimum total supply (1 million tokens)
    uint256 public constant MIN_TOTAL_SUPPLY = 1_000_000 * 10**18;

    /// @notice IPFS metadata URI
    string private _metadataURI;
    
    /// @notice Token creator address
    address private _creator;
    
    /// @notice Associated marketplace contract
    address private _marketplace;
    
    /// @notice Whether trading is enabled
    bool private _tradingEnabled;
    
    /// @notice Token launch timestamp
    uint256 private _launchTimestamp;
    
    /// @notice Maximum supply for this token
    uint256 private _maxSupply;

    /// @notice Custom errors for gas efficiency
    error InvalidTotalSupply();
    error TradingNotEnabled();
    error OnlyMarketplace();
    error OnlyCreator();
    error InvalidAddress();
    error ExceedsMaxSupply();
    error InsufficientBalance();

    /**
     * @notice Constructor for LaunchpadToken
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param totalSupply_ Total supply of tokens
     * @param metadataURI_ IPFS metadata URI
     * @param creator_ Address of the token creator
     * @param marketplace_ Address of the marketplace contract
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        string memory metadataURI_,
        address creator_,
        address marketplace_
    ) ERC20(name_, symbol_) {
        if (totalSupply_ < MIN_TOTAL_SUPPLY || totalSupply_ > MAX_TOTAL_SUPPLY) {
            revert InvalidTotalSupply();
        }
        if (creator_ == address(0) || marketplace_ == address(0)) {
            revert InvalidAddress();
        }

        _metadataURI = metadataURI_;
        _creator = creator_;
        _marketplace = marketplace_;
        _maxSupply = totalSupply_;
        _launchTimestamp = block.timestamp;
        _tradingEnabled = false;

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, creator_);
        _grantRole(MARKETPLACE_ROLE, marketplace_);
        _grantRole(FACTORY_ROLE, msg.sender);

        // Don't mint initially - tokens will be minted as needed during bonding curve phase
        // _mint(marketplace_, totalSupply_);

        emit MetadataUpdated(metadataURI_);
    }

    /**
     * @notice Get token metadata URI
     * @return The IPFS URI containing token metadata
     */
    function metadataURI() external view override returns (string memory) {
        return _metadataURI;
    }

    /**
     * @notice Get token creator address
     * @return The address of the token creator
     */
    function creator() external view override returns (address) {
        return _creator;
    }

    /**
     * @notice Get marketplace contract address
     * @return The address of the associated marketplace
     */
    function marketplace() external view override returns (address) {
        return _marketplace;
    }

    /**
     * @notice Check if trading is enabled
     * @return True if trading is enabled
     */
    function tradingEnabled() external view override returns (bool) {
        return _tradingEnabled;
    }

    /**
     * @notice Get token launch timestamp
     * @return The timestamp when token was launched
     */
    function launchTimestamp() external view override returns (uint256) {
        return _launchTimestamp;
    }

    /**
     * @notice Get maximum supply
     * @return The maximum supply of tokens
     */
    function maxSupply() external view returns (uint256) {
        return _maxSupply;
    }

    /**
     * @notice Enable trading (only marketplace can call)
     * @dev Called when liquidity threshold is reached
     */
    function enableTrading() external override onlyRole(MARKETPLACE_ROLE) {
        _tradingEnabled = true;
        emit TradingEnabled(block.timestamp);
    }

    /**
     * @notice Mint tokens (only marketplace can call during bonding curve phase)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external override onlyRole(MARKETPLACE_ROLE) {
        if (totalSupply() + amount > _maxSupply) {
            revert ExceedsMaxSupply();
        }
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens (only marketplace can call)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external override onlyRole(MARKETPLACE_ROLE) {
        if (balanceOf(from) < amount) {
            revert InsufficientBalance();
        }
        _burn(from, amount);
    }

    /**
     * @notice Update metadata URI (only creator can call)
     * @param newMetadataURI New IPFS metadata URI
     */
    function updateMetadataURI(string calldata newMetadataURI) external {
        if (msg.sender != _creator) {
            revert OnlyCreator();
        }
        _metadataURI = newMetadataURI;
        emit MetadataUpdated(newMetadataURI);
    }

    /**
     * @notice Pause contract (only admin)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract (only admin)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Override update to check trading status
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        // Allow minting/burning and marketplace operations
        if (from == address(0) || to == address(0) || 
            from == _marketplace || to == _marketplace) {
            super._update(from, to, amount);
            return;
        }

        // Check if trading is enabled for regular transfers
        if (!_tradingEnabled) {
            revert TradingNotEnabled();
        }

        super._update(from, to, amount);
    }

    /**
     * @notice Check if contract supports interface
     * @param interfaceId Interface identifier
     * @return True if interface is supported
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
