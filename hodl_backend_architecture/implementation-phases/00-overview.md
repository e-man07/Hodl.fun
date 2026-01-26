# Hodl.fun V2 Backend - Implementation Overview

## Architecture Summary

```
                                    INTERNET
                                       │
                          ┌────────────┴────────────┐
                          │       CLOUDFLARE        │
                          │  DDoS, WAF, CDN, SSL    │
                          └────────────┬────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │   GCP LOAD BALANCER     │
                          │   Path-based routing    │
                          └────────────┬────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                                GKE AUTOPILOT                                 │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │     API     │  │  WebSocket  │  │   Indexer   │  │   Worker    │        │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │        │
│  │  (3 pods)   │  │  (3 pods)   │  │  (2 pods)   │  │  (2 pods)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
               ┌─────────────────────┼─────────────────────┐
               │                     │                     │
    ┌──────────┴──────────┐   ┌─────┴─────┐   ┌──────────┴──────────┐
    │     CLOUD SQL       │   │MEMORYSTORE│   │    CLOUD STORAGE    │
    │    (PostgreSQL)     │   │  (Redis)  │   │      (Images)       │
    │   Primary + Replica │   │  5GB HA   │   │    Token avatars    │
    └─────────────────────┘   └───────────┘   └─────────────────────┘
```

## Implementation Phases

### Phase Dependency Graph

```
Phase 1: Foundation (GCP Infrastructure)
    │
    ├──► Phase 2: Data Layer (Cloud SQL + Redis)
    │         │
    │         └──► Phase 4: Core Backend (NestJS)
    │                   │
    │                   ├──► Phase 5: Indexer
    │                   │         │
    │                   │         ├──► Phase 6: Real-time
    │                   │         │
    │                   │         └──► Phase 7: Worker
    │                   │
    │                   └──► Phase 9: CI/CD
    │
    └──► Phase 3: Container Infrastructure (GKE)
              │
              ├──► Phase 8: Networking
              │
              └──► Phase 9: CI/CD

Phase 10: Monitoring (depends on 4-9)
Phase 11: Production (depends on all)
```

## Phase Summary

| Phase | Name | Duration | Key Deliverables |
|-------|------|----------|------------------|
| 1 | Foundation | 2-3 days | VPC, IAM, Secrets |
| 2 | Data Layer | 2-3 days | PostgreSQL, Redis |
| 3 | Container Infrastructure | 1-2 days | GKE cluster, Registry |
| 4 | Core Backend | 5-7 days | NestJS scaffold, Prisma, API basics |
| 5 | Indexer | 3-5 days | Event processing, DB sync |
| 6 | Real-time | 2-3 days | WebSocket, Pub/Sub |
| 7 | Worker | 2-3 days | BullMQ, job processors |
| 8 | Networking | 2-3 days | Load Balancer, Cloudflare |
| 9 | CI/CD | 2-3 days | Docker, GitHub Actions |
| 10 | Monitoring | 2-3 days | Metrics, alerts, dashboards |
| 11 | Production | 3-5 days | Auth, security, testing |

**Total Estimated Duration: 4-6 weeks**

## Critical Path

The critical path for fastest deployment:

1. **Phase 1 + 3** (parallel) → Infrastructure foundation
2. **Phase 2** → Data stores ready
3. **Phase 4** → Backend skeleton
4. **Phase 5** → Blockchain data ingestion
5. **Phase 6 + 7** (parallel) → Full feature set
6. **Phase 8 + 9** (parallel) → Production networking & CI/CD
7. **Phase 10 + 11** → Production readiness

## Success Criteria Per Phase

### Phase 1: Foundation
- [ ] VPC with private subnet created
- [ ] Service accounts with minimal permissions
- [ ] Secrets stored in Secret Manager

### Phase 2: Data Layer
- [ ] Cloud SQL accessible from VPC
- [ ] Memorystore Redis accessible
- [ ] Connection tests passing

### Phase 3: Container Infrastructure
- [ ] GKE cluster running
- [ ] kubectl access configured
- [ ] Artifact Registry ready

### Phase 4: Core Backend
- [ ] NestJS project building
- [ ] Prisma migrations running
- [ ] Health endpoints responding

### Phase 5: Indexer
- [ ] Events being indexed
- [ ] Database populated with token data
- [ ] No duplicate processing

### Phase 6: Real-time
- [ ] WebSocket connections working
- [ ] Trade events broadcasting
- [ ] Multi-pod Pub/Sub working

### Phase 7: Worker
- [ ] Jobs being processed
- [ ] Candle data generating
- [ ] Failed jobs in dead letter queue

### Phase 8: Networking
- [ ] HTTPS working end-to-end
- [ ] Cloudflare proxying traffic
- [ ] WebSocket upgrade working

### Phase 9: CI/CD
- [ ] PRs trigger tests
- [ ] Main merges deploy to staging
- [ ] Production deploy with approval

### Phase 10: Monitoring
- [ ] Metrics visible in Cloud Monitoring
- [ ] Alerts triggering correctly
- [ ] Dashboards showing service health

### Phase 11: Production
- [ ] Wallet authentication working
- [ ] Rate limiting active
- [ ] Load test passing (10K users)

## Tech Stack Reference

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 |
| Database | PostgreSQL 15 (Cloud SQL) |
| Cache/Queue | Redis 7 (Memorystore) |
| ORM | Prisma 5 |
| Job Queue | BullMQ |
| WebSocket | Socket.io with Redis adapter |
| Container | Docker + GKE Autopilot |
| CI/CD | GitHub Actions |
| CDN/WAF | Cloudflare |
| Monitoring | Cloud Monitoring + Prometheus |

## File Structure Reference

```
hodlfun-v2-backend/
├── apps/
│   ├── api/               # REST API service
│   ├── websocket/         # WebSocket service
│   ├── indexer/           # Blockchain indexer
│   └── worker/            # Background worker
├── libs/
│   ├── common/            # Shared utilities
│   ├── database/          # Prisma client
│   └── redis/             # Redis client
├── docker/                # Dockerfiles
├── k8s/                   # Kubernetes manifests
│   ├── base/              # Base configs
│   └── overlays/          # Staging/prod overrides
├── .github/workflows/     # CI/CD pipelines
├── prisma/                # Schema & migrations
└── terraform/             # Infrastructure as code
```

## Next Steps

Begin with **Phase 1: Foundation** to set up the GCP infrastructure foundation.
