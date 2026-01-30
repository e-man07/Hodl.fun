# Phase 9: CI/CD Pipeline

## Objective
Configure GitHub Actions workflows for automated testing, building, and deployment.

## Prerequisites
- Phase 3 completed (GKE, Artifact Registry)
- Phase 4 completed (Core Backend)

## Duration: 2-3 days

---

## 9.1 Docker Configuration

### Multi-Stage Dockerfile

```dockerfile
# docker/backend.Dockerfile

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 1: Base
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8 --activate
WORKDIR /app

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 2: Dependencies
# ═══════════════════════════════════════════════════════════════════════════
FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/websocket/package.json ./apps/websocket/
COPY apps/indexer/package.json ./apps/indexer/
COPY apps/worker/package.json ./apps/worker/
COPY libs/common/package.json ./libs/common/
COPY libs/database/package.json ./libs/database/
COPY libs/redis/package.json ./libs/redis/
RUN pnpm install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 3: Build
# ═══════════════════════════════════════════════════════════════════════════
FROM dependencies AS build
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 4: Production (API)
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS api
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 5: Production (WebSocket)
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS websocket
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/websocket/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 6: Production (Indexer)
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS indexer
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/indexer/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
USER nestjs
EXPOSE 3002
CMD ["node", "dist/main.js"]

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 7: Production (Worker)
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS worker
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/apps/worker/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/libs ./libs
USER nestjs
EXPOSE 3003
CMD ["node", "dist/main.js"]
```

### Docker Ignore

```
# docker/.dockerignore
node_modules
dist
.git
.github
*.md
.env*
coverage
.nyc_output
```

---

## 9.2 GitHub Actions - CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run test:cov

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hodlfun_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm run prisma:migrate:test

      - run: pnpm run test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hodlfun_test
          REDIS_URL: redis://localhost:6379
```

---

## 9.3 GitHub Actions - Build & Deploy

```yaml
# .github/workflows/build.yml
name: Build & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: us-central1
  ARTIFACT_REGISTRY: us-central1-docker.pkg.dev

jobs:
  build:
    name: Build Images
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - run: gcloud auth configure-docker ${{ env.ARTIFACT_REGISTRY }}

      - id: meta
        run: echo "tags=${{ github.sha }}" >> $GITHUB_OUTPUT

      - name: Build and Push API
        run: |
          docker build -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ steps.meta.outputs.tags }} \
            --target api -f docker/backend.Dockerfile .
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ steps.meta.outputs.tags }}

      - name: Build and Push WebSocket
        run: |
          docker build -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ steps.meta.outputs.tags }} \
            --target websocket -f docker/backend.Dockerfile .
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ steps.meta.outputs.tags }}

      - name: Build and Push Indexer
        run: |
          docker build -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ steps.meta.outputs.tags }} \
            --target indexer -f docker/backend.Dockerfile .
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ steps.meta.outputs.tags }}

      - name: Build and Push Worker
        run: |
          docker build -t ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ steps.meta.outputs.tags }} \
            --target worker -f docker/backend.Dockerfile .
          docker push ${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ steps.meta.outputs.tags }}

  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hodlfun-cluster
          location: ${{ env.REGION }}

      - name: Update image tags
        run: |
          cd k8s/overlays/staging
          kustomize edit set image api=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ needs.build.outputs.image_tag }}
          kustomize edit set image websocket=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ needs.build.outputs.image_tag }}
          kustomize edit set image indexer=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ needs.build.outputs.image_tag }}
          kustomize edit set image worker=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ needs.build.outputs.image_tag }}

      - name: Deploy
        run: kubectl apply -k k8s/overlays/staging

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/staging-api -n hodlfun --timeout=300s
          kubectl rollout status deployment/staging-websocket -n hodlfun --timeout=300s
          kubectl rollout status deployment/staging-indexer -n hodlfun --timeout=300s
          kubectl rollout status deployment/staging-worker -n hodlfun --timeout=300s

      - name: Smoke test
        run: |
          STAGING_URL=$(kubectl get ingress -n hodlfun -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}')
          curl -f "http://${STAGING_URL}/api/v1/health/ready" || exit 1

  deploy-production:
    name: Deploy to Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'production'

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hodlfun-cluster
          location: ${{ env.REGION }}

      - name: Update image tags
        run: |
          cd k8s/overlays/production
          kustomize edit set image api=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ needs.build.outputs.image_tag }}
          kustomize edit set image websocket=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ needs.build.outputs.image_tag }}
          kustomize edit set image indexer=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ needs.build.outputs.image_tag }}
          kustomize edit set image worker=${{ env.ARTIFACT_REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ needs.build.outputs.image_tag }}

      - name: Deploy
        run: kubectl apply -k k8s/overlays/production

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/prod-api -n hodlfun --timeout=300s
          kubectl rollout status deployment/prod-websocket -n hodlfun --timeout=300s
          kubectl rollout status deployment/prod-indexer -n hodlfun --timeout=300s
          kubectl rollout status deployment/prod-worker -n hodlfun --timeout=300s
```

---

## 9.4 Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        type: choice
        options:
          - staging
          - production
      service:
        description: 'Service to rollback'
        required: true
        type: choice
        options:
          - all
          - api
          - websocket
          - indexer
          - worker

jobs:
  rollback:
    name: Rollback ${{ inputs.service }} in ${{ inputs.environment }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hodlfun-cluster
          location: us-central1

      - name: Rollback
        run: |
          PREFIX=${{ inputs.environment == 'production' && 'prod' || 'staging' }}
          if [ "${{ inputs.service }}" == "all" ]; then
            kubectl rollout undo deployment/${PREFIX}-api -n hodlfun
            kubectl rollout undo deployment/${PREFIX}-websocket -n hodlfun
            kubectl rollout undo deployment/${PREFIX}-indexer -n hodlfun
            kubectl rollout undo deployment/${PREFIX}-worker -n hodlfun
          else
            kubectl rollout undo deployment/${PREFIX}-${{ inputs.service }} -n hodlfun
          fi

      - name: Wait for rollback
        run: |
          PREFIX=${{ inputs.environment == 'production' && 'prod' || 'staging' }}
          if [ "${{ inputs.service }}" == "all" ]; then
            kubectl rollout status deployment/${PREFIX}-api -n hodlfun
            kubectl rollout status deployment/${PREFIX}-websocket -n hodlfun
            kubectl rollout status deployment/${PREFIX}-indexer -n hodlfun
            kubectl rollout status deployment/${PREFIX}-worker -n hodlfun
          else
            kubectl rollout status deployment/${PREFIX}-${{ inputs.service }} -n hodlfun
          fi
```

---

## 9.5 Verification Checklist

- [ ] CI workflow passes (lint, typecheck, tests)
- [ ] Docker images building successfully
- [ ] Images pushed to Artifact Registry
- [ ] Staging deployment working
- [ ] Production deployment with approval gate
- [ ] Rollback workflow tested
- [ ] Smoke tests passing after deployment

## Testing Commands

```bash
# Trigger CI manually
gh workflow run ci.yml

# Check workflow status
gh run list --workflow=ci.yml

# View deployment logs
gh run view <run-id> --log

# Check image in registry
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/hodlfun
```

## Next Phase
Proceed to **Phase 10: Monitoring** to configure observability.
