// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/FeeVault.sol";
import "../src/Core.sol";
import "../src/BondingCurveFactory.sol";
import "../src/interfaces/IBondingCurveFactory.sol";

/**
 * @title DeployProxies
 * @notice Deploy proxy contracts after implementations
 */
contract DeployProxiesScript is Script {
    // Pre-deployed implementations
    address public constant FEEVAULT_IMPL = 0x54CbE40b5D5aD96fE0349fac5eD56111fF5e17E9;
    address public constant CORE_IMPL = 0x47E98A5060D6b364EA9251d543cCC52B9b372C70;
    address public constant FACTORY_IMPL = 0x660527254D8087d1C5e234683F71c5ef177eDEb7;

    address public constant WPUSH = 0x8c0F8f803D4E10a6D8fE62925bd4FAf7c6fD0C27;
    address public constant DEX_FACTORY = 0x0000000000000000000000000000000000000000;

    // Configuration parameters
    uint256 public constant DEPLOY_FEE = 0.01 ether;
    uint256 public constant LISTING_FEE = 0.1 ether;
    uint256 public constant VIRTUAL_NATIVE = 1 ether;
    uint256 public constant VIRTUAL_TOKEN = 50_000_000 * 10**18;
    uint256 public constant GRADUATION_MARKET_CAP = 1_000_000 ether;
    uint8 public constant FEE_DENOMINATOR = 100;
    uint16 public constant FEE_NUMERATOR = 1;
    uint24 public constant DEX_FEE = 3000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Proxy Deployment Script");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy FeeVault proxy
        console.log("[1/3] Deploying FeeVault proxy...");
        bytes memory feeVaultInitData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            WPUSH,
            "Bonding Curve Fee Vault",
            "BCFV",
            address(0), // Core (will be set later)
            deployer
        );
        ERC1967Proxy feeVaultProxy = new ERC1967Proxy(FEEVAULT_IMPL, feeVaultInitData);
        console.log("[OK] FeeVault proxy:", address(feeVaultProxy));

        // 2. Deploy Core proxy
        console.log("\n[2/3] Deploying Core proxy...");
        bytes memory coreInitData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // Factory (will be set later)
            deployer
        );
        ERC1967Proxy coreProxy = new ERC1967Proxy(CORE_IMPL, coreInitData);
        console.log("[OK] Core proxy:", address(coreProxy));

        // 3. Deploy BondingCurveFactory proxy
        console.log("\n[3/3] Deploying BondingCurveFactory proxy...");
        IBondingCurveFactory.InitializeParams memory initParams = IBondingCurveFactory.InitializeParams({
            owner: deployer,
            core: address(coreProxy),
            deployFee: DEPLOY_FEE,
            listingFee: LISTING_FEE,
            virtualNative: VIRTUAL_NATIVE,
            virtualToken: VIRTUAL_TOKEN,
            graduationMarketCap: GRADUATION_MARKET_CAP,
            feeDenominator: FEE_DENOMINATOR,
            feeNumerator: FEE_NUMERATOR,
            dexFactory: DEX_FACTORY,
            dexFee: DEX_FEE
        });
        bytes memory factoryInitData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            initParams
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(FACTORY_IMPL, factoryInitData);
        console.log("[OK] Factory proxy:", address(factoryProxy));

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("Proxy Deployment Complete!");
        console.log("========================================");
        console.log("\n[Proxy Addresses]:");
        console.log("FeeVault Proxy:         ", address(feeVaultProxy));
        console.log("Core Proxy:             ", address(coreProxy));
        console.log("Factory Proxy:          ", address(factoryProxy));

        console.log("\n[Next Steps]:");
        console.log("1. Link Core to Factory");
        console.log("2. Link FeeVault to Core");
        console.log("3. Record all contract addresses");
        console.log("========================================");
    }
}
