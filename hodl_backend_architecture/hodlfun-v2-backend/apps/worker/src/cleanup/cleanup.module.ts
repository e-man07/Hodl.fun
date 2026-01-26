import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CleanupProcessor } from './cleanup.processor';
import { CleanupScheduler } from './cleanup.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'cleanup' })],
  providers: [CleanupProcessor, CleanupScheduler],
})
export class CleanupModule {}
