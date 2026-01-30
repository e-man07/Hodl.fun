import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EventProcessorService } from './event-processor.service';

@Module({
  imports: [BlockchainModule],
  providers: [EventProcessorService],
})
export class EventProcessorModule {}
