# Hodl.fun V2 Backend Architecture

A comprehensive architecture breakdown for whiteboard visualization and deep understanding.

---

## 1. HIGH-LEVEL SYSTEM OVERVIEW (Whiteboard Top Level)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                           │
│                  (Web App, Mobile, Third-Party Integrations)                        │
└─────────────────────────────────────┬───────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │ HTTP/REST                 │ WebSocket                 │ Blockchain
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│    API SERVICE      │   │  WEBSOCKET SERVICE  │   │   INDEXER SERVICE   │
│     (Port 3000)     │   │     (Port 3001)     │   │     (Port 3002)     │
│                     │   │                     │   │                     │
│  • REST Endpoints   │   │  • Socket.io        │   │  • Event Polling    │
│  • JWT Auth         │   │  • Real-time Push   │   │  • Event Parsing    │
│  • Rate Limiting    │   │  • Subscriptions    │   │  • State Sync       │
│  • Swagger Docs     │   │  • Multi-pod Redis  │   │  • Circuit Breaker  │
└─────────┬───────────┘   └─────────┬───────────┘   └─────────┬───────────┘
          │                         │                         │
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SHARED INFRASTRUCTURE                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   PostgreSQL    │  │     Redis       │  │  Push Chain RPC │                      │
│  │   (Primary DB)  │  │  (Cache/PubSub) │  │  (Blockchain)   │                      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│   WORKER SERVICE    │
│     (Port 3003)     │
│                     │
│  • OHLC Candles     │
│  • Metrics Calc     │
│  • Alert Checking   │
│  • Leaderboards     │
│  • Data Cleanup     │
└─────────────────────┘
```

---

## 2. MONOREPO FOLDER STRUCTURE

```
hodlfun-v2-backend/
│
├── apps/                          ← 4 INDEPENDENT MICROSERVICES
│   ├── api/                       ← REST API (Port 3000)
│   ├── websocket/                 ← Real-time (Port 3001)
│   ├── indexer/                   ← Blockchain Sync (Port 3002)
│   └── worker/                    ← Background Jobs (Port 3003)
│
├── libs/                          ← SHARED LIBRARIES
│   ├── common/                    ← Cross-cutting (Guards, Filters, DTOs)
│   ├── database/                  ← Prisma ORM + PostgreSQL
│   └── redis/                     ← Cache + PubSub
│
├── prisma/                        ← Database Schema
│   └── schema.prisma
│
├── docker/                        ← Docker Compose Configs
├── k8s/                           ← Kubernetes Manifests
├── terraform/                     ← Infrastructure as Code
└── test/                          ← E2E Tests
```

**Path Aliases**:
- `@hodlfun/common` → `libs/common/src`
- `@hodlfun/database` → `libs/database/src`
- `@hodlfun/redis` → `libs/redis/src`

---

## 3. SERVICE-BY-SERVICE DEEP DIVE

### 3.1 API SERVICE (apps/api)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            API SERVICE (Port 3000)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        PRESENTATION LAYER                              │  │
│  │                                                                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │  │
│  │  │   Tokens    │ │    Users    │ │    Auth     │ │ Leaderboard │       │  │
│  │  │ Controller  │ │ Controller  │ │ Controller  │ │ Controller  │       │  │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │  │
│  │         │               │               │               │              │  │
│  │  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐       │  │
│  │  │   Alerts    │ │   Metrics   │ │   Health    │ │     ...     │       │  │
│  │  │ Controller  │ │ Controller  │ │ Controller  │ │             │       │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        APPLICATION LAYER                               │  │
│  │                                                                        │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐                  │  │
│  │  │TokensService │ │ UsersService │ │WalletAuthService│                 │  │
│  │  │              │ │              │ │                │                  │  │
│  │  │• findAll()   │ │• getProfile()│ │• generateNonce()│                 │  │
│  │  │• findByAddr()│ │• register()  │ │• verifySignature()│               │  │
│  │  │• getTrades() │ │• portfolio() │ │                │                  │  │
│  │  │• getHolders()│ │              │ │                │                  │  │
│  │  │• getPrice()  │ │              │ │                │                  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────┘                  │  │
│  │                                                                        │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐                  │  │
│  │  │JwtAuthService│ │AlertsService │ │LeaderboardSvc  │                  │  │
│  │  │              │ │              │ │                │                  │  │
│  │  │• generate()  │ │• create()    │ │• getTopTraders()│                 │  │
│  │  │• verify()    │ │• check()     │ │• getUserRank() │                  │  │
│  │  │• refresh()   │ │• trigger()   │ │                │                  │  │
│  │  └──────────────┘ └──────────────┘ └────────────────┘                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                       INFRASTRUCTURE LAYER                             │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │  │
│  │  │PrismaService │ │ CacheService │ │ PubSubService│                    │  │
│  │  │(PostgreSQL)  │ │   (Redis)    │ │   (Redis)    │                    │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/tokens` | GET | List tokens with pagination/filtering |
| `/api/v1/tokens/:address` | GET | Get single token details |
| `/api/v1/tokens/:address/trades` | GET | Trade history for token |
| `/api/v1/tokens/:address/holders` | GET | Token holder list |
| `/api/v1/tokens/:address/price-history` | GET | OHLC candlestick data |
| `/api/v1/auth/nonce` | POST | Get wallet login nonce |
| `/api/v1/auth/verify` | POST | Verify signature, get JWT |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/users/me` | GET | Current user profile |
| `/api/v1/users/me/portfolio` | GET | User holdings & P&L |
| `/api/v1/leaderboard` | GET | Top traders ranking |
| `/api/v1/alerts` | CRUD | Price/graduation alerts |

---

### 3.2 INDEXER SERVICE (apps/indexer)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         INDEXER SERVICE (Port 3002)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      BLOCKCHAIN LISTENER LAYER                         │  │
│  │                                                                        │  │
│  │     ┌─────────────────────┐        ┌─────────────────────┐             │  │
│  │     │  WebSocket Service  │        │    RPC Service      │             │  │
│  │     │   (Real-time Mode)  │        │   (Polling Mode)    │             │  │
│  │     │                     │        │                     │             │  │
│  │     │ • contract.on()     │        │ • @Interval(5s)     │             │  │
│  │     │ • provider.on()     │        │ • getLogs()         │             │  │
│  │     │ • Zero lag          │        │ • Block batching    │             │  │
│  │     └──────────┬──────────┘        └──────────┬──────────┘             │  │
│  │                │                              │                        │  │
│  │                └──────────────┬───────────────┘                        │  │
│  │                               │                                        │  │
│  │                 ┌─────────────▼─────────────┐                          │  │
│  │                 │     Circuit Breaker       │                          │  │
│  │                 │                           │                          │  │
│  │                 │ • Primary RPC → Fallback  │                          │  │
│  │                 │ • Failure threshold: 5    │                          │  │
│  │                 │ • Reset timeout: 30s      │                          │  │
│  │                 └─────────────┬─────────────┘                          │  │
│  └───────────────────────────────┼────────────────────────────────────────┘  │
│                                  │                                           │
│                                  ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      EVENT PROCESSOR LAYER                             │  │
│  │                                                                        │  │
│  │                 ┌─────────────────────────────┐                        │  │
│  │                 │   EventProcessorService     │                        │  │
│  │                 │                             │                        │  │
│  │                 │ • parseLog() via ethers.js  │                        │  │
│  │                 │ • Route to handler          │                        │  │
│  │                 │ • Update IndexerState       │                        │  │
│  │                 └──────────────┬──────────────┘                        │  │
│  │                                │                                       │  │
│  │        ┌───────────────────────┼───────────────────────┐               │  │
│  │        ▼                       ▼                       ▼               │  │
│  │  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐         │  │
│  │  │ TradeHandler  │     │CreateCurveHdlr│     │CreatorFeeHdlr │         │  │
│  │  │               │     │               │     │               │         │  │
│  │  │ • Buy events  │     │ • New tokens  │     │ • Fee accrual │         │  │
│  │  │ • Sell events │     │ • Initial buy │     │ • Fee claims  │         │  │
│  │  │ • Update bal  │     │               │     │               │         │  │
│  │  └───────────────┘     └───────────────┘     └───────────────┘         │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                           │
│                                  ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      PERSISTENCE & BROADCAST                           │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐          ┌──────────────────┐                    │  │
│  │  │   PrismaService  │          │   PubSubService  │                    │  │
│  │  │                  │          │                  │                    │  │
│  │  │ • trade.create() │          │ • publish()      │                    │  │
│  │  │ • token.update() │   ───►   │                  │  ───► WebSocket    │  │
│  │  │ • holder.upsert()│          │ Channel:         │       Service      │  │
│  │  │ • state.update() │          │ blockchain-events│                    │  │
│  │  └──────────────────┘          └──────────────────┘                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Events Indexed**:

| Event | Source | Handler Action |
|-------|--------|----------------|
| `CreateCurve` | Core.sol | Create Token + BondingCurve records |
| `Buy` | Core.sol | Create Trade, update balances, update Token state |
| `Sell` | Core.sol | Create Trade, update balances, update Token state |
| `Sync` | BondingCurve.sol | Update reserves (virtual + real) |
| `Lock` | BondingCurve.sol | Set token status to LOCKED |
| `Listing` | BondingCurve.sol | Set token status to LISTED |
| `NewATHPrice` | BondingCurve.sol | Update token.athPrice |
| `NewATHMarketCap` | BondingCurve.sol | Update token.athMarketCap |
| `CreatorFeesAccumulated` | Factory.sol | Update CreatorFee record |
| `CreatorFeesClaimed` | Factory.sol | Update claimed fees |

---

### 3.3 WEBSOCKET SERVICE (apps/websocket)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        WEBSOCKET SERVICE (Port 3001)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         SOCKET.IO SERVER                               │  │
│  │                                                                        │  │
│  │                    ┌─────────────────────────┐                         │  │
│  │                    │    RedisIoAdapter       │                         │  │
│  │                    │                         │                         │  │
│  │                    │ • createAdapter()       │                         │  │
│  │                    │ • pubClient (Redis)     │                         │  │
│  │                    │ • subClient (Redis)     │                         │  │
│  │                    │                         │                         │  │
│  │                    │ Enables multi-pod       │                         │  │
│  │                    │ broadcasting            │                         │  │
│  │                    └─────────────────────────┘                         │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                    ┌─────────────────┴─────────────────┐                     │
│                    │                                   │                     │
│                    ▼                                   ▼                     │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐      │
│  │     EVENTS GATEWAY             │  │     TRADES GATEWAY             │      │
│  │     Namespace: /events         │  │     Namespace: /trades         │      │
│  │                                │  │                                │      │
│  │  Client Events:                │  │  Client Events:                │      │
│  │  ├─ subscribe:token            │  │  ├─ subscribe:token            │      │
│  │  ├─ subscribe:wallet           │  │  ├─ subscribe:wallet           │      │
│  │  └─ unsubscribe                │  │  └─ unsubscribe                │      │
│  │                                │  │                                │      │
│  │  Server Events:                │  │  Server Events:                │      │
│  │  ├─ token_created              │  │  ├─ new_trade                  │      │
│  │  ├─ price_update               │  │  ├─ trade_confirmed            │      │
│  │  ├─ graduation                 │  │  └─ trade_batch                │      │
│  │  └─ metrics_update             │  │                                │      │
│  │                                │  │                                │      │
│  └────────────────────────────────┘  └────────────────────────────────┘      │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      EVENT LISTENER SERVICE                            │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    PubSubService.subscribe()                     │  │  │
│  │  │                                                                  │  │  │
│  │  │   Channel: blockchain-events                                     │  │  │
│  │  │                                                                  │  │  │
│  │  │   Message: { event: 'Buy', data: { tokenAddress, ... } }         │  │  │
│  │  │            │                                                     │  │  │
│  │  │            ▼                                                     │  │  │
│  │  │   EventsGateway.broadcastToToken(tokenAddress, 'buy', data)      │  │  │
│  │  │            │                                                     │  │  │
│  │  │            ▼                                                     │  │  │
│  │  │   server.to(`token:${address}`).emit('buy', data)                │  │  │
│  │  │            │                                                     │  │  │
│  │  │            ▼  (via Redis adapter)                                │  │  │
│  │  │   ALL WEBSOCKET PODS receive and broadcast to their clients      │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      SUBSCRIPTION SERVICE                              │  │
│  │                                                                        │  │
│  │  • trackSubscription(socketId, room)                                   │  │
│  │  • getSubscriptions(socketId): Set<string>                             │  │
│  │  • cleanupOnDisconnect(socketId)                                       │  │
│  │  • Prevents duplicate broadcasts                                       │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Room Structure**:
```
Rooms:
├── global                    ← All clients join automatically
├── token:{address}           ← Subscribe to specific token events
└── wallet:{address}          ← Subscribe to wallet activity
```

---

### 3.4 WORKER SERVICE (apps/worker)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         WORKER SERVICE (Port 3003)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                       SCHEDULER LAYER (@Cron)                          │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │  │
│  │  │  CandleScheduler │  │ MetricsScheduler │  │ AlertsScheduler  │      │  │
│  │  │                  │  │                  │  │                  │      │  │
│  │  │ @Cron(EVERY_MIN) │  │ @Cron(EVERY_5M)  │  │ @Cron(EVERY_MIN) │      │  │
│  │  │ • 1m candles     │  │ • Token metrics  │  │ • Check alerts   │      │  │
│  │  │                  │  │ • Volume calc    │  │ • Trigger notifs │      │  │
│  │  │ @Cron(*/5 * *)   │  │ • Holder count   │  │                  │      │  │
│  │  │ • 5m candles     │  │                  │  │                  │      │  │
│  │  │                  │  │                  │  │                  │      │  │
│  │  │ @Cron(EVERY_HOUR)│  │                  │  │                  │      │  │
│  │  │ • 1h candles     │  │                  │  │                  │      │  │
│  │  │                  │  │                  │  │                  │      │  │
│  │  │ @Cron(MIDNIGHT)  │  │                  │  │                  │      │  │
│  │  │ • 1d candles     │  │                  │  │                  │      │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘      │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                            │  │
│  │  │LeaderboardSched. │  │ CleanupScheduler │                            │  │
│  │  │                  │  │                  │                            │  │
│  │  │ @Cron(EVERY_HOUR)│  │ @Cron(MIDNIGHT)  │                            │  │
│  │  │ • Rank users     │  │ • Partition mgmt │                            │  │
│  │  │ • Calculate P&L  │  │ • Old data prune │                            │  │
│  │  │ • Update stats   │  │ • Archive trades │                            │  │
│  │  └──────────────────┘  └──────────────────┘                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                       PROCESSOR LAYER                                  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    CandleProcessor                              │   │  │
│  │  │                                                                 │   │  │
│  │  │  aggregateCandles(tokenAddress, interval, fromTime, toTime):    │   │  │
│  │  │                                                                 │   │  │
│  │  │  1. Fetch trades: SELECT * FROM trades                          │   │  │
│  │  │     WHERE token = ? AND timestamp BETWEEN ? AND ?               │   │  │
│  │  │                                                                 │   │  │
│  │  │  2. Calculate OHLC:                                             │   │  │
│  │  │     ┌────────────────────────────────────────────┐              │   │  │
│  │  │     │  open  = first trade price                 │              │   │  │
│  │  │     │  high  = MAX(prices)                       │              │   │  │
│  │  │     │  low   = MIN(prices)                       │              │   │  │
│  │  │     │  close = last trade price                  │              │   │  │
│  │  │     │  volumeNative = SUM(amountIn for buys)     │              │   │  │
│  │  │     │  volumeToken = SUM(amountOut for sells)    │              │   │  │
│  │  │     │  tradeCount = COUNT(*)                     │              │   │  │
│  │  │     └────────────────────────────────────────────┘              │   │  │
│  │  │                                                                 │   │  │
│  │  │  3. Upsert: prisma.priceHistory.upsert()                        │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Candle Intervals**:

| Interval | Cron | Lookback |
|----------|------|----------|
| 1 minute | Every minute | 1 minute |
| 5 minute | Every 5 minutes | 5 minutes |
| 15 minute | Every 15 minutes | 15 minutes |
| 1 hour | Every hour | 1 hour |
| 4 hour | Every 4 hours | 4 hours |
| 1 day | Midnight | 24 hours |

---

## 4. SHARED LIBRARIES (libs/)

### 4.1 Common Library (@hodlfun/common)

```
libs/common/src/
│
├── guards/
│   └── rate-limit.guard.ts          ← Redis-backed rate limiting
│
├── interceptors/
│   ├── logging.interceptor.ts       ← Request/response logging
│   ├── transform.interceptor.ts     ← Response wrapping
│   └── correlation.interceptor.ts   ← Request tracing
│
├── filters/
│   └── global-exception.filter.ts   ← Centralized error handling
│
├── decorators/
│   ├── current-user.decorator.ts    ← Extract JWT payload
│   └── rate-limit.decorator.ts      ← Custom rate limits
│
├── dto/
│   ├── api-response.dto.ts          ← { success, data, meta }
│   ├── paginated-response.dto.ts    ← { items, page, total }
│   └── pagination.dto.ts            ← page, limit, sort
│
├── validators/
│   └── address.validator.ts         ← Ethereum address regex
│
├── utils/
│   └── bigint.utils.ts              ← BigInt ↔ JSON serialization
│
├── constants/
│   ├── redis.constants.ts           ← Key patterns
│   ├── pubsub.constants.ts          ← Channel names
│   └── websocket.constants.ts       ← Event names
│
├── logger/
│   └── json-logger.service.ts       ← Structured logging
│
├── metrics/
│   └── metrics.service.ts           ← Prometheus metrics
│
└── resilience/
    └── circuit-breaker.ts           ← Failure isolation
