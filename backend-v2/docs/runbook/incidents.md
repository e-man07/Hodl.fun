# Incident Response Procedures

## Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Complete service outage | 15 minutes | API down, DB unreachable |
| **P2 - Major** | Significant degradation | 1 hour | High error rate, slow responses |
| **P3 - Minor** | Limited impact | 4 hours | Single endpoint errors |
| **P4 - Low** | Minimal impact | 24 hours | Cosmetic issues |

## Alert Triage Guide

### High Error Rate (> 1%)

**Symptoms:**
- Alert: `http_request_errors_high`
- Error logs increasing
- User reports of failures

**Investigation:**
```bash
# Check error distribution
kubectl logs deployment/api | grep ERROR | tail -100

# Check recent deploys
kubectl rollout history deployment/api

# Check database connectivity
kubectl exec -it deployment/api -- pg_isready -h $DB_HOST

# Check Redis connectivity
kubectl exec -it deployment/api -- redis-cli PING
```

**Resolution:**
1. If recent deploy → Rollback
2. If database issue → See [Database Issues](#database-issues)
3. If Redis issue → See [Redis Issues](#redis-issues)
4. If code bug → Deploy hotfix

### High Latency (p95 > 500ms)

**Symptoms:**
- Alert: `api_latency_high`
- Slow page loads
- Timeout errors

**Investigation:**
```bash
# Check slow queries
kubectl exec -it deployment/postgresql -- psql -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '1 second';"

# Check connection pool
kubectl exec -it deployment/api -- curl localhost:3000/metrics | grep db_pool

# Check Redis latency
redis-cli --latency

# Check CPU/memory
kubectl top pods
```

**Resolution:**
1. Scale API if CPU-bound
2. Optimize slow queries
3. Increase connection pool
4. Add caching

### Indexer Block Lag (> 100 blocks)

**Symptoms:**
- Alert: `indexer_block_lag_critical`
- Stale data on frontend
- Missing recent transactions

**Investigation:**
```bash
# Check indexer logs
kubectl logs deployment/indexer --tail=200

# Check current vs indexed block
kubectl exec -it deployment/indexer -- curl localhost:3002/health

# Check RPC connectivity
kubectl exec -it deployment/indexer -- curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check for processing errors
kubectl logs deployment/indexer | grep -i error | tail -50
```

**Resolution:**
1. If RPC issue → Switch to backup RPC
2. If processing error → Check specific event handler
3. If overloaded → Scale indexer resources
4. Restart indexer if stuck

### WebSocket Connections Spike

**Symptoms:**
- Alert: `websocket_connections_high`
- Memory pressure
- Connection refused errors

**Investigation:**
```bash
# Check connection count
kubectl exec -it deployment/websocket -- curl localhost:3001/metrics \
  | grep websocket_connections

# Check memory usage
kubectl top pods -l app=websocket

# Check for connection leaks
kubectl logs deployment/websocket | grep -i "disconnect" | tail -100
```

**Resolution:**
1. Scale WebSocket pods
2. Check for connection leaks
3. Implement connection limits
4. Review client reconnect logic

## Common Issues and Resolutions

### Database Issues

#### Connection Pool Exhausted

**Symptoms:**
- "too many connections" errors
- Timeouts on DB operations

**Resolution:**
```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
psql -c "SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';"

# Increase pool size (environment variable)
DATABASE_POOL_SIZE=50
```

#### Slow Queries

**Symptoms:**
- High query latency
- Lock contention

**Resolution:**
```bash
# Find slow queries
psql -c "SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;"

# Check for missing indexes
psql -c "SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;"
```

### Redis Issues

#### Memory Full

**Symptoms:**
- OOM errors
- Write failures

**Resolution:**
```bash
# Check memory usage
redis-cli INFO memory

# Clear cache if needed
redis-cli FLUSHDB

# Or selective eviction
redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL

# Increase maxmemory
redis-cli CONFIG SET maxmemory 2gb
```

#### Connection Refused

**Symptoms:**
- Connection errors
- Service degradation

**Resolution:**
```bash
# Check Redis status
redis-cli PING

# Check max connections
redis-cli CONFIG GET maxclients

# Restart Redis if unresponsive
docker compose restart redis
```

### RPC Issues

#### RPC Rate Limited

**Symptoms:**
- 429 errors from RPC
- Indexer falling behind

**Resolution:**
```bash
# Switch to backup RPC
kubectl set env deployment/indexer RPC_URL=$BACKUP_RPC_URL

# Or reduce batch size
kubectl set env deployment/indexer INDEXER_BATCH_SIZE=50
```

#### RPC Unavailable

**Symptoms:**
- Connection refused
- Timeout errors

**Resolution:**
```bash
# Switch to backup RPC immediately
kubectl set env deployment/indexer RPC_URL=$BACKUP_RPC_URL

# Circuit breaker should auto-failover
# Check circuit breaker state
kubectl logs deployment/indexer | grep "circuit"
```

## Escalation Paths

### Level 1 (On-call Engineer)

- Initial triage
- Apply known fixes
- Escalate if unresolved in 30 minutes

### Level 2 (Backend Team)

- Deep investigation
- Code-level debugging
- Coordinate with DevOps

### Level 3 (Engineering Lead)

- Architecture decisions
- Major incident coordination
- External communication

## Incident Template

```markdown
## Incident Report: [Title]

### Summary
Brief description of what happened.

### Timeline (UTC)
- HH:MM - Alert fired
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

### Impact
- Duration: X hours
- Users affected: X%
- Revenue impact: $X

### Root Cause
Technical explanation of what caused the issue.

### Resolution
What was done to fix it.

### Action Items
- [ ] Add monitoring for X
- [ ] Implement circuit breaker for Y
- [ ] Document procedure for Z
```

## Post-Incident Review

After every P1/P2 incident:

1. **Schedule review** within 48 hours
2. **Gather data**:
   - Logs
   - Metrics
   - Timeline
3. **Identify**:
   - Root cause
   - Contributing factors
   - Detection gaps
4. **Document**:
   - What happened
   - Why it happened
   - How to prevent
5. **Create action items** with owners and deadlines
