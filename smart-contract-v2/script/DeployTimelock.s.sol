// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title DeployTimelockScript
 * @notice Deploys the TimelockController for admin operations
 * @dev This timelock will become the admin of Core, Factory, and FeeVault
 *
 * Architecture:
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  Multi-sig  │────▶│  Timelock   │────▶│  Contracts  │
 * │ (Proposer)  │     │  (48hr)     │     │             │
 * └─────────────┘     └─────────────┘     └─────────────┘
 *
 * Roles:
 * - PROPOSER_ROLE: Multi-sig (can propose and cancel operations)
 * - EXECUTOR_ROLE: Multi-sig OR address(0) for anyone to execute
 * - TIMELOCK_ADMIN_ROLE: Timelock itself (self-administered)
 */
contract DeployTimelockScript is Script {
    // Timelock delay: 48 hours for standard operations
    uint256 public constant MIN_DELAY = 48 hours;

    // For testnet, use shorter delay for testing
    uint256 public constant TESTNET_MIN_DELAY = 1 hours;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Multi-sig address - UPDATE THIS before mainnet deployment
        // For testnet, we'll use the deployer as proposer
        address multisig = vm.envOr("MULTISIG_ADDRESS", deployer);

        // Use testnet delay or mainnet delay based on environment
        bool isTestnet = vm.envOr("IS_TESTNET", true);
        uint256 minDelay = isTestnet ? TESTNET_MIN_DELAY : MIN_DELAY;

        console.log("========================================");
        console.log("Timelock Deployment Script");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Multi-sig/Proposer:", multisig);
        console.log("Min Delay:", minDelay, "seconds");
        console.log("Is Testnet:", isTestnet);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Setup proposers array (multi-sig can propose)
        address[] memory proposers = new address[](1);
        proposers[0] = multisig;

        // Setup executors array
        // address(0) means anyone can execute after delay
        // This is safer - if multi-sig is compromised, community can still execute
        address[] memory executors = new address[](1);
        executors[0] = address(0); // Anyone can execute

        // Deploy TimelockController
        // Admin is set to address(0) - timelock is self-administered
        // This is the most secure setup
        TimelockController timelock = new TimelockController(
            minDelay,
            proposers,
            executors,
            address(0) // No additional admin - fully self-administered
        );

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("Deployment Complete!");
        console.log("========================================");
        console.log("TimelockController:", address(timelock));
        console.log("\nRoles:");
        console.log("- PROPOSER_ROLE:", multisig);
        console.log("- EXECUTOR_ROLE: Anyone (address(0))");
        console.log("- TIMELOCK_ADMIN_ROLE: Self-administered");
        console.log("\nMin Delay:", minDelay / 3600, "hours");

        console.log("\n========================================");
        console.log("Next Steps:");
        console.log("========================================");
        console.log("1. Run TransferAdminToTimelock.s.sol to transfer admin roles");
        console.log("2. Verify the timelock on block explorer");
        console.log("3. Test a timelocked operation");
        console.log("\nIMPORTANT: After transferring admin roles,");
        console.log("all admin operations must go through the timelock!");
        console.log("========================================");
    }
}
