# Hodl.fun V2 - Monitoring & Alerting

## Table of Contents
1. [Overview](#overview)
2. [Monitoring Architecture](#monitoring-architecture)
3. [Metrics Collection](#metrics-collection)
4. [Application Metrics](#application-metrics)
5. [Infrastructure Metrics](#infrastructure-metrics)
6. [Log Management](#log-management)
7. [Alerting Strategy](#alerting-strategy)
8. [Dashboards](#dashboards)
9. [Incident Response](#incident-response)
10. [Cost Monitoring](#cost-monitoring)

---

## Overview

### Monitoring Goals

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONITORING GOALS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. AVAILABILITY
   - Know immediately when services are down
   - Track uptime SLOs

2. PERFORMANCE
   - Monitor latency, throughput
   - Identify bottlenecks

3. ERRORS
   - Detect error spikes
   - Root cause analysis

4. CAPACITY
   - Resource utilization
   - Scaling triggers

5. BUSINESS
   - Trading volume
   - Active users
   - Token creation rate
```

---

## Monitoring Architecture

### Monitoring Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONITORING ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   DASHBOARDS    │
                              │                 │
                              │ - Cloud Console │
                              │ - Grafana       │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD MONITORING                                     │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Metrics   │  │    Logs     │  │   Traces    │  │   Alerts    │       │
│   │   Storage   │  │   Storage   │  │   Storage   │  │   Engine    │       │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│          │                │                │                │              │
└──────────┼────────────────┼────────────────┼────────────────┼──────────────┘
           │                │                │                │
           │                │                │                │
┌──────────┼────────────────┼────────────────┼────────────────┼──────────────┐
│          ▼                ▼                ▼                │              │
│   ┌─────────────────────────────────────────────────────┐   │              │
│   │                    GKE CLUSTER                      │   │              │
│   │                                                     │   │              │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │   │              │
│   │  │   API   │  │   WS    │  │ Indexer │  │ Worker │ │   │              │
│   │  │         │  │         │  │         │  │        │ │   │              │
│   │  │ metrics │  │ metrics │  │ metrics │  │metrics │ │   │              │
│   │  │  logs   │  │  logs   │  │  logs   │  │ logs   │ │   │              │
│   │  └─────────┘  └─────────┘  └─────────┘  └────────┘ │   │              │
│   │                                                     │   │              │
│   └─────────────────────────────────────────────────────┘   │              │
│                                                             │              │
│          ┌─────────────────┐  ┌─────────────────┐          │              │
│          │    Cloud SQL    │  │   Memorystore   │          │              │
│          │    (metrics)    │  │    (metrics)    │          │              │
│          └─────────────────┘  └─────────────────┘          │              │
│                                                             │              │
│                           GCP                               │              │
└─────────────────────────────────────────────────────────────┼──────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────┐
                                                    │  NOTIFICATION   │
                                                    │    CHANNELS     │
                                                    │                 │
                                                    │ - Slack         │
                                                    │ - PagerDuty     │
                                                    │ - Email         │
                                                    └─────────────────┘
```

### GCP Services Used

| Service | Purpose |
|---------|---------|
| Cloud Monitoring | Metrics collection & storage |
| Cloud Logging | Log aggregation & search |
| Cloud Trace | Distributed tracing |
| Cloud Alerting | Alert policies & notifications |
| Cloud Profiler | Performance profiling |

---

## Metrics Collection

### GKE Metrics (Automatic)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GKE AUTO-COLLECTED METRICS                                │
└─────────────────────────────────────────────────────────────────────────────┘

CONTAINER METRICS
═══════════════════════════════════════════════════════════════════════════════

kubernetes.io/container/cpu/core_usage_time
kubernetes.io/container/memory/used_bytes
kubernetes.io/container/restart_count
kubernetes.io/container/uptime


POD METRICS
═══════════════════════════════════════════════════════════════════════════════

kubernetes.io/pod/network/received_bytes_count
kubernetes.io/pod/network/sent_bytes_count
kubernetes.io/pod/volume/used_bytes


NODE METRICS
═══════════════════════════════════════════════════════════════════════════════

kubernetes.io/node/cpu/allocatable_utilization
kubernetes.io/node/memory/allocatable_utilization
kubernetes.io/node/pid/used
```

### Custom Application Metrics

```typescript
// src/common/metrics/metrics.service.ts

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  
  // HTTP Request metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  
  // Business metrics
  public readonly tradesTotal: Counter;
  public readonly tokensCreatedTotal: Counter;
  public readonly activeWebsocketConnections: Gauge;
  
  // Queue metrics
  public readonly queueJobsProcessed: Counter;
  public readonly queueJobDuration: Histogram;
  public readonly queueDepth: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // ═══════════════════════════════════════════════════════════════════════
    // HTTP METRICS
    // ═══════════════════════════════════════════════════════════════════════
    
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // BUSINESS METRICS
    // ═══════════════════════════════════════════════════════════════════════
    
    this.tradesTotal = new Counter({
      name: 'trades_total',
      help: 'Total number of trades processed',
      labelNames: ['type', 'status'],  // type: buy/sell, status: success/failed
      registers: [this.registry],
    });
    
    this.tokensCreatedTotal = new Counter({
      name: 'tokens_created_total',
      help: 'Total number of tokens created',
      labelNames: ['status'],
      registers: [this.registry],
    });
    
    this.activeWebsocketConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      labelNames: ['pod'],
      registers: [this.registry],
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // QUEUE METRICS
    // ═══════════════════════════════════════════════════════════════════════
    
    this.queueJobsProcessed = new Counter({
      name: 'queue_jobs_processed_total',
      help: 'Total number of queue jobs processed',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });
    
    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Queue job processing duration',
      labelNames: ['queue'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
      registers: [this.registry],
    });
    
    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Current queue depth',
      labelNames: ['queue', 'state'],  // state: waiting/active/delayed
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### Metrics Endpoint

```typescript
// src/common/metrics/metrics.controller.ts

import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }
}
```

### Metrics Interceptor

```typescript
// src/common/interceptors/metrics.interceptor.ts

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const method = request.method;
        const path = request.route?.path || request.path;
        const status = response.statusCode;
        
        this.metricsService.httpRequestsTotal.inc({ method, path, status });
        this.metricsService.httpRequestDuration.observe({ method, path, status }, duration);
      }),
    );
  }
}
```

---

## Application Metrics

### Key Application Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION METRICS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

API SERVICE
═══════════════════════════════════════════════════════════════════════════════

Metric                          Labels                  Type
─────────────────────────────────────────────────────────────────────────────
http_requests_total             method, path, status    Counter
http_request_duration_seconds   method, path, status    Histogram
auth_attempts_total             status (success/fail)   Counter
rate_limit_hits_total           endpoint               Counter


WEBSOCKET SERVICE
═══════════════════════════════════════════════════════════════════════════════

Metric                          Labels                  Type
─────────────────────────────────────────────────────────────────────────────
websocket_connections_active    pod                    Gauge
websocket_messages_received     type                   Counter
websocket_messages_sent         type                   Counter
websocket_connection_duration   -                      Histogram


INDEXER SERVICE
═══════════════════════════════════════════════════════════════════════════════

Metric                          Labels                  Type
─────────────────────────────────────────────────────────────────────────────
blocks_processed_total          -                      Counter
trades_indexed_total            type (buy/sell)        Counter
indexer_lag_blocks              -                      Gauge
indexer_processing_duration     -                      Histogram


WORKER SERVICE
═══════════════════════════════════════════════════════════════════════════════

Metric                          Labels                  Type
─────────────────────────────────────────────────────────────────────────────
queue_jobs_processed_total      queue, status          Counter
queue_job_duration_seconds      queue                  Histogram
queue_depth                     queue, state           Gauge


BUSINESS METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Labels                  Type
─────────────────────────────────────────────────────────────────────────────
trades_total                    type, status           Counter
trade_volume_eth                type                   Counter
tokens_created_total            -                      Counter
tokens_graduated_total          -                      Counter
active_users_daily              -                      Gauge
```

### Recording in Code

```typescript
// In TradesService
async recordTrade(trade: Trade) {
  // Save trade...
  
  // Record metric
  this.metricsService.tradesTotal.inc({
    type: trade.type,  // 'buy' or 'sell'
    status: 'success',
  });
}

// In IndexerService
async processBlock(block: Block) {
  const startTime = Date.now();
  
  // Process block...
  
  // Record metrics
  this.metricsService.blocksProcessedTotal.inc();
  this.metricsService.indexerProcessingDuration.observe(
    (Date.now() - startTime) / 1000
  );
  
  // Record lag
  const currentBlock = await this.getCurrentBlock();
  this.metricsService.indexerLagBlocks.set(currentBlock - block.number);
}

// In WebSocketGateway
handleConnection(client: Socket) {
  this.metricsService.activeWebsocketConnections.inc({ pod: process.env.POD_NAME });
}

handleDisconnect(client: Socket) {
  this.metricsService.activeWebsocketConnections.dec({ pod: process.env.POD_NAME });
}
```

---

## Infrastructure Metrics

### Cloud SQL Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUD SQL METRICS                                         │
└─────────────────────────────────────────────────────────────────────────────┘

METRIC                                    ALERT THRESHOLD
═══════════════════════════════════════════════════════════════════════════════

cloudsql.googleapis.com/database/
  cpu/utilization                         > 80% for 5 min
  memory/utilization                      > 90% for 5 min
  disk/utilization                        > 80%
  
  postgresql/num_backends                 > 180 (of 200 max)
  
  network/received_bytes_count            Anomaly detection
  network/sent_bytes_count                Anomaly detection
  
  replication/replica_lag                 > 5 seconds (HA)
```

### Memorystore (Redis) Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORYSTORE METRICS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

METRIC                                    ALERT THRESHOLD
═══════════════════════════════════════════════════════════════════════════════

redis.googleapis.com/stats/
  memory/usage_ratio                      > 80%
  memory/system_memory_usage_ratio        > 90%
  
  connected_clients                       > 90% of max
  rejected_connections_count              > 0
  
  keyspace_hits / (hits + misses)         < 80% (cache hit ratio)
  
  evicted_keys                            > 0 (sustained)
```

### GKE Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GKE CLUSTER METRICS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

METRIC                                    ALERT THRESHOLD
═══════════════════════════════════════════════════════════════════════════════

kubernetes.io/container/
  cpu/limit_utilization                   > 80% sustained
  memory/limit_utilization                > 85% sustained
  restart_count                           > 3 in 5 min

kubernetes.io/pod/
  network/received_bytes_count            Anomaly detection

Custom:
  kube_deployment_status_replicas_unavailable  > 0 for 5 min
```

---

## Log Management

### Structured Logging

```typescript
// src/common/logger/logger.service.ts

import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class LoggerService implements NestLoggerService {
  private formatMessage(level: string, message: string, context?: string, meta?: any) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      ...meta,
      // Include trace info if available
      traceId: meta?.traceId,
      spanId: meta?.spanId,
    });
  }

  log(message: string, context?: string, meta?: any) {
    console.log(this.formatMessage('info', message, context, meta));
  }

  error(message: string, trace?: string, context?: string, meta?: any) {
    console.error(this.formatMessage('error', message, context, { ...meta, trace }));
  }

  warn(message: string, context?: string, meta?: any) {
    console.warn(this.formatMessage('warn', message, context, meta));
  }

  debug(message: string, context?: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context, meta));
    }
  }
}
```

### Log Format

```json
{
  "timestamp": "2024-01-25T10:30:45.123Z",
  "level": "info",
  "message": "Trade processed successfully",
  "context": "IndexerService",
  "traceId": "abc123xyz",
  "tokenAddress": "0x123...",
  "tradeType": "buy",
  "amount": "1.5",
  "processingTime": 45
}
```

### Log-Based Metrics

```yaml
# Cloud Logging → Metrics

# Count errors by service
filter: severity="ERROR"
metric: error_count
labels:
  - service: jsonPayload.context

# Count 5xx responses
filter: httpRequest.status >= 500
metric: http_5xx_count

# Slow queries
filter: jsonPayload.message =~ "slow query" AND jsonPayload.duration > 1000
metric: slow_query_count
```

### Log Retention

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Application logs | 30 days | Cloud Logging |
| Audit logs | 365 days | Cloud Logging + BigQuery |
| Access logs | 30 days | Cloud Logging |
| Error logs | 90 days | Cloud Logging |

---

## Alerting Strategy

### Alert Severity Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALERT SEVERITY LEVELS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

P1 - CRITICAL (Page immediately)
═══════════════════════════════════════════════════════════════════════════════
- Service completely down
- Data loss occurring
- Security breach
- Error rate > 50%

Response: Immediate (< 5 min)
Notification: PagerDuty + Slack + SMS


P2 - HIGH (Page during business hours)
═══════════════════════════════════════════════════════════════════════════════
- Service degraded
- Error rate > 10%
- Latency > 5x normal
- Database near capacity

Response: Within 30 minutes
Notification: Slack + Email


P3 - MEDIUM (Next business day)
═══════════════════════════════════════════════════════════════════════════════
- Performance degradation
- Non-critical errors increasing
- Resource utilization > 80%

Response: Within 24 hours
Notification: Slack


P4 - LOW (Track in backlog)
═══════════════════════════════════════════════════════════════════════════════
- Minor issues
- Optimization opportunities
- Informational

Response: Next sprint
Notification: Email digest
```

### Alert Policies

```yaml
# terraform/monitoring/alerts.tf

# ═══════════════════════════════════════════════════════════════════════════
# P1 ALERTS - CRITICAL
# ═══════════════════════════════════════════════════════════════════════════

# Service Down
resource "google_monitoring_alert_policy" "service_down" {
  display_name = "P1: API Service Down"
  combiner     = "OR"
  
  conditions {
    display_name = "API not responding"
    
    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND metric.type=\"kubernetes.io/container/restart_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "300s"
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_DELTA"
      }
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.pagerduty.name,
    google_monitoring_notification_channel.slack_critical.name,
  ]
  
  alert_strategy {
    auto_close = "604800s"  # 7 days
  }
}

# High Error Rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "P1: High Error Rate (>50%)"
  combiner     = "OR"
  
  conditions {
    display_name = "Error rate > 50%"
    
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/http_requests_total\" AND metric.labels.status >= 500"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.5  # 50%
      duration        = "300s"
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.pagerduty.name,
    google_monitoring_notification_channel.slack_critical.name,
  ]
}


# ═══════════════════════════════════════════════════════════════════════════
# P2 ALERTS - HIGH
# ═══════════════════════════════════════════════════════════════════════════

# Database High CPU
resource "google_monitoring_alert_policy" "db_high_cpu" {
  display_name = "P2: Database CPU > 80%"
  combiner     = "OR"
  
  conditions {
    display_name = "Cloud SQL CPU utilization"
    
    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.slack_alerts.name,
    google_monitoring_notification_channel.email.name,
  ]
}

# High Latency
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "P2: API Latency > 2s (p99)"
  combiner     = "OR"
  
  conditions {
    display_name = "Request latency"
    
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/http_request_duration_seconds\""
      comparison      = "COMPARISON_GT"
      threshold_value = 2
      duration        = "300s"
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.slack_alerts.name,
  ]
}


# ═══════════════════════════════════════════════════════════════════════════
# P3 ALERTS - MEDIUM
# ═══════════════════════════════════════════════════════════════════════════

# Redis Memory High
resource "google_monitoring_alert_policy" "redis_memory" {
  display_name = "P3: Redis Memory > 80%"
  combiner     = "OR"
  
  conditions {
    display_name = "Redis memory utilization"
    
    condition_threshold {
      filter          = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "600s"
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.slack_alerts.name,
  ]
}

# Indexer Lag
resource "google_monitoring_alert_policy" "indexer_lag" {
  display_name = "P3: Indexer Lag > 100 blocks"
  combiner     = "OR"
  
  conditions {
    display_name = "Indexer block lag"
    
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/indexer_lag_blocks\""
      comparison      = "COMPARISON_GT"
      threshold_value = 100
      duration        = "300s"
    }
  }
  
  notification_channels = [
    google_monitoring_notification_channel.slack_alerts.name,
  ]
}


# ═══════════════════════════════════════════════════════════════════════════
# NOTIFICATION CHANNELS
# ═══════════════════════════════════════════════════════════════════════════

resource "google_monitoring_notification_channel" "slack_critical" {
  display_name = "Slack Critical"
  type         = "slack"
  
  labels = {
    channel_name = "#hodlfun-critical"
  }
  
  sensitive_labels {
    auth_token = var.slack_webhook_token
  }
}

resource "google_monitoring_notification_channel" "slack_alerts" {
  display_name = "Slack Alerts"
  type         = "slack"
  
  labels = {
    channel_name = "#hodlfun-alerts"
  }
}

resource "google_monitoring_notification_channel" "pagerduty" {
  display_name = "PagerDuty"
  type         = "pagerduty"
  
  labels = {
    service_key = var.pagerduty_service_key
  }
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "Email"
  type         = "email"
  
  labels = {
    email_address = "oncall@hodlfun.io"
  }
}
```

### Alert Summary

| Alert | Threshold | Severity | Notification |
|-------|-----------|----------|--------------|
| Service Down | Pods failing | P1 | PagerDuty + Slack |
| Error Rate > 50% | 5 min | P1 | PagerDuty + Slack |
| Error Rate > 10% | 5 min | P2 | Slack + Email |
| DB CPU > 80% | 5 min | P2 | Slack |
| Latency p99 > 2s | 5 min | P2 | Slack |
| Redis Memory > 80% | 10 min | P3 | Slack |
| Indexer Lag > 100 | 5 min | P3 | Slack |
| Disk > 80% | Any | P3 | Slack |

---

## Dashboards

### Main Dashboard Panels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HODL.FUN OPERATIONS DASHBOARD                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│  │    SERVICE HEALTH       │  │    REQUEST RATE         │                  │
│  │                         │  │                         │                  │
│  │  API:     ● Healthy     │  │    ▄▄▄█████▄▄▄▄▄       │                  │
│  │  WS:      ● Healthy     │  │    150 req/s            │                  │
│  │  Indexer: ● Healthy     │  │                         │                  │
│  │  Worker:  ● Healthy     │  │                         │                  │
│  └─────────────────────────┘  └─────────────────────────┘                  │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│  │    ERROR RATE           │  │    LATENCY (p99)        │                  │
│  │                         │  │                         │                  │
│  │    ░░░░░░░░░░           │  │    ▄▄▄▄▄▄▄▄▄▄          │                  │
│  │    0.1%                 │  │    125ms                │                  │
│  │                         │  │                         │                  │
│  └─────────────────────────┘  └─────────────────────────┘                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │    DATABASE METRICS                                                  │   │
│  │                                                                      │   │
│  │    CPU: ██████░░░░ 60%    Memory: ███████░░░ 70%                    │   │
│  │    Connections: 45/200    Disk: █████░░░░░ 50%                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │    REDIS METRICS                                                     │   │
│  │                                                                      │   │
│  │    Memory: █████░░░░░ 50%    Hit Rate: 95%                          │   │
│  │    Connections: 25           Operations: 5000/s                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │    BUSINESS METRICS (24h)                                            │   │
│  │                                                                      │   │
│  │    Trades: 15,234    Volume: 1,234 ETH    New Tokens: 45            │   │
│  │    Active Users: 2,345    WS Connections: 892                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dashboard JSON (Cloud Monitoring)

```json
{
  "displayName": "Hodl.fun Operations",
  "gridLayout": {
    "columns": "2",
    "widgets": [
      {
        "title": "Request Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "metric.type=\"custom.googleapis.com/http_requests_total\""
              }
            }
          }]
        }
      },
      {
        "title": "Error Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "metric.type=\"custom.googleapis.com/http_requests_total\" AND metric.labels.status >= 500"
              }
            }
          }]
        }
      },
      {
        "title": "Latency p99",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "metric.type=\"custom.googleapis.com/http_request_duration_seconds\"",
                "aggregation": {
                  "perSeriesAligner": "ALIGN_PERCENTILE_99"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Database CPU",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
              }
            }
          }]
        }
      }
    ]
  }
}
```

---

## Incident Response

### Incident Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCIDENT RESPONSE WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

1. DETECTION
═══════════════════════════════════════════════════════════════════════════════
   - Alert fires
   - Customer report
   - Monitoring check

   → Acknowledge alert within 5 minutes (P1/P2)


2. TRIAGE
═══════════════════════════════════════════════════════════════════════════════
   - Assess severity
   - Identify affected services
   - Check for related alerts

   → Assign severity level
   → Create incident channel (#incident-YYYY-MM-DD)


3. INVESTIGATE
═══════════════════════════════════════════════════════════════════════════════
   - Check dashboards
   - Review logs
   - Check recent deployments
   - Check infrastructure changes

   → Identify root cause or hypothesis


4. MITIGATE
═══════════════════════════════════════════════════════════════════════════════
   - Apply immediate fix
   - Rollback if deployment-related
   - Scale up if capacity-related
   - Failover if hardware-related

   → Service restored


5. RESOLVE
═══════════════════════════════════════════════════════════════════════════════
   - Verify fix is stable
   - Clear alert
   - Update status page
   - Notify stakeholders

   → Incident closed


6. POST-MORTEM (P1/P2 only)
═══════════════════════════════════════════════════════════════════════════════
   - Document timeline
   - Root cause analysis
   - Action items
   - Prevention measures

   → Blameless post-mortem document
```

