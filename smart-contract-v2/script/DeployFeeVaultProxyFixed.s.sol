// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployFeeVaultProxyFixed is Script {
    address constant FEEVAULT_IMPL = 0x54CbE40b5D5aD96fE0349fac5eD56111fF5e17E9;
    address constant WPUSH = 0x2137c11bdb56C8A74be8Cc0fBad23CCF5CB9a8a7;
    address constant CORE_PROXY = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address constant ADMIN = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

    function run() public {
        vm.startBroadcast();

        // Encode initialize call
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,string,string,address,address)",
            WPUSH,
            "Bonding Curve Fee Vault",
            "BCFV",
            CORE_PROXY,
            ADMIN
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(FEEVAULT_IMPL, data);

        console.log("New FeeVault Proxy deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}
