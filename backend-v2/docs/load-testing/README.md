# Load Testing Documentation

This document describes the load testing strategy, tools, and procedures for the Hodl.fun backend.

## Overview

Load testing validates system performance under expected and peak loads:
- **API Server**: REST endpoints for tokens, users, trades
- **WebSocket Server**: Real-time subscriptions and event broadcasting
- **Indexer**: Blockchain event processing throughput

## Tools

We use [k6](https://k6.io/) for load testing because:
- JavaScript-based scripts (familiar to Node.js developers)
- Built-in support for HTTP and WebSocket protocols
- Excellent metrics and reporting
- Cloud and local execution options

### Installation

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo apt-get install k6

# Docker
docker run -i grafana/k6 run - <script.js
```

## Test Scenarios

### 1. API Load Test

Tests REST API endpoints under load.

```bash
# Run with default options (10 VUs, 30s duration)
k6 run test/load/api-load-test.js

# Run with custom options
k6 run --vus 100 --duration 5m test/load/api-load-test.js

# Run with ramping stages
k6 run test/load/api-load-test.js --config test/load/config/api-stages.json
```

**Endpoints tested:**
- `GET /api/v1/tokens` - Token list with pagination
- `GET /api/v1/tokens/:address` - Single token details
- `GET /api/v1/tokens/trending` - Trending tokens
- `GET /api/v1/users/:address/portfolio` - User portfolio
- `GET /api/v1/health` - Health check

### 2. WebSocket Load Test

Tests WebSocket connections and subscriptions.

```bash
k6 run test/load/websocket-load-test.js
```

**Scenarios tested:**
- Connection establishment
- Subscribe to token events
- Subscribe to wallet events
- Receive real-time updates
- Graceful disconnection

### 3. Combined Load Test

Simulates realistic user behavior with mixed API and WebSocket traffic.

```bash
k6 run test/load/combined-load-test.js
```

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| API p50 latency | < 50ms | < 200ms |
| API p95 latency | < 200ms | < 500ms |
| API p99 latency | < 500ms | < 1000ms |
| Error rate | < 0.1% | < 1% |
| Throughput | > 1000 req/s | > 500 req/s |
| WebSocket connect time | < 100ms | < 500ms |
| WebSocket message latency | < 50ms | < 200ms |
| Concurrent connections | 10,000 | 5,000 |

## Running Load Tests

### Prerequisites

1. **Start the backend services:**
   ```bash
   pnpm start:dev:api
   pnpm start:dev:websocket
   ```

2. **Ensure database and Redis are running:**
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```

3. **Seed test data (optional but recommended):**
   ```bash
   pnpm prisma:seed
   ```

### Environment Variables

```bash
# API base URL (default: http://localhost:3000)
export K6_API_URL=http://localhost:3000

# WebSocket URL (default: ws://localhost:3001)
export K6_WS_URL=ws://localhost:3001

# Test token address (for specific endpoint tests)
export K6_TOKEN_ADDRESS=0x1234...
```

### Test Execution

```bash
# Quick smoke test (1 VU, 10s)
k6 run --vus 1 --duration 10s test/load/api-load-test.js

# Standard load test (50 VUs, 5m)
k6 run --vus 50 --duration 5m test/load/api-load-test.js

# Stress test (200 VUs, 10m)
k6 run --vus 200 --duration 10m test/load/api-load-test.js

# Spike test (ramping)
k6 run test/load/api-load-test.js
```

## Interpreting Results

### Key Metrics

```
http_req_duration.............: avg=45.2ms  min=5ms   med=35ms  max=890ms  p(90)=95ms   p(95)=145ms
http_req_failed...............: 0.05%    ✓ 12     ✗ 23988
http_reqs.....................: 24000    400/s
iterations....................: 24000    400/s
vus...........................: 50       min=50      max=50
vus_max.......................: 50       min=50      max=50
```

### Understanding Latency Distribution

- **p50 (median)**: Half of requests are faster than this
- **p90**: 90% of requests are faster
- **p95**: 95% of requests are faster (SLA target)
- **p99**: 99% of requests are faster (tail latency)

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| High p99 but low p50 | Database connection pool exhaustion | Increase pool size |
| Increasing latency over time | Memory leak | Profile with Node.js inspector |
| Connection refused errors | Too many concurrent connections | Increase file descriptor limits |
| 5xx errors under load | Unhandled exceptions | Check application logs |

## Saved Results

Test results are saved in `docs/load-testing/results/`:

```
results/
├── 2024-01-15-api-load-50vu.json
├── 2024-01-15-websocket-load-100vu.json
└── 2024-01-15-combined-stress.json
```

### Generating Reports

```bash
# Output JSON for analysis
k6 run --out json=results/output.json test/load/api-load-test.js

# Output to InfluxDB (for Grafana dashboards)
k6 run --out influxdb=http://localhost:8086/k6 test/load/api-load-test.js
```

## Continuous Performance Testing

### CI/CD Integration

Add load tests to your CI pipeline for regression detection:

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: test/load/api-load-test.js
          flags: --vus 10 --duration 30s
```

## Optimization Recommendations

Based on typical load test results:

### Quick Wins

1. **Enable response compression** (gzip/brotli)
2. **Add Redis caching** for frequently accessed data
3. **Connection pooling** for database
4. **Keep-alive connections** for HTTP clients

### Architecture Changes

1. **Horizontal scaling** with load balancer
2. **Read replicas** for database queries
3. **CDN** for static assets
4. **Message queue** for async processing

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 WebSocket Testing](https://k6.io/docs/using-k6/protocols/websockets/)
- [Performance Testing Best Practices](https://grafana.com/blog/2024/01/30/load-testing-best-practices/)
