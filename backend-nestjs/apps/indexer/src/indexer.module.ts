import { Module } from '@nestjs/common';
import { CoreModule } from '@core';
import { DomainModule } from '@domain';
import { ApplicationModule } from '@application';
import { InfrastructureModule } from '@infrastructure';
import { SharedModule } from '@shared';

/**
 * Indexer Module
 *
 * Blockchain event listener and indexing service
 * Polls smart contracts and updates database state
 */
@Module({
  imports: [
    CoreModule,
    DomainModule,
    ApplicationModule,
    InfrastructureModule,
    SharedModule,
  ],
  providers: [],
  exports: [],
})
export class IndexerModule {}