```

### 4.2 Database Library (@hodlfun/database)

```
libs/database/src/
│
└── prisma.service.ts
    │
    └── class PrismaService extends PrismaClient
        │
        ├── onModuleInit()     → await this.$connect()
        ├── onModuleDestroy()  → await this.$disconnect()
        └── cleanDatabase()    → Test utility (truncate)
```

### 4.3 Redis Library (@hodlfun/redis)

```
libs/redis/src/
│
├── redis.service.ts       ← ioredis client wrapper
│   │
│   └── class RedisService extends Redis
│       └── Auto-reconnect, connection pooling
│
├── cache.service.ts       ← Application-level caching
│   │
│   └── class CacheService
│       ├── get<T>(key): Promise<T | null>
│       ├── set(key, value, ttl): Promise<void>
│       ├── getOrSet<T>(key, ttl, fn): Promise<T>  ← Cache-aside
│       └── del(key): Promise<void>
│
├── pubsub.service.ts      ← Event publishing/subscribing
│   │
│   └── class PubSubService
│       ├── publish(channel, message): Promise<void>
│       └── subscribe(channel, handler): Promise<void>
│
└── dlq.service.ts         ← Dead Letter Queue
    │
    └── class DlqService
        ├── push(queueName, message)
        └── process(queueName, handler)
