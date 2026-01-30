# Recovery Procedures

## Database Recovery

### Point-in-Time Recovery (PITR)

PostgreSQL supports point-in-time recovery for precise restoration.

```bash
# 1. Stop the application (prevent new writes)
kubectl scale deployment/api --replicas=0
kubectl scale deployment/indexer --replicas=0
kubectl scale deployment/worker --replicas=0

# 2. Create recovery target
TARGET_TIME="2024-01-15 14:30:00 UTC"

# 3. Restore from backup
pg_restore -h $DB_HOST -U $DB_USER -d hodlfun_restore /backups/latest.dump

# 4. Apply WAL logs up to target time
# (Managed by PostgreSQL configuration)

# 5. Verify data integrity
psql -d hodlfun_restore -c "SELECT COUNT(*) FROM tokens;"
psql -d hodlfun_restore -c "SELECT MAX(created_at) FROM trades;"

# 6. Swap databases
psql -c "ALTER DATABASE hodlfun RENAME TO hodlfun_old;"
psql -c "ALTER DATABASE hodlfun_restore RENAME TO hodlfun;"

# 7. Restart services
kubectl scale deployment/api --replicas=3
kubectl scale deployment/indexer --replicas=1
kubectl scale deployment/worker --replicas=2

# 8. Clean up old database after verification
psql -c "DROP DATABASE hodlfun_old;"
```

### Restore from Daily Backup

```bash
# 1. List available backups
aws s3 ls s3://hodlfun-backups/daily/

# 2. Download backup
aws s3 cp s3://hodlfun-backups/daily/2024-01-15.dump /tmp/restore.dump

# 3. Stop services
kubectl scale deployment/api --replicas=0

# 4. Restore
pg_restore -h $DB_HOST -U $DB_USER -c -d hodlfun /tmp/restore.dump

# 5. Restart services
kubectl scale deployment/api --replicas=3
```

### Table-Level Recovery

For recovering specific tables without full restore:

```bash
# 1. Restore to temporary database
createdb hodlfun_temp
pg_restore -h $DB_HOST -U $DB_USER -d hodlfun_temp /backups/latest.dump

# 2. Copy specific table
pg_dump -h $DB_HOST -U $DB_USER -t tokens hodlfun_temp | \
  psql -h $DB_HOST -U $DB_USER -d hodlfun

# 3. Clean up
dropdb hodlfun_temp
```

## Redis Recovery

### Redis Persistence

Redis is configured with RDB snapshots and AOF logging.

```bash
# Check Redis persistence status
redis-cli INFO persistence

# Force RDB snapshot
redis-cli BGSAVE

# Force AOF rewrite
redis-cli BGREWRITEAOF
```

### Restore from RDB

```bash
# 1. Stop Redis
docker compose stop redis

# 2. Replace dump.rdb with backup
cp /backups/redis/dump.rdb /data/redis/dump.rdb

# 3. Start Redis
docker compose start redis

# 4. Verify restoration
redis-cli DBSIZE
redis-cli KEYS "token:*" | head
```

### Redis Failover (Sentinel)

If using Redis Sentinel for HA:

```bash
# Check sentinel status
redis-cli -p 26379 SENTINEL masters

# Force failover
redis-cli -p 26379 SENTINEL failover mymaster

# Monitor failover
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
```

### Cache Invalidation

After recovery, invalidate stale cache:

```bash
# Clear all cache
redis-cli FLUSHDB

# Or selective invalidation
redis-cli --scan --pattern "token:*" | xargs redis-cli DEL
redis-cli --scan --pattern "user:*" | xargs redis-cli DEL
```

## Service Recovery

### API Service Recovery

```bash
# 1. Check current status
kubectl get pods -l app=api
kubectl describe pods -l app=api

# 2. If pods are crashing, check logs
kubectl logs -l app=api --previous

# 3. Rolling restart
kubectl rollout restart deployment/api

# 4. If restart doesn't help, redeploy
kubectl set image deployment/api api=hodlfun-api:stable

# 5. Verify recovery
curl http://api.hodl.fun/api/v1/health
```

### Indexer Recovery

The indexer maintains state in the database. Recovery involves:

