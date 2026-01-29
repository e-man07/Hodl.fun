# Phase 2: Data Layer

## Objective
Set up Cloud SQL (PostgreSQL) and Memorystore (Redis) with proper security and connectivity.

## Prerequisites
- Phase 1 completed (VPC, IAM, Private Service Access)

## Duration: 2-3 days

---

## 2.1 Cloud SQL (PostgreSQL)

### Instance Configuration

```hcl
# terraform/cloudsql.tf

resource "google_sql_database_instance" "main" {
  name             = "hodlfun-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier              = var.environment == "production" ? "db-custom-2-8192" : "db-f1-micro"
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_size         = var.environment == "production" ? 50 : 10
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "production"
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 4  # 4 AM
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = true
    }

    database_flags {
      name  = "log_statement"
      value = "ddl"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1s
    }
  }

  deletion_protection = var.environment == "production"
}

# Database
resource "google_sql_database" "main" {
  name     = "hodlfun"
  instance = google_sql_database_instance.main.name
}

# User
resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_user" "main" {
  name     = "hodlfun"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# Store credentials in Secret Manager
resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.main.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.main.name}?schema=public"
}
```

### Read Replica (Production Only)

```hcl
resource "google_sql_database_instance" "replica" {
  count = var.environment == "production" ? 1 : 0

  name                 = "hodlfun-postgres-replica"
  master_instance_name = google_sql_database_instance.main.name
  region               = "us-east1"  # Different region for DR
  database_version     = "POSTGRES_15"

  replica_configuration {
    failover_target = false
  }

  settings {
    tier              = "db-custom-1-4096"
    availability_type = "ZONAL"
    disk_size         = 50
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }
  }
}
```

---

## 2.2 Memorystore (Redis)

### Instance Configuration

```hcl
# terraform/memorystore.tf

resource "google_redis_instance" "main" {
  name           = "hodlfun-redis"
  tier           = var.environment == "production" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.environment == "production" ? 5 : 1
  region         = var.region

  redis_version = "REDIS_7_0"
  display_name  = "Hodl.fun Redis"

  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  auth_enabled = true

  transit_encryption_mode = "SERVER_AUTHENTICATION"

  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "TWENTY_FOUR_HOURS"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  redis_configs = {
    maxmemory-policy        = "volatile-lru"
    notify-keyspace-events  = "Ex"
  }

  labels = {
    environment = var.environment
    app         = "hodlfun"
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Store Redis connection in Secret Manager
resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://:${google_redis_instance.main.auth_string}@${google_redis_instance.main.host}:${google_redis_instance.main.port}"
}
```

---

## 2.3 Database Schema (Prisma)

### Schema File

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// TOKENS
// ==========================================

