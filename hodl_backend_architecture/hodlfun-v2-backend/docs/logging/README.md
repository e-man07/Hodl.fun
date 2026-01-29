# Centralized Logging with ELK Stack

This document describes the logging architecture for Hodl.fun backend services.

## Overview

The logging system uses:
- **JSON Logger**: Structured log output from NestJS services
- **Fluent Bit**: Log collection and forwarding
- **Elasticsearch**: Log storage and indexing
- **Kibana**: Log visualization and analysis

## Log Format

All services output logs in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "log",
  "service": "api",
  "environment": "production",
  "context": "TokensController",
  "message": "Token list requested",
  "correlationId": "abc-123-def",
  "traceId": "1234567890abcdef",
  "spanId": "abcdef123456",
  "data": {
    "page": 1,
    "limit": 20
  }
}
```

## Using the JSON Logger

### In NestJS Services

```typescript
import { JsonLoggerService } from '@hodlfun/common';

@Injectable()
export class MyService {
  private readonly logger: JsonLoggerService;

  constructor() {
    this.logger = new JsonLoggerService();
    this.logger.configure({
      serviceName: 'my-service',
      environment: process.env.NODE_ENV || 'development',
    });
    this.logger.setJsonEnabled(process.env.NODE_ENV === 'production');
  }

  doSomething() {
    this.logger.log('Processing request', { userId: '123' });
    this.logger.warn('Rate limit approaching', { remaining: 10 });
    this.logger.error('Operation failed', new Error('Database timeout'));
  }
}
```

### Global Logger Configuration

In `main.ts`:

```typescript
import { JsonLoggerService } from '@hodlfun/common';

async function bootstrap() {
  const logger = new JsonLoggerService();
  logger.configure({
    serviceName: 'api',
    environment: process.env.NODE_ENV || 'development',
    prettyPrint: process.env.NODE_ENV === 'development',
  });
  logger.setJsonEnabled(process.env.NODE_ENV === 'production');

  const app = await NestFactory.create(AppModule, { logger });
  // ...
}
```

## ELK Stack Setup

### Docker Compose (Development)

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    healthcheck:
      test: curl -s http://localhost:9200/_cluster/health | grep -q 'green\|yellow'
      interval: 30s
      timeout: 10s
      retries: 5

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      elasticsearch:
        condition: service_healthy

  fluent-bit:
    image: fluent/fluent-bit:2.2
    volumes:
      - ./fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf
      - ./fluent-bit/parsers.conf:/fluent-bit/etc/parsers.conf
      - /var/log/hodlfun:/var/log/hodlfun:ro
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### Fluent Bit Configuration

```conf
# fluent-bit/fluent-bit.conf
[SERVICE]
    Flush         5
    Daemon        Off
    Log_Level     info
    Parsers_File  parsers.conf

[INPUT]
    Name          tail
    Path          /var/log/hodlfun/*.log
    Parser        json
    Tag           hodlfun.*
    Refresh_Interval 5

[FILTER]
    Name          modify
    Match         *
    Add           cluster production
    Add           source kubernetes

[OUTPUT]
    Name          es
    Match         *
    Host          elasticsearch
    Port          9200
    Index         hodlfun-logs
    Type          _doc
    Logstash_Format On
    Logstash_Prefix hodlfun
    Suppress_Type_Name On
```

```conf
# fluent-bit/parsers.conf
[PARSER]
    Name        json
    Format      json
    Time_Key    timestamp
    Time_Format %Y-%m-%dT%H:%M:%S.%L%z
```

### Kubernetes Deployment

```yaml
# k8s/logging/fluent-bit-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: logging
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    metadata:
      labels:
        app: fluent-bit
    spec:
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:2.2
          volumeMounts:
            - name: varlog
              mountPath: /var/log
            - name: config
              mountPath: /fluent-bit/etc/
          env:
            - name: ELASTICSEARCH_HOST
              value: "elasticsearch.logging.svc.cluster.local"
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: config
          configMap:
            name: fluent-bit-config
```

## Kibana Dashboards

### Index Pattern

1. Go to Kibana > Management > Index Patterns
2. Create pattern: `hodlfun-*`
3. Select `timestamp` as Time Filter field

### Saved Searches

**Error Logs:**
```
level: "error" OR level: "fatal"
```

**API Requests:**
```
service: "api" AND context: "*Controller"
```

**Slow Requests:**
```
data.duration: > 1000
```

### Visualizations

Recommended dashboards:
1. **Error Rate**: Count of error level logs over time
2. **Request Volume**: Count of logs by service
3. **Response Times**: Histogram of request durations
4. **Error Distribution**: Pie chart of error types

## Log Retention

Configure index lifecycle policy:

```json
PUT _ilm/policy/hodlfun-logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50gb",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

## Log-Based Alerting

### Elasticsearch Watcher (Alerting)

```json
PUT _watcher/watch/high-error-rate
{
  "trigger": {
    "schedule": { "interval": "5m" }
  },
  "input": {
    "search": {
      "request": {
        "indices": ["hodlfun-*"],
        "body": {
          "query": {
            "bool": {
              "must": [
                { "term": { "level": "error" } },
                { "range": { "timestamp": { "gte": "now-5m" } } }
              ]
            }
          }
        }
      }
    }
  },
  "condition": {
    "compare": { "ctx.payload.hits.total.value": { "gt": 100 } }
  },
  "actions": {
    "send_slack": {
      "webhook": {
        "url": "https://hooks.slack.com/services/xxx",
        "body": "High error rate detected: {{ctx.payload.hits.total.value}} errors in 5 minutes"
      }
    }
  }
}
```

## Cloud Alternatives

### AWS CloudWatch

```typescript
// Use AWS SDK for CloudWatch Logs
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const client = new CloudWatchLogsClient({ region: 'us-east-1' });
// Configure fluent-bit to send to CloudWatch
```

### Google Cloud Logging

```typescript
// Use Google Cloud Logging client
import { Logging } from '@google-cloud/logging';

const logging = new Logging();
const log = logging.log('hodlfun-logs');
```

### Datadog

```typescript
// Configure DD_API_KEY and use datadog-winston or fluent-bit
// with Datadog output plugin
```

## Troubleshooting

### Common Issues

1. **Logs not appearing in Kibana**
   - Check Fluent Bit is running: `kubectl logs -l app=fluent-bit`
   - Verify Elasticsearch index exists: `curl elasticsearch:9200/_cat/indices`

2. **JSON parsing errors**
   - Ensure all log output is valid JSON
   - Check for multi-line stack traces

3. **High disk usage**
   - Review retention policy
   - Reduce log verbosity in production

### Debug Commands

```bash
# Check Elasticsearch health
curl -X GET "elasticsearch:9200/_cluster/health?pretty"

# List indices
curl -X GET "elasticsearch:9200/_cat/indices?v"

# Search recent logs
curl -X GET "elasticsearch:9200/hodlfun-*/_search?q=level:error&size=10"

# Check Fluent Bit logs
kubectl logs -l app=fluent-bit -n logging
```
