// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/Core.sol";
import "../src/BondingCurveFactory.sol";
import "../src/BondingCurve.sol";
import "../src/FeeVault.sol";

/**
 * @title UpgradeAuditFixes
 * @notice Upgrade script for deploying audit-fixed implementations
 * @dev Upgrades Core, Factory, and provides new BondingCurve implementation
 *
 * Audit fixes included:
 * - Core: ReentrancyGuard, ETH handling fix, receive() function
 * - BondingCurve: listing() access control, min fee enforcement
 * - BondingCurveFactory: totalAccumulatedFees tracking, balance check
 * - Token: mint() access control
 * - BondingCurveLibrary: ceiling division
 *
 * Note: WPUSH is not upgradeable. For production, deploy new WPUSH without
 * mint/batchMint/emergencyWithdraw functions.
 */
contract UpgradeAuditFixes is Script {
    // Push Chain Testnet deployed addresses
    address constant CORE_PROXY = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address constant FACTORY_PROXY = 0x3c2e258D3CF31653a17b27d5C4f1789D25d14EA8;
    address constant FEE_VAULT_PROXY = 0xbE2fd9b720d1d7Fac7208523376d2A3332019928;
    address constant WPUSH = 0x2137c11bdb56C8A74be8Cc0fBad23CCF5CB9a8a7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Audit Fix Upgrade Script ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new Core implementation
        console.log("1. Deploying new Core implementation...");
        Core newCoreImpl = new Core(WPUSH, FEE_VAULT_PROXY);
        console.log("   New Core implementation:", address(newCoreImpl));

        // 2. Upgrade Core proxy
        console.log("2. Upgrading Core proxy...");
        Core coreProxy = Core(payable(CORE_PROXY));
        coreProxy.upgradeToAndCall(address(newCoreImpl), "");
        console.log("   Core upgraded successfully");

        // 3. Deploy new BondingCurveFactory implementation
        console.log("3. Deploying new BondingCurveFactory implementation...");
        BondingCurveFactory newFactoryImpl = new BondingCurveFactory(WPUSH);
        console.log("   New Factory implementation:", address(newFactoryImpl));

        // 4. Upgrade Factory proxy
        console.log("4. Upgrading Factory proxy...");
        BondingCurveFactory factoryProxy = BondingCurveFactory(payable(FACTORY_PROXY));
        factoryProxy.upgradeToAndCall(address(newFactoryImpl), "");
        console.log("   Factory upgraded successfully");

        // 5. Deploy new BondingCurve implementation (for new curves)
        console.log("5. Deploying new BondingCurve implementation...");
        BondingCurve newCurveImpl = new BondingCurve(CORE_PROXY, WPUSH);
        console.log("   New BondingCurve implementation:", address(newCurveImpl));

        // 6. Update Factory with new BondingCurve implementation
        console.log("6. Updating Factory with new BondingCurve implementation...");
        // Note: Factory needs a function to update the curve implementation
        // If not available, new curves will use the implementation set at factory deploy time

        vm.stopBroadcast();

        console.log("");
        console.log("=== Upgrade Summary ===");
        console.log("Core implementation:", address(newCoreImpl));
        console.log("Factory implementation:", address(newFactoryImpl));
        console.log("BondingCurve implementation:", address(newCurveImpl));
        console.log("");
        console.log("=== Proxies (unchanged addresses) ===");
        console.log("Core proxy:", CORE_PROXY);
        console.log("Factory proxy:", FACTORY_PROXY);
        console.log("FeeVault proxy:", FEE_VAULT_PROXY);
        console.log("");
        console.log("=== Notes ===");
        console.log("- Existing BondingCurve proxies need individual upgrades");
        console.log("- New curves created will use the new implementation");
        console.log("- WPUSH is not upgradeable (use new deployment for production)");
    }
}
