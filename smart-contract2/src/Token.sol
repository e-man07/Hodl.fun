// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IToken.sol";

/**
 * @title Token
 * @notice Upgradeable ERC20 token with minting and burning capabilities
 * @dev Uses UUPS upgradeable pattern
 */
contract Token is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IToken
{
    /// @notice Role for bonding curve to mint tokens
    bytes32 public constant BONDING_CURVE_ROLE = keccak256("BONDING_CURVE_ROLE");
    
    /// @notice Role for core contract
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    
    /// @notice Fixed total supply for all tokens
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    
    /// @notice Token metadata URI
    string private _tokenURI;
    
    /// @notice Core contract address
    address public core;
    
    /// @notice Flag to prevent multiple mints
    bool private hasMinted;

    /// @notice Custom errors
    error OnlyBondingCurve();
    error OnlyCore();
    error InvalidAddress();
    error AlreadyMinted();

    /// @notice Disable initializers in implementation
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the token
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI_ Token metadata URI
     * @param core_ Core contract address
     */
    function initialize(
        string memory name,
        string memory symbol,
        string memory tokenURI_,
        address core_
    ) external initializer {
        if (core_ == address(0)) {
            revert InvalidAddress();
        }

        __ERC20_init(name, symbol);
        __ERC20Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _tokenURI = tokenURI_;
        core = core_;

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, core_);
        _grantRole(CORE_ROLE, core_);
    }

    /**
     * @notice Mint all tokens to the bonding curve (one-time operation during initialization)
     * @param curve Bonding curve address to receive all tokens
     * @dev Can only be called once. Called by factory during token creation.
     */
    function mint(address curve) external override {
        if (hasMinted) {
            revert AlreadyMinted();
        }
        hasMinted = true;
        _mint(curve, TOTAL_SUPPLY);
    }

    /**
     * @notice Burn tokens (overrides ERC20Burnable)
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override(ERC20BurnableUpgradeable, IToken) {
        super.burn(amount);
    }

    /**
     * @notice Get token URI
     * @return uri Token metadata URI
     */
    function tokenURI() external view override returns (string memory uri) {
        return _tokenURI;
    }

    /**
     * @notice Set bonding curve address and grant BONDING_CURVE_ROLE
     * @param curve Bonding curve address
     * @dev Called by factory during token creation to grant minting rights
     */
    function setBondingCurve(address curve) external {
        if (curve == address(0)) {
            revert InvalidAddress();
        }
        _grantRole(BONDING_CURVE_ROLE, curve);
    }

    /**
     * @notice Authorize upgrade (only admin)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

