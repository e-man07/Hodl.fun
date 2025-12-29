import { Module } from '@nestjs/common';

/**
 * Domain Module
 *
 * Contains pure business logic entities, value objects, and domain events
 * No framework dependencies (NestJS-agnostic)
 */
@Module({
  providers: [],
  exports: [],
})
export class DomainModule {}
