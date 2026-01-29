import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;

  // Business Metrics
  public readonly tradesTotal: Counter;
  public readonly tokensCreatedTotal: Counter;
  public readonly activeWebsocketConnections: Gauge;
  public readonly tradingVolume: Counter;

  // Queue Metrics
  public readonly queueJobsProcessed: Counter;
  public readonly queueJobDuration: Histogram;
  public readonly queueDepth: Gauge;

  // Indexer Metrics
  public readonly indexerBlockLag: Gauge;
  public readonly indexerEventsProcessed: Counter;

  // Alert Metrics
  public readonly alertsChecked: Counter;
  public readonly alertsTriggered: Counter;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'hodlfun' });
    collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Business Metrics
    this.tradesTotal = new Counter({
      name: 'hodlfun_trades_total',
      help: 'Total number of trades processed',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.tokensCreatedTotal = new Counter({
      name: 'hodlfun_tokens_created_total',
      help: 'Total number of tokens created',
      registers: [this.registry],
    });

    this.activeWebsocketConnections = new Gauge({
      name: 'hodlfun_websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.tradingVolume = new Counter({
      name: 'hodlfun_trading_volume_push',
      help: 'Total trading volume in PUSH (smallest unit)',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Queue Metrics
    this.queueJobsProcessed = new Counter({
      name: 'hodlfun_queue_jobs_processed_total',
      help: 'Total number of queue jobs processed',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.queueJobDuration = new Histogram({
      name: 'hodlfun_queue_job_duration_seconds',
      help: 'Queue job processing duration',
      labelNames: ['queue'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'hodlfun_queue_depth',
      help: 'Current queue depth',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
    });

    // Indexer Metrics
    this.indexerBlockLag = new Gauge({
      name: 'hodlfun_indexer_block_lag',
      help: 'Number of blocks behind chain head',
      registers: [this.registry],
    });

    this.indexerEventsProcessed = new Counter({
      name: 'hodlfun_indexer_events_processed_total',
      help: 'Total number of blockchain events processed',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    // Alert Metrics
    this.alertsChecked = new Counter({
      name: 'hodlfun_alerts_checked_total',
      help: 'Total number of alerts checked',
      labelNames: ['token'],
      registers: [this.registry],
    });

    this.alertsTriggered = new Counter({
      name: 'hodlfun_alerts_triggered_total',
      help: 'Total number of alerts triggered',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getRegistry(): Registry {
    return this.registry;
  }
}
