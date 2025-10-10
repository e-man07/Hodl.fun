// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/TokenFactory.sol";
import "../src/TokenMarketplace.sol";

/**
 * @title DeployScript
 * @dev Deployment script for the token launchpad system
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get fee collector address from environment or use deployer
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);
        
        console.log("Deploying contracts with deployer:", deployer);
        console.log("Fee collector:", feeCollector);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy marketplace first (with temporary factory address)
        TokenMarketplace marketplace = new TokenMarketplace(feeCollector, address(0));
        console.log("TokenMarketplace deployed at:", address(marketplace));
        
        // Deploy factory with marketplace address
        TokenFactory factory = new TokenFactory(address(marketplace), feeCollector);
        console.log("TokenFactory deployed at:", address(factory));
        
        // Update marketplace with factory address
        marketplace.updateTokenFactory(address(factory));
        console.log("Marketplace updated with factory address");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Fee Collector:", feeCollector);
        console.log("TokenMarketplace:", address(marketplace));
        console.log("TokenFactory:", address(factory));
        console.log("========================\n");
        
        // Save deployment addresses to file
        _saveDeploymentAddresses(address(marketplace), address(factory), feeCollector);
    }
    
    function _saveDeploymentAddresses(
        address marketplace,
        address factory,
        address feeCollector
    ) internal {
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "marketplace": "', vm.toString(marketplace), '",\n',
            '  "factory": "', vm.toString(factory), '",\n',
            '  "feeCollector": "', vm.toString(feeCollector), '",\n',
            '  "deployedAt": ', vm.toString(block.timestamp), '\n',
            '}'
        ));
        
        string memory filename = string(abi.encodePacked(
            "deployments/",
            vm.toString(block.chainid),
            ".json"
        ));
        
        vm.writeFile(filename, json);
        console.log("Deployment addresses saved to:", filename);
    }
}
