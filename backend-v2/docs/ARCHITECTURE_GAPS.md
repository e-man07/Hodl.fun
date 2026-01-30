# Architecture Implementation Gaps

This document details the gaps between the planned architecture (`backend-arch/hodlfun-v2-backend-architecture.md`) and the current implementation. Each gap is documented with its impact, priority, and implementation guidance.

**Last Updated:** 2026-01-29
**Review Status:** Post-Phase 11 Implementation

---

## Table of Contents

1. [Price Alerts System](#1-price-alerts-system)
2. [Leaderboard Background Job](#2-leaderboard-background-job)
3. [TimescaleDB Extension](#3-timescaledb-extension)
4. [Audit Logs](#4-audit-logs)
5. [Full Users Table](#5-full-users-table)
6. [Graduations Table](#6-graduations-table)
7. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## 1. Price Alerts System

### Specification (Architecture Doc)

The architecture specifies a complete price alerts system allowing users to set alerts for price thresholds.

**Database Schema (Specified):**
```sql
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
```

**API Endpoints (Specified):**
```
├── /alerts
│   ├── GET    /                # Get user alerts (auth required)
│   ├── POST   /                # Create alert
│   ├── DELETE /:id             # Delete alert
│   └── PUT    /:id             # Update alert
```

**Background Job (Specified):**
```typescript
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
```

**WebSocket Events (Specified):**
```typescript
// Room: alerts:{wallet}
socket.on('alert_triggered', {
    alertId: 'uuid',
    tokenAddress: '0x...',
    type: 'price_above',
    targetPrice: '0.0001',
    currentPrice: '0.00012',
    timestamp: 1234567890
});
```

**Redis Pub/Sub Channel (Specified):**
```
channel:user:{wallet}:alerts             → Triggered alerts
```

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29)

**Implemented Components:**
- [x] `Alert` Prisma model in `schema.prisma` with AlertType enum
- [x] `AlertsModule` in API service
- [x] `AlertsController` with CRUD endpoints (JWT protected)
- [x] `AlertsService` with business logic and trigger detection
- [x] DTOs for create/update/response
- [x] `AlertsProcessor` in Worker service (listens to PubSub)
- [x] `AlertsModule` in Worker service
- [x] Alert metrics (`alertsChecked`, `alertsTriggered`)
- [x] Redis pub/sub channels for alert notifications
- [x] Full test coverage (53 tests)

**Pending (Nice-to-have):**
- [ ] WebSocket gateway subscription for real-time alert delivery to frontend

**Files Created:**
```
prisma/schema.prisma                               # Added Alert model & AlertType enum
apps/api/src/alerts/
├── index.ts                                       # Module exports
├── alerts.module.ts                               # NestJS module
├── alerts.controller.ts                           # CRUD endpoints
├── alerts.service.ts                              # Business logic
└── dto/
    └── alerts.dto.ts                              # DTOs

apps/worker/src/alerts/
├── index.ts                                       # Module exports
├── alerts.module.ts                               # NestJS module
└── alerts.processor.ts                            # PubSub listener

libs/common/src/metrics/metrics.service.ts         # Added alertsChecked, alertsTriggered

apps/api/src/__tests__/unit/
├── alerts.service.spec.ts                         # 24 tests
└── alerts.controller.spec.ts                      # 7 tests

apps/worker/src/__tests__/unit/
└── alerts.processor.spec.ts                       # 22 tests
```

**API Endpoints Implemented:**
```
POST   /api/v1/alerts           # Create alert (auth required)
GET    /api/v1/alerts           # Get user alerts (auth required)
GET    /api/v1/alerts/:id       # Get alert by ID (auth required)
PUT    /api/v1/alerts/:id       # Update alert (auth required)
DELETE /api/v1/alerts/:id       # Delete alert (auth required)
```

**PubSub Channels:**
```
trade_completed    → Worker checks price alerts after each trade
token_graduated    → Worker triggers graduation alerts
alerts:{wallet}    → Triggered alerts published for WebSocket delivery
```

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| User Experience | Medium | ✅ Resolved |
| Engagement | Medium | ✅ Resolved |
| Competitive | Low | ✅ Resolved |

### Implementation Guidance

**Step 1: Add Prisma Model**
```prisma
// prisma/schema.prisma
model Alert {
  id            String      @id @default(uuid())
  walletAddress String      @map("wallet_address")
  tokenAddress  String      @map("token_address")
  alertType     AlertType   @map("alert_type")
  targetPrice   String      @map("target_price")
  isTriggered   Boolean     @default(false) @map("is_triggered")
  triggeredAt   DateTime?   @map("triggered_at")
  createdAt     DateTime    @default(now()) @map("created_at")

  token         Token       @relation(fields: [tokenAddress], references: [address])

  @@index([walletAddress])
  @@index([tokenAddress])
  @@index([isTriggered])
  @@map("alerts")
}

enum AlertType {
  PRICE_ABOVE
  PRICE_BELOW
  GRADUATION
}
```

**Step 2: Create AlertsModule in API**
```
apps/api/src/alerts/
├── alerts.module.ts
├── alerts.controller.ts
├── alerts.service.ts
└── dto/
    ├── create-alert.dto.ts
    └── alert-response.dto.ts
```

**Step 3: Add Alert Processor in Worker**
```
apps/worker/src/alerts/
├── alerts.module.ts
└── alerts.processor.ts
```

**Step 4: Add WebSocket Alert Room**
- Subscribe: `subscribe:alerts` with wallet address
- Emit: `alert_triggered` event

**Estimated Effort:** 2-3 days

---

## 2. Leaderboard Background Job

### Specification (Architecture Doc)

The architecture specifies a background job that pre-computes leaderboard rankings every 30 seconds.

**Background Job (Specified):**
```typescript
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
        const volume = await this.db.query(`...`);
        await this.redis.set('cache:leaderboard:volume', JSON.stringify(volume), 'EX', 30);

        // Newest tokens
        const newest = await this.db.query(`...`);
        await this.redis.set('cache:leaderboard:new', JSON.stringify(newest), 'EX', 30);

        // Broadcast update
        await this.redis.publish('channel:leaderboard', JSON.stringify({ updated: true }));
    }
}
```

**API Endpoints (Specified):**
```
├── /leaderboard
│   ├── GET    /gainers         # Top price gainers
│   ├── GET    /losers          # Top price losers
│   ├── GET    /volume          # Top volume
│   ├── GET    /new             # Newest tokens
│   └── GET    /graduated       # Recently graduated
```

**BullMQ Queue (Specified):**
```
bull:leaderboard-update                  → Leaderboard recalculation
```

**Schedule (Specified):** Every 30 seconds

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29)

**Implemented Components:**
- [x] `LeaderboardService` in Worker - Computes 5 leaderboard types every 30 seconds
- [x] `LeaderboardScheduler` - Cron job running every 30 seconds
- [x] `LeaderboardModule` in API - REST endpoints for all leaderboard types
- [x] `LeaderboardController` - 5 dedicated endpoints
- [x] Redis cache with 30s TTL for pre-computed data
- [x] PubSub broadcast on leaderboard update
- [x] Full test coverage (34 tests)

**Files Created:**
```
apps/worker/src/leaderboard/
├── index.ts                    # Module exports
├── leaderboard.module.ts       # NestJS module
├── leaderboard.service.ts      # Computation logic (23 tests)
└── leaderboard.scheduler.ts    # Cron job (11 tests)

apps/api/src/leaderboard/
├── index.ts                    # Module exports
├── leaderboard.module.ts       # NestJS module
├── leaderboard.controller.ts   # 5 REST endpoints
└── leaderboard.service.ts      # Cache-first with fallback (11 tests)
```

**API Endpoints Implemented:**
```
GET /api/v1/leaderboard/gainers     # Top price gainers (24h)
GET /api/v1/leaderboard/losers      # Top price losers (24h)
GET /api/v1/leaderboard/volume      # Top trading volume (24h)
GET /api/v1/leaderboard/new         # Newest tokens
GET /api/v1/leaderboard/graduated   # Recently graduated tokens
```

**Architecture:**
- Worker computes all 5 leaderboards every 30 seconds
- Results cached in Redis with 30s TTL
- API reads from cache, falls back to on-demand if cache miss
- PubSub broadcast notifies WebSocket clients

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| Performance | Low | ✅ Resolved |
| Scalability | Medium | ✅ Resolved |
| Real-time UX | Low | ✅ Resolved |

---

## 3. TimescaleDB Extension

### Specification (Architecture Doc)

The architecture specifies using TimescaleDB for efficient time-series data storage of OHLCV candles.

**Database Configuration (Specified):**
```yaml
Extensions:
  - timescaledb
  - pg_trgm (for search)
  - uuid-ossp
```

**Candles Table (Specified):**
```sql
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
```

**TimescaleDB Benefits (Specified):**
- Automatic partitioning by time
- Efficient time-range queries
- Built-in compression for old data
- `time_bucket()` function for aggregation

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29) - Using Native PostgreSQL Partitioning

**Note:** TimescaleDB is not available in Cloud SQL. We implemented native PostgreSQL declarative partitioning as an alternative, which provides similar benefits for our use case.

**Implemented Components:**
- [x] SQL migration for time-based partitioning (`prisma/migrations/20260129_price_history_partitioning/`)
- [x] Monthly partitions for 2025-2027 (36 partitions pre-created)
- [x] `PartitionManagerService` in Worker - Auto-creates new partitions
- [x] Covering index for common queries
- [x] Partition creation function for future months
- [x] Full test coverage (9 tests)

**Migration File:**
```
prisma/migrations/20260129_price_history_partitioning/migration.sql
```

**Partition Manager Service:**
```
apps/worker/src/cleanup/partition-manager.service.ts
```

**Key Features:**
- **Monthly partitions** - Data partitioned by timestamp range
- **Auto-creation** - Worker creates partitions for next 3 months proactively
- **Scheduled check** - Runs on 25th of each month to create upcoming partitions
- **Graceful fallback** - Works with non-partitioned table in dev/test environments

**Benefits Achieved:**
- Efficient time-range queries (only scans relevant partitions)
- Easy data lifecycle management (can drop old partitions)
- Parallel query execution across partitions
- No TimescaleDB extension dependency

**Prisma Compatibility:**
- Prisma ORM continues to work transparently with partitioned table
- `upsert` and `findMany` work as expected
- Partition management handled separately via raw SQL

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| Query Performance | Low | ✅ Resolved |
| Storage Efficiency | Medium | ✅ Resolved (partition drop supported) |
| Scalability | High | ✅ Resolved |

### Implementation Guidance

**Step 1: Enable TimescaleDB in Cloud SQL**
```hcl
# terraform/cloudsql.tf
resource "google_sql_database_instance" "main" {
  database_version = "POSTGRES_15"

  settings {
    database_flags {
      name  = "cloudsql.enable_pg_cron"
      value = "on"
    }
  }
}

# Note: Cloud SQL doesn't natively support TimescaleDB
# Consider: AlloyDB, self-managed PostgreSQL, or Timescale Cloud
```

**Alternative: Use Cloud SQL Standard with Partitioning**
```sql
-- Native PostgreSQL partitioning (works in Cloud SQL)
CREATE TABLE price_history (
    id UUID DEFAULT gen_random_uuid(),
    token_address VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    interval VARCHAR(20) NOT NULL,
    open NUMERIC(78, 18) NOT NULL,
    high NUMERIC(78, 18) NOT NULL,
    low NUMERIC(78, 18) NOT NULL,
    close NUMERIC(78, 18) NOT NULL,
    volume_native NUMERIC(78, 18) NOT NULL,
    volume_token NUMERIC(78, 18) NOT NULL,
    trade_count INTEGER NOT NULL,
    PRIMARY KEY (token_address, interval, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE price_history_2026_01 PARTITION OF price_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Recommendation:** Defer TimescaleDB until candle data exceeds 10M rows. Use standard PostgreSQL with proper indexing for now.

**Estimated Effort:** 2-3 days (if needed)

---

## 4. Audit Logs

### Specification (Architecture Doc)

The architecture specifies an audit logging system for tracking sensitive actions.

**Database Schema (Specified):**
```sql
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

**Actions to Audit (Implied):**
- Admin configuration changes
- User authentication events
- Sensitive data access
- Rate limit violations
- Security events

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29)

**Implemented Components:**
- [x] `AuditLog` Prisma model in `prisma/schema.prisma`
- [x] `AuditService` with `log()`, `logSafe()`, and query methods
- [x] `AuditInterceptor` for automatic logging on decorated handlers
- [x] `@Audit()` decorator for marking controller methods
- [x] `AuditModule` with `forRoot()` pattern for dependency injection
- [x] Full test coverage (26 tests)

**Files Created:**
```
libs/common/src/audit/
├── index.ts                  # Public exports
├── audit.module.ts           # NestJS module with forRoot()
├── audit.service.ts          # Core service with PRISMA_SERVICE injection
├── audit.decorator.ts        # @Audit() method decorator
└── audit.interceptor.ts      # NestJS interceptor

libs/common/src/__tests__/unit/
├── audit.service.spec.ts     # 17 tests
└── audit.interceptor.spec.ts # 9 tests
```

**Usage Example:**
```typescript
// In AppModule
import { AuditModule } from '@hodlfun/common';
import { PrismaService } from '@hodlfun/database';

@Module({
  imports: [AuditModule.forRoot(PrismaService)],
})
export class AppModule {}

// In Controller
import { Audit, AuditAction } from '@hodlfun/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Audit(AuditAction.AUTH_LOGIN)
  async login() { ... }

  @Post('tokens')
  @Audit(AuditAction.TOKEN_CREATE, { entityType: 'token' })
  async createToken() { ... }
}
```

**Predefined AuditAction Constants:**
- `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_REFRESH`
- `TOKEN_CREATE`, `TOKEN_TRADE`
- `ADMIN_CONFIG_UPDATE`, `ADMIN_USER_BAN`
- `SYSTEM_ERROR`, `RATE_LIMIT_EXCEEDED`

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| Security | Medium | ✅ Resolved |
| Compliance | High | ✅ Resolved |
| Debugging | Low | ✅ Resolved |

---

## 5. Full Users Table

### Specification (Architecture Doc)

The architecture specifies a comprehensive users table supporting both wallet and social login.

**Database Schema (Specified):**
```sql
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
```

**Authentication Types (Specified):**
- Wallet login (signature verification)
- Social login (Push DID via OAuth)

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29)

**Implemented Components:**
- [x] `User` Prisma model with all specified fields
- [x] `AuthType` enum (WALLET, SOCIAL)
- [x] `push_did` for social login
- [x] `email` for contact
- [x] `created_at` timestamp
- [x] `last_login_at` timestamp
- [x] `is_admin` flag
- [x] Portfolio fields embedded (totalInvested, totalReturned, totalTrades)
- [x] `UserPortfolio` model kept for backward compatibility
- [x] Full test coverage (17 tests)

**Prisma Schema:**
```prisma
model User {
  id            String    @id @default(uuid())
  walletAddress String?   @unique @map("wallet_address")
  pushDid       String?   @unique @map("push_did")
  email         String?
  authType      AuthType  @default(WALLET) @map("auth_type")
  isAdmin       Boolean   @default(false) @map("is_admin")

  // Timestamps
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastLoginAt   DateTime? @map("last_login_at")

  // Portfolio data (migrated from UserPortfolio)
  totalInvested String    @default("0") @map("total_invested")
  totalReturned String    @default("0") @map("total_returned")
  totalTrades   Int       @default(0) @map("total_trades")

  @@index([walletAddress])
  @@index([pushDid])
  @@index([authType])
  @@map("users")
}

enum AuthType {
  WALLET
  SOCIAL
}
```

**New UsersService Methods:**
```typescript
// User management
findByWallet(walletAddress: string): Promise<User | null>
findByPushDid(pushDid: string): Promise<User | null>
createWalletUser(walletAddress: string): Promise<User>
createSocialUser(params: { pushDid: string; email?: string }): Promise<User>
getOrCreateWalletUser(walletAddress: string): Promise<User>

// User updates
updateLastLogin(userId: string): Promise<User>
linkWalletToSocialUser(userId: string, walletAddress: string): Promise<User>
updateEmail(userId: string, email: string): Promise<User>

// Admin management
setAdminStatus(userId: string, isAdmin: boolean): Promise<User>
findAdmins(): Promise<User[]>
```

**Files Modified:**
```
prisma/schema.prisma                              # Added User model & AuthType enum
apps/api/src/users/users.service.ts              # Added 10 new methods
apps/api/src/__tests__/unit/user-extended.service.spec.ts  # 17 tests
```

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| Social Login | High | ✅ Resolved |
| User Management | Medium | ✅ Resolved |
| Analytics | Low | ✅ Resolved |

---

## 6. Graduations Table

### Specification (Architecture Doc)

The architecture specifies a separate table to track token graduation events.

**Database Schema (Specified):**
```sql
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
```

**API Endpoint (Specified):**
```
GET /leaderboard/graduated       # Recently graduated tokens
```

### Current Implementation

**Status:** ✅ IMPLEMENTED (2026-01-29)

**Implemented Approach (Option A - Fields in Token Model):**
```prisma
model Token {
  // ... existing fields ...
  status                TokenStatus @default(TRADING)
  poolAddress           String?     @map("pool_address")
  graduatedAt           DateTime?   @map("graduated_at")
  listedAt              DateTime?   @map("listed_at")
  listingBlock          BigInt?     @map("listing_block")

  // Graduation details (populated when token graduates to DEX)
  graduationTxHash      String?     @map("graduation_tx_hash")
  graduationAmount0     String?     @map("graduation_amount0")  // Token amount in pool
  graduationAmount1     String?     @map("graduation_amount1")  // WPUSH amount in pool
  graduationLiquidity   String?     @map("graduation_liquidity") // LP token amount
}

enum TokenStatus {
  TRADING
  LOCKED
  LISTED
}
```

**Implemented Components:**
- [x] Added `graduationTxHash`, `graduationAmount0`, `graduationAmount1`, `graduationLiquidity` fields to Token model
- [x] Updated `handleListing` method in `EventProcessorService` to save graduation details
- [x] Updated `listing` PubSub event to include `graduationTxHash`
- [x] Full test coverage (4 tests for handleListing)

**Files Modified:**
```
prisma/schema.prisma                                    # Added graduation fields to Token
apps/indexer/src/event-processor/event-processor.service.ts  # Updated handleListing
apps/indexer/src/__tests__/unit/event-processor.service.spec.ts  # 4 handleListing tests
```

### Impact

| Impact Area | Severity | Status |
|-------------|----------|--------|
| Data Completeness | Low | ✅ Resolved |
| Analytics | Low | ✅ Resolved |
| API Response | Low | ✅ Resolved |

### Implementation Notes

Used Option A (fields in Token model) as recommended because:
- Graduation is a one-time event per token
- Simpler schema without additional joins
- All graduation data accessible from Token queries
- Consistent with existing `poolAddress`, `listedAt`, `listingBlock` fields

---

## Implementation Priority Matrix

| Gap | Priority | Effort | Business Impact | Status |
|-----|----------|--------|-----------------|--------|
| **Audit Logs** | P1 | 1-2 days | High (compliance) | ✅ DONE |
| **Full Users Table** | P2 | 1 day | Medium | ✅ DONE |
| **Price Alerts** | P2 | 2-3 days | Medium | ✅ DONE |
| **Graduations Table** | P4 | 0.5 days | Low | ✅ DONE |
| **Leaderboard Job** | P3 | 1 day | Medium (scalability) | ✅ DONE |
| **PostgreSQL Partitioning** | P3 | 2 days | Medium (scalability) | ✅ DONE |

### Recommended Implementation Order

1. **Phase 1 (Pre-Production):**
   - ~~Audit Logs (compliance requirement)~~ ✅ DONE

2. **Phase 2 (Post-MVP):**
   - ~~Full Users Table (enables social login)~~ ✅ DONE
   - ~~Price Alerts (user engagement feature)~~ ✅ DONE
   - ~~Graduations Table (enhanced analytics)~~ ✅ DONE

3. **Phase 3 (Scale):**
   - ~~Leaderboard Background Job~~ ✅ DONE
   - ~~PostgreSQL Partitioning for Price History~~ ✅ DONE

**All architecture gaps have been addressed.**

---

## Appendix: Quick Reference

### Files to Create

```
apps/api/src/alerts/             ✅ CREATED
├── index.ts                     ✅ CREATED
├── alerts.module.ts             ✅ CREATED
├── alerts.controller.ts         ✅ CREATED
├── alerts.service.ts            ✅ CREATED
└── dto/
    └── alerts.dto.ts            ✅ CREATED

apps/worker/src/alerts/          ✅ CREATED
├── index.ts                     ✅ CREATED
├── alerts.module.ts             ✅ CREATED
└── alerts.processor.ts          ✅ CREATED

libs/common/src/audit/           ✅ CREATED
├── index.ts                     ✅ CREATED
├── audit.module.ts              ✅ CREATED
├── audit.service.ts             ✅ CREATED
├── audit.decorator.ts           ✅ CREATED
└── audit.interceptor.ts         ✅ CREATED
```

### Prisma Models to Add

```prisma
model Alert { ... }              ✅ CREATED
model AuditLog { ... }           ✅ CREATED
model User { ... }               ✅ CREATED (expanded from UserPortfolio)
enum AlertType { ... }           ✅ CREATED
enum AuthType { ... }            ✅ CREATED
```

### API Endpoints to Add

```
POST   /api/v1/alerts
GET    /api/v1/alerts
GET    /api/v1/alerts/:id
PUT    /api/v1/alerts/:id
DELETE /api/v1/alerts/:id

GET    /api/v1/admin/audit-logs
```

### BullMQ Queues to Add

```
bull:alert-check          → Check price alerts on trades
bull:leaderboard-update   → Pre-compute leaderboards (optional)
```
