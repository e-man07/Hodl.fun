import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@hodlfun/database';

/**
 * Manages time-based partitions for the price_history table.
 * Creates new monthly partitions proactively to ensure inserts never fail.
 */
@Injectable()
export class PartitionManagerService implements OnModuleInit {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Check and create partitions on startup
    await this.ensurePartitionsExist();
  }

  /**
   * Run on the 25th of each month to create next month's partition
   */
  @Cron('0 0 25 * *')
  async handlePartitionCreation(): Promise<void> {
    this.logger.log('Running scheduled partition creation check...');
    await this.ensurePartitionsExist();
  }

  /**
   * Ensure partitions exist for the current and next 2 months
   */
  async ensurePartitionsExist(): Promise<void> {
    const now = new Date();

    // Create partitions for current month and next 2 months
    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      await this.createPartitionIfNotExists(targetDate);
    }
  }

  /**
   * Create a partition for a specific month if it doesn't exist
   */
  private async createPartitionIfNotExists(date: Date): Promise<void> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const partitionName = `price_history_${year}_${month}`;

    const startDate = new Date(year, date.getMonth(), 1);
    const endDate = new Date(year, date.getMonth() + 1, 1);

    try {
      // Check if partition exists
      const result = await this.prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = ${partitionName}
        ) as exists
      `;

      if (!result[0]?.exists) {
        // Create partition
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF price_history
          FOR VALUES FROM ('${startStr}') TO ('${endStr}')
        `);

        this.logger.log(`Created partition: ${partitionName}`);
      } else {
        this.logger.debug(`Partition ${partitionName} already exists`);
      }
    } catch (error) {
      // Partition might not exist if table isn't partitioned yet
      // This is expected for dev/test environments without the migration
      this.logger.debug(
        `Could not check/create partition ${partitionName}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get partition statistics for monitoring
   */
  async getPartitionStats(): Promise<{
    partitionCount: number;
    partitions: Array<{ name: string; rowCount: number }>;
  }> {
    try {
      const partitions = await this.prisma.$queryRaw<
        Array<{ relname: string; n_live_tup: bigint }>
      >`
        SELECT c.relname, s.n_live_tup
        FROM pg_class c
        JOIN pg_inherits i ON c.oid = i.inhrelid
        JOIN pg_stat_user_tables s ON c.relname = s.relname
        WHERE i.inhparent = 'price_history'::regclass
        ORDER BY c.relname
      `;

      return {
        partitionCount: partitions.length,
        partitions: partitions.map((p) => ({
          name: p.relname,
          rowCount: Number(p.n_live_tup),
        })),
      };
    } catch {
      // Table might not be partitioned
      return { partitionCount: 0, partitions: [] };
    }
  }
}
