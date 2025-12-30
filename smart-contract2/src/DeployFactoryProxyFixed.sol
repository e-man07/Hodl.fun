// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployFactoryProxyFixed
 * @notice Deploy BondingCurveFactory proxy with proper initialization
 */
contract DeployFactoryProxyFixed {
    address constant FACTORY_IMPL = 0x660527254D8087d1C5e234683F71c5ef177eDEb7;
    address constant CORE_PROXY = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address constant DEPLOYER = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

    constructor() {
        // Manually encode the struct fields as tuples
        bytes memory initData = abi.encodeCall(
            this.initialize,
            (
                DEPLOYER,           // owner
                CORE_PROXY,         // core
                0.01 ether,         // deployFee
                0.1 ether,          // listingFee
                1 ether,            // virtualNative
                50_000_000 * 10**18, // virtualToken
                1_000_000 ether,    // graduationMarketCap
                100,                // feeDenominator
                1,                  // feeNumerator
                address(0),         // dexFactory
                3000                // dexFee
            )
        );

        ERC1967Proxy proxy = new ERC1967Proxy(FACTORY_IMPL, initData);
        emit ProxyDeployed(address(proxy));
    }

    // Dummy function for encoding (not called)
    function initialize(
        address owner,
        address core,
        uint256 deployFee,
        uint256 listingFee,
        uint256 virtualNative,
        uint256 virtualToken,
        uint256 graduationMarketCap,
        uint8 feeDenominator,
        uint16 feeNumerator,
        address dexFactory,
        uint24 dexFee
    ) external {}

    event ProxyDeployed(address indexed proxy);
}