### Runbooks

```markdown
# Runbook: High Error Rate

## Symptoms
- Error rate > 10% alert
- 5xx responses in logs
- User complaints

## Quick Check
1. Check recent deployments: `kubectl rollout history deployment/api-deployment`
2. Check pod status: `kubectl get pods -n hodlfun`
3. Check logs: `kubectl logs -l app=api -n hodlfun --tail=100`

## Common Causes & Fixes

### Recent Deployment
```bash
# Rollback to previous version
kubectl rollout undo deployment/api-deployment -n hodlfun
```

### Database Connection Issues
```bash
# Check Cloud SQL status in console
# Verify connection count
kubectl exec -it deployment/api-deployment -- env | grep DB
```

### Memory Issues
```bash
# Check memory usage
kubectl top pods -n hodlfun
# Restart pods if needed
kubectl rollout restart deployment/api-deployment -n hodlfun
```

## Escalation
- If not resolved in 15 minutes: Page on-call
- If database related: Check Cloud SQL runbook
```

---

## Cost Monitoring

### Cost Alerts

```terraform
# Budget alert for GCP spending

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "Hodl.fun Monthly Budget"
  
  amount {
    specified_amount {
      currency_code = "USD"
      units         = "1000"  # $1000/month
    }
  }
  
  threshold_rules {
    threshold_percent = 0.5  # 50%
    spend_basis       = "CURRENT_SPEND"
  }
  
  threshold_rules {
    threshold_percent = 0.8  # 80%
    spend_basis       = "CURRENT_SPEND"
  }
  
  threshold_rules {
    threshold_percent = 1.0  # 100%
    spend_basis       = "CURRENT_SPEND"
  }
  
  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.id,
    ]
    disable_default_iam_recipients = false
  }
}
```

