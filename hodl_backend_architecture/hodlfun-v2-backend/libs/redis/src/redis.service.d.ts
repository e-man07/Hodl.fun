import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class RedisService extends Redis implements OnModuleDestroy {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
}
