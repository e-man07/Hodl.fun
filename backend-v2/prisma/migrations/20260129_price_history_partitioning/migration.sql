-- Migration: Add time-based partitioning to price_history table
-- This migration converts the price_history table to a partitioned table
-- for improved query performance on time-series data.
--
-- IMPORTANT: This migration should be run during a maintenance window
-- as it requires table recreation.

-- Step 1: Rename existing table
ALTER TABLE IF EXISTS price_history RENAME TO price_history_old;

-- Step 2: Create new partitioned table with same schema
CREATE TABLE price_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    token_address VARCHAR(255) NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "interval" VARCHAR(20) NOT NULL,
    "open" TEXT NOT NULL,
    high TEXT NOT NULL,
    low TEXT NOT NULL,
    "close" TEXT NOT NULL,
    volume_native TEXT NOT NULL,
    volume_token TEXT NOT NULL,
    trade_count INTEGER NOT NULL,
    PRIMARY KEY (token_address, "interval", "timestamp")
) PARTITION BY RANGE ("timestamp");

-- Step 3: Create partitions for 2025-2027 (monthly partitions)
-- 2025
CREATE TABLE price_history_2025_01 PARTITION OF price_history
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE price_history_2025_02 PARTITION OF price_history
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE price_history_2025_03 PARTITION OF price_history
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE price_history_2025_04 PARTITION OF price_history
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE price_history_2025_05 PARTITION OF price_history
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE price_history_2025_06 PARTITION OF price_history
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE price_history_2025_07 PARTITION OF price_history
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE price_history_2025_08 PARTITION OF price_history
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE price_history_2025_09 PARTITION OF price_history
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE price_history_2025_10 PARTITION OF price_history
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE price_history_2025_11 PARTITION OF price_history
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE price_history_2025_12 PARTITION OF price_history
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026
CREATE TABLE price_history_2026_01 PARTITION OF price_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE price_history_2026_02 PARTITION OF price_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE price_history_2026_03 PARTITION OF price_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE price_history_2026_04 PARTITION OF price_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE price_history_2026_05 PARTITION OF price_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE price_history_2026_06 PARTITION OF price_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE price_history_2026_07 PARTITION OF price_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE price_history_2026_08 PARTITION OF price_history
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE price_history_2026_09 PARTITION OF price_history
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE price_history_2026_10 PARTITION OF price_history
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE price_history_2026_11 PARTITION OF price_history
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE price_history_2026_12 PARTITION OF price_history
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- 2027 (future-proofing)
CREATE TABLE price_history_2027_01 PARTITION OF price_history
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE price_history_2027_02 PARTITION OF price_history
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE price_history_2027_03 PARTITION OF price_history
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE price_history_2027_04 PARTITION OF price_history
    FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE price_history_2027_05 PARTITION OF price_history
    FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE price_history_2027_06 PARTITION OF price_history
    FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

-- Step 4: Create indexes on each partition (PostgreSQL does this automatically for new data)
-- The indexes on partitions are created automatically when using declarative partitioning

-- Step 5: Create a covering index for common queries
CREATE INDEX idx_price_history_token_interval_ts
    ON price_history (token_address, "interval", "timestamp" DESC);

-- Step 6: Migrate data from old table (if any exists)
INSERT INTO price_history (id, token_address, "timestamp", "interval", "open", high, low, "close", volume_native, volume_token, trade_count)
SELECT id, token_address, "timestamp", "interval", "open", high, low, "close", volume_native, volume_token, trade_count
FROM price_history_old
ON CONFLICT (token_address, "interval", "timestamp") DO NOTHING;

-- Step 7: Drop old table after successful migration
DROP TABLE IF EXISTS price_history_old;

-- Step 8: Create a function to auto-create new partitions
CREATE OR REPLACE FUNCTION create_price_history_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Create partition for next month if it doesn't exist
    partition_date := date_trunc('month', CURRENT_DATE + INTERVAL '1 month')::DATE;
    partition_name := 'price_history_' || to_char(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';

    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF price_history FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create scheduled job to create partitions (run monthly)
-- Note: This requires pg_cron extension. If not available, run create_price_history_partition() manually.
-- SELECT cron.schedule('create_price_history_partition', '0 0 25 * *', 'SELECT create_price_history_partition()');

COMMENT ON TABLE price_history IS 'Time-series price history with monthly partitioning for improved query performance';
