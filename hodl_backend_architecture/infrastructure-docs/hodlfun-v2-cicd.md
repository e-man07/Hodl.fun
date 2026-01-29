# Hodl.fun V2 - CI/CD Pipeline

## Table of Contents
1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Repository Structure](#repository-structure)
4. [Docker Configuration](#docker-configuration)
5. [GitHub Actions Workflows](#github-actions-workflows)
6. [Environment Management](#environment-management)
7. [Build Process](#build-process)
8. [Deployment Process](#deployment-process)
9. [Rollback Procedures](#rollback-procedures)
10. [Secrets Management](#secrets-management)
11. [Testing in Pipeline](#testing-in-pipeline)
12. [Monitoring Deployments](#monitoring-deployments)
13. [Best Practices](#best-practices)

---

## Overview

### What This Document Covers

This document details the complete CI/CD pipeline - from code push to production deployment, including Docker builds, testing, and Kubernetes deployments.

### Pipeline Goals

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD GOALS                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. AUTOMATION
─────────────────────────────────────────────────────────────────────────────
   - No manual deployment steps
   - Consistent, repeatable process
   - Reduce human error


2. SPEED
─────────────────────────────────────────────────────────────────────────────
   - Fast feedback on PRs (< 5 min for tests)
   - Quick deployments (< 10 min to production)
   - Parallel builds where possible


3. SAFETY
─────────────────────────────────────────────────────────────────────────────
   - Tests must pass before deploy
   - Staging environment for validation
   - Easy rollback mechanism


4. VISIBILITY
─────────────────────────────────────────────────────────────────────────────
   - Clear deployment status
   - Audit trail of changes
   - Notifications on success/failure
```

---

## Pipeline Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PIPELINE FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

    Developer                GitHub                    GCP
        │                      │                        │
        │  Push/PR             │                        │
        │─────────────────────►│                        │
        │                      │                        │
        │                      │  Trigger Workflow      │
        │                      │                        │
        │              ┌───────┴───────┐                │
        │              │               │                │
        │              ▼               ▼                │
        │         ┌────────┐     ┌────────┐             │
        │         │  Lint  │     │  Test  │             │
        │         └────┬───┘     └────┬───┘             │
        │              │              │                 │
        │              └──────┬───────┘                 │
        │                     │                         │
        │                     ▼                         │
        │              ┌────────────┐                   │
        │              │   Build    │                   │
        │              │   Docker   │                   │
        │              └──────┬─────┘                   │
        │                     │                         │
        │                     │  Push Image             │
        │                     │─────────────────────────►
        │                     │                         │
        │                     │                   ┌─────┴─────┐
        │                     │                   │  Artifact │
        │                     │                   │  Registry │
        │                     │                   └─────┬─────┘
        │                     │                         │
        │                     │  Deploy to Staging      │
        │                     │─────────────────────────►
        │                     │                         │
        │                     │                   ┌─────┴─────┐
        │                     │                   │    GKE    │
        │                     │                   │  Staging  │
        │                     │                   └─────┬─────┘
        │                     │                         │
        │              ┌──────┴──────┐                  │
        │              │   Manual    │                  │
        │              │  Approval   │                  │
        │              └──────┬──────┘                  │
        │                     │                         │
        │                     │  Deploy to Production   │
        │                     │─────────────────────────►
        │                     │                         │
        │                     │                   ┌─────┴─────┐
        │                     │                   │    GKE    │
        │                     │                   │Production │
        │                     │                   └───────────┘
        │                     │                         │
```

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE STAGES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

STAGE 1: CODE QUALITY (On every push/PR)
═══════════════════════════════════════════════════════════════════════════════

  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
  │  Lint   │   │  Type   │   │  Unit   │   │  E2E    │
  │ ESLint  │   │  Check  │   │  Tests  │   │  Tests  │
  │ Prettier│   │   TSC   │   │  Jest   │   │ (Basic) │
  └─────────┘   └─────────┘   └─────────┘   └─────────┘
       │             │             │             │
       └─────────────┴─────────────┴─────────────┘
                           │
                    All must pass
                           │
                           ▼


STAGE 2: BUILD (On merge to main/release branches)
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────┐
  │                        Build Matrix                          │
  │                                                              │
  │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐     │
  │   │   API   │   │   WS    │   │ Indexer │   │ Worker  │     │
  │   │ Docker  │   │ Docker  │   │ Docker  │   │ Docker  │     │
  │   └─────────┘   └─────────┘   └─────────┘   └─────────┘     │
  │        │             │             │             │          │
  │        └─────────────┴─────────────┴─────────────┘          │
  │                           │                                  │
  │                    Push to Artifact Registry                 │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘


STAGE 3: DEPLOY STAGING (Automatic on main)
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │   1. Update image tags in staging                            │
  │   2. Apply Kubernetes manifests                              │
  │   3. Wait for rollout complete                               │
  │   4. Run smoke tests                                         │
  │   5. Notify Slack                                            │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘


STAGE 4: DEPLOY PRODUCTION (Manual approval)
═══════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │   1. Require approval from team lead                         │
  │   2. Update image tags in production                         │
  │   3. Rolling deployment (zero downtime)                      │
  │   4. Run smoke tests                                         │
  │   5. Monitor error rates                                     │
  │   6. Notify Slack                                            │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

### Monorepo Structure

```
hodlfun-v2-backend/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint, test on PRs
│   │   ├── build.yml                 # Build Docker images
│   │   ├── deploy-staging.yml        # Deploy to staging
│   │   ├── deploy-production.yml     # Deploy to production
│   │   └── rollback.yml              # Manual rollback
│   │
│   ├── actions/
│   │   ├── setup-node/
│   │   │   └── action.yml            # Reusable Node setup
│   │   ├── setup-gcloud/
│   │   │   └── action.yml            # Reusable GCloud setup
│   │   └── notify-slack/
│   │       └── action.yml            # Reusable Slack notification
│   │
│   └── CODEOWNERS                    # Required reviewers
│
├── docker/
│   ├── api.Dockerfile
│   ├── websocket.Dockerfile
│   ├── indexer.Dockerfile
│   ├── worker.Dockerfile
│   └── .dockerignore
│
├── k8s/
│   ├── base/                         # Base Kubernetes manifests
│   │   ├── kustomization.yaml
│   │   ├── namespace.yaml
│   │   ├── configmap.yaml
│   │   ├── api/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── hpa.yaml
│   │   ├── websocket/
│   │   ├── indexer/
│   │   └── worker/
│   │
│   ├── overlays/
│   │   ├── staging/                  # Staging-specific config
│   │   │   ├── kustomization.yaml
│   │   │   ├── configmap-patch.yaml
│   │   │   └── replicas-patch.yaml
│   │   │
│   │   └── production/               # Production-specific config
│   │       ├── kustomization.yaml
│   │       ├── configmap-patch.yaml
│   │       └── replicas-patch.yaml
│   │
│   └── ingress/
│       ├── ingress.yaml
│       └── managed-certificate.yaml
│
├── apps/
│   ├── api/                          # API service
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── websocket/                    # WebSocket service
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── indexer/                      # Indexer service
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   │
│   └── worker/                       # Worker service
│       ├── src/
│       ├── test/
│       └── package.json
│
├── libs/                             # Shared libraries
│   ├── common/
│   ├── database/
│   └── redis/
│
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml               # PNPM workspace config
├── turbo.json                        # Turborepo config
└── tsconfig.base.json                # Base TypeScript config
```

### Branch Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BRANCH STRATEGY                                    │
└─────────────────────────────────────────────────────────────────────────────┘

BRANCHES
═══════════════════════════════════════════════════════════════════════════════

main
  │
  │   Production-ready code
  │   Auto-deploys to staging
  │   Manual approval for production
  │
  ├── feature/add-price-alerts
  │     └── Developer feature branches
  │         Merge via PR with required reviews
  │
  ├── feature/websocket-improvements
  │
  ├── fix/rate-limit-bug
  │     └── Bug fix branches
  │
  └── release/v1.2.0
        └── Release branches (optional)
            For coordinated releases


FLOW
═══════════════════════════════════════════════════════════════════════════════

1. Developer creates feature branch from main
   git checkout -b feature/my-feature

2. Developer pushes, creates PR
   - CI runs (lint, test)
   - Requires approval

3. PR merged to main
   - Build Docker images
   - Auto-deploy to staging

4. Manual approval for production
   - Deploy to production
   - Monitor

5. If issues, rollback
   - Revert PR or
   - Deploy previous version
```

---

## Docker Configuration

### Multi-Stage Dockerfile (API Example)

```dockerfile
# docker/api.Dockerfile

# ═══════════════════════════════════════════════════════════════════════════
# STAGE 1: Base image with dependencies
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace
COPY apps/api/package.json ./apps/api/
COPY libs/common/package.json ./libs/common/
COPY libs/database/package.json ./libs/database/
COPY libs/redis/package.json ./libs/redis/


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 2: Install dependencies
# ═══════════════════════════════════════════════════════════════════════════
FROM base AS dependencies

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 3: Build
# ═══════════════════════════════════════════════════════════════════════════
FROM dependencies AS build

# Copy source code
COPY apps/api ./apps/api
COPY libs ./libs
COPY tsconfig.base.json ./

# Build the API
RUN pnpm --filter api build

# Prune devDependencies
RUN pnpm prune --prod


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 4: Production image
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS production

# Security: Don't run as root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./

# Set user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/ready || exit 1

# Start
CMD ["node", "dist/main.js"]
```

### Dockerfile Variants

```dockerfile
# docker/websocket.Dockerfile
# Similar structure, different port (3001)

FROM node:20-alpine AS production
# ... (same build stages)
EXPOSE 3001
CMD ["node", "dist/main.js"]


# docker/indexer.Dockerfile
# No EXPOSE needed (no incoming traffic)

FROM node:20-alpine AS production
# ... (same build stages)
# No health check endpoint needed externally
CMD ["node", "dist/main.js"]


# docker/worker.Dockerfile
# No EXPOSE needed (no incoming traffic)

FROM node:20-alpine AS production
# ... (same build stages)
CMD ["node", "dist/main.js"]
```

### Docker Ignore

```dockerignore
# docker/.dockerignore

# Dependencies
**/node_modules

# Build outputs
**/dist
**/.turbo

# Development
**/.env*
**/*.log
**/coverage
**/.nyc_output

# IDE
**/.idea
**/.vscode
**/*.swp

# Git
.git
.gitignore

# Docker
**/Dockerfile*
**/docker-compose*

# Documentation
**/*.md
**/docs

# Tests
**/__tests__
**/*.test.ts
**/*.spec.ts
**/jest.config.*
```

### Docker Compose (Local Development)

```yaml
# docker-compose.yml (for local development only)

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: hodlfun
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: hodlfun
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis

  websocket:
    build:
      context: .
      dockerfile: docker/websocket.Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - REDIS_HOST=redis
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## GitHub Actions Workflows

### CI Workflow (Lint & Test)

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ═══════════════════════════════════════════════════════════════════════
  # LINT
  # ═══════════════════════════════════════════════════════════════════════
  lint:
    name: Lint
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run Prettier check
        run: pnpm format:check

  # ═══════════════════════════════════════════════════════════════════════
  # TYPE CHECK
  # ═══════════════════════════════════════════════════════════════════════
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run TypeScript compiler
        run: pnpm typecheck

  # ═══════════════════════════════════════════════════════════════════════
  # UNIT TESTS
  # ═══════════════════════════════════════════════════════════════════════
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  # ═══════════════════════════════════════════════════════════════════════
  # E2E TESTS (Optional, on PRs to main)
  # ═══════════════════════════════════════════════════════════════════════
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: test
          DB_PASSWORD: test
          DB_NAME: test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
```

### Build Workflow

```yaml
# .github/workflows/build.yml

name: Build

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to build (all, api, websocket, indexer, worker)'
        required: false
        default: 'all'

env:
  PROJECT_ID: hodlfun-prod
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  # ═══════════════════════════════════════════════════════════════════════
  # DETERMINE CHANGED SERVICES
  # ═══════════════════════════════════════════════════════════════════════
  changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      websocket: ${{ steps.filter.outputs.websocket }}
      indexer: ${{ steps.filter.outputs.indexer }}
      worker: ${{ steps.filter.outputs.worker }}
      libs: ${{ steps.filter.outputs.libs }}
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Detect changes
        uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
              - 'docker/api.Dockerfile'
            websocket:
              - 'apps/websocket/**'
              - 'docker/websocket.Dockerfile'
            indexer:
              - 'apps/indexer/**'
              - 'docker/indexer.Dockerfile'
            worker:
              - 'apps/worker/**'
              - 'docker/worker.Dockerfile'
            libs:
              - 'libs/**'
              - 'package.json'
              - 'pnpm-lock.yaml'

  # ═══════════════════════════════════════════════════════════════════════
  # BUILD API
  # ═══════════════════════════════════════════════════════════════════════
  build-api:
    name: Build API
    runs-on: ubuntu-latest
    needs: changes
    if: |
      needs.changes.outputs.api == 'true' || 
      needs.changes.outputs.libs == 'true' ||
      github.event.inputs.service == 'all' ||
      github.event.inputs.service == 'api'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/api.Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:latest
          cache-to: type=inline

  # ═══════════════════════════════════════════════════════════════════════
  # BUILD WEBSOCKET
  # ═══════════════════════════════════════════════════════════════════════
  build-websocket:
    name: Build WebSocket
    runs-on: ubuntu-latest
    needs: changes
    if: |
      needs.changes.outputs.websocket == 'true' || 
      needs.changes.outputs.libs == 'true' ||
      github.event.inputs.service == 'all' ||
      github.event.inputs.service == 'websocket'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/websocket.Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:latest
          cache-to: type=inline

  # ═══════════════════════════════════════════════════════════════════════
  # BUILD INDEXER
  # ═══════════════════════════════════════════════════════════════════════
  build-indexer:
    name: Build Indexer
    runs-on: ubuntu-latest
    needs: changes
    if: |
      needs.changes.outputs.indexer == 'true' || 
      needs.changes.outputs.libs == 'true' ||
      github.event.inputs.service == 'all' ||
      github.event.inputs.service == 'indexer'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/indexer.Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:latest
          cache-to: type=inline

  # ═══════════════════════════════════════════════════════════════════════
  # BUILD WORKER
  # ═══════════════════════════════════════════════════════════════════════
  build-worker:
    name: Build Worker
    runs-on: ubuntu-latest
    needs: changes
    if: |
      needs.changes.outputs.worker == 'true' || 
      needs.changes.outputs.libs == 'true' ||
      github.event.inputs.service == 'all' ||
      github.event.inputs.service == 'worker'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/worker.Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:latest
          cache-to: type=inline

  # ═══════════════════════════════════════════════════════════════════════
  # TRIGGER STAGING DEPLOYMENT
  # ═══════════════════════════════════════════════════════════════════════
  trigger-staging:
    name: Trigger Staging Deploy
    runs-on: ubuntu-latest
    needs: [build-api, build-websocket, build-indexer, build-worker]
    if: always() && !failure() && !cancelled()
    
    steps:
      - name: Trigger staging deployment
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          event-type: deploy-staging
          client-payload: '{"sha": "${{ github.sha }}"}'
```

### Deploy Staging Workflow

```yaml
# .github/workflows/deploy-staging.yml

name: Deploy Staging

on:
  repository_dispatch:
    types: [deploy-staging]
  workflow_dispatch:
    inputs:
      sha:
        description: 'Commit SHA to deploy'
        required: true

env:
  PROJECT_ID: hodlfun-prod
  REGION: us-central1
  CLUSTER_NAME: hodlfun-staging
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get SHA
        id: sha
        run: |
          if [ "${{ github.event_name }}" == "repository_dispatch" ]; then
            echo "sha=${{ github.event.client_payload.sha }}" >> $GITHUB_OUTPUT
          else
            echo "sha=${{ github.event.inputs.sha }}" >> $GITHUB_OUTPUT
          fi

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v1
        with:
          cluster_name: ${{ env.CLUSTER_NAME }}
          location: ${{ env.REGION }}

      - name: Setup Kustomize
        uses: imranismail/setup-kustomize@v2

      - name: Update image tags
        run: |
          cd k8s/overlays/staging
          kustomize edit set image \
            api=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ steps.sha.outputs.sha }} \
            websocket=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ steps.sha.outputs.sha }} \
            indexer=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ steps.sha.outputs.sha }} \
            worker=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ steps.sha.outputs.sha }}

      - name: Deploy to staging
        run: |
          kustomize build k8s/overlays/staging | kubectl apply -f -

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/api-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/websocket-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/indexer-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/worker-deployment -n hodlfun --timeout=300s

      - name: Run smoke tests
        run: |
          STAGING_URL="https://staging-api.hodlfun.io"
          
          # Health check
          curl -f "${STAGING_URL}/health/ready" || exit 1
          
          # API check
          curl -f "${STAGING_URL}/api/v1/tokens?limit=1" || exit 1
          
          echo "Smoke tests passed!"

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ job.status == 'success' && '✅' || '❌' }} Staging deployment ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "${{ job.status == 'success' && '✅' || '❌' }} *Staging Deployment ${{ job.status }}*\n\n*Commit:* `${{ steps.sha.outputs.sha }}`\n*Actor:* ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deploy Production Workflow

```yaml
# .github/workflows/deploy-production.yml

name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      sha:
        description: 'Commit SHA to deploy (must be deployed to staging first)'
        required: true
      confirm:
        description: 'Type "deploy-production" to confirm'
        required: true

env:
  PROJECT_ID: hodlfun-prod
  REGION: us-central1
  CLUSTER_NAME: hodlfun-production
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  # ═══════════════════════════════════════════════════════════════════════
  # VALIDATE
  # ═══════════════════════════════════════════════════════════════════════
  validate:
    name: Validate
    runs-on: ubuntu-latest
    
    steps:
      - name: Validate confirmation
        if: github.event.inputs.confirm != 'deploy-production'
        run: |
          echo "❌ Confirmation failed. Please type 'deploy-production' to confirm."
          exit 1

      - name: Validate SHA exists in registry
        run: |
          # Would check if images exist in Artifact Registry
          echo "Validating SHA: ${{ github.event.inputs.sha }}"

  # ═══════════════════════════════════════════════════════════════════════
  # DEPLOY
  # ═══════════════════════════════════════════════════════════════════════
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: validate
    environment: production  # Requires approval
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v1
        with:
          cluster_name: ${{ env.CLUSTER_NAME }}
          location: ${{ env.REGION }}

      - name: Setup Kustomize
        uses: imranismail/setup-kustomize@v2

      - name: Update image tags
        run: |
          cd k8s/overlays/production
          kustomize edit set image \
            api=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ github.event.inputs.sha }} \
            websocket=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ github.event.inputs.sha }} \
            indexer=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ github.event.inputs.sha }} \
            worker=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ github.event.inputs.sha }}

      - name: Deploy to production
        run: |
          kustomize build k8s/overlays/production | kubectl apply -f -

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/api-deployment -n hodlfun --timeout=600s
          kubectl rollout status deployment/websocket-deployment -n hodlfun --timeout=600s
          kubectl rollout status deployment/indexer-deployment -n hodlfun --timeout=600s
          kubectl rollout status deployment/worker-deployment -n hodlfun --timeout=600s

      - name: Run smoke tests
        run: |
          PROD_URL="https://api.hodlfun.io"
          
          # Health check
          curl -f "${PROD_URL}/health/ready" || exit 1
          
          # API check
          curl -f "${PROD_URL}/api/v1/tokens?limit=1" || exit 1
          
          echo "Smoke tests passed!"

      - name: Create deployment record
        run: |
          echo "Recording deployment..."
          # Could write to a database or create a GitHub deployment

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ job.status == 'success' && '🚀' || '❌' }} Production deployment ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "${{ job.status == 'success' && '🚀' || '❌' }} *Production Deployment ${{ job.status }}*\n\n*Commit:* `${{ github.event.inputs.sha }}`\n*Deployed by:* ${{ github.actor }}\n*Time:* ${{ github.event.head_commit.timestamp }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Rollback Workflow

```yaml
# .github/workflows/rollback.yml

name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options:
          - staging
          - production
      sha:
        description: 'Commit SHA to rollback to'
        required: true
      confirm:
        description: 'Type "rollback" to confirm'
        required: true

env:
  PROJECT_ID: hodlfun-prod
  REGION: us-central1
  REGISTRY: us-central1-docker.pkg.dev

jobs:
  rollback:
    name: Rollback ${{ github.event.inputs.environment }}
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
      - name: Validate confirmation
        if: github.event.inputs.confirm != 'rollback'
        run: |
          echo "❌ Confirmation failed. Please type 'rollback' to confirm."
          exit 1

      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v1
        with:
          cluster_name: hodlfun-${{ github.event.inputs.environment }}
          location: ${{ env.REGION }}

      - name: Setup Kustomize
        uses: imranismail/setup-kustomize@v2

      - name: Rollback
        run: |
          cd k8s/overlays/${{ github.event.inputs.environment }}
          kustomize edit set image \
            api=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/api:${{ github.event.inputs.sha }} \
            websocket=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/websocket:${{ github.event.inputs.sha }} \
            indexer=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/indexer:${{ github.event.inputs.sha }} \
            worker=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/hodlfun/worker:${{ github.event.inputs.sha }}
          
          kustomize build . | kubectl apply -f -

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/api-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/websocket-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/indexer-deployment -n hodlfun --timeout=300s
          kubectl rollout status deployment/worker-deployment -n hodlfun --timeout=300s

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "⚠️ Rollback completed on ${{ github.event.inputs.environment }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "⚠️ *Rollback Completed*\n\n*Environment:* ${{ github.event.inputs.environment }}\n*Rolled back to:* `${{ github.event.inputs.sha }}`\n*Initiated by:* ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Environment Management

### Kustomize Structure

```yaml
# k8s/base/kustomization.yaml

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - namespace.yaml
  - configmap.yaml
  - api/deployment.yaml
  - api/service.yaml
  - api/hpa.yaml
  - websocket/deployment.yaml
  - websocket/service.yaml
  - websocket/hpa.yaml
  - indexer/deployment.yaml
  - worker/deployment.yaml
  - worker/hpa.yaml

images:
  - name: api
    newName: us-central1-docker.pkg.dev/hodlfun-prod/hodlfun/api
  - name: websocket
    newName: us-central1-docker.pkg.dev/hodlfun-prod/hodlfun/websocket
  - name: indexer
    newName: us-central1-docker.pkg.dev/hodlfun-prod/hodlfun/indexer
  - name: worker
    newName: us-central1-docker.pkg.dev/hodlfun-prod/hodlfun/worker
```

```yaml
# k8s/overlays/staging/kustomization.yaml

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - ../../base

# Staging-specific patches
patches:
  - path: configmap-patch.yaml
  - path: replicas-patch.yaml

# Override config for staging
configMapGenerator:
  - name: hodlfun-config
    behavior: merge
    literals:
      - NODE_ENV=staging
      - LOG_LEVEL=debug
      - DB_HOST=10.10.0.3  # Staging DB
      - REDIS_HOST=10.10.0.5  # Staging Redis
```

```yaml
# k8s/overlays/staging/replicas-patch.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 1  # Lower replicas for staging
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-deployment
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: indexer-deployment
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-deployment
spec:
  replicas: 1
```

```yaml
# k8s/overlays/production/kustomization.yaml

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hodlfun

resources:
  - ../../base

patches:
  - path: configmap-patch.yaml
  - path: replicas-patch.yaml

configMapGenerator:
  - name: hodlfun-config
    behavior: merge
    literals:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - DB_HOST=10.20.0.3  # Production DB
      - REDIS_HOST=10.20.0.5  # Production Redis
```

```yaml
# k8s/overlays/production/replicas-patch.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deployment
spec:
  replicas: 3  # Higher replicas for production
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-deployment
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: indexer-deployment
spec:
  replicas: 2  # Leader/standby
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-deployment
spec:
  replicas: 2
```

### Environment Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT COMPARISON                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                        STAGING              PRODUCTION
═══════════════════════════════════════════════════════════════════════════════

CLUSTER
─────────────────────────────────────────────────────────────────────────────
Name                    hodlfun-staging      hodlfun-production
Node type               e2-medium            e2-standard-2
Autopilot               Yes                  Yes

REPLICAS
─────────────────────────────────────────────────────────────────────────────
API                     1                    3
WebSocket               1                    3
Indexer                 1                    2
Worker                  1                    2

DATABASE
─────────────────────────────────────────────────────────────────────────────
Instance                hodlfun-db-staging   hodlfun-db-production
Tier                    db-custom-1-3840     db-custom-2-8192
HA                      No                   Yes

REDIS
─────────────────────────────────────────────────────────────────────────────
Instance                hodlfun-redis-stg    hodlfun-redis-prod
Memory                  1 GB                 5 GB
Tier                    Basic                Standard (HA)

DOMAIN
─────────────────────────────────────────────────────────────────────────────
API                     staging-api.hodlfun.io  api.hodlfun.io
WebSocket               staging-api.hodlfun.io  api.hodlfun.io

DEPLOYMENT
─────────────────────────────────────────────────────────────────────────────
Trigger                 Auto on main         Manual approval
Approval required       No                   Yes (environment protection)
```

---

## Build Process

### Build Optimization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUILD OPTIMIZATION STRATEGIES                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. DOCKER LAYER CACHING
═══════════════════════════════════════════════════════════════════════════════

Order Dockerfile commands from least to most frequently changed:

  ┌─────────────────────────────────────────────────────────────────────┐
  │ FROM node:20-alpine                    # Rarely changes            │
  │ WORKDIR /app                           # Never changes             │
  │ COPY package.json pnpm-lock.yaml ./    # Changes when deps change  │
  │ RUN pnpm install                       # Cached if deps unchanged  │
  │ COPY . .                               # Changes on every commit   │
  │ RUN pnpm build                         # Must rebuild              │
  └─────────────────────────────────────────────────────────────────────┘

Result: If only source changes, layers 1-4 are cached!


2. MULTI-STAGE BUILDS
═══════════════════════════════════════════════════════════════════════════════

  Stage 1: Install all deps (including devDeps) → Build
  Stage 2: Copy only production deps + built code

  Result: Smaller final image (no devDeps, no source)


3. PARALLEL BUILDS
═══════════════════════════════════════════════════════════════════════════════

  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │   API   │  │   WS    │  │ Indexer │  │ Worker  │
  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
       │            │            │            │
       └────────────┴────────────┴────────────┘
                         │
                    All in parallel
                         │
                         ▼
                    ~3 min total
                   (not 12 min sequential)


4. INCREMENTAL BUILDS
═══════════════════════════════════════════════════════════════════════════════

Only build services that changed:

  - PR changes apps/api/ → Only build API
  - PR changes libs/ → Build all (shared dependency)
  - PR changes docs/ → Build nothing
```

### Build Times

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXPECTED BUILD TIMES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

COLD BUILD (No cache):
─────────────────────────────────────────────────────────────────────────────
  Install deps:         ~90 seconds
  Build TypeScript:     ~60 seconds
  Docker build:         ~60 seconds
  Push to registry:     ~30 seconds
  ─────────────────────────────────────
  Total per service:    ~4 minutes
  Total parallel:       ~4 minutes


WARM BUILD (With cache):
─────────────────────────────────────────────────────────────────────────────
  Install deps:         ~15 seconds (cached)
  Build TypeScript:     ~30 seconds (partial)
  Docker build:         ~20 seconds (layers cached)
  Push to registry:     ~10 seconds (layers exist)
  ─────────────────────────────────────
  Total per service:    ~75 seconds
  Total parallel:       ~75 seconds
```

---

## Deployment Process

### Rolling Update

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLLING UPDATE PROCESS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Kubernetes deployment strategy:
─────────────────────────────────────────────────────────────────────────────

spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # Never reduce below desired replicas
      maxSurge: 1          # Add one pod at a time


Timeline (3 replicas):
─────────────────────────────────────────────────────────────────────────────

T=0    [v1] [v1] [v1]           Current state
       
T=1    [v1] [v1] [v1] [v2]      New pod creating (surge)
       
T=2    [v1] [v1] [v1] [v2✓]    New pod ready
       
T=3    [v1] [v1] [v2✓]         Old pod terminating
       
T=4    [v1] [v1] [v2✓] [v2]    Another new pod creating
       
T=5    [v1] [v1] [v2✓] [v2✓]   New pod ready
       
T=6    [v1] [v2✓] [v2✓]        Old pod terminating
       
...continues until all pods are v2...

T=12   [v2✓] [v2✓] [v2✓]       Complete!


Zero downtime because:
- At least 3 pods always ready
- Load balancer only routes to ready pods
- Graceful shutdown allows in-flight requests to complete
```

### Deployment Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKLIST                                      │
└─────────────────────────────────────────────────────────────────────────────┘

PRE-DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════

□ All tests passing in CI
□ Code reviewed and approved
□ Staging deployment successful
□ Smoke tests passing on staging
□ No critical alerts on staging
□ Database migrations applied (if any)
□ Feature flags configured (if any)


DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════

□ Approval from team lead (production only)
□ Deployment initiated
□ Rollout status monitored
□ All pods healthy
□ Smoke tests passing


POST-DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════

□ Error rates normal
□ Latency normal
□ No increase in 5xx errors
□ WebSocket connections stable
□ Indexer processing blocks
□ Worker processing jobs
□ Slack notification sent


IF ISSUES DETECTED
═══════════════════════════════════════════════════════════════════════════════

□ Assess severity
□ If critical: Initiate rollback immediately
□ If minor: Create hotfix PR
□ Document incident
□ Post-mortem if needed
```

---

## Rollback Procedures

### Rollback Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLLBACK OPTIONS                                          │
└─────────────────────────────────────────────────────────────────────────────┘

OPTION 1: KUBERNETES ROLLBACK (Fastest)
═══════════════════════════════════════════════════════════════════════════════

Time: ~30 seconds
Command: kubectl rollout undo deployment/api-deployment

Pros:
  - Instant
  - No CI/CD needed
  - Works offline

Cons:
  - Only rolls back one revision
  - Must do for each deployment
  - No audit trail in CI


OPTION 2: REDEPLOY PREVIOUS SHA (Recommended)
═══════════════════════════════════════════════════════════════════════════════

Time: ~2-3 minutes
Method: Trigger rollback workflow with previous SHA

Pros:
  - Full audit trail
  - Can rollback to any version
  - Consistent process

Cons:
  - Slightly slower
  - Requires CI access


OPTION 3: REVERT PR (If issue is code)
═══════════════════════════════════════════════════════════════════════════════

Time: ~5-10 minutes
Method: Create revert PR, merge, auto-deploy

Pros:
  - Creates clear history
  - Code is reverted in repo
  
Cons:
  - Slowest option
  - Extra PR/review overhead
```

### Quick Rollback Commands

```bash
# ═══════════════════════════════════════════════════════════════════════════
# EMERGENCY ROLLBACK (kubectl)
# ═══════════════════════════════════════════════════════════════════════════

# Rollback API to previous version
kubectl rollout undo deployment/api-deployment -n hodlfun

# Rollback all services
kubectl rollout undo deployment/api-deployment -n hodlfun
kubectl rollout undo deployment/websocket-deployment -n hodlfun
kubectl rollout undo deployment/indexer-deployment -n hodlfun
kubectl rollout undo deployment/worker-deployment -n hodlfun

# Check rollout status
kubectl rollout status deployment/api-deployment -n hodlfun

# View rollout history
kubectl rollout history deployment/api-deployment -n hodlfun

# Rollback to specific revision
kubectl rollout undo deployment/api-deployment -n hodlfun --to-revision=3


# ═══════════════════════════════════════════════════════════════════════════
# USING GITHUB ACTIONS (Recommended)
# ═══════════════════════════════════════════════════════════════════════════

# 1. Go to Actions tab in GitHub
# 2. Select "Rollback" workflow
# 3. Click "Run workflow"
# 4. Enter:
#    - Environment: production
#    - SHA: abc123def456 (the version to rollback to)
#    - Confirm: rollback
# 5. Click "Run workflow"
```

---

## Secrets Management

### GitHub Secrets

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GITHUB SECRETS                                            │
└─────────────────────────────────────────────────────────────────────────────┘

REPOSITORY SECRETS (Settings → Secrets → Actions)
═══════════════════════════════════════════════════════════════════════════════

Secret Name                  Description
─────────────────────────────────────────────────────────────────────────────
GCP_SA_KEY                  Service account JSON key for deployments
SLACK_WEBHOOK_URL           Slack webhook for notifications


ENVIRONMENT SECRETS (Settings → Environments)
═══════════════════════════════════════════════════════════════════════════════

Staging Environment:
─────────────────────────────────────────────────────────────────────────────
DB_PASSWORD                 Staging database password
REDIS_PASSWORD              Staging Redis password
JWT_SECRET                  Staging JWT secret

Production Environment:
─────────────────────────────────────────────────────────────────────────────
DB_PASSWORD                 Production database password
REDIS_PASSWORD              Production Redis password
JWT_SECRET                  Production JWT secret
PUSH_RPC_URL                Production RPC endpoint


ENVIRONMENT PROTECTION (Production)
═══════════════════════════════════════════════════════════════════════════════

□ Required reviewers: 1 (team lead)
□ Wait timer: 0 minutes
□ Deployment branches: main only
```

### Kubernetes Secrets

```yaml
# k8s/base/secrets.yaml (Template - actual values from Secret Manager)

apiVersion: v1
kind: Secret
metadata:
  name: hodlfun-secrets
  namespace: hodlfun
type: Opaque
# stringData populated by external secret management
# or injected during deployment
```

### Using External Secrets (Recommended for Production)

```yaml
# Using External Secrets Operator with GCP Secret Manager

apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: hodlfun-secrets
  namespace: hodlfun
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcp-secret-store
    kind: ClusterSecretStore
  target:
    name: hodlfun-secrets
    creationPolicy: Owner
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: hodlfun-db-password
    - secretKey: REDIS_PASSWORD
      remoteRef:
        key: hodlfun-redis-password
    - secretKey: JWT_SECRET
      remoteRef:
        key: hodlfun-jwt-secret
    - secretKey: PUSH_RPC_URL
      remoteRef:
        key: hodlfun-push-rpc-url
```

---

## Testing in Pipeline

### Test Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEST STRATEGY                                             │
└─────────────────────────────────────────────────────────────────────────────┘

UNIT TESTS (Every PR)
═══════════════════════════════════════════════════════════════════════════════

Coverage:       Services, utilities, validators
Framework:      Jest
Mocking:        Database, Redis, external APIs
Speed:          < 60 seconds
Threshold:      80% coverage


INTEGRATION TESTS (Every PR)
═══════════════════════════════════════════════════════════════════════════════

Coverage:       API endpoints, database queries
Framework:      Jest + Supertest
Dependencies:   Real PostgreSQL, Real Redis (containerized)
Speed:          < 3 minutes


E2E TESTS (PRs to main, optional)
═══════════════════════════════════════════════════════════════════════════════

Coverage:       Critical user flows
Framework:      Jest + real services
Dependencies:   Full stack in containers
Speed:          < 5 minutes


SMOKE TESTS (Every deployment)
═══════════════════════════════════════════════════════════════════════════════

Coverage:       Health checks, basic API responses
Tool:           curl / custom script
Speed:          < 30 seconds
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:e2e": "jest --config ./jest-e2e.config.js",
    "test:cov": "jest --coverage",
    "lint": "eslint \"{apps,libs}/**/*.ts\"",
    "lint:fix": "eslint \"{apps,libs}/**/*.ts\" --fix",
    "format": "prettier --write \"**/*.ts\"",
    "format:check": "prettier --check \"**/*.ts\"",
    "typecheck": "tsc --noEmit"
  }
}
```

### Jest Configuration

```javascript
// jest.config.js

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'libs/**/src/**/*.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/common(.*)$': '<rootDir>/libs/common/src$1',
    '^@app/database(.*)$': '<rootDir>/libs/database/src$1',
    '^@app/redis(.*)$': '<rootDir>/libs/redis/src$1',
  },
};
```

---

## Monitoring Deployments

### Deployment Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT MONITORING                                     │
└─────────────────────────────────────────────────────────────────────────────┘

METRICS TO WATCH DURING DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════

1. Pod Status
   - All new pods reach Ready state
   - Old pods terminate gracefully
   - No CrashLoopBackOff

2. Error Rates
   - 5xx errors should not increase
   - Alert if > 1% error rate

3. Latency
   - p50, p95, p99 should remain stable
   - Alert if p99 > 500ms

4. Request Rate
   - Should remain consistent
   - Drop may indicate routing issues

5. WebSocket Connections
   - Clients should reconnect smoothly
   - No mass disconnections

6. Queue Depth (BullMQ)
   - Should process normally
   - No sudden backlog


GRAFANA DASHBOARD
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT: api-deployment    │  STATUS: Rollout in progress              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pods: [v1.2.3] ██████████ 3     [v1.2.4] ████░░░░░░ 1                     │
│                                                                             │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐      │
│  │    Request Rate (/s)          │  │    Error Rate (%)              │      │
│  │    ▄▄▄█████▄▄▄▄▄▄▄▄          │  │    ░░░░░░░░░░░░░░░░░░          │      │
│  │    Current: 150/s             │  │    Current: 0.1%               │      │
│  └───────────────────────────────┘  └───────────────────────────────┘      │
│                                                                             │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐      │
│  │    Latency (ms)               │  │    Memory Usage                │      │
│  │    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄           │  │    ██████░░░░ 60%              │      │
│  │    p99: 120ms                 │  │    512MB / 1GB                 │      │
│  └───────────────────────────────┘  └───────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Slack Notifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SLACK NOTIFICATION EXAMPLES                               │
└─────────────────────────────────────────────────────────────────────────────┘

DEPLOYMENT STARTED:
─────────────────────────────────────────────────────────────────────────────
🚀 *Deployment Started*
Environment: production
Commit: `abc123d` - Fix rate limiting bug
Initiated by: @developer


DEPLOYMENT SUCCESS:
─────────────────────────────────────────────────────────────────────────────
✅ *Deployment Successful*
Environment: production
Commit: `abc123d`
Duration: 3m 42s
[View Logs] [View Dashboard]


DEPLOYMENT FAILED:
─────────────────────────────────────────────────────────────────────────────
❌ *Deployment Failed*
Environment: production
Commit: `abc123d`
Error: Pod api-deployment-xyz failed health check
[View Logs] [Rollback]


ROLLBACK COMPLETED:
─────────────────────────────────────────────────────────────────────────────
⚠️ *Rollback Completed*
Environment: production
Rolled back to: `def456g`
Reason: High error rate after deployment
Initiated by: @oncall
```

---

## Best Practices

### CI/CD Best Practices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CI/CD BEST PRACTICES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. INFRASTRUCTURE AS CODE
═══════════════════════════════════════════════════════════════════════════════
   
   - All Kubernetes manifests in git
   - All workflows in git
   - No manual changes to clusters
   - Review infrastructure changes like code


2. IMMUTABLE ARTIFACTS
═══════════════════════════════════════════════════════════════════════════════
   
   - Tag images with commit SHA, not "latest"
   - Never modify published images
   - Same image from staging goes to production


3. PROGRESSIVE DELIVERY
═══════════════════════════════════════════════════════════════════════════════
   
   - Always deploy to staging first
   - Run smoke tests after each deployment
   - Manual approval for production
   - Monitor metrics during rollout


4. FAST FEEDBACK
═══════════════════════════════════════════════════════════════════════════════
   
   - Run tests on every PR
   - Fail fast on lint/type errors
   - Notify on completion/failure
   - Keep CI under 5 minutes


5. SECURE SECRETS
═══════════════════════════════════════════════════════════════════════════════
   
   - Never commit secrets to git
   - Use environment-specific secrets
   - Rotate secrets regularly
   - Use external secret management


6. ROLLBACK READY
═══════════════════════════════════════════════════════════════════════════════
   
   - Keep previous images available
   - Test rollback process regularly
   - Document rollback procedures
   - Automate rollback triggers (optional)


7. OBSERVABILITY
═══════════════════════════════════════════════════════════════════════════════
   
   - Log all deployment events
   - Track deployment metrics
   - Alert on anomalies
   - Maintain deployment history
```

---

## Summary

### Pipeline Overview

```
Push → CI (Lint/Test) → Build → Staging Deploy → [Approval] → Production Deploy
```

### Key Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push/PR | Lint, typecheck, test |
| `build.yml` | Push to main | Build Docker images |
| `deploy-staging.yml` | After build | Deploy to staging |
| `deploy-production.yml` | Manual | Deploy to production |
| `rollback.yml` | Manual | Rollback any environment |

### Build Times

| Stage | Cold | Warm (Cached) |
|-------|------|---------------|
| Install deps | 90s | 15s |
| Build | 60s | 30s |
| Docker | 60s | 20s |
| Push | 30s | 10s |
| **Total** | **~4 min** | **~75 sec** |

### Deployment Times

| Stage | Duration |
|-------|----------|
| Build (parallel) | ~2-4 min |
| Push images | ~30 sec |
| Apply manifests | ~10 sec |
| Rollout | ~2-3 min |
| Smoke tests | ~30 sec |
| **Total** | **~5-8 min** |

### Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/build.yml` | Build images |
| `.github/workflows/deploy-staging.yml` | Staging deployment |
| `.github/workflows/deploy-production.yml` | Production deployment |
| `.github/workflows/rollback.yml` | Rollback |
| `docker/*.Dockerfile` | Docker images |
| `k8s/base/*` | Base Kubernetes manifests |
| `k8s/overlays/staging/*` | Staging overrides |
| `k8s/overlays/production/*` | Production overrides |
