// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFeeVault.sol";

/**
 * @title FeeVault
 * @notice Upgradeable ERC4626 vault for fee collection and yield generation
 * @dev Uses UUPS upgradeable pattern
 */
contract FeeVault is IFeeVault, Initializable, ERC4626Upgradeable, UUPSUpgradeable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;

    /// @notice Role for core contract
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    /// @notice Core contract address
    address public core;

    /// @notice Custom errors
    error OnlyCore();
    error InvalidAddress();

    /// @notice Disable initializers in implementation
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the vault
     * @param asset_ Underlying asset (wrapped native token)
     * @param name_ Vault name
     * @param symbol_ Vault symbol
     * @param core_ Core contract address
     * @param admin Admin address
     */
    function initialize(
        address asset_,
        string memory name_,
        string memory symbol_,
        address core_,
        address admin
    ) external initializer {
        if (asset_ == address(0) || core_ == address(0) || admin == address(0)) {
            revert InvalidAddress();
        }

        __ERC4626_init(IERC20Metadata(asset_));
        __ERC20_init(name_, symbol_);
        __UUPSUpgradeable_init();
        __AccessControl_init();

        core = core_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CORE_ROLE, core_);
    }

    /**
     * @notice Deposit fees into vault
     * @param amount Amount to deposit
     */
    function depositFees(uint256 amount) external override onlyRole(CORE_ROLE) {
        IERC20 asset = IERC20(asset());
        asset.safeTransferFrom(msg.sender, address(this), amount);
        // Fees are now in vault and can generate yield via ERC4626
    }

    /**
     * @notice Set core address (only admin, can be called after deployment)
     * @param _core Core contract address
     */
    function setCore(address _core) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_core == address(0)) {
            revert InvalidAddress();
        }
        address oldCore = core;
        core = _core;
        if (oldCore != address(0)) {
            _revokeRole(CORE_ROLE, oldCore);
        }
        _grantRole(CORE_ROLE, _core);
    }

    /**
     * @notice Authorize upgrade (only admin)
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

