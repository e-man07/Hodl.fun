// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/Core.sol";
import "../src/BondingCurveFactory.sol";
import "../src/FeeVault.sol";
import "../src/WPUSH.sol";

/**
 * @title DeployFresh
 * @notice Fresh deployment of all contracts with proper initialization
 *
 * Deployment order (handling circular dependencies):
 * 1. WPUSH (standalone)
 * 2. FeeVault impl (no constructor args)
 * 3. FeeVault proxy (initialize with placeholder core, admin can update)
 * 4. Core impl (needs WPUSH, FeeVault proxy)
 * 5. Core proxy (initialize)
 * 6. Factory impl (needs WPUSH)
 * 7. Factory proxy (initialize with Core proxy)
 * 8. Configure: Set factory on Core, grant roles on FeeVault
 */
contract DeployFresh is Script {
    // Uniswap V3 Factory on Push Chain (or zero if not deployed yet)
    address constant DEX_FACTORY = address(0);

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Fresh Deployment Script ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy WPUSH
        console.log("1. Deploying WPUSH...");
        WPUSH wpush = new WPUSH();
        console.log("   WPUSH:", address(wpush));

        // 2. Deploy FeeVault implementation
        console.log("2. Deploying FeeVault implementation...");
        FeeVault feeVaultImpl = new FeeVault();
        console.log("   FeeVault Impl:", address(feeVaultImpl));

        // 3. Deploy FeeVault proxy with deployer as temporary core
        console.log("3. Deploying FeeVault proxy...");
        bytes memory feeVaultInitData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            address(wpush),           // asset (WPUSH)
            "Hodl.fun Fee Vault",     // name
            "hfFEE",                  // symbol
            deployer,                 // core (temporary, will grant role to real Core)
            deployer                  // admin
        );
        ERC1967Proxy feeVaultProxy = new ERC1967Proxy(address(feeVaultImpl), feeVaultInitData);
        console.log("   FeeVault Proxy:", address(feeVaultProxy));

        // 4. Deploy Core implementation
        console.log("4. Deploying Core implementation...");
        Core coreImpl = new Core(address(wpush), address(feeVaultProxy));
        console.log("   Core Impl:", address(coreImpl));

        // 5. Deploy Core proxy
        console.log("5. Deploying Core proxy...");
        bytes memory coreInitData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // factory - set later
            deployer    // owner
        );
        ERC1967Proxy coreProxy = new ERC1967Proxy(address(coreImpl), coreInitData);
        console.log("   Core Proxy:", address(coreProxy));

        // 6. Deploy Factory implementation
        console.log("6. Deploying BondingCurveFactory implementation...");
        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wpush));
        console.log("   Factory Impl:", address(factoryImpl));

        // 7. Deploy Factory proxy
        console.log("7. Deploying BondingCurveFactory proxy...");
        IBondingCurveFactory.InitializeParams memory factoryParams = IBondingCurveFactory.InitializeParams({
            owner: deployer,
            core: address(coreProxy),
            dexFactory: DEX_FACTORY,
            deployFee: 0.01 ether,          // 0.01 PUSH to deploy
            listingFee: 0.1 ether,          // 0.1 PUSH listing fee
            virtualNative: 1 ether,         // 1 PUSH virtual reserve
            virtualToken: 50_000_000 ether, // 50M tokens virtual reserve
            graduationMarketCap: 1000 ether, // 1000 PUSH market cap for graduation
            feeDenominator: 100,
            feeNumerator: 1,                // 1% fee
            dexFee: 3000                    // 0.3% Uniswap fee tier
        });

        bytes memory factoryInitData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            factoryParams
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(address(factoryImpl), factoryInitData);
        console.log("   Factory Proxy:", address(factoryProxy));

        // 8. Configure Core with Factory
        console.log("8. Setting Factory on Core...");
        Core(payable(address(coreProxy))).setFactory(address(factoryProxy));
        console.log("   Factory set");

        // 9. Grant CORE_ROLE to actual Core on FeeVault
        console.log("9. Granting CORE_ROLE on FeeVault...");
        bytes32 CORE_ROLE = keccak256("CORE_ROLE");
        FeeVault(address(feeVaultProxy)).grantRole(CORE_ROLE, address(coreProxy));
        console.log("   CORE_ROLE granted to Core");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("========================================");
        console.log("");
        console.log("WPUSH:         ", address(wpush));
        console.log("FeeVault Proxy:", address(feeVaultProxy));
        console.log("Core Proxy:    ", address(coreProxy));
        console.log("Factory Proxy: ", address(factoryProxy));
        console.log("");
        console.log("Update your .env and frontend config with these addresses!");
    }
}
