# Hodl.fun Backend Operational Runbook

This runbook contains operational procedures for managing the Hodl.fun backend services.

## Table of Contents

1. [Service Overview](#service-overview)
2. [Quick Reference](#quick-reference)
3. [Deployment](./deployment.md)
4. [Incident Response](./incidents.md)
5. [Recovery Procedures](./recovery.md)

## Service Overview

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │     │  WebSocket  │     │   Worker    │
│  (3000)     │     │   (3001)    │     │   (3003)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────┴──────┐
                    │    Redis    │
                    │   (6379)    │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
│  PostgreSQL │     │   Indexer   │     │  Push Chain │
│   (5432)    │     │   (3002)    │     │    RPC      │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Services

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| API | 3000 | REST API server | `/api/v1/health` |
| WebSocket | 3001 | Real-time events | WS connect |
| Indexer | 3002 | Blockchain indexer | `/health` |
| Worker | 3003 | Background jobs | Bull queue |

### Dependencies

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache, PubSub, queues |
| Push Chain RPC | - | Blockchain data |

## Quick Reference

### Common Commands

```bash
# Start all services (development)
pnpm start:dev

# Start specific service
pnpm start:dev:api
pnpm start:dev:indexer
pnpm start:dev:worker
pnpm start:dev:websocket

# Start with production config
pnpm start:prod:api

# View logs
docker compose logs -f api
docker compose logs -f indexer

# Check service health
curl http://localhost:3000/api/v1/health

# Database operations
pnpm prisma:migrate
pnpm prisma:studio

# Redis operations
redis-cli -h localhost PING
redis-cli -h localhost INFO
```

### Key Metrics to Monitor

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| API latency p95 | > 200ms | > 500ms | Scale API |
| Error rate | > 0.1% | > 1% | Check logs |
| Indexer block lag | > 10 | > 100 | Check RPC |
| Redis memory | > 70% | > 90% | Evict cache |
| DB connections | > 80% | > 95% | Increase pool |
| WebSocket connections | > 5000 | > 9000 | Scale WS |

### Emergency Contacts

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| On-call Engineer | [PagerDuty] | Immediate |
| Backend Lead | [Slack] | 15 min |
| DevOps | [Slack] | 15 min |
| Management | [Phone] | 1 hour |

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/hodlfun"

# Redis
REDIS_URL="redis://localhost:6379"

# Blockchain
RPC_URL="https://rpc.pushchain.org"
CORE_ADDRESS="0x..."
FACTORY_ADDRESS="0x..."

# Auth
JWT_SECRET="..."
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Optional
INDEXER_START_BLOCK="0"
INDEXER_BATCH_SIZE="100"
```

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_METRICS` | true | Prometheus metrics |
| `ENABLE_TRACING` | false | OpenTelemetry tracing |
| `ENABLE_RATE_LIMIT` | true | API rate limiting |
| `ENABLE_CACHE` | true | Redis caching |

## Service Dependencies

```mermaid
graph TD
    API --> Redis
    API --> PostgreSQL
    WebSocket --> Redis
    Indexer --> PostgreSQL
    Indexer --> Redis
    Indexer --> RPC
    Worker --> PostgreSQL
    Worker --> Redis
```

### Startup Order

1. PostgreSQL (must be healthy)
2. Redis (must be healthy)
3. Indexer (can start independently)
4. Worker (can start independently)
5. API (depends on Redis, PostgreSQL)
6. WebSocket (depends on Redis)

### Shutdown Order

1. API (stop accepting new requests)
2. WebSocket (graceful disconnect)
3. Worker (finish current jobs)
4. Indexer (stop at current block)
5. Redis (flush to disk)
6. PostgreSQL (clean shutdown)

## Monitoring Dashboards

- **Grafana**: `http://monitoring.hodl.fun/grafana`
- **Prometheus**: `http://monitoring.hodl.fun/prometheus`
- **Bull Board**: `http://api.hodl.fun/admin/queues`

## Log Locations

| Service | Location |
|---------|----------|
| API | `/var/log/hodlfun/api.log` |
| Indexer | `/var/log/hodlfun/indexer.log` |
| Worker | `/var/log/hodlfun/worker.log` |
| WebSocket | `/var/log/hodlfun/websocket.log` |

Or via Docker:

```bash
docker compose logs -f --tail=100 api
docker compose logs -f --tail=100 indexer
```
