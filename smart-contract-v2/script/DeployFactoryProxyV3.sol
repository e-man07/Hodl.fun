// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployFactoryProxyV3
 * @notice Deploy BondingCurveFactory proxy with manual encoding
 */
contract DeployFactoryProxyV3 {
    constructor() {
        address factoryImpl = 0x660527254D8087d1C5e234683F71c5ef177eDEb7;
        address coreProxy = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
        address deployer = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

        // Build the tuple encoding for InitializeParams
        bytes memory params = abi.encode(
            deployer,                   // owner
            coreProxy,                  // core
            10000000000000000,          // deployFee (0.01 ether)
            100000000000000000,         // listingFee (0.1 ether)
            1000000000000000000,        // virtualNative (1 ether)
            50000000000000000000000000, // virtualToken (50M * 10**18)
            1000000000000000000000000,  // graduationMarketCap (1M ether)
            uint8(100),                 // feeDenominator
            uint16(1),                  // feeNumerator
            address(0),                 // dexFactory
            uint24(3000)                // dexFee
        );

        // Get function selector for initialize((address,address,uint256,uint256,uint256,uint256,uint256,uint8,uint16,address,uint24))
        bytes4 selector = bytes4(keccak256("initialize((address,address,uint256,uint256,uint256,uint256,uint256,uint8,uint16,address,uint24))"));

        bytes memory initData = abi.encodePacked(selector, params);

        ERC1967Proxy proxy = new ERC1967Proxy(factoryImpl, initData);
        emit ProxyDeployed(address(proxy));
    }

    event ProxyDeployed(address indexed proxy);
}
