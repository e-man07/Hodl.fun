import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { contractsConfig, CONTRACT_ADDRESSES_KEY } from './addresses.config';
import { CoreContractService } from './services/core-contract.service';
import { FactoryContractService } from './services/factory-contract.service';
import { BondingCurveContractService } from './services/bonding-curve-contract.service';
import { TransactionBuilderService } from './services/transaction-builder.service';
import { FeeVaultContractService } from './services/fee-vault-contract.service';
import { WPUSHContractService } from './services/wpush-contract.service';
import { UniswapV3PoolService } from './services/uniswap-v3-pool.service';

/**
 * ContractsModule
 *
 * Provides smart contract configuration and services.
 * Exports contract addresses and ABI access across the application.
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(contractsConfig)],
  providers: [
    {
      provide: CONTRACT_ADDRESSES_KEY,
      useFactory: () => contractsConfig()[CONTRACT_ADDRESSES_KEY],
    },
    CoreContractService,
    FactoryContractService,
    BondingCurveContractService,
    TransactionBuilderService,
    FeeVaultContractService,
    WPUSHContractService,
    UniswapV3PoolService,
  ],
  exports: [
    CONTRACT_ADDRESSES_KEY,
    CoreContractService,
    FactoryContractService,
    BondingCurveContractService,
    TransactionBuilderService,
    FeeVaultContractService,
    WPUSHContractService,
    UniswapV3PoolService,
  ],
})
export class ContractsModule {}
