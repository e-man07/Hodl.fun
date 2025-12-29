import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Database Module
 *
 * Provides global access to Prisma service
 * All modules can inject PrismaService
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
