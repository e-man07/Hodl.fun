import { Module } from '@nestjs/common';
import { PrismaModule } from '@hodlfun/database';
import { CleanupProcessor } from './cleanup.processor';
import { CleanupScheduler } from './cleanup.scheduler';
import { PartitionManagerService } from './partition-manager.service';

@Module({
  imports: [PrismaModule],
  providers: [CleanupProcessor, CleanupScheduler, PartitionManagerService],
  exports: [PartitionManagerService],
})
export class CleanupModule {}
