// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./FeeVault.sol";

/**
 * @title DeployFeeVaultProxyV3
 * @notice Helper to deploy corrected FeeVault proxy with production WPUSH
 */
contract DeployFeeVaultProxyV3 {
    function deploy(
        address implementation,
        address wpush,
        address core,
        address admin
    ) external returns (address) {
        // Encode the initialize call data
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,string,string,address,address)",
            wpush,
            "Bonding Curve Fee Vault",
            "BCFV",
            core,
            admin
        );

        // Deploy proxy with initialization
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, data);
        return address(proxy);
    }
}
