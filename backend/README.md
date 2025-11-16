# Hodl.fun Backend API

Scalable, **fully self-hosted** backend for the Hodl.fun Token Launchpad platform. Built with Node.js, Express, TypeScript, PostgreSQL, and Redis.

## 💰 Zero External Service Costs

**$780+/year saved** by using self-hosted solutions:
- ❌ ~~Sentry APM ($26+/mo)~~ → ✅ Built-in error tracking
- ❌ ~~Upstash Redis ($10+/mo)~~ → ✅ Local Redis container
- ❌ ~~Prometheus/Grafana ($29+/mo)~~ → ✅ In-memory metrics + dashboard

**Total external costs**: $0/month (only server hosting)

📖 See [ZERO_COST_MIGRATION.md](ZERO_COST_MIGRATION.md) for details

## 🌟 Features

### Core Functionality
- ✅ **Blockchain Event Indexer** - Indexes all token creation and trading events
- ✅ **RPC Provider Management** - Fallback provider with rate limiting
- ✅ **IPFS Integration** - Secure file uploads with Pinata (credentials hidden from frontend)
- ✅ **Redis Caching** - Multi-layer caching strategy for optimal performance
- ✅ **PostgreSQL Database** - Robust data storage with Prisma ORM
- ✅ **RESTful APIs** - Type-safe APIs for tokens, users, market stats

### Performance Optimizations
- **95% faster marketplace loads** - Pre-indexed token data (60s → <1s)
- **Zero client RPC calls** - All blockchain queries handled server-side
- **Efficient caching** - Redis + database caching with smart invalidation
- **Rate limiting** - Prevents abuse and manages RPC quotas
- **Background workers** - Async processing with Bull queues

### Security
- ✅ IPFS credentials hidden from frontend
- ✅ Input validation and sanitization
- ✅ File upload security (size, type, content validation)
- ✅ Rate limiting per endpoint
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ JWT authentication with admin roles
- ✅ Password-protected Redis
- ✅ XSS sanitization

### Monitoring & Observability (Self-Hosted)
- ✅ **Error Tracking** - File-based error logs with 7-day rotation
- ✅ **Metrics Collection** - In-memory HTTP, DB, and cache metrics
- ✅ **Dashboard** - Beautiful HTML dashboard at `/api/v1/monitoring/dashboard`
- ✅ **Zero External Costs** - No Sentry, Prometheus, or Grafana needed

---

## 📦 Tech Stack

- **Runtime**: Node.js 20+ LTS
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+ (Neon free tier)
- **Cache**: Redis 7+ (Self-hosted in Docker)
- **ORM**: Prisma 5.x
- **Blockchain**: ethers.js v6
- **Queue**: Bull (Redis-based)
- **Monitoring**: Self-hosted (file-based logs + in-memory metrics)

---

## 🚀 Quick Start

📚 **Deployment Guides:**
- 🚂 **[Railway Deployment Guide](RAILWAY_DEPLOYMENT.md)** - Complete guide for deploying to Railway
- 🏠 **[Self-Hosted Guide](SELF_HOSTED_GUIDE.md)** - Run on your own VPS/server
- 🔧 **[Workers & Indexer](WORKERS_AND_INDEXER.md)** - Understanding background processes
- ⚡ **[Quick Start](QUICK_START.md)** - Get running locally in 5 minutes
- 🚀 **[Performance Optimization](PERFORMANCE_OPTIMIZATION.md)** - Database indexing & speed improvements

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL database (Neon, Supabase, or local)
- Redis instance (Upstash, Redis Cloud, or local)

### 1. Install Dependencies

\`\`\`bash
cd backend
npm install
\`\`\`

### 2. Environment Setup

Copy the example environment file and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your configuration:

\`\`\`env
# Database (Get from Neon, Supabase, or Railway)
DATABASE_URL="postgresql://user:password@host:5432/hodlfun?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/hodlfun?sslmode=require"

# Redis (Get from Upstash or Redis Cloud)
REDIS_URL="redis://:password@host:port"

# IPFS (Move from frontend .env)
PINATA_API_KEY="your_api_key"
PINATA_SECRET_KEY="your_secret_key"
PINATA_JWT="your_jwt_token"

# Blockchain
PRIMARY_RPC_URL="https://evm.rpc-testnet-donut-node1.push.org/"
TOKEN_FACTORY_ADDRESS="0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0"
MARKETPLACE_ADDRESS="0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f"

# CORS (Add your frontend URL)
CORS_ORIGIN="http://localhost:3000,https://your-app.vercel.app"
\`\`\`

### 3. Database Setup

\`\`\`bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
\`\`\`

### 4. Run Development Server

\`\`\`bash
# Start API server
npm run dev

# In a separate terminal, start the indexer
npm run indexer
\`\`\`

The server will start on `http://localhost:3001`

