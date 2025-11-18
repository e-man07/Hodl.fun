# Quick Start - Deploy to Railway in 5 Minutes

## Prerequisites
- GitHub account with your code pushed
- Railway account (free tier works)

## 🚀 Fast Deployment Steps

### 1. Create Railway Project (2 min)

**Via Railway Dashboard:**
1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `Hodl.fun/backend` repository
4. Railway detects the Dockerfile automatically ✅

### 2. Get Neon Database URLs (30 seconds)

You're already using Neon PostgreSQL - just copy the connection strings:

1. Go to https://console.neon.tech
2. Select your project
3. Copy the **Connection String** (you'll add this in step 3)

### 3. Set Environment Variables (2 min)

Go to your service → **"Variables"** tab, click **"Raw Editor"**, paste this:

```env
NODE_ENV=production
PORT=3001
API_VERSION=v1
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/hodlfun?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/hodlfun?sslmode=require
PINATA_API_KEY=your_actual_key
PINATA_SECRET_KEY=your_actual_secret
PINATA_JWT=your_actual_jwt
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/
PRIMARY_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
TOKEN_FACTORY_ADDRESS=0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0
MARKETPLACE_ADDRESS=0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f
START_BLOCK=1215287
CACHE_ENABLED=true
CACHE_TTL_TOKEN_LIST=600000
CACHE_TTL_TOKEN_DETAILS=300000
CACHE_TTL_TOKEN_PRICE=60000
CACHE_TTL_METADATA=3600000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RPC_RATE_LIMIT=10
IPFS_RATE_LIMIT=20
INDEXER_ENABLED=false
WORKER_ENABLED=false
LOG_LEVEL=info
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-32-CHAR-SECRET
ADMIN_ADDRESSES=0xYourAddress
CORS_ORIGIN=https://your-frontend.vercel.app
```

**Replace:**
- `DATABASE_URL` and `DIRECT_URL` with your Neon connection strings from https://console.neon.tech
- `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `PINATA_JWT` with your real Pinata credentials
- `JWT_SECRET` with a strong random string (32+ chars)
- `ADMIN_ADDRESSES` with your admin wallet address
- `CORS_ORIGIN` with your frontend URL

Click **"Save"**

### 4. Deploy (30 seconds)

Railway will automatically build and deploy! Watch the logs:
- Look for: `✅ Server is running`
- Should take 2-3 minutes

### 5. Test It (30 seconds)

Get your Railway URL from **Settings** → **Domains**: `your-app.railway.app`

```bash
# Test health check
curl https://your-app.railway.app/health

# Test API
curl https://your-app.railway.app/api/v1/tokens
```

✅ **Done!** Your backend is live!

---

## 🏠 Run Worker & Indexer Locally

Your local machine will run the worker and indexer:

### 1. Update Local `.env`

```bash
# Copy DATABASE_URL from Railway
DATABASE_URL=postgresql://postgres:password@monorail.proxy.rlwy.net:12345/railway

# Local Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=hodlfun_redis_secure_password

# Enable services
WORKER_ENABLED=true
INDEXER_ENABLED=true

# Same blockchain config
PRIMARY_RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/
TOKEN_FACTORY_ADDRESS=0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0
MARKETPLACE_ADDRESS=0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f
START_BLOCK=1215287
```

### 2. Start Services

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Worker
npm run worker

# Terminal 3: Indexer
npm run indexer
```

---

## 🔧 Troubleshooting

### Deployment Failed?

**Check logs:** Railway Dashboard → Logs tab

**Common Issues:**

1. **Database Connection Error**
   - Verify `DATABASE_URL` is correct from Neon dashboard
   - Ensure Neon allows connections from Railway IPs (should be enabled by default)

2. **Build Failed**
   - Check if `Dockerfile` exists
   - Try: `npm run build` locally

3. **Health Check Failed**
   - Check PORT is set to `3001`
   - Verify `/api/v1/health` endpoint works

### CORS Errors?

Update `CORS_ORIGIN` with your actual frontend URL:
```
CORS_ORIGIN=https://your-actual-domain.com
```

### API Returns Errors?

Check Railway logs:
```bash
railway logs  # if using CLI
```

Or in Dashboard → Logs tab

---

## 📊 Monitoring

### View Logs
Railway Dashboard → Your Service → **"Logs"**

### Check Metrics
Railway Dashboard → Your Service → **"Metrics"**

### Monitoring Dashboard
```
https://your-app.railway.app/api/v1/monitoring/dashboard
```

---

## 🔄 Update Deployment

Just push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Railway auto-deploys! 🎉

---

## 💰 Cost Estimate

- **Backend API (Railway)**: $5-10/month
- **PostgreSQL (Neon)**: Free tier or $0-20/month
- **Worker + Indexer + Redis (local)**: FREE
- **Total**: $5-30/month

---

## 🆘 Need Help?

- Full guide: `RAILWAY_DEPLOYMENT.md`
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

---

**Last Updated**: 2025-11-18
