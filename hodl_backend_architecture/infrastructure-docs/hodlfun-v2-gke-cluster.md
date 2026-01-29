# Hodl.fun V2 - GKE Cluster Architecture

## Table of Contents
1. [Overview](#overview)
2. [Why GKE Autopilot](#why-gke-autopilot)
3. [Cluster Architecture](#cluster-architecture)
4. [Services Overview](#services-overview)
5. [API Service](#api-service)
6. [WebSocket Service](#websocket-service)
7. [Indexer Service](#indexer-service)
8. [Worker Service](#worker-service)
9. [Shared Resources](#shared-resources)
10. [Networking Inside Cluster](#networking-inside-cluster)
11. [Scaling & Autoscaling](#scaling--autoscaling)
12. [Deployments & Updates](#deployments--updates)
13. [Monitoring & Logging](#monitoring--logging)
14. [Complete Kubernetes Manifests](#complete-kubernetes-manifests)

---

## Overview

### What This Document Covers

This document details everything running inside the GKE cluster - all services, their responsibilities, endpoints, Kubernetes resources, and how they communicate.

### Architecture Position

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           TRAFFIC FLOW                                      │
└────────────────────────────────────────────────────────────────────────────┘

User → Cloudflare → GCP Load Balancer → [GKE Cluster] → Managed Services
                                        └────────────┘
                                         THIS DOCUMENT
```

### What Runs Inside GKE

| Service | Type | Replicas | External Access |
|---------|------|----------|-----------------|
| API | Deployment | 2-10 | Yes (via Ingress) |
| WebSocket | Deployment | 2-10 | Yes (via Ingress) |
| Indexer | Deployment | 2 | No |
| Worker | Deployment | 2-5 | No |

---

## Why GKE Autopilot

### GKE Standard vs Autopilot

| Feature | GKE Standard | GKE Autopilot |
|---------|--------------|---------------|
| Node Management | You manage | Google manages |
| Node Provisioning | Manual | Automatic |
| Node Upgrades | Manual | Automatic |
| Security Patches | Manual | Automatic |
| Pricing | Pay per node | Pay per pod |
| Cluster Autoscaler | Configure yourself | Built-in |
| Node Pools | Manage yourself | Automatic |
| Overhead | High | Low |

### Why Autopilot for Hodl.fun

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY AUTOPILOT IS PERFECT FOR US                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. STARTUP EFFICIENCY
─────────────────────────────────────────────────────────────────────────────
   - No DevOps team needed for infrastructure
   - Focus on application, not nodes
   - Faster time to market


2. COST OPTIMIZATION
─────────────────────────────────────────────────────────────────────────────
   Standard: Pay for 3 nodes even if pods use 30% capacity
   
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │   Node 1    │ │   Node 2    │ │   Node 3    │
   │ ┌───┐       │ │ ┌───┐       │ │ ┌───┐       │
   │ │Pod│  70%  │ │ │Pod│  70%  │ │ │Pod│  70%  │
   │ └───┘ empty │ │ └───┘ empty │ │ └───┘ empty │
   └─────────────┘ └─────────────┘ └─────────────┘
   Cost: $150/month (full node price)

   Autopilot: Pay only for pod resources
   
   ┌───┐ ┌───┐ ┌───┐
   │Pod│ │Pod│ │Pod│
   └───┘ └───┘ └───┘
   Cost: $50/month (actual usage)


3. AUTOMATIC SCALING
─────────────────────────────────────────────────────────────────────────────
   Token launch → Traffic spike 10x
   
   Autopilot automatically:
   - Provisions new nodes
   - Schedules new pods
   - Scales down when traffic drops


4. SECURITY
─────────────────────────────────────────────────────────────────────────────
   - Nodes hardened by Google
   - Automatic security patches
   - No SSH access (reduced attack surface)
   - Workload identity enforced
```

### Autopilot Limitations (And Why They're OK)

| Limitation | Impact on Us | Mitigation |
|------------|--------------|------------|
| No SSH to nodes | Can't debug at node level | Use Cloud Logging, kubectl exec |
| No DaemonSets | Can't run per-node agents | Use GKE add-ons (logging, monitoring) |
| No privileged pods | Can't run some tools | Not needed for our workload |
| Resource requests required | Must specify CPU/memory | Good practice anyway |
| Min resources | 250m CPU, 512Mi memory | Our pods need more anyway |

---

## Cluster Architecture

### Complete Cluster Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GKE AUTOPILOT CLUSTER                                │
│                         Namespace: default                                   │
└─────────────────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────────────────┐
│  │                        INGRESS LAYER                                  │
│  │                                                                       │
│  │   ┌─────────────────────────────────────────────────────────────┐    │
│  │   │                    hodlfun-ingress                          │    │
│  │   │                                                             │    │
│  │   │   /api/*      ──────────────► api-service:3000              │    │
│  │   │   /health/*   ──────────────► api-service:3000              │    │
│  │   │   /socket.io/* ─────────────► websocket-service:3001        │    │
│  │   │   /*          ──────────────► api-service:3000              │    │
│  │   │                                                             │    │
│  │   └─────────────────────────────────────────────────────────────┘    │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────────────────┐
│  │                     EXTERNAL SERVICES                                 │
│  │                     (Accessible via Load Balancer)                    │
│  │                                                                       │
│  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │   │       API SERVICE           │   │    WEBSOCKET SERVICE        │  │
│  │   │                             │   │                             │  │
│  │   │  Service: api-service       │   │  Service: websocket-service │  │
│  │   │  Port: 3000                 │   │  Port: 3001                 │  │
│  │   │  Type: ClusterIP + NEG      │   │  Type: ClusterIP + NEG      │  │
│  │   │                             │   │                             │  │
│  │   │  ┌─────────────────────┐    │   │  ┌─────────────────────┐    │  │
│  │   │  │   api-deployment    │    │   │  │ websocket-deployment│    │  │
│  │   │  │                     │    │   │  │                     │    │  │
│  │   │  │  ┌───┐ ┌───┐ ┌───┐  │    │   │  │  ┌───┐ ┌───┐ ┌───┐  │    │  │
│  │   │  │  │ 1 │ │ 2 │ │ 3 │  │    │   │  │  │ 1 │ │ 2 │ │ 3 │  │    │  │
│  │   │  │  └───┘ └───┘ └───┘  │    │   │  │  └───┘ └───┘ └───┘  │    │  │
│  │   │  │                     │    │   │  │                     │    │  │
│  │   │  │  Replicas: 2-10     │    │   │  │  Replicas: 2-10     │    │  │
│  │   │  │  HPA: CPU/Memory    │    │   │  │  HPA: Connections   │    │  │
│  │   │  └─────────────────────┘    │   │  └─────────────────────┘    │  │
│  │   │                             │   │                             │  │
│  │   │  BackendConfig:             │   │  BackendConfig:             │  │
│  │   │  - Timeout: 30s             │   │  - Timeout: 3600s           │  │
│  │   │  - Session: None            │   │  - Session: Cookie          │  │
│  │   │                             │   │                             │  │
│  │   └─────────────────────────────┘   └─────────────────────────────┘  │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────────────────┐
│  │                     INTERNAL SERVICES                                 │
│  │                     (No external access)                              │
│  │                                                                       │
│  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐  │
│  │   │      INDEXER SERVICE        │   │      WORKER SERVICE         │  │
│  │   │                             │   │                             │  │
│  │   │  Service: None (no inbound) │   │  Service: None (no inbound) │  │
│  │   │                             │   │                             │  │
│  │   │  ┌─────────────────────┐    │   │  ┌─────────────────────┐    │  │
│  │   │  │ indexer-deployment  │    │   │  │  worker-deployment  │    │  │
│  │   │  │                     │    │   │  │                     │    │  │
│  │   │  │  ┌───┐ ┌───┐        │    │   │  │  ┌───┐ ┌───┐ ┌───┐  │    │  │
│  │   │  │  │ 1 │ │ 2 │        │    │   │  │  │ 1 │ │ 2 │ │ 3 │  │    │  │
│  │   │  │  └───┘ └───┘        │    │   │  │  └───┘ └───┘ └───┘  │    │  │
│  │   │  │                     │    │   │  │                     │    │  │
│  │   │  │  Replicas: 2        │    │   │  │  Replicas: 2-5      │    │  │
│  │   │  │  HPA: None (fixed)  │    │   │  │  HPA: Queue depth   │    │  │
│  │   │  └─────────────────────┘    │   │  └─────────────────────┘    │  │
│  │   │                             │   │                             │  │
│  │   │  Responsibilities:          │   │  Responsibilities:          │  │
│  │   │  - Watch blockchain         │   │  - Process job queues       │  │
│  │   │  - Parse events             │   │  - Candle aggregation       │  │
│  │   │  - Write to DB              │   │  - Price alerts             │  │
│  │   │  - Publish to Redis         │   │  - Cleanup tasks            │  │
│  │   │                             │   │                             │  │
│  │   └─────────────────────────────┘   └─────────────────────────────┘  │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────────┘
│
│  ┌───────────────────────────────────────────────────────────────────────┐
│  │                     CONFIGURATION                                     │
│  │                                                                       │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   │    ConfigMap     │  │     Secret       │  │  BackendConfig   │   │
│  │   │                  │  │                  │  │                  │   │
│  │   │ - App settings   │  │ - DB password    │  │ - api-backend    │   │
│  │   │ - Redis host     │  │ - Redis password │  │ - ws-backend     │   │
│  │   │ - RPC URLs       │  │ - JWT secret     │  │                  │   │
│  │   │ - Feature flags  │  │ - API keys       │  │                  │   │
│  │   │                  │  │                  │  │                  │   │
│  │   └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│  │                                                                       │
│  └───────────────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Private Network Connection
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MANAGED SERVICES (Outside GKE)                       │
│                                                                             │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│   │    Cloud SQL        │  │    Memorystore      │  │   Cloud Storage     │ │
│   │    (PostgreSQL)     │  │    (Redis)          │  │   (Images)          │ │
│   │                     │  │                     │  │                     │ │
│   │  Private IP:        │  │  Private IP:        │  │  Via Service        │ │
│   │  10.10.0.3:5432     │  │  10.10.0.5:6379     │  │  Account            │ │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Services Overview

### Service Comparison

| Aspect | API | WebSocket | Indexer | Worker |
|--------|-----|-----------|---------|--------|
| **External Access** | Yes | Yes | No | No |
| **Port** | 3000 | 3001 | 3002 | 3003 |
| **Protocol** | HTTP/REST | WebSocket | N/A | N/A |
| **Stateless** | Yes | No (connections) | Yes | Yes |
| **Min Replicas** | 2 | 2 | 2 | 2 |
| **Max Replicas** | 10 | 10 | 2 | 5 |
| **HPA Metric** | CPU | Connections | None | Queue depth |
| **Needs Redis** | Yes (cache) | Yes (pub/sub) | Yes (pub/sub) | Yes (queues) |
| **Needs PostgreSQL** | Yes | No | Yes | Yes |
| **Needs Internet** | No | No | Yes (RPC) | No |

### Request Types Per Service

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW BY TYPE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

HTTP REST Requests (via Load Balancer):
─────────────────────────────────────────────────────────────────────────────
GET  /api/v1/tokens           ──► API Service
POST /api/v1/tokens           ──► API Service
GET  /api/v1/trades           ──► API Service
POST /api/v1/alerts           ──► API Service
GET  /health/ready            ──► API Service


WebSocket Connections (via Load Balancer):
─────────────────────────────────────────────────────────────────────────────
WS   /socket.io/*             ──► WebSocket Service


Internal (No external access):
─────────────────────────────────────────────────────────────────────────────
Blockchain events             ──► Indexer (pulls from RPC)
Job queue processing          ──► Worker (pulls from Redis)
```

---

## API Service

### Overview

The API service handles all REST API requests - the main interface for frontend applications.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API SERVICE                                        │
└─────────────────────────────────────────────────────────────────────────────┘

                         Load Balancer
                              │
                              │ /api/*, /health/*
                              ▼
                    ┌───────────────────┐
                    │   api-service     │
                    │   (ClusterIP)     │
                    │   Port: 3000      │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ API Pod 1│   │ API Pod 2│   │ API Pod 3│
        │          │   │          │   │          │
        │ NestJS   │   │ NestJS   │   │ NestJS   │
        │ App      │   │ App      │   │ App      │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │PostgreSQL│  │  Redis   │  │  Cloud   │
        │          │  │  Cache   │  │  Storage │
        └──────────┘  └──────────┘  └──────────┘
```

### Responsibilities

| Responsibility | Description |
|----------------|-------------|
| REST API | Handle all HTTP endpoints |
| Authentication | JWT validation, wallet signature verification |
| Rate Limiting | Per-IP rate limiting using CF headers |
| Validation | Input validation, sanitization |
| Caching | Redis cache for frequent queries |
| File Upload | Token image uploads to Cloud Storage |

### API Routes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTES                                         │
└─────────────────────────────────────────────────────────────────────────────┘

HEALTH ENDPOINTS
═══════════════════════════════════════════════════════════════════════════════
GET  /health/ready              Health check for load balancer
GET  /health/live               Liveness probe for Kubernetes


AUTHENTICATION
═══════════════════════════════════════════════════════════════════════════════
POST /api/v1/auth/nonce         Get nonce for wallet signature
POST /api/v1/auth/verify        Verify wallet signature, get JWT
POST /api/v1/auth/refresh       Refresh JWT token
POST /api/v1/auth/logout        Invalidate refresh token


TOKENS
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/tokens                     List tokens (paginated, filterable)
GET  /api/v1/tokens/:address            Get single token details
GET  /api/v1/tokens/:address/holders    Get token holders
GET  /api/v1/tokens/:address/chart      Get price chart data
POST /api/v1/tokens                     Create new token (authenticated)
PUT  /api/v1/tokens/:address            Update token metadata (owner only)

Query Parameters for GET /api/v1/tokens:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - sort: string (created_at, market_cap, volume_24h, price)
  - order: asc | desc
  - search: string (name, symbol, address)
  - status: active | graduated | all


TRADES
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/trades                     List all trades (paginated)
GET  /api/v1/trades/:address            Trades for specific token
GET  /api/v1/trades/user/:wallet        Trades for specific user

Query Parameters:
  - page: number
  - limit: number
  - type: buy | sell | all


USERS
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/users/:wallet              Get user profile
PUT  /api/v1/users/:wallet              Update profile (authenticated, self only)
GET  /api/v1/users/:wallet/tokens       Tokens created by user
GET  /api/v1/users/:wallet/holdings     Token holdings


COMMENTS
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/comments/:tokenAddress     Get comments for token
POST /api/v1/comments                   Post comment (authenticated)
DELETE /api/v1/comments/:id             Delete comment (owner only)


ALERTS (Authenticated)
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/alerts                     List user's alerts
POST /api/v1/alerts                     Create price alert
PUT  /api/v1/alerts/:id                 Update alert
DELETE /api/v1/alerts/:id               Delete alert


UPLOAD
═══════════════════════════════════════════════════════════════════════════════
POST /api/v1/upload/image               Upload token image (authenticated)
                                        Returns: Cloud Storage URL


STATS
═══════════════════════════════════════════════════════════════════════════════
GET  /api/v1/stats/overview             Platform statistics
GET  /api/v1/stats/trending             Trending tokens
GET  /api/v1/stats/new                  Recently created tokens
```

### Request/Response Examples

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GET /api/v1/tokens?page=1&limit=20&sort=market_cap       │
└─────────────────────────────────────────────────────────────────────────────┘

Request:
─────────────────────────────────────────────────────────────────────────────
GET /api/v1/tokens?page=1&limit=20&sort=market_cap&order=desc HTTP/1.1
Host: api.hodlfun.io
Authorization: Bearer <optional-jwt>


Response:
─────────────────────────────────────────────────────────────────────────────
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "address": "0x1234567890abcdef...",
      "name": "Moon Token",
      "symbol": "MOON",
      "description": "To the moon!",
      "imageUrl": "https://storage.googleapis.com/hodlfun/tokens/0x123.png",
      "creatorAddress": "0xabcdef...",
      "createdAt": "2024-01-15T10:30:00Z",
      "marketCap": 150000.50,
      "price": 0.00015,
      "priceChange24h": 12.5,
      "volume24h": 25000.00,
      "holderCount": 150,
      "status": "active",
      "bondingCurveProgress": 45.5
    },
    // ... more tokens
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1250,
    "totalPages": 63
  }
}


┌─────────────────────────────────────────────────────────────────────────────┐
│                    POST /api/v1/tokens                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Request:
─────────────────────────────────────────────────────────────────────────────
POST /api/v1/tokens HTTP/1.1
Host: api.hodlfun.io
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "Awesome Token",
  "symbol": "AWE",
  "description": "The most awesome token ever",
  "imageUrl": "https://storage.googleapis.com/hodlfun/uploads/temp123.png",
  "twitter": "https://twitter.com/awesometoken",
  "telegram": "https://t.me/awesometoken",
  "website": "https://awesometoken.io"
}


Response:
─────────────────────────────────────────────────────────────────────────────
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "address": "0xnewtoken...",
    "name": "Awesome Token",
    "symbol": "AWE",
    "transactionHash": "0xtx...",
    "status": "pending"
  },
  "message": "Token creation initiated. Confirm transaction in your wallet."
}
```

### API Module Structure (NestJS)

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       # /api/v1/auth/*
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── wallet.strategy.ts
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts
│   │       └── wallet-auth.guard.ts
│   │
│   ├── tokens/
│   │   ├── tokens.module.ts
│   │   ├── tokens.controller.ts     # /api/v1/tokens/*
│   │   ├── tokens.service.ts
│   │   ├── dto/
│   │   │   ├── create-token.dto.ts
│   │   │   ├── update-token.dto.ts
│   │   │   └── query-token.dto.ts
│   │   └── entities/
│   │       └── token.entity.ts
│   │
│   ├── trades/
│   │   ├── trades.module.ts
│   │   ├── trades.controller.ts     # /api/v1/trades/*
│   │   └── trades.service.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts      # /api/v1/users/*
│   │   └── users.service.ts
│   │
│   ├── comments/
│   │   ├── comments.module.ts
│   │   ├── comments.controller.ts   # /api/v1/comments/*
│   │   └── comments.service.ts
│   │
│   ├── alerts/
│   │   ├── alerts.module.ts
│   │   ├── alerts.controller.ts     # /api/v1/alerts/*
│   │   └── alerts.service.ts
│   │
│   ├── upload/
│   │   ├── upload.module.ts
│   │   ├── upload.controller.ts     # /api/v1/upload/*
│   │   └── upload.service.ts
│   │
│   ├── stats/
│   │   ├── stats.module.ts
│   │   ├── stats.controller.ts      # /api/v1/stats/*
│   │   └── stats.service.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts     # /health/*
│
├── common/
│   ├── middleware/
│   │   └── real-ip.middleware.ts
│   ├── guards/
│   │   └── cloudflare-throttler.guard.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── utils/
│       └── cloudflare.utils.ts
│
└── config/
    ├── database.config.ts
    ├── redis.config.ts
    └── app.config.ts
```

### Kubernetes Resources for API

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
  labels:
    app: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: hodlfun-api-sa
      containers:
        - name: api
          image: gcr.io/hodlfun/api:latest
          ports:
            - containerPort: 3000
          
          # Resource requests (required for Autopilot)
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          
          # Environment variables
          envFrom:
            - configMapRef:
                name: hodlfun-config
            - secretRef:
                name: hodlfun-secrets
          
          # Health checks
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          
          # Graceful shutdown
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]
      
      # Pod termination grace period
      terminationGracePeriodSeconds: 30
```

---

## WebSocket Service

### Overview

The WebSocket service handles all real-time connections using Socket.IO.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET SERVICE                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                         Load Balancer
                              │
                              │ /socket.io/*
                              │ (Sticky Session Cookie)
                              ▼
                    ┌───────────────────┐
                    │ websocket-service │
                    │   (ClusterIP)     │
                    │   Port: 3001      │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  WS Pod 1│   │  WS Pod 2│   │  WS Pod 3│
        │          │   │          │   │          │
        │ Socket.IO│   │ Socket.IO│   │ Socket.IO│
        │ Server   │   │ Server   │   │ Server   │
        │          │   │          │   │          │
        │ Clients: │   │ Clients: │   │ Clients: │
        │ 100-500  │   │ 100-500  │   │ 100-500  │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                            │ Subscribe to Redis Pub/Sub
                            ▼
                      ┌──────────┐
                      │  Redis   │
                      │  Pub/Sub │
                      └──────────┘
                            ▲
                            │ Publish events
                            │
                      ┌──────────┐
                      │ Indexer  │
                      └──────────┘
```

### Responsibilities

| Responsibility | Description |
|----------------|-------------|
| WebSocket Connections | Manage persistent client connections |
| Room Management | Subscribe/unsubscribe clients to token rooms |
| Event Distribution | Push events to subscribed clients |
| Redis Pub/Sub | Receive events from Indexer |
| Connection Limits | Limit connections per IP |

### WebSocket Events

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET EVENTS                                      │
└─────────────────────────────────────────────────────────────────────────────┘

CLIENT → SERVER (Emit)
═══════════════════════════════════════════════════════════════════════════════

subscribe
─────────────────────────────────────────────────────────────────────────────
Description: Subscribe to a token's updates
Payload:     { token: "0x123..." }
Response:    { success: true, token: "0x123...", room: "token:0x123" }

unsubscribe
─────────────────────────────────────────────────────────────────────────────
Description: Unsubscribe from a token
Payload:     { token: "0x123..." }
Response:    { success: true }

subscribe:global
─────────────────────────────────────────────────────────────────────────────
Description: Subscribe to global events (new tokens, trending)
Payload:     { }
Response:    { success: true, room: "global" }

ping
─────────────────────────────────────────────────────────────────────────────
Description: Keep connection alive
Payload:     { }
Response:    { event: "pong", timestamp: 1706123456789 }


SERVER → CLIENT (Push)
═══════════════════════════════════════════════════════════════════════════════

trade
─────────────────────────────────────────────────────────────────────────────
Description: New trade occurred
Room:        token:0x123
Payload: {
  type: "buy" | "sell",
  token: "0x123...",
  trader: "0xabc...",
  amount: 1000,
  price: 0.00005,
  priceUsd: 0.15,
  totalValue: 150,
  newPrice: 0.000052,
  newMarketCap: 52000,
  timestamp: 1706123456789,
  txHash: "0xtx..."
}

price:update
─────────────────────────────────────────────────────────────────────────────
Description: Price changed (batched, every 2s)
Room:        token:0x123
Payload: {
  token: "0x123...",
  price: 0.000052,
  priceUsd: 0.156,
  marketCap: 52000,
  volume24h: 15000,
  priceChange24h: 5.2,
  timestamp: 1706123456789
}

comment:new
─────────────────────────────────────────────────────────────────────────────
Description: New comment posted
Room:        token:0x123
Payload: {
  id: "comment-uuid",
  token: "0x123...",
  author: "0xabc...",
  authorName: "CryptoFan",
  content: "Great project!",
  timestamp: 1706123456789
}

holder:update
─────────────────────────────────────────────────────────────────────────────
Description: Holder count changed
Room:        token:0x123
Payload: {
  token: "0x123...",
  holderCount: 156,
  topHolders: [
    { address: "0x...", balance: 50000, percentage: 5.0 },
    // ...
  ]
}

token:graduated
─────────────────────────────────────────────────────────────────────────────
Description: Token graduated to DEX
Room:        token:0x123, global
Payload: {
  token: "0x123...",
  name: "Moon Token",
  symbol: "MOON",
  dexPair: "0xpair...",
  finalMarketCap: 69000,
  timestamp: 1706123456789
}

token:new (Global room)
─────────────────────────────────────────────────────────────────────────────
Description: New token created
Room:        global
Payload: {
  address: "0x123...",
  name: "New Token",
  symbol: "NEW",
  creator: "0xabc...",
  imageUrl: "https://...",
  timestamp: 1706123456789
}
```

### WebSocket Module Structure

```
src/
├── main.ts
├── app.module.ts
│
├── websocket/
│   ├── websocket.module.ts
│   ├── websocket.gateway.ts         # Main Socket.IO gateway
│   ├── websocket.service.ts         # Business logic
│   │
│   ├── handlers/
│   │   ├── subscription.handler.ts  # Handle subscribe/unsubscribe
│   │   ├── trade.handler.ts         # Handle trade events
│   │   └── price.handler.ts         # Handle price updates
│   │
│   ├── redis/
│   │   ├── redis-subscriber.ts      # Subscribe to Redis channels
│   │   └── redis-publisher.ts       # Publish to Redis (for cross-pod)
│   │
│   └── dto/
│       ├── subscribe.dto.ts
│       └── trade-event.dto.ts
│
├── health/
│   └── health.controller.ts         # /health/ready for LB
│
└── config/
    ├── redis.config.ts
    └── websocket.config.ts
```

### How Cross-Pod Communication Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-POD WEBSOCKET COMMUNICATION                         │
└─────────────────────────────────────────────────────────────────────────────┘

Problem: User A is connected to WS Pod 1, User B to WS Pod 2
         Both subscribed to token 0x123
         How do both receive trade events?

Solution: Redis Pub/Sub

                         ┌──────────────────────────────────────────┐
                         │              REDIS                       │
                         │                                          │
                         │   Channel: trade:0x123                   │
                         │                                          │
                         │   Subscribers:                           │
                         │   - WS Pod 1 ✓                           │
                         │   - WS Pod 2 ✓                           │
                         │   - WS Pod 3 ✓                           │
                         │                                          │
                         └────────────────┬─────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
             ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
             │  WS Pod 1   │       │  WS Pod 2   │       │  WS Pod 3   │
             │             │       │             │       │             │
             │  User A ────│───────│─────────────│───────│─► Receives  │
             │  (0x123)    │       │  User B ────│───────│─► Receives  │
             │             │       │  (0x123)    │       │             │
             │  User C     │       │             │       │  User D     │
             │  (0x456)    │       │             │       │  (0x789)    │
             └─────────────┘       └─────────────┘       └─────────────┘

Flow:
1. Indexer detects trade on token 0x123
2. Indexer publishes to Redis channel "trade:0x123"
3. All WS pods receive the message (they're all subscribed)
4. Each pod checks which of its clients are in room "token:0x123"
5. Each pod pushes to only its subscribed clients
```

### Kubernetes Resources for WebSocket

```yaml
# websocket-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-deployment
  labels:
    app: websocket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: websocket
  template:
    metadata:
      labels:
        app: websocket
    spec:
      serviceAccountName: hodlfun-ws-sa
      containers:
        - name: websocket
          image: gcr.io/hodlfun/websocket:latest
          ports:
            - containerPort: 3001
          
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          
          envFrom:
            - configMapRef:
                name: hodlfun-config
            - secretRef:
                name: hodlfun-secrets
          
          # WebSocket-specific env
          env:
            - name: WS_MAX_CONNECTIONS_PER_IP
              value: "10"
            - name: WS_PING_INTERVAL
              value: "25000"
            - name: WS_PING_TIMEOUT
              value: "10000"
          
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
          
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          
          # Longer grace period for WebSocket
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 30"]
      
      # Longer termination for graceful disconnect
      terminationGracePeriodSeconds: 60
```

---

## Indexer Service

### Overview

The Indexer watches the blockchain for events and processes them.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEXER SERVICE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         PUSH CHAIN                  │
                    │         (Blockchain)                │
                    │                                     │
                    │   Block 1001: Trade event           │
                    │   Block 1002: Token created         │
                    │   Block 1003: Trade event           │
                    │                                     │
                    └──────────────┬──────────────────────┘
                                   │
                                   │ WebSocket RPC subscription
                                   │ (or polling)
                                   ▼
                    ┌─────────────────────────────────────┐
                    │         INDEXER PODS                │
                    │                                     │
                    │   ┌─────────────┐ ┌─────────────┐   │
                    │   │  Pod 1      │ │  Pod 2      │   │
                    │   │  (Leader)   │ │  (Standby)  │   │
                    │   │             │ │             │   │
                    │   │  Watching:  │ │  Ready to   │   │
                    │   │  - Trades   │ │  take over  │   │
                    │   │  - Tokens   │ │             │   │
                    │   │  - Transfers│ │             │   │
                    │   └──────┬──────┘ └─────────────┘   │
                    │          │                          │
                    └──────────┼──────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │PostgreSQL│    │  Redis   │    │  Redis   │
        │          │    │  Pub/Sub │    │  Cache   │
        │  Write   │    │  Publish │    │  Update  │
        └──────────┘    └──────────┘    └──────────┘
```

### Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Block Watching | Monitor new blocks on Push Chain |
| Event Parsing | Parse Trade, TokenCreated, Transfer events |
| Data Persistence | Write trades, update token prices to DB |
| Event Publishing | Publish to Redis for WebSocket |
| Cache Invalidation | Update/invalidate Redis cache |
| Leader Election | Only one pod actively processes (via Redis lock) |

### Events Indexed

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEXED EVENTS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

TokenCreated
─────────────────────────────────────────────────────────────────────────────
Source:     BondingCurveFactory contract
When:       New token deployed via factory
Data:       Token address, creator, name, symbol, initial supply
Actions:
  1. Insert new token record in PostgreSQL
  2. Publish "token:new" to Redis global channel
  3. Initialize token cache in Redis


Trade (Buy/Sell)
─────────────────────────────────────────────────────────────────────────────
Source:     BondingCurve contract for each token
When:       User buys or sells token
Data:       Trader, token, amount, price, type (buy/sell), tx hash
Actions:
  1. Insert trade record in PostgreSQL
  2. Update token price, market cap, volume in PostgreSQL
  3. Publish "trade:0x123" to Redis for WebSocket
  4. Update token cache in Redis
  5. Queue candle update job for Worker


Transfer
─────────────────────────────────────────────────────────────────────────────
Source:     ERC20 token contract
When:       Token transferred between wallets
Data:       From, to, amount, token address
Actions:
  1. Update holder balances in PostgreSQL
  2. Update holder count if new holder
  3. Publish "holder:update" to Redis


TokenGraduated
─────────────────────────────────────────────────────────────────────────────
Source:     BondingCurve contract
When:       Market cap reaches graduation threshold
Data:       Token address, final price, DEX pair address
Actions:
  1. Update token status to "graduated" in PostgreSQL
  2. Publish "token:graduated" to Redis
  3. Notify all subscribers
```

### Indexer Module Structure

```
src/
├── main.ts
├── app.module.ts
│
├── indexer/
│   ├── indexer.module.ts
│   ├── indexer.service.ts           # Main indexer orchestration
│   │
│   ├── blockchain/
│   │   ├── blockchain.module.ts
│   │   ├── rpc.service.ts           # RPC connection management
│   │   ├── block-watcher.ts         # Watch new blocks
│   │   └── event-decoder.ts         # Decode contract events
│   │
│   ├── processors/
│   │   ├── trade.processor.ts       # Process Trade events
│   │   ├── token.processor.ts       # Process TokenCreated events
│   │   ├── transfer.processor.ts    # Process Transfer events
│   │   └── graduation.processor.ts  # Process graduation events
│   │
│   ├── persistence/
│   │   ├── trade.repository.ts      # Trade DB operations
│   │   ├── token.repository.ts      # Token DB operations
│   │   └── holder.repository.ts     # Holder DB operations
│   │
│   ├── publisher/
│   │   └── redis-publisher.ts       # Publish to Redis Pub/Sub
│   │
│   └── leader/
│       └── leader-election.ts       # Redis-based leader election
│
├── health/
│   └── health.controller.ts
│
└── config/
    ├── rpc.config.ts
    ├── database.config.ts
    └── redis.config.ts
```

### Leader Election Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LEADER ELECTION (REDIS LOCK)                              │
└─────────────────────────────────────────────────────────────────────────────┘

Why: We run 2 indexer pods for high availability, but only ONE should
     process events at a time to avoid duplicate processing.

How: Redis distributed lock with TTL

                    ┌─────────────────────────────────────┐
                    │              REDIS                  │
                    │                                     │
                    │   Key: indexer:leader:lock          │
                    │   Value: pod-1-uuid                 │
                    │   TTL: 30 seconds                   │
                    │                                     │
                    └─────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
           ▼                                                   ▼
    ┌─────────────┐                                     ┌─────────────┐
    │  Pod 1      │                                     │  Pod 2      │
    │  (LEADER)   │                                     │  (STANDBY)  │
    │             │                                     │             │
    │  Lock: ✓    │                                     │  Lock: ✗    │
    │  Processing │                                     │  Waiting    │
    │  events     │                                     │             │
    └─────────────┘                                     └─────────────┘

Flow:
1. On startup, both pods try to acquire lock: SET indexer:leader:lock <uuid> NX EX 30
2. Only one succeeds (Pod 1)
3. Pod 1 renews lock every 10 seconds
4. Pod 2 retries every 10 seconds, fails, stays standby
5. If Pod 1 crashes:
   - Lock expires after 30 seconds
   - Pod 2 acquires lock, becomes leader
   - Processing continues with minimal gap
```

### Kubernetes Resources for Indexer

```yaml
# indexer-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: indexer-deployment
  labels:
    app: indexer
spec:
  replicas: 2  # Fixed at 2 for leader/standby
  selector:
    matchLabels:
      app: indexer
  template:
    metadata:
      labels:
        app: indexer
    spec:
      serviceAccountName: hodlfun-indexer-sa
      containers:
        - name: indexer
          image: gcr.io/hodlfun/indexer:latest
          
          # No port exposed - indexer doesn't receive traffic
          
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          
          envFrom:
            - configMapRef:
                name: hodlfun-config
            - secretRef:
                name: hodlfun-secrets
          
          # Indexer-specific env
          env:
            - name: RPC_URL
              valueFrom:
                secretKeyRef:
                  name: hodlfun-secrets
                  key: PUSH_RPC_URL
            - name: LEADER_LOCK_TTL
              value: "30000"
            - name: LEADER_RENEW_INTERVAL
              value: "10000"
          
          # Liveness only (no readiness needed - no traffic)
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3002
            initialDelaySeconds: 30
            periodSeconds: 10
          
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]
      
      terminationGracePeriodSeconds: 30
```

---

## Worker Service

### Overview

The Worker processes background jobs from Redis queues.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORKER SERVICE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │              REDIS                  │
                    │            (BullMQ)                 │
                    │                                     │
                    │   Queue: candles                    │
                    │   Queue: alerts                     │
                    │   Queue: cleanup                    │
                    │   Queue: notifications              │
                    │                                     │
                    └──────────────┬──────────────────────┘
                                   │
                                   │ BRPOPLPUSH (blocking pop)
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │  Worker 1   │         │  Worker 2   │         │  Worker 3   │
    │             │         │             │         │             │
    │  Processing:│         │  Processing:│         │  Processing:│
    │  - Candles  │         │  - Alerts   │         │  - Cleanup  │
    │  - Alerts   │         │  - Candles  │         │  - Notifs   │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                                   ▼
                            ┌──────────┐
                            │PostgreSQL│
                            └──────────┘
```

### Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Candle Aggregation | Aggregate trades into 1m, 5m, 15m, 1h, 4h, 1d candles |
| Price Alerts | Check alerts and notify users when triggered |
| Data Cleanup | Clean old data, archive trades |
| Notifications | Send push notifications, emails |
| Scheduled Tasks | Recurring tasks (hourly stats, daily reports) |

### Job Queues

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOB QUEUES                                         │
└─────────────────────────────────────────────────────────────────────────────┘

CANDLES QUEUE
═══════════════════════════════════════════════════════════════════════════════
Purpose:    Aggregate trade data into OHLCV candles
Triggered:  After each trade (debounced)
Priority:   High
Concurrency: 5

Job Data:
{
  "type": "aggregate",
  "tokenAddress": "0x123...",
  "tradeId": "trade-uuid",
  "timestamp": 1706123456789
}

Processing:
1. Get recent trades for token
2. Calculate OHLCV for affected time periods
3. Upsert candle records in PostgreSQL
4. Update cache


ALERTS QUEUE
═══════════════════════════════════════════════════════════════════════════════
Purpose:    Check and trigger price alerts
Triggered:  After price changes
Priority:   Medium
Concurrency: 10

Job Data:
{
  "type": "check",
  "tokenAddress": "0x123...",
  "currentPrice": 0.00005,
  "previousPrice": 0.000048
}

Processing:
1. Get all active alerts for token
2. Check if any alert conditions met
3. If triggered:
   - Mark alert as triggered
   - Queue notification job
   - Optionally disable alert


CLEANUP QUEUE
═══════════════════════════════════════════════════════════════════════════════
Purpose:    Clean old data, maintain database health
Triggered:  Scheduled (cron)
Priority:   Low
Concurrency: 2

Job Types:
- archive_old_trades: Move trades > 90 days to archive
- cleanup_sessions: Remove expired sessions
- vacuum_tables: PostgreSQL maintenance
- cleanup_temp_uploads: Remove unused uploaded images


NOTIFICATIONS QUEUE
═══════════════════════════════════════════════════════════════════════════════
Purpose:    Send notifications to users
Triggered:  By other jobs or events
Priority:   Medium
Concurrency: 20

Job Data:
{
  "type": "push" | "email" | "webhook",
  "userId": "user-uuid",
  "title": "Price Alert Triggered",
  "body": "MOON token reached $0.05",
  "data": { ... }
}
```

### Candle Aggregation Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CANDLE AGGREGATION                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Trade comes in at 14:32:45
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    AFFECTED CANDLES                                       │
│                                                                           │
│   1m candle:  14:32:00 - 14:32:59   ← Update                             │
│   5m candle:  14:30:00 - 14:34:59   ← Update                             │
│   15m candle: 14:30:00 - 14:44:59   ← Update                             │
│   1h candle:  14:00:00 - 14:59:59   ← Update                             │
│   4h candle:  12:00:00 - 15:59:59   ← Update                             │
│   1d candle:  00:00:00 - 23:59:59   ← Update                             │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

For each candle period:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   SELECT                                                                    │
│     MIN(price) as low,                                                      │
│     MAX(price) as high,                                                     │
│     FIRST_VALUE(price) as open,   -- first trade in period                 │
│     LAST_VALUE(price) as close,   -- last trade in period                  │
│     SUM(amount * price) as volume                                          │
│   FROM trades                                                               │
│   WHERE token_address = '0x123'                                            │
│     AND timestamp >= period_start                                          │
│     AND timestamp < period_end                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Result stored in candles table:
┌────────────┬───────────┬───────────┬────────┬────────┬────────┬───────────┐
│ token      │ period    │ timestamp │ open   │ high   │ low    │ close     │
├────────────┼───────────┼───────────┼────────┼────────┼────────┼───────────┤
│ 0x123...   │ 1m        │ 14:32:00  │ 0.0500 │ 0.0520 │ 0.0498 │ 0.0515    │
│ 0x123...   │ 5m        │ 14:30:00  │ 0.0495 │ 0.0520 │ 0.0492 │ 0.0515    │
│ ...        │ ...       │ ...       │ ...    │ ...    │ ...    │ ...       │
└────────────┴───────────┴───────────┴────────┴────────┴────────┴───────────┘
```

### Worker Module Structure

```
src/
├── main.ts
├── app.module.ts
│
├── worker/
│   ├── worker.module.ts
│   ├── worker.service.ts            # Main worker orchestration
│   │
│   ├── processors/
│   │   ├── candle.processor.ts      # Candle aggregation
│   │   ├── alert.processor.ts       # Price alerts
│   │   ├── cleanup.processor.ts     # Data cleanup
│   │   └── notification.processor.ts # Notifications
│   │
│   ├── jobs/
│   │   ├── candle.job.ts
│   │   ├── alert.job.ts
│   │   ├── cleanup.job.ts
│   │   └── notification.job.ts
│   │
│   └── schedulers/
│       ├── cleanup.scheduler.ts     # Cron jobs
│       └── stats.scheduler.ts
│
├── health/
│   └── health.controller.ts
│
└── config/
    ├── bullmq.config.ts
    ├── database.config.ts
    └── redis.config.ts
```

### Kubernetes Resources for Worker

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-deployment
  labels:
    app: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      serviceAccountName: hodlfun-worker-sa
      containers:
        - name: worker
          image: gcr.io/hodlfun/worker:latest
          
          # No port exposed - worker doesn't receive traffic
          
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          
          envFrom:
            - configMapRef:
                name: hodlfun-config
            - secretRef:
                name: hodlfun-secrets
          
          # Worker-specific env
          env:
            - name: CANDLE_QUEUE_CONCURRENCY
              value: "5"
            - name: ALERT_QUEUE_CONCURRENCY
              value: "10"
            - name: CLEANUP_QUEUE_CONCURRENCY
              value: "2"
          
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3003
            initialDelaySeconds: 30
            periodSeconds: 10
          
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 30"]  # Let jobs complete
      
      # Longer grace period for job completion
      terminationGracePeriodSeconds: 120
```

---

## Shared Resources

### ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hodlfun-config
data:
  # Application
  NODE_ENV: "production"
  PORT: "3000"
  WS_PORT: "3001"
  
  # Database
  DB_HOST: "10.10.0.3"  # Cloud SQL private IP
  DB_PORT: "5432"
  DB_NAME: "hodlfun"
  DB_SSL: "true"
  
  # Redis
  REDIS_HOST: "10.10.0.5"  # Memorystore private IP
  REDIS_PORT: "6379"
  
  # Push Chain
  CHAIN_ID: "1"
  
  # Features
  FEATURE_ALERTS: "true"
  FEATURE_NOTIFICATIONS: "true"
  
  # Rate Limiting
  RATE_LIMIT_TTL: "60"
  RATE_LIMIT_LIMIT: "100"
  
  # Cache TTLs
  CACHE_TOKEN_TTL: "60"
  CACHE_TRADE_TTL: "30"
  
  # CORS
  CORS_ORIGIN: "https://hodlfun.io"
  
  # Logging
  LOG_LEVEL: "info"
```

### Secrets

```yaml
# secrets.yaml (values are base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: hodlfun-secrets
type: Opaque
data:
  # Database
  DB_USER: aG9kbGZ1bg==                    # hodlfun
  DB_PASSWORD: c3VwZXJzZWNyZXQ=            # supersecret
  
  # Redis (if auth enabled)
  REDIS_PASSWORD: cmVkaXNwYXNz             # redispass
  
  # JWT
  JWT_SECRET: and0c2VjcmV0MTIz             # jwtsecret123
  JWT_REFRESH_SECRET: cmVmcmVzaHNlY3JldA== # refreshsecret
  
  # RPC
  PUSH_RPC_URL: aHR0cHM6Ly9ycGMuY2hhaW4=  # https://rpc.chain
  PUSH_RPC_WS_URL: d3NzOi8vcnBjLmNoYWlu   # wss://rpc.chain
  
  # Cloud Storage
  GCS_BUCKET: aG9kbGZ1bi1pbWFnZXM=         # hodlfun-images
  
  # External APIs (if any)
  COINGECKO_API_KEY: Y29pbmdlY2tva2V5     # coingeckokey
```

### Service Accounts

```yaml
# service-accounts.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hodlfun-api-sa
  annotations:
    iam.gke.io/gcp-service-account: hodlfun-api@project.iam.gserviceaccount.com
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hodlfun-ws-sa
  annotations:
    iam.gke.io/gcp-service-account: hodlfun-ws@project.iam.gserviceaccount.com
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hodlfun-indexer-sa
  annotations:
    iam.gke.io/gcp-service-account: hodlfun-indexer@project.iam.gserviceaccount.com
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hodlfun-worker-sa
  annotations:
    iam.gke.io/gcp-service-account: hodlfun-worker@project.iam.gserviceaccount.com
```

---

## Networking Inside Cluster

### Service Discovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KUBERNETES SERVICE DISCOVERY                              │
└─────────────────────────────────────────────────────────────────────────────┘

Internal DNS names (within cluster):
─────────────────────────────────────────────────────────────────────────────
api-service.default.svc.cluster.local:3000
websocket-service.default.svc.cluster.local:3001

Short form (within same namespace):
─────────────────────────────────────────────────────────────────────────────
api-service:3000
websocket-service:3001


But actually, services don't call each other directly!
─────────────────────────────────────────────────────────────────────────────
All communication goes through:
- Redis (Pub/Sub, Cache, Queues)
- PostgreSQL (Data persistence)

No direct pod-to-pod HTTP calls needed.
```

### Network Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERNAL NETWORK FLOWS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    EXTERNAL
                    (Load Balancer)
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    ┌─────────────┐             ┌─────────────┐
    │   API       │             │  WebSocket  │
    │   Pods      │             │   Pods      │
    └──────┬──────┘             └──────┬──────┘
           │                           │
           │         INTERNAL          │
           │    (Private Network)      │
           │                           │
           ├───────────────────────────┤
           │                           │
    ┌──────┴──────┐             ┌──────┴──────┐
    │  Indexer    │             │   Worker    │
    │   Pods      │             │   Pods      │
    └──────┬──────┘             └──────┬──────┘
           │                           │
           │                           │
           └─────────────┬─────────────┘
                         │
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ PostgreSQL  │   │   Redis     │   │   Cloud     │
│ 10.10.0.3   │   │ 10.10.0.5   │   │   Storage   │
│ :5432       │   │ :6379       │   │   (GCS)     │
└─────────────┘   └─────────────┘   └─────────────┘


Data Flow Types:
─────────────────────────────────────────────────────────────────────────────
→  Database query/write    (PostgreSQL)
→  Cache read/write        (Redis)
→  Pub/Sub message         (Redis)
→  Job queue               (Redis)
→  File upload/download    (Cloud Storage)


Network Policies Applied:
─────────────────────────────────────────────────────────────────────────────
1. API/WS pods: Allow ingress from Load Balancer only
2. All pods: Allow egress to Redis, PostgreSQL
3. Indexer pods: Allow egress to internet (RPC only)
4. Deny all other traffic
```

---

## Scaling & Autoscaling

### Horizontal Pod Autoscaler (HPA)

```yaml
# hpa-api.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
---
# hpa-websocket.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: websocket-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: websocket-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30  # Faster scale up for traffic spikes
      policies:
        - type: Pods
          value: 3
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 600  # Slow scale down (WS connections)
      policies:
        - type: Pods
          value: 1
          periodSeconds: 300
---
# hpa-worker.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker-deployment
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: External
      external:
        metric:
          name: redis_bullmq_queue_size
          selector:
            matchLabels:
              queue: "all"
        target:
          type: AverageValue
          averageValue: "100"  # Scale when queue > 100 jobs per pod
```

### Scaling Behavior

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCALING SCENARIOS                                         │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Token Launch (Traffic Spike)
─────────────────────────────────────────────────────────────────────────────

Time 0:00 - Normal traffic
  API: 2 pods (30% CPU)
  WS:  2 pods (200 connections each)

Time 0:05 - Token announced, traffic 3x
  API: 2 pods → 70% CPU → HPA triggers
  WS:  2 pods → 500 connections each

Time 0:06 - HPA scales up
  API: 2 → 4 pods
  WS:  2 → 4 pods

Time 0:10 - Traffic 5x, continuing
  API: 4 pods → 80% CPU → HPA triggers again
  WS:  4 pods → still high

Time 0:11 - HPA scales up more
  API: 4 → 6 pods
  WS:  4 → 7 pods

Time 0:30 - Traffic normalizes
  Stabilization window starts

Time 0:40 - Scale down begins slowly
  API: 6 → 5 pods
  WS:  7 → 6 pods (slower due to connections)


SCENARIO 2: Job Queue Backlog
─────────────────────────────────────────────────────────────────────────────

Time 0:00 - Normal
  Worker: 2 pods
  Queue depth: 20 jobs

Time 0:05 - Many trades → Queue grows
  Worker: 2 pods
  Queue depth: 250 jobs (125 per pod > 100 threshold)

Time 0:06 - HPA triggers
  Worker: 2 → 3 pods
  Queue depth: 250 → processing

Time 0:10 - Queue still high
  Worker: 3 → 4 pods

Time 0:15 - Queue cleared
  Queue depth: 30 jobs
  Stabilization window starts

Time 0:25 - Scale down
  Worker: 4 → 3 → 2 pods
```

---

## Deployments & Updates

### Rolling Update Strategy

```yaml
# In deployment spec
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0      # Never reduce below desired
      maxSurge: 1            # Add 1 pod at a time
```

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLLING UPDATE PROCESS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Current state: 3 pods running v1.0.0
Target state: 3 pods running v1.1.0

Step 1: Create new pod
─────────────────────────────────────────────────────────────────────────────
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ v1.0.0│ │ v1.0.0│ │ v1.0.0│ │ v1.1.0│ ← Creating
│  ✓    │ │  ✓    │ │  ✓    │ │  ...  │
└───────┘ └───────┘ └───────┘ └───────┘


Step 2: New pod ready, terminate old
─────────────────────────────────────────────────────────────────────────────
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ v1.0.0│ │ v1.0.0│ │ v1.0.0│ │ v1.1.0│
│  ✓    │ │  ✓    │ │ Term  │ │  ✓    │ ← Ready
└───────┘ └───────┘ └───────┘ └───────┘
                        ↑
                   Terminating


Step 3: Repeat for next pod
─────────────────────────────────────────────────────────────────────────────
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ v1.0.0│ │ v1.0.0│ │ v1.1.0│ │ v1.1.0│
│  ✓    │ │ Term  │ │  ✓    │ │  ✓    │
└───────┘ └───────┘ └───────┘ └───────┘


Step 4: Complete
─────────────────────────────────────────────────────────────────────────────
┌───────┐ ┌───────┐ ┌───────┐
│ v1.1.0│ │ v1.1.0│ │ v1.1.0│
│  ✓    │ │  ✓    │ │  ✓    │
└───────┘ └───────┘ └───────┘

All pods now running v1.1.0
Zero downtime achieved
```

### Graceful Shutdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GRACEFUL SHUTDOWN PROCESS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

When pod receives SIGTERM:

1. preStop hook runs (sleep 10-30s)
   ─────────────────────────────────────────────────────────────────────────
   - Pod still in service endpoints
   - Load balancer stops sending NEW requests
   - Existing requests continue processing

2. SIGTERM sent to application
   ─────────────────────────────────────────────────────────────────────────
   - NestJS onModuleDestroy() called
   - Stop accepting new connections
   - Finish processing current requests
   - Close database connections
   - Unsubscribe from Redis

3. terminationGracePeriodSeconds countdown
   ─────────────────────────────────────────────────────────────────────────
   - API: 30 seconds
   - WebSocket: 60 seconds (longer for client disconnect)
   - Worker: 120 seconds (let jobs complete)

4. SIGKILL if not terminated
   ─────────────────────────────────────────────────────────────────────────
   - Force kill if graceful shutdown didn't complete
```

---

## Monitoring & Logging

### Logging Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOGGING ARCHITECTURE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Application logs → stdout/stderr
        │
        ▼
GKE logging agent (automatic in Autopilot)
        │
        ▼
Cloud Logging
        │
        ▼
Log-based metrics → Cloud Monitoring
        │
        ▼
Alerts
```

### Log Format (Structured JSON)

```json
{
  "timestamp": "2024-01-25T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "pod": "api-deployment-abc123",
  "traceId": "abc123def456",
  "message": "Request processed",
  "context": {
    "method": "GET",
    "path": "/api/v1/tokens",
    "statusCode": 200,
    "duration": 45,
    "ip": "103.45.67.89",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Key Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEY METRICS TO MONITOR                                    │
└─────────────────────────────────────────────────────────────────────────────┘

APPLICATION METRICS
═══════════════════════════════════════════════════════════════════════════════
- Request rate (requests/second)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active connections (WebSocket)
- Queue depth (BullMQ)


RESOURCE METRICS
═══════════════════════════════════════════════════════════════════════════════
- CPU utilization per pod
- Memory utilization per pod
- Network I/O
- Pod restarts


DATABASE METRICS
═══════════════════════════════════════════════════════════════════════════════
- Query latency
- Connection pool usage
- Slow queries
- Deadlocks


REDIS METRICS
═══════════════════════════════════════════════════════════════════════════════
- Memory usage
- Connected clients
- Pub/Sub channels
- Queue sizes


BUSINESS METRICS
═══════════════════════════════════════════════════════════════════════════════
- Tokens created per hour
- Trades per minute
- Active users (WebSocket connections)
- API calls per endpoint
```

### Alerting Rules

```yaml
# Example Cloud Monitoring alert policies

# High Error Rate
- displayName: "High API Error Rate"
  conditions:
    - conditionThreshold:
        filter: |
          resource.type="k8s_container"
          resource.labels.container_name="api"
          metric.type="logging.googleapis.com/user/error_count"
        comparison: COMPARISON_GT
        thresholdValue: 10
        duration: "60s"
  notificationChannels: ["slack", "pagerduty"]

# High Latency
- displayName: "High API Latency"
  conditions:
    - conditionThreshold:
        filter: |
          resource.type="k8s_container"
          metric.labels.path="/api/v1/tokens"
        comparison: COMPARISON_GT
        thresholdValue: 500  # 500ms
        duration: "120s"
  notificationChannels: ["slack"]

# Pod Restarts
- displayName: "Pod Restart Loop"
  conditions:
    - conditionThreshold:
        filter: |
          resource.type="k8s_container"
          metric.type="kubernetes.io/container/restart_count"
        comparison: COMPARISON_GT
        thresholdValue: 3
        duration: "300s"
  notificationChannels: ["pagerduty"]
```

---

## Complete Kubernetes Manifests

### Directory Structure

```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.yaml                    # (gitignored, use sealed-secrets or external)
│
├── api/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   └── backend-config.yaml
│
├── websocket/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   └── backend-config.yaml
│
├── indexer/
│   └── deployment.yaml
│
├── worker/
│   ├── deployment.yaml
│   └── hpa.yaml
│
├── ingress/
│   ├── ingress.yaml
│   └── managed-certificate.yaml
│
├── service-accounts/
│   └── service-accounts.yaml
│
└── network-policies/
    └── network-policies.yaml
```

### Apply Order

```bash
# 1. Namespace and config
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# 2. Service accounts
kubectl apply -f k8s/service-accounts/

# 3. Backend configs (before services)
kubectl apply -f k8s/api/backend-config.yaml
kubectl apply -f k8s/websocket/backend-config.yaml

# 4. Deployments
kubectl apply -f k8s/api/deployment.yaml
kubectl apply -f k8s/websocket/deployment.yaml
kubectl apply -f k8s/indexer/deployment.yaml
kubectl apply -f k8s/worker/deployment.yaml

# 5. Services
kubectl apply -f k8s/api/service.yaml
kubectl apply -f k8s/websocket/service.yaml

# 6. HPAs
kubectl apply -f k8s/api/hpa.yaml
kubectl apply -f k8s/websocket/hpa.yaml
kubectl apply -f k8s/worker/hpa.yaml

# 7. Ingress (creates load balancer)
kubectl apply -f k8s/ingress/managed-certificate.yaml
kubectl apply -f k8s/ingress/ingress.yaml

# 8. Network policies (optional, for extra security)
kubectl apply -f k8s/network-policies/
```

---

## Summary

### Services Inside GKE

| Service | Type | Port | Replicas | External | HPA |
|---------|------|------|----------|----------|-----|
| API | Deployment | 3000 | 2-10 | Yes | CPU/Memory |
| WebSocket | Deployment | 3001 | 2-10 | Yes | CPU/Memory |
| Indexer | Deployment | 3002 | 2 | No | None |
| Worker | Deployment | 3003 | 2-5 | No | Queue depth |

### API Routes Summary

| Category | Routes | Auth |
|----------|--------|------|
| Health | `/health/*` | No |
| Auth | `/api/v1/auth/*` | Partial |
| Tokens | `/api/v1/tokens/*` | Partial |
| Trades | `/api/v1/trades/*` | No |
| Users | `/api/v1/users/*` | Partial |
| Comments | `/api/v1/comments/*` | Partial |
| Alerts | `/api/v1/alerts/*` | Yes |
| Upload | `/api/v1/upload/*` | Yes |
| Stats | `/api/v1/stats/*` | No |

### WebSocket Events Summary

| Direction | Events |
|-----------|--------|
| Client → Server | subscribe, unsubscribe, subscribe:global, ping |
| Server → Client | trade, price:update, comment:new, holder:update, token:graduated, token:new |

### Communication Patterns

| Pattern | Flow | Medium |
|---------|------|--------|
| API Caching | API → Redis | Direct |
| Real-time Events | Indexer → Redis → WebSocket | Pub/Sub |
| Job Processing | API/Indexer → Redis → Worker | BullMQ |
| Data Persistence | All → PostgreSQL | Direct |

### Files to Create

| File | Purpose |
|------|---------|
| `k8s/api/deployment.yaml` | API pods |
| `k8s/api/service.yaml` | API service with NEG |
| `k8s/websocket/deployment.yaml` | WebSocket pods |
| `k8s/websocket/service.yaml` | WebSocket service with NEG |
| `k8s/indexer/deployment.yaml` | Indexer pods |
| `k8s/worker/deployment.yaml` | Worker pods |
| `k8s/ingress/ingress.yaml` | Ingress routing |
| `k8s/configmap.yaml` | Configuration |
| `k8s/secrets.yaml` | Secrets |
