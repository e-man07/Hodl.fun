// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./interfaces/IBondingCurveFactory.sol";

/**
 * @title DeployFactoryProxy
 * @notice Deploy BondingCurveFactory proxy with initialization
 */
contract DeployFactoryProxy {
    address constant FACTORY_IMPL = 0x660527254D8087d1C5e234683F71c5ef177eDEb7;
    address constant CORE_PROXY = 0x592F8f0abbB9a3d3c425980Ac0263363C8405b03;
    address constant DEPLOYER = 0x6dE3c92B58356CECfCa409F6993A592fc5B8090F;

    constructor() {
        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: DEPLOYER,
            core: CORE_PROXY,
            deployFee: 0.01 ether,
            listingFee: 0.1 ether,
            virtualNative: 1 ether,
            virtualToken: 50_000_000 * 10**18,
            graduationMarketCap: 1_000_000 ether,
            feeDenominator: 100,
            feeNumerator: 1,
            dexFactory: address(0),
            dexFee: 3000
        });

        bytes memory initData = abi.encodeWithSelector(
            bytes4(keccak256("initialize((address,address,uint256,uint256,uint256,uint256,uint8,uint16,address,uint24))")),
            params
        );

        ERC1967Proxy proxy = new ERC1967Proxy(FACTORY_IMPL, initData);
        emit ProxyDeployed(address(proxy));
    }

    event ProxyDeployed(address indexed proxy);
}
