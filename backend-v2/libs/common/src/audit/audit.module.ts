import { Module, Global, DynamicModule } from '@nestjs/common';
import { AuditService, PRISMA_SERVICE } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

/**
 * Module providing audit logging functionality.
 *
 * This module requires a PrismaService to be provided.
 * Use forRoot() or forRootAsync() to configure the module.
 *
 * @example
 * ```typescript
 * // Import in your AppModule
 * import { PrismaService } from '@hodlfun/database';
 *
 * @Module({
 *   imports: [
 *     AuditModule.forRoot(PrismaService),
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use in controllers
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   @Audit(AuditAction.AUTH_LOGIN)
 *   async login() {
 *     // The AuditInterceptor will automatically log this action
 *   }
 * }
 * ```
 */
@Global()
@Module({})
export class AuditModule {
  /**
   * Configure the AuditModule with a PrismaService class.
   *
   * @param prismaService - The PrismaService class to use
   * @returns The configured module
   */
  static forRoot(prismaService: new (...args: unknown[]) => unknown): DynamicModule {
    return {
      module: AuditModule,
      providers: [
        {
          provide: PRISMA_SERVICE,
          useExisting: prismaService,
        },
        AuditService,
        AuditInterceptor,
      ],
      exports: [AuditService, AuditInterceptor],
    };
  }

  /**
   * Configure the AuditModule with an existing PrismaService instance.
   *
   * @param prismaService - The PrismaService instance to use
   * @returns The configured module
   */
  static forRootWithInstance(prismaService: unknown): DynamicModule {
    return {
      module: AuditModule,
      providers: [
        {
          provide: PRISMA_SERVICE,
          useValue: prismaService,
        },
        AuditService,
        AuditInterceptor,
      ],
      exports: [AuditService, AuditInterceptor],
    };
  }
}
