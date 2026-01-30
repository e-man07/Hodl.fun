# Hodl.fun V2 Backend Documentation

> **Last Updated:** January 29, 2026
> **Version:** 2.0.0
> **Status:** Production-Ready

## Quick Links

| Document | Description |
|----------|-------------|
| [Implementation Review](./IMPLEMENTATION-REVIEW.md) | Comprehensive review vs planned phases |
| [Architecture Gaps](./ARCHITECTURE_GAPS.md) | Known gaps and future work |
| [Testing Guide](./testing/README.md) | Test strategy and execution |
| [Live E2E Coverage](./testing/LIVE-E2E-COVERAGE-REVIEW.md) | Live test coverage analysis |
| [Runbook](./runbook/README.md) | Operational procedures |
| [Load Testing](./load-testing/README.md) | Performance testing guide |
| [Logging](./logging/README.md) | Logging configuration |

---

## Project Status

### Implementation Completion

| Phase | Status | Details |
|-------|--------|---------|
| Phase 4: Core Backend | ✅ Complete | NestJS, Prisma, shared libs |
| Phase 5: Blockchain Indexer | ✅ Complete | Event processing, RPC service |
| Phase 6: Real-time Features | ✅ Complete | WebSocket, Redis Pub/Sub |
| Phase 7: Background Workers | ✅ Complete | Candles, metrics, cleanup |
| Phase 10: Monitoring | ✅ Complete | Prometheus, alerts |
| Phase 11: Security | ✅ Complete | JWT, rate limiting, validation |

### Test Coverage

| Category | Count | Status |
|----------|-------|--------|
| Unit Tests | 40+ specs | ✅ Passing |
| Integration Tests | 5 specs | ✅ Passing |
| E2E Tests | 3 specs | ✅ Passing |
| Live E2E Tests | 155 tests | ✅ Passing |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   API Server  │    │   WebSocket   │    │   Indexer     │
│   (port 3000) │    │   (port 3001) │    │   (internal)  │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
               ┌────▼────┐      ┌─────▼─────┐
               │  Redis  │      │ PostgreSQL│
               └────┬────┘      └───────────┘
                    │
               ┌────▼────┐
               │ Worker  │
               └─────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+ (or Docker)
- Redis 7+ (or Docker)

### Development Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose -f docker/docker-compose.dev.yml up -d

# Run database migrations
pnpm prisma migrate dev

# Start all services
pnpm start:dev:api
pnpm start:dev:indexer
pnpm start:dev:worker
pnpm start:dev:websocket
```

### Running Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:cov

# E2E tests
pnpm test:e2e

# Live E2E tests (requires testnet PUSH)
TEST_WALLET_PRIVATE_KEY=<key> pnpm test:e2e:live
```

---

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| API | 3000 | REST API endpoints |
| WebSocket | 3001 | Real-time events |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & queues |

---

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema |
| `apps/api/src/main.ts` | API entry point |
| `apps/indexer/src/main.ts` | Indexer entry point |
| `apps/worker/src/main.ts` | Worker entry point |
| `apps/websocket/src/main.ts` | WebSocket entry point |
| `libs/common/src/index.ts` | Shared library exports |
| `libs/redis/src/index.ts` | Redis library exports |

---

## Documentation Index

### Core Documentation

- **[Implementation Review](./IMPLEMENTATION-REVIEW.md)** - Comprehensive comparison of implementation vs planned phases, including test coverage analysis and production checklist.

- **[Architecture Gaps](./ARCHITECTURE_GAPS.md)** - Known limitations, untestable features, and future enhancement opportunities.

### Testing Documentation

- **[Testing README](./testing/README.md)** - Overview of testing strategy, test organization, and best practices.

- **[Coverage Report](./testing/COVERAGE.md)** - Detailed code coverage metrics and targets.

- **[Mocking Guide](./testing/MOCKING.md)** - How to use test mocks and factories.

- **[E2E Scenarios](./testing/E2E-SCENARIOS.md)** - End-to-end test scenarios and workflows.

- **[Live E2E Coverage](./testing/LIVE-E2E-COVERAGE-REVIEW.md)** - Analysis of live testnet test coverage.

### Operations Documentation

- **[Runbook](./runbook/README.md)** - Operational procedures index.

- **[Deployment](./runbook/deployment.md)** - Deployment procedures for all environments.

- **[Incidents](./runbook/incidents.md)** - Incident response procedures.

- **[Recovery](./runbook/recovery.md)** - Disaster recovery procedures.

### Performance Documentation

- **[Load Testing](./load-testing/README.md)** - Performance testing guide with k6 scripts.

- **[Logging](./logging/README.md)** - Logging configuration and best practices.

---

## Related Documentation

| Location | Content |
|----------|---------|
| `/CLAUDE.md` | Project-wide guidance for Claude Code |
| `/../implementation-phases/` | Original implementation phase specifications |
| `/terraform/` | Infrastructure as code |
| `/docker/` | Container configurations |

---

## Support

For questions or issues:
1. Check existing documentation
2. Review test files for usage examples
3. Check implementation-phases for original specifications
