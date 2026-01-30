-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('TRADING', 'LOCKED', 'LISTED');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PriceInterval" AS ENUM ('ONE_MINUTE', 'FIVE_MINUTES', 'FIFTEEN_MINUTES', 'ONE_HOUR', 'FOUR_HOURS', 'ONE_DAY');

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "curve_address" TEXT NOT NULL,
    "creator_address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "token_uri" TEXT,
    "virtual_native" TEXT NOT NULL,
    "virtual_token" TEXT NOT NULL,
    "real_native" TEXT NOT NULL DEFAULT '0',
    "real_token" TEXT NOT NULL DEFAULT '0',
    "k" TEXT NOT NULL,
    "current_price" TEXT NOT NULL,
    "market_cap" TEXT NOT NULL,
    "ath_price" TEXT,
    "ath_price_timestamp" TIMESTAMP(3),
    "ath_market_cap" TEXT,
    "ath_market_cap_timestamp" TIMESTAMP(3),
    "status" "TokenStatus" NOT NULL DEFAULT 'TRADING',
    "pool_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_block" BIGINT NOT NULL,
    "graduated_at" TIMESTAMP(3),
    "listed_at" TIMESTAMP(3),
    "listing_block" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "token_address" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "trader_address" TEXT NOT NULL,
    "amount_in" TEXT NOT NULL,
    "amount_out" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "fee_amount" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holders" (
    "id" TEXT NOT NULL,
    "token_address" TEXT NOT NULL,
    "holder_address" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "first_buy_timestamp" TIMESTAMP(3) NOT NULL,
    "last_activity_timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "token_address" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "interval" "PriceInterval" NOT NULL,
    "open" TEXT NOT NULL,
    "high" TEXT NOT NULL,
    "low" TEXT NOT NULL,
    "close" TEXT NOT NULL,
    "volume_native" TEXT NOT NULL,
    "volume_token" TEXT NOT NULL,
    "trade_count" INTEGER NOT NULL,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_fees" (
    "id" TEXT NOT NULL,
    "creator_address" TEXT NOT NULL,
    "accumulated_fees" TEXT NOT NULL,
    "claimed_fees" TEXT NOT NULL DEFAULT '0',
    "last_accumulation_timestamp" TIMESTAMP(3) NOT NULL,
    "last_claim_timestamp" TIMESTAMP(3),

    CONSTRAINT "creator_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_portfolios" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "total_invested" TEXT NOT NULL DEFAULT '0',
    "total_returned" TEXT NOT NULL DEFAULT '0',
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_state" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "last_processed_block" BIGINT NOT NULL,
    "last_processed_hash" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_address_key" ON "tokens"("address");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_curve_address_key" ON "tokens"("curve_address");

-- CreateIndex
CREATE INDEX "tokens_creator_address_idx" ON "tokens"("creator_address");

-- CreateIndex
CREATE INDEX "tokens_status_idx" ON "tokens"("status");

-- CreateIndex
CREATE INDEX "tokens_created_at_idx" ON "tokens"("created_at");

-- CreateIndex
CREATE INDEX "tokens_market_cap_idx" ON "tokens"("market_cap");

-- CreateIndex
CREATE UNIQUE INDEX "trades_tx_hash_key" ON "trades"("tx_hash");

-- CreateIndex
CREATE INDEX "trades_token_address_timestamp_idx" ON "trades"("token_address", "timestamp");

-- CreateIndex
CREATE INDEX "trades_trader_address_timestamp_idx" ON "trades"("trader_address", "timestamp");

-- CreateIndex
CREATE INDEX "trades_block_number_idx" ON "trades"("block_number");

-- CreateIndex
CREATE INDEX "holders_token_address_idx" ON "holders"("token_address");

-- CreateIndex
CREATE INDEX "holders_holder_address_idx" ON "holders"("holder_address");

-- CreateIndex
CREATE UNIQUE INDEX "holders_token_address_holder_address_key" ON "holders"("token_address", "holder_address");

-- CreateIndex
CREATE INDEX "price_history_token_address_interval_timestamp_idx" ON "price_history"("token_address", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_token_address_interval_timestamp_key" ON "price_history"("token_address", "interval", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "creator_fees_creator_address_key" ON "creator_fees"("creator_address");

-- CreateIndex
CREATE UNIQUE INDEX "user_portfolios_wallet_address_key" ON "user_portfolios"("wallet_address");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holders" ADD CONSTRAINT "holders_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_token_address_fkey" FOREIGN KEY ("token_address") REFERENCES "tokens"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
