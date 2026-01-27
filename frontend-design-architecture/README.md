# Hodl.fun Frontend Architecture v2

> Scalable Frontend Design for 10,000+ Concurrent Users

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Core architecture, design system, components, state management, real-time layer, performance |
| [PAGES.md](./PAGES.md) | Page-by-page specifications, wireframes, mobile responsiveness |
| [INTEGRATION.md](./INTEGRATION.md) | API integration, React Query hooks, Web3/contract integration |
| [SECURITY_DEPLOYMENT.md](./SECURITY_DEPLOYMENT.md) | Security best practices, deployment strategy, CI/CD, monitoring |
| [GAPS_FIXED.md](./GAPS_FIXED.md) | Alignment fixes between frontend architecture and backend/contracts |

---

## Quick Start

### Tech Stack
- **Framework**: Next.js 15 (App Router) + React 19
- **Styling**: TailwindCSS 4 + CSS Variables (dark theme)
- **State**: Zustand (client) + React Query (server)
- **Real-time**: Socket.io (WebSocket)
- **Web3**: ethers.js 6 + Push Universal Wallet
- **Charts**: Lightweight Charts (TradingView)

### Design System Colors
```css
--color-primary: hsl(292 84% 61%);     /* Purple/Magenta */
--color-secondary: hsl(217 91% 60%);   /* Blue */
--color-background: hsl(0 0% 0%);      /* Pure Black */
--color-success: hsl(142 76% 36%);     /* Green (gains) */
--color-destructive: hsl(0 84% 60%);   /* Red (losses) */
```

### Key Features
- Real-time price updates via WebSocket
- Optimistic UI updates for instant feedback
- Virtual scrolling for 10k+ tokens
- Mobile-first responsive design
- Offline support with service workers
- User profiles with avatar, bio, and social links
- Creator fee tracking and claiming

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Next.js   │  │   Zustand   │  │ React Query │              │
│  │  (SSR/CSR)  │  │  (Client)   │  │  (Server)   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────┐              │
│  │               DATA LAYER                       │              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │              │
│  │  │ REST API │  │ WebSocket│  │ Blockchain   │ │              │
│  │  │ (Backend)│  │ (Real-time)│ │ (Contracts)  │ │              │
│  │  └──────────┘  └──────────┘  └──────────────┘ │              │
│  └───────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pages

| Route | Purpose | Key Features |
|-------|---------|--------------|
| `/` | Marketplace | Trending carousel, token grid, filters |
| `/token/[address]` | Token Detail | Price chart, trading panel, trades/holders |
| `/launch` | Create Token | Form with live preview, IPFS upload |
| `/profile` | User Profile | Profile info, created tokens, holdings, fees |
| `/profile/[address]` | Public Profile | View any user's profile and activity |
| `/leaderboard` | Leaderboard | Top gainers, volume, traders |

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| First Contentful Paint | < 1.5s | SSR + streaming |
| Largest Contentful Paint | < 2.5s | Image optimization |
| Time to Interactive | < 3.0s | Code splitting |
| Cumulative Layout Shift | < 0.1 | Skeleton loaders |
| First Input Delay | < 100ms | Event delegation |

---

## Real-time Events

### WebSocket Subscriptions
```javascript
// Subscribe to token updates
socket.emit('subscribe:token', { tokenAddress: '0x...' });

// Listen for price updates
socket.on('price_update', ({ price, marketCap }) => { ... });

// Listen for trades
socket.on('trade', ({ type, trader, amountIn, amountOut }) => { ... });

// Listen for new tokens (global)
socket.on('token_created', ({ token }) => { ... });
```

---

## Contract Interactions

### Core Functions (Write)
| Function | Purpose |
|----------|---------|
| `Core.createCurve()` | Deploy new token + bonding curve |
| `Core.exactInBuy()` | Buy tokens with exact PUSH input |
| `Core.exactOutBuy()` | Buy exact tokens, pay variable PUSH |
| `Core.exactInSell()` | Sell exact tokens for PUSH |
| `Core.exactOutSell()` | Sell tokens for exact PUSH output |

### Core Functions (Read)
| Function | Purpose |
|----------|---------|
| `Core.getAmountOut()` | Calculate output for input amount |
| `Core.getAmountIn()` | Calculate input for output amount |
| `Core.getCurrentPrice()` | Get current token price |
| `Core.calculateMarketCap()` | Get market cap |
| `Core.getCurveData()` | Get reserves and k value |

### Factory Functions
| Function | Purpose |
|----------|---------|
| `Factory.getCurve()` | Get curve address for token |
| `Factory.getCreator()` | Get token creator address |
| `Factory.getConfig()` | Get platform configuration |
| `Factory.getCreatorFeeShare()` | Get creator fee percentage |
| `Factory.claimCreatorFees()` | Claim accumulated fees |

### BondingCurve Functions
| Function | Purpose |
|----------|---------|
| `BondingCurve.getCurrentPrice()` | Get current token price |
| `BondingCurve.getATHPrice()` | Get all-time high price |
| `BondingCurve.getATHMarketCap()` | Get all-time high market cap |
| `BondingCurve.getGraduationMarketCap()` | Get graduation threshold |
| `BondingCurve.getLock()` | Check if curve is locked |
| `BondingCurve.getIsListing()` | Check if listed on DEX |

### Token Functions
| Function | Purpose |
|----------|---------|
| `Token.balanceOf()` | Get user's token balance |
| `Token.approve()` | Approve spending for sell |

---

## Security Checklist

- [x] Input validation (Zod schemas)
- [x] XSS prevention (DOMPurify)
- [x] CSRF protection (SameSite cookies)
- [x] Rate limiting awareness
- [x] Secure wallet interactions
- [x] CSP headers configured
- [x] Environment variable protection

---

## Deployment

### Production Stack
- **CDN**: CloudFlare (edge caching, WAF)
- **Hosting**: Vercel (Next.js optimized)
- **API**: Backend on cloud VMs/containers
- **WebSocket**: Separate service with Redis adapter
- **Database**: PostgreSQL + Redis

### CI/CD Pipeline
1. Lint & TypeScript check
2. Unit tests
3. Build
4. Preview deployment (PRs)
5. Production deployment (main)

---

## Getting Started

```bash
# Clone and install
cd frontend
npm install

# Development
npm run dev

# Build
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

---

## File Structure

```
frontend/
├── src/
│   ├── app/              # Next.js pages
│   │   ├── page.tsx      # Home/Marketplace
│   │   ├── token/        # Token detail pages
│   │   ├── launch/       # Create token page
│   │   ├── profile/      # User profile pages
│   │   └── leaderboard/  # Leaderboard page
│   ├── components/       # React components
│   │   ├── ui/           # Primitives (Button, Card, etc.)
│   │   ├── layout/       # Sidebar, Header
│   │   ├── token/        # Token-specific
│   │   ├── trading/      # Trading panel
│   │   └── profile/      # Profile components
│   ├── hooks/            # Custom hooks
│   ├── stores/           # Zustand stores
│   ├── lib/              # Utilities
│   │   ├── api/          # API client
│   │   ├── socket/       # WebSocket
│   │   └── contracts/    # Web3
│   ├── config/           # Configuration
│   ├── providers/        # React providers
│   └── types/            # TypeScript types
└── public/               # Static assets
```

---

## References

- **Design Inspiration**: pump.fun, nad.fun
- **Backend API**: `/hodl_backend_architecture/`
- **Smart Contracts**: `/smart-contract-v2/`
- **Current Frontend**: `/frontend/`

---

*Last updated: January 2026*
