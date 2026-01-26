# =============================================================================
# Cloud Monitoring Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# NOTIFICATION CHANNELS
# -----------------------------------------------------------------------------

resource "google_monitoring_notification_channel" "email" {
  display_name = "Hodl.fun Team Email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_notification_channel" "slack" {
  count        = var.slack_webhook_url != "" ? 1 : 0
  display_name = "Hodl.fun Slack"
  type         = "slack"

  labels = {
    channel_name = "#hodlfun-alerts"
  }

  sensitive_labels {
    auth_token = var.slack_webhook_url
  }
}

locals {
  notification_channels = concat(
    [google_monitoring_notification_channel.email.id],
    var.slack_webhook_url != "" ? [google_monitoring_notification_channel.slack[0].id] : []
  )
}

# -----------------------------------------------------------------------------
# HIGH SEVERITY ALERTS (Critical - Page immediately)
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "service_down" {
  display_name = "Hodlfun - Service Down"
  combiner     = "OR"

  conditions {
    display_name = "API pods unhealthy"

    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hodlfun\" AND resource.labels.container_name=\"api\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_COUNT"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  conditions {
    display_name = "Indexer pods unhealthy"

    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hodlfun\" AND resource.labels.container_name=\"indexer\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_COUNT"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "604800s" # 7 days
  }

  documentation {
    content   = "One or more critical services are down. Check GKE workloads immediately."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "Hodlfun - High Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "5xx error rate > 5%"

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

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s" # 1 day
  }
}

resource "google_monitoring_alert_policy" "indexer_lag_critical" {
  display_name = "Hodlfun - Indexer Block Lag Critical"
  combiner     = "OR"

  conditions {
    display_name = "Indexer lag > 500 blocks"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/hodlfun_indexer_block_lag/gauge\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 500

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

# -----------------------------------------------------------------------------
# MEDIUM SEVERITY ALERTS (Warning - Notify during business hours)
# -----------------------------------------------------------------------------

resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "Hodlfun - High API Latency"
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

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "database_connections" {
  display_name = "Hodlfun - Database Connection Pool High"
  combiner     = "OR"

  conditions {
    display_name = "Active connections > 80% of max"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 80

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "redis_memory" {
  display_name = "Hodlfun - Redis Memory High"
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

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "indexer_lag_warning" {
  display_name = "Hodlfun - Indexer Block Lag Warning"
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

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

resource "google_monitoring_alert_policy" "queue_backlog" {
  display_name = "Hodlfun - Queue Backlog High"
  combiner     = "OR"

  conditions {
    display_name = "Queue depth > 1000 jobs"

    condition_threshold {
      filter          = "metric.type=\"prometheus.googleapis.com/hodlfun_queue_depth/gauge\""
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1000

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}

# -----------------------------------------------------------------------------
# LOG-BASED METRICS
# -----------------------------------------------------------------------------

resource "google_logging_metric" "auth_failures" {
  name   = "hodlfun/auth_failures"
  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hodlfun\" AND jsonPayload.message=~\"authentication failed|Invalid signature|Unauthorized\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "service"
      value_type  = "STRING"
      description = "Service that logged the auth failure"
    }
  }

  label_extractors = {
    "service" = "EXTRACT(resource.labels.container_name)"
  }
}

resource "google_logging_metric" "trade_errors" {
  name   = "hodlfun/trade_errors"
  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hodlfun\" AND severity>=ERROR AND jsonPayload.message=~\"trade|Trade\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_logging_metric" "indexer_errors" {
  name   = "hodlfun/indexer_errors"
  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hodlfun\" AND resource.labels.container_name=\"indexer\" AND severity>=ERROR"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# Alert on auth failures spike
resource "google_monitoring_alert_policy" "auth_failures_spike" {
  display_name = "Hodlfun - Auth Failures Spike"
  combiner     = "OR"

  conditions {
    display_name = "Auth failures > 100 in 5 minutes"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/hodlfun/auth_failures\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 100

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }

  documentation {
    content   = "High number of authentication failures detected. Possible brute force attack."
    mime_type = "text/markdown"
  }
}

# -----------------------------------------------------------------------------
# UPTIME CHECKS
# -----------------------------------------------------------------------------

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "Hodlfun API Health Check"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/v1/health/ready"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "api.hodl.fun"
    }
  }

  content_matchers {
    content = "ok"
    matcher = "CONTAINS_STRING"
  }
}

resource "google_monitoring_alert_policy" "uptime_check_failed" {
  display_name = "Hodlfun - Uptime Check Failed"
  combiner     = "OR"

  conditions {
    display_name = "API uptime check failing"

    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.labels.check_id=\"${google_monitoring_uptime_check_config.api_health.uptime_check_id}\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_FRACTION_TRUE"
        cross_series_reducer = "REDUCE_MIN"
        group_by_fields      = ["resource.label.host"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.notification_channels

  alert_strategy {
    auto_close = "86400s"
  }
}