```bash
# 1. Check current block
psql -c "SELECT * FROM indexer_state WHERE id = 'main';"

# 2. Check for stuck processing
kubectl logs deployment/indexer | tail -100

# 3. If stuck, restart indexer
kubectl rollout restart deployment/indexer

# 4. If data is corrupt, reset to known good block
psql -c "UPDATE indexer_state SET last_processed_block = 1000000 WHERE id = 'main';"

# 5. Restart to reindex
kubectl rollout restart deployment/indexer

# 6. Monitor catch-up progress
watch "kubectl logs deployment/indexer | tail -5"
```

### Worker Recovery

```bash
# 1. Check queue status
redis-cli LLEN bull:portfolio-update:wait
redis-cli LLEN bull:portfolio-update:active
redis-cli LLEN bull:portfolio-update:failed

# 2. Clear failed jobs (if needed)
redis-cli DEL bull:portfolio-update:failed

# 3. Retry failed jobs
# Via Bull Board: http://api.hodl.fun/admin/queues

# 4. Restart workers
kubectl rollout restart deployment/worker
```

### WebSocket Recovery

```bash
# 1. Check connection count
kubectl exec -it deployment/websocket -- curl localhost:3001/metrics \
  | grep connections

# 2. Check for errors
kubectl logs deployment/websocket | grep -i error

# 3. Graceful restart (clients auto-reconnect)
kubectl rollout restart deployment/websocket

# 4. Monitor reconnections
kubectl logs -f deployment/websocket | grep "connected"
```

## Full System Recovery

### Complete Disaster Recovery

For catastrophic failures requiring full system rebuild:

```bash
# 1. Provision infrastructure
terraform apply -target=aws_rds_instance.main
terraform apply -target=aws_elasticache_cluster.main
terraform apply -target=aws_eks_cluster.main

# 2. Restore database
pg_restore -h $NEW_DB_HOST -U $DB_USER -d hodlfun /backups/latest.dump

# 3. Configure services
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/

# 4. Deploy services
kubectl apply -f k8s/deployments/

# 5. Warm cache
redis-cli FLUSHALL
# Let indexer populate cache

# 6. Verify all services
./scripts/healthcheck-all.sh

# 7. Update DNS
aws route53 change-resource-record-sets ...
```

### Recovery Verification Checklist

- [ ] Database accessible and data integrity verified
- [ ] Redis connected and responding
- [ ] API health check passing
- [ ] WebSocket connections working
- [ ] Indexer syncing blocks
- [ ] Workers processing jobs
- [ ] Frontend loads correctly
- [ ] Critical user flows working
- [ ] Monitoring and alerting active

## Backup Procedures

### Automated Backups

Backups are automated via cron:

```bash
# /etc/cron.d/hodlfun-backup

# Database backup - every 6 hours
0 */6 * * * postgres pg_dump hodlfun | gzip > /backups/db/hodlfun_$(date +\%Y\%m\%d_\%H).sql.gz

# Upload to S3
0 */6 * * * root aws s3 cp /backups/db/hodlfun_*.sql.gz s3://hodlfun-backups/db/

# Redis backup - every hour
0 * * * * redis redis-cli BGSAVE

# Clean old backups - keep 7 days
0 0 * * * root find /backups -mtime +7 -delete
```

### Manual Backup

```bash
# Database
pg_dump -h $DB_HOST -U $DB_USER -F c hodlfun > backup_$(date +%Y%m%d_%H%M%S).dump

# Redis
redis-cli BGSAVE
cp /data/redis/dump.rdb backup_redis_$(date +%Y%m%d_%H%M%S).rdb
```

### Backup Verification

Monthly backup verification:

```bash
# 1. Create test database
createdb hodlfun_test

# 2. Restore backup
pg_restore -d hodlfun_test /backups/latest.dump

# 3. Verify data
psql -d hodlfun_test -c "SELECT COUNT(*) FROM tokens;"
psql -d hodlfun_test -c "SELECT COUNT(*) FROM trades;"

# 4. Clean up
dropdb hodlfun_test
```

## Emergency Contacts

| Service | Provider | Support Contact |
|---------|----------|-----------------|
| AWS | Amazon | AWS Support Console |
| Database | RDS | AWS Support |
| Redis | ElastiCache | AWS Support |
| DNS | Route53 | AWS Support |
| Monitoring | Datadog/Grafana | support@provider.com |
