import { Counter, Histogram, Gauge, Registry } from 'prom-client';
export declare class MetricsService {
    private readonly registry;
    readonly httpRequestsTotal: Counter;
    readonly httpRequestDuration: Histogram;
    readonly tradesTotal: Counter;
    readonly tokensCreatedTotal: Counter;
    readonly activeWebsocketConnections: Gauge;
    readonly tradingVolume: Counter;
    readonly queueJobsProcessed: Counter;
    readonly queueJobDuration: Histogram;
    readonly queueDepth: Gauge;
    readonly indexerBlockLag: Gauge;
    readonly indexerEventsProcessed: Counter;
    constructor();
    getMetrics(): Promise<string>;
    getRegistry(): Registry;
}
