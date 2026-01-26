# Hodl.fun V2 - Memorystore (Redis)

## Table of Contents
1. [Overview](#overview)
2. [Why Memorystore](#why-memorystore)
3. [Instance Configuration](#instance-configuration)
4. [Redis Use Cases](#redis-use-cases)
5. [Caching Patterns](#caching-patterns)
6. [Pub/Sub for Real-Time](#pubsub-for-real-time)
7. [BullMQ Job Queues](#bullmq-job-queues)
8. [Key Naming Conventions](#key-naming-conventions)
9. [Connecting from GKE](#connecting-from-gke)
10. [NestJS Integration](#nestjs-integration)
11. [Data Structures](#data-structures)
12. [TTL & Eviction](#ttl--eviction)
13. [Monitoring & Alerting](#monitoring--alerting)
14. [High Availability](#high-availability)
15. [Cost Estimation](#cost-estimation)

---

## Overview

### What This Document Covers

This document details how Redis (Memorystore) is used in Hodl.fun - caching strategies, real-time Pub/Sub messaging, job queues, and operational best practices.

### Architecture Position

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           REDIS IN THE ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            GKE CLUSTER                                       │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │     API     │  │  WebSocket  │  │   Indexer   │  │   Worker    │       │
│   │             │  │             │  │             │  │             │       │
│   │  Cache R/W  │  │  Pub/Sub    │  │  Pub/Sub    │  │  Job Queue  │       │
│   │  Rate Limit │  │  Subscribe  │  │  Publish    │  │  Process    │       │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│          │                │                │                │              │
│          └────────────────┴────────────────┴────────────────┘              │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     │ Private IP: 10.10.0.5:6379
                                     │
                              ┌──────┴──────┐
                              │             │
                              │ MEMORYSTORE │
                              │   (Redis)   │
                              │             │
                              │  ┌───────┐  │
                              │  │ Cache │  │
                              │  ├───────┤  │
                              │  │Pub/Sub│  │
                              │  ├───────┤  │
                              │  │ Queue │  │
                              │  └───────┘  │
                              │             │
                              └─────────────┘
```

### Key Specifications

| Attribute | Value |
|-----------|-------|
| Service | Memorystore for Redis |
| Version | Redis 7.0 |
| Tier | Standard (with replica) |
| Memory | 5 GB |
| Connection | Private IP only |
| Auth | AUTH string (password) |

---

## Why Memorystore

### Memorystore vs Self-Managed Redis

| Aspect | Memorystore | Self-Managed (on GKE) |
|--------|-------------|----------------------|
| **Setup Time** | Minutes | Hours |
| **Maintenance** | Google handles | You handle |
| **Failover** | Automatic | Manual setup |
| **Patching** | Automatic | Manual |
| **Monitoring** | Built-in | Setup required |
| **Persistence** | RDB snapshots | Configure yourself |
| **Scaling** | Easy | Complex |
| **Cost** | Higher | Lower (but + ops) |

### Why Memorystore for Hodl.fun

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY MEMORYSTORE IS RIGHT FOR US                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. SUB-MILLISECOND LATENCY
─────────────────────────────────────────────────────────────────────────────
   - Cache hits: < 1ms
   - Pub/Sub delivery: < 1ms
   - Rate limiting: < 1ms
   - Critical for real-time trading UX


2. REAL-TIME MESSAGING
─────────────────────────────────────────────────────────────────────────────
   - Pub/Sub for WebSocket events
   - Cross-pod communication
   - Event broadcasting


3. JOB QUEUE RELIABILITY
─────────────────────────────────────────────────────────────────────────────
   - BullMQ for background jobs
   - Persistent queues
   - Retry mechanisms


4. OPERATIONAL SIMPLICITY
─────────────────────────────────────────────────────────────────────────────
   - No Redis expertise needed
   - Automatic failover
   - Built-in monitoring
   - Focus on application


5. SECURITY
─────────────────────────────────────────────────────────────────────────────
   - Private IP (no public access)
   - AUTH password
   - Encryption in transit
   - VPC isolation
```

---

## Instance Configuration

### Recommended Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORYSTORE INSTANCE CONFIGURATION                        │
└─────────────────────────────────────────────────────────────────────────────┘

INSTANCE SETTINGS
═══════════════════════════════════════════════════════════════════════════════

Instance ID:        hodlfun-redis
Redis Version:      7.0
Tier:               Standard (with replica for HA)
Region:             us-central1 (same as GKE)


CAPACITY
═══════════════════════════════════════════════════════════════════════════════

Development:
  Memory:           1 GB
  Cost:             ~$35/month

Production (Initial):
  Memory:           5 GB
  Cost:             ~$175/month (Standard tier)

Production (Scaled):
  Memory:           10 GB
  Cost:             ~$350/month


NETWORK
═══════════════════════════════════════════════════════════════════════════════

Connection Mode:    Private Service Access
Private IP:         10.10.0.5
Port:               6379
Auth:               Enabled (AUTH string)


PERSISTENCE (Standard Tier)
═══════════════════════════════════════════════════════════════════════════════

RDB Snapshots:      Enabled
Snapshot Period:    24 hours
Retention:          1 snapshot

Note: Memorystore Standard tier includes persistence by default


MAINTENANCE
═══════════════════════════════════════════════════════════════════════════════

Window:             Sunday 04:00-05:00 UTC
```

### Terraform Configuration

```hcl
# memorystore.tf

resource "google_redis_instance" "main" {
  name           = "hodlfun-redis"
  tier           = "STANDARD_HA"  # Standard with replica
  memory_size_gb = 5
  region         = "us-central1"
  
  redis_version  = "REDIS_7_0"
  display_name   = "Hodl.fun Redis"
  
  # Network
  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  
  # Auth
  auth_enabled = true
  
  # Transit encryption
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  
  # Persistence
  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "TWENTY_FOUR_HOURS"
  }
  
  # Maintenance
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }
  
  # Redis config
  redis_configs = {
    maxmemory-policy = "volatile-lru"  # Evict keys with TTL first
    notify-keyspace-events = "Ex"       # Enable keyspace notifications for expiry
  }
  
  labels = {
    environment = "production"
    app         = "hodlfun"
  }
}

# Output the connection info
output "redis_host" {
  value = google_redis_instance.main.host
}

output "redis_port" {
  value = google_redis_instance.main.port
}

output "redis_auth_string" {
  value     = google_redis_instance.main.auth_string
  sensitive = true
}
```

---

## Redis Use Cases

### How Each Service Uses Redis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REDIS USE CASES BY SERVICE                                │
└─────────────────────────────────────────────────────────────────────────────┘

API SERVICE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ Use Case          │ Redis Feature    │ Example                             │
├───────────────────┼──────────────────┼─────────────────────────────────────┤
│ Response caching  │ GET/SET          │ Cache token list, token details     │
│ Rate limiting     │ INCR + EXPIRE    │ Limit requests per IP               │
│ Session storage   │ HSET/HGET        │ Store JWT refresh tokens            │
│ Distributed lock  │ SET NX EX        │ Prevent duplicate operations        │
│ Queue producer    │ LPUSH (BullMQ)   │ Add jobs for workers                │
└─────────────────────────────────────────────────────────────────────────────┘


WEBSOCKET SERVICE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ Use Case          │ Redis Feature    │ Example                             │
├───────────────────┼──────────────────┼─────────────────────────────────────┤
│ Pub/Sub subscribe │ SUBSCRIBE        │ Listen for trade events             │
│ Connection count  │ INCR/DECR        │ Track connections per pod           │
│ User presence     │ SET + EXPIRE     │ Track online users                  │
│ Room membership   │ SADD/SMEMBERS    │ Track who's subscribed to what      │
└─────────────────────────────────────────────────────────────────────────────┘


INDEXER SERVICE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ Use Case          │ Redis Feature    │ Example                             │
├───────────────────┼──────────────────┼─────────────────────────────────────┤
│ Pub/Sub publish   │ PUBLISH          │ Broadcast trade events              │
│ Cache invalidation│ DEL              │ Invalidate stale cache              │
│ Cache update      │ SET              │ Update token price cache            │
│ Leader election   │ SET NX EX        │ Only one indexer processes          │
│ Last block        │ SET/GET          │ Track last processed block          │
└─────────────────────────────────────────────────────────────────────────────┘


WORKER SERVICE
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ Use Case          │ Redis Feature    │ Example                             │
├───────────────────┼──────────────────┼─────────────────────────────────────┤
│ Job queue         │ BullMQ lists     │ Process candles, alerts, cleanup    │
│ Job deduplication │ SET NX           │ Prevent duplicate job processing    │
│ Rate limiting     │ INCR + EXPIRE    │ Limit external API calls            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Distribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ESTIMATED MEMORY USAGE (5 GB Instance)                    │
└─────────────────────────────────────────────────────────────────────────────┘

Category                    Estimated Size    % of Total
─────────────────────────────────────────────────────────────────────────────
Token cache                 500 MB            10%
  - 10,000 tokens × 50KB

Trade cache (recent)        200 MB            4%
  - Recent trades per token

Rate limit counters         50 MB             1%
  - Per-IP request counts

Session data                100 MB            2%
  - Refresh tokens, nonces

BullMQ queues               500 MB            10%
  - Job data, completed jobs

Pub/Sub buffers             100 MB            2%
  - In-flight messages

User presence               50 MB             1%
  - Online status

Reserved/Overhead           500 MB            10%
  - Redis internal structures

Available for growth        3,000 MB          60%
─────────────────────────────────────────────────────────────────────────────
TOTAL                       5,000 MB          100%
```

---

## Caching Patterns

### Cache-Aside Pattern (Primary)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE-ASIDE PATTERN                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Read Flow:
─────────────────────────────────────────────────────────────────────────────

    Client Request
          │
          ▼
    ┌───────────┐
    │  API Pod  │
    └─────┬─────┘
          │
          │ 1. Check cache
          ▼
    ┌───────────┐         ┌───────────┐
    │   Redis   │◄───────►│    Key    │
    │   Cache   │         │  Exists?  │
    └───────────┘         └─────┬─────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
         Cache HIT                           Cache MISS
              │                                   │
              │                                   │ 2. Query database
              │                                   ▼
              │                            ┌───────────┐
              │                            │ PostgreSQL│
              │                            └─────┬─────┘
              │                                  │
              │                                  │ 3. Store in cache
              │                                  ▼
              │                            ┌───────────┐
              │                            │   Redis   │
              │                            │  SET key  │
              │                            │  EX ttl   │
              │                            └─────┬─────┘
              │                                  │
              └──────────────┬───────────────────┘
                             │
                             ▼
                      Return to Client


Code Example:
─────────────────────────────────────────────────────────────────────────────

async getToken(address: string): Promise<Token> {
  const cacheKey = `token:${address}`;
  
  // 1. Check cache
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Query database
  const token = await this.tokenRepository.findOne({ where: { address } });
  
  if (token) {
    // 3. Store in cache (TTL: 60 seconds)
    await this.redis.set(cacheKey, JSON.stringify(token), 'EX', 60);
  }
  
  return token;
}
```

### Write-Through Pattern (For Critical Data)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WRITE-THROUGH PATTERN                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Write Flow:
─────────────────────────────────────────────────────────────────────────────

    Write Request
          │
          ▼
    ┌───────────┐
    │  API Pod  │
    └─────┬─────┘
          │
          │ 1. Write to database
          ▼
    ┌───────────┐
    │ PostgreSQL│
    └─────┬─────┘
          │
          │ 2. Update cache immediately
          ▼
    ┌───────────┐
    │   Redis   │
    │  SET key  │
    └───────────┘
          │
          ▼
    Return Success


Code Example:
─────────────────────────────────────────────────────────────────────────────

async updateToken(address: string, data: UpdateTokenDto): Promise<Token> {
  // 1. Update database
  const token = await this.tokenRepository.save({
    address,
    ...data,
    updatedAt: new Date(),
  });
  
  // 2. Update cache immediately
  const cacheKey = `token:${address}`;
  await this.redis.set(cacheKey, JSON.stringify(token), 'EX', 60);
  
  // 3. Invalidate list caches
  await this.invalidateTokenListCaches();
  
  return token;
}
```

### Cache Invalidation Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE INVALIDATION STRATEGIES                             │
└─────────────────────────────────────────────────────────────────────────────┘

STRATEGY 1: TTL-Based Expiration (Simple)
─────────────────────────────────────────────────────────────────────────────

// Data expires automatically
await this.redis.set('token:0x123', data, 'EX', 60);  // 60 seconds

Pros: Simple, automatic cleanup
Cons: May serve stale data until TTL expires


STRATEGY 2: Explicit Invalidation (Consistent)
─────────────────────────────────────────────────────────────────────────────

// When data changes, delete cache
async onTokenUpdated(address: string) {
  // Delete specific key
  await this.redis.del(`token:${address}`);
  
  // Delete related list caches using pattern
  const keys = await this.redis.keys('tokens:list:*');
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}

Pros: Always consistent
Cons: More complex, need to track dependencies


STRATEGY 3: Versioned Cache Keys (Advanced)
─────────────────────────────────────────────────────────────────────────────

// Include version in cache key
const version = await this.redis.get('tokens:version') || '1';
const cacheKey = `tokens:list:v${version}:page:1`;

// On update, increment version (invalidates all old keys)
await this.redis.incr('tokens:version');

Pros: Instant invalidation of all related caches
Cons: Old keys remain until TTL (memory usage)


RECOMMENDED APPROACH FOR HODL.FUN:
─────────────────────────────────────────────────────────────────────────────

| Data Type        | Strategy               | TTL    | Invalidation          |
|------------------|------------------------|--------|------------------------|
| Token details    | Cache-aside + TTL      | 60s    | On update/trade       |
| Token list       | Cache-aside + TTL      | 30s    | On new token/trade    |
| Trade list       | Cache-aside + TTL      | 30s    | On new trade          |
| User profile     | Cache-aside + TTL      | 300s   | On update             |
| Stats/Trending   | Cache-aside + TTL      | 60s    | TTL only              |
| Rate limits      | TTL only               | 60s    | TTL only              |
```

### Caching Implementation

```typescript
// src/common/cache/cache.service.ts

import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class CacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ═══════════════════════════════════════════════════════════════════════
  // BASIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CACHE-ASIDE HELPER
  // ═══════════════════════════════════════════════════════════════════════

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const data = await fetcher();

    // Cache the result
    if (data !== null && data !== undefined) {
      await this.set(key, data, ttlSeconds);
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TOKEN CACHE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  async getToken(address: string): Promise<any> {
    return this.get(`token:${address}`);
  }

  async setToken(address: string, token: any): Promise<void> {
    await this.set(`token:${address}`, token, 60);
  }

  async invalidateToken(address: string): Promise<void> {
    // Delete specific token
    await this.del(`token:${address}`);
    // Delete token list caches
    await this.delPattern('tokens:list:*');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    
    const ttl = await this.redis.ttl(key);
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  }
}
```

---

## Pub/Sub for Real-Time

### Pub/Sub Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PUB/SUB ARCHITECTURE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              PUBLISHERS
                    ┌─────────────────────────────┐
                    │                             │
                    │   ┌─────────┐ ┌─────────┐   │
                    │   │ Indexer │ │ Indexer │   │
                    │   │  Pod 1  │ │  Pod 2  │   │
                    │   └────┬────┘ └────┬────┘   │
                    │        │           │        │
                    └────────┼───────────┼────────┘
                             │           │
                             │ PUBLISH   │ PUBLISH
                             ▼           ▼
                    ┌─────────────────────────────┐
                    │           REDIS             │
                    │                             │
                    │   Channels:                 │
                    │   ┌─────────────────────┐   │
                    │   │ trade:0x123         │   │
                    │   │ trade:0x456         │   │
                    │   │ token:new           │   │
                    │   │ token:graduated     │   │
                    │   │ price:update        │   │
                    │   └─────────────────────┘   │
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   │ Broadcast to all subscribers
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ WS Pod 1 │  │ WS Pod 2 │  │ WS Pod 3 │
              │          │  │          │  │          │
              │ SUBSCRIBE│  │ SUBSCRIBE│  │ SUBSCRIBE│
              │ trade:*  │  │ trade:*  │  │ trade:*  │
              │          │  │          │  │          │
              │ Clients: │  │ Clients: │  │ Clients: │
              │ A, B, C  │  │ D, E     │  │ F, G, H  │
              └──────────┘  └──────────┘  └──────────┘
                    │              │              │
                    ▼              ▼              ▼
              Push to          Push to        Push to
              subscribed       subscribed     subscribed
              clients          clients        clients


Flow Example (Trade Event):
─────────────────────────────────────────────────────────────────────────────

1. Indexer detects trade on blockchain for token 0x123
2. Indexer: PUBLISH trade:0x123 '{"type":"buy","price":0.05,...}'
3. Redis broadcasts to all subscribers of "trade:0x123"
4. All WS pods receive the message
5. Each WS pod checks which clients are subscribed to token 0x123
6. Each WS pod pushes to only its subscribed clients
```

### Channel Definitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PUB/SUB CHANNELS                                          │
└─────────────────────────────────────────────────────────────────────────────┘

CHANNEL                     PUBLISHER       SUBSCRIBERS     PAYLOAD
─────────────────────────────────────────────────────────────────────────────

trade:{tokenAddress}        Indexer         WebSocket       Trade details
─────────────────────────────────────────────────────────────────────────────
{
  "type": "buy" | "sell",
  "token": "0x123...",
  "trader": "0xabc...",
  "amount": "1000000000000000000",
  "price": "0.00005",
  "priceUsd": "0.15",
  "newPrice": "0.000052",
  "newMarketCap": "52000",
  "txHash": "0xtx...",
  "timestamp": 1706123456789
}


price:{tokenAddress}        Indexer         WebSocket       Price update
─────────────────────────────────────────────────────────────────────────────
{
  "token": "0x123...",
  "price": "0.000052",
  "priceUsd": "0.156",
  "marketCap": "52000",
  "volume24h": "15000",
  "priceChange24h": "5.2",
  "timestamp": 1706123456789
}


token:new                   Indexer         WebSocket       New token created
─────────────────────────────────────────────────────────────────────────────
{
  "address": "0x123...",
  "name": "New Token",
  "symbol": "NEW",
  "creator": "0xabc...",
  "imageUrl": "https://...",
  "timestamp": 1706123456789
}


token:graduated             Indexer         WebSocket       Token graduated
─────────────────────────────────────────────────────────────────────────────
{
  "address": "0x123...",
  "name": "Moon Token",
  "dexPair": "0xpair...",
  "finalMarketCap": "69000",
  "timestamp": 1706123456789
}


comment:{tokenAddress}      API             WebSocket       New comment
─────────────────────────────────────────────────────────────────────────────
{
  "id": "uuid",
  "token": "0x123...",
  "author": "0xabc...",
  "authorName": "CryptoFan",
  "content": "Great project!",
  "timestamp": 1706123456789
}


holder:{tokenAddress}       Indexer         WebSocket       Holder update
─────────────────────────────────────────────────────────────────────────────
{
  "token": "0x123...",
  "holderCount": 156,
  "topHolders": [
    { "address": "0x...", "balance": "50000", "percentage": 5.0 }
  ]
}
```

### Publisher Implementation (Indexer)

```typescript
// src/indexer/publisher/redis-publisher.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class RedisPublisherService {
  private readonly logger = new Logger(RedisPublisherService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLISH METHODS
  // ═══════════════════════════════════════════════════════════════════════

  async publishTrade(trade: TradeEvent): Promise<void> {
    const channel = `trade:${trade.tokenAddress}`;
    const payload = JSON.stringify({
      type: trade.type,
      token: trade.tokenAddress,
      trader: trade.traderAddress,
      amount: trade.amount,
      price: trade.price,
      priceUsd: trade.priceUsd,
      newPrice: trade.newPrice,
      newMarketCap: trade.newMarketCap,
      txHash: trade.txHash,
      timestamp: Date.now(),
    });

    await this.redis.publish(channel, payload);
    this.logger.debug(`Published trade event to ${channel}`);
  }

  async publishPriceUpdate(tokenAddress: string, priceData: PriceData): Promise<void> {
    const channel = `price:${tokenAddress}`;
    const payload = JSON.stringify({
      token: tokenAddress,
      price: priceData.price,
      priceUsd: priceData.priceUsd,
      marketCap: priceData.marketCap,
      volume24h: priceData.volume24h,
      priceChange24h: priceData.priceChange24h,
      timestamp: Date.now(),
    });

    await this.redis.publish(channel, payload);
  }

  async publishNewToken(token: TokenCreatedEvent): Promise<void> {
    const channel = 'token:new';
    const payload = JSON.stringify({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      creator: token.creator,
      imageUrl: token.imageUrl,
      timestamp: Date.now(),
    });

    await this.redis.publish(channel, payload);
    this.logger.log(`Published new token event: ${token.symbol}`);
  }

  async publishTokenGraduated(token: TokenGraduatedEvent): Promise<void> {
    // Publish to token-specific channel
    await this.redis.publish(`token:graduated:${token.address}`, JSON.stringify(token));
    
    // Also publish to global channel
    await this.redis.publish('token:graduated', JSON.stringify(token));
    
    this.logger.log(`Token graduated: ${token.address}`);
  }

  async publishComment(comment: CommentEvent): Promise<void> {
    const channel = `comment:${comment.tokenAddress}`;
    await this.redis.publish(channel, JSON.stringify(comment));
  }
}
```

### Subscriber Implementation (WebSocket)

```typescript
// src/websocket/redis/redis-subscriber.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway } from '../websocket.gateway';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private subscriber: Redis;
  private subscribedChannels: Set<string> = new Set();

  constructor(
    private readonly configService: ConfigService,
    private readonly wsGateway: WebSocketGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    // Create dedicated connection for subscriptions
    // (subscribed connection can only do subscribe/unsubscribe)
    this.subscriber = new Redis({
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD'),
    });

    // Handle incoming messages
    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleMessage(channel, message);
    });

    // Subscribe to global channels
    await this.subscribeToGlobalChannels();

    this.logger.log('Redis subscriber initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  private async subscribeToGlobalChannels(): Promise<void> {
    // Subscribe to global channels
    await this.subscriber.subscribe('token:new', 'token:graduated');
    
    // Subscribe to all trade and price channels using patterns
    await this.subscriber.psubscribe('trade:*', 'price:*', 'comment:*', 'holder:*');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════════════════

  private handleMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      if (channel === 'token:new') {
        this.wsGateway.broadcastToRoom('global', 'token:new', data);
      } 
      else if (channel === 'token:graduated') {
        this.wsGateway.broadcastToRoom('global', 'token:graduated', data);
      }
      else if (channel.startsWith('trade:')) {
        const tokenAddress = channel.replace('trade:', '');
        this.wsGateway.broadcastToRoom(`token:${tokenAddress}`, 'trade', data);
      }
      else if (channel.startsWith('price:')) {
        const tokenAddress = channel.replace('price:', '');
        this.wsGateway.broadcastToRoom(`token:${tokenAddress}`, 'price:update', data);
      }
      else if (channel.startsWith('comment:')) {
        const tokenAddress = channel.replace('comment:', '');
        this.wsGateway.broadcastToRoom(`token:${tokenAddress}`, 'comment:new', data);
      }
      else if (channel.startsWith('holder:')) {
        const tokenAddress = channel.replace('holder:', '');
        this.wsGateway.broadcastToRoom(`token:${tokenAddress}`, 'holder:update', data);
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${channel}: ${error.message}`);
    }
  }
}
```

---

## BullMQ Job Queues

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BULLMQ QUEUE ARCHITECTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                         PRODUCERS
           ┌─────────────────────────────────────┐
           │                                     │
           │   ┌─────────┐         ┌─────────┐   │
           │   │   API   │         │ Indexer │   │
           │   │   Pod   │         │   Pod   │   │
           │   └────┬────┘         └────┬────┘   │
           │        │                   │        │
           └────────┼───────────────────┼────────┘
                    │                   │
                    │ Add jobs          │ Add jobs
                    ▼                   ▼
           ┌─────────────────────────────────────┐
           │              REDIS                  │
           │                                     │
           │   ┌───────────────────────────────┐ │
           │   │         BullMQ Queues         │ │
           │   │                               │ │
           │   │  ┌─────────┐  ┌─────────────┐ │ │
           │   │  │ candles │  │   alerts    │ │ │
           │   │  │  queue  │  │   queue     │ │ │
           │   │  └─────────┘  └─────────────┘ │ │
           │   │                               │ │
           │   │  ┌─────────┐  ┌─────────────┐ │ │
           │   │  │ cleanup │  │notifications│ │ │
           │   │  │  queue  │  │   queue     │ │ │
           │   │  └─────────┘  └─────────────┘ │ │
           │   │                               │ │
           │   └───────────────────────────────┘ │
           │                                     │
           └──────────────────┬──────────────────┘
                              │
                              │ Workers poll for jobs
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
     ┌──────────┐       ┌──────────┐       ┌──────────┐
     │ Worker 1 │       │ Worker 2 │       │ Worker 3 │
     │          │       │          │       │          │
     │ Process: │       │ Process: │       │ Process: │
     │ candles  │       │ alerts   │       │ cleanup  │
     │ alerts   │       │ candles  │       │ notifs   │
     └──────────┘       └──────────┘       └──────────┘


Job Lifecycle:
─────────────────────────────────────────────────────────────────────────────

  WAITING    →    ACTIVE    →    COMPLETED
     │              │               │
     │              │               └──► Stored for reference (configurable)
     │              │
     │              ├──► FAILED ──► WAITING (retry)
     │              │                   │
     │              │                   └──► FAILED (max retries)
     │              │
     └──► DELAYED ──┘
          (scheduled)
```

### Queue Definitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUEUE DEFINITIONS                                         │
└─────────────────────────────────────────────────────────────────────────────┘

CANDLES QUEUE
═══════════════════════════════════════════════════════════════════════════════

Name:           candles
Purpose:        Aggregate trades into OHLCV candles
Producer:       Indexer (after each trade)
Consumer:       Worker
Concurrency:    5
Priority:       High

Job Data:
{
  "type": "aggregate",
  "tokenAddress": "0x123...",
  "timestamp": 1706123456789
}

Job Options:
{
  "attempts": 3,
  "backoff": { "type": "exponential", "delay": 1000 },
  "removeOnComplete": 100,
  "removeOnFail": 1000
}


ALERTS QUEUE
═══════════════════════════════════════════════════════════════════════════════

Name:           alerts
Purpose:        Check and trigger price alerts
Producer:       Indexer (after price changes)
Consumer:       Worker
Concurrency:    10
Priority:       Medium

Job Data:
{
  "type": "check",
  "tokenAddress": "0x123...",
  "currentPrice": "0.00005",
  "previousPrice": "0.000048"
}

Job Options:
{
  "attempts": 3,
  "backoff": { "type": "fixed", "delay": 5000 },
  "removeOnComplete": 50,
  "removeOnFail": 500
}


NOTIFICATIONS QUEUE
═══════════════════════════════════════════════════════════════════════════════

Name:           notifications
Purpose:        Send push notifications, emails
Producer:       Worker (after alert triggered), API
Consumer:       Worker
Concurrency:    20
Priority:       Medium

Job Data:
{
  "type": "push" | "email",
  "userId": "0xwallet...",
  "title": "Price Alert Triggered",
  "body": "MOON token reached $0.05",
  "data": { "tokenAddress": "0x123..." }
}


CLEANUP QUEUE
═══════════════════════════════════════════════════════════════════════════════

Name:           cleanup
Purpose:        Cleanup old data, maintenance tasks
Producer:       Scheduler (cron)
Consumer:       Worker
Concurrency:    2
Priority:       Low

Job Types:
- archive_old_trades: Move trades > 90 days
- cleanup_sessions: Remove expired sessions
- cleanup_temp_uploads: Remove orphan uploads
- calculate_daily_stats: Aggregate daily stats

Job Data:
{
  "type": "archive_old_trades",
  "batchSize": 1000,
  "olderThan": "2024-01-01T00:00:00Z"
}

Schedule (Cron):
- archive_old_trades: Daily at 03:00 UTC
- cleanup_sessions: Every hour
- cleanup_temp_uploads: Every 6 hours
- calculate_daily_stats: Daily at 00:05 UTC
```

### BullMQ Implementation

```typescript
// src/worker/queues/queue.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 3,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'candles' },
      { name: 'alerts' },
      { name: 'notifications' },
      { name: 'cleanup' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

```typescript
// src/worker/processors/candle.processor.ts

import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CandleService } from '../services/candle.service';

@Processor('candles')
export class CandleProcessor {
  private readonly logger = new Logger(CandleProcessor.name);

  constructor(private readonly candleService: CandleService) {}

  @Process({ concurrency: 5 })
  async handleAggregate(job: Job<CandleJobData>): Promise<void> {
    const { tokenAddress, timestamp } = job.data;

    this.logger.debug(`Processing candle aggregation for ${tokenAddress}`);

    // Aggregate candles for all periods
    const periods = ['1m', '5m', '15m', '1h', '4h', '1d'];
    
    for (const period of periods) {
      await this.candleService.aggregateCandle(tokenAddress, period, timestamp);
    }
  }

  @OnQueueActive()
  onActive(job: Job): void {
    this.logger.debug(`Processing job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Completed job ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Failed job ${job.id}: ${error.message}`);
  }
}

interface CandleJobData {
  type: 'aggregate';
  tokenAddress: string;
  timestamp: number;
}
```

```typescript
// src/worker/processors/alert.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { AlertService } from '../services/alert.service';

@Processor('alerts')
export class AlertProcessor {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly alertService: AlertService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  @Process({ concurrency: 10 })
  async handleCheck(job: Job<AlertJobData>): Promise<void> {
    const { tokenAddress, currentPrice, previousPrice } = job.data;

    // Get all active alerts for this token
    const triggeredAlerts = await this.alertService.checkAlerts(
      tokenAddress,
      parseFloat(currentPrice),
      parseFloat(previousPrice),
    );

    // Queue notifications for triggered alerts
    for (const alert of triggeredAlerts) {
      await this.notificationQueue.add('send', {
        type: 'push',
        userId: alert.userWallet,
        title: 'Price Alert Triggered',
        body: `${alert.tokenSymbol} ${alert.condition} $${currentPrice}`,
        data: {
          tokenAddress,
          alertId: alert.id,
          price: currentPrice,
        },
      });

      // Mark alert as triggered
      await this.alertService.markTriggered(alert.id, currentPrice);
    }

    if (triggeredAlerts.length > 0) {
      this.logger.log(`Triggered ${triggeredAlerts.length} alerts for ${tokenAddress}`);
    }
  }
}

interface AlertJobData {
  type: 'check';
  tokenAddress: string;
  currentPrice: string;
  previousPrice: string;
}
```

```typescript
// src/indexer/services/indexer.service.ts (Producer)

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class IndexerService {
  constructor(
    @InjectQueue('candles') private readonly candleQueue: Queue,
    @InjectQueue('alerts') private readonly alertQueue: Queue,
  ) {}

  async processTrade(trade: TradeEvent): Promise<void> {
    // ... save trade to database ...

    // Queue candle aggregation
    await this.candleQueue.add(
      'aggregate',
      {
        type: 'aggregate',
        tokenAddress: trade.tokenAddress,
        timestamp: Date.now(),
      },
      {
        // Deduplicate: only one candle job per token per second
        jobId: `candle:${trade.tokenAddress}:${Math.floor(Date.now() / 1000)}`,
      },
    );

    // Queue alert check
    await this.alertQueue.add(
      'check',
      {
        type: 'check',
        tokenAddress: trade.tokenAddress,
        currentPrice: trade.newPrice,
        previousPrice: trade.oldPrice,
      },
      {
        // Deduplicate
        jobId: `alert:${trade.tokenAddress}:${Math.floor(Date.now() / 1000)}`,
      },
    );
  }
}
```

### Scheduled Jobs

```typescript
// src/worker/schedulers/cleanup.scheduler.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  // Daily at 03:00 UTC
  @Cron('0 3 * * *')
  async scheduleArchiveOldTrades(): Promise<void> {
    this.logger.log('Scheduling archive_old_trades job');
    
    await this.cleanupQueue.add('archive_old_trades', {
      type: 'archive_old_trades',
      batchSize: 1000,
      olderThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Every hour
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleCleanupSessions(): Promise<void> {
    await this.cleanupQueue.add('cleanup_sessions', {
      type: 'cleanup_sessions',
    });
  }

  // Every 6 hours
  @Cron('0 */6 * * *')
  async scheduleCleanupTempUploads(): Promise<void> {
    await this.cleanupQueue.add('cleanup_temp_uploads', {
      type: 'cleanup_temp_uploads',
      olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Daily at 00:05 UTC
  @Cron('5 0 * * *')
  async scheduleCalculateDailyStats(): Promise<void> {
    this.logger.log('Scheduling calculate_daily_stats job');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await this.cleanupQueue.add('calculate_daily_stats', {
      type: 'calculate_daily_stats',
      date: yesterday.toISOString().split('T')[0],
    });
  }
}
```

---

## Key Naming Conventions

### Key Naming Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEY NAMING CONVENTIONS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

FORMAT: {type}:{identifier}:{sub-identifier}:{...}

Examples:
─────────────────────────────────────────────────────────────────────────────

CACHE KEYS
═══════════════════════════════════════════════════════════════════════════════

token:{address}                      Single token data
  token:0x123abc

tokens:list:{sort}:{order}:{page}    Token list cache
  tokens:list:market_cap:desc:1

trades:{tokenAddress}:{page}         Trades for token
  trades:0x123abc:1

user:{wallet}                        User profile
  user:0xabc123

holdings:{wallet}                    User holdings
  holdings:0xabc123

stats:overview                       Platform stats
  stats:trending                     Trending tokens


RATE LIMITING KEYS
═══════════════════════════════════════════════════════════════════════════════

ratelimit:{ip}:{window}              Rate limit counter
  ratelimit:103.45.67.89:60

ratelimit:api:{ip}:{endpoint}        Per-endpoint rate limit
  ratelimit:api:103.45.67.89:/api/v1/tokens


SESSION KEYS
═══════════════════════════════════════════════════════════════════════════════

session:{sessionId}                  Session data
  session:abc123def456

refresh:{wallet}                     Refresh token
  refresh:0xabc123

nonce:{wallet}                       Auth nonce
  nonce:0xabc123


LOCK KEYS
═══════════════════════════════════════════════════════════════════════════════

lock:indexer:leader                  Leader election lock
lock:token:{address}:create          Token creation lock (prevent double-create)


PRESENCE KEYS
═══════════════════════════════════════════════════════════════════════════════

presence:user:{wallet}               User online status
  presence:user:0xabc123

presence:room:{tokenAddress}         Users in room
  presence:room:0x123abc


COUNTER KEYS
═══════════════════════════════════════════════════════════════════════════════

counter:connections:{podId}          Connections per pod
  counter:connections:ws-pod-1

counter:trades:today                 Daily trade counter


BULLMQ KEYS (Automatic)
═══════════════════════════════════════════════════════════════════════════════

bull:{queueName}:id                  Job ID counter
bull:{queueName}:waiting             Waiting jobs list
bull:{queueName}:active              Active jobs list
bull:{queueName}:completed           Completed jobs list
bull:{queueName}:failed              Failed jobs list
bull:{queueName}:{jobId}             Job data hash
```

### Key Naming Best Practices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEY NAMING BEST PRACTICES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. USE COLONS AS SEPARATORS
─────────────────────────────────────────────────────────────────────────────
   ✅ Good: token:0x123abc
   ❌ Bad:  token_0x123abc
   ❌ Bad:  token.0x123abc
   
   Why: Colons are convention, tools recognize them


2. BE CONSISTENT WITH CASING
─────────────────────────────────────────────────────────────────────────────
   ✅ Good: tokens:list:market_cap
   ❌ Bad:  tokens:List:Market_Cap
   
   Choose lowercase and stick with it


3. INCLUDE ALL NEEDED CONTEXT
─────────────────────────────────────────────────────────────────────────────
   ✅ Good: tokens:list:market_cap:desc:1:20
   ❌ Bad:  tokens:list:1
   
   Include all parameters that affect the cached value


4. AVOID LARGE KEYS
─────────────────────────────────────────────────────────────────────────────
   ✅ Good: tokens:list:v1 (short)
   ❌ Bad:  tokens:list:sorted_by_market_cap:descending:page_1:limit_20
   
   Use abbreviations for long values


5. USE PREFIXES FOR GROUPING
─────────────────────────────────────────────────────────────────────────────
   cache:token:*     - All token caches
   ratelimit:*       - All rate limits
   bull:*            - All BullMQ keys
   
   Easy to delete patterns: KEYS cache:token:* | DEL
```

---

## Connecting from GKE

### Connection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GKE TO MEMORYSTORE CONNECTION                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────┐
│           GKE CLUSTER                 │
│                                       │
│   ┌─────────────┐  ┌─────────────┐   │
│   │   API Pod   │  │   WS Pod    │   │
│   │             │  │             │   │
│   │ ┌─────────┐ │  │ ┌─────────┐ │   │
│   │ │ ioredis │ │  │ │ ioredis │ │   │
│   │ │ client  │ │  │ │ client  │ │   │
│   │ └────┬────┘ │  │ └────┬────┘ │   │
│   └──────┼──────┘  └──────┼──────┘   │
│          │                │          │
│          └────────┬───────┘          │
│                   │                  │
└───────────────────┼──────────────────┘
                    │
                    │ Private IP: 10.10.0.5:6379
                    │ AUTH: password
                    │ TLS: Enabled
                    │
┌───────────────────┼──────────────────┐
│                   ▼                  │
│   ┌─────────────────────────────┐    │
│   │        MEMORYSTORE          │    │
│   │          (Redis)            │    │
│   │                             │    │
│   │  Private IP: 10.10.0.5      │    │
│   │  Port: 6379                 │    │
│   │  No public IP               │    │
│   └─────────────────────────────┘    │
│                                      │
│          MEMORYSTORE                 │
└──────────────────────────────────────┘


Connection String:
─────────────────────────────────────────────────────────────────────────────
redis://:password@10.10.0.5:6379

With TLS:
rediss://:password@10.10.0.5:6379
```

### NestJS Redis Configuration

```typescript
// src/config/redis.config.ts

import { RedisModuleOptions } from '@nestjs-modules/ioredis';

export const getRedisConfig = (): RedisModuleOptions => ({
  config: {
    host: process.env.REDIS_HOST,           // 10.10.0.5
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    
    // TLS (if enabled)
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    
    // Connection
    connectTimeout: 10000,
    
    // Auto-reconnect
    retryStrategy: (times: number) => {
      if (times > 10) {
        // Stop retrying after 10 attempts
        return null;
      }
      // Exponential backoff: 100ms, 200ms, 400ms, ...
      return Math.min(times * 100, 3000);
    },
    
    // Keep-alive
    keepAlive: 10000,
    
    // Logging
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  },
});
```

---

## NestJS Integration

### Module Setup

```typescript
// src/app.module.ts

import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { getRedisConfig } from './config/redis.config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: getRedisConfig,
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### Multiple Connections (For Pub/Sub)

```typescript
// src/redis/redis.module.ts

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';
export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';

@Global()
@Module({
  providers: [
    // Main client for cache, rate limiting, etc.
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
    
    // Dedicated client for Pub/Sub subscriptions
    // (subscribed clients can only do subscribe/unsubscribe)
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
    
    // Dedicated client for publishing
    {
      provide: REDIS_PUBLISHER,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT, REDIS_SUBSCRIBER, REDIS_PUBLISHER],
})
export class RedisModule {}
```

### Using Redis in Services

```typescript
// src/tokens/tokens.service.ts

import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class TokensService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly tokenRepository: TokenRepository,
  ) {}

  async findAll(options: QueryOptions): Promise<TokenListResponse> {
    // Build cache key from options
    const cacheKey = `tokens:list:${options.sort}:${options.order}:${options.page}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query database
    const result = await this.tokenRepository.findAll(options);
    
    // Cache for 30 seconds
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
    
    return result;
  }

  async findOne(address: string): Promise<Token> {
    const cacheKey = `token:${address}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Query database
    const token = await this.tokenRepository.findOne(address);
    
    if (token) {
      // Cache for 60 seconds
      await this.redis.set(cacheKey, JSON.stringify(token), 'EX', 60);
    }
    
    return token;
  }

  async update(address: string, data: UpdateTokenDto): Promise<Token> {
    // Update database
    const token = await this.tokenRepository.update(address, data);
    
    // Update cache
    const cacheKey = `token:${address}`;
    await this.redis.set(cacheKey, JSON.stringify(token), 'EX', 60);
    
    // Invalidate list caches
    const listKeys = await this.redis.keys('tokens:list:*');
    if (listKeys.length > 0) {
      await this.redis.del(...listKeys);
    }
    
    return token;
  }
}
```

### Rate Limiting with Redis

```typescript
// src/common/guards/rate-limit.guard.ts

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Get real IP from Cloudflare header
    const ip = request.headers['cf-connecting-ip'] || request.ip;
    
    // Rate limit key
    const key = `ratelimit:${ip}:60`;
    
    // Increment counter
    const current = await this.redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await this.redis.expire(key, 60);
    }
    
    // Check limit (100 requests per minute)
    if (current > 100) {
      const ttl = await this.redis.ttl(key);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    
    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.header('X-RateLimit-Limit', '100');
    response.header('X-RateLimit-Remaining', String(100 - current));
    response.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + await this.redis.ttl(key)));
    
    return true;
  }
}
```

---

## Data Structures

### When to Use Each Data Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REDIS DATA STRUCTURES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

STRING
═══════════════════════════════════════════════════════════════════════════════
Use For:    Simple key-value, JSON objects, counters
Commands:   GET, SET, INCR, DECR, EXPIRE
Examples:   
  - Cache: token:0x123 → JSON
  - Counter: ratelimit:ip → number
  - Lock: lock:indexer → "1"

// Cache JSON
await redis.set('token:0x123', JSON.stringify(token), 'EX', 60);
const token = JSON.parse(await redis.get('token:0x123'));

// Counter
await redis.incr('ratelimit:103.45.67.89');


HASH
═══════════════════════════════════════════════════════════════════════════════
Use For:    Object with multiple fields, partial updates
Commands:   HSET, HGET, HGETALL, HINCRBY
Examples:   
  - User session: session:abc123 → {userId, expires, data}
  - Token quick stats: tokenstats:0x123 → {price, volume, holders}

// Store session
await redis.hset('session:abc123', {
  userId: '0xwallet',
  createdAt: Date.now(),
  expiresAt: Date.now() + 86400000,
});

// Get single field
const userId = await redis.hget('session:abc123', 'userId');

// Get all fields
const session = await redis.hgetall('session:abc123');


LIST
═══════════════════════════════════════════════════════════════════════════════
Use For:    Queues, recent items, activity feeds
Commands:   LPUSH, RPUSH, LPOP, RPOP, LRANGE, BRPOP
Examples:   
  - Recent trades: trades:recent:0x123 → [trade1, trade2, ...]
  - BullMQ uses lists for job queues

// Add to list (keep last 100)
await redis.lpush('trades:recent:0x123', JSON.stringify(trade));
await redis.ltrim('trades:recent:0x123', 0, 99);

// Get recent trades
const trades = await redis.lrange('trades:recent:0x123', 0, 9);


SET
═══════════════════════════════════════════════════════════════════════════════
Use For:    Unique collections, tags, membership
Commands:   SADD, SREM, SMEMBERS, SISMEMBER, SCARD
Examples:   
  - Users subscribed to token: subscribers:0x123 → {user1, user2}
  - Online users: online:users → {user1, user2}

// Add subscriber
await redis.sadd('subscribers:0x123', 'user-socket-id');

// Check if subscribed
const isSubscribed = await redis.sismember('subscribers:0x123', 'user-socket-id');

// Get all subscribers
const subscribers = await redis.smembers('subscribers:0x123');

// Count subscribers
const count = await redis.scard('subscribers:0x123');


SORTED SET (ZSET)
═══════════════════════════════════════════════════════════════════════════════
Use For:    Leaderboards, rankings, time-series
Commands:   ZADD, ZRANGE, ZREVRANGE, ZRANK, ZSCORE
Examples:   
  - Trending tokens: trending:tokens → {token: score}
  - Top holders: holders:0x123 → {wallet: balance}

// Add to leaderboard
await redis.zadd('trending:tokens', {
  '0xtoken1': 1500,  // score = volume or some metric
  '0xtoken2': 1200,
  '0xtoken3': 800,
});

// Get top 10
const topTokens = await redis.zrevrange('trending:tokens', 0, 9, 'WITHSCORES');

// Get rank
const rank = await redis.zrevrank('trending:tokens', '0xtoken1');


PUB/SUB
═══════════════════════════════════════════════════════════════════════════════
Use For:    Real-time messaging, event broadcasting
Commands:   PUBLISH, SUBSCRIBE, PSUBSCRIBE
Examples:   
  - Trade events: PUBLISH trade:0x123 {...}
  - New tokens: PUBLISH token:new {...}

// Publisher
await redis.publish('trade:0x123', JSON.stringify(tradeEvent));

// Subscriber (dedicated connection)
subscriber.subscribe('trade:0x123');
subscriber.psubscribe('trade:*');

subscriber.on('message', (channel, message) => {
  console.log(`Received from ${channel}: ${message}`);
});
```

---

## TTL & Eviction

### TTL Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TTL STRATEGY BY DATA TYPE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Data Type                    TTL         Reason
─────────────────────────────────────────────────────────────────────────────

FREQUENTLY CHANGING
─────────────────────────────────────────────────────────────────────────────
Token list                   30s         Changes with trades
Token details                60s         Price updates frequently
Trade list                   30s         New trades constantly
Trending tokens              60s         Recalculated periodically

MODERATELY STABLE
─────────────────────────────────────────────────────────────────────────────
User profile                 300s        Changes infrequently
Holder list                  120s        Changes with trades
Platform stats               60s         Aggregated data

SHORT-LIVED
─────────────────────────────────────────────────────────────────────────────
Rate limit counters          60s         Per-minute windows
Auth nonces                  300s        Single use
Distributed locks            30s         Short operations

SESSION DATA
─────────────────────────────────────────────────────────────────────────────
Refresh tokens               7 days      Long-lived sessions
User sessions                24 hours    Active sessions

NO TTL (Managed Differently)
─────────────────────────────────────────────────────────────────────────────
BullMQ jobs                  -           Managed by BullMQ
Pub/Sub                      -           In-memory, not persisted
```

### Eviction Policy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVICTION POLICY                                           │
└─────────────────────────────────────────────────────────────────────────────┘

Configured Policy: volatile-lru
─────────────────────────────────────────────────────────────────────────────

When memory limit reached:
1. Evict keys with TTL first (volatile)
2. Use LRU algorithm (Least Recently Used)
3. Never evict keys without TTL

Why volatile-lru:
- Cache keys have TTL → Can be evicted
- Session keys have TTL → Can be regenerated
- BullMQ keys may not have TTL → Protected
- Lock keys have TTL → Can be evicted safely


Alternative Policies:
─────────────────────────────────────────────────────────────────────────────

noeviction        - Return error when memory full
                    Not suitable for cache use case

allkeys-lru       - Evict any key using LRU
                    Risk: May evict important keys

volatile-ttl      - Evict keys with shortest TTL
                    Risk: May keep stale data

allkeys-random    - Evict random keys
                    Unpredictable

volatile-random   - Evict random keys with TTL
                    Less efficient than LRU
```

---

## Monitoring & Alerting

### Key Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORYSTORE METRICS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

MEMORY METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold     Action
─────────────────────────────────────────────────────────────────────────────
Memory usage %                  > 80%               Scale up or optimize
Memory usage bytes              -                   Monitor trend
Evicted keys                    > 0 (sustained)     Scale up
Memory fragmentation ratio      > 1.5               Restart to defragment


CONNECTION METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold     Action
─────────────────────────────────────────────────────────────────────────────
Connected clients               > 80% of max        Check connection leaks
Blocked clients                 > 0 (sustained)     Investigate blocking ops
Rejected connections            > 0                 Scale up or fix leaks


PERFORMANCE METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold     Action
─────────────────────────────────────────────────────────────────────────────
Operations/second               Monitor baseline    Capacity planning
Cache hit ratio                 < 80%               Review cache strategy
Average latency                 > 1ms               Investigate slow commands
Slowlog entries                 > 10/hour           Optimize slow commands


REPLICATION METRICS (Standard Tier)
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold     Action
─────────────────────────────────────────────────────────────────────────────
Replication lag                 > 1 second          Check network/load
Replica connected               = 0                 Failover may not work
```

### Cloud Monitoring Dashboard

```yaml
# Example Monitoring Query for Memorystore

# Memory Usage
resource.type="redis_instance"
metric.type="redis.googleapis.com/stats/memory/usage_ratio"

# Cache Hit Ratio
resource.type="redis_instance"
metric.type="redis.googleapis.com/stats/keyspace_hits"
/ (metric.type="redis.googleapis.com/stats/keyspace_hits" 
   + metric.type="redis.googleapis.com/stats/keyspace_misses")

# Connected Clients
resource.type="redis_instance"
metric.type="redis.googleapis.com/clients/connected"
```

### Application-Level Monitoring

```typescript
// src/common/health/redis.health.ts

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Ping Redis
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      // Get info
      const info = await this.redis.info('memory');
      const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
      const maxMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');
      const memoryUsagePercent = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

      const isHealthy = latency < 100 && memoryUsagePercent < 90;

      const result = this.getStatus(key, isHealthy, {
        latency: `${latency}ms`,
        memoryUsage: `${memoryUsagePercent.toFixed(1)}%`,
        usedMemory: `${(usedMemory / 1024 / 1024).toFixed(2)}MB`,
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Redis check failed', result);
    } catch (error) {
      throw new HealthCheckError('Redis check failed', 
        this.getStatus(key, false, { error: error.message }));
    }
  }
}
```

---

## High Availability

### Standard Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORYSTORE STANDARD TIER (HA)                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │           GKE CLUSTER               │
                    │                                     │
                    │   ┌───────┐  ┌───────┐  ┌───────┐   │
                    │   │  Pod  │  │  Pod  │  │  Pod  │   │
                    │   └───┬───┘  └───┬───┘  └───┬───┘   │
                    │       │          │          │       │
                    │       └──────────┼──────────┘       │
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       │
                                       │ Connect to primary IP
                                       ▼
                    ┌─────────────────────────────────────┐
                    │         MEMORYSTORE                 │
                    │       (Standard Tier)               │
                    │                                     │
                    │   Zone A              Zone B        │
                    │  ┌─────────┐        ┌─────────┐     │
                    │  │ PRIMARY │◄──────►│ REPLICA │     │
                    │  │         │  sync  │         │     │
                    │  │  R/W    │        │  (R/O)  │     │
                    │  └─────────┘        └─────────┘     │
                    │       ▲                  │          │
                    │       │                  │          │
                    │       └───── Failover ───┘          │
                    │             (automatic)             │
                    │                                     │
                    └─────────────────────────────────────┘


Failover Process:
─────────────────────────────────────────────────────────────────────────────

1. Primary fails (zone A outage, instance crash)
2. Memorystore detects failure (~seconds)
3. Replica promoted to primary (~60 seconds)
4. Connection endpoint unchanged
5. Clients reconnect automatically

During failover:
- Writes fail for ~60 seconds
- Data loss: ~1 second of writes (async replication)
- Application should have retry logic
```

### Client-Side Resilience

```typescript
// src/config/redis.config.ts

export const getRedisConfig = () => ({
  config: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    
    // ═══════════════════════════════════════════════════════════════════════
    // RETRY STRATEGY (handles failover)
    // ═══════════════════════════════════════════════════════════════════════
    retryStrategy: (times: number) => {
      if (times > 20) {
        // Stop retrying after ~2 minutes
        return null;
      }
      // Exponential backoff: 100ms, 200ms, 400ms, ... up to 5s
      return Math.min(times * 100, 5000);
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // CONNECTION SETTINGS
    // ═══════════════════════════════════════════════════════════════════════
    connectTimeout: 10000,      // Wait 10s for initial connection
    
    // Keep-alive to detect dead connections faster
    keepAlive: 10000,
    
    // Reconnect on error
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect when replica becomes read-only (failover)
        return true;
      }
      return false;
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // COMMAND RETRY
    // ═══════════════════════════════════════════════════════════════════════
    maxRetriesPerRequest: 3,   // Retry failed commands
    enableOfflineQueue: true,  // Queue commands when disconnected
  },
});
```

---

## Cost Estimation

### Monthly Cost Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEMORYSTORE COST ESTIMATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

DEVELOPMENT ENVIRONMENT
═══════════════════════════════════════════════════════════════════════════════

Tier:               Basic (no replica)
Capacity:           1 GB
Region:             us-central1

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (1 GB × $0.049/GB/hour)    ~$35
Network (internal)                  Free
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$35/month


PRODUCTION ENVIRONMENT (Initial)
═══════════════════════════════════════════════════════════════════════════════

Tier:               Standard (with replica)
Capacity:           5 GB
Region:             us-central1

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (5 GB × $0.068/GB/hour)    ~$250
  Includes: Primary + Replica
Network (internal)                  Free
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$250/month


PRODUCTION ENVIRONMENT (Scaled)
═══════════════════════════════════════════════════════════════════════════════

Tier:               Standard (with replica)
Capacity:           10 GB
Region:             us-central1

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (10 GB × $0.068/GB/hour)   ~$500
Network (internal)                  Free
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$500/month


PRICING NOTES:
─────────────────────────────────────────────────────────────────────────────
- Basic tier: ~$0.049/GB/hour (no HA)
- Standard tier: ~$0.068/GB/hour (includes replica)
- Pricing varies by region
- No charge for internal network traffic
```

### Cost Optimization Tips

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COST OPTIMIZATION                                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. RIGHT-SIZE CAPACITY
─────────────────────────────────────────────────────────────────────────────
   - Monitor actual memory usage
   - Start with 5 GB, scale as needed
   - Redis typically needs 2x data size for operations


2. USE BASIC TIER FOR DEV/STAGING
─────────────────────────────────────────────────────────────────────────────
   - No replica = ~40% cost savings
   - Acceptable for non-production


3. OPTIMIZE DATA STRUCTURES
─────────────────────────────────────────────────────────────────────────────
   - Use hashes instead of multiple strings
   - Compress large values before storing
   - Use appropriate TTLs to free memory


4. CLEAN UP UNUSED DATA
─────────────────────────────────────────────────────────────────────────────
   - Set TTLs on all cache keys
   - Clean up BullMQ completed jobs
   - Monitor memory growth


5. COMMITTED USE DISCOUNTS
─────────────────────────────────────────────────────────────────────────────
   - 1-year commitment: 25% discount
   - 3-year commitment: 52% discount
   - Consider after stable usage patterns
```

---

## Summary

### Redis Use Cases

| Use Case | Feature | Service |
|----------|---------|---------|
| Response caching | GET/SET with TTL | API |
| Rate limiting | INCR + EXPIRE | API |
| Real-time events | Pub/Sub | Indexer → WebSocket |
| Job queues | BullMQ | All → Worker |
| Distributed locks | SET NX EX | Indexer |
| Session storage | HSET/HGET | API |

### Key Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| Tier | Basic | Standard (HA) |
| Memory | 1 GB | 5 GB |
| Eviction | volatile-lru | volatile-lru |
| Auth | Enabled | Enabled |
| TLS | Optional | Recommended |
| Cost | ~$35/month | ~$250/month |

### Pub/Sub Channels

| Channel | Publisher | Purpose |
|---------|-----------|---------|
| `trade:{token}` | Indexer | Trade events |
| `price:{token}` | Indexer | Price updates |
| `token:new` | Indexer | New tokens |
| `token:graduated` | Indexer | Graduations |
| `comment:{token}` | API | New comments |

### BullMQ Queues

| Queue | Producer | Consumer | Concurrency |
|-------|----------|----------|-------------|
| candles | Indexer | Worker | 5 |
| alerts | Indexer | Worker | 10 |
| notifications | Worker/API | Worker | 20 |
| cleanup | Scheduler | Worker | 2 |

### Files to Create

| File | Purpose |
|------|---------|
| `terraform/memorystore.tf` | Infrastructure |
| `src/redis/redis.module.ts` | NestJS module |
| `src/common/cache/cache.service.ts` | Cache helpers |
| `src/websocket/redis/redis-subscriber.service.ts` | Pub/Sub subscriber |
| `src/indexer/publisher/redis-publisher.service.ts` | Pub/Sub publisher |
| `src/worker/queues/queue.module.ts` | BullMQ setup |
| `src/worker/processors/*.processor.ts` | Job processors |
