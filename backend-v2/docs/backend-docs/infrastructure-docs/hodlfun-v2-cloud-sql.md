# Hodl.fun V2 - Cloud SQL (PostgreSQL)

## Table of Contents
1. [Overview](#overview)
2. [Why Cloud SQL](#why-cloud-sql)
3. [Instance Configuration](#instance-configuration)
4. [Database Schema](#database-schema)
5. [Table Definitions](#table-definitions)
6. [Indexes & Performance](#indexes--performance)
7. [Relationships & ERD](#relationships--erd)
8. [Connecting from GKE](#connecting-from-gke)
9. [Connection Pooling](#connection-pooling)
10. [Migrations](#migrations)
11. [Queries & Patterns](#queries--patterns)
12. [Backup & Recovery](#backup--recovery)
13. [Monitoring & Maintenance](#monitoring--maintenance)
14. [Cost Estimation](#cost-estimation)

---

## Overview

### What This Document Covers

This document details the PostgreSQL database layer - schema design, table definitions, indexes, connections from GKE, and operational best practices.

### Architecture Position

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                         │
└────────────────────────────────────────────────────────────────────────────┘

GKE Cluster                                      Cloud SQL
┌─────────────────┐                             ┌─────────────────┐
│                 │                             │                 │
│   API Pods      │────── Read/Write ──────────►│   PostgreSQL    │
│   Indexer Pods  │────── Write ───────────────►│                 │
│   Worker Pods   │────── Read/Write ──────────►│   Private IP:   │
│                 │                             │   10.10.0.3     │
│   WebSocket     │                             │                 │
│   (No DB access)│                             │                 │
│                 │                             │                 │
└─────────────────┘                             └─────────────────┘
        │                                               │
        │           VPC Private Network                 │
        └───────────────────────────────────────────────┘
```

### Key Specifications

| Attribute | Value |
|-----------|-------|
| Service | Cloud SQL |
| Database | PostgreSQL 15 |
| Instance Type | db-custom-2-8192 (2 vCPU, 8GB RAM) |
| Storage | 50GB SSD (auto-increase) |
| High Availability | Yes (Regional) |
| Backups | Daily automated + PITR |
| Connection | Private IP only |

---

## Why Cloud SQL

### Cloud SQL vs Self-Managed PostgreSQL

| Aspect | Cloud SQL | Self-Managed (on GKE) |
|--------|-----------|----------------------|
| **Setup Time** | Minutes | Hours/Days |
| **Maintenance** | Google handles | You handle |
| **Backups** | Automatic | Manual setup |
| **High Availability** | One click | Complex setup |
| **Scaling** | Easy vertical | Manual |
| **Security Patches** | Automatic | Manual |
| **Monitoring** | Built-in | Setup required |
| **Cost** | Higher | Lower (but + ops time) |

### Why Cloud SQL for Hodl.fun

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY CLOUD SQL IS RIGHT FOR US                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. STARTUP VELOCITY
─────────────────────────────────────────────────────────────────────────────
   - Focus on product, not database operations
   - No DBA needed initially
   - Quick setup and iteration


2. RELIABILITY
─────────────────────────────────────────────────────────────────────────────
   - 99.95% SLA with HA configuration
   - Automatic failover
   - Google manages replication


3. SECURITY
─────────────────────────────────────────────────────────────────────────────
   - Private IP (no public exposure)
   - Encryption at rest and in transit
   - IAM integration
   - Automatic security patches


4. OPERATIONAL SIMPLICITY
─────────────────────────────────────────────────────────────────────────────
   - Automated backups
   - Point-in-time recovery
   - Easy scaling when needed
   - Built-in monitoring


5. COST EFFICIENCY AT SCALE
─────────────────────────────────────────────────────────────────────────────
   - Start small, scale as needed
   - No over-provisioning required
   - Predictable pricing
```

---

## Instance Configuration

### Recommended Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUD SQL INSTANCE CONFIGURATION                          │
└─────────────────────────────────────────────────────────────────────────────┘

INSTANCE SETTINGS
═══════════════════════════════════════════════════════════════════════════════

Instance ID:        hodlfun-db
Database Version:   PostgreSQL 15
Region:             us-central1 (same as GKE)
Zone:               us-central1-a (primary)
                    us-central1-b (standby for HA)


MACHINE TYPE
═══════════════════════════════════════════════════════════════════════════════

Development/Staging:
  Type:             db-custom-1-3840
  vCPUs:            1
  Memory:           3.75 GB
  Cost:             ~$50/month

Production (Initial):
  Type:             db-custom-2-8192
  vCPUs:            2
  Memory:           8 GB
  Cost:             ~$120/month

Production (Scaled):
  Type:             db-custom-4-16384
  vCPUs:            4
  Memory:           16 GB
  Cost:             ~$240/month


STORAGE
═══════════════════════════════════════════════════════════════════════════════

Type:               SSD
Size:               50 GB (initial)
Auto-increase:      Enabled
Auto-increase limit: 500 GB
Cost:               ~$8.50/month (50GB)


HIGH AVAILABILITY
═══════════════════════════════════════════════════════════════════════════════

Configuration:      Regional (recommended)
                    - Primary in us-central1-a
                    - Standby in us-central1-b
                    - Automatic failover

Failover:           Automatic (~60 seconds)
Cost:               2x instance cost


CONNECTIONS
═══════════════════════════════════════════════════════════════════════════════

Private IP:         Enabled (10.10.0.3)
Public IP:          Disabled (security)
SSL:                Required

Max Connections:    100 (default for db-custom-2-8192)
                    Can increase via flag: max_connections=200


MAINTENANCE
═══════════════════════════════════════════════════════════════════════════════

Window:             Sunday 03:00-04:00 UTC
Updates:            Any (allow minor version updates)


BACKUPS
═══════════════════════════════════════════════════════════════════════════════

Automated:          Enabled
Time:               02:00-03:00 UTC
Retention:          7 days
Location:           Multi-region (us)

Point-in-time:      Enabled
Recovery Window:    7 days
```

### Terraform Configuration

```hcl
# cloud-sql.tf

resource "google_sql_database_instance" "main" {
  name             = "hodlfun-db"
  database_version = "POSTGRES_15"
  region           = "us-central1"
  
  deletion_protection = true
  
  settings {
    tier              = "db-custom-2-8192"
    availability_type = "REGIONAL"  # High Availability
    disk_type         = "PD_SSD"
    disk_size         = 50
    disk_autoresize   = true
    disk_autoresize_limit = 500
    
    ip_configuration {
      ipv4_enabled    = false  # No public IP
      private_network = google_compute_network.main.id
      require_ssl     = true
    }
    
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }
    
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 03:00 UTC
      update_track = "stable"
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
    
    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1 second
    }
    
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }
}

resource "google_sql_database" "main" {
  name     = "hodlfun"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "hodlfun_app"
  instance = google_sql_database_instance.main.name
  password = var.db_password  # From secret
}
```

---

## Database Schema

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA OVERVIEW                             │
└─────────────────────────────────────────────────────────────────────────────┘

CORE TABLES
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     tokens      │      │     trades      │      │     users       │
│─────────────────│      │─────────────────│      │─────────────────│
│ address (PK)    │◄─────│ token_address   │      │ wallet (PK)     │
│ name            │      │ trader_address  │─────►│ username        │
│ symbol          │      │ type            │      │ avatar_url      │
│ creator_address │─────►│ amount          │      │ created_at      │
│ image_url       │      │ price           │      └─────────────────┘
│ price           │      │ tx_hash         │
│ market_cap      │      │ block_number    │
│ status          │      │ created_at      │
└─────────────────┘      └─────────────────┘

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    holdings     │      │    comments     │      │     alerts      │
│─────────────────│      │─────────────────│      │─────────────────│
│ id (PK)         │      │ id (PK)         │      │ id (PK)         │
│ wallet_address  │      │ token_address   │      │ user_wallet     │
│ token_address   │      │ user_wallet     │      │ token_address   │
│ balance         │      │ content         │      │ condition       │
│ updated_at      │      │ created_at      │      │ target_price    │
└─────────────────┘      └─────────────────┘      │ is_active       │
                                                  └─────────────────┘

ANALYTICS TABLES
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────┐      ┌─────────────────┐
│    candles      │      │  token_stats    │
│─────────────────│      │─────────────────│
│ id (PK)         │      │ token_address   │
│ token_address   │      │ date            │
│ period          │      │ volume          │
│ timestamp       │      │ trades_count    │
│ open, high      │      │ unique_traders  │
│ low, close      │      │ high_price      │
│ volume          │      │ low_price       │
└─────────────────┘      └─────────────────┘
```

### Tables List

| Table | Purpose | Rows Estimate (1 year) |
|-------|---------|------------------------|
| `tokens` | All created tokens | 10,000 |
| `trades` | All buy/sell transactions | 10,000,000 |
| `users` | User profiles | 50,000 |
| `holdings` | Token balances per user | 500,000 |
| `comments` | Token comments | 100,000 |
| `alerts` | Price alerts | 20,000 |
| `candles` | OHLCV price data | 50,000,000 |
| `token_stats` | Daily token statistics | 3,650,000 |

---

## Table Definitions

### tokens

The main table storing all token information.

```sql
CREATE TABLE tokens (
    -- Primary Key: Contract address on Push Chain
    address         VARCHAR(66) PRIMARY KEY,
    
    -- Basic Info
    name            VARCHAR(100) NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    
    -- Creator
    creator_address VARCHAR(66) NOT NULL,
    
    -- Social Links
    website         VARCHAR(255),
    twitter         VARCHAR(255),
    telegram        VARCHAR(255),
    discord         VARCHAR(255),
    
    -- Token Economics
    total_supply    NUMERIC(78, 0) NOT NULL DEFAULT 1000000000000000000000000000,
    decimals        INTEGER NOT NULL DEFAULT 18,
    
    -- Current State (updated by indexer)
    price           NUMERIC(38, 18) NOT NULL DEFAULT 0,
    price_usd       NUMERIC(38, 18) NOT NULL DEFAULT 0,
    market_cap      NUMERIC(38, 18) NOT NULL DEFAULT 0,
    market_cap_usd  NUMERIC(38, 18) NOT NULL DEFAULT 0,
    volume_24h      NUMERIC(38, 18) NOT NULL DEFAULT 0,
    volume_24h_usd  NUMERIC(38, 18) NOT NULL DEFAULT 0,
    price_change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    
    -- Holder Stats
    holder_count    INTEGER NOT NULL DEFAULT 0,
    
    -- Bonding Curve
    bonding_curve_address VARCHAR(66),
    bonding_curve_progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
    virtual_eth_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    virtual_token_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    
    -- Status
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    -- 'active'    : Trading on bonding curve
    -- 'graduated' : Migrated to DEX
    -- 'failed'    : Creation failed
    
    -- DEX Info (after graduation)
    dex_pair_address VARCHAR(66),
    graduated_at    TIMESTAMP WITH TIME ZONE,
    
    -- Blockchain Info
    creation_tx_hash VARCHAR(66) NOT NULL,
    creation_block  BIGINT NOT NULL,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_trade_at   TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'graduated', 'failed')),
    CONSTRAINT valid_progress CHECK (bonding_curve_progress >= 0 AND bonding_curve_progress <= 100)
);

-- Indexes
CREATE INDEX idx_tokens_creator ON tokens(creator_address);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX idx_tokens_market_cap ON tokens(market_cap DESC) WHERE status = 'active';
CREATE INDEX idx_tokens_volume_24h ON tokens(volume_24h DESC) WHERE status = 'active';
CREATE INDEX idx_tokens_last_trade ON tokens(last_trade_at DESC NULLS LAST);
CREATE INDEX idx_tokens_search ON tokens USING gin(to_tsvector('english', name || ' ' || symbol));

-- Trigger for updated_at
CREATE TRIGGER tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### trades

Records every buy/sell transaction.

```sql
CREATE TABLE trades (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    trader_address  VARCHAR(66) NOT NULL,
    
    -- Trade Details
    type            VARCHAR(4) NOT NULL,  -- 'buy' or 'sell'
    
    -- Amounts (in token's smallest unit)
    token_amount    NUMERIC(78, 0) NOT NULL,
    eth_amount      NUMERIC(78, 0) NOT NULL,
    
    -- Price at time of trade
    price           NUMERIC(38, 18) NOT NULL,
    price_usd       NUMERIC(38, 18) NOT NULL,
    
    -- Value
    value_eth       NUMERIC(38, 18) NOT NULL,
    value_usd       NUMERIC(38, 18) NOT NULL,
    
    -- Post-trade state
    new_price       NUMERIC(38, 18) NOT NULL,
    new_market_cap  NUMERIC(38, 18) NOT NULL,
    
    -- Blockchain Info
    tx_hash         VARCHAR(66) NOT NULL UNIQUE,
    block_number    BIGINT NOT NULL,
    log_index       INTEGER NOT NULL,
    
    -- Timestamp
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_type CHECK (type IN ('buy', 'sell')),
    CONSTRAINT positive_amounts CHECK (token_amount > 0 AND eth_amount > 0)
);

-- Indexes
CREATE INDEX idx_trades_token ON trades(token_address, created_at DESC);
CREATE INDEX idx_trades_trader ON trades(trader_address, created_at DESC);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_block ON trades(block_number, log_index);
CREATE INDEX idx_trades_token_time ON trades(token_address, created_at) 
    INCLUDE (price, token_amount, eth_amount);  -- Covering index for candle aggregation

-- Partitioning for large tables (optional, for scale)
-- Can partition by created_at monthly
```

### users

User profiles (created on first interaction).

```sql
CREATE TABLE users (
    -- Primary Key: Wallet address
    wallet_address  VARCHAR(66) PRIMARY KEY,
    
    -- Profile
    username        VARCHAR(50) UNIQUE,
    display_name    VARCHAR(100),
    bio             TEXT,
    avatar_url      VARCHAR(500),
    
    -- Social Links
    twitter         VARCHAR(255),
    website         VARCHAR(255),
    
    -- Stats (denormalized for performance)
    tokens_created  INTEGER NOT NULL DEFAULT 0,
    total_trades    INTEGER NOT NULL DEFAULT 0,
    total_volume    NUMERIC(38, 18) NOT NULL DEFAULT 0,
    
    -- Settings
    notification_preferences JSONB DEFAULT '{"email": false, "push": false}'::jsonb,
    
    -- Auth
    nonce           VARCHAR(100),  -- For wallet signature auth
    nonce_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_]{3,50}$')
);

-- Indexes
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### holdings

Token balances for each user.

```sql
CREATE TABLE holdings (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Composite unique constraint
    wallet_address  VARCHAR(66) NOT NULL,
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    
    -- Balance (in smallest unit)
    balance         NUMERIC(78, 0) NOT NULL DEFAULT 0,
    
    -- Cost basis for P&L calculation (optional)
    avg_buy_price   NUMERIC(38, 18),
    total_invested  NUMERIC(38, 18) NOT NULL DEFAULT 0,
    
    -- Stats
    first_buy_at    TIMESTAMP WITH TIME ZONE,
    last_trade_at   TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_holding UNIQUE (wallet_address, token_address),
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Indexes
CREATE INDEX idx_holdings_wallet ON holdings(wallet_address);
CREATE INDEX idx_holdings_token ON holdings(token_address);
CREATE INDEX idx_holdings_token_balance ON holdings(token_address, balance DESC) 
    WHERE balance > 0;  -- For top holders query
CREATE INDEX idx_holdings_wallet_value ON holdings(wallet_address) 
    INCLUDE (token_address, balance);  -- For portfolio query

-- Trigger for updated_at
CREATE TRIGGER holdings_updated_at
    BEFORE UPDATE ON holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### comments

Token discussion comments.

```sql
CREATE TABLE comments (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    user_wallet     VARCHAR(66) NOT NULL,
    
    -- Content
    content         TEXT NOT NULL,
    
    -- Reply (for threading)
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Moderation
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_reason   VARCHAR(100),
    
    -- Stats
    likes_count     INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT content_length CHECK (char_length(content) BETWEEN 1 AND 1000)
);

-- Indexes
CREATE INDEX idx_comments_token ON comments(token_address, created_at DESC) 
    WHERE NOT is_hidden;
CREATE INDEX idx_comments_user ON comments(user_wallet, created_at DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### alerts

Price alerts set by users.

```sql
CREATE TABLE alerts (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    user_wallet     VARCHAR(66) NOT NULL,
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    
    -- Alert Condition
    condition       VARCHAR(20) NOT NULL,  -- 'above', 'below', 'percent_up', 'percent_down'
    target_price    NUMERIC(38, 18),       -- For 'above', 'below'
    percent_change  NUMERIC(10, 4),        -- For 'percent_up', 'percent_down'
    base_price      NUMERIC(38, 18),       -- Price when alert was created
    
    -- Notification
    notification_type VARCHAR(20) NOT NULL DEFAULT 'push',  -- 'push', 'email', 'both'
    
    -- Status
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_triggered    BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_at    TIMESTAMP WITH TIME ZONE,
    triggered_price NUMERIC(38, 18),
    
    -- Timestamps
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE,  -- Optional expiration
    
    -- Constraints
    CONSTRAINT valid_condition CHECK (
        condition IN ('above', 'below', 'percent_up', 'percent_down')
    ),
    CONSTRAINT valid_target CHECK (
        (condition IN ('above', 'below') AND target_price IS NOT NULL) OR
        (condition IN ('percent_up', 'percent_down') AND percent_change IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_alerts_user ON alerts(user_wallet) WHERE is_active;
CREATE INDEX idx_alerts_token ON alerts(token_address) WHERE is_active;
CREATE INDEX idx_alerts_active ON alerts(token_address, condition, target_price) 
    WHERE is_active AND NOT is_triggered;
```

### candles

OHLCV price data for charts.

```sql
CREATE TABLE candles (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    
    -- Time Period
    period          VARCHAR(5) NOT NULL,  -- '1m', '5m', '15m', '1h', '4h', '1d'
    timestamp       TIMESTAMP WITH TIME ZONE NOT NULL,  -- Period start time
    
    -- OHLCV Data
    open            NUMERIC(38, 18) NOT NULL,
    high            NUMERIC(38, 18) NOT NULL,
    low             NUMERIC(38, 18) NOT NULL,
    close           NUMERIC(38, 18) NOT NULL,
    volume          NUMERIC(38, 18) NOT NULL DEFAULT 0,
    
    -- Trade Count
    trades_count    INTEGER NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT unique_candle UNIQUE (token_address, period, timestamp),
    CONSTRAINT valid_period CHECK (period IN ('1m', '5m', '15m', '1h', '4h', '1d')),
    CONSTRAINT valid_ohlc CHECK (high >= low AND high >= open AND high >= close AND low <= open AND low <= close)
);

-- Indexes
CREATE INDEX idx_candles_token_period ON candles(token_address, period, timestamp DESC);
CREATE INDEX idx_candles_timestamp ON candles(timestamp DESC);

-- Partitioning by month (for scale)
-- CREATE TABLE candles_2024_01 PARTITION OF candles FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### token_stats

Daily aggregated statistics.

```sql
CREATE TABLE token_stats (
    -- Primary Key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    token_address   VARCHAR(66) NOT NULL REFERENCES tokens(address),
    
    -- Date
    date            DATE NOT NULL,
    
    -- Volume Stats
    volume_eth      NUMERIC(38, 18) NOT NULL DEFAULT 0,
    volume_usd      NUMERIC(38, 18) NOT NULL DEFAULT 0,
    buy_volume      NUMERIC(38, 18) NOT NULL DEFAULT 0,
    sell_volume     NUMERIC(38, 18) NOT NULL DEFAULT 0,
    
    -- Trade Stats
    trades_count    INTEGER NOT NULL DEFAULT 0,
    buy_count       INTEGER NOT NULL DEFAULT 0,
    sell_count      INTEGER NOT NULL DEFAULT 0,
    
    -- User Stats
    unique_traders  INTEGER NOT NULL DEFAULT 0,
    unique_buyers   INTEGER NOT NULL DEFAULT 0,
    unique_sellers  INTEGER NOT NULL DEFAULT 0,
    
    -- Price Stats
    open_price      NUMERIC(38, 18),
    high_price      NUMERIC(38, 18),
    low_price       NUMERIC(38, 18),
    close_price     NUMERIC(38, 18),
    
    -- Holder Stats
    holder_count_start INTEGER,
    holder_count_end   INTEGER,
    new_holders     INTEGER NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT unique_token_date UNIQUE (token_address, date)
);

-- Indexes
CREATE INDEX idx_token_stats_token ON token_stats(token_address, date DESC);
CREATE INDEX idx_token_stats_date ON token_stats(date DESC);
```

### Helper Functions

```sql
-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate token market cap
CREATE OR REPLACE FUNCTION calculate_market_cap(
    p_price NUMERIC,
    p_total_supply NUMERIC,
    p_decimals INTEGER
) RETURNS NUMERIC AS $$
BEGIN
    RETURN p_price * (p_total_supply / POWER(10, p_decimals));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get candle timestamp for period
CREATE OR REPLACE FUNCTION get_candle_timestamp(
    p_timestamp TIMESTAMP WITH TIME ZONE,
    p_period VARCHAR
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN CASE p_period
        WHEN '1m' THEN date_trunc('minute', p_timestamp)
        WHEN '5m' THEN date_trunc('hour', p_timestamp) + 
                      INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM p_timestamp) / 5)
        WHEN '15m' THEN date_trunc('hour', p_timestamp) + 
                       INTERVAL '15 min' * FLOOR(EXTRACT(MINUTE FROM p_timestamp) / 15)
        WHEN '1h' THEN date_trunc('hour', p_timestamp)
        WHEN '4h' THEN date_trunc('day', p_timestamp) + 
                      INTERVAL '4 hour' * FLOOR(EXTRACT(HOUR FROM p_timestamp) / 4)
        WHEN '1d' THEN date_trunc('day', p_timestamp)
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

## Indexes & Performance

### Index Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INDEX STRATEGY                                       │
└─────────────────────────────────────────────────────────────────────────────┘

PRINCIPLE: Create indexes based on query patterns, not table structure

Query Pattern                           Index
─────────────────────────────────────────────────────────────────────────────
List tokens by market cap               idx_tokens_market_cap (partial)
List tokens by creation date            idx_tokens_created_at
Search tokens by name/symbol            idx_tokens_search (GIN, full-text)
Get token trades                        idx_trades_token
Get user trades                         idx_trades_trader
Aggregate candles                       idx_trades_token_time (covering)
Get top holders                         idx_holdings_token_balance (partial)
Get user portfolio                      idx_holdings_wallet_value (covering)
Check active alerts                     idx_alerts_active (partial)
```

### Partial Indexes

Only index rows that matter:

```sql
-- Only active tokens for listing queries
CREATE INDEX idx_tokens_market_cap ON tokens(market_cap DESC) 
    WHERE status = 'active';

-- Only non-zero balances for holder queries
CREATE INDEX idx_holdings_token_balance ON holdings(token_address, balance DESC) 
    WHERE balance > 0;

-- Only active alerts
CREATE INDEX idx_alerts_active ON alerts(token_address, condition, target_price) 
    WHERE is_active AND NOT is_triggered;
```

### Covering Indexes

Include columns to avoid table lookup:

```sql
-- For candle aggregation: don't need to hit table
CREATE INDEX idx_trades_token_time ON trades(token_address, created_at) 
    INCLUDE (price, token_amount, eth_amount);

-- For portfolio query: include balance
CREATE INDEX idx_holdings_wallet_value ON holdings(wallet_address) 
    INCLUDE (token_address, balance);
```

### Query Performance Guidelines

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE GUIDELINES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. PAGINATION
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad:  SELECT * FROM trades LIMIT 20 OFFSET 10000
   ✅ Good: SELECT * FROM trades WHERE created_at < $cursor LIMIT 20

   Use cursor-based pagination for large tables.


2. COUNTING
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad:  SELECT COUNT(*) FROM trades WHERE token_address = $1
   ✅ Good: Use cached count in tokens.trades_count

   Maintain denormalized counts for frequently accessed stats.


3. AGGREGATIONS
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad:  Calculate 24h volume on every request
   ✅ Good: Pre-aggregate in token_stats table

   Worker job updates stats periodically.


4. JOIN OPTIMIZATION
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad:  SELECT * FROM trades t JOIN tokens tok ON ...
   ✅ Good: Include needed columns in trades table (denormalize)

   Denormalize frequently joined data.


5. BATCH OPERATIONS
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad:  INSERT INTO candles ... (one at a time)
   ✅ Good: INSERT INTO candles ... VALUES (...), (...), (...)

   Batch inserts for bulk operations.
```

---

## Relationships & ERD

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY RELATIONSHIP DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │     users       │
                              │─────────────────│
                              │ wallet_address  │ PK
                              │ username        │
                              │ display_name    │
                              │ avatar_url      │
                              └────────┬────────┘
                                       │
                                       │ 1:N (creator)
                                       │
┌─────────────────┐           ┌────────┴────────┐           ┌─────────────────┐
│    candles      │           │     tokens      │           │   token_stats   │
│─────────────────│           │─────────────────│           │─────────────────│
│ id              │ PK        │ address         │ PK        │ id              │ PK
│ token_address   │ FK ──────►│ name            │◄───────── │ token_address   │ FK
│ period          │           │ symbol          │     FK    │ date            │
│ timestamp       │           │ creator_address │ FK        │ volume          │
│ open,high,low   │           │ price           │           │ trades_count    │
│ close,volume    │           │ market_cap      │           └─────────────────┘
└─────────────────┘           │ status          │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        │ 1:N                          │ 1:N                          │ 1:N
        ▼                              ▼                              ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│    trades       │           │   holdings      │           │    comments     │
│─────────────────│           │─────────────────│           │─────────────────│
│ id              │ PK        │ id              │ PK        │ id              │ PK
│ token_address   │ FK        │ wallet_address  │           │ token_address   │ FK
│ trader_address  │           │ token_address   │ FK        │ user_wallet     │
│ type            │           │ balance         │           │ content         │
│ token_amount    │           │ avg_buy_price   │           │ parent_id       │ FK (self)
│ eth_amount      │           └─────────────────┘           └─────────────────┘
│ price           │
│ tx_hash         │
└─────────────────┘
        ▲
        │
        │ 1:N (trader)
        │
┌───────┴─────────┐           ┌─────────────────┐
│     users       │           │     alerts      │
│  (as trader)    │           │─────────────────│
└─────────────────┘           │ id              │ PK
                              │ user_wallet     │
                              │ token_address   │ FK
                              │ condition       │
                              │ target_price    │
                              │ is_active       │
                              └─────────────────┘


RELATIONSHIP SUMMARY
═══════════════════════════════════════════════════════════════════════════════

tokens 1 ──── N trades       (One token has many trades)
tokens 1 ──── N holdings     (One token held by many users)
tokens 1 ──── N comments     (One token has many comments)
tokens 1 ──── N candles      (One token has many candles)
tokens 1 ──── N alerts       (One token has many alerts)
tokens 1 ──── N token_stats  (One token has many daily stats)
users  1 ──── N tokens       (One user creates many tokens)
users  1 ──── N trades       (One user makes many trades)
users  1 ──── N holdings     (One user holds many tokens)
users  1 ──── N comments     (One user posts many comments)
users  1 ──── N alerts       (One user creates many alerts)
comments 1 ── N comments     (Self-referencing for replies)
```

---

## Connecting from GKE

### Connection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GKE TO CLOUD SQL CONNECTION                               │
└─────────────────────────────────────────────────────────────────────────────┘

OPTION 1: PRIVATE IP (Recommended)
═══════════════════════════════════════════════════════════════════════════════

┌───────────────────────────────────────┐
│           GKE CLUSTER                 │
│                                       │
│   ┌─────────────┐  ┌─────────────┐   │
│   │   API Pod   │  │ Indexer Pod │   │
│   │             │  │             │   │
│   │  pg client  │  │  pg client  │   │
│   └──────┬──────┘  └──────┬──────┘   │
│          │                │          │
│          └────────┬───────┘          │
│                   │                  │
└───────────────────┼──────────────────┘
                    │
                    │ Private IP: 10.10.0.3:5432
                    │ (VPC Internal)
                    │
┌───────────────────┼──────────────────┐
│                   ▼                  │
│   ┌─────────────────────────────┐    │
│   │         Cloud SQL           │    │
│   │        PostgreSQL           │    │
│   │                             │    │
│   │  Private IP: 10.10.0.3      │    │
│   │  No public IP               │    │
│   └─────────────────────────────┘    │
│                                      │
│           CLOUD SQL                  │
└──────────────────────────────────────┘

Pros:
- Direct connection, lowest latency
- No proxy overhead
- Simple configuration

Cons:
- Requires VPC peering setup
- Must be in same VPC


OPTION 2: CLOUD SQL PROXY (Alternative)
═══════════════════════════════════════════════════════════════════════════════

┌───────────────────────────────────────┐
│           GKE CLUSTER                 │
│                                       │
│   ┌─────────────┐  ┌─────────────┐   │
│   │   API Pod   │  │ Indexer Pod │   │
│   │             │  │             │   │
│   │  pg client  │  │  pg client  │   │
│   │      │      │  │      │      │   │
│   │      ▼      │  │      ▼      │   │
│   │ ┌─────────┐ │  │ ┌─────────┐ │   │
│   │ │  Proxy  │ │  │ │  Proxy  │ │   │
│   │ │ Sidecar │ │  │ │ Sidecar │ │   │
│   │ └────┬────┘ │  │ └────┬────┘ │   │
│   └──────┼──────┘  └──────┼──────┘   │
│          │                │          │
└──────────┼────────────────┼──────────┘
           │                │
           └────────┬───────┘
                    │
                    │ Secure tunnel
                    │ (IAM authenticated)
                    ▼
┌──────────────────────────────────────┐
│   ┌─────────────────────────────┐    │
│   │         Cloud SQL           │    │
│   └─────────────────────────────┘    │
└──────────────────────────────────────┘

Pros:
- No VPC peering needed
- IAM-based auth
- Works from anywhere

Cons:
- Sidecar adds complexity
- Slight latency overhead
```

### NestJS Database Configuration

```typescript
// src/config/database.config.ts

import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  
  // Connection
  host: process.env.DB_HOST,           // 10.10.0.3 (Private IP)
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,       // hodlfun
  username: process.env.DB_USER,       // hodlfun_app
  password: process.env.DB_PASSWORD,   // From secret
  
  // SSL
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false,  // For Cloud SQL
  } : false,
  
  // Connection Pool
  extra: {
    // Pool size
    max: 20,                    // Maximum connections per pod
    min: 5,                     // Minimum connections
    
    // Timeouts
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000,  // Fail if can't connect in 10s
    
    // Keep-alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  },
  
  // TypeORM
  entities: ['dist/**/*.entity{.ts,.js}'],
  synchronize: false,          // Never in production!
  migrationsRun: true,         // Run migrations on startup
  migrations: ['dist/migrations/*{.ts,.js}'],
  
  // Logging
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error', 'warn'],
  logger: 'advanced-console',
  
  // Retries
  retryAttempts: 3,
  retryDelay: 1000,
});
```

### Connection Pool Sizing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONNECTION POOL SIZING                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Cloud SQL Instance: db-custom-2-8192
Max Connections: 200 (configured)

Reserve for:
  - Cloud SQL overhead: 10
  - Admin connections: 5
  - Available for app: 185

Pod Distribution:
─────────────────────────────────────────────────────────────────────────────
  API pods:      3 pods × 20 connections = 60
  Indexer pods:  2 pods × 10 connections = 20
  Worker pods:   3 pods × 15 connections = 45
  ─────────────────────────────────────────
  Total:                                 = 125 connections (under 185)

Scaling Consideration:
─────────────────────────────────────────────────────────────────────────────
  If API scales to 10 pods:
  API pods:     10 pods × 20 connections = 200  ❌ Exceeds limit!
  
  Solution:
  1. Use PgBouncer for connection pooling
  2. Reduce per-pod connections to 10
  3. Upgrade instance (more max_connections)
```

---

## Connection Pooling

### Why Connection Pooling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY USE CONNECTION POOLING                                │
└─────────────────────────────────────────────────────────────────────────────┘

WITHOUT POOLING:
─────────────────────────────────────────────────────────────────────────────
Request 1 → Open connection → Query → Close connection
Request 2 → Open connection → Query → Close connection
Request 3 → Open connection → Query → Close connection

Problem: Opening connection takes ~50-100ms each time!


WITH POOLING:
─────────────────────────────────────────────────────────────────────────────
Startup → Open 5 connections (pool)

Request 1 → Get connection from pool → Query → Return to pool
Request 2 → Get connection from pool → Query → Return to pool
Request 3 → Get connection from pool → Query → Return to pool

Benefit: Reuse connections, near-zero latency to get connection
```

### PgBouncer Setup (For Scale)

When you need more pods than Cloud SQL connections allow:

```yaml
# pgbouncer-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pgbouncer
  template:
    metadata:
      labels:
        app: pgbouncer
    spec:
      containers:
        - name: pgbouncer
          image: edoburu/pgbouncer:1.21.0
          ports:
            - containerPort: 5432
          env:
            - name: DATABASE_URL
              value: "postgres://hodlfun_app:$(DB_PASSWORD)@10.10.0.3:5432/hodlfun"
            - name: POOL_MODE
              value: "transaction"  # Best for web apps
            - name: MAX_CLIENT_CONN
              value: "1000"         # Pods connect here
            - name: DEFAULT_POOL_SIZE
              value: "50"           # Connections to Cloud SQL
            - name: MIN_POOL_SIZE
              value: "10"
            - name: RESERVE_POOL_SIZE
              value: "5"
          envFrom:
            - secretRef:
                name: hodlfun-secrets
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: pgbouncer
spec:
  selector:
    app: pgbouncer
  ports:
    - port: 5432
      targetPort: 5432
```

### Connection Flow with PgBouncer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONNECTION FLOW WITH PGBOUNCER                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                           GKE CLUSTER                                     │
│                                                                           │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│   │ API Pod │ │ API Pod │ │ API Pod │ │ Worker  │ │ Indexer │            │
│   │   (20)  │ │   (20)  │ │   (20)  │ │   (15)  │ │   (10)  │            │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│        │           │           │           │           │                  │
│        └───────────┴───────────┴───────────┴───────────┘                  │
│                                │                                          │
│                                │ 85 connections to PgBouncer              │
│                                │ (can handle 1000)                        │
│                                ▼                                          │
│                     ┌─────────────────────┐                               │
│                     │     PgBouncer       │                               │
│                     │                     │                               │
│                     │  Pool Mode:         │                               │
│                     │  transaction        │                               │
│                     │                     │                               │
│                     │  Max Client: 1000   │                               │
│                     │  Pool Size: 50      │                               │
│                     └──────────┬──────────┘                               │
│                                │                                          │
└────────────────────────────────┼──────────────────────────────────────────┘
                                 │
                                 │ 50 connections to Cloud SQL
                                 │
                                 ▼
                     ┌─────────────────────┐
                     │     Cloud SQL       │
                     │                     │
                     │  Max Connections:   │
                     │  200                │
                     │                     │
                     │  Used: ~55          │
                     │  (50 pool + admin)  │
                     └─────────────────────┘


Benefit: Scale to 50 pods while only using 50 DB connections!
```

---

## Migrations

### Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIGRATION STRATEGY                                        │
└─────────────────────────────────────────────────────────────────────────────┘

PRINCIPLE: Database changes should be:
- Version controlled (in git)
- Reversible (up/down migrations)
- Tested before production
- Applied automatically on deploy


WORKFLOW:
─────────────────────────────────────────────────────────────────────────────

1. Developer creates migration
   $ npm run migration:generate -- -n AddTwitterToTokens
   
2. Migration file created
   src/migrations/1706123456789-AddTwitterToTokens.ts
   
3. Code review with PR
   - Review SQL
   - Check for breaking changes
   - Ensure down migration works
   
4. Merge to main
   
5. CI/CD runs migration
   - Staging: Apply and test
   - Production: Apply during deployment
```

### TypeORM Migration Example

```typescript
// src/migrations/1706123456789-AddTwitterToTokens.ts

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwitterToTokens1706123456789 implements MigrationInterface {
    name = 'AddTwitterToTokens1706123456789';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add column
        await queryRunner.query(`
            ALTER TABLE tokens 
            ADD COLUMN twitter VARCHAR(255)
        `);
        
        // Add index if needed
        await queryRunner.query(`
            CREATE INDEX idx_tokens_twitter 
            ON tokens(twitter) 
            WHERE twitter IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove index
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_tokens_twitter
        `);
        
        // Remove column
        await queryRunner.query(`
            ALTER TABLE tokens 
            DROP COLUMN twitter
        `);
    }
}
```

### Migration Commands

```bash
# Generate migration from entity changes
npm run migration:generate -- -n MigrationName

# Create empty migration
npm run migration:create -- -n MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

### package.json Scripts

```json
{
  "scripts": {
    "migration:generate": "typeorm migration:generate -d src/config/data-source.ts",
    "migration:create": "typeorm migration:create",
    "migration:run": "typeorm migration:run -d src/config/data-source.ts",
    "migration:revert": "typeorm migration:revert -d src/config/data-source.ts",
    "migration:show": "typeorm migration:show -d src/config/data-source.ts"
  }
}
```

### Safe Migration Practices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SAFE MIGRATION PRACTICES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. ADDING COLUMNS
─────────────────────────────────────────────────────────────────────────────
   ✅ Safe: Add nullable column
   ✅ Safe: Add column with default value
   ❌ Unsafe: Add NOT NULL without default (locks table)
   
   -- Safe
   ALTER TABLE tokens ADD COLUMN twitter VARCHAR(255);
   
   -- Unsafe (table lock)
   ALTER TABLE tokens ADD COLUMN twitter VARCHAR(255) NOT NULL;


2. REMOVING COLUMNS
─────────────────────────────────────────────────────────────────────────────
   Step 1: Remove code that uses column (deploy)
   Step 2: Wait for all pods to update
   Step 3: Remove column (next migration)
   
   -- Don't drop in same deploy as code change!


3. RENAMING COLUMNS
─────────────────────────────────────────────────────────────────────────────
   Step 1: Add new column
   Step 2: Backfill data
   Step 3: Update code to use new column (deploy)
   Step 4: Remove old column (later migration)


4. ADDING INDEXES
─────────────────────────────────────────────────────────────────────────────
   ✅ Safe: CREATE INDEX CONCURRENTLY
   ❌ Unsafe: CREATE INDEX (locks table)
   
   -- Safe (no lock)
   CREATE INDEX CONCURRENTLY idx_trades_created ON trades(created_at);
   
   -- Note: Can't run in transaction, so:
   -- TypeORM: queryRunner.connection.query() outside transaction


5. LARGE DATA MIGRATIONS
─────────────────────────────────────────────────────────────────────────────
   ❌ Bad: UPDATE tokens SET new_col = old_col;  -- Locks entire table
   
   ✅ Good: Batch updates
   DO $$
   DECLARE
       batch_size INT := 1000;
   BEGIN
       LOOP
           UPDATE tokens 
           SET new_col = old_col
           WHERE id IN (
               SELECT id FROM tokens 
               WHERE new_col IS NULL 
               LIMIT batch_size
           );
           
           EXIT WHEN NOT FOUND;
           COMMIT;
       END LOOP;
   END $$;
```

---

## Queries & Patterns

### Common Query Patterns

#### List Tokens (Paginated)

```typescript
// tokens.repository.ts

async findAll(options: {
  page: number;
  limit: number;
  sort: 'market_cap' | 'created_at' | 'volume_24h';
  order: 'ASC' | 'DESC';
  status?: string;
  search?: string;
}): Promise<{ data: Token[]; total: number }> {
  const queryBuilder = this.createQueryBuilder('token')
    .where('token.status = :status', { status: options.status || 'active' });
  
  // Search
  if (options.search) {
    queryBuilder.andWhere(
      `to_tsvector('english', token.name || ' ' || token.symbol) @@ plainto_tsquery(:search)`,
      { search: options.search }
    );
  }
  
  // Sort
  queryBuilder.orderBy(`token.${options.sort}`, options.order);
  
  // Pagination (cursor-based would be better for large offsets)
  queryBuilder
    .skip((options.page - 1) * options.limit)
    .take(options.limit);
  
  const [data, total] = await queryBuilder.getManyAndCount();
  
  return { data, total };
}
```

**Generated SQL:**
```sql
SELECT token.* 
FROM tokens token
WHERE token.status = 'active'
  AND to_tsvector('english', token.name || ' ' || token.symbol) @@ plainto_tsquery('moon')
ORDER BY token.market_cap DESC
LIMIT 20 OFFSET 0;

SELECT COUNT(*) FROM tokens token WHERE token.status = 'active' ...;
```

#### Get Token with Recent Trades

```typescript
async findOneWithTrades(address: string): Promise<Token & { recentTrades: Trade[] }> {
  const token = await this.createQueryBuilder('token')
    .where('token.address = :address', { address })
    .getOne();
  
  if (!token) return null;
  
  // Separate query for trades (more efficient than join for large tables)
  const recentTrades = await this.tradesRepository
    .createQueryBuilder('trade')
    .where('trade.token_address = :address', { address })
    .orderBy('trade.created_at', 'DESC')
    .take(50)
    .getMany();
  
  return { ...token, recentTrades };
}
```

#### Get Top Holders

```typescript
async getTopHolders(tokenAddress: string, limit = 10): Promise<Holding[]> {
  return this.holdingsRepository
    .createQueryBuilder('holding')
    .select([
      'holding.wallet_address',
      'holding.balance',
      // Calculate percentage
      'holding.balance * 100.0 / token.total_supply as percentage'
    ])
    .innerJoin('tokens', 'token', 'token.address = holding.token_address')
    .where('holding.token_address = :tokenAddress', { tokenAddress })
    .andWhere('holding.balance > 0')
    .orderBy('holding.balance', 'DESC')
    .limit(limit)
    .getRawMany();
}
```

**Generated SQL:**
```sql
SELECT 
  holding.wallet_address,
  holding.balance,
  holding.balance * 100.0 / token.total_supply as percentage
FROM holdings holding
INNER JOIN tokens token ON token.address = holding.token_address
WHERE holding.token_address = '0x123...'
  AND holding.balance > 0
ORDER BY holding.balance DESC
LIMIT 10;
```

#### Aggregate Candles

```typescript
async aggregateCandle(
  tokenAddress: string, 
  period: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Candle> {
  const result = await this.tradesRepository
    .createQueryBuilder('trade')
    .select([
      'MIN(trade.price) as low',
      'MAX(trade.price) as high',
      'SUM(trade.value_eth) as volume',
      'COUNT(*) as trades_count'
    ])
    // First and last values
    .addSelect(
      `(SELECT price FROM trades 
        WHERE token_address = :tokenAddress 
        AND created_at >= :periodStart AND created_at < :periodEnd 
        ORDER BY created_at ASC LIMIT 1)`,
      'open'
    )
    .addSelect(
      `(SELECT price FROM trades 
        WHERE token_address = :tokenAddress 
        AND created_at >= :periodStart AND created_at < :periodEnd 
        ORDER BY created_at DESC LIMIT 1)`,
      'close'
    )
    .where('trade.token_address = :tokenAddress', { tokenAddress })
    .andWhere('trade.created_at >= :periodStart', { periodStart })
    .andWhere('trade.created_at < :periodEnd', { periodEnd })
    .setParameters({ tokenAddress, periodStart, periodEnd })
    .getRawOne();
  
  return {
    token_address: tokenAddress,
    period,
    timestamp: periodStart,
    ...result
  };
}
```

#### Check Active Alerts

```typescript
async checkAlerts(tokenAddress: string, currentPrice: number): Promise<Alert[]> {
  return this.alertsRepository
    .createQueryBuilder('alert')
    .where('alert.token_address = :tokenAddress', { tokenAddress })
    .andWhere('alert.is_active = true')
    .andWhere('alert.is_triggered = false')
    .andWhere(
      new Brackets(qb => {
        qb.where(
          `alert.condition = 'above' AND alert.target_price <= :currentPrice`,
          { currentPrice }
        )
        .orWhere(
          `alert.condition = 'below' AND alert.target_price >= :currentPrice`,
          { currentPrice }
        )
        .orWhere(
          `alert.condition = 'percent_up' AND 
           (((:currentPrice - alert.base_price) / alert.base_price) * 100) >= alert.percent_change`,
          { currentPrice }
        )
        .orWhere(
          `alert.condition = 'percent_down' AND 
           (((alert.base_price - :currentPrice) / alert.base_price) * 100) >= alert.percent_change`,
          { currentPrice }
        );
      })
    )
    .getMany();
}
```

---

## Backup & Recovery

### Backup Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKUP CONFIGURATION                                      │
└─────────────────────────────────────────────────────────────────────────────┘

AUTOMATED BACKUPS
═══════════════════════════════════════════════════════════════════════════════

Schedule:           Daily at 02:00-03:00 UTC
Retention:          7 days
Location:           Multi-region (us)
Type:               Full backup


POINT-IN-TIME RECOVERY (PITR)
═══════════════════════════════════════════════════════════════════════════════

Enabled:            Yes
Binary Logging:     Automatic
Recovery Window:    7 days
Granularity:        Any point in time

Use Case:           "Restore to 3 hours ago when bad data was inserted"


ON-DEMAND BACKUPS
═══════════════════════════════════════════════════════════════════════════════

When:               Before major deployments
                    Before migrations
                    Before data cleanup jobs

Command:
  gcloud sql backups create --instance=hodlfun-db --description="Pre-migration backup"
```

### Recovery Procedures

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOVERY PROCEDURES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Restore from Backup
═══════════════════════════════════════════════════════════════════════════════

# List available backups
gcloud sql backups list --instance=hodlfun-db

# Restore to new instance (recommended)
gcloud sql backups restore BACKUP_ID \
  --restore-instance=hodlfun-db-restored \
  --backup-instance=hodlfun-db

# After verification, switch traffic to new instance
# Update DNS/config to point to new instance


SCENARIO 2: Point-in-Time Recovery
═══════════════════════════════════════════════════════════════════════════════

# Find the time before the incident
# Example: Bad data inserted at 2024-01-25 15:30:00 UTC

# Clone to specific point in time
gcloud sql instances clone hodlfun-db hodlfun-db-pitr \
  --point-in-time="2024-01-25T15:25:00Z"

# Verify data
# Switch traffic to restored instance


SCENARIO 3: Recover Deleted Data
═══════════════════════════════════════════════════════════════════════════════

1. Create PITR clone to before deletion
2. Export needed data from clone
3. Import data back to production
4. Delete clone

# Export specific table
pg_dump -h clone-ip -U hodlfun_app -d hodlfun -t tokens --data-only > tokens_backup.sql

# Import to production
psql -h prod-ip -U hodlfun_app -d hodlfun < tokens_backup.sql
```

### Backup Monitoring

```sql
-- Check last backup time (run via Cloud SQL Admin API or Console)
-- Alerts should trigger if backup is > 25 hours old

-- Application-level: Log important deletions
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    action VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    user_id VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for tokens table
CREATE OR REPLACE FUNCTION audit_tokens_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data)
        VALUES ('tokens', OLD.address, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
        VALUES ('tokens', NEW.address, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tokens_audit
    AFTER UPDATE OR DELETE ON tokens
    FOR EACH ROW EXECUTE FUNCTION audit_tokens_changes();
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE MONITORING                                       │
└─────────────────────────────────────────────────────────────────────────────┘

CLOUD SQL METRICS (Automatic)
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold
─────────────────────────────────────────────────────────────────────────────
CPU Utilization                 > 80% for 5 minutes
Memory Utilization              > 90% for 5 minutes
Disk Utilization                > 80%
Connections                     > 180 (of 200)
Read/Write IOPS                 Monitor for spikes
Replication Lag (HA)            > 5 seconds


QUERY INSIGHTS (Enable in Cloud SQL)
═══════════════════════════════════════════════════════════════════════════════

- Slow queries (> 1 second)
- Most frequent queries
- Queries by CPU time
- Wait events


APPLICATION METRICS
═══════════════════════════════════════════════════════════════════════════════

Metric                          Alert Threshold
─────────────────────────────────────────────────────────────────────────────
Query latency (p99)             > 500ms
Connection pool wait time       > 100ms
Connection pool exhaustion      Any occurrence
Query errors                    > 1% of queries
```

### Maintenance Tasks

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- REGULAR MAINTENANCE TASKS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ANALYZE: Update statistics (Cloud SQL does this automatically, but manual for large imports)
ANALYZE tokens;
ANALYZE trades;
ANALYZE holdings;

-- 2. Check for bloat
SELECT 
    schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- 3. Check for unused indexes
SELECT 
    schemaname, tablename, indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- 4. Check for missing indexes (slow queries)
-- Use Query Insights in Cloud SQL Console

-- 5. Archive old data (run via Worker job)
-- Move trades older than 90 days to archive table
INSERT INTO trades_archive
SELECT * FROM trades 
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM trades 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 6. Vacuum (usually automatic, but after large deletes)
VACUUM ANALYZE trades;
```

### Alerting Setup

```yaml
# Cloud Monitoring Alert Policies

# High CPU
- displayName: "Cloud SQL High CPU"
  conditions:
    - displayName: "CPU > 80%"
      conditionThreshold:
        filter: >
          resource.type="cloudsql_database" AND
          metric.type="cloudsql.googleapis.com/database/cpu/utilization"
        comparison: COMPARISON_GT
        thresholdValue: 0.8
        duration: "300s"
  notificationChannels: ["slack", "pagerduty"]

# High Connections
- displayName: "Cloud SQL High Connections"
  conditions:
    - displayName: "Connections > 90%"
      conditionThreshold:
        filter: >
          resource.type="cloudsql_database" AND
          metric.type="cloudsql.googleapis.com/database/postgresql/num_backends"
        comparison: COMPARISON_GT
        thresholdValue: 180
        duration: "60s"
  notificationChannels: ["slack", "pagerduty"]

# Disk Space
- displayName: "Cloud SQL Disk Usage"
  conditions:
    - displayName: "Disk > 80%"
      conditionThreshold:
        filter: >
          resource.type="cloudsql_database" AND
          metric.type="cloudsql.googleapis.com/database/disk/utilization"
        comparison: COMPARISON_GT
        thresholdValue: 0.8
        duration: "300s"
  notificationChannels: ["slack"]
```

---

## Cost Estimation

### Monthly Cost Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLOUD SQL COST ESTIMATION                                 │
└─────────────────────────────────────────────────────────────────────────────┘

DEVELOPMENT ENVIRONMENT
═══════════════════════════════════════════════════════════════════════════════

Instance:           db-custom-1-3840 (1 vCPU, 3.75 GB)
HA:                 No
Storage:            20 GB SSD

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (730 hours)                $35
Storage (20 GB × $0.17)             $3.40
Backups (20 GB × $0.08)             $1.60
Network (internal)                  Free
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$40/month


PRODUCTION ENVIRONMENT (Initial)
═══════════════════════════════════════════════════════════════════════════════

Instance:           db-custom-2-8192 (2 vCPU, 8 GB)
HA:                 Yes (2x cost)
Storage:            50 GB SSD

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (730 hours × 2 for HA)     $175
Storage (50 GB × $0.17 × 2)         $17
Backups (50 GB × $0.08)             $4
PITR logs (~10 GB × $0.08)          $0.80
Network (internal)                  Free
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$200/month


PRODUCTION ENVIRONMENT (Scaled)
═══════════════════════════════════════════════════════════════════════════════

Instance:           db-custom-4-16384 (4 vCPU, 16 GB)
HA:                 Yes
Storage:            200 GB SSD

Component                           Monthly Cost
─────────────────────────────────────────────────────────────────────────────
Instance (730 hours × 2 for HA)     $350
Storage (200 GB × $0.17 × 2)        $68
Backups (200 GB × $0.08)            $16
PITR logs (~50 GB × $0.08)          $4
Read replica (optional)             +$175
─────────────────────────────────────────────────────────────────────────────
TOTAL                               ~$440-615/month
```

### Cost Optimization Tips

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COST OPTIMIZATION                                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. RIGHT-SIZE INSTANCE
─────────────────────────────────────────────────────────────────────────────
   - Start small (db-custom-2-8192)
   - Monitor CPU/memory utilization
   - Scale up only when needed
   - Scale down during off-hours (if traffic allows)


2. COMMITTED USE DISCOUNTS
─────────────────────────────────────────────────────────────────────────────
   - 1-year commitment: 25% discount
   - 3-year commitment: 52% discount
   - Consider after stable traffic patterns


3. STORAGE OPTIMIZATION
─────────────────────────────────────────────────────────────────────────────
   - Enable auto-increase (start small, grow as needed)
   - Archive old data regularly
   - Use partitioning for large tables


4. BACKUP OPTIMIZATION
─────────────────────────────────────────────────────────────────────────────
   - 7-day retention is usually sufficient
   - Store long-term backups in Cloud Storage (cheaper)


5. READ REPLICAS
─────────────────────────────────────────────────────────────────────────────
   - Only add if read traffic is very high
   - Route read queries to replica
   - Replica costs same as primary
```

---

## Summary

### Database Schema Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tokens` | Token data | address, name, price, market_cap |
| `trades` | Transactions | token_address, trader, amount, price |
| `users` | User profiles | wallet_address, username |
| `holdings` | Balances | wallet_address, token_address, balance |
| `comments` | Discussions | token_address, user_wallet, content |
| `alerts` | Price alerts | user_wallet, token_address, target_price |
| `candles` | OHLCV data | token_address, period, timestamp, ohlcv |
| `token_stats` | Daily stats | token_address, date, volume, trades |

### Connection Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| Instance | db-custom-1-3840 | db-custom-2-8192 |
| HA | No | Yes |
| Storage | 20 GB | 50 GB |
| Max Connections | 100 | 200 |
| Pool per Pod | 10 | 20 |
| Cost | ~$40/month | ~$200/month |

### Key Practices

| Practice | Implementation |
|----------|----------------|
| Connection | Private IP only |
| Pooling | PgBouncer when scaling |
| Migrations | TypeORM, version controlled |
| Backups | Daily + PITR |
| Monitoring | Query Insights + Alerts |

### Files to Create

| File | Purpose |
|------|---------|
| `terraform/cloud-sql.tf` | Infrastructure |
| `src/config/database.config.ts` | NestJS config |
| `src/entities/*.entity.ts` | TypeORM entities |
| `src/migrations/*.ts` | Database migrations |
| `k8s/pgbouncer.yaml` | Connection pooler (optional) |
