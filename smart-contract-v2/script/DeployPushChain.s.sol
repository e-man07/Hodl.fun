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
 * @title DeployPushChainScript
 * @notice Deployment script specifically configured for Push Chain
 * @dev Push Chain Testnet: Chain ID 42101
 */
contract DeployPushChainScript is Script {
    // Push Chain Configuration
    address public constant WPUSH = address(0x4200000000000000000000000000000000000006); // TODO: Update with actual WPUSH address
    address public constant DEX_FACTORY = address(0x0000000000000000000000000000000000000000); // TODO: Deploy or find Uniswap V2 Factory
    
    // Initialization parameters (values in PUSH - 18 decimals)
    uint256 public constant DEPLOY_FEE = 2 ether; // 2 PUSH
    uint256 public constant LISTING_FEE = 100 ether; // 100 PUSH
    // Note: Token total supply is fixed at 1B tokens in Token.sol (hardcoded)
    uint256 public constant VIRTUAL_NATIVE = 30_000 ether; // 30K PUSH virtual reserve (pump.fun style)
    uint256 public constant VIRTUAL_TOKEN = 1_073_000_191 * 10**18; // ~1.073B tokens virtual reserve (pump.fun style)
    // Graduation market cap: 690K PUSH (~$69K at $0.10 per PUSH)
    // Similar to pump.fun's approach - fixed native currency threshold
    uint256 public constant GRADUATION_MARKET_CAP = 690_000 ether;
    uint8 public constant FEE_DENOMINATOR = 100;
    uint16 public constant FEE_NUMERATOR = 1; // 1% total fee
    // Fee split: 0.2% liquidity reserve, 0.3% creator, 0.5% platform
    // LP is permanently locked (burned) at graduation
    // Adaptive V3 range: 0.25x to 4x graduation price

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("========================================");
        console.log("Push Chain Deployment Script");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Network: Push Chain Testnet (42101)");
        console.log("WPUSH Address:", WPUSH);
        console.log("DEX Factory:", DEX_FACTORY);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy FeeVault implementation
        console.log("\n[1/8] Deploying FeeVault implementation...");
        FeeVault feeVaultImpl = new FeeVault();
        console.log("[OK] FeeVault implementation:", address(feeVaultImpl));

        // 2. Deploy FeeVault proxy (core will be set later)
        console.log("\n[2/8] Deploying FeeVault proxy...");
        bytes memory feeVaultInitData = abi.encodeWithSelector(
            FeeVault.initialize.selector,
            WPUSH, // Asset: WPUSH
            "Bonding Curve Fee Vault",
            "BCFV",
            address(0), // Core address (set later)
            deployer
        );
        ERC1967Proxy feeVaultProxy = new ERC1967Proxy(address(feeVaultImpl), feeVaultInitData);
        FeeVault feeVault = FeeVault(payable(address(feeVaultProxy)));
        console.log("[OK] FeeVault proxy:", address(feeVault));

        // 3. Deploy Core implementation
        console.log("\n[3/8] Deploying Core implementation...");
        Core coreImpl = new Core(WPUSH, address(feeVault));
        console.log("[OK] Core implementation:", address(coreImpl));

        // 4. Deploy Core proxy (factory will be set later)
        console.log("\n[4/8] Deploying Core proxy...");
        bytes memory coreInitData = abi.encodeWithSelector(
            Core.initialize.selector,
            address(0), // Factory address (set later)
            deployer
        );
        ERC1967Proxy coreProxy = new ERC1967Proxy(address(coreImpl), coreInitData);
        Core core = Core(payable(address(coreProxy)));
        console.log("[OK] Core proxy:", address(core));

        // 5. Deploy BondingCurveFactory implementation
        console.log("\n[5/8] Deploying BondingCurveFactory implementation...");
        BondingCurveFactory factoryImpl = new BondingCurveFactory(WPUSH);
        console.log("[OK] Factory implementation:", address(factoryImpl));

        // 6. Deploy BondingCurveFactory proxy
        console.log("\n[6/8] Deploying BondingCurveFactory proxy...");
        IBondingCurveFactory.InitializeParams memory initParams = IBondingCurveFactory.InitializeParams({
            owner: deployer,
            core: address(core),
            deployFee: DEPLOY_FEE,
            listingFee: LISTING_FEE,
            virtualNative: VIRTUAL_NATIVE,
            virtualToken: VIRTUAL_TOKEN,
            graduationMarketCap: GRADUATION_MARKET_CAP,
            feeDenominator: FEE_DENOMINATOR,
            feeNumerator: FEE_NUMERATOR,
            dexFactory: DEX_FACTORY, // Uniswap V3 Factory address
            dexFee: 3000 // 0.30% fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
        });
        bytes memory factoryInitData = abi.encodeWithSelector(
            BondingCurveFactory.initialize.selector,
            initParams
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(address(factoryImpl), factoryInitData);
        BondingCurveFactory factory = BondingCurveFactory(payable(address(factoryProxy)));
        console.log("[OK] Factory proxy:", address(factory));

        // 7. Update Core with factory address
        console.log("\n[7/8] Linking Core to Factory...");
        core.setFactory(address(factory));
        console.log("[OK] Factory set in Core");

        // 8. Update FeeVault with Core address
        console.log("\n[8/8] Linking FeeVault to Core...");
        feeVault.setCore(address(core));
        console.log("[OK] Core set in FeeVault");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("Deployment Complete!");
        console.log("========================================");
        console.log("\n[Contract Addresses]:");
        console.log("FeeVault Implementation:", address(feeVaultImpl));
        console.log("FeeVault Proxy:        ", address(feeVault));
        console.log("Core Implementation:    ", address(coreImpl));
        console.log("Core Proxy:            ", address(core));
        console.log("Factory Implementation: ", address(factoryImpl));
        console.log("Factory Proxy:         ", address(factory));
        
        console.log("\n[Next Steps]:");
        console.log("1. Verify contracts on BlockScout:");
        console.log("   https://donut.push.network");
        console.log("\n2. Update WPUSH address if different:");
        console.log("   Current:", WPUSH);
        console.log("\n3. Deploy/Update DEX Factory if needed:");
        console.log("   Current:", DEX_FACTORY);
        console.log("   If zero, deploy Uniswap V2 Factory first");
        console.log("\n4. Test contract interactions:");
        console.log("   - Create a token");
        console.log("   - Buy tokens");
        console.log("   - Sell tokens");
        console.log("   - Test fee collection");
        console.log("\n5. Monitor gas usage and optimize if needed");
        
        console.log("\n[BlockScout Links]:");
        console.log("FeeVault: https://donut.push.network/address/", address(feeVault));
        console.log("Core:     https://donut.push.network/address/", address(core));
        console.log("Factory:  https://donut.push.network/address/", address(factory));
        console.log("\n========================================");
    }
}

