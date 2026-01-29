# Phase 10: Monitoring & Observability

## Objective
Configure Cloud Monitoring, custom metrics, alerting, and dashboards.

## Prerequisites
- Phase 4-9 completed (all services deployed)

## Duration: 2-3 days

---

## 10.1 Custom Application Metrics

### Metrics Service

```typescript
// libs/common/src/metrics/metrics.service.ts
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

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

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
      help: 'Total trading volume in PUSH',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // ═══════════════════════════════════════════════════════════════════════
    // QUEUE METRICS
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // INDEXER METRICS
    // ═══════════════════════════════════════════════════════════════════════
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
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### Metrics Endpoint

```typescript
// apps/api/src/metrics/metrics.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from '@libs/common';

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

---

## 10.2 Cloud Monitoring Configuration

### Managed Prometheus (GKE)

GKE Autopilot with managed Prometheus automatically collects metrics from `/metrics` endpoints.

```yaml
# k8s/base/api/pod-monitoring.yaml
apiVersion: monitoring.googleapis.com/v1
kind: PodMonitoring
metadata:
  name: api-monitoring
  namespace: hodlfun
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
    - port: 3000
      path: /metrics
      interval: 30s
```

---

## 10.3 Alerting Policies

### Terraform Alert Policies

```hcl
# terraform/monitoring.tf

# ═══════════════════════════════════════════════════════════════════════════
# NOTIFICATION CHANNELS
# ═══════════════════════════════════════════════════════════════════════════

resource "google_monitoring_notification_channel" "slack" {
  display_name = "Hodl.fun Slack"
  type         = "slack"

  labels = {
    channel_name = "#hodlfun-alerts"
  }

  sensitive_labels {
    auth_token = var.slack_webhook_token
  }
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "Hodl.fun Team Email"
  type         = "email"

  labels = {
    email_address = "team@hodlfun.io"
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# HIGH SEVERITY ALERTS (Page immediately)
# ═══════════════════════════════════════════════════════════════════════════

resource "google_monitoring_alert_policy" "service_down" {
  display_name = "Service Down"
  combiner     = "OR"

  conditions {
    display_name = "API Service Down"

    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND resource.labels.container_name=\"api\" AND metric.type=\"kubernetes.io/container/uptime\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_COUNT"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
    google_monitoring_notification_channel.email.id,
  ]

  alert_strategy {
    auto_close = "604800s"  # 7 days
  }
}

resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate (5xx)"
  combiner     = "OR"

  conditions {
    display_name = "Error rate > 5%"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/http_requests_total/counter\" AND metric.labels.status=~\"5..\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
  ]
}

resource "google_monitoring_alert_policy" "indexer_lag" {
  display_name = "Indexer Block Lag High"
  combiner     = "OR"

  conditions {
    display_name = "Indexer lag > 100 blocks"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/hodlfun_indexer_block_lag/gauge\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 100

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
  ]
}

# ═══════════════════════════════════════════════════════════════════════════
# MEDIUM SEVERITY ALERTS (Notify during business hours)
# ═══════════════════════════════════════════════════════════════════════════

resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "High API Latency"
  combiner     = "OR"

  conditions {
    display_name = "P95 latency > 2s"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/http_request_duration_seconds/histogram\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
  ]
}

resource "google_monitoring_alert_policy" "database_connections" {
  display_name = "Database Connection Pool Exhaustion"
  combiner     = "OR"

  conditions {
    display_name = "Active connections > 80% of max"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 80  # Assuming max 100

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
  ]
}

resource "google_monitoring_alert_policy" "redis_memory" {
  display_name = "Redis Memory High"
  combiner     = "OR"

  conditions {
    display_name = "Redis memory > 80%"

    condition_threshold {
      filter          = "resource.type=\"redis_instance\" AND metric.type=\"redis.googleapis.com/stats/memory/usage_ratio\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.slack.id,
  ]
}
```

---

## 10.4 Dashboards

### Grafana Dashboard JSON (or Cloud Monitoring)

```json
{
  "title": "Hodl.fun Backend Overview",
  "rows": [
    {
      "title": "Service Health",
      "panels": [
        {
          "title": "API Pods Running",
          "type": "stat",
          "targets": [{ "expr": "count(up{app=\"api\"})" }]
        },
        {
          "title": "WebSocket Connections",
          "type": "stat",
          "targets": [{ "expr": "sum(hodlfun_websocket_connections_active)" }]
        },
        {
          "title": "Indexer Block Lag",
          "type": "stat",
          "targets": [{ "expr": "hodlfun_indexer_block_lag" }]
        }
      ]
    },
    {
      "title": "API Performance",
      "panels": [
        {
          "title": "Request Rate",
          "type": "graph",
          "targets": [{ "expr": "rate(http_requests_total[5m])" }]
        },
        {
          "title": "Latency P95",
          "type": "graph",
          "targets": [{ "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))" }]
        },
        {
          "title": "Error Rate",
          "type": "graph",
          "targets": [{ "expr": "rate(http_requests_total{status=~\"5..\"}[5m])" }]
        }
      ]
    },
    {
      "title": "Business Metrics",
      "panels": [
        {
          "title": "Trades per Minute",
          "type": "graph",
          "targets": [{ "expr": "rate(hodlfun_trades_total[1m]) * 60" }]
        },
        {
          "title": "Trading Volume (24h)",
          "type": "stat",
          "targets": [{ "expr": "increase(hodlfun_trading_volume_push[24h])" }]
        },
        {
          "title": "Tokens Created (24h)",
          "type": "stat",
          "targets": [{ "expr": "increase(hodlfun_tokens_created_total[24h])" }]
        }
      ]
    },
    {
      "title": "Infrastructure",
      "panels": [
        {
          "title": "Database Connections",
          "type": "graph",
          "targets": [{ "expr": "cloudsql_database_postgresql_num_backends" }]
        },
        {
          "title": "Redis Memory Usage",
          "type": "graph",
          "targets": [{ "expr": "redis_memory_usage_ratio * 100" }]
        },
        {
          "title": "Queue Depth",
          "type": "graph",
          "targets": [{ "expr": "hodlfun_queue_depth" }]
        }
      ]
    }
  ]
}
```

---

## 10.5 Log-Based Metrics

```hcl
# terraform/log-metrics.tf

resource "google_logging_metric" "auth_failures" {
  name   = "auth_failures"
  filter = "resource.type=\"k8s_container\" AND jsonPayload.message=~\"authentication failed\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "trade_errors" {
  name   = "trade_errors"
  filter = "resource.type=\"k8s_container\" AND jsonPayload.level=\"error\" AND jsonPayload.context=~\"trade\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}
```

---

## 10.6 Verification Checklist

- [ ] Prometheus metrics exposed on /metrics
- [ ] PodMonitoring resources deployed
- [ ] Metrics visible in Cloud Monitoring
- [ ] Alert policies created
- [ ] Notification channels configured
- [ ] Dashboards created
- [ ] Log-based metrics working
- [ ] Test alerts by triggering conditions

## Testing Commands

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Verify PodMonitoring
kubectl get podmonitoring -n hodlfun

# List alert policies
gcloud alpha monitoring policies list

# Check notification channels
gcloud alpha monitoring channels list

# View logs
gcloud logging read 'resource.type="k8s_container" AND resource.labels.namespace_name="hodlfun"' --limit 50
```

## Next Phase
Proceed to **Phase 11: Production** for final security hardening and go-live.
