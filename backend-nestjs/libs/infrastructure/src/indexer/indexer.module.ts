import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockTrackerService } from './block-tracker.service';
import { EventParserService } from './parsers/event-parser.service';
import { IndexerService } from './indexer.service';

/**
 * IndexerModule
 *
 * Provides blockchain event indexing services:
 * - EventParserService: Parses raw logs into typed events
 * - BlockTrackerService: Tracks processed blocks
 * - IndexerService: Coordinates the indexing process
 */
@Module({
  imports: [ConfigModule],
  providers: [EventParserService, BlockTrackerService, IndexerService],
  exports: [EventParserService, BlockTrackerService, IndexerService],
})
export class IndexerModule {}
