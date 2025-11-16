// Holder balance update processor
// Updates holder balances from blockchain for accurate tracking

import { Job } from 'bull';
import { db } from '../../config/database';
import { contractService } from '../../services/contractService';
import logger from '../../utils/logger';

interface HolderUpdateJobData {
  tokenAddress?: string;
  batchUpdate?: boolean;
}

/**
 * Process holder balance update job
 */
export async function processHolderUpdate(job: Job<HolderUpdateJobData>): Promise<void> {
  const { tokenAddress, batchUpdate } = job.data;

  try {
    if (batchUpdate) {
      // Update balances for all active tokens
      logger.info('Starting batch holder balance update...');

      const activeTokens = await db.token.findMany({
        where: { tradingEnabled: true },
        select: { address: true },
        take: 50, // Process 50 tokens at a time to avoid overload
      });

      let tokensProcessed = 0;

      for (const token of activeTokens) {
        try {
          await updateHoldersForToken(token.address);
          tokensProcessed++;

          // Update progress
          await job.progress((tokensProcessed / activeTokens.length) * 100);
        } catch (error) {
          logger.error(`Failed to update holders for token ${token.address}:`, error);
        }
      }

      logger.info(`Batch holder update completed: ${tokensProcessed}/${activeTokens.length} tokens`);
    } else if (tokenAddress) {
      // Update balances for specific token
      await updateHoldersForToken(tokenAddress);
      logger.info(`Updated holders for token ${tokenAddress}`);
    } else {
      throw new Error('Either tokenAddress or batchUpdate must be specified');
    }
  } catch (error) {
    logger.error('Holder update job failed:', error);
    throw error;
  }
}

/**
 * Update all holders for a specific token
 */
async function updateHoldersForToken(tokenAddress: string): Promise<void> {
  // Get all holders from database
  const holders = await db.holder.findMany({
    where: {
      tokenAddress: tokenAddress.toLowerCase(),
    },
  });

  logger.debug(`Updating ${holders.length} holders for token ${tokenAddress}`);

  let updated = 0;
  let errors = 0;

  // Update balances in batches of 10 to avoid RPC overload
  const batchSize = 10;
  for (let i = 0; i < holders.length; i += batchSize) {
    const batch = holders.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (holder) => {
        try {
          const balance = await contractService.getTokenBalance(
            tokenAddress,
            holder.holderAddress
          );

          await db.holder.update({
            where: { id: holder.id },
            data: {
              balance: balance.toString(),
              lastUpdated: new Date(),
            },
          });

          updated++;
        } catch (error) {
          logger.error(`Failed to update balance for ${holder.holderAddress}:`, error);
          errors++;
        }
      })
    );
  }

  logger.debug(`Holder update complete for ${tokenAddress}: ${updated} updated, ${errors} errors`);
}
