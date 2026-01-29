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
var PubSubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSubService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let PubSubService = PubSubService_1 = class PubSubService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(PubSubService_1.name);
        this.handlers = new Map();
        const redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
        this.publisher = new ioredis_1.default(redisUrl);
        this.subscriber = new ioredis_1.default(redisUrl);
        this.subscriber.on('message', (channel, message) => {
            const handler = this.handlers.get(channel);
            if (handler) {
                try {
                    const parsed = JSON.parse(message);
                    handler(parsed);
                }
                catch (error) {
                    this.logger.error(`Error processing message on channel ${channel}: ${error}`);
                }
            }
        });
        this.subscriber.on('error', (error) => {
            this.logger.error(`PubSub subscriber error: ${error.message}`);
        });
        this.publisher.on('error', (error) => {
            this.logger.error(`PubSub publisher error: ${error.message}`);
        });
    }
    async publish(channel, message) {
        const serialized = JSON.stringify(message);
        await this.publisher.publish(channel, serialized);
        this.logger.debug(`Published message to channel: ${channel}`);
    }
    async subscribe(channel, handler) {
        this.handlers.set(channel, handler);
        await this.subscriber.subscribe(channel);
        this.logger.log(`Subscribed to channel: ${channel}`);
    }
    async unsubscribe(channel) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
        this.logger.log(`Unsubscribed from channel: ${channel}`);
    }
    async onModuleDestroy() {
        await this.publisher.quit();
        await this.subscriber.quit();
        this.logger.log('PubSub connections closed');
    }
};
exports.PubSubService = PubSubService;
exports.PubSubService = PubSubService = PubSubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PubSubService);
//# sourceMappingURL=pubsub.service.js.map