# Hodl.fun Token Launchpad Backend - NestJS Edition

Enterprise-scale backend for the Hodl.fun token launchpad platform supporting 10k+ token launches/day, 500k+ users, and 700+ trades/minute.

## Architecture

### Design Patterns
- **Clean Architecture**: Layered design with clear dependency flow
- **Hexagonal Architecture**: Ports & adapters for external services
- **Domain-Driven Design**: Rich domain models with business logic
- **CQRS**: Command Query Responsibility Segregation
- **Event-Driven**: Domain events and pub/sub for real-time updates

### 3-Service Architecture

```
┌─────────────────────────────────────────┐
│  API Server (REST + WebSocket)          │
│  Port: 3000                             │
│  - Token endpoints                      │
│  - Market endpoints                     │
│  - User portfolio endpoints             │
│  - Real-time WebSocket subscriptions    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Blockchain Indexer                     │
│  5-second polling                       │
│  - Listens to smart contract events     │
│  - Syncs state to PostgreSQL            │
│  - Manages Uniswap V3 integration       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Background Workers (Bull Queue)        │
│  - Metrics updates                      │
│  - Cache warming                        │
│  - IPFS metadata caching                │
│  - Scheduled tasks                      │
└─────────────────────────────────────────┘
```

### Technology Stack

- **Framework**: NestJS 10.3.0
- **Language**: TypeScript 5.7
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis with ioredis
- **Real-time**: Socket.io with Redis adapter
- **Message Queue**: Bull (Redis-backed)
- **Blockchain**: ethers.js 6.15.0
- **Scheduler**: node-cron

## Project Structure

```
backend-nestjs/
├── apps/
│   ├── api/              # REST API + WebSocket server
│   ├── indexer/          # Blockchain event listener
│   └── worker/           # Background job processor
├── libs/
│   ├── core/             # Infrastructure (DB, Redis, RPC)
│   ├── domain/           # Pure business logic entities
│   ├── application/      # Use cases (CQRS handlers)
│   ├── infrastructure/   # Adapters & repositories
│   ├── presentation/     # Controllers & WebSocket gateways
│   └── shared/           # Guards, pipes, interceptors, filters
├── prisma/               # Database schema
└── test/                 # E2E tests
```

## Getting Started

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Build the project
npm run build
```

### Development

```bash
# Start API server (watch mode)
npm run start:dev:api

# Start blockchain indexer (watch mode)
npm run start:dev:indexer

# Start background workers (watch mode)
npm run start:dev:worker

# Run all services
npm run start:dev
```

### Production

```bash
# Build for production
npm run build

# Start API server
npm run start:prod:api

# Start blockchain indexer
npm run start:prod:indexer

# Start background workers
npm run start:prod:worker
```

## API Endpoints

### Tokens
- `GET /api/v1/tokens` - List all tokens
- `GET /api/v1/tokens/:address` - Get token details
- `POST /api/v1/tokens/:address/calculate-buy` - Calculate buy quote

### Market
- `GET /api/v1/market/stats` - Market statistics
- `GET /api/v1/market/trending` - Trending tokens

### User
- `GET /api/v1/users/:address/portfolio` - User portfolio
- `GET /api/v1/users/:address/trades` - User trade history

### Health
- `GET /api/v1/health` - Health check

## WebSocket Events

Connect to `ws://localhost:3000/tokens`

### Subscribe
```json
{
  "event": "subscribe-token",
  "data": {
    "tokenAddress": "0x..."
  }
}
```

### Price Updates
```json
{
  "event": "price-update",
  "data": {
    "address": "0x...",
    "price": "123.45",
    "marketCap": "1000000",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

## Environment Variables

```
# Application
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hodlfun

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Blockchain
PUSH_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
PUSH_RPC_URL_ALT=https://evm.rpc-testnet-donut-node2.push.org/
CHAIN_ID=42101
CHAIN_NAME=Push Chain Testnet

# Smart Contracts
CORE_ADDRESS=0x...
BONDING_CURVE_FACTORY_ADDRESS=0x...
WNAT_ADDRESS=0x...

# IPFS
PINATA_JWT=your_token_here

# JWT
JWT_SECRET=your_secret_here
JWT_EXPIRATION=86400
```

## Database

### Schema Highlights

```sql
-- Core tables
- Token (blockchain tokens)
- TokenTrade (trade history)
- UserPortfolio (user holdings)
- PriceHistory (candlestick data)

-- Indexes for performance
- tokens(address)
- token_trades(tokenId, executedAt)
- user_portfolios(userId, tokenId)
- price_history(tokenId, timestamp)
```

### Migrations

```bash
# Create new migration
npx prisma migrate dev --name add_feature

# Check migration status
npx prisma migrate status

# Reset database (DEVELOPMENT ONLY)
npx prisma migrate reset
```

## Smart Contract Integration

### Events Indexed

- `CreateCurve` - Token creation
- `Buy`/`Sell` - Trading events
- `Sync` - Reserve updates
- `Lock` - Graduation trigger
- `Listing` - Uniswap V3 listing
- `NewATHPrice`/`NewATHMarketCap` - ATH tracking

### Contract ABIs

Located in: `/Users/e-man/token-launchpad/smart-contract2/out/`

## Deployment

### Docker

```bash
# Build Docker images
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### VPS (Hetzner)

Infrastructure cost: $370-1000/month for enterprise scale
- Instance 1: Database + Redis ($320)
- Instance 2: API Server ($60)
- Instance 3: API Server ($60)
- Instance 4: Indexer + Workers ($60)
- Instance 5: Monitoring ($20)

## Monitoring

### Health Checks
- Database connectivity: `GET /health`
- Redis connectivity: Checked on startup
- Blockchain RPC: Fallback provider with retry logic

### Metrics
- API response time
- Database query latency
- Cache hit rate
- Event processing rate

### Logging

```typescript
// Logger levels: error, warn, log, debug
logger.log('Info message');
logger.error('Error message');
logger.debug('Debug message');
```

## Performance Targets

- **API Response**: < 500ms (p99)
- **WebSocket Latency**: < 100ms
- **Database Query**: < 100ms (indexed queries)
- **Cache Hit Rate**: 80-90%
- **Throughput**: 700+ trades/minute

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Write tests for new code
3. Ensure all tests pass: `npm run test`
4. Format code: `npm run format`
5. Create pull request

## License

MIT

---

**Built with** ❤️ **for the Hodl.fun community**
