// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/Core.sol";
import "../src/BondingCurveFactory.sol";
import "../src/BondingCurve.sol";

/**
 * @title UpgradeExactOutFix
 * @notice Upgrade script for deploying exactOutBuy fix
 * @dev Upgrades Factory to get new BondingCurve implementation with 1 wei tolerance fix
 *
 * Fix: BondingCurve.buy() and BondingCurve.sell() now allow 1 wei tolerance
 * in amount validation to handle integer division rounding errors.
 */
contract UpgradeExactOutFix is Script {
    // Fresh deployment addresses (February 1, 2026)
    address constant CORE_PROXY = 0x1C10ed77c9ec3f42d5C0346f2d18fb6bDc7A81bE;
    address constant FACTORY_PROXY = 0x7A84fBd09FFD63b135e04f0846AEc9C4A6b0412C;
    address constant FEE_VAULT_PROXY = 0xdf7E470Bedb737294A502408782353d4d1dbE590;
    address constant WPUSH = 0x2cC79864C4283e684dAe2f7Ace037598E294Ca79;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== exactOutBuy Fix Upgrade Script ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new BondingCurveFactory implementation
        // This will deploy a new BondingCurve implementation in its constructor
        console.log("1. Deploying new BondingCurveFactory implementation...");
        console.log("   (This deploys new BondingCurve impl with 1 wei tolerance fix)");
        BondingCurveFactory newFactoryImpl = new BondingCurveFactory(WPUSH);
        console.log("   New Factory implementation:", address(newFactoryImpl));
        console.log("   New BondingCurve implementation:", newFactoryImpl.bondingCurveImplementation());

        // 2. Upgrade Factory proxy
        console.log("2. Upgrading Factory proxy...");
        BondingCurveFactory factoryProxy = BondingCurveFactory(payable(FACTORY_PROXY));
        factoryProxy.upgradeToAndCall(address(newFactoryImpl), "");
        console.log("   Factory upgraded successfully");

        // Verify upgrade
        console.log("3. Verifying upgrade...");
        address newCurveImpl = BondingCurveFactory(FACTORY_PROXY).bondingCurveImplementation();
        console.log("   Factory now uses BondingCurve impl:", newCurveImpl);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Upgrade Complete ===");
        console.log("Factory proxy:", FACTORY_PROXY);
        console.log("New BondingCurve implementation:", newCurveImpl);
        console.log("");
        console.log("=== Next Steps ===");
        console.log("1. Create a new token to test exactOutBuy");
        console.log("2. New tokens will use the fixed BondingCurve implementation");
        console.log("3. Existing curves still use old implementation");
    }
}
