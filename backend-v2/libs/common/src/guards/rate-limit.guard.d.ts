import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '@hodlfun/redis';
export interface RateLimitConfig {
    limit: number;
    window: number;
    keyPrefix?: string;
}
export declare class RateLimitGuard implements CanActivate {
    private readonly redis;
    private readonly reflector;
    constructor(redis: RedisService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
