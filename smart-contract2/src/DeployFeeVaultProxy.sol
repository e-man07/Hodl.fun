// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployFeeVaultProxy
 * @notice Deploy FeeVault proxy with initialization
 */
contract DeployFeeVaultProxy {
    address constant FEEVAULT_IMPL = 0x54CbE40b5D5aD96fE0349fac5eD56111fF5e17E9;
    address constant WPUSH = 0x8c0F8f803D4E10a6D8fE62925bd4FAf7c6fD0C27;
    address constant DEPLOYER = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

    constructor() {
        bytes memory initData = abi.encodeWithSignature(
            "initialize(address,string,string,address,address)",
            WPUSH,
            "Bonding Curve Fee Vault",
            "BCFV",
            address(0),
            DEPLOYER
        );

        ERC1967Proxy proxy = new ERC1967Proxy(FEEVAULT_IMPL, initData);
        emit ProxyDeployed(address(proxy));
    }

    event ProxyDeployed(address indexed proxy);
}
