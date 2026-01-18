// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployCoreProxy
 * @notice Deploy Core proxy with initialization
 */
contract DeployCoreProxy {
    address constant CORE_IMPL = 0x47E98A5060D6b364EA9251d543cCC52B9b372C70;
    address constant DEPLOYER = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

    constructor() {
        bytes memory initData = abi.encodeWithSignature(
            "initialize(address,address)",
            address(0), // factory will be set later
            DEPLOYER
        );

        ERC1967Proxy proxy = new ERC1967Proxy(CORE_IMPL, initData);
        emit ProxyDeployed(address(proxy));
    }

    event ProxyDeployed(address indexed proxy);
}
