// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/BondingCurveFactory.sol";
import "../src/Core.sol";
import "../src/FeeVault.sol";
import "../src/Token.sol";
import "../src/BondingCurve.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployScript
 * @notice Deployment script for upgradeable bonding curve contracts
 */
contract DeployScript is Script {
    // Configuration
    address public constant WNATIVE = address(0x4200000000000000000000000000000000000006); // Update with actual WNATIVE address
    address public constant DEX_FACTORY = address(0x1234567890123456789012345678901234567890); // Update with actual DEX factory
    
    // Initialization parameters
    uint256 public constant DEPLOY_FEE = 0.01 ether;
    uint256 public constant LISTING_FEE = 0.1 ether;
    // Note: Token total supply is fixed at 100M tokens in Token.sol (hardcoded)
    uint256 public constant VIRTUAL_NATIVE = 1 ether;
    uint256 public constant VIRTUAL_TOKEN = 50_000_000 * 10**18; // 50M tokens
    uint256 public constant TARGET_TOKEN = 25_000_000 * 10**18; // 25M tokens (50% of virtual)
    uint8 public constant FEE_DENOMINATOR = 100;
    uint16 public constant FEE_NUMERATOR = 1; // 1% fee

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Deploying upgradeable bonding curve contracts...");

        // 1. Deploy FeeVault implementation
        console.log("\n1. Deploying FeeVault implementation...");
        FeeVault feeVaultImpl = new FeeVault();
        console.log("FeeVault implementation:", address(feeVaultImpl));

        // 2. Deploy FeeVault proxy
        console.log("\n2. Deploying FeeVault proxy...");
        bytes memory feeVaultInitData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            WNATIVE,
            "Bonding Curve Fee Vault",
            "BCFV",
            address(0), // Will be set after Core deployment
            deployer
        );
        ERC1967Proxy feeVaultProxy = new ERC1967Proxy(address(feeVaultImpl), feeVaultInitData);
        FeeVault feeVault = FeeVault(payable(address(feeVaultProxy)));
        console.log("FeeVault proxy:", address(feeVault));

        // 3. Deploy Core implementation
        console.log("\n3. Deploying Core implementation...");
        Core coreImpl = new Core(WNATIVE, address(feeVault));
        console.log("Core implementation:", address(coreImpl));

        // 4. Deploy Core proxy
        console.log("\n4. Deploying Core proxy...");
        bytes memory coreInitData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // Will be set after Factory deployment
            deployer
        );
        ERC1967Proxy coreProxy = new ERC1967Proxy(address(coreImpl), coreInitData);
        Core core = Core(payable(address(coreProxy)));
        console.log("Core proxy:", address(core));

        // 5. Deploy BondingCurveFactory implementation
        console.log("\n5. Deploying BondingCurveFactory implementation...");
        BondingCurveFactory factoryImpl = new BondingCurveFactory(WNATIVE);
        console.log("Factory implementation:", address(factoryImpl));

        // 6. Deploy BondingCurveFactory proxy
        console.log("\n6. Deploying BondingCurveFactory proxy...");
        IBondingCurveFactory.InitializeParams memory initParams = IBondingCurveFactory.InitializeParams({
            deployFee: DEPLOY_FEE,
            listingFee: LISTING_FEE,
            virtualNative: VIRTUAL_NATIVE,
            virtualToken: VIRTUAL_TOKEN,
            targetToken: TARGET_TOKEN,
            feeDenominator: FEE_DENOMINATOR,
            feeNumerator: FEE_NUMERATOR,
            dexFactory: DEX_FACTORY
        });
        bytes memory factoryInitData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            deployer,
            address(core),
            initParams
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(address(factoryImpl), factoryInitData);
        BondingCurveFactory factory = BondingCurveFactory(payable(address(factoryProxy)));
        console.log("Factory proxy:", address(factory));

        // 7. Update Core with factory address
        console.log("\n7. Updating Core with factory address...");
        core.setFactory(address(factory));
        console.log("Factory set in Core");
        
        // 8. Update FeeVault with Core address
        console.log("\n8. Updating FeeVault with Core address...");
        feeVault.setCore(address(core));
        console.log("Core set in FeeVault");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("FeeVault implementation:", address(feeVaultImpl));
        console.log("FeeVault proxy:", address(feeVault));
        console.log("Core implementation:", address(coreImpl));
        console.log("Core proxy:", address(core));
        console.log("Factory implementation:", address(factoryImpl));
        console.log("Factory proxy:", address(factory));
        console.log("\nNext steps:");
        console.log("1. Update Core factory address (may need setter function)");
        console.log("2. Update FeeVault core address (may need setter function)");
        console.log("3. Verify all contracts on block explorer");
        console.log("4. Test contract interactions");
    }
}

