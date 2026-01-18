// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title ProxyFactory
 * @notice Simple factory for deploying proxies
 */
contract ProxyFactory {
    event ProxyDeployed(address indexed proxy, address indexed implementation);

    function deployProxy(address implementation, bytes calldata data) external returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, data);
        emit ProxyDeployed(address(proxy), implementation);
        return address(proxy);
    }
}
