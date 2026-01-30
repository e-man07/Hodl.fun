"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = RedisService_1 = class RedisService extends ioredis_1.default {
    constructor(configService) {
        const redisUrl = configService.get('REDIS_URL', 'redis://localhost:6379');
        super(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 10) {
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
            enableReadyCheck: true,
            lazyConnect: false,
        });
        this.configService = configService;
        this.logger = new common_1.Logger(RedisService_1.name);
        this.on('connect', () => {
            this.logger.log('Redis connected');
        });
        this.on('error', (error) => {
            this.logger.error(`Redis error: ${error.message}`);
        });
        this.on('ready', () => {
            this.logger.log('Redis ready');
        });
    }
    async onModuleDestroy() {
        await this.quit();
        this.logger.log('Redis connection closed');
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map