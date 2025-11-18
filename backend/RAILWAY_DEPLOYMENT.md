# Railway Deployment Guide - Hodl.fun Backend API

This guide will help you deploy the Hodl.fun backend API server to Railway.

## Architecture Overview

```
┌─────────────────────────────────────┐
│     Railway (Production)            │
│  - Backend API (src/server.ts)      │
│  - No Redis (uses in-memory cache)  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Neon (Serverless PostgreSQL)    │
│  - PostgreSQL Database (Shared)     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Local Machine (Free)            │
│  - Redis Server                     │
│  - Worker (background jobs)         │
│  - Indexer (blockchain sync)        │
└─────────────────────────────────────┘
```

## Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **Railway CLI** (optional): `npm i -g @railway/cli`
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Create Railway Project

### Option A: Using Railway Dashboard (Recommended)

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `Hodl.fun/backend` repository
4. Railway will auto-detect the Dockerfile

### Option B: Using Railway CLI

```bash
# Login to Railway
railway login

# Initialize project (from backend directory)
cd /path/to/Hodl.fun/backend
railway init

# Link to existing project or create new
railway link
```

## Step 2: Get Neon Database Connection Strings

You're already using Neon PostgreSQL - no need to create a new database:

1. Go to https://console.neon.tech
2. Select your Hodl.fun project
3. Go to **"Connection Details"**
4. Copy both connection strings:
   - **Connection string** (for `DATABASE_URL`)
   - **Direct connection** (for `DIRECT_URL`) - or use the same as DATABASE_URL
5. Make sure the connection string includes `?sslmode=require` at the end

## Step 3: Configure Environment Variables

In Railway dashboard, go to your service → **"Variables"** tab and add:

### Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Database (Neon PostgreSQL - Copy from https://console.neon.tech)
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/hodlfun?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/hodlfun?sslmode=require

# NO REDIS - Backend runs without it
# REDIS_URL=  (Leave empty or remove)
# REDIS_PASSWORD=  (Leave empty or remove)

# Blockchain RPC
PRIMARY_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
SECONDARY_RPC_URL=
TERTIARY_RPC_URL=

# Smart Contracts
TOKEN_FACTORY_ADDRESS=0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0
MARKETPLACE_ADDRESS=0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f
START_BLOCK=1215287

# IPFS (Pinata)
PINATA_API_KEY=your_actual_pinata_api_key
PINATA_SECRET_KEY=your_actual_pinata_secret_key
PINATA_JWT=your_actual_pinata_jwt_token
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/

# Caching (In-memory only without Redis)
CACHE_ENABLED=true
CACHE_TTL_TOKEN_LIST=600000
CACHE_TTL_TOKEN_DETAILS=300000
CACHE_TTL_TOKEN_PRICE=60000
CACHE_TTL_METADATA=3600000

# Rate Limiting (In-memory)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RPC_RATE_LIMIT=10
IPFS_RATE_LIMIT=20

# Disable Worker and Indexer on API server
INDEXER_ENABLED=false
WORKER_ENABLED=false

# Monitoring
LOG_LEVEL=info

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars-long
ADMIN_ADDRESSES=0xYourAdminAddress1,0xYourAdminAddress2
TRUSTED_IPS=

# CORS - Add your frontend domains
CORS_ORIGIN=https://your-frontend.vercel.app,https://www.your-domain.com
```

### Important Notes:

- **Copy DATABASE_URL from Neon** - Get it from https://console.neon.tech
- **Don't set REDIS_URL** - The backend gracefully falls back to in-memory caching
- **Set INDEXER_ENABLED=false** and **WORKER_ENABLED=false** - These run on your local machine
- Update **CORS_ORIGIN** with your actual frontend URL(s)
- Generate a strong **JWT_SECRET** (32+ characters)
- Add your actual **Pinata credentials**

## Step 4: Configure Build Settings

The `railway.api.json` file is already configured:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 300,
    "startCommand": "node dist/server.js"
  }
}
```

## Step 5: Deploy

### Automatic Deployment (Recommended)

Railway will automatically deploy when you push to your GitHub repository:

```bash
git add .
git commit -m "Configure for Railway deployment"
git push origin main
```

### Manual Deployment (CLI)

```bash
# From backend directory
railway up

# Or deploy with environment
railway up --environment production
```

## Step 6: Verify Deployment