model Token {
  id                    String   @id @default(uuid())
  address               String   @unique
  curveAddress          String   @unique @map("curve_address")
  creatorAddress        String   @map("creator_address")
  name                  String
  symbol                String
  tokenUri              String?  @map("token_uri")

  // Reserves (stored as strings for BigInt precision)
  virtualNative         String   @map("virtual_native")
  virtualToken          String   @map("virtual_token")
  realNative            String   @default("0") @map("real_native")
  realToken             String   @default("0") @map("real_token")
  k                     String

  // Price data
  currentPrice          String   @map("current_price")
  marketCap             String   @map("market_cap")
  athPrice              String?  @map("ath_price")
  athPriceTimestamp     DateTime? @map("ath_price_timestamp")
  athMarketCap          String?  @map("ath_market_cap")
  athMarketCapTimestamp DateTime? @map("ath_market_cap_timestamp")

  // Status
  status                TokenStatus @default(TRADING)
  poolAddress           String?  @map("pool_address")

  // Timestamps
  createdAt             DateTime @default(now()) @map("created_at")
  createdBlock          BigInt   @map("created_block")
  graduatedAt           DateTime? @map("graduated_at")
  listedAt              DateTime? @map("listed_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  // Relations
  trades                Trade[]
  holders               Holder[]
  priceHistory          PriceHistory[]

  @@index([creatorAddress])
  @@index([status])
  @@index([createdAt])
  @@index([marketCap])
  @@map("tokens")
}

enum TokenStatus {
  TRADING
  LOCKED
  LISTED
}

// ==========================================
// TRADES
// ==========================================

model Trade {
  id            String    @id @default(uuid())
  tokenAddress  String    @map("token_address")
  type          TradeType
  traderAddress String    @map("trader_address")
  amountIn      String    @map("amount_in")
  amountOut     String    @map("amount_out")
  price         String
  feeAmount     String    @map("fee_amount")
  txHash        String    @unique @map("tx_hash")
  blockNumber   BigInt    @map("block_number")
  timestamp     DateTime

  // Relations
  token         Token     @relation(fields: [tokenAddress], references: [address])

  @@index([tokenAddress, timestamp])
  @@index([traderAddress, timestamp])
  @@index([blockNumber])
  @@map("trades")
}

enum TradeType {
  BUY
  SELL
}

// ==========================================
// HOLDERS
// ==========================================

model Holder {
  id                    String   @id @default(uuid())
  tokenAddress          String   @map("token_address")
  holderAddress         String   @map("holder_address")
  balance               String
  firstBuyTimestamp     DateTime @map("first_buy_timestamp")
  lastActivityTimestamp DateTime @map("last_activity_timestamp")

  // Relations
  token                 Token    @relation(fields: [tokenAddress], references: [address])

  @@unique([tokenAddress, holderAddress])
  @@index([tokenAddress])
  @@index([holderAddress])
  @@map("holders")
}

// ==========================================
// PRICE HISTORY (OHLC)
// ==========================================

model PriceHistory {
  id           String        @id @default(uuid())
  tokenAddress String        @map("token_address")
  timestamp    DateTime
  interval     PriceInterval
  open         String
  high         String
  low          String
  close        String
  volumeNative String        @map("volume_native")
  volumeToken  String        @map("volume_token")
  tradeCount   Int           @map("trade_count")

  // Relations
  token        Token         @relation(fields: [tokenAddress], references: [address])

  @@unique([tokenAddress, interval, timestamp])
  @@index([tokenAddress, interval, timestamp])
  @@map("price_history")
}

enum PriceInterval {
  ONE_MINUTE
  FIVE_MINUTES
  FIFTEEN_MINUTES
  ONE_HOUR
  FOUR_HOURS
  ONE_DAY
}

// ==========================================
// CREATOR FEES
// ==========================================

model CreatorFee {
  id                        String    @id @default(uuid())
  creatorAddress            String    @unique @map("creator_address")
  accumulatedFees           String    @map("accumulated_fees")
  claimedFees               String    @default("0") @map("claimed_fees")
  lastAccumulationTimestamp DateTime  @map("last_accumulation_timestamp")
  lastClaimTimestamp        DateTime? @map("last_claim_timestamp")

  @@map("creator_fees")
}

// ==========================================
// USER PORTFOLIOS
// ==========================================

model UserPortfolio {
  id            String   @id @default(uuid())
  walletAddress String   @unique @map("wallet_address")
  totalInvested String   @default("0") @map("total_invested")
  totalReturned String   @default("0") @map("total_returned")
  totalTrades   Int      @default(0) @map("total_trades")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("user_portfolios")
}

// ==========================================
// INDEXER STATE
// ==========================================

model IndexerState {
  id                 String   @id @default("main")
  lastProcessedBlock BigInt   @map("last_processed_block")
  lastProcessedHash  String?  @map("last_processed_hash")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@map("indexer_state")
}
```

---

## 2.4 Verification Checklist

### Cloud SQL
- [ ] Instance created and running
- [ ] Private IP assigned
- [ ] Database created
- [ ] User created with password
- [ ] Backups configured
- [ ] Connection string in Secret Manager

### Memorystore
- [ ] Instance created and running
- [ ] AUTH enabled
- [ ] Transit encryption enabled
- [ ] Connection details in Secret Manager

### Connectivity
- [ ] Test connection from GKE cluster
- [ ] Test connection from local machine (via Cloud SQL Proxy)

## Manual Verification Commands

```bash
# Cloud SQL status
gcloud sql instances describe hodlfun-postgres

# Get private IP
gcloud sql instances describe hodlfun-postgres --format="value(ipAddresses[0].ipAddress)"

# Redis status
gcloud redis instances describe hodlfun-redis --region=us-central1

# Test connection via Cloud SQL Proxy
cloud_sql_proxy -instances=PROJECT_ID:us-central1:hodlfun-postgres=tcp:5432

# Connect with psql
psql "host=127.0.0.1 port=5432 user=hodlfun dbname=hodlfun"
```

## Connection Patterns

### From NestJS Application

```typescript
// Database URL format
// postgresql://user:password@PRIVATE_IP:5432/database?schema=public

// Redis URL format
// redis://:AUTH_STRING@PRIVATE_IP:6379
```

## Next Phase
Proceed to **Phase 3: Container Infrastructure** to set up GKE Autopilot.
