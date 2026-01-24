// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/Core.sol";
import "../src/BondingCurveFactory.sol";
import "../src/FeeVault.sol";

/**
 * @title TransferAdminToTimelockScript
 * @notice Transfers admin roles from deployer to TimelockController
 * @dev This script should be run AFTER deploying the TimelockController
 *
 * IMPORTANT: This is a one-way operation!
 * After running this script, all admin operations must go through the timelock.
 *
 * Role Structure After Transfer:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      ADMIN HIERARCHY                         │
 * ├─────────────────────────────────────────────────────────────┤
 * │  TimelockController (48hr delay)                            │
 * │  └── DEFAULT_ADMIN_ROLE on Core, Factory, FeeVault          │
 * │      - Can change fees, graduation cap, DEX settings        │
 * │      - Can upgrade contracts                                 │
 * │      - Can grant/revoke other roles                         │
 * │                                                              │
 * │  Emergency Multi-sig (instant)                              │
 * │  └── PAUSER_ROLE on Core                                    │
 * │      - Can pause/unpause trading (emergency only)           │
 * └─────────────────────────────────────────────────────────────┘
 */
contract TransferAdminToTimelockScript is Script {
    // Role constants (must match the contracts)
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Contract addresses - UPDATE THESE with your deployed addresses
        address coreProxy = vm.envAddress("CORE_PROXY");
        address factoryProxy = vm.envAddress("FACTORY_PROXY");
        address feeVaultProxy = vm.envAddress("FEE_VAULT_PROXY");
        address timelockAddress = vm.envAddress("TIMELOCK_ADDRESS");

        // Emergency multi-sig for instant pause (can be same as proposer multi-sig)
        address emergencyMultisig = vm.envOr("EMERGENCY_MULTISIG", deployer);

        console.log("========================================");
        console.log("Transfer Admin to Timelock Script");
        console.log("========================================");
        console.log("Current Admin (Deployer):", deployer);
        console.log("New Admin (Timelock):", timelockAddress);
        console.log("Emergency Multi-sig:", emergencyMultisig);
        console.log("\nContracts:");
        console.log("- Core:", coreProxy);
        console.log("- Factory:", factoryProxy);
        console.log("- FeeVault:", feeVaultProxy);
        console.log("========================================\n");

        // Load contract instances
        Core core = Core(coreProxy);
        BondingCurveFactory factory = BondingCurveFactory(factoryProxy);
        FeeVault feeVault = FeeVault(payable(feeVaultProxy));

        vm.startBroadcast(deployerPrivateKey);

        // ============================================================
        //                    CORE CONTRACT
        // ============================================================
        console.log("[1/6] Transferring Core admin role to Timelock...");

        // Grant admin role to timelock
        core.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        console.log("  - Granted DEFAULT_ADMIN_ROLE to Timelock");

        // Grant PAUSER_ROLE to emergency multisig for instant pause
        // This allows instant pause/unpause without going through timelock
        core.grantRole(PAUSER_ROLE, emergencyMultisig);
        console.log("  - Granted PAUSER_ROLE to Emergency Multi-sig");

        // Revoke deployer's PAUSER_ROLE (timelock will have it via admin role)
        if (deployer != emergencyMultisig) {
            core.renounceRole(PAUSER_ROLE, deployer);
            console.log("  - Renounced deployer's PAUSER_ROLE");
        }

        // Renounce deployer's admin role
        core.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("  - Renounced deployer's DEFAULT_ADMIN_ROLE");
        console.log("  [OK] Core admin transferred\n");

        // ============================================================
        //                    FACTORY CONTRACT
        // ============================================================
        console.log("[2/6] Transferring Factory admin role to Timelock...");

        // Grant admin role to timelock
        factory.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        console.log("  - Granted DEFAULT_ADMIN_ROLE to Timelock");

        // Renounce deployer's admin role
        factory.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("  - Renounced deployer's DEFAULT_ADMIN_ROLE");
        console.log("  [OK] Factory admin transferred\n");

        // ============================================================
        //                    FEE VAULT CONTRACT
        // ============================================================
        console.log("[3/6] Transferring FeeVault admin role to Timelock...");

        // Grant admin role to timelock
        feeVault.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        console.log("  - Granted DEFAULT_ADMIN_ROLE to Timelock");

        // Renounce deployer's admin role
        feeVault.renounceRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("  - Renounced deployer's DEFAULT_ADMIN_ROLE");
        console.log("  [OK] FeeVault admin transferred\n");

        vm.stopBroadcast();

        // ============================================================
        //                    VERIFICATION
        // ============================================================
        console.log("========================================");
        console.log("Verifying Role Transfers...");
        console.log("========================================");

        // Verify Core
        bool coreTimelockAdmin = core.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        bool coreDeployerAdmin = core.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("\nCore:");
        console.log("  - Timelock has admin:", coreTimelockAdmin ? "YES" : "NO");
        console.log("  - Deployer has admin:", coreDeployerAdmin ? "YES" : "NO");
        require(coreTimelockAdmin, "Core: Timelock should have admin");
        require(!coreDeployerAdmin, "Core: Deployer should not have admin");

        // Verify Factory
        bool factoryTimelockAdmin = factory.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        bool factoryDeployerAdmin = factory.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("\nFactory:");
        console.log("  - Timelock has admin:", factoryTimelockAdmin ? "YES" : "NO");
        console.log("  - Deployer has admin:", factoryDeployerAdmin ? "YES" : "NO");
        require(factoryTimelockAdmin, "Factory: Timelock should have admin");
        require(!factoryDeployerAdmin, "Factory: Deployer should not have admin");

        // Verify FeeVault
        bool vaultTimelockAdmin = feeVault.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress);
        bool vaultDeployerAdmin = feeVault.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        console.log("\nFeeVault:");
        console.log("  - Timelock has admin:", vaultTimelockAdmin ? "YES" : "NO");
        console.log("  - Deployer has admin:", vaultDeployerAdmin ? "YES" : "NO");
        require(vaultTimelockAdmin, "FeeVault: Timelock should have admin");
        require(!vaultDeployerAdmin, "FeeVault: Deployer should not have admin");

        console.log("\n========================================");
        console.log("Transfer Complete!");
        console.log("========================================");
        console.log("\nAll admin operations now require:");
        console.log("1. Multi-sig proposes operation to Timelock");
        console.log("2. Wait 48 hours (or configured delay)");
        console.log("3. Anyone can execute after delay");
        console.log("\nEmergency pause is still instant via:");
        console.log("- Emergency Multi-sig:", emergencyMultisig);
        console.log("\n========================================");
    }
}