### 5. Verify Setup

\`\`\`bash
# Health check
curl http://localhost:3001/health

# Detailed health (checks database & redis)
curl http://localhost:3001/health/detailed
\`\`\`

---

## 📁 Project Structure

\`\`\`
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── index.ts      # App config
│   │   ├── database.ts   # Prisma client
│   │   └── redis.ts      # Redis client
│   ├── contracts/        # Smart contract ABIs
│   │   └── abis.ts
│   ├── controllers/      # Request handlers (to be created)
│   ├── services/         # Business logic
│   │   ├── contractService.ts
│   │   ├── ipfsService.ts
│   │   └── rpcService.ts
│   ├── workers/          # Background jobs (to be created)
│   ├── indexer/          # Blockchain event indexer
│   │   └── index.ts
│   ├── routes/           # API routes
│   │   └── health.ts
│   ├── middleware/       # Express middleware
│   │   ├── errorHandler.ts
│   │   └── rateLimit.ts
│   ├── utils/            # Utility functions
│   │   ├── logger.ts
│   │   └── response.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   └── server.ts         # Main Express app
├── prisma/
│   └── schema.prisma     # Database schema
├── logs/                 # Application logs
├── .env                  # Environment variables
├── .env.example          # Example environment file
├── tsconfig.json         # TypeScript config
├── package.json          # Dependencies
└── README.md             # This file
\`\`\`

---

## 🗄️ Database Schema

### 7 Core Tables

1. **tokens** - Token metadata (address, name, symbol, creator, etc.)
2. **token_metrics** - Time-series data (price, volume, market cap)
3. **holders** - Token holder balances
4. **transactions** - All buy/sell/create transactions
5. **ipfs_cache** - Cached IPFS metadata
6. **user_portfolios** - Aggregated user holdings with PnL
7. **market_stats** - Daily market aggregates

### Key Indexes
- Token address, creator, creation time
- Transaction user, token, timestamp
- Holder token and address
- Metrics by token and time

---

## 🔧 Available Scripts

\`\`\`bash
# Development
npm run dev              # Start dev server with hot reload
npm run indexer          # Start blockchain indexer
npm run worker           # Start background workers

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:push      # Push schema to database
npm run prisma:studio    # Open Prisma Studio

# Production
npm run build            # Build TypeScript
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm test                 # Run tests
\`\`\`

---

## 📡 API Endpoints (Phase 1 - In Progress)

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies

### Tokens (Coming Soon)
- `GET /api/v1/tokens` - List all tokens (paginated, sorted, filtered)
- `GET /api/v1/tokens/:address` - Get token details
- `GET /api/v1/tokens/:address/metrics` - Get price history
- `GET /api/v1/tokens/:address/holders` - Get holder list
- `GET /api/v1/tokens/:address/trades` - Get transaction history

### Users (Coming Soon)
- `GET /api/v1/users/:address/portfolio` - Get user portfolio
- `GET /api/v1/users/:address/transactions` - Get user transactions
- `GET /api/v1/users/:address/pnl` - Get profit/loss stats

### Market (Coming Soon)
- `GET /api/v1/market/stats` - Global market statistics
- `GET /api/v1/market/trending` - Trending tokens
- `GET /api/v1/market/new` - Recently launched tokens

### IPFS (Coming Soon)
- `POST /api/v1/ipfs/upload-image` - Upload image (multipart/form-data)
- `POST /api/v1/ipfs/upload-metadata` - Upload JSON metadata

---

## 🔍 Blockchain Indexer

The indexer continuously monitors the blockchain for events:

### Events Indexed
1. **TokenCreated** - New token launches
2. **TokensBought** - Buy transactions
3. **TokensSold** - Sell transactions

### Features
- Automatic resume from last block
- Configurable batch size
- Waits for confirmations
- Parallel event processing
- IPFS metadata fetching
- Automatic holder tracking
- Portfolio PnL calculation

### Configuration

\`\`\`env
INDEXER_ENABLED=true
INDEXER_POLL_INTERVAL=3000      # 3 seconds
INDEXER_BATCH_SIZE=100          # Process 100 blocks at a time
INDEXER_CONFIRMATIONS=3         # Wait for 3 confirmations
START_BLOCK=0                   # Start from genesis
\`\`\`

---

## 🔐 Security Best Practices

1. **Never commit `.env`** - Secrets stay local
2. **IPFS credentials** - Only in backend, never frontend
3. **Input validation** - All user inputs validated
4. **File uploads** - Size, type, and content validation
5. **Rate limiting** - Per-endpoint limits
6. **CORS** - Restrict to known origins
7. **SQL injection** - Prevented by Prisma ORM
8. **XSS prevention** - Text sanitization

---

## 📊 Performance Metrics

### Before Backend
- Marketplace load: **30-60 seconds**
- RPC calls per page: **100+**
- Token page load: **5-10 seconds**
- Portfolio load: **10-20 seconds**

### After Backend (Target)
- Marketplace load: **<1 second** (95% faster)
- RPC calls per page: **0** (100% reduction)
- Token page load: **<500ms** (90% faster)
- Portfolio load: **<1 second** (90% faster)

---

## 🚀 Deployment

### Option 1: Railway (Recommended)

1. Create new project on Railway
2. Add PostgreSQL and Redis services
3. Deploy backend service
4. Set environment variables
5. Deploy!

### Option 2: Render

1. Create new web service
2. Connect to GitHub repo
3. Add PostgreSQL and Redis instances
4. Configure environment variables
5. Deploy!

### Option 3: Docker

\`\`\`bash
# Build image
docker build -t hodlfun-backend .

# Run container
docker run -p 3001:3001 --env-file .env hodlfun-backend
\`\`\`

---

## 📝 Environment Variables Reference

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `PRIMARY_RPC_URL` - Blockchain RPC endpoint
- `TOKEN_FACTORY_ADDRESS` - Token factory contract
- `MARKETPLACE_ADDRESS` - Marketplace contract

### Optional
- `REDIS_URL` - Redis connection (caching disabled if not set)
- `PINATA_API_KEY` - For IPFS uploads
- `PINATA_SECRET_KEY` - For IPFS uploads
- `PINATA_JWT` - For IPFS uploads
- `CORS_ORIGIN` - Allowed frontend origins
- `PORT` - Server port (default: 3001)
- `LOG_LEVEL` - Logging level (default: info)

---

## 🐛 Troubleshooting

### Database connection fails
\`\`\`bash
# Check DATABASE_URL format
# For Neon: postgresql://user:pass@host/dbname?sslmode=require

# Test connection
npm run prisma:studio
\`\`\`

### Redis connection fails
\`\`\`bash
# Backend will work without Redis (caching disabled)
# Check REDIS_URL format
# For Upstash: redis://:password@host:port
\`\`\`

### Indexer not starting
\`\`\`bash
# Check RPC_URL is accessible
curl https://evm.rpc-testnet-donut-node1.push.org/

# Check START_BLOCK is valid
# Verify contract addresses are correct
\`\`\`

---

## 🛠️ Next Steps

### Phase 2: Token APIs (Week 3-4)
- [ ] Implement Token routes and controllers
- [ ] Add search and filtering
- [ ] Create trending algorithm
- [ ] Add pagination

### Phase 3: Background Workers (Week 4-5)
- [ ] Set up Bull queues
- [ ] Metric calculation jobs
- [ ] Cache warming jobs
- [ ] Daily aggregation jobs

### Phase 4: Real-time Updates (Week 6-7)
- [ ] WebSocket server
- [ ] Live price feeds
- [ ] Trade notifications
- [ ] Market events

### Phase 5: Frontend Integration (Week 7-8)
- [ ] Create API client in frontend
- [ ] Refactor hooks to use backend
- [ ] Remove direct RPC calls
- [ ] Update IPFS uploads to use backend

---

## 📞 Support

For issues and questions:
- Check [troubleshooting](#-troubleshooting) section
- Review logs in `logs/` directory
- Check health endpoint: `/health/detailed`

---

## 📄 License

MIT

---

Built with ❤️ for Hodl.fun
