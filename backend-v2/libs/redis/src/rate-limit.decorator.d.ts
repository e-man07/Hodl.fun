export declare const RATE_LIMIT_KEY = "rateLimit";
export interface RateLimitOptions {
    limit: number;
    window?: number;
    keyPrefix?: string;
}
export declare const RateLimit: (limit: number, window?: number, keyPrefix?: string) => import("@nestjs/common").CustomDecorator<string>;
export declare const RateLimits: {
    Auth: () => import("@nestjs/common").CustomDecorator<string>;
    Read: () => import("@nestjs/common").CustomDecorator<string>;
    Write: () => import("@nestjs/common").CustomDecorator<string>;
    Burst: () => import("@nestjs/common").CustomDecorator<string>;
    Strict: () => import("@nestjs/common").CustomDecorator<string>;
};