```

---

## 5. DATABASE SCHEMA (Prisma)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐      1:N      ┌─────────────────┐                     │
│  │      Token      │ ◄───────────► │      Trade      │                     │
│  │                 │               │                 │                     │
│  │ • address (PK)  │               │ • id (PK)       │                     │
│  │ • curveAddress  │               │ • tokenAddress  │                     │
│  │ • creatorAddr   │               │ • type (enum)   │                     │
│  │ • name, symbol  │               │ • traderAddress │                     │
│  │ • tokenUri      │               │ • amountIn/Out  │                     │
│  │ • virtualNative │               │ • price         │                     │
│  │ • virtualToken  │               │ • feeAmount     │                     │
│  │ • realNative    │               │ • txHash        │                     │
│  │ • realToken     │               │ • blockNumber   │                     │
│  │ • k (constant)  │               │ • timestamp     │                     │
│  │ • currentPrice  │               └─────────────────┘                     │
│  │ • marketCap     │                                                       │
│  │ • athPrice      │      1:N      ┌─────────────────┐                     │
│  │ • athMarketCap  │ ◄───────────► │     Holder      │                     │
│  │ • status (enum) │               │                 │                     │
│  │ • createdAt     │               │ • id (PK)       │                     │
│  └─────────────────┘               │ • tokenAddress  │                     │
│          │                         │ • holderAddress │                     │
│          │                         │ • balance       │                     │
│          │ 1:N                     │ • firstBuyTs    │                     │
│          ▼                         │ • lastActivityTs│                     │
│  ┌─────────────────┐               └─────────────────┘                     │
│  │  PriceHistory   │                                                       │
│  │                 │      1:N      ┌─────────────────┐                     │
│  │ • id (PK)       │ ◄───────────► │      Alert      │                     │
│  │ • tokenAddress  │               │                 │                     │
│  │ • timestamp     │               │ • id (PK)       │                     │
│  │ • interval(enum)│               │ • walletAddress │                     │
│  │ • open          │               │ • tokenAddress  │                     │
│  │ • high          │               │ • alertType     │                     │
│  │ • low           │               │ • targetPrice   │                     │
│  │ • close         │               │ • isTriggered   │                     │
│  │ • volumeNative  │               │ • triggeredAt   │                     │
│  │ • volumeToken   │               └─────────────────┘                     │
│  │ • tradeCount    │                                                       │
│  └─────────────────┘                                                       │
│                                                                             │
│  ┌─────────────────┐               ┌─────────────────┐                     │
│  │      User       │               │   CreatorFee    │                     │
│  │                 │               │                 │                     │
│  │ • walletAddr(PK)│               │ • creatorAddr(PK)│                    │
│  │ • pushDid       │               │ • accumulated   │                     │
│  │ • email         │               │ • claimed       │                     │
│  │ • authType      │               │ • updatedAt     │                     │
│  │ • isAdmin       │               └─────────────────┘                     │
│  │ • totalInvested │                                                       │
│  │ • totalReturned │               ┌─────────────────┐                     │
│  │ • totalTrades   │               │  IndexerState   │                     │
│  │ • createdAt     │               │                 │                     │
│  └─────────────────┘               │ • id (PK)       │                     │
│                                    │ • lastBlock     │                     │
│  ┌─────────────────┐               │ • lastHash      │                     │
│  │    AuditLog     │               │ • updatedAt     │                     │
│  │                 │               └─────────────────┘                     │
│  │ • id (PK)       │                                                       │
│  │ • walletAddress │                                                       │
│  │ • action        │                                                       │
│  │ • entityType    │                                                       │
│  │ • entityId      │                                                       │
│  │ • details (JSON)│                                                       │
│  │ • ipAddress     │                                                       │
│  │ • userAgent     │                                                       │
│  │ • createdAt     │                                                       │
│  └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Enums**:
```
TokenStatus: TRADING | LOCKED | LISTED
TradeType: BUY | SELL
PriceInterval: ONE_MINUTE | FIVE_MINUTE | FIFTEEN_MINUTE | ONE_HOUR | FOUR_HOUR | ONE_DAY
AlertType: PRICE_ABOVE | PRICE_BELOW | GRADUATION
AuthType: WALLET | SOCIAL
```

---

## 6. AUTHENTICATION FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         WALLET AUTHENTICATION FLOW                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Request Nonce                                                       │
│  ─────────────────────                                                       │
│                                                                              │
│  Client                          API                           Redis         │
│    │                              │                              │           │
│    │  POST /auth/nonce            │                              │           │
│    │  { wallet: "0x..." }         │                              │           │
│    │ ─────────────────────────►   │                              │           │
│    │                              │  SET auth:nonce:0x...        │           │
│    │                              │  { nonce, timestamp }        │           │
│    │                              │  TTL: 5 minutes              │           │
│    │                              │ ─────────────────────────►   │           │
│    │                              │                              │           │
│    │  { nonce, message,           │                              │           │
│    │    expiresAt }               │                              │           │
│    │ ◄─────────────────────────   │                              │           │
│                                                                              │
│                                                                              │
│  STEP 2: Sign Message (Client-Side)                                          │
│  ──────────────────────────────────                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Message Format:                                                     │    │
│  │                                                                      │    │
│  │  Welcome to Hodl.fun!                                                │    │
│  │  Click to sign in and accept the Hodl.fun Terms of Service.         │    │
│  │  This request will not trigger a blockchain transaction.             │    │
│  │                                                                      │    │
│  │  Nonce: {uuid}                                                       │    │
│  │  Timestamp: {ISO timestamp}                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  wallet.signMessage(message) → signature                                     │
│                                                                              │
│                                                                              │
│  STEP 3: Verify Signature                                                    │
│  ────────────────────────                                                    │
│                                                                              │
│  Client                          API                           Redis         │
│    │                              │                              │           │
│    │  POST /auth/verify           │                              │           │
│    │  { wallet, signature }       │                              │           │
│    │ ─────────────────────────►   │                              │           │
│    │                              │  GET auth:nonce:0x...        │           │
│    │                              │ ─────────────────────────►   │           │
│    │                              │ ◄─────────────────────────   │           │
│    │                              │                              │           │
│    │                              │  ethers.verifyMessage(       │           │
│    │                              │    message, signature        │           │
│    │                              │  ) → recovered address       │           │
│    │                              │                              │           │
│    │                              │  if (recovered === wallet)   │           │
│    │                              │    ✓ Authenticated           │           │
│    │                              │                              │           │
│    │                              │  DEL auth:nonce:0x...        │           │
│    │                              │  (one-time use)              │           │
│    │                              │ ─────────────────────────►   │           │
│    │                              │                              │           │
│    │  { accessToken,              │                              │           │
│    │    refreshToken,             │                              │           │
│    │    expiresIn: 900 }          │                              │           │
│    │ ◄─────────────────────────   │                              │           │
│                                                                              │
│                                                                              │
│  STEP 4: Authenticated Requests                                              │
│  ──────────────────────────────                                              │
│                                                                              │
│  Client                          API                                         │
│    │                              │                                          │
│    │  GET /users/me               │                                          │
│    │  Authorization: Bearer {jwt} │                                          │
│    │ ─────────────────────────►   │                                          │
│    │                              │                                          │
│    │                              │  JwtStrategy.validate()                  │
│    │                              │  → { sub: walletAddress }                │
│    │                              │                                          │
│    │  { walletAddress,            │                                          │
│    │    portfolio, ... }          │                                          │
│    │ ◄─────────────────────────   │                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**JWT Payload**:
```typescript
{
  sub: "0x1234...",       // Wallet address
  type: "access",         // or "refresh"
  iat: 1706612400,        // Issued at
  exp: 1706613300         // Expires (15m for access, 7d for refresh)
}
```

---

## 7. COMPLETE DATA FLOW: USER BUYS TOKEN

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW: TOKEN PURCHASE                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER SUBMITS TRANSACTION                                                 │
│  ───────────────────────────                                                 │
│                                                                              │
│     User Wallet                   Push Chain                                 │
│        │                              │                                      │
│        │  Core.exactInBuy(            │                                      │
│        │    amountIn,                 │                                      │
│        │    amountOutMin,             │                                      │
│        │    tokenAddress,             │                                      │
│        │    to,                       │                                      │
│        │    deadline                  │                                      │
│        │  )                           │                                      │
│        │ ─────────────────────────►   │                                      │
│        │                              │                                      │
│        │  ✓ TX Confirmed              │                                      │
│        │  Events emitted:             │                                      │
│        │  - Buy (Core)                │                                      │
│        │  - Buy (BondingCurve)        │                                      │
│        │  - Sync (BondingCurve)       │                                      │
│        │ ◄─────────────────────────   │                                      │
│                                                                              │
│                                                                              │
│  2. INDEXER DETECTS EVENT                                                    │
│  ────────────────────────                                                    │
│                                                                              │
│     Push Chain                    Indexer                                    │
│        │                              │                                      │
│        │  WebSocket: Buy event        │                                      │
│        │ ─────────────────────────►   │                                      │
│        │                              │                                      │
│        │                              │  EventProcessorService               │
│        │                              │  ├─ Parse log                        │
│        │                              │  ├─ Extract: to, token,              │
│        │                              │  │   amountIn, amountOut, price      │
│        │                              │  └─ Route to TradeHandler            │
│                                                                              │
│                                                                              │
│  3. DATABASE PERSISTENCE                                                     │
│  ───────────────────────                                                     │
│                                                                              │
│     Indexer                       PostgreSQL                                 │
│        │                              │                                      │
│        │  prisma.trade.create({       │                                      │
│        │    type: 'BUY',              │                                      │
│        │    tokenAddress,             │                                      │
│        │    traderAddress: to,        │                                      │
│        │    amountIn, amountOut,      │                                      │
│        │    price, txHash, ...        │                                      │
│        │  })                          │                                      │
│        │ ─────────────────────────►   │                                      │
│        │                              │                                      │
│        │  prisma.token.update({       │                                      │
│        │    virtualNative,            │                                      │
│        │    virtualToken,             │                                      │
│        │    realNative,               │                                      │
│        │    realToken,                │                                      │
│        │    currentPrice              │                                      │
│        │  })                          │                                      │
│        │ ─────────────────────────►   │                                      │
│        │                              │                                      │
│        │  prisma.holder.upsert({      │                                      │
│        │    tokenAddress,             │                                      │
│        │    holderAddress: to,        │                                      │
│        │    balance += amountOut      │                                      │
│        │  })                          │                                      │
│        │ ─────────────────────────►   │                                      │
│                                                                              │
│                                                                              │
│  4. REAL-TIME BROADCAST                                                      │
│  ──────────────────────                                                      │
│                                                                              │
│     Indexer                       Redis                     WebSocket        │
│        │                           │                            │            │
│        │  PubSubService.publish(   │                            │            │
│        │    'blockchain-events',   │                            │            │
│        │    { event: 'Buy',        │                            │            │
│        │      data: trade }        │                            │            │
│        │  )                        │                            │            │
│        │ ──────────────────────►   │                            │            │
│        │                           │  Channel subscription      │            │
│        │                           │ ───────────────────────►   │            │
│        │                           │                            │            │
│        │                           │                 EventsGateway           │
│        │                           │                 .broadcastToToken(      │
│        │                           │                   tokenAddress,         │
│        │                           │                   'buy',                │
│        │                           │                   trade                 │
│        │                           │                 )                       │
│        │                           │                            │            │
│        │                           │         Redis Adapter      │            │
│        │                           │ ◄─────────────────────     │            │
│        │                           │    (broadcast to all pods) │            │
│                                                                              │
│                                                                              │
│  5. CLIENT RECEIVES UPDATE                                                   │
│  ─────────────────────────                                                   │
│                                                                              │
│     WebSocket Pod 1              WebSocket Pod N              Client         │
│        │                              │                          │           │
│        │  server.to('token:0x...')    │                          │           │
│        │  .emit('buy', trade)         │                          │           │
│        │ ─────────────────────────►   │                          │           │
│        │                              │ ─────────────────────►   │           │
│        │                              │                          │           │
│        │                              │   socket.on('buy',       │           │
│        │                              │     (trade) => {         │           │
│        │                              │       updateUI(trade);   │           │
│        │                              │     }                    │           │
│        │                              │   )                      │           │
│                                                                              │
│                                                                              │
│  6. WORKER BACKGROUND PROCESSING                                             │
│  ───────────────────────────────                                             │
│                                                                              │
│     Worker                        PostgreSQL                                 │
│        │                              │                                      │
│        │  @Cron(EVERY_MINUTE)         │                                      │
│        │  CandleScheduler             │                                      │
│        │                              │                                      │
│        │  1. Fetch trades from        │                                      │
│        │     last minute              │                                      │
│        │ ─────────────────────────►   │                                      │
│        │ ◄─────────────────────────   │                                      │
│        │                              │                                      │
│        │  2. Aggregate OHLC           │                                      │
│        │     open, high, low, close   │                                      │
│        │     volume, tradeCount       │                                      │
│        │                              │                                      │
│        │  3. Upsert PriceHistory      │                                      │
│        │ ─────────────────────────►   │                                      │
│        │                              │                                      │
│        │  @Cron(EVERY_5_MINUTES)      │                                      │
│        │  MetricsScheduler            │                                      │
│        │                              │                                      │
│        │  4. Update Token metrics     │                                      │
│        │     marketCap, volume24h,    │                                      │
│        │     holderCount              │                                      │
│        │ ─────────────────────────►   │                                      │
│                                                                              │
│                                                                              │
│  7. API SERVES UPDATED DATA                                                  │
│  ──────────────────────────                                                  │
│                                                                              │
│     Client                        API                        Redis/DB        │
│        │                           │                            │            │
│        │  GET /tokens/0x.../trades │                            │            │
│        │ ──────────────────────►   │                            │            │
│        │                           │  CacheService.getOrSet()   │            │
│        │                           │ ───────────────────────►   │            │
│        │                           │ ◄───────────────────────   │            │
│        │                           │  (cache miss → query DB)   │            │
│        │                           │                            │            │
│        │  { trades: [...],         │                            │            │
│        │    page: 1,               │                            │            │
│        │    total: 150 }           │                            │            │
│        │ ◄──────────────────────   │                            │            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. OBSERVABILITY & RESILIENCE

### Metrics (Prometheus)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROMETHEUS METRICS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HTTP METRICS                                                               │
│  ────────────                                                               │
│  http_requests_total{method, path, status}         Counter                  │
│  http_request_duration_seconds{method, path}       Histogram                │
│                                                                             │
│  BUSINESS METRICS                                                           │
│  ────────────────                                                           │
│  hodlfun_trades_total{type, status}                Counter                  │
│  hodlfun_tokens_created_total                      Counter                  │
│  hodlfun_trading_volume_push{type}                 Counter                  │
│  hodlfun_websocket_connections_active              Gauge                    │
│                                                                             │
│  QUEUE METRICS                                                              │
│  ─────────────                                                              │
│  hodlfun_queue_jobs_processed_total{queue, status} Counter                  │
│  hodlfun_queue_job_duration_seconds{queue}         Histogram                │
│  hodlfun_queue_depth{queue, state}                 Gauge                    │
│                                                                             │
│  INDEXER METRICS                                                            │
│  ───────────────                                                            │
│  hodlfun_indexer_block_lag                         Gauge                    │
│  hodlfun_indexer_events_processed_total{type}      Counter                  │
│                                                                             │
│  ALERT METRICS                                                              │
│  ─────────────                                                              │
│  hodlfun_alerts_checked_total                      Counter                  │
│  hodlfun_alerts_triggered_total{type}              Counter                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Circuit Breaker Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CIRCUIT BREAKER STATES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│     ┌─────────┐         5 failures        ┌─────────┐                      │
│     │ CLOSED  │ ─────────────────────────► │  OPEN   │                      │
│     │ (OK)    │                            │ (FAIL)  │                      │
│     └────┬────┘                            └────┬────┘                      │
│          │                                      │                           │
│          │                                      │ 30s timeout               │
│          │                                      │                           │
│          │         1 success                    ▼                           │
│          │ ◄─────────────────────────── ┌───────────┐                      │
│          │                              │HALF-OPEN  │                      │
│          │         1 failure            │ (TEST)    │                      │
│          └─────────────────────────────►└───────────┘                      │
│                                                                             │
│  Configuration:                                                             │
│  ├─ failureThreshold: 5                                                     │
│  ├─ resetTimeoutMs: 30000                                                   │
│  └─ fallbackProvider: enabled                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rate Limiting Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RATE LIMITING TIERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER          │  WINDOW    │  LIMIT    │  USE CASE                        │
│  ──────────────┼────────────┼───────────┼──────────────────────────────────│
│  short         │  1 second  │  10 req   │  Burst protection                │
│  medium        │  10 second │  50 req   │  Normal API usage                │
│  long          │  1 minute  │  200 req  │  Heavy API usage                 │
│                                                                             │
│  Storage: Redis (distributed across pods)                                   │
│  Key Pattern: ratelimit:{tier}:{ip}:{endpoint}                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. DEPLOYMENT ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES DEPLOYMENT                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                           INGRESS (nginx)                              │  │
│  │                                                                        │  │
│  │  /api/*      → api-service:3000                                        │  │
│  │  /socket.io  → websocket-service:3001                                  │  │
│  │  /metrics    → api-service:3000/metrics                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│          ┌───────────────────────────┼───────────────────────┐              │
│          │                           │                       │              │
│          ▼                           ▼                       ▼              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │   API Service    │    │WebSocket Service │    │ Indexer Service  │      │
│  │   Deployment     │    │   Deployment     │    │   Deployment     │      │
│  │                  │    │                  │    │                  │      │
│  │  replicas: 3     │    │  replicas: 3     │    │  replicas: 1     │      │
│  │  HPA: 3-10       │    │  HPA: 3-10       │    │  (singleton)     │      │
│  │                  │    │                  │    │                  │      │
│  │  CPU: 500m-1000m │    │  CPU: 250m-500m  │    │  CPU: 500m-1000m │      │
│  │  MEM: 512Mi-1Gi  │    │  MEM: 256Mi-512Mi│    │  MEM: 512Mi-1Gi  │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│                                                                              │
│  ┌──────────────────┐                                                       │
│  │  Worker Service  │                                                       │
│  │   Deployment     │                                                       │
│  │                  │                                                       │
│  │  replicas: 2     │                                                       │
│  │                  │                                                       │
│  │  CPU: 250m-500m  │                                                       │
│  │  MEM: 256Mi-512Mi│                                                       │
│  └──────────────────┘                                                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         STATEFUL SERVICES                              │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │  │
│  │  │   PostgreSQL    │    │     Redis       │    │  (Push Chain    │    │  │
│  │  │   StatefulSet   │    │   StatefulSet   │    │   External RPC) │    │  │
│  │  │                 │    │                 │    │                 │    │  │
│  │  │  replicas: 1    │    │  replicas: 1    │    │  External URL   │    │  │
│  │  │  PVC: 100Gi     │    │  PVC: 10Gi      │    │                 │    │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. QUICK REFERENCE SUMMARY

| Component | Port | Responsibility | Scales To |
|-----------|------|----------------|-----------|
| **API** | 3000 | REST endpoints, auth, Swagger | N pods (HPA) |
| **WebSocket** | 3001 | Real-time events, subscriptions | N pods (Redis adapter) |
| **Indexer** | 3002 | Blockchain sync, event parsing | 1 pod (singleton) |
| **Worker** | 3003 | Cron jobs, OHLC, metrics | N pods (job locking) |

| Technology | Purpose |
|------------|---------|
| **NestJS 10** | Application framework |
| **PostgreSQL** | Primary database |
| **Redis** | Cache, PubSub, rate limiting, WebSocket adapter |
| **Prisma 5** | ORM + migrations |
| **Socket.io** | Real-time communication |
| **ethers.js 6** | Blockchain interaction |
| **Prometheus** | Metrics collection |

| Pattern | Implementation |
|---------|----------------|
| **Clean Architecture** | Layered libs (common, database, redis) |
| **CQRS** | Implicit read/write separation in services |
| **Event-Driven** | PubSub channels + WebSocket broadcast |
| **Circuit Breaker** | RPC resilience with fallback |
| **Cache-Aside** | Redis with TTL-based invalidation |
| **Repository** | Prisma repositories in services |

---

This architecture provides a production-ready, horizontally scalable system with clear separation of concerns, real-time capabilities, and strong observability. Each service can be deployed, scaled, and monitored independently.
