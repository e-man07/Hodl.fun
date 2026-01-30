# Deployment Procedures

## Pre-Deployment Checklist

- [ ] All tests passing in CI
- [ ] Database migrations tested on staging
- [ ] Environment variables updated if needed
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Maintenance window scheduled (if needed)

## Standard Deployment

### 1. API Service Deployment

```bash
# Build new image
docker build -t hodlfun-api:latest -f Dockerfile.api .

# Tag with version
docker tag hodlfun-api:latest hodlfun-api:v1.2.3

# Push to registry
docker push hodlfun-api:v1.2.3

# Update deployment
kubectl set image deployment/api api=hodlfun-api:v1.2.3

# Verify rollout
kubectl rollout status deployment/api
```

### 2. Database Migration

**IMPORTANT**: Always backup before migrations!

```bash
# Backup current database
pg_dump -h $DB_HOST -U $DB_USER hodlfun > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
pnpm prisma migrate deploy

# Verify migration
pnpm prisma migrate status

# If migration fails, restore:
psql -h $DB_HOST -U $DB_USER hodlfun < backup_YYYYMMDD_HHMMSS.sql
```

### 3. Indexer Deployment

The indexer maintains state in the database. Special care needed:

```bash
# Stop current indexer (prevent duplicate processing)
kubectl scale deployment/indexer --replicas=0

# Wait for clean shutdown
kubectl wait --for=condition=complete deployment/indexer

# Deploy new version
kubectl set image deployment/indexer indexer=hodlfun-indexer:v1.2.3

# Scale back up
kubectl scale deployment/indexer --replicas=1

# Monitor logs for catch-up
kubectl logs -f deployment/indexer
```

### 4. Worker Deployment

Workers process background jobs. Ensure graceful shutdown:

```bash
# Deploy with rolling update
kubectl set image deployment/worker worker=hodlfun-worker:v1.2.3

# Monitor for stuck jobs
redis-cli LLEN bull:portfolio-update:wait
redis-cli LLEN bull:metrics:wait
```

### 5. WebSocket Deployment

WebSocket connections need graceful handling:

```bash
# Enable maintenance mode (optional)
kubectl annotate service websocket maintenance=true

# Deploy new version
kubectl set image deployment/websocket websocket=hodlfun-websocket:v1.2.3

# Clients will auto-reconnect
# Monitor connection count
curl http://localhost:3001/metrics | grep websocket_connections
```

## Rollback Procedures

### Quick Rollback (Kubernetes)

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/api

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=3

# Check rollback status
kubectl rollout status deployment/api
```

### Database Rollback

```bash
# Revert last migration (if supported)
pnpm prisma migrate reset --skip-seed

# Or restore from backup
psql -h $DB_HOST -U $DB_USER hodlfun < backup_YYYYMMDD_HHMMSS.sql
```

### Docker Rollback (non-K8s)

```bash
# Stop current containers
docker compose down api

# Pull previous version
docker pull hodlfun-api:v1.2.2

# Update docker-compose.yml
# Change image: hodlfun-api:v1.2.3 to hodlfun-api:v1.2.2

# Start previous version
docker compose up -d api
```

## Scaling Procedures

### Horizontal Scaling (API)

```bash
# Scale to 5 replicas
kubectl scale deployment/api --replicas=5

# Or use HPA
kubectl autoscale deployment/api --min=2 --max=10 --cpu-percent=70
```

### Scaling WebSocket

WebSocket servers need sticky sessions:

```bash
# Scale WebSocket pods
kubectl scale deployment/websocket --replicas=3

# Ensure Redis adapter is configured for multi-pod
# (Already configured in websocket.module.ts)
```

### Scaling Workers

```bash
# Add more worker pods
kubectl scale deployment/worker --replicas=5

# Or increase concurrency per worker
# Update WORKER_CONCURRENCY env var
```

### Scaling Database

For PostgreSQL scaling:

1. **Read Replicas** (for read-heavy workloads):
   ```bash
   # Configure replica in connection string
   DATABASE_REPLICA_URL="postgresql://..."
   ```

2. **Connection Pooling** (via PgBouncer):
   ```bash
   # Point app to PgBouncer
   DATABASE_URL="postgresql://localhost:6432/..."
   ```

## Blue-Green Deployment

For zero-downtime deployments:

```bash
# 1. Deploy new version to "green" environment
kubectl apply -f deployment-green.yaml

# 2. Run smoke tests against green
curl http://green.internal/api/v1/health

# 3. Switch traffic to green
kubectl patch service api -p '{"spec":{"selector":{"version":"green"}}}'

# 4. Monitor for issues

# 5. If issues, switch back to blue
kubectl patch service api -p '{"spec":{"selector":{"version":"blue"}}}'

# 6. If successful, clean up blue
kubectl delete deployment api-blue
```

## Canary Deployment

For gradual rollout:

```bash
# Deploy canary with 10% traffic
kubectl apply -f deployment-canary.yaml

# Monitor error rates
# If healthy, increase traffic

# Promote canary to stable
kubectl set image deployment/api api=hodlfun-api:v1.2.3
kubectl delete deployment api-canary
```

## Post-Deployment Verification

### Health Checks

```bash
# API health
curl http://api.hodl.fun/api/v1/health

# Check metrics
curl http://api.hodl.fun/metrics | grep http_requests

# Check indexer sync status
curl http://indexer.hodl.fun/health
```

### Smoke Tests

```bash
# Run smoke test suite
npm run test:smoke

# Or manually verify critical paths:
# 1. Token list loads
curl http://api.hodl.fun/api/v1/tokens

# 2. Single token loads
curl http://api.hodl.fun/api/v1/tokens/0x...

# 3. WebSocket connects
wscat -c ws://ws.hodl.fun/events
```

### Monitoring

- Check Grafana dashboard for anomalies
- Monitor error logs for 15 minutes
- Verify no increase in error rate alerts

## Configuration Updates

### Updating Environment Variables

```bash
# Update ConfigMap
kubectl edit configmap api-config

# Restart deployment to pick up changes
kubectl rollout restart deployment/api

# Or for secrets:
kubectl edit secret api-secrets
kubectl rollout restart deployment/api
```

### Feature Flag Updates

```bash
# Update feature flag in Redis
redis-cli SET feature:new_feature "true"

# Or via API (if implemented)
curl -X POST http://admin.hodl.fun/features/new_feature -d '{"enabled": true}'
```
