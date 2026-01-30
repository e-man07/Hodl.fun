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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prom_client_1 = require("prom-client");
let MetricsService = class MetricsService {
    constructor() {
        this.registry = new prom_client_1.Registry();
        this.registry.setDefaultLabels({ app: 'hodlfun' });
        (0, prom_client_1.collectDefaultMetrics)({ register: this.registry });
        this.httpRequestsTotal = new prom_client_1.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'path', 'status'],
            registers: [this.registry],
        });
        this.httpRequestDuration = new prom_client_1.Histogram({
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'path', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [this.registry],
        });
        this.tradesTotal = new prom_client_1.Counter({
            name: 'hodlfun_trades_total',
            help: 'Total number of trades processed',
            labelNames: ['type', 'status'],
            registers: [this.registry],
        });
        this.tokensCreatedTotal = new prom_client_1.Counter({
            name: 'hodlfun_tokens_created_total',
            help: 'Total number of tokens created',
            registers: [this.registry],
        });
        this.activeWebsocketConnections = new prom_client_1.Gauge({
            name: 'hodlfun_websocket_connections_active',
            help: 'Number of active WebSocket connections',
            registers: [this.registry],
        });
        this.tradingVolume = new prom_client_1.Counter({
            name: 'hodlfun_trading_volume_push',
            help: 'Total trading volume in PUSH (smallest unit)',
            labelNames: ['type'],
            registers: [this.registry],
        });
        this.queueJobsProcessed = new prom_client_1.Counter({
            name: 'hodlfun_queue_jobs_processed_total',
            help: 'Total number of queue jobs processed',
            labelNames: ['queue', 'status'],
            registers: [this.registry],
        });
        this.queueJobDuration = new prom_client_1.Histogram({
            name: 'hodlfun_queue_job_duration_seconds',
            help: 'Queue job processing duration',
            labelNames: ['queue'],
            buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
            registers: [this.registry],
        });
        this.queueDepth = new prom_client_1.Gauge({
            name: 'hodlfun_queue_depth',
            help: 'Current queue depth',
            labelNames: ['queue', 'state'],
            registers: [this.registry],
        });
        this.indexerBlockLag = new prom_client_1.Gauge({
            name: 'hodlfun_indexer_block_lag',
            help: 'Number of blocks behind chain head',
            registers: [this.registry],
        });
        this.indexerEventsProcessed = new prom_client_1.Counter({
            name: 'hodlfun_indexer_events_processed_total',
            help: 'Total number of blockchain events processed',
            labelNames: ['event_type'],
            registers: [this.registry],
        });
    }
    async getMetrics() {
        return this.registry.metrics();
    }
    getRegistry() {
        return this.registry;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map