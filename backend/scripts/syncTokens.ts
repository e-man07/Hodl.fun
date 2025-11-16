#!/usr/bin/env tsx
/**
 * Fast token sync script using direct RPC calls
 * Much faster than the sequential block indexer!
 */

import { syncService } from '../src/services/syncService';
import logger from '../src/utils/logger';

async function main() {
  console.log('='.repeat(60));
  console.log('Fast Token Sync via RPC');
  console.log('='.repeat(60));

  try {
    console.log('\n🚀 Starting sync...\n');
    const result = await syncService.syncAllTokens();

    console.log('\n' + '='.repeat(60));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Synced:  ${result.synced} new tokens`);
    console.log(`♻️  Updated: ${result.skipped} existing tokens`);
    console.log(`❌ Errors:  ${result.errors} failed`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error: any) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

main();
