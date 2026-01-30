# Hodl.fun Backend Architecture - V2

## Table of Contents
1. [Overview](#overview)
2. [Decisions Summary](#decisions-summary)
3. [High-Level Architecture](#high-level-architecture)
4. [GCP Infrastructure](#gcp-infrastructure)
5. [Service Architecture](#service-architecture)
6. [Data Layer](#data-layer)
7. [Real-Time System](#real-time-system)
8. [Blockchain Indexer](#blockchain-indexer)
9. [Background Jobs](#background-jobs)
10. [API Design](#api-design)
11. [Authentication Flow](#authentication-flow)
12. [Security Measures](#security-measures)
13. [Monitoring & Logging](#monitoring--logging)
14. [CI/CD Pipeline](#cicd-pipeline)
15. [Backup & Disaster Recovery](#backup--disaster-recovery)
16. [Caching Strategy](#caching-strategy)
17. [Error Handling](#error-handling)
18. [Health Checks](#health-checks)
19. [Testing Strategy](#testing-strategy)
20. [Local Development Setup](#local-development-setup)
21. [Rollback Strategy](#rollback-strategy)
22. [API Documentation](#api-documentation)
23. [Cost Estimates](#cost-estimates)

---

## Overview

This document outlines the backend architecture for Hodl.fun V2 - a universal token launchpad built on Push Chain. The backend is designed to:

- Handle 10K+ concurrent users
- Provide real-time price updates, trades, and notifications
- Index blockchain events from Push Chain smart contracts
- Support both wallet and social login authentication
- Scale horizontally with Kubernetes

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Framework | NestJS (Node.js) |
| Database | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Message Queue | BullMQ |
| WebSocket | Socket.IO |
| Container Orchestration | Kubernetes (GKE) |
| Cloud Provider | Google Cloud Platform |
| CI/CD | GitHub Actions |

---

## Decisions Summary

| # | Topic | Decision |
|---|-------|----------|
| 1 | Indexing | Custom Indexer, 2 RPC URLs (primary + fallback) |
| 2 | Real-Time | All features: live prices, trades, portfolio, alerts, charts, graduation, leaderboards |
| 3 | Scale | 10K+ concurrent users |
| 4 | Authentication | Push Chain Wallet SDK (wallet + social login) |
| 5 | Data Storage | PostgreSQL + TimescaleDB (free) + Redis |
| 6 | Security | Platform protection (DDoS, rate limit, validation, JWT, audit logs, admin 2FA). Bots allowed. |
| 7 | Infrastructure | GCP (GKE Autopilot + Cloud SQL + Memorystore) + Grafana/Prometheus/Loki + Sentry |
| 8 | Background Jobs | Redis + BullMQ |
| 9 | WebSocket | Socket.IO with Redis adapter |
| 10 | API Design | REST, URL-based versioning (`/api/v1/...`) |
| 11 | CI/CD | GitHub + GitHub Actions |
| 12 | Service Architecture | Modular Monolith, separate deployments (API, WebSocket, Indexer, Worker) |
| 13 | User Analytics | Microsoft Clarity (free) |
| 14 | Internationalization | English only (for now) |
| 15 | File Storage | IPFS (archive) + GCS (primary retrieval) + Cloud CDN |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                          │
│                        (Web App / Mobile App)                                    │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  │ HTTPS / WSS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE                                             │
│                    (DDoS Protection, CDN, SSL)                                   │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      GCP CLOUD LOAD BALANCER                                     │
│                    (SSL Termination, Routing)                                    │
└───────────┬─────────────────────┬─────────────────────┬─────────────────────────┘
            │                     │                     │
            │ /api/*              │ /socket.io/*        │ (internal)
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            GKE CLUSTER                                           │
│                                                                                  │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌─────────────┐  │
│   │  API SERVICE  │   │   WEBSOCKET   │   │    INDEXER    │   │   WORKER    │  │
│   │               │   │    SERVICE    │   │    SERVICE    │   │   SERVICE   │  │
│   │ • REST API    │   │               │   │               │   │             │  │
│   │ • Auth        │   │ • Socket.IO   │   │ • Event       │   │ • BullMQ    │  │
│   │ • Validation  │   │ • Rooms       │   │   Listener    │   │ • Candles   │  │
│   │               │   │ • Broadcast   │   │ • RPC Client  │   │ • Alerts    │  │
│   │ Replicas: 3   │   │               │   │               │   │ • Cleanup   │  │
│   │               │   │ Replicas: 3   │   │ Replicas: 2   │   │             │  │
│   │               │   │               │   │               │   │ Replicas: 2 │  │
│   └───────┬───────┘   └───────┬───────┘   └───────┬───────┘   └──────┬──────┘  │
│           │                   │                   │                  │          │
│           └───────────────────┴───────────────────┴──────────────────┘          │
│                                       │                                          │
│   ┌───────────────────────────────────┼───────────────────────────────────────┐ │
│   │                                   │                                        │ │
│   │   ┌───────────────┐   ┌───────────▼───────┐   ┌───────────────┐          │ │
│   │   │   GRAFANA     │   │      REDIS        │   │  PROMETHEUS   │          │ │
│   │   │               │   │   (Memorystore)   │   │               │          │ │
│   │   │ • Dashboards  │   │                   │   │ • Metrics     │          │ │
│   │   │ • Alerts      │   │ • Cache           │   │ • Scraping    │          │ │
│   │   │               │   │ • Pub/Sub         │   │               │          │ │
│   │   └───────────────┘   │ • BullMQ          │   └───────────────┘          │ │
│   │                       │ • Socket.IO       │                               │ │
│   │   ┌───────────────┐   │   Adapter         │   ┌───────────────┐          │ │
│   │   │     LOKI      │   │                   │   │    SENTRY     │          │ │
│   │   │               │   └───────────────────┘   │   (External)  │          │ │
│   │   │ • Log Aggr.   │                           │               │          │ │
│   │   │               │                           │ • Errors      │          │ │
│   │   └───────────────┘                           │ • Alerts      │          │ │
│   │                                               └───────────────┘          │ │
│   │                         MONITORING STACK                                  │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────┬────────────────────────────────────────────┘
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
          ┌───────────────────────┐       ┌───────────────────────┐
          │      CLOUD SQL        │       │    PUSH CHAIN RPC     │
          │     (PostgreSQL +     │       │                       │
          │     TimescaleDB)      │       │ • Primary RPC         │
          │                       │       │ • Fallback RPC        │
          │ • Tokens              │       │                       │
          │ • Trades              │       │ • WebSocket Sub       │
          │ • Users               │       │ • Event Logs          │
          │ • Candles             │       │                       │
          │ • Alerts              │       │                       │
          └───────────────────────┘       └───────────────────────┘
```

---

## GCP Infrastructure

### Services Used

| Category | Service | Purpose | Estimated Cost |
|----------|---------|---------|----------------|
| **Compute** | GKE Autopilot | Run all containers (pay per pod) | ~$100-150/month |
| **Database** | Cloud SQL (PostgreSQL) | Primary database + TimescaleDB | ~$50-150/month |
| **Cache** | Memorystore (Redis) | Cache, pub/sub, BullMQ, Socket.IO | ~$30-80/month |
| **Load Balancing** | Cloud Load Balancer | Traffic distribution, SSL | ~$20-40/month |
| **Container Registry** | Artifact Registry | Docker images storage | ~$5-10/month |
| **Networking** | Cloud NAT | Outbound connections from GKE | ~$30-50/month |
| **DNS** | Cloud DNS | Domain management | ~$1-5/month |
| **Storage** | Cloud Storage | Backups, static files, token images | ~$5-20/month |
| **CDN** | Cloud CDN | Edge caching for images | ~$10-30/month |
| **Monitoring** | Cloud Monitoring | GKE native metrics | Free-$20/month |
| **Secrets** | Secret Manager | API keys, credentials | ~$1-5/month |

### File Storage Strategy (Token Images)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IMAGE STORAGE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  Token Creator Uploads Image
              │
              ▼
      ┌───────────────┐
      │   Backend     │
      │   API         │
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │
      ▼               ▼
┌───────────┐   ┌───────────┐
│   IPFS    │   │   GCS     │
│ (Archive) │   │ (Primary) │
└───────────┘   └───────────┘
      │               │
      │               │
      │               ▼
      │         ┌───────────┐
      │         │  Cloud    │
      │         │   CDN     │
      │         └─────┬─────┘
      │               │
      │               ▼
      │         ┌───────────┐
      │         │  Frontend │
      │         │  (Fast)   │
      │         └───────────┘
      │
      └──────▶ Decentralized backup (not used for retrieval)
```

| Storage | Purpose | Used For |
|---------|---------|----------|
| **IPFS** | Decentralized archival | Storage only, Web3 permanence |
| **Cloud Storage (GCS)** | Primary storage | Fast retrieval, CDN origin |
| **Cloud CDN** | Edge caching | Frontend image delivery |

**Flow:**
1. Creator uploads image via API
2. Backend uploads to both IPFS and GCS in parallel
3. Store IPFS hash in database (for reference)
4. Store GCS URL in database (for retrieval)
5. Frontend always fetches from GCS/CDN URL
6. IPFS serves as decentralized backup only

### GKE Cluster Configuration (Autopilot)

```yaml
# Recommended GKE Autopilot Setup
Cluster:
  Name: hodlfun-production
  Mode: Autopilot
  Region: us-central1 (or closest to users)
  
  # Autopilot Benefits:
  # - No node management required
  # - Pay per pod resources used
  # - Auto-scaling built-in
  # - Security hardened by default
  # - Automatic upgrades

# Pod Resource Requests (Autopilot scales based on these)
Services:
  API:
    replicas: 2-10 (HPA managed)
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
  
  WebSocket:
    replicas: 2-8 (HPA managed)
    resources:
      requests:
        cpu: 1000m
        memory: 1Gi
      limits:
        cpu: 2000m
        memory: 2Gi
  
  Indexer:
    replicas: 2
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
  
  Worker:
    replicas: 2-4 (HPA managed)
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
```

### Cloud SQL Configuration

```yaml
Instance:
  Name: hodlfun-postgres
  Database Version: PostgreSQL 15
  Region: us-central1
  Machine Type: db-standard-2 (2 vCPU, 7.5GB RAM)
  Storage: 50GB SSD (auto-increase enabled)
  High Availability: Enabled
  Backups: 
    Enabled: true
    Retention: 7 days
  Extensions:
    - timescaledb
    - pg_trgm (for search)
    - uuid-ossp
```

### Memorystore Configuration

```yaml
Instance:
  Name: hodlfun-redis
  Tier: Standard (for high availability)
  Capacity: 5GB
  Region: us-central1
  Version: 7.0
```

---

## Service Architecture

### Modular Monolith Structure

Single NestJS codebase with separate deployment entry points:

```
src/
├── main.ts                    # API entry point
├── main-websocket.ts          # WebSocket entry point
├── main-indexer.ts            # Indexer entry point
├── main-worker.ts             # Worker entry point
│
├── modules/
│   ├── auth/                  # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   └── admin.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   │
│   ├── tokens/                # Token management
│   │   ├── tokens.controller.ts
│   │   ├── tokens.service.ts
│   │   ├── dto/
│   │   └── entities/
│   │       └── token.entity.ts
│   │
│   ├── trades/                # Trade management
│   │   ├── trades.controller.ts
│   │   ├── trades.service.ts
│   │   ├── dto/
│   │   └── entities/
│   │       └── trade.entity.ts
│   │
│   ├── users/                 # User management
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   │
│   ├── portfolio/             # Portfolio tracking
│   │   ├── portfolio.controller.ts
│   │   └── portfolio.service.ts
│   │
│   ├── leaderboard/           # Rankings
│   │   ├── leaderboard.controller.ts
│   │   └── leaderboard.service.ts
│   │
│   ├── alerts/                # Price alerts
│   │   ├── alerts.controller.ts
│   │   ├── alerts.service.ts
│   │   └── entities/
│   │       └── alert.entity.ts
│   │
│   ├── candles/               # OHLCV data
│   │   ├── candles.controller.ts
│   │   ├── candles.service.ts
│   │   └── entities/
│   │       └── candle.entity.ts
│   │
│   ├── websocket/             # Socket.IO gateway
│   │   ├── websocket.gateway.ts
│   │   ├── websocket.service.ts
│   │   └── rooms/
│   │       ├── token.room.ts
│   │       ├── portfolio.room.ts
│   │       └── global.room.ts
│   │
│   ├── indexer/               # Blockchain indexer
│   │   ├── indexer.service.ts
│   │   ├── event-handlers/
│   │   │   ├── create-curve.handler.ts
│   │   │   ├── buy.handler.ts
│   │   │   ├── sell.handler.ts
│   │   │   ├── sync.handler.ts
│   │   │   ├── lock.handler.ts
│   │   │   └── listing.handler.ts
│   │   └── rpc/
│   │       └── rpc.service.ts
│   │
│   ├── jobs/                  # Background jobs
│   │   ├── jobs.module.ts
│   │   ├── processors/
│   │   │   ├── candle.processor.ts
│   │   │   ├── alert.processor.ts
│   │   │   ├── leaderboard.processor.ts
│   │   │   └── cleanup.processor.ts
│   │   └── queues/
│   │       └── queue.constants.ts
│   │
│   └── admin/                 # Admin panel
│       ├── admin.controller.ts
│       └── admin.service.ts
│
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
│
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── jwt.config.ts
│   └── rpc.config.ts
│
└── database/
    ├── migrations/
    └── seeds/
```

### Service Deployment Breakdown

| Service | Entry Point | Replicas | Resources | Purpose |
|---------|-------------|----------|-----------|---------|
| API | `main.ts` | 3 | 512MB-1GB RAM, 0.5-1 CPU | REST endpoints |
| WebSocket | `main-websocket.ts` | 3 | 1-2GB RAM, 1-2 CPU | Real-time connections |
| Indexer | `main-indexer.ts` | 2 | 512MB-1GB RAM, 0.5-1 CPU | Blockchain events |
| Worker | `main-worker.ts` | 2 | 512MB-1GB RAM, 0.5-1 CPU | Background jobs |

---

## Data Layer

### Database Schema

```sql
-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) UNIQUE,
    push_did VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    auth_type VARCHAR(50) NOT NULL, -- 'wallet' | 'social'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_admin BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_push_did ON users(push_did);

-- =============================================
-- TOKENS
-- =============================================
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) UNIQUE NOT NULL,
    curve_address VARCHAR(255) UNIQUE NOT NULL,
    creator_id UUID REFERENCES users(id),
    creator_address VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    token_uri TEXT,
    
    -- Current State
    virtual_native NUMERIC(78, 0) NOT NULL,
    virtual_token NUMERIC(78, 0) NOT NULL,
    real_native NUMERIC(78, 0) DEFAULT 0,
    real_token NUMERIC(78, 0) DEFAULT 0,
    k NUMERIC(78, 0) NOT NULL,
    current_price NUMERIC(78, 18) NOT NULL,
    market_cap NUMERIC(78, 18) NOT NULL,
    
    -- ATH Tracking
    ath_price NUMERIC(78, 18),
    ath_price_at TIMESTAMPTZ,
    ath_market_cap NUMERIC(78, 18),
    ath_market_cap_at TIMESTAMPTZ,
    
    -- Status
    is_locked BOOLEAN DEFAULT FALSE,
    is_listed BOOLEAN DEFAULT FALSE,
    pool_address VARCHAR(255),
    
    -- Stats
    total_trades INTEGER DEFAULT 0,
    total_volume NUMERIC(78, 18) DEFAULT 0,
    holder_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    listed_at TIMESTAMPTZ,
    
    -- Block Info
    created_block BIGINT NOT NULL,
    created_tx_hash VARCHAR(255) NOT NULL
);

CREATE INDEX idx_tokens_address ON tokens(address);
CREATE INDEX idx_tokens_curve ON tokens(curve_address);
CREATE INDEX idx_tokens_creator ON tokens(creator_address);
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX idx_tokens_market_cap ON tokens(market_cap DESC);
CREATE INDEX idx_tokens_volume ON tokens(total_volume DESC);
CREATE INDEX idx_tokens_name_search ON tokens USING gin(to_tsvector('english', name || ' ' || symbol));

-- =============================================
-- TRADES
-- =============================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    
    -- Trade Details
    trade_type VARCHAR(10) NOT NULL, -- 'buy' | 'sell'
    trader_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255),
    
    -- Amounts
    amount_in NUMERIC(78, 0) NOT NULL,
    amount_out NUMERIC(78, 0) NOT NULL,
    price NUMERIC(78, 18) NOT NULL,
    
    -- Fees
    fee_amount NUMERIC(78, 0),
    creator_fee NUMERIC(78, 0),
    platform_fee NUMERIC(78, 0),
    
    -- Block Info
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    log_index INTEGER NOT NULL,
    
    -- Timestamp
    traded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_trades_token ON trades(token_id);
CREATE INDEX idx_trades_token_address ON trades(token_address);
CREATE INDEX idx_trades_trader ON trades(trader_address);
CREATE INDEX idx_trades_time ON trades(traded_at DESC);
CREATE INDEX idx_trades_block ON trades(block_number);

-- =============================================
-- CANDLES (TimescaleDB Hypertable)
-- =============================================
CREATE TABLE candles (
    token_id UUID NOT NULL REFERENCES tokens(id),
    interval VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'
    bucket TIMESTAMPTZ NOT NULL,
    open NUMERIC(78, 18) NOT NULL,
    high NUMERIC(78, 18) NOT NULL,
    low NUMERIC(78, 18) NOT NULL,
    close NUMERIC(78, 18) NOT NULL,
    volume NUMERIC(78, 18) NOT NULL,
    trade_count INTEGER NOT NULL,
    
    PRIMARY KEY (token_id, interval, bucket)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('candles', 'bucket');

CREATE INDEX idx_candles_token_interval ON candles(token_id, interval, bucket DESC);

-- =============================================
-- PRICE ALERTS
-- =============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    token_id UUID REFERENCES tokens(id) NOT NULL,
    
    alert_type VARCHAR(20) NOT NULL, -- 'price_above' | 'price_below' | 'graduation'
    target_price NUMERIC(78, 18),
    
    is_triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_token ON alerts(token_id);
CREATE INDEX idx_alerts_active ON alerts(is_triggered) WHERE is_triggered = FALSE;

-- =============================================
-- USER HOLDINGS (Portfolio)
-- =============================================
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    wallet_address VARCHAR(255) NOT NULL,
    token_id UUID REFERENCES tokens(id) NOT NULL,
    
    balance NUMERIC(78, 0) NOT NULL DEFAULT 0,
    avg_buy_price NUMERIC(78, 18),
    total_invested NUMERIC(78, 18) DEFAULT 0,
    total_sold NUMERIC(78, 18) DEFAULT 0,
    realized_pnl NUMERIC(78, 18) DEFAULT 0,
    
    first_buy_at TIMESTAMPTZ,
    last_trade_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(wallet_address, token_id)
);

CREATE INDEX idx_holdings_wallet ON holdings(wallet_address);
CREATE INDEX idx_holdings_token ON holdings(token_id);
CREATE INDEX idx_holdings_user ON holdings(user_id);

-- =============================================
-- CREATOR FEES
-- =============================================
CREATE TABLE creator_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_address VARCHAR(255) NOT NULL,
    token_id UUID REFERENCES tokens(id) NOT NULL,
    
    accumulated_fees NUMERIC(78, 0) DEFAULT 0,
    claimed_fees NUMERIC(78, 0) DEFAULT 0,
    
    last_claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creator_fees_creator ON creator_fees(creator_address);

-- =============================================
-- GRADUATIONS
-- =============================================
CREATE TABLE graduations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    curve_address VARCHAR(255) NOT NULL,
    pool_address VARCHAR(255) NOT NULL,
    
    amount0 NUMERIC(78, 0) NOT NULL,
    amount1 NUMERIC(78, 0) NOT NULL,
    liquidity NUMERIC(78, 0) NOT NULL,
    
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    
    listed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_graduations_token ON graduations(token_id);

-- =============================================
-- INDEXER STATE
-- =============================================
CREATE TABLE indexer_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_processed_block BIGINT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT single_row CHECK (id = 1)
);

-- =============================================
-- AUDIT LOGS
-- =============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### Redis Data Structures

```
# =============================================
# CACHE KEYS
# =============================================

# Token data cache (TTL: 10 seconds)
cache:token:{address}                    → JSON (token details)

# Price cache (TTL: 5 seconds)
cache:price:{address}                    → string (current price)

# Leaderboard cache (TTL: 30 seconds)
cache:leaderboard:gainers                → JSON (top gainers list)
cache:leaderboard:volume                 → JSON (top volume list)
cache:leaderboard:new                    → JSON (newest tokens list)

# User portfolio cache (TTL: 30 seconds)
cache:portfolio:{wallet}                 → JSON (holdings list)

# =============================================
# REAL-TIME PUB/SUB CHANNELS
# =============================================

# Global channels
channel:new_token                        → New token created
channel:graduation                       → Token graduated to DEX
channel:global_trades                    → All trades (firehose)

# Per-token channels
channel:token:{address}:trades           → Trades for specific token
channel:token:{address}:price            → Price updates for token

# Per-user channels
channel:user:{wallet}:portfolio          → Portfolio updates
channel:user:{wallet}:alerts             → Triggered alerts

# =============================================
# RATE LIMITING
# =============================================

# Per IP (sliding window)
ratelimit:ip:{ip}:{endpoint}             → counter (TTL: 1 minute)

# Per wallet (sliding window)
ratelimit:wallet:{address}:{endpoint}    → counter (TTL: 1 minute)

# =============================================
# SESSION / AUTH
# =============================================

# Refresh tokens
session:refresh:{token_id}               → JSON (user_id, expires_at)

# Active sessions per user
session:user:{user_id}                   → SET of session IDs

# =============================================
# BULLMQ QUEUES
# =============================================

bull:candle-aggregation                  → Candle computation jobs
bull:alert-check                         → Price alert checking
bull:leaderboard-update                  → Leaderboard recalculation
bull:cleanup                             → Old data cleanup
bull:notification                        → Push notifications
```

---

## Real-Time System

### Socket.IO Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOCKET.IO ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client 1   │     │  Client 2   │     │  Client N   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     LOAD BALANCER       │
              │   (Sticky Sessions)     │
              └───────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  WS Server 1  │ │  WS Server 2  │ │  WS Server 3  │
│               │ │               │ │               │
│ • Clients     │ │ • Clients     │ │ • Clients     │
│ • Rooms       │ │ • Rooms       │ │ • Rooms       │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │   REDIS ADAPTER         │
              │                         │
              │ • Cross-instance sync   │
              │ • Room management       │
              │ • Message broadcast     │
              └─────────────────────────┘
```

### Room Structure

| Room | Purpose | Events Emitted |
|------|---------|----------------|
| `global` | All connected clients | `new_token`, `graduation`, `leaderboard_update` |
| `token:{address}` | Token-specific updates | `trade`, `price_update`, `sync` |
| `portfolio:{wallet}` | User portfolio | `holding_update`, `pnl_update` |
| `alerts:{wallet}` | User alerts | `alert_triggered` |

### WebSocket Events

```typescript
// =============================================
// CLIENT → SERVER EVENTS
// =============================================

// Subscribe to token updates
socket.emit('subscribe:token', { address: '0x...' });

// Unsubscribe from token
socket.emit('unsubscribe:token', { address: '0x...' });

// Subscribe to portfolio (requires auth)
socket.emit('subscribe:portfolio', { wallet: '0x...' });

// Subscribe to alerts (requires auth)
socket.emit('subscribe:alerts', { wallet: '0x...' });

// =============================================
// SERVER → CLIENT EVENTS
// =============================================

// New token created
socket.on('new_token', {
    address: '0x...',
    name: 'Token Name',
    symbol: 'TKN',
    creator: '0x...',
    initialPrice: '0.00000002',
    timestamp: 1234567890
});

// Trade occurred
socket.on('trade', {
    tokenAddress: '0x...',
    type: 'buy', // or 'sell'
    trader: '0x...',
    amountIn: '1000000000000000000',
    amountOut: '5000000000000000000000000',
    price: '0.00000005',
    txHash: '0x...',
    timestamp: 1234567890
});

// Price update
socket.on('price_update', {
    tokenAddress: '0x...',
    price: '0.00000006',
    priceChange24h: '15.5',
    marketCap: '6000000000000000000',
    timestamp: 1234567890
});

// Token graduated
socket.on('graduation', {
    tokenAddress: '0x...',
    poolAddress: '0x...',
    timestamp: 1234567890
});

// Portfolio update
socket.on('holding_update', {
    tokenAddress: '0x...',
    balance: '1000000000000000000000',
    value: '50000000000000000',
    pnl: '25.5',
    timestamp: 1234567890
});

// Alert triggered
socket.on('alert_triggered', {
    alertId: 'uuid',
    tokenAddress: '0x...',
    type: 'price_above',
    targetPrice: '0.0001',
    currentPrice: '0.00012',
    timestamp: 1234567890
});

// Leaderboard update
socket.on('leaderboard_update', {
    type: 'gainers', // or 'volume', 'new'
    data: [...],
    timestamp: 1234567890
});
```

---

## Blockchain Indexer

### Event Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEXER ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   PUSH CHAIN RPC    │
│                     │
│  Primary ──────┐    │
│                ├───▶│ WebSocket Subscription
│  Fallback ─────┘    │
│                     │
└─────────┬───────────┘
          │
          │ New Block Events
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INDEXER SERVICE                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        EVENT ROUTER                                  │   │
│  │                                                                      │   │
│  │   Event Topic ──────────────────────▶ Handler                       │   │
│  │                                                                      │   │
│  │   CreateCurve ──────────────────────▶ CreateCurveHandler            │   │
│  │   Buy (Core) ───────────────────────▶ BuyHandler                    │   │
│  │   Sell (Core) ──────────────────────▶ SellHandler                   │   │
│  │   Sync ─────────────────────────────▶ SyncHandler                   │   │
│  │   Lock ─────────────────────────────▶ LockHandler                   │   │
│  │   Listing ──────────────────────────▶ ListingHandler                │   │
│  │   NewATHPrice ──────────────────────▶ ATHHandler                    │   │
│  │   NewATHMarketCap ──────────────────▶ ATHHandler                    │   │
│  │   CreatorFeesClaimed ───────────────▶ CreatorFeeHandler             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PROCESSING PIPELINE                           │   │
│  │                                                                      │   │
│  │   1. Parse Event Data                                               │   │
│  │   2. Validate & Decode                                              │   │
│  │   3. Update PostgreSQL                                              │   │
│  │   4. Update Redis Cache                                             │   │
│  │   5. Publish to Redis Pub/Sub                                       │   │
│  │   6. Queue Background Jobs (if needed)                              │   │
│  │   7. Update Indexer State                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Contract Events to Index

| Event | Contract | Handler Action |
|-------|----------|----------------|
| `CreateCurve` | Core | Create token record, cache token data |
| `Buy` | Core | Insert trade, update holdings, update stats |
| `Sell` | Core | Insert trade, update holdings, update stats |
| `Sync` | BondingCurve | Update reserves, price, market cap |
| `Lock` | BondingCurve | Mark token as locked |
| `Listing` | BondingCurve | Mark token as listed, record graduation |
| `NewATHPrice` | BondingCurve | Update ATH price |
| `NewATHMarketCap` | BondingCurve | Update ATH market cap |
| `CreatorFeesClaimed` | Factory | Record fee claim |

### Smart Contract Configuration Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Total Supply** | 1,000,000,000 (1B) | Fixed token supply per token (1B * 10^18 wei) |
| **Deploy Fee** | 0.01 PUSH | Cost to create a token |
| **Listing Fee** | 0.1 PUSH | Cost for DEX graduation |
| **Virtual Native** | 1 PUSH | Initial virtual PUSH reserve |
| **Virtual Token** | 50,000,000 | Initial virtual token reserve |
| **Graduation Market Cap** | 1,000,000 PUSH | Threshold for DEX listing |
| **Trading Fee** | 1% | Total fee on trades (feeNumerator=1, feeDenominator=100) |
| **Creator Fee Share** | 30% | Portion of trading fee to creator (3750 bps = 37.5% of remaining after liquidity) |
| **Liquidity Reserve** | 20% | Portion of trading fee for DEX liquidity |
| **Platform Fee** | 50% | Portion of trading fee to FeeVault |
| **DEX Fee Tier** | 3000 (0.30%) | Uniswap V3 fee tier |

### Bonding Curve Mathematics

The bonding curve uses a **constant product AMM** formula: `k = x * y`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONSTANT PRODUCT AMM (x * y = k)                         │
└─────────────────────────────────────────────────────────────────────────────┘

INVARIANT:
  k = virtualNative × virtualToken  (NEVER changes during trades)

INITIAL STATE:
  virtualNative = 1 PUSH (1e18 wei)
  virtualToken  = 50,000,000 tokens (50e24 wei)
  k = 1e18 × 50e24 = 50e42

PRICE CALCULATION:
  price = (virtualNative × 1e18) / virtualToken

  Initial price = (1e18 × 1e18) / 50e24 = 0.00000002 PUSH per token

MARKET CAP CALCULATION:
  marketCap = (price × TOTAL_SUPPLY) / 1e18
            = (price × 1,000,000,000e18) / 1e18
```

#### Buy Calculation (PUSH → Token)

```typescript
// Given: amountIn (PUSH to spend)
// Find:  amountOut (tokens to receive)

function getAmountOut(
    amountIn: bigint,      // PUSH being spent
    reserveIn: bigint,     // virtualNative
    reserveOut: bigint,    // virtualToken
    k: bigint              // constant product
): bigint {
    const newReserveIn = reserveIn + amountIn;
    const newReserveOut = k / newReserveIn;
    const amountOut = reserveOut - newReserveOut;
    return amountOut;
}

// Example:
// User sends 0.1 PUSH to buy tokens
// virtualNative = 1 PUSH, virtualToken = 50M, k = 50M
//
// newReserveIn  = 1 + 0.1 = 1.1 PUSH
// newReserveOut = 50M / 1.1 = 45.45M tokens
// amountOut     = 50M - 45.45M = 4.545M tokens
```

#### Sell Calculation (Token → PUSH)

```typescript
// Given: amountIn (tokens to sell)
// Find:  amountOut (PUSH to receive)

function getAmountOut(
    amountIn: bigint,      // Tokens being sold
    reserveIn: bigint,     // virtualToken
    reserveOut: bigint,    // virtualNative
    k: bigint              // constant product
): bigint {
    const newReserveIn = reserveIn + amountIn;
    const newReserveOut = k / newReserveIn;
    const amountOut = reserveOut - newReserveOut;
    return amountOut;
}
```

#### Reverse Calculation (for exactOut trades)

```typescript
// Given: amountOut (desired output)
// Find:  amountIn (required input)

function getAmountIn(
    amountOut: bigint,     // Desired output
    reserveIn: bigint,     // Input reserve
    reserveOut: bigint,    // Output reserve
    k: bigint              // constant product
): bigint {
    const newReserveOut = reserveOut - amountOut;
    const newReserveIn = k / newReserveOut;
    const amountIn = newReserveIn - reserveIn;
    return amountIn;
}
```

### Fee Distribution on Trades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FEE DISTRIBUTION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

ON BUY:
  • Fee is deducted from tokens received (stays in curve)
  • Benefits all token holders
  • Creator fee deferred to sell operations

ON SELL:
  ┌─────────────────────────────────────────────────────────────┐
  │              Sell Amount: 100 PUSH                          │
  │                       │                                     │
  │           ┌───────────┴───────────┐                         │
  │           ▼                       ▼                         │
  │     User Receives            Fee: 1 PUSH (1%)               │
  │       99 PUSH                     │                         │
  │                    ┌──────────────┼──────────────┐          │
  │                    ▼              ▼              ▼          │
  │             Liquidity        Creator        Platform        │
  │              Reserve          Fee             Fee           │
  │             0.2 PUSH       0.3 PUSH        0.5 PUSH         │
  │            (20% fee)      (30% fee)       (50% fee)         │
  │                │              │               │             │
  │                ▼              ▼               ▼             │
  │           BondingCurve     Factory        FeeVault          │
  │          (for DEX LP)   (accumulated)    (deposited)        │
  └─────────────────────────────────────────────────────────────┘

LIQUIDITY RESERVE:
  • Accumulated in BondingCurve during trading
  • Added to DEX liquidity at graduation
  • Creates deeper liquidity pools for high-volume tokens

CREATOR FEE:
  • Accumulated in Factory contract per creator address
  • Creator calls Factory.claimCreatorFees() to withdraw
  • Event: CreatorFeesClaimed(creator, amount)
```

### Token Lifecycle States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATED   │────▶│   TRADING   │────▶│   LOCKED    │────▶│   LISTED    │
│             │     │             │     │             │     │             │
│ Token +     │     │ Buy/sell    │     │ Graduation  │     │ Trading on  │
│ curve       │     │ on bonding  │     │ triggered,  │     │ Uniswap V3  │
│ deployed    │     │ curve       │     │ curve frozen│     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │   marketCap >=    │
                           │   1,000,000 PUSH  │
                           └──────────┬────────┘
                                      ▼
                               Lock event emitted
                                      │
                            listing() called by anyone
                                      │
                                      ▼
                               Listing event emitted
                               Pool address recorded
```

**State Detection in Backend:**
```typescript
function getTokenState(token: Token): 'CREATED' | 'TRADING' | 'LOCKED' | 'LISTED' {
    if (token.is_listed) return 'LISTED';
    if (token.is_locked) return 'LOCKED';
    if (token.total_trades > 0) return 'TRADING';
    return 'CREATED';
}
```

### Smart Contract View Functions

These read-only functions can be called to query current state:

#### Core.sol Functions

```typescript
// Get bonding curve data for a token
function getCurveData(curve: address): [virtualNative, virtualToken, k]

// Calculate output amount for a trade
function getAmountOut(amountIn, k, reserveIn, reserveOut): amountOut

// Calculate required input for desired output
function getAmountIn(amountOut, k, reserveIn, reserveOut): amountIn

// Get current token price (PUSH per token, 1e18 scaled)
function getCurrentPrice(token: address): price

// Get current market cap in PUSH
function calculateMarketCap(token: address): marketCap
```

#### BondingCurve.sol Functions (per token)

```typescript
// Real balances in the curve
function getReserves(): [nativeReserves, tokenReserves]

// Virtual reserves used for pricing
function getVirtualReserves(): [virtualNative, virtualToken]

// Constant product invariant
function getK(): k

// Current price (1e18 scaled)
function getCurrentPrice(): price

// Market cap in PUSH
function calculateMarketCap(): marketCap

// All-time high tracking
function getATHPrice(): [price, timestamp]
function getATHMarketCap(): [marketCap, timestamp]

// Graduation status
function getLock(): bool      // True = graduation triggered
function getIsListing(): bool // True = listed on DEX
```

#### Factory.sol Functions

```typescript
// Get bonding curve address for a token
function getCurve(token: address): curve

// Get token address for a curve
function getToken(curve: address): token

// Check if address is a valid bonding curve
function isCurve(curve: address): bool

// Get creator's accumulated fees (claimable)
function getCreatorFees(creator: address): amount

// Get global configuration
function getConfig(): Config
```

### Smart Contract Error Codes

| Error | Description | Backend Handling |
|-------|-------------|------------------|
| `InvalidTo()` | Zero address recipient | Validate addresses before simulation |
| `Expired()` | Transaction past deadline | Check timestamp before sending |
| `ExcessiveInput()` | Slippage exceeded | Calculate expected output, add buffer |
| `InsufficientOutput()` | Not enough reserves | Validate against reserves |
| `BondingCurveLocked()` | Curve graduated | Check `is_locked` status before trading |
| `CallerNotCore()` | Direct curve call | Always route through Core contract |
| `InvalidAmountOut()` | Amount mismatch | Recalculate with current reserves |

### Backend Price/Trade Simulation

```typescript
// =============================================
// TRADE SIMULATION SERVICE
// =============================================
@Injectable()
export class TradeSimulationService {

    // Simulate a buy: How many tokens for X PUSH?
    simulateBuy(
        amountIn: bigint,
        virtualNative: bigint,
        virtualToken: bigint
    ): { amountOut: bigint; newPrice: bigint; priceImpact: number } {
        const k = virtualNative * virtualToken;

        // Calculate tokens out
        const newVirtualNative = virtualNative + amountIn;
        const newVirtualToken = k / newVirtualNative;
        const amountOut = virtualToken - newVirtualToken;

        // Apply 1% fee (deducted from tokens)
        const fee = amountOut / 100n;
        const amountOutAfterFee = amountOut - fee;

        // Calculate new price
        const newPrice = (newVirtualNative * BigInt(1e18)) / newVirtualToken;

        // Calculate price impact
        const oldPrice = (virtualNative * BigInt(1e18)) / virtualToken;
        const priceImpact = Number((newPrice - oldPrice) * 10000n / oldPrice) / 100;

        return { amountOut: amountOutAfterFee, newPrice, priceImpact };
    }

    // Simulate a sell: How much PUSH for X tokens?
    simulateSell(
        amountIn: bigint,
        virtualNative: bigint,
        virtualToken: bigint
    ): { amountOut: bigint; newPrice: bigint; priceImpact: number } {
        const k = virtualNative * virtualToken;

        // Calculate PUSH out
        const newVirtualToken = virtualToken + amountIn;
        const newVirtualNative = k / newVirtualToken;
        const amountOut = virtualNative - newVirtualNative;

        // Apply 1% fee (deducted from PUSH)
        const fee = amountOut / 100n;
        const amountOutAfterFee = amountOut - fee;

        // Calculate new price
        const newPrice = (newVirtualNative * BigInt(1e18)) / newVirtualToken;

        // Calculate price impact
        const oldPrice = (virtualNative * BigInt(1e18)) / virtualToken;
        const priceImpact = Number((oldPrice - newPrice) * 10000n / oldPrice) / 100;

        return { amountOut: amountOutAfterFee, newPrice, priceImpact };
    }

    // Check if trade would trigger graduation
    wouldGraduate(
        newVirtualNative: bigint,
        newVirtualToken: bigint,
        totalSupply: bigint = BigInt(1e27) // 1B tokens
    ): boolean {
        const price = (newVirtualNative * BigInt(1e18)) / newVirtualToken;
        const marketCap = (price * totalSupply) / BigInt(1e18);
        const graduationThreshold = BigInt(1e24); // 1M PUSH
        return marketCap >= graduationThreshold;
    }
}
```

### RPC Failover Logic

```typescript
class RPCService {
    private primaryRPC: string;
    private fallbackRPC: string;
    private currentRPC: 'primary' | 'fallback' = 'primary';
    private failureCount: number = 0;
    private readonly MAX_FAILURES = 3;
    
    async getProvider(): Promise<Provider> {
        if (this.failureCount >= this.MAX_FAILURES) {
            this.switchRPC();
        }
        
        const url = this.currentRPC === 'primary' 
            ? this.primaryRPC 
            : this.fallbackRPC;
            
        return new WebSocketProvider(url);
    }
    
    recordFailure(): void {
        this.failureCount++;
    }
    
    recordSuccess(): void {
        this.failureCount = 0;
    }
    
    private switchRPC(): void {
        this.currentRPC = this.currentRPC === 'primary' ? 'fallback' : 'primary';
        this.failureCount = 0;
        console.log(`Switched to ${this.currentRPC} RPC`);
    }
}
```

---

## Background Jobs

### BullMQ Queues

| Queue | Purpose | Schedule/Trigger |
|-------|---------|------------------|
| `candle-aggregation` | Compute OHLCV candles | Every 1 minute |
| `alert-check` | Check price alerts | On every trade |
| `leaderboard-update` | Recalculate rankings | Every 30 seconds |
| `cleanup` | Remove old data | Daily at 3 AM |
| `notification` | Send push notifications | On alert trigger |

### Job Processors

```typescript
// =============================================
// CANDLE AGGREGATION
// =============================================
@Processor('candle-aggregation')
export class CandleProcessor {
    @Process()
    async aggregateCandles(job: Job) {
        const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
        
        for (const interval of intervals) {
            await this.computeCandle(job.data.tokenId, interval);
        }
    }
    
    private async computeCandle(tokenId: string, interval: string) {
        // Use TimescaleDB time_bucket for efficient aggregation
        const query = `
            INSERT INTO candles (token_id, interval, bucket, open, high, low, close, volume, trade_count)
            SELECT 
                $1 as token_id,
                $2 as interval,
                time_bucket($3, traded_at) as bucket,
                first(price, traded_at) as open,
                max(price) as high,
                min(price) as low,
                last(price, traded_at) as close,
                sum(amount_in) as volume,
                count(*) as trade_count
            FROM trades
            WHERE token_id = $1
              AND traded_at >= NOW() - $4::interval
            GROUP BY bucket
            ON CONFLICT (token_id, interval, bucket) DO UPDATE
            SET high = GREATEST(candles.high, EXCLUDED.high),
                low = LEAST(candles.low, EXCLUDED.low),
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                trade_count = EXCLUDED.trade_count
        `;
        
        await this.db.query(query, [tokenId, interval, ...]);
    }
}

// =============================================
// ALERT CHECKER
// =============================================
@Processor('alert-check')
export class AlertProcessor {
    @Process()
    async checkAlerts(job: Job) {
        const { tokenId, currentPrice } = job.data;
        
        const alerts = await this.alertService.getActiveAlerts(tokenId);
        
        for (const alert of alerts) {
            const triggered = this.shouldTrigger(alert, currentPrice);
            
            if (triggered) {
                await this.alertService.markTriggered(alert.id);
                await this.notificationQueue.add('send', {
                    userId: alert.userId,
                    type: 'alert_triggered',
                    data: alert
                });
            }
        }
    }
}

// =============================================
// LEADERBOARD UPDATE
// =============================================
@Processor('leaderboard-update')
export class LeaderboardProcessor {
    @Process()
    async updateLeaderboards(job: Job) {
        // Top gainers (24h price change)
        const gainers = await this.db.query(`
            SELECT t.*, 
                   ((t.current_price - c.close) / c.close * 100) as price_change_24h
            FROM tokens t
            LEFT JOIN candles c ON c.token_id = t.id 
                AND c.interval = '1d' 
                AND c.bucket = date_trunc('day', NOW() - interval '1 day')
            WHERE t.is_locked = false
            ORDER BY price_change_24h DESC
            LIMIT 50
        `);
        
        await this.redis.set('cache:leaderboard:gainers', JSON.stringify(gainers), 'EX', 30);
        
        // Top volume
        const volume = await this.db.query(`
            SELECT t.*, 
                   COALESCE(SUM(tr.amount_in), 0) as volume_24h
            FROM tokens t
            LEFT JOIN trades tr ON tr.token_id = t.id 
                AND tr.traded_at >= NOW() - interval '24 hours'
            GROUP BY t.id
            ORDER BY volume_24h DESC
            LIMIT 50
        `);
        
        await this.redis.set('cache:leaderboard:volume', JSON.stringify(volume), 'EX', 30);
        
        // Newest tokens
        const newest = await this.db.query(`
            SELECT * FROM tokens
            ORDER BY created_at DESC
            LIMIT 50
        `);
        
        await this.redis.set('cache:leaderboard:new', JSON.stringify(newest), 'EX', 30);
        
        // Broadcast update
        await this.redis.publish('channel:leaderboard', JSON.stringify({ updated: true }));
    }
}
```

---

## API Design

### Endpoint Structure

```
Base URL: /api/v1

├── /auth
│   ├── POST   /verify          # Verify wallet signature / social token
│   ├── POST   /refresh         # Refresh access token
│   └── POST   /logout          # Invalidate session
│
├── /tokens
│   ├── GET    /                # List tokens (paginated, filterable)
│   ├── GET    /:address        # Get token details
│   ├── GET    /:address/trades # Get token trades (paginated)
│   ├── GET    /:address/candles # Get OHLCV data
│   ├── GET    /:address/holders # Get top holders
│   └── GET    /:address/stats  # Get token statistics
│
├── /trades
│   └── GET    /                # Global trades feed (paginated)
│
├── /users
│   ├── GET    /me              # Get current user (auth required)
│   ├── PUT    /me              # Update user profile
│   ├── GET    /:wallet         # Get user public profile
│   └── GET    /:wallet/tokens  # Get tokens created by user
│
├── /portfolio
│   ├── GET    /:wallet         # Get wallet holdings
│   └── GET    /:wallet/history # Get trade history
│
├── /leaderboard
│   ├── GET    /gainers         # Top price gainers
│   ├── GET    /losers          # Top price losers
│   ├── GET    /volume          # Top volume
│   ├── GET    /new             # Newest tokens
│   └── GET    /graduated       # Recently graduated
│
├── /alerts
│   ├── GET    /                # Get user alerts (auth required)
│   ├── POST   /                # Create alert
│   ├── DELETE /:id             # Delete alert
│   └── PUT    /:id             # Update alert
│
├── /search
│   └── GET    /tokens          # Search tokens by name/symbol
│
└── /admin (protected)
    ├── GET    /stats           # Platform statistics
    ├── GET    /users           # List users
    └── POST   /config          # Update configuration
```

### Response Format

```typescript
// Success Response
{
    "success": true,
    "data": { ... },
    "meta": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "totalPages": 8
    }
}

// Error Response
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid token address",
        "details": [...]
    }
}
```

### Rate Limits

| Endpoint Category | Limit (per minute) |
|-------------------|-------------------|
| Public read | 100 per IP |
| Authenticated read | 300 per wallet |
| Write operations | 30 per wallet |
| Admin | 60 per admin |

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

WALLET LOGIN:
═════════════════════════════════════════════════════════════════════════════

┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │ Push SDK │      │ Backend  │      │ Database │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │ 1. Connect      │                 │                 │
     │────────────────▶│                 │                 │
     │                 │                 │                 │
     │ 2. Sign Message │                 │                 │
     │◀────────────────│                 │                 │
     │                 │                 │                 │
     │ 3. POST /auth/verify              │                 │
     │   { wallet, signature, message }  │                 │
     │──────────────────────────────────▶│                 │
     │                 │                 │                 │
     │                 │                 │ 4. Verify sig   │
     │                 │                 │ 5. Upsert user  │
     │                 │                 │────────────────▶│
     │                 │                 │                 │
     │ 6. { accessToken, refreshToken }  │                 │
     │◀──────────────────────────────────│                 │
     │                 │                 │                 │


SOCIAL LOGIN:
═════════════════════════════════════════════════════════════════════════════

┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │ Push SDK │      │ Backend  │      │ Database │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │ 1. Social Login │                 │                 │
     │────────────────▶│                 │                 │
     │                 │                 │                 │
     │ 2. OAuth Flow   │                 │                 │
     │◀───────────────▶│                 │                 │
     │                 │                 │                 │
     │ 3. Push DID + Token               │                 │
     │◀────────────────│                 │                 │
     │                 │                 │                 │
     │ 4. POST /auth/verify              │                 │
     │   { pushDid, socialToken }        │                 │
     │──────────────────────────────────▶│                 │
     │                 │                 │                 │
     │                 │                 │ 5. Verify token │
     │                 │                 │ 6. Upsert user  │
     │                 │                 │────────────────▶│
     │                 │                 │                 │
     │ 7. { accessToken, refreshToken }  │                 │
     │◀──────────────────────────────────│                 │
     │                 │                 │                 │


TOKEN REFRESH:
═════════════════════════════════════════════════════════════════════════════

┌──────────┐                         ┌──────────┐      ┌──────────┐
│  Client  │                         │ Backend  │      │  Redis   │
└────┬─────┘                         └────┬─────┘      └────┬─────┘
     │                                    │                 │
     │ POST /auth/refresh                 │                 │
     │   { refreshToken }                 │                 │
     │───────────────────────────────────▶│                 │
     │                                    │                 │
     │                                    │ Validate token  │
     │                                    │────────────────▶│
     │                                    │                 │
     │                                    │ Rotate token    │
     │                                    │────────────────▶│
     │                                    │                 │
     │ { newAccessToken, newRefreshToken }│                 │
     │◀───────────────────────────────────│                 │
     │                                    │                 │
```

### JWT Structure

```typescript
// Access Token (15 min expiry)
{
    "sub": "user-uuid",
    "wallet": "0x...",
    "pushDid": "did:push:...",
    "type": "access",
    "iat": 1234567890,
    "exp": 1234568790
}

// Refresh Token (7 days expiry)
{
    "sub": "user-uuid",
    "type": "refresh",
    "jti": "unique-token-id",
    "iat": 1234567890,
    "exp": 1235172690
}
```

---

## Security Measures

### Implementation Checklist

| Category | Measure | Implementation |
|----------|---------|----------------|
| **DDoS** | Cloudflare | DNS proxy enabled, rate limiting rules |
| **Rate Limiting** | Per IP + Per Wallet | Redis sliding window counters |
| **Input Validation** | All endpoints | class-validator + class-transformer |
| **SQL Injection** | Parameterized queries | TypeORM with parameters |
| **XSS** | Output encoding | Helmet.js middleware |
| **CORS** | Whitelist domains | NestJS CORS config |
| **HTTPS** | TLS termination | Load balancer + cert-manager |
| **JWT** | Short-lived tokens | 15min access, 7d refresh with rotation |
| **Secrets** | GCP Secret Manager | Environment injection at deploy |
| **Admin** | 2FA + IP whitelist | TOTP + nginx IP rules |
| **Audit** | All sensitive actions | Audit log table |

### Rate Limiting Implementation

```typescript
// Redis-based sliding window rate limiter
@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(private redis: Redis) {}
    
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const key = this.getKey(request);
        const limit = this.getLimit(request);
        const window = 60; // 1 minute
        
        const current = await this.redis.incr(key);
        
        if (current === 1) {
            await this.redis.expire(key, window);
        }
        
        if (current > limit) {
            throw new HttpException('Rate limit exceeded', 429);
        }
        
        return true;
    }
    
    private getKey(request: Request): string {
        const wallet = request.user?.wallet;
        const ip = request.ip;
        const endpoint = request.route.path;
        
        if (wallet) {
            return `ratelimit:wallet:${wallet}:${endpoint}`;
        }
        return `ratelimit:ip:${ip}:${endpoint}`;
    }
}
```

---

## Monitoring & Logging

### Grafana Dashboards

| Dashboard | Metrics |
|-----------|---------|
| **Overview** | Request rate, error rate, latency P50/P95/P99 |
| **API** | Endpoint breakdown, slowest endpoints, error distribution |
| **WebSocket** | Active connections, messages/sec, room sizes |
| **Indexer** | Blocks processed, events indexed, lag |
| **Database** | Query latency, connection pool, slow queries |
| **Redis** | Memory usage, hit rate, pub/sub throughput |
| **Business** | New tokens, trades volume, active users |

### Prometheus Metrics

```typescript
// Custom metrics
const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

const wsConnectionsGauge = new Gauge({
    name: 'websocket_connections_total',
    help: 'Total WebSocket connections',
    labelNames: ['server']
});

const indexerBlockGauge = new Gauge({
    name: 'indexer_last_processed_block',
    help: 'Last processed block number'
});

const tradesCounter = new Counter({
    name: 'trades_total',
    help: 'Total trades processed',
    labelNames: ['type'] // buy, sell
});
```

### Log Format

```json
{
    "timestamp": "2025-01-22T10:30:00.000Z",
    "level": "info",
    "service": "api",
    "traceId": "abc123",
    "message": "Request completed",
    "context": {
        "method": "GET",
        "path": "/api/v1/tokens",
        "statusCode": 200,
        "duration": 45,
        "ip": "1.2.3.4",
        "userAgent": "Mozilla/5.0..."
    }
}
```

### Sentry Configuration

```typescript
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Postgres(),
    ],
    beforeSend(event) {
        // Scrub sensitive data
        if (event.request?.headers) {
            delete event.request.headers['authorization'];
        }
        return event;
    }
});
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  PROJECT_ID: hodlfun-production
  GKE_CLUSTER: hodlfun-cluster
  GKE_ZONE: us-central1
  IMAGE: gcr.io/$PROJECT_ID/hodlfun-backend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test:cov
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Configure Docker
        run: gcloud auth configure-docker
      
      - name: Build and push image
        run: |
          docker build -t $IMAGE:${{ github.sha }} .
          docker push $IMAGE:${{ github.sha }}
          docker tag $IMAGE:${{ github.sha }} $IMAGE:latest
          docker push $IMAGE:latest

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Get GKE credentials
        run: |
          gcloud container clusters get-credentials $GKE_CLUSTER --zone $GKE_ZONE
      
      - name: Deploy to staging
        run: |
          kubectl set image deployment/api api=$IMAGE:${{ github.sha }} -n staging
          kubectl set image deployment/websocket websocket=$IMAGE:${{ github.sha }} -n staging
          kubectl set image deployment/indexer indexer=$IMAGE:${{ github.sha }} -n staging
          kubectl set image deployment/worker worker=$IMAGE:${{ github.sha }} -n staging
          kubectl rollout status deployment/api -n staging

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Get GKE credentials
        run: |
          gcloud container clusters get-credentials $GKE_CLUSTER --zone $GKE_ZONE
      
      - name: Deploy to production
        run: |
          kubectl set image deployment/api api=$IMAGE:${{ github.sha }} -n production
          kubectl set image deployment/websocket websocket=$IMAGE:${{ github.sha }} -n production
          kubectl set image deployment/indexer indexer=$IMAGE:${{ github.sha }} -n production
          kubectl set image deployment/worker worker=$IMAGE:${{ github.sha }} -n production
          kubectl rollout status deployment/api -n production
```

### Kubernetes Manifests Structure

```
k8s/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── websocket-deployment.yaml
│   ├── websocket-service.yaml
│   ├── indexer-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
│
├── staging/
│   └── kustomization.yaml
│
└── production/
    └── kustomization.yaml
```

---

## Backup & Disaster Recovery

### Backup Strategy

| Component | Backup Method | Frequency | Retention |
|-----------|---------------|-----------|-----------|
| **Cloud SQL** | Automated backups | Daily | 30 days |
| **Cloud SQL** | Point-in-time recovery | Continuous | 7 days |
| **Cloud SQL** | Cross-region replica | Real-time | Always |
| **Redis** | RDB snapshots | Every 6 hours | 7 days |
| **Application Logs** | Cloud Logging | Continuous | 30 days |
| **Indexer State** | PostgreSQL (included) | With DB backup | 30 days |

### Recovery Targets

| Metric | Target | Meaning |
|--------|--------|---------|
| **RTO (Recovery Time Objective)** | < 1 hour | Platform back online within 1 hour |
| **RPO (Recovery Point Objective)** | < 5 minutes | Maximum 5 minutes of data loss |

### Disaster Scenarios & Response

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DISASTER RECOVERY SCENARIOS                             │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Pod/Container Crash
───────────────────────────────────────────────────────────────────────────────
Impact: Single service degraded
Recovery: Automatic (Kubernetes restarts pod)
RTO: < 1 minute
Action: None required, self-healing

SCENARIO 2: Database Corruption / Bad Migration
───────────────────────────────────────────────────────────────────────────────
Impact: Data integrity issues
Recovery: Point-in-time recovery
RTO: 15-30 minutes
Action:
  1. Stop all write operations
  2. Identify corruption timestamp
  3. Restore to point before corruption
  4. Replay safe transactions from logs

SCENARIO 3: Accidental Data Deletion
───────────────────────────────────────────────────────────────────────────────
Impact: Missing data
Recovery: Restore from backup
RTO: 30-60 minutes
Action:
  1. Identify deleted data scope
  2. Restore specific tables to temp database
  3. Migrate needed data back to production

SCENARIO 4: GCP Region Outage
───────────────────────────────────────────────────────────────────────────────
Impact: Full platform down
Recovery: Failover to secondary region
RTO: 30-60 minutes
Action:
  1. Promote Cloud SQL read replica to primary
  2. Update DNS to secondary region
  3. Deploy services to backup GKE cluster
  4. Verify indexer catches up

SCENARIO 5: Security Breach / Ransomware
───────────────────────────────────────────────────────────────────────────────
Impact: Compromised system
Recovery: Clean restore
RTO: 2-4 hours
Action:
  1. Isolate affected systems
  2. Identify breach scope
  3. Restore from known clean backup
  4. Rotate all credentials
  5. Audit and patch vulnerability
```

### Cloud SQL Backup Configuration

```yaml
# Cloud SQL Instance Settings
backup_configuration:
  enabled: true
  start_time: "03:00"  # 3 AM UTC (low traffic)
  location: "us"
  point_in_time_recovery_enabled: true
  transaction_log_retention_days: 7
  backup_retention_settings:
    retained_backups: 30
    retention_unit: "COUNT"

# Cross-region Read Replica (for disaster recovery)
replica:
  region: "us-east1"  # Different from primary (us-central1)
  tier: "db-standard-1"  # Smaller, just for failover
  availability_type: "ZONAL"
```

### Recovery Runbook

```bash
# 1. Restore Cloud SQL to point-in-time
gcloud sql instances clone hodlfun-postgres hodlfun-postgres-restored \
  --point-in-time="2025-01-22T10:30:00Z"

# 2. Verify restored data
gcloud sql connect hodlfun-postgres-restored --user=postgres

# 3. Promote read replica (if region failover)
gcloud sql instances promote-replica hodlfun-postgres-replica

# 4. Update application connection string
kubectl set env deployment/api DATABASE_URL=<new-connection-string>
```

---

## Caching Strategy

### Cache Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CACHING ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

Request Flow:
─────────────────────────────────────────────────────────────────────────────

  Client Request
        │
        ▼
  ┌─────────────┐     HIT     ┌─────────────────────┐
  │   API       │────────────▶│   Return Cached     │
  │  Service    │             │      Response       │
  └──────┬──────┘             └─────────────────────┘
         │
         │ MISS
         ▼
  ┌─────────────┐     HIT     ┌─────────────────────┐
  │   Redis     │────────────▶│   Return + Cache    │
  │   Cache     │             │   in Memory (opt)   │
  └──────┬──────┘             └─────────────────────┘
         │
         │ MISS
         ▼
  ┌─────────────┐             ┌─────────────────────┐
  │ PostgreSQL  │────────────▶│   Return + Cache    │
  │             │             │     in Redis        │
  └─────────────┘             └─────────────────────┘
```

### What to Cache

| Data Type | Cache Key | TTL | Invalidation |
|-----------|-----------|-----|--------------|
| Token details | `token:{address}` | 10s | On Sync event |
| Current price | `price:{address}` | 5s | On trade |
| Token list (paginated) | `tokens:page:{n}:sort:{s}` | 30s | Time-based |
| Leaderboard (gainers) | `leaderboard:gainers` | 30s | On job completion |
| Leaderboard (volume) | `leaderboard:volume` | 30s | On job completion |
| Leaderboard (new) | `leaderboard:new` | 30s | On new token |
| User portfolio | `portfolio:{wallet}` | 30s | On user's trade |
| Candles | `candles:{address}:{interval}` | 60s | On job completion |
| Token search results | `search:{query}` | 60s | Time-based |
| User session | `session:{userId}` | 15m | On logout |

### Cache Implementation

```typescript
// =============================================
// CACHE SERVICE
// =============================================
@Injectable()
export class CacheService {
    constructor(private redis: Redis) {}

    // Generic cache wrapper
    async getOrSet<T>(
        key: string,
        ttlSeconds: number,
        fetchFn: () => Promise<T>
    ): Promise<T> {
        // Try cache first
        const cached = await this.redis.get(key);
        if (cached) {
            return JSON.parse(cached);
        }

        // Cache miss - fetch from source
        const data = await fetchFn();
        
        // Store in cache
        await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        
        return data;
    }

    // Invalidate specific key
    async invalidate(key: string): Promise<void> {
        await this.redis.del(key);
    }

    // Invalidate by pattern
    async invalidatePattern(pattern: string): Promise<void> {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
}

// =============================================
// USAGE IN TOKEN SERVICE
// =============================================
@Injectable()
export class TokenService {
    constructor(
        private cache: CacheService,
        private tokenRepo: TokenRepository
    ) {}

    async getToken(address: string): Promise<Token> {
        return this.cache.getOrSet(
            `token:${address}`,
            10, // 10 second TTL
            () => this.tokenRepo.findByAddress(address)
        );
    }

    async getLeaderboard(type: string): Promise<Token[]> {
        return this.cache.getOrSet(
            `leaderboard:${type}`,
            30, // 30 second TTL
            () => this.calculateLeaderboard(type)
        );
    }
}

// =============================================
// CACHE INVALIDATION ON EVENTS
// =============================================
@Injectable()
export class CacheInvalidationService {
    constructor(private cache: CacheService) {}

    // Called by indexer when trade happens
    async onTrade(tokenAddress: string, traderWallet: string): Promise<void> {
        await Promise.all([
            this.cache.invalidate(`token:${tokenAddress}`),
            this.cache.invalidate(`price:${tokenAddress}`),
            this.cache.invalidate(`portfolio:${traderWallet}`),
        ]);
    }

    // Called by indexer when new token created
    async onNewToken(): Promise<void> {
        await Promise.all([
            this.cache.invalidatePattern('tokens:page:*'),
            this.cache.invalidate('leaderboard:new'),
        ]);
    }

    // Called by indexer on Sync event
    async onSync(tokenAddress: string): Promise<void> {
        await Promise.all([
            this.cache.invalidate(`token:${tokenAddress}`),
            this.cache.invalidate(`price:${tokenAddress}`),
        ]);
    }
}
```

### Cache Performance Impact

| Endpoint | Without Cache | With Cache | Improvement |
|----------|---------------|------------|-------------|
| GET /tokens/:address | 50-100ms | 5-10ms | 10x faster |
| GET /leaderboard/gainers | 200-500ms | 5-10ms | 40x faster |
| GET /portfolio/:wallet | 100-200ms | 5-10ms | 20x faster |
| Database queries/min (10K users) | 500,000+ | 10,000 | 50x reduction |

---

## Error Handling

### Retry Strategy

```typescript
// =============================================
// RETRY CONFIGURATION
// =============================================
const RETRY_CONFIG = {
    RPC_CALLS: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
    },
    DATABASE: {
        maxRetries: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
    },
    REDIS: {
        maxRetries: 3,
        baseDelayMs: 200,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
    },
    BULLMQ_JOBS: {
        maxRetries: 3,
        backoffType: 'exponential',
        backoffDelay: 1000,
    },
};

// =============================================
// RETRY UTILITY
// =============================================
async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    context: string
): Promise<T> {
    let lastError: Error;
    let delay = config.baseDelayMs;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            logger.warn(`${context} failed (attempt ${attempt}/${config.maxRetries})`, {
                error: error.message,
                nextRetryMs: delay,
            });

            if (attempt < config.maxRetries) {
                await sleep(delay);
                delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
            }
        }
    }

    logger.error(`${context} failed after ${config.maxRetries} attempts`, {
        error: lastError.message,
    });
    
    throw lastError;
}

// =============================================
// USAGE IN RPC SERVICE
// =============================================
async getBlock(blockNumber: number): Promise<Block> {
    return withRetry(
        () => this.provider.getBlock(blockNumber),
        RETRY_CONFIG.RPC_CALLS,
        `getBlock(${blockNumber})`
    );
}
```

### Circuit Breaker

```typescript
// =============================================
// CIRCUIT BREAKER IMPLEMENTATION
// =============================================
enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',         // Failing, reject requests
    HALF_OPEN = 'HALF_OPEN' // Testing if recovered
}

@Injectable()
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private successCount: number = 0;

    private readonly FAILURE_THRESHOLD = 5;
    private readonly RECOVERY_TIMEOUT_MS = 30000; // 30 seconds
    private readonly SUCCESS_THRESHOLD = 3;

    async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.RECOVERY_TIMEOUT_MS) {
                this.state = CircuitState.HALF_OPEN;
                this.successCount = 0;
            } else {
                if (fallback) return fallback();
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            if (fallback) return fallback();
            throw error;
        }
    }

    private onSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.SUCCESS_THRESHOLD) {
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
            }
        } else {
            this.failureCount = 0;
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
            this.state = CircuitState.OPEN;
            logger.warn('Circuit breaker OPENED due to failures');
        }
    }
}

// =============================================
// USAGE
// =============================================
@Injectable()
export class RPCService {
    private circuitBreaker = new CircuitBreaker();

    async getBlockNumber(): Promise<number> {
        return this.circuitBreaker.execute(
            () => this.primaryProvider.getBlockNumber(),
            () => this.fallbackProvider.getBlockNumber() // Fallback to secondary RPC
        );
    }
}
```

### Dead Letter Queue

```typescript
// =============================================
// BULLMQ DEAD LETTER QUEUE SETUP
// =============================================
const candleQueue = new Queue('candle-aggregation', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: false, // Keep failed jobs for inspection
    },
});

// Dead letter queue for failed jobs
const deadLetterQueue = new Queue('dead-letter', {
    connection: redis,
});

// Worker with dead letter handling
const candleWorker = new Worker('candle-aggregation', async (job) => {
    // Process job
}, {
    connection: redis,
});

candleWorker.on('failed', async (job, error) => {
    if (job.attemptsMade >= job.opts.attempts) {
        // Move to dead letter queue after all retries exhausted
        await deadLetterQueue.add('failed-candle', {
            originalJob: job.data,
            error: error.message,
            failedAt: new Date().toISOString(),
            attempts: job.attemptsMade,
        });
        
        // Alert on Sentry
        Sentry.captureException(error, {
            extra: { jobId: job.id, jobData: job.data },
        });
    }
});

// =============================================
// DEAD LETTER QUEUE MONITORING
// =============================================
@Cron('0 * * * *') // Every hour
async monitorDeadLetterQueue(): Promise<void> {
    const failedCount = await deadLetterQueue.getJobCounts('waiting');
    
    if (failedCount.waiting > 10) {
        // Alert if too many failed jobs
        await this.alertService.send({
            type: 'warning',
            message: `Dead letter queue has ${failedCount.waiting} failed jobs`,
        });
    }
}
```

### Error Response Handling

```typescript
// =============================================
// GLOBAL EXCEPTION FILTER
// =============================================
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = 500;
        let message = 'Internal server error';
        let code = 'INTERNAL_ERROR';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            message = typeof exceptionResponse === 'string' 
                ? exceptionResponse 
                : (exceptionResponse as any).message;
            code = this.getErrorCode(status);
        } else if (exception instanceof Error) {
            message = exception.message;
            
            // Log unexpected errors to Sentry
            Sentry.captureException(exception, {
                extra: {
                    path: request.url,
                    method: request.method,
                    body: request.body,
                },
            });
        }

        // Log error
        logger.error('Request failed', {
            status,
            code,
            message,
            path: request.url,
            method: request.method,
            traceId: request.headers['x-trace-id'],
        });

        response.status(status).json({
            success: false,
            error: {
                code,
                message,
                timestamp: new Date().toISOString(),
                path: request.url,
            },
        });
    }

    private getErrorCode(status: number): string {
        const codes: Record<number, string> = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'VALIDATION_ERROR',
            429: 'RATE_LIMITED',
            500: 'INTERNAL_ERROR',
            503: 'SERVICE_UNAVAILABLE',
        };
        return codes[status] || 'UNKNOWN_ERROR';
    }
}
```

---

## Health Checks

### Kubernetes Probes

```yaml
# =============================================
# API DEPLOYMENT WITH HEALTH CHECKS
# =============================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: gcr.io/hodlfun/backend:latest
          ports:
            - containerPort: 3000
          
          # Startup Probe - Allow time for app to start
          startupProbe:
            httpGet:
              path: /health/startup
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30  # 30 * 5s = 150s max startup time
          
          # Liveness Probe - Is the container alive?
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          
          # Readiness Probe - Is the container ready for traffic?
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 3

---
# =============================================
# WEBSOCKET DEPLOYMENT WITH HEALTH CHECKS
# =============================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: websocket
          image: gcr.io/hodlfun/backend:latest
          command: ["node", "dist/main-websocket.js"]
          ports:
            - containerPort: 3001
          
          startupProbe:
            httpGet:
              path: /health/startup
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30
          
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3001
            periodSeconds: 10
            failureThreshold: 3
          
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3001
            periodSeconds: 5
            failureThreshold: 3

---
# =============================================
# INDEXER DEPLOYMENT WITH HEALTH CHECKS
# =============================================
apiVersion: apps/v1
kind: Deployment
metadata:
  name: indexer
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: indexer
          image: gcr.io/hodlfun/backend:latest
          command: ["node", "dist/main-indexer.js"]
          
          startupProbe:
            httpGet:
              path: /health/startup
              port: 3002
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30
          
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3002
            periodSeconds: 10
            failureThreshold: 3
          
          # Custom readiness - check RPC connection + block lag
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3002
            periodSeconds: 10
            failureThreshold: 3
```

### Health Check Endpoints Implementation

```typescript
// =============================================
// HEALTH MODULE
// =============================================
@Controller('health')
export class HealthController {
    constructor(
        private db: DataSource,
        private redis: Redis,
        private rpcService: RPCService,
        private indexerService: IndexerService,
    ) {}

    // ─────────────────────────────────────────
    // STARTUP PROBE
    // Called during container startup
    // ─────────────────────────────────────────
    @Get('startup')
    async startup(): Promise<{ status: string }> {
        // Check if basic initialization is complete
        const checks = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
        ]);

        if (checks.every(c => c.status === 'up')) {
            return { status: 'ok' };
        }

        throw new ServiceUnavailableException('Service starting up');
    }

    // ─────────────────────────────────────────
    // LIVENESS PROBE
    // Is the process alive and not deadlocked?
    // ─────────────────────────────────────────
    @Get('live')
    async live(): Promise<{ status: string }> {
        // Simple check - if this responds, process is alive
        return { status: 'ok' };
    }

    // ─────────────────────────────────────────
    // READINESS PROBE
    // Is the service ready to handle traffic?
    // ─────────────────────────────────────────
    @Get('ready')
    async ready(): Promise<HealthCheckResult> {
        const checks = await Promise.allSettled([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkRPC(),
        ]);

        const results = checks.map((check, index) => {
            const names = ['database', 'redis', 'rpc'];
            if (check.status === 'fulfilled') {
                return { name: names[index], ...check.value };
            }
            return { name: names[index], status: 'down', error: check.reason?.message };
        });

        const allHealthy = results.every(r => r.status === 'up');

        if (!allHealthy) {
            throw new ServiceUnavailableException({
                status: 'unhealthy',
                checks: results,
            });
        }

        return {
            status: 'healthy',
            checks: results,
        };
    }

    // ─────────────────────────────────────────
    // DETAILED HEALTH (for monitoring)
    // ─────────────────────────────────────────
    @Get('detailed')
    async detailed(): Promise<DetailedHealthCheck> {
        const [database, redis, rpc, indexer] = await Promise.allSettled([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkRPC(),
            this.checkIndexer(),
        ]);

        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: process.env.APP_VERSION || 'unknown',
            uptime: process.uptime(),
            checks: {
                database: database.status === 'fulfilled' ? database.value : { status: 'down' },
                redis: redis.status === 'fulfilled' ? redis.value : { status: 'down' },
                rpc: rpc.status === 'fulfilled' ? rpc.value : { status: 'down' },
                indexer: indexer.status === 'fulfilled' ? indexer.value : { status: 'down' },
            },
        };
    }

    // ─────────────────────────────────────────
    // INDIVIDUAL CHECKS
    // ─────────────────────────────────────────
    private async checkDatabase(): Promise<HealthCheck> {
        try {
            await this.db.query('SELECT 1');
            return { status: 'up', latencyMs: 0 };
        } catch (error) {
            return { status: 'down', error: error.message };
        }
    }

    private async checkRedis(): Promise<HealthCheck> {
        try {
            const start = Date.now();
            await this.redis.ping();
            return { status: 'up', latencyMs: Date.now() - start };
        } catch (error) {
            return { status: 'down', error: error.message };
        }
    }

    private async checkRPC(): Promise<HealthCheck> {
        try {
            const start = Date.now();
            await this.rpcService.getBlockNumber();
            return { status: 'up', latencyMs: Date.now() - start };
        } catch (error) {
            return { status: 'down', error: error.message };
        }
    }

    private async checkIndexer(): Promise<IndexerHealthCheck> {
        try {
            const state = await this.indexerService.getState();
            const currentBlock = await this.rpcService.getBlockNumber();
            const lag = currentBlock - state.lastProcessedBlock;

            return {
                status: lag < 100 ? 'up' : 'degraded',
                lastProcessedBlock: state.lastProcessedBlock,
                currentBlock,
                lag,
            };
        } catch (error) {
            return { status: 'down', error: error.message };
        }
    }
}

// =============================================
// TYPES
// =============================================
interface HealthCheck {
    status: 'up' | 'down' | 'degraded';
    latencyMs?: number;
    error?: string;
}

interface IndexerHealthCheck extends HealthCheck {
    lastProcessedBlock?: number;
    currentBlock?: number;
    lag?: number;
}

interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    checks: Array<{ name: string } & HealthCheck>;
}

interface DetailedHealthCheck {
    status: string;
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
        database: HealthCheck;
        redis: HealthCheck;
        rpc: HealthCheck;
        indexer: IndexerHealthCheck;
    };
}
```

### Probe Behavior Summary

| Probe | Fails If | Kubernetes Action |
|-------|----------|-------------------|
| **Startup** | App not initialized | Keep waiting (up to failureThreshold) |
| **Liveness** | Process deadlocked | Restart container |
| **Readiness** | Dependencies down | Stop sending traffic |

### Health Dashboard (Grafana)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HEALTH DASHBOARD                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SERVICE STATUS                           DEPENDENCY STATUS                  │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐   │
│  │ API         ● ● ● (3/3)    │         │ PostgreSQL    ●  Healthy    │   │
│  │ WebSocket   ● ● ● (3/3)    │         │ Redis         ●  Healthy    │   │
│  │ Indexer     ● ● (2/2)      │         │ RPC Primary   ●  Healthy    │   │
│  │ Worker      ● ● (2/2)      │         │ RPC Fallback  ●  Healthy    │   │
│  └─────────────────────────────┘         └─────────────────────────────┘   │
│                                                                              │
│  INDEXER LAG                              RESPONSE TIMES (P95)               │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐   │
│  │                             │         │ API:       45ms             │   │
│  │  Current: 3 blocks          │         │ WebSocket: 12ms             │   │
│  │  Status:  ● Healthy         │         │ Database:  23ms             │   │
│  │                             │         │ Redis:     2ms              │   │
│  └─────────────────────────────┘         └─────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Testing Pyramid

```
                    ┌───────────────┐
                    │     E2E       │  ← Few, slow, expensive
                    │    Tests      │
                    ├───────────────┤
                    │  Integration  │  ← Medium amount
                    │    Tests      │
                    ├───────────────┤
                    │               │
                    │     Unit      │  ← Many, fast, cheap
                    │    Tests      │
                    │               │
                    └───────────────┘
```

### Test Types & Coverage Targets

| Test Type | Coverage Target | What to Test | Tools |
|-----------|----------------|--------------|-------|
| **Unit** | 80%+ | Services, utils, helpers, pure functions | Jest |
| **Integration** | 60%+ | API endpoints, database queries, Redis operations | Jest + Supertest |
| **E2E** | Critical paths | Full user flows (create token, trade, graduate) | Jest + Testcontainers |
| **Load** | Before launch | Performance under 10K concurrent users | k6, Artillery |

### Unit Tests

```typescript
// =============================================
// EXAMPLE: Token Service Unit Test
// =============================================
describe('TokenService', () => {
    let service: TokenService;
    let mockRepo: jest.Mocked<TokenRepository>;
    let mockCache: jest.Mocked<CacheService>;

    beforeEach(() => {
        mockRepo = {
            findByAddress: jest.fn(),
            save: jest.fn(),
        } as any;
        
        mockCache = {
            getOrSet: jest.fn(),
            invalidate: jest.fn(),
        } as any;

        service = new TokenService(mockRepo, mockCache);
    });

    describe('getToken', () => {
        it('should return cached token if available', async () => {
            const cachedToken = { address: '0x123', name: 'Test' };
            mockCache.getOrSet.mockResolvedValue(cachedToken);

            const result = await service.getToken('0x123');

            expect(result).toEqual(cachedToken);
            expect(mockCache.getOrSet).toHaveBeenCalledWith(
                'token:0x123',
                10,
                expect.any(Function)
            );
        });

        it('should fetch from DB on cache miss', async () => {
            const dbToken = { address: '0x123', name: 'Test' };
            mockCache.getOrSet.mockImplementation((key, ttl, fn) => fn());
            mockRepo.findByAddress.mockResolvedValue(dbToken);

            const result = await service.getToken('0x123');

            expect(result).toEqual(dbToken);
        });

        it('should throw NotFoundException if token not found', async () => {
            mockCache.getOrSet.mockImplementation((key, ttl, fn) => fn());
            mockRepo.findByAddress.mockResolvedValue(null);

            await expect(service.getToken('0x123'))
                .rejects.toThrow(NotFoundException);
        });
    });

    describe('calculatePrice', () => {
        it('should calculate price correctly from reserves', () => {
            const virtualNative = BigInt('1000000000000000000'); // 1 PUSH
            const virtualToken = BigInt('50000000000000000000000000'); // 50M tokens

            const price = service.calculatePrice(virtualNative, virtualToken);

            expect(price).toBe('0.00000002'); // 1 / 50M
        });
    });
});

// =============================================
// EXAMPLE: Bonding Curve Math Unit Test
// =============================================
describe('BondingCurveLibrary', () => {
    describe('getAmountOut', () => {
        it('should calculate correct buy amount', () => {
            const amountIn = BigInt('1000000000000000000'); // 1 PUSH
            const reserveIn = BigInt('1000000000000000000'); // 1 PUSH virtual
            const reserveOut = BigInt('50000000000000000000000000'); // 50M tokens

            const amountOut = BondingCurveLibrary.getAmountOut(
                amountIn,
                reserveIn,
                reserveOut
            );

            // With 1% fee, buying 1 PUSH should get ~25M tokens
            expect(amountOut).toBeGreaterThan(BigInt('24000000000000000000000000'));
            expect(amountOut).toBeLessThan(BigInt('26000000000000000000000000'));
        });

        it('should revert on zero input', () => {
            expect(() => BondingCurveLibrary.getAmountOut(
                BigInt(0),
                BigInt('1000'),
                BigInt('1000')
            )).toThrow('INSUFFICIENT_INPUT_AMOUNT');
        });
    });
});
```

### Integration Tests

```typescript
// =============================================
// EXAMPLE: API Integration Test
// =============================================
describe('TokenController (Integration)', () => {
    let app: INestApplication;
    let db: DataSource;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
        .overrideProvider(RPCService)
        .useValue(mockRPCService)
        .compile();

        app = moduleRef.createNestApplication();
        await app.init();
        
        db = moduleRef.get(DataSource);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Clean database before each test
        await db.query('TRUNCATE tokens, trades, users CASCADE');
    });

    describe('GET /api/v1/tokens', () => {
        it('should return paginated tokens', async () => {
            // Seed test data
            await seedTokens(db, 25);

            const response = await request(app.getHttpServer())
                .get('/api/v1/tokens')
                .query({ page: 1, limit: 10 })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(10);
            expect(response.body.meta.total).toBe(25);
            expect(response.body.meta.totalPages).toBe(3);
        });

        it('should filter by is_listed status', async () => {
            await seedTokens(db, 10, { is_listed: false });
            await seedTokens(db, 5, { is_listed: true });

            const response = await request(app.getHttpServer())
                .get('/api/v1/tokens')
                .query({ is_listed: true })
                .expect(200);

            expect(response.body.data).toHaveLength(5);
            expect(response.body.data.every(t => t.is_listed)).toBe(true);
        });

        it('should sort by market_cap descending', async () => {
            await seedTokens(db, 10);

            const response = await request(app.getHttpServer())
                .get('/api/v1/tokens')
                .query({ sort: 'market_cap', order: 'desc' })
                .expect(200);

            const marketCaps = response.body.data.map(t => parseFloat(t.market_cap));
            expect(marketCaps).toEqual([...marketCaps].sort((a, b) => b - a));
        });
    });

    describe('GET /api/v1/tokens/:address', () => {
        it('should return token details', async () => {
            const token = await seedToken(db, { address: '0x123abc' });

            const response = await request(app.getHttpServer())
                .get('/api/v1/tokens/0x123abc')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.address).toBe('0x123abc');
            expect(response.body.data.name).toBe(token.name);
        });

        it('should return 404 for non-existent token', async () => {
            const response = await request(app.getHttpServer())
                .get('/api/v1/tokens/0xnonexistent')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NOT_FOUND');
        });
    });

    describe('POST /api/v1/auth/verify', () => {
        it('should authenticate with valid wallet signature', async () => {
            const wallet = Wallet.createRandom();
            const message = 'Sign in to Hodl.fun';
            const signature = await wallet.signMessage(message);

            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/verify')
                .send({
                    wallet: wallet.address,
                    message,
                    signature,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
        });

        it('should reject invalid signature', async () => {
            const response = await request(app.getHttpServer())
                .post('/api/v1/auth/verify')
                .send({
                    wallet: '0x123',
                    message: 'Sign in to Hodl.fun',
                    signature: '0xinvalid',
                })
                .expect(401);

            expect(response.body.error.code).toBe('UNAUTHORIZED');
        });
    });
});
```

### E2E Tests

```typescript
// =============================================
// EXAMPLE: Full Flow E2E Test
// =============================================
describe('Token Lifecycle (E2E)', () => {
    let app: INestApplication;
    let wsClient: Socket;
    let authToken: string;

    beforeAll(async () => {
        // Start full application with test containers
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        // Authenticate
        authToken = await authenticateTestUser(app);

        // Connect WebSocket
        wsClient = io(`http://localhost:${app.getHttpServer().address().port}`, {
            auth: { token: authToken },
        });
    });

    afterAll(async () => {
        wsClient.close();
        await app.close();
    });

    it('should complete full token lifecycle: create → trade → graduate', async () => {
        // 1. Subscribe to global events
        const newTokenPromise = new Promise(resolve => {
            wsClient.on('new_token', resolve);
        });

        // 2. Create token (simulated indexer event)
        await simulateCreateCurveEvent({
            tokenAddress: '0xtoken123',
            curveAddress: '0xcurve123',
            creator: '0xcreator',
            name: 'Test Token',
            symbol: 'TEST',
        });

        // 3. Verify WebSocket received new_token event
        const newTokenEvent = await newTokenPromise;
        expect(newTokenEvent).toMatchObject({
            address: '0xtoken123',
            name: 'Test Token',
        });

        // 4. Verify token in API
        const tokenResponse = await request(app.getHttpServer())
            .get('/api/v1/tokens/0xtoken123')
            .expect(200);

        expect(tokenResponse.body.data.is_locked).toBe(false);
        expect(tokenResponse.body.data.is_listed).toBe(false);

        // 5. Subscribe to token-specific events
        wsClient.emit('subscribe:token', { address: '0xtoken123' });

        const tradePromise = new Promise(resolve => {
            wsClient.on('trade', resolve);
        });

        // 6. Simulate trades
        await simulateBuyEvent({
            tokenAddress: '0xtoken123',
            trader: '0xbuyer',
            amountIn: '1000000000000000000', // 1 PUSH
            amountOut: '25000000000000000000000000', // 25M tokens
        });

        // 7. Verify trade event received
        const tradeEvent = await tradePromise;
        expect(tradeEvent).toMatchObject({
            tokenAddress: '0xtoken123',
            type: 'buy',
        });

        // 8. Verify trade in API
        const tradesResponse = await request(app.getHttpServer())
            .get('/api/v1/tokens/0xtoken123/trades')
            .expect(200);

        expect(tradesResponse.body.data).toHaveLength(1);

        // 9. Simulate graduation
        const graduationPromise = new Promise(resolve => {
            wsClient.on('graduation', resolve);
        });

        await simulateLockEvent({ curveAddress: '0xcurve123' });
        await simulateListingEvent({
            tokenAddress: '0xtoken123',
            poolAddress: '0xpool123',
        });

        // 10. Verify graduation event
        const graduationEvent = await graduationPromise;
        expect(graduationEvent).toMatchObject({
            tokenAddress: '0xtoken123',
            poolAddress: '0xpool123',
        });

        // 11. Verify final token state
        const finalResponse = await request(app.getHttpServer())
            .get('/api/v1/tokens/0xtoken123')
            .expect(200);

        expect(finalResponse.body.data.is_locked).toBe(true);
        expect(finalResponse.body.data.is_listed).toBe(true);
        expect(finalResponse.body.data.pool_address).toBe('0xpool123');
    }, 30000); // 30 second timeout for E2E
});
```

### Load Testing

```javascript
// =============================================
// k6 LOAD TEST SCRIPT
// =============================================
// File: load-tests/api-load.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const tokenListTrend = new Trend('token_list_duration');
const wsTrend = new Trend('ws_message_latency');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 1000 },   // Ramp up to 1K users
        { duration: '5m', target: 5000 },   // Ramp up to 5K users
        { duration: '10m', target: 10000 }, // Ramp up to 10K users
        { duration: '5m', target: 10000 },  // Stay at 10K users
        { duration: '3m', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
        errors: ['rate<0.01'],               // Error rate under 1%
        ws_message_latency: ['p(95)<100'],  // WebSocket messages under 100ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

export default function () {
    // Scenario 1: Browse tokens (60% of traffic)
    if (Math.random() < 0.6) {
        browseTokens();
    }
    // Scenario 2: View token details (25% of traffic)
    else if (Math.random() < 0.85) {
        viewTokenDetails();
    }
    // Scenario 3: WebSocket connection (15% of traffic)
    else {
        websocketTest();
    }

    sleep(Math.random() * 2 + 1); // 1-3 second think time
}

function browseTokens() {
    const res = http.get(`${BASE_URL}/api/v1/tokens?page=1&limit=20`);
    
    tokenListTrend.add(res.timings.duration);
    
    check(res, {
        'tokens list status 200': (r) => r.status === 200,
        'tokens list has data': (r) => JSON.parse(r.body).data.length > 0,
    }) || errorRate.add(1);
}

function viewTokenDetails() {
    // First get a token address
    const listRes = http.get(`${BASE_URL}/api/v1/tokens?page=1&limit=1`);
    const tokens = JSON.parse(listRes.body).data;
    
    if (tokens.length > 0) {
        const address = tokens[0].address;
        
        // Get token details
        const detailRes = http.get(`${BASE_URL}/api/v1/tokens/${address}`);
        check(detailRes, {
            'token detail status 200': (r) => r.status === 200,
        }) || errorRate.add(1);
        
        // Get token trades
        const tradesRes = http.get(`${BASE_URL}/api/v1/tokens/${address}/trades`);
        check(tradesRes, {
            'token trades status 200': (r) => r.status === 200,
        }) || errorRate.add(1);
        
        // Get candles
        const candlesRes = http.get(`${BASE_URL}/api/v1/tokens/${address}/candles?interval=1h`);
        check(candlesRes, {
            'token candles status 200': (r) => r.status === 200,
        }) || errorRate.add(1);
    }
}

function websocketTest() {
    const startTime = Date.now();
    
    const res = ws.connect(WS_URL, {}, function (socket) {
        socket.on('open', () => {
            // Subscribe to a token
            socket.send(JSON.stringify({
                event: 'subscribe:token',
                data: { address: '0x123' },
            }));
        });

        socket.on('message', (data) => {
            const latency = Date.now() - startTime;
            wsTrend.add(latency);
        });

        socket.on('error', (e) => {
            errorRate.add(1);
        });

        // Keep connection for 10 seconds
        socket.setTimeout(() => {
            socket.close();
        }, 10000);
    });

    check(res, {
        'websocket connected': (r) => r && r.status === 101,
    }) || errorRate.add(1);
}

// =============================================
// RUN COMMAND
// =============================================
// k6 run --env BASE_URL=https://api.hodlfun.io load-tests/api-load.js
```

### Test Scripts (package.json)

```json
{
    "scripts": {
        "test": "jest",
        "test:watch": "jest --watch",
        "test:cov": "jest --coverage",
        "test:unit": "jest --testPathPattern=\\.unit\\.spec\\.ts$",
        "test:integration": "jest --testPathPattern=\\.integration\\.spec\\.ts$",
        "test:e2e": "jest --config ./test/jest-e2e.json",
        "test:load": "k6 run load-tests/api-load.js",
        "test:load:report": "k6 run --out json=results.json load-tests/api-load.js"
    }
}
```

### CI Test Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
    branches: [main, staging]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hodlfun_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/hodlfun_test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:e2e
```

---

## Local Development Setup

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ─────────────────────────────────────────
  # PostgreSQL + TimescaleDB
  # ─────────────────────────────────────────
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: hodlfun-postgres
    environment:
      POSTGRES_USER: hodlfun
      POSTGRES_PASSWORD: hodlfun_dev
      POSTGRES_DB: hodlfun
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hodlfun"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────
  # Redis
  # ─────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: hodlfun-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────
  # Redis Commander (GUI for Redis)
  # ─────────────────────────────────────────
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: hodlfun-redis-gui
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

  # ─────────────────────────────────────────
  # pgAdmin (GUI for PostgreSQL)
  # ─────────────────────────────────────────
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: hodlfun-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@hodlfun.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "8082:80"
    depends_on:
      - postgres

  # ─────────────────────────────────────────
  # API Service
  # ─────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: hodlfun-api
    command: npm run start:dev
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://hodlfun:hodlfun_dev@postgres:5432/hodlfun
      REDIS_URL: redis://redis:6379
      RPC_PRIMARY: ${RPC_PRIMARY:-https://evm.rpc-testnet-donut-node1.push.org/}
      RPC_FALLBACK: ${RPC_FALLBACK:-https://evm.rpc-testnet-donut-node2.push.org/}
      JWT_SECRET: dev-secret-change-in-production
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ─────────────────────────────────────────
  # WebSocket Service
  # ─────────────────────────────────────────
  websocket:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: hodlfun-websocket
    command: npm run start:ws:dev
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://hodlfun:hodlfun_dev@postgres:5432/hodlfun
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ─────────────────────────────────────────
  # Indexer Service
  # ─────────────────────────────────────────
  indexer:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: hodlfun-indexer
    command: npm run start:indexer:dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://hodlfun:hodlfun_dev@postgres:5432/hodlfun
      REDIS_URL: redis://redis:6379
      RPC_PRIMARY: ${RPC_PRIMARY:-https://evm.rpc-testnet-donut-node1.push.org/}
      RPC_FALLBACK: ${RPC_FALLBACK:-https://evm.rpc-testnet-donut-node2.push.org/}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ─────────────────────────────────────────
  # Worker Service
  # ─────────────────────────────────────────
  worker:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: hodlfun-worker
    command: npm run start:worker:dev
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://hodlfun:hodlfun_dev@postgres:5432/hodlfun
      REDIS_URL: redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

### Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Default command (overridden in docker-compose)
CMD ["npm", "run", "start:dev"]
```

### Environment Files

```bash
# .env.example
# =============================================
# Application
# =============================================
NODE_ENV=development
PORT=3000

# =============================================
# Database
# =============================================
DATABASE_URL=postgresql://hodlfun:hodlfun_dev@localhost:5432/hodlfun

# =============================================
# Redis
# =============================================
REDIS_URL=redis://localhost:6379

# =============================================
# JWT
# =============================================
JWT_SECRET=dev-secret-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# =============================================
# Push Chain RPC
# =============================================
RPC_PRIMARY=https://evm.rpc-testnet-donut-node1.push.org/
RPC_FALLBACK=https://evm.rpc-testnet-donut-node2.push.org/

# =============================================
# Contract Addresses (Testnet)
# =============================================
CORE_CONTRACT=0x592F8f0abbB9a3d3c425980Ac0263363C8405b03
FACTORY_CONTRACT=0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8
FEE_VAULT_CONTRACT=0xbe2fd9b720d1d7fac7208523376d2a3332019928
WPUSH_CONTRACT=0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7

# =============================================
# Monitoring (Optional for dev)
# =============================================
SENTRY_DSN=
```

### Makefile for Common Commands

```makefile
# Makefile

.PHONY: help dev stop logs clean db-migrate db-seed test

help:
	@echo "Available commands:"
	@echo "  make dev         - Start all services in development mode"
	@echo "  make stop        - Stop all services"
	@echo "  make logs        - View logs from all services"
	@echo "  make clean       - Stop and remove all containers and volumes"
	@echo "  make db-migrate  - Run database migrations"
	@echo "  make db-seed     - Seed database with test data"
	@echo "  make test        - Run all tests"
	@echo "  make shell-api   - Open shell in API container"

# Start development environment
dev:
	docker-compose up -d
	@echo ""
	@echo "Services started:"
	@echo "  API:            http://localhost:3000"
	@echo "  WebSocket:      http://localhost:3001"
	@echo "  pgAdmin:        http://localhost:8082"
	@echo "  Redis Commander: http://localhost:8081"

# Stop all services
stop:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

logs-api:
	docker-compose logs -f api

logs-indexer:
	docker-compose logs -f indexer

# Clean everything
clean:
	docker-compose down -v --remove-orphans
	docker system prune -f

# Database operations
db-migrate:
	docker-compose exec api npm run migration:run

db-seed:
	docker-compose exec api npm run seed

db-reset:
	docker-compose exec api npm run migration:revert
	docker-compose exec api npm run migration:run
	docker-compose exec api npm run seed

# Testing
test:
	npm run test

test-cov:
	npm run test:cov

test-e2e:
	docker-compose -f docker-compose.test.yml up -d
	npm run test:e2e
	docker-compose -f docker-compose.test.yml down

# Shell access
shell-api:
	docker-compose exec api sh

shell-db:
	docker-compose exec postgres psql -U hodlfun -d hodlfun
```

### Initial Database Script

```sql
-- scripts/init-db.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE hodlfun TO hodlfun;
```

### Quick Start Guide

```markdown
# Local Development Setup

## Prerequisites
- Docker & Docker Compose
- Node.js 20+
- npm 9+

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/hodlfun/backend.git
   cd backend
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start all services:
   ```bash
   make dev
   ```

4. Run migrations:
   ```bash
   make db-migrate
   ```

5. (Optional) Seed test data:
   ```bash
   make db-seed
   ```

## Access Points

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| WebSocket | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3000/api/docs |
| pgAdmin | http://localhost:8082 |
| Redis Commander | http://localhost:8081 |

## Common Commands

```bash
make dev          # Start all services
make stop         # Stop all services
make logs         # View all logs
make logs-api     # View API logs only
make test         # Run tests
make db-reset     # Reset database
make clean        # Remove all containers and volumes
```

## Troubleshooting

### Port already in use
```bash
make clean
make dev
```

### Database connection issues
```bash
docker-compose restart postgres
make db-migrate
```

### Node modules issues
```bash
rm -rf node_modules
npm ci
make clean
make dev
```
```

---

## Rollback Strategy

### Deployment Rollback

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROLLBACK DECISION TREE                               │
└─────────────────────────────────────────────────────────────────────────────┘

         Deployment Failed or Issues Detected
                        │
                        ▼
         ┌──────────────────────────────┐
         │  Is it a critical issue?     │
         │  (data loss, security, crash)│
         └──────────────┬───────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
           YES                      NO
            │                       │
            ▼                       ▼
    ┌───────────────┐      ┌───────────────┐
    │ IMMEDIATE     │      │ Can you       │
    │ ROLLBACK      │      │ hotfix?       │
    └───────┬───────┘      └───────┬───────┘
            │                      │
            │              ┌───────┴───────┐
            │              │               │
            │             YES              NO
            │              │               │
            │              ▼               ▼
            │      ┌───────────────┐ ┌───────────────┐
            │      │ Deploy hotfix │ │ Schedule      │
            │      │ (new version) │ │ rollback      │
            │      └───────────────┘ └───────┬───────┘
            │                                │
            └────────────────────────────────┘
                            │
                            ▼
                   Execute Rollback
```

### Kubernetes Rollback Commands

```bash
# =============================================
# QUICK ROLLBACK (Last Version)
# =============================================

# Rollback API to previous version
kubectl rollout undo deployment/api -n production

# Rollback all services
kubectl rollout undo deployment/api -n production
kubectl rollout undo deployment/websocket -n production
kubectl rollout undo deployment/indexer -n production
kubectl rollout undo deployment/worker -n production

# Check rollback status
kubectl rollout status deployment/api -n production

# =============================================
# ROLLBACK TO SPECIFIC VERSION
# =============================================

# View deployment history
kubectl rollout history deployment/api -n production

# Output:
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update to v1.0.1
# 3         Update to v1.0.2 (current)

# Rollback to specific revision
kubectl rollout undo deployment/api -n production --to-revision=2

# =============================================
# ROLLBACK VIA IMAGE TAG
# =============================================

# Set specific image version
kubectl set image deployment/api api=gcr.io/hodlfun/backend:v1.0.1 -n production

# Verify
kubectl get deployment api -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
```

### Database Migration Rollback

```typescript
// =============================================
// MIGRATION FILE STRUCTURE
// =============================================
// src/database/migrations/1706000000000-AddTokenStats.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenStats1706000000000 implements MigrationInterface {
    name = 'AddTokenStats1706000000000';

    // UP: Apply migration
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE tokens 
            ADD COLUMN holder_count INTEGER DEFAULT 0,
            ADD COLUMN total_volume NUMERIC(78, 18) DEFAULT 0
        `);
        
        await queryRunner.query(`
            CREATE INDEX idx_tokens_holder_count ON tokens(holder_count DESC)
        `);
    }

    // DOWN: Revert migration
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_tokens_holder_count
        `);
        
        await queryRunner.query(`
            ALTER TABLE tokens 
            DROP COLUMN IF EXISTS holder_count,
            DROP COLUMN IF EXISTS total_volume
        `);
    }
}
```

```bash
# =============================================
# MIGRATION ROLLBACK COMMANDS
# =============================================

# Revert last migration
npm run migration:revert

# Revert multiple migrations (run multiple times)
npm run migration:revert
npm run migration:revert
npm run migration:revert

# Show migration status
npm run migration:show

# =============================================
# EMERGENCY: Full Database Restore
# =============================================

# If migration caused data corruption, restore from backup
# See "Backup & Disaster Recovery" section
```

### Rollback Checklist

```markdown
## Pre-Rollback Checklist

- [ ] Identify the issue and affected services
- [ ] Notify team in Slack #incidents channel
- [ ] Determine rollback scope (single service vs all)
- [ ] Check if database migration needs rollback
- [ ] Verify target version is stable

## Rollback Execution

- [ ] Pause indexer (prevent new data inconsistency)
  ```bash
  kubectl scale deployment/indexer --replicas=0 -n production
  ```

- [ ] Rollback database migration (if needed)
  ```bash
  kubectl exec -it deploy/api -n production -- npm run migration:revert
  ```

- [ ] Rollback application
  ```bash
  kubectl rollout undo deployment/api -n production
  kubectl rollout undo deployment/websocket -n production
  kubectl rollout undo deployment/worker -n production
  ```

- [ ] Verify rollback successful
  ```bash
  kubectl rollout status deployment/api -n production
  ```

- [ ] Resume indexer
  ```bash
  kubectl scale deployment/indexer --replicas=2 -n production
  ```

- [ ] Verify indexer catching up
  ```bash
  curl https://api.hodlfun.io/health/detailed | jq .checks.indexer
  ```

## Post-Rollback

- [ ] Monitor error rates in Grafana
- [ ] Check Sentry for new errors
- [ ] Verify WebSocket connections stable
- [ ] Test critical user flows manually
- [ ] Update incident channel with status
- [ ] Schedule post-mortem
```

### GitHub Actions Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Emergency Rollback

on:
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to rollback'
        required: true
        type: choice
        options:
          - all
          - api
          - websocket
          - indexer
          - worker
      revision:
        description: 'Revision number (leave empty for previous)'
        required: false
        type: string
      include_db_rollback:
        description: 'Also rollback database migration?'
        required: false
        type: boolean
        default: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Get GKE credentials
        run: |
          gcloud container clusters get-credentials hodlfun-cluster --zone us-central1
      
      - name: Pause Indexer
        if: ${{ inputs.service == 'all' || inputs.include_db_rollback }}
        run: |
          kubectl scale deployment/indexer --replicas=0 -n production
          sleep 10
      
      - name: Rollback Database Migration
        if: ${{ inputs.include_db_rollback }}
        run: |
          kubectl exec deploy/api -n production -- npm run migration:revert
      
      - name: Rollback Services
        run: |
          SERVICES="${{ inputs.service }}"
          REVISION="${{ inputs.revision }}"
          
          if [ "$SERVICES" == "all" ]; then
            SERVICES="api websocket indexer worker"
          fi
          
          for svc in $SERVICES; do
            if [ -n "$REVISION" ]; then
              kubectl rollout undo deployment/$svc -n production --to-revision=$REVISION
            else
              kubectl rollout undo deployment/$svc -n production
            fi
          done
      
      - name: Wait for Rollback
        run: |
          SERVICES="${{ inputs.service }}"
          if [ "$SERVICES" == "all" ]; then
            SERVICES="api websocket worker"
          fi
          
          for svc in $SERVICES; do
            kubectl rollout status deployment/$svc -n production --timeout=5m
          done
      
      - name: Resume Indexer
        if: ${{ inputs.service == 'all' || inputs.include_db_rollback }}
        run: |
          kubectl scale deployment/indexer --replicas=2 -n production
      
      - name: Health Check
        run: |
          sleep 30
          curl -f https://api.hodlfun.io/health/ready || exit 1
      
      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🔄 Rollback ${{ job.status }}: ${{ inputs.service }} in production"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## API Documentation

### Swagger/OpenAPI Setup

```typescript
// =============================================
// main.ts - Swagger Configuration
// =============================================
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Swagger configuration
    const config = new DocumentBuilder()
        .setTitle('Hodl.fun API')
        .setDescription('API documentation for Hodl.fun token launchpad')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'Authorization',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth'
        )
        .addTag('auth', 'Authentication endpoints')
        .addTag('tokens', 'Token management')
        .addTag('trades', 'Trade history')
        .addTag('portfolio', 'User portfolio')
        .addTag('leaderboard', 'Rankings and leaderboards')
        .addTag('alerts', 'Price alerts')
        .addTag('admin', 'Admin endpoints')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    
    // Serve Swagger UI at /api/docs
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
        },
    });

    await app.listen(3000);
}
bootstrap();
```

### DTO Decorators for Documentation

```typescript
// =============================================
// Token DTOs with Swagger Decorators
// =============================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

// Request DTO
export class GetTokensQueryDto {
    @ApiPropertyOptional({
        description: 'Page number',
        minimum: 1,
        default: 1,
        example: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Items per page',
        minimum: 1,
        maximum: 100,
        default: 20,
        example: 20,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Sort field',
        enum: ['created_at', 'market_cap', 'volume', 'price'],
        default: 'created_at',
    })
    @IsOptional()
    @IsString()
    sort?: string = 'created_at';

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
    })
    @IsOptional()
    @IsString()
    order?: 'asc' | 'desc' = 'desc';

    @ApiPropertyOptional({
        description: 'Filter by graduation status',
        example: false,
    })
    @IsOptional()
    is_listed?: boolean;
}

// Response DTO
export class TokenResponseDto {
    @ApiProperty({
        description: 'Token contract address',
        example: '0x1234567890abcdef1234567890abcdef12345678',
    })
    address: string;

    @ApiProperty({
        description: 'Bonding curve contract address',
        example: '0xabcdef1234567890abcdef1234567890abcdef12',
    })
    curve_address: string;

    @ApiProperty({
        description: 'Token name',
        example: 'Moon Token',
    })
    name: string;

    @ApiProperty({
        description: 'Token symbol',
        example: 'MOON',
    })
    symbol: string;

    @ApiProperty({
        description: 'Current price in PUSH',
        example: '0.00000005',
    })
    current_price: string;

    @ApiProperty({
        description: 'Market cap in PUSH',
        example: '5000.00',
    })
    market_cap: string;

    @ApiProperty({
        description: 'Whether token has graduated to DEX',
        example: false,
    })
    is_listed: boolean;

    @ApiProperty({
        description: 'Token creation timestamp',
        example: '2025-01-22T10:30:00.000Z',
    })
    created_at: string;
}

export class PaginatedTokensResponseDto {
    @ApiProperty({
        description: 'Success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Array of tokens',
        type: [TokenResponseDto],
    })
    data: TokenResponseDto[];

    @ApiProperty({
        description: 'Pagination metadata',
        example: {
            page: 1,
            limit: 20,
            total: 150,
            totalPages: 8,
        },
    })
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
```

### Controller with Swagger Decorators

```typescript
// =============================================
// Token Controller with Full Documentation
// =============================================
import {
    Controller,
    Get,
    Param,
    Query,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { TokenService } from './token.service';
import { GetTokensQueryDto, TokenResponseDto, PaginatedTokensResponseDto } from './dto';

@ApiTags('tokens')
@Controller('api/v1/tokens')
export class TokenController {
    constructor(private readonly tokenService: TokenService) {}

    @Get()
    @ApiOperation({
        summary: 'List all tokens',
        description: 'Returns a paginated list of tokens with optional filtering and sorting.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Tokens retrieved successfully',
        type: PaginatedTokensResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid query parameters',
    })
    async getTokens(@Query() query: GetTokensQueryDto): Promise<PaginatedTokensResponseDto> {
        return this.tokenService.getTokens(query);
    }

    @Get(':address')
    @ApiOperation({
        summary: 'Get token by address',
        description: 'Returns detailed information about a specific token.',
    })
    @ApiParam({
        name: 'address',
        description: 'Token contract address',
        example: '0x1234567890abcdef1234567890abcdef12345678',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Token found',
        type: TokenResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Token not found',
    })
    async getToken(@Param('address') address: string): Promise<TokenResponseDto> {
        return this.tokenService.getToken(address);
    }

    @Get(':address/trades')
    @ApiOperation({
        summary: 'Get token trades',
        description: 'Returns paginated trade history for a specific token.',
    })
    @ApiParam({
        name: 'address',
        description: 'Token contract address',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Trades retrieved successfully',
    })
    async getTokenTrades(
        @Param('address') address: string,
        @Query() query: GetTokensQueryDto,
    ) {
        return this.tokenService.getTokenTrades(address, query);
    }

    @Get(':address/candles')
    @ApiOperation({
        summary: 'Get OHLCV candles',
        description: 'Returns candlestick data for charting.',
    })
    @ApiParam({
        name: 'address',
        description: 'Token contract address',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Candles retrieved successfully',
    })
    async getCandles(
        @Param('address') address: string,
        @Query('interval') interval: string = '1h',
        @Query('limit') limit: number = 100,
    ) {
        return this.tokenService.getCandles(address, interval, limit);
    }
}
```

### Protected Endpoints Documentation

```typescript
// =============================================
// Alerts Controller (Protected)
// =============================================
@ApiTags('alerts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/alerts')
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) {}

    @Get()
    @ApiOperation({
        summary: 'Get user alerts',
        description: 'Returns all price alerts for the authenticated user.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Alerts retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Not authenticated',
    })
    async getAlerts(@CurrentUser() user: User) {
        return this.alertsService.getUserAlerts(user.id);
    }

    @Post()
    @ApiOperation({
        summary: 'Create price alert',
        description: 'Create a new price alert for a token.',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Alert created successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid alert data',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Not authenticated',
    })
    async createAlert(
        @CurrentUser() user: User,
        @Body() dto: CreateAlertDto,
    ) {
        return this.alertsService.createAlert(user.id, dto);
    }
}
```

### WebSocket Documentation

```typescript
// =============================================
// WebSocket Events Documentation (README)
// =============================================

/**
 * # WebSocket API
 * 
 * Connect to: `wss://api.hodlfun.io/socket.io`
 * 
 * ## Authentication
 * Pass JWT token in handshake auth:
 * ```javascript
 * const socket = io('wss://api.hodlfun.io', {
 *     auth: { token: 'your-jwt-token' }
 * });
 * ```
 * 
 * ## Client → Server Events
 * 
 * ### subscribe:token
 * Subscribe to real-time updates for a specific token.
 * ```javascript
 * socket.emit('subscribe:token', { address: '0x...' });
 * ```
 * 
 * ### unsubscribe:token
 * Unsubscribe from token updates.
 * ```javascript
 * socket.emit('unsubscribe:token', { address: '0x...' });
 * ```
 * 
 * ### subscribe:portfolio
 * Subscribe to portfolio updates (requires auth).
 * ```javascript
 * socket.emit('subscribe:portfolio', { wallet: '0x...' });
 * ```
 * 
 * ## Server → Client Events
 * 
 * ### new_token
 * Emitted when a new token is created.
 * ```javascript
 * socket.on('new_token', (data) => {
 *     // data: { address, name, symbol, creator, initialPrice, timestamp }
 * });
 * ```
 * 
 * ### trade
 * Emitted when a trade occurs (after subscribing to token).
 * ```javascript
 * socket.on('trade', (data) => {
 *     // data: { tokenAddress, type, trader, amountIn, amountOut, price, txHash, timestamp }
 * });
 * ```
 * 
 * ### price_update
 * Emitted when price changes (after subscribing to token).
 * ```javascript
 * socket.on('price_update', (data) => {
 *     // data: { tokenAddress, price, priceChange24h, marketCap, timestamp }
 * });
 * ```
 * 
 * ### graduation
 * Emitted when a token graduates to DEX.
 * ```javascript
 * socket.on('graduation', (data) => {
 *     // data: { tokenAddress, poolAddress, timestamp }
 * });
 * ```
 */
```

### Generated OpenAPI Spec Export

```typescript
// =============================================
// Export OpenAPI spec to JSON file
// =============================================
// scripts/generate-openapi.ts

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';

async function generateSpec() {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
        .setTitle('Hodl.fun API')
        .setDescription('API documentation for Hodl.fun token launchpad')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    
    // Write to file
    fs.writeFileSync(
        './docs/openapi.json',
        JSON.stringify(document, null, 2)
    );
    
    console.log('OpenAPI spec generated: ./docs/openapi.json');
    
    await app.close();
}

generateSpec();
```

```bash
# Generate OpenAPI spec
npx ts-node scripts/generate-openapi.ts

# Generate TypeScript client from spec (for frontend)
npx openapi-typescript-codegen \
    --input ./docs/openapi.json \
    --output ./client-sdk \
    --client axios
```

### API Documentation URLs

| Environment | Swagger UI | OpenAPI Spec |
|-------------|------------|--------------|
| Development | http://localhost:3000/api/docs | http://localhost:3000/api/docs-json |
| Staging | https://staging-api.hodlfun.io/api/docs | https://staging-api.hodlfun.io/api/docs-json |
| Production | https://api.hodlfun.io/api/docs | https://api.hodlfun.io/api/docs-json |

---

## Cost Estimates

### Monthly Costs (10K+ Users)

| Service | Specification | Estimated Cost |
|---------|---------------|----------------|
| **GKE Autopilot** | Pay per pod (auto-scaled) | ~$100-150 |
| **Cloud SQL** | db-standard-2, 50GB | ~$80 |
| **Memorystore** | 5GB Standard | ~$60 |
| **Load Balancer** | Ingress + rules | ~$30 |
| **Cloud NAT** | Outbound traffic | ~$40 |
| **Artifact Registry** | Image storage | ~$10 |
| **Cloud Storage** | Backups + token images | ~$15 |
| **Cloud CDN** | Image delivery | ~$20 |
| **Network Egress** | Data transfer | ~$30 |
| **Secret Manager** | Secrets | ~$5 |
| | | |
| **Total** | | **~$390-450/month** |

### Scaling Costs

| Traffic Level | Estimated Monthly Cost |
|---------------|------------------------|
| Low (1K users) | $150-220 |
| Medium (10K users) | $390-500 |
| High (50K users) | $600-800 |
| Very High (100K+ users) | $1000-1400 |

> **Note:** GKE Autopilot costs scale with actual usage. During low traffic, costs decrease automatically. During high traffic, costs increase but you only pay for what you use.

---

## Quick Reference

### Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/hodlfun
DATABASE_SSL=true

# Redis
REDIS_URL=redis://host:6379
REDIS_PASSWORD=xxx

# JWT
JWT_SECRET=xxx
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Push Chain RPC
RPC_PRIMARY=https://primary.push.org
RPC_FALLBACK=https://fallback.push.org

# Contract Addresses
CORE_CONTRACT=0x592F8f0abbB9a3d3c425980Ac0263363C8405b03
FACTORY_CONTRACT=0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8
FEE_VAULT_CONTRACT=0xbe2fd9b720d1d7fac7208523376d2a3332019928
WPUSH_CONTRACT=0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# External
CLARITY_ID=xxx
```

### Commands

```bash
# Development
npm run start:dev          # Start API in dev mode
npm run start:ws:dev       # Start WebSocket in dev mode
npm run start:indexer:dev  # Start indexer in dev mode
npm run start:worker:dev   # Start worker in dev mode

# Testing
npm run test               # Run unit tests
npm run test:e2e           # Run e2e tests
npm run test:cov           # Run tests with coverage

# Database
npm run migration:generate # Generate migration
npm run migration:run      # Run migrations
npm run seed               # Run seeders

# Production
npm run build              # Build all services
npm run start:prod         # Start in production
```

---

*Last Updated: January 2025*
*Version: 2.0*
*Platform: Hodl.fun on Push Chain*
