#!/bin/bash

# Railway Deployment Helper Script for Hodl.fun Backend
# This script helps verify everything is ready before deploying

set -e

echo "🚀 Hodl.fun Backend - Railway Deployment Helper"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if railway CLI is installed
echo "📋 Checking prerequisites..."
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI not found${NC}"
    echo "   Install with: npm i -g @railway/cli"
    echo "   Or deploy via GitHub: https://railway.app/new"
    echo ""
else
    echo -e "${GREEN}✅ Railway CLI installed${NC}"
fi

# Check if git is clean
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
    git status -s
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Git working directory clean${NC}"
fi

# Check if required files exist
echo ""
echo "📁 Checking required files..."
required_files=(
    "Dockerfile"
    "railway.api.json"
    "package.json"
    "tsconfig.json"
    "prisma/schema.prisma"
    "src/server.ts"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done

# Check environment template
echo ""
echo "🔐 Environment Configuration"
echo "----------------------------"
if [[ -f ".env.railway" ]]; then
    echo -e "${GREEN}✅ .env.railway template exists${NC}"
    echo "   Copy these variables to Railway Dashboard → Variables"
else
    echo -e "${RED}❌ .env.railway not found${NC}"
fi

# Check TypeScript compilation
echo ""
echo "🔨 Testing TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compiles successfully${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo "   Run 'npm run build' to see errors"
    exit 1
fi

# Summary
echo ""
echo "📊 Deployment Summary"
echo "===================="
echo ""
echo "Configuration:"
echo "  - Backend API only (no Redis, Worker, or Indexer)"
echo "  - Uses Dockerfile for build"
echo "  - Health check: /api/v1/health"
echo "  - Port: 3001"
echo ""
echo "Required Railway Services:"
echo "  ✓ PostgreSQL Database (add via Railway Dashboard)"
echo ""
echo "Environment Variables:"
echo "  📝 See .env.railway for complete list"
echo "  ⚠️  Remember to set:"
echo "     - PINATA credentials"
echo "     - JWT_SECRET (32+ characters)"
echo "     - CORS_ORIGIN (your frontend URLs)"
echo "     - ADMIN_ADDRESSES"
echo "     - Set INDEXER_ENABLED=false"
echo "     - Set WORKER_ENABLED=false"
echo ""

# Deployment options
echo "🚀 Deployment Options"
echo "===================="
echo ""
echo "Option 1: GitHub Auto-Deploy (Recommended)"
echo "  1. Push to GitHub: git push origin main"
echo "  2. Go to: https://railway.app/new"
echo "  3. Select 'Deploy from GitHub repo'"
echo "  4. Choose your repository"
echo "  5. Add PostgreSQL database"
echo "  6. Configure environment variables"
echo ""
echo "Option 2: Railway CLI"
echo "  1. railway login"
echo "  2. railway init"
echo "  3. railway up"
echo ""
echo "Option 3: GitHub Actions (if configured)"
echo "  - Automatic deployment on push to main"
echo ""

# Ask if user wants to deploy now
if command -v railway &> /dev/null; then
    echo ""
    read -p "Deploy to Railway now using CLI? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "🚀 Deploying to Railway..."
        railway up
    else
        echo "Skipping deployment. Deploy manually when ready."
    fi
fi

echo ""
echo -e "${GREEN}✅ Pre-deployment checks complete!${NC}"
echo ""
echo "📖 Full deployment guide: RAILWAY_DEPLOYMENT.md"
echo ""