### Cost Breakdown Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MONTHLY COST BREAKDOWN                                    │
└─────────────────────────────────────────────────────────────────────────────┘

SERVICE                          MONTHLY COST      % OF TOTAL
═══════════════════════════════════════════════════════════════════════════════

GKE Autopilot                    $250             35%
Cloud SQL (HA)                   $200             28%
Memorystore Redis                $175             25%
Cloud Storage                    $5               1%
Cloud Load Balancing             $20              3%
Cloud Monitoring                 $25              4%
Network Egress                   $25              4%
─────────────────────────────────────────────────────────────────────────────
TOTAL                            ~$700/month      100%

Note: Cloudflare (free tier) not included
```

---

## Summary

### Monitoring Stack

| Component | Purpose |
|-----------|---------|
| Cloud Monitoring | Metrics collection |
| Cloud Logging | Log aggregation |
| Cloud Alerting | Alert policies |
| Prometheus format | Custom metrics |

### Key Metrics

| Category | Metrics |
|----------|---------|
| Availability | Uptime, error rate, health checks |
| Performance | Latency p50/p95/p99, throughput |
| Resources | CPU, memory, disk, connections |
| Business | Trades, users, volume |

### Alert Channels

| Severity | Channel |
|----------|---------|
| P1 Critical | PagerDuty + Slack |
| P2 High | Slack + Email |
| P3 Medium | Slack |
| P4 Low | Email digest |

### Files to Create

| File | Purpose |
|------|---------|
| `src/common/metrics/metrics.service.ts` | Prometheus metrics |
| `src/common/metrics/metrics.controller.ts` | /metrics endpoint |
| `src/common/interceptors/metrics.interceptor.ts` | HTTP metrics |
| `terraform/monitoring/alerts.tf` | Alert policies |
| `terraform/monitoring/dashboards.tf` | Dashboards |
| `docs/runbooks/*.md` | Incident runbooks |