1. **Check Logs**:
   - Railway Dashboard → Your Service → **"Logs"** tab
   - Look for: `✅ Server is running`

2. **Test Health Endpoint**:
   ```bash
   curl https://your-app.railway.app/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "uptime": 123.456
   }
   ```

3. **Test API Endpoint**:
   ```bash
   curl https://your-app.railway.app/api/v1/tokens
   ```

4. **Check Monitoring Dashboard**:
   ```
   https://your-app.railway.app/api/v1/monitoring/dashboard
   ```

## Step 7: Get Your Railway Domain

1. Railway Dashboard → Your Service → **"Settings"** tab
2. Under **"Domains"**, you'll see your generated domain: `your-app.railway.app`
3. (Optional) Add a custom domain

## Running Worker & Indexer Locally

Your local machine will run the worker and indexer that connect to the Railway database:

### 1. Update Local `.env`

```bash
# Use Railway's DATABASE_URL
DATABASE_URL=postgresql://user:pass@your-railway-postgres-host/database

# Keep local Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=hodlfun_redis_secure_password

# Enable worker and indexer locally
WORKER_ENABLED=true
INDEXER_ENABLED=true

# Same blockchain config as Railway
PRIMARY_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
TOKEN_FACTORY_ADDRESS=0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0
MARKETPLACE_ADDRESS=0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f
START_BLOCK=1215287
```

### 2. Start Local Services

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Worker
npm run worker

# Terminal 3: Start Indexer
npm run indexer
```

## Monitoring & Debugging

### View Logs

```bash
# Using Railway CLI
railway logs

# Or in Railway Dashboard → Logs tab
```

### Common Issues

#### 1. Database Connection Error

**Error**: `Can't reach database server`

**Fix**:
- Verify DATABASE_URL is correct from Neon dashboard
- Ensure it includes `?sslmode=require` parameter
- Check Neon project is not suspended (free tier sleeps after inactivity)

#### 2. Prisma Migration Failed

**Error**: `Migration failed to apply`

**Fix**: Railway runs `prisma migrate deploy` automatically. Check logs.

#### 3. Health Check Failing

**Error**: `Health check failed after 300s`

**Fix**:
- Check PORT is set to 3001
- Verify `/api/v1/health` endpoint is accessible
- Increase `healthcheckTimeout` in `railway.api.json`

#### 4. CORS Errors

**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Fix**: Update CORS_ORIGIN environment variable with your frontend URL

### Check Resource Usage

Railway Dashboard → Your Service → **"Metrics"** tab
- Monitor CPU, Memory, Network usage
- Adjust replicas if needed

## Scaling (Optional)

### Vertical Scaling
Railway Dashboard → Settings → **"Resources"**
- Increase memory/CPU as needed

### Horizontal Scaling
**Note**: Without Redis, rate limiting is per-instance. For multiple replicas, consider adding Redis.

## Cost Optimization

Current setup minimizes costs:
- ✅ API on Railway (**$5-10/month**)
- ✅ PostgreSQL on Neon (Free tier or **$0-20/month**)
- ✅ Worker, Indexer, Redis on local machine (**FREE**)

**Total Estimated Cost: $5-30/month** depending on usage

## Updating Your Deployment

```bash
# Make changes locally
git add .
git commit -m "Update feature"
git push origin main

# Railway auto-deploys the changes
```

Or force redeploy:
```bash
railway up --detach
```

## Rollback

If deployment fails:

```bash
# Using Railway CLI
railway rollback

# Or in Railway Dashboard → Deployments → Click previous deployment → Rollback
```

## Security Checklist

- [ ] Strong JWT_SECRET (32+ characters)
- [ ] CORS_ORIGIN set to your actual domains only
- [ ] ADMIN_ADDRESSES configured
- [ ] Pinata credentials are production keys
- [ ] Database backups enabled in Railway
- [ ] Environment variables are not committed to git

## Support & Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Hodl.fun API Docs: https://your-app.railway.app/api/v1/health

---

## Quick Reference Commands

```bash
# View logs
railway logs

# Open Railway dashboard
railway open

# Check deployment status
railway status

# Run database migrations manually
railway run npx prisma migrate deploy

# Access database shell
railway run npx prisma studio
```

---

**Deployment Date**: 2025-11-18
**Last Updated**: 2025-11-18
