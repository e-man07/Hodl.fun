// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/BondingCurve.sol";

/**
 * @title UpgradeBondingCurve
 * @notice Script to deploy new BondingCurve implementation and upgrade existing proxies
 * @dev Fixes integer overflow bug in listing() sqrtPriceX96 calculation
 */
contract UpgradeBondingCurve is Script {
    // Push Chain Testnet addresses
    address constant CORE = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address constant WPUSH = 0x2137c11bdb56C8A74be8Cc0fBad23CCF5CB9a8a7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address curveProxy = vm.envAddress("CURVE_PROXY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new BondingCurve implementation with FullMath fix
        BondingCurve newImplementation = new BondingCurve(CORE, WPUSH);
        console.log("New BondingCurve implementation deployed at:", address(newImplementation));

        // Upgrade the proxy to use new implementation
        BondingCurve curve = BondingCurve(curveProxy);
        curve.upgradeTo(address(newImplementation));
        console.log("Upgraded curve proxy:", curveProxy);

        vm.stopBroadcast();
    }
}
