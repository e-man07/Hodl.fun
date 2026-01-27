# Hodl.fun Frontend Architecture v2

## Scalable Frontend Design for 10,000+ Concurrent Users

> **Target**: Production-grade token launchpad with real-time trading, inspired by pump.fun and nad.fun
> **Stack**: Next.js 15 (App Router), React 19, TailwindCSS 4, Socket.io, ethers.js 6
> **Network**: Push Chain (Chain ID: 42101)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design System](#2-design-system)
3. [Application Architecture](#3-application-architecture)
4. [Component Library](#4-component-library)
5. [State Management](#5-state-management)
6. [Real-time Data Layer](#6-real-time-data-layer)
7. [Performance Optimization](#7-performance-optimization)
8. [Page Specifications](#8-page-specifications)
9. [API Integration](#9-api-integration)
10. [Web3 Integration](#10-web3-integration)
11. [Security Considerations](#11-security-considerations)
12. [Deployment Strategy](#12-deployment-strategy)

---

## 1. Executive Summary

### 1.1 Goals

- **Scale**: Support 10,000+ concurrent users with sub-100ms UI updates
- **Performance**: Lighthouse score 90+ on all metrics
- **UX**: Instant feedback, optimistic updates, smooth animations
- **Reliability**: Graceful degradation, offline support, error recovery

### 1.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | SSR + Client Hydration | SEO for token pages, fast initial load |
| State | Zustand + React Query | Minimal boilerplate, excellent devtools |
| Real-time | Socket.io with Redis adapter | Horizontal scaling, room-based subscriptions |
| Styling | TailwindCSS 4 + CSS Variables | Design tokens, JIT compilation |
| Charts | Lightweight Charts (TradingView) | Professional trading UI, small bundle |
| Virtualization | TanStack Virtual | Handle 10k+ items without DOM bloat |

### 1.3 Traffic Assumptions

```
Peak concurrent users:     10,000
WebSocket connections:     10,000 (1 per user)
API requests/second:       5,000 (0.5 req/user/sec avg)
Trade events/second:       100 (broadcast to relevant rooms)
Token listings:            10,000+ tokens
```

---

## 2. Design System

### 2.1 Color Palette (Preserved from Current)

```css
:root {
  /* Primary - Purple/Magenta (Brand Color) */
  --color-primary: 292 84% 61%;        /* #d946ef - hsl(292, 84%, 61%) */
  --color-primary-hover: 292 84% 55%;  /* Darker on hover */
  --color-primary-muted: 292 84% 20%;  /* For backgrounds */

  /* Secondary - Blue */
  --color-secondary: 217 91% 60%;      /* #3b82f6 */

  /* Accent - Green (Success/Gains) */
  --color-success: 142 76% 36%;        /* #22c55e */

  /* Destructive - Red (Losses) */
  --color-destructive: 0 84% 60%;      /* #ef4444 */

  /* Backgrounds - Dark Theme */
  --color-background: 0 0% 0%;         /* #000000 - Pure black */
  --color-surface-1: 0 0% 6%;          /* #0f0f0f - Cards */
  --color-surface-2: 0 0% 10%;         /* #1a1a1a - Elevated */
  --color-surface-3: 0 0% 14%;         /* #242424 - Modals */

  /* Text */
  --color-text-primary: 0 0% 100%;     /* #ffffff */
  --color-text-secondary: 0 0% 70%;    /* #b3b3b3 */
  --color-text-muted: 0 0% 50%;        /* #808080 */

  /* Borders */
  --color-border: 0 0% 20%;            /* #333333 */
  --color-border-hover: 0 0% 30%;      /* #4d4d4d */

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, hsl(292 84% 61%), hsl(217 91% 60%));
  --gradient-glow: radial-gradient(circle at center, hsl(292 84% 61% / 0.3), transparent 70%);
}
```

### 2.2 Typography Scale

```css
:root {
  /* Font Families */
  --font-sans: 'Poppins', system-ui, sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', monospace;

  /* Font Sizes (rem) */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */

  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 2.3 Spacing System (8px Grid)

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### 2.4 Border Radius

```css
:root {
  --radius-sm: 0.375rem;   /* 6px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-2xl: 1.5rem;    /* 24px */
  --radius-full: 9999px;
}
```

### 2.5 Shadows & Effects

```css
:root {
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.5);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
  --shadow-glow: 0 0 20px hsl(292 84% 61% / 0.4);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* Z-Index Scale */
  --z-dropdown: 50;
  --z-sticky: 100;
  --z-modal: 200;
  --z-toast: 300;
  --z-tooltip: 400;
}
```

### 2.6 Animation Keyframes

```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 10px hsl(292 84% 61% / 0.4); }
  50% { box-shadow: 0 0 25px hsl(292 84% 61% / 0.6); }
}

@keyframes slide-up {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes price-flash-green {
  0% { background-color: hsl(142 76% 36% / 0.3); }
  100% { background-color: transparent; }
}

@keyframes price-flash-red {
  0% { background-color: hsl(0 84% 60% / 0.3); }
  100% { background-color: transparent; }
}
```

---

## 3. Application Architecture

### 3.1 Directory Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (main)/                   # Main layout group
│   │   │   ├── layout.tsx            # Sidebar + Header layout
│   │   │   ├── page.tsx              # Home/Marketplace
│   │   │   ├── token/[address]/
│   │   │   │   ├── page.tsx          # Token detail
│   │   │   │   └── loading.tsx       # Skeleton loader
│   │   │   ├── launch/
│   │   │   │   └── page.tsx          # Create token
│   │   │   ├── profile/
│   │   │   │   ├── page.tsx          # Own profile (redirects if not connected)
│   │   │   │   └── [address]/
│   │   │   │       └── page.tsx      # User profile by address
│   │   │   └── leaderboard/
│   │   │       └── page.tsx          # Top traders/tokens
│   │   ├── api/                      # API routes (if needed)
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Design tokens
│   │   └── error.tsx                 # Global error boundary
│   │
│   ├── components/
│   │   ├── ui/                       # Primitive components
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Skeleton/
│   │   │   ├── Toast/
│   │   │   ├── Tooltip/
│   │   │   └── index.ts              # Barrel export
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── Sidebar/
│   │   │   ├── Header/
│   │   │   ├── MobileNav/
│   │   │   └── Footer/
│   │   │
│   │   ├── token/                    # Token-specific components
│   │   │   ├── TokenCard/
│   │   │   ├── TokenGrid/
│   │   │   ├── TokenCarousel/
│   │   │   ├── PriceChart/
│   │   │   ├── TradingPanel/
│   │   │   ├── OrderBook/
│   │   │   ├── HoldersList/
│   │   │   └── TradeHistory/
│   │   │
│   │   ├── trading/                  # Trading components
│   │   │   ├── BuySellForm/
│   │   │   ├── SlippageSettings/
│   │   │   ├── PriceImpact/
│   │   │   └── TransactionStatus/
│   │   │
│   │   ├── wallet/                   # Wallet components
│   │   │   ├── ConnectButton/
│   │   │   ├── WalletModal/
│   │   │   └── NetworkSwitcher/
│   │   │
│   │   ├── profile/                  # Profile components
│   │   │   ├── ProfileHeader/
│   │   │   ├── ProfileTabs/
│   │   │   ├── EditProfileModal/
│   │   │   ├── AvatarUpload/
│   │   │   ├── SocialLinks/
│   │   │   ├── CreatorFeesPanel/
│   │   │   └── ActivityFeed/
│   │   │
│   │   └── shared/                   # Shared components
│   │       ├── LiveIndicator/
│   │       ├── PriceChange/
│   │       ├── AddressDisplay/
│   │       ├── TimeAgo/
│   │       └── EmptyState/
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useSocket.ts              # WebSocket connection
│   │   ├── useTokenData.ts           # Token queries
│   │   ├── useTrading.ts             # Trading operations
│   │   ├── useWallet.ts              # Wallet state
│   │   ├── useContracts.ts           # Contract interactions
│   │   ├── usePriceHistory.ts        # Chart data
│   │   ├── useProfile.ts             # User profile CRUD
│   │   ├── useCreatorFees.ts         # Creator fee claiming
│   │   ├── useDebounce.ts            # Input debouncing
│   │   ├── useIntersection.ts        # Lazy loading
│   │   └── useMediaQuery.ts          # Responsive
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── tokenStore.ts             # Token list state
│   │   ├── tradeStore.ts             # Active trades
│   │   ├── uiStore.ts                # UI state (modals, etc)
│   │   ├── profileStore.ts           # Profile edit state
│   │   └── walletStore.ts            # Wallet state
│   │
│   ├── lib/                          # Utilities
│   │   ├── api/                      # API client
│   │   │   ├── client.ts             # Axios instance
│   │   │   ├── tokens.ts             # Token endpoints
│   │   │   ├── users.ts              # User endpoints
│   │   │   └── types.ts              # API types
│   │   │
│   │   ├── socket/                   # Socket.io client
│   │   │   ├── client.ts             # Connection manager
│   │   │   ├── events.ts             # Event handlers
│   │   │   └── types.ts              # Event types
│   │   │
│   │   ├── contracts/                # Web3 utilities
│   │   │   ├── core.ts               # Core contract
│   │   │   ├── factory.ts            # Factory contract
│   │   │   ├── token.ts              # Token contract
│   │   │   └── types.ts              # Contract types
│   │   │
│   │   ├── cache/                    # Caching utilities
│   │   │   ├── queryClient.ts        # React Query config
│   │   │   ├── localStorage.ts       # Persistent cache
│   │   │   └── deduplication.ts      # Request dedup
│   │   │
│   │   └── utils/                    # General utilities
│   │       ├── format.ts             # Number/address formatting
│   │       ├── time.ts               # Time utilities
│   │       ├── validation.ts         # Input validation
│   │       └── constants.ts          # App constants
│   │
│   ├── config/                       # Configuration
│   │   ├── contracts.ts              # Contract addresses
│   │   ├── abis.ts                   # Contract ABIs
│   │   ├── chains.ts                 # Network config
│   │   └── env.ts                    # Environment variables
│   │
│   ├── providers/                    # React providers
│   │   ├── QueryProvider.tsx         # React Query
│   │   ├── SocketProvider.tsx        # Socket.io
│   │   ├── WalletProvider.tsx        # Push Wallet
│   │   └── ThemeProvider.tsx         # Theme context
│   │
│   └── types/                        # TypeScript types
│       ├── token.ts
│       ├── trade.ts
│       ├── user.ts
│       └── api.ts
│
├── public/
│   ├── fonts/
│   ├── icons/
│   └── images/
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 3.2 Provider Hierarchy

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body>
        <QueryProvider>           {/* React Query */}
          <WalletProvider>        {/* Push Chain Wallet */}
            <SocketProvider>      {/* WebSocket Connection */}
              <ToastProvider>     {/* Notifications */}
                {children}
              </ToastProvider>
            </SocketProvider>
          </WalletProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

### 3.3 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  TokenGrid  │  │ PriceChart  │  │TradingPanel │  │  Portfolio  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOM HOOKS                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │useTokenData │  │usePriceHist │  │ useTrading  │  │usePortfolio │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
└─────────┼────────────────┼────────────────┼────────────────┼────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STATE MANAGEMENT                                │
│  ┌───────────────────────────┐  ┌───────────────────────────────┐   │
│  │      React Query          │  │         Zustand Stores        │   │
│  │  (Server State Cache)     │  │    (Client UI State)          │   │
│  │  - Token lists            │  │    - Modal visibility         │   │
│  │  - Price history          │  │    - Selected token           │   │
│  │  - User portfolio         │  │    - Trade form values        │   │
│  └─────────────┬─────────────┘  └───────────────────────────────┘   │
└───────────────┼─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   REST API      │  │   WebSocket     │  │   Blockchain        │  │
│  │   (Backend)     │  │   (Real-time)   │  │   (Contracts)       │  │
│  │                 │  │                 │  │                     │  │
│  │ GET /tokens     │  │ price_update    │  │ Core.exactInBuy()   │  │
│  │ GET /users/:id  │  │ trade           │  │ Token.balanceOf()   │  │
│  │ GET /trades     │  │ token_created   │  │ BondingCurve.get*() │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Library

### 4.1 Primitive Components (UI Kit)

#### Button Component

```tsx
// src/components/ui/Button/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

// Variants
const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-glow',
  secondary: 'bg-surface-2 text-white border border-border hover:border-primary',
  ghost: 'bg-transparent text-text-secondary hover:text-white hover:bg-surface-1',
  destructive: 'bg-destructive text-white hover:bg-destructive/90',
};

// Sizes
const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
};
```

#### Card Component

```tsx
// src/components/ui/Card/Card.tsx
interface CardProps {
  variant: 'default' | 'elevated' | 'interactive' | 'glow';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

// Interactive card for token listings
const interactive = `
  bg-surface-1 border border-border rounded-xl
  hover:border-primary/50 hover:shadow-glow
  transition-all duration-200 cursor-pointer
  group
`;
```

#### Skeleton Component

```tsx
// src/components/ui/Skeleton/Skeleton.tsx
// For loading states - maintains layout while data loads

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant: 'text' | 'circular' | 'rectangular';
  animation: 'pulse' | 'shimmer' | 'none';
}

// Shimmer effect for premium feel
const shimmerClass = `
  bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2
  bg-[length:200%_100%] animate-shimmer
`;
```

### 4.2 Token Components

#### TokenCard (Grid Item)

```tsx
// src/components/token/TokenCard/TokenCard.tsx
interface TokenCardProps {
  token: {
    address: string;
    name: string;
    symbol: string;
    imageUri: string;
    currentPrice: string;
    marketCap: string;
    priceChange24h: number;
    volume24h: string;
    status: 'TRADING' | 'LOCKED' | 'LISTED';
  };
  layout: 'grid' | 'list';
  onClick?: () => void;
}

// Features:
// - Lazy loaded image with blur placeholder
// - Price flash animation on update
// - Progress bar to graduation (marketCap / graduationCap)
// - Quick trade button on hover
// - Status badge (Trading / Graduated / Listed)
```

#### TokenCarousel (Trending Section)

```tsx
// src/components/token/TokenCarousel/TokenCarousel.tsx
// Horizontal scrolling carousel like nad.fun

interface TokenCarouselProps {
  title: string;
  tokens: Token[];
  loading?: boolean;
  autoScroll?: boolean;
  showArrows?: boolean;
}

// Features:
// - Smooth horizontal scroll with momentum
// - Navigation arrows (hidden on touch devices)
// - Auto-scroll option with pause on hover
// - Skeleton loading state
// - 72px square token images
```

#### PriceChart (TradingView Style)

```tsx
// src/components/token/PriceChart/PriceChart.tsx
interface PriceChartProps {
  tokenAddress: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  height?: number;
}

// Features:
// - Lightweight Charts integration
// - Real-time candle updates via WebSocket
// - Volume histogram overlay
// - Price line with current price
// - Crosshair with OHLCV tooltip
// - Interval selector tabs
// - Fullscreen mode
```

### 4.3 Trading Components

#### TradingPanel

```tsx
// src/components/trading/TradingPanel/TradingPanel.tsx
interface TradingPanelProps {
  token: Token;
  userBalance: string;
  tokenBalance: string;
}

// Sections:
// 1. Tab switcher: Buy | Sell
// 2. Amount input with max button
// 3. Estimated output with price impact
// 4. Slippage settings (collapsible)
// 5. Execute button with loading state
// 6. Recent user trades (last 5)
```

#### TransactionStatus

```tsx
// src/components/trading/TransactionStatus/TransactionStatus.tsx
// Toast-style transaction tracker

interface TransactionStatusProps {
  hash: string;
  type: 'buy' | 'sell' | 'create';
  status: 'pending' | 'confirmed' | 'failed';
}

// Features:
// - Slide-in animation from right
// - Progress spinner for pending
// - Success checkmark with confetti for trades
// - Error state with retry option
// - Link to block explorer
```

---

## 5. State Management

### 5.1 React Query Configuration

```typescript
// src/lib/cache/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long data is considered fresh
      staleTime: 10 * 1000,           // 10 seconds

      // Cache time: How long inactive data stays in cache
      gcTime: 5 * 60 * 1000,          // 5 minutes

      // Retry failed requests
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),

      // Refetch strategies
      refetchOnWindowFocus: false,    // Disable auto-refetch (WebSocket handles updates)
      refetchOnReconnect: true,

      // Network mode
      networkMode: 'offlineFirst',    // Use cache when offline
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Query Keys Factory
export const queryKeys = {
  tokens: {
    all: ['tokens'] as const,
    lists: () => [...queryKeys.tokens.all, 'list'] as const,
    list: (filters: TokenFilters) => [...queryKeys.tokens.lists(), filters] as const,
    trending: () => [...queryKeys.tokens.all, 'trending'] as const,
    details: () => [...queryKeys.tokens.all, 'detail'] as const,
    detail: (address: string) => [...queryKeys.tokens.details(), address] as const,
    priceHistory: (address: string, interval: string) =>
      [...queryKeys.tokens.detail(address), 'prices', interval] as const,
    holders: (address: string) => [...queryKeys.tokens.detail(address), 'holders'] as const,
    trades: (address: string) => [...queryKeys.tokens.detail(address), 'trades'] as const,
  },
  users: {
    all: ['users'] as const,
    profile: (address: string) => [...queryKeys.users.all, address, 'profile'] as const,
    holdings: (address: string) => [...queryKeys.users.all, address, 'holdings'] as const,
    trades: (address: string) => [...queryKeys.users.all, address, 'trades'] as const,
    createdTokens: (address: string) => [...queryKeys.users.all, address, 'created'] as const,
    creatorFees: (address: string) => [...queryKeys.users.all, address, 'fees'] as const,
  },
};
```

### 5.2 Zustand Stores

```typescript
// src/stores/tokenStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface TokenStore {
  // Real-time price updates (from WebSocket)
  prices: Map<string, { price: string; marketCap: string; timestamp: number }>;

  // Selected token for detail view
  selectedToken: string | null;

  // Actions
  updatePrice: (address: string, price: string, marketCap: string) => void;
  setSelectedToken: (address: string | null) => void;
  clearStaleData: () => void;
}

export const useTokenStore = create<TokenStore>()(
  subscribeWithSelector((set, get) => ({
    prices: new Map(),
    selectedToken: null,

    updatePrice: (address, price, marketCap) => {
      set((state) => {
        const newPrices = new Map(state.prices);
        newPrices.set(address, { price, marketCap, timestamp: Date.now() });
        return { prices: newPrices };
      });
    },

    setSelectedToken: (address) => set({ selectedToken: address }),

    // Clear prices older than 1 minute (stale data cleanup)
    clearStaleData: () => {
      const now = Date.now();
      set((state) => {
        const newPrices = new Map(state.prices);
        for (const [key, value] of newPrices) {
          if (now - value.timestamp > 60000) {
            newPrices.delete(key);
          }
        }
        return { prices: newPrices };
      });
    },
  }))
);
```

```typescript
// src/stores/tradeStore.ts
interface TradeStore {
  // Pending transactions
  pendingTxs: Map<string, PendingTransaction>;

  // Recent trades (last 50)
  recentTrades: Trade[];

  // Trade form state
  tradeForm: {
    type: 'buy' | 'sell';
    amount: string;
    slippage: number;
  };

  // Actions
  addPendingTx: (hash: string, data: PendingTransaction) => void;
  updateTxStatus: (hash: string, status: 'confirmed' | 'failed') => void;
  removePendingTx: (hash: string) => void;
  addRecentTrade: (trade: Trade) => void;
  setTradeForm: (form: Partial<TradeStore['tradeForm']>) => void;
}
```

```typescript
// src/stores/uiStore.ts
interface UIStore {
  // Modal states
  modals: {
    wallet: boolean;
    trade: boolean;
    slippage: boolean;
    editProfile: boolean;
  };

  // Sidebar state (mobile)
  sidebarOpen: boolean;

  // Theme
  theme: 'dark' | 'light';

  // Toast notifications queue
  toasts: Toast[];

  // Actions
  openModal: (modal: keyof UIStore['modals']) => void;
  closeModal: (modal: keyof UIStore['modals']) => void;
  toggleSidebar: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

```typescript
// src/stores/profileStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileStore {
  // Edit form state (persisted for draft recovery)
  editForm: {
    displayName: string;
    bio: string;
    avatarPreview: string | null;
    twitter: string;
    telegram: string;
    website: string;
  };

  // Active profile tab
  activeTab: 'created' | 'holdings' | 'activity' | 'fees';

  // View mode for holdings/created lists
  viewMode: 'grid' | 'list';

  // Actions
  setEditForm: (form: Partial<ProfileStore['editForm']>) => void;
  resetEditForm: () => void;
  setActiveTab: (tab: ProfileStore['activeTab']) => void;
  setViewMode: (mode: ProfileStore['viewMode']) => void;
}

const defaultEditForm = {
  displayName: '',
  bio: '',
  avatarPreview: null,
  twitter: '',
  telegram: '',
  website: '',
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      editForm: defaultEditForm,
      activeTab: 'created',
      viewMode: 'grid',

      setEditForm: (form) =>
        set((state) => ({
          editForm: { ...state.editForm, ...form },
        })),

      resetEditForm: () => set({ editForm: defaultEditForm }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: 'hodl-profile-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        // Don't persist editForm to avoid stale drafts
      }),
    }
  )
);
```

### 5.3 Optimistic Updates Pattern

```typescript
// src/hooks/useTrading.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useBuyToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tokenAddress, amountIn, minAmountOut }) => {
      // Execute blockchain transaction
      return await executeContractBuy(tokenAddress, amountIn, minAmountOut);
    },

    // Optimistic update before transaction confirms
    onMutate: async ({ tokenAddress, amountIn }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tokens.detail(tokenAddress) });

      // Snapshot previous value
      const previousToken = queryClient.getQueryData(queryKeys.tokens.detail(tokenAddress));

      // Optimistically update
      queryClient.setQueryData(queryKeys.tokens.detail(tokenAddress), (old: Token) => ({
        ...old,
        // Estimate new price (will be corrected by WebSocket)
        estimatedPrice: calculateEstimatedPrice(old, amountIn),
      }));

      return { previousToken };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousToken) {
        queryClient.setQueryData(
          queryKeys.tokens.detail(variables.tokenAddress),
          context.previousToken
        );
      }
    },

    // Refetch after success (or rely on WebSocket)
    onSettled: (data, error, variables) => {
      // WebSocket will push the real update, but invalidate to be safe
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.detail(variables.tokenAddress),
        refetchType: 'none', // Don't refetch immediately, wait for WebSocket
      });
    },
  });
}
```

---

## 6. Real-time Data Layer

### 6.1 Socket.io Client Manager

```typescript
// src/lib/socket/client.ts
import { io, Socket } from 'socket.io-client';

class SocketManager {
  private eventsSocket: Socket | null = null;
  private tradesSocket: Socket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  // Singleton pattern
  private static instance: SocketManager;
  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  connect(wsUrl: string) {
    // Events namespace - for price updates, token created, etc.
    this.eventsSocket = io(`${wsUrl}/events`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    // Trades namespace - for real-time trade feed
    this.tradesSocket = io(`${wsUrl}/trades`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
    this.setupHeartbeat();
  }

  private setupEventHandlers() {
    if (!this.eventsSocket) return;

    this.eventsSocket.on('connect', () => {
      console.log('[Socket] Connected to events namespace');
      this.reconnectAttempts = 0;
      // Re-subscribe to previously subscribed rooms
      this.resubscribeAll();
    });

    this.eventsSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.eventsSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.reconnectAttempts++;
    });
  }

  private setupHeartbeat() {
    // Send ping every 25 seconds to keep connection alive
    setInterval(() => {
      if (this.eventsSocket?.connected) {
        this.eventsSocket.emit('ping');
      }
    }, 25000);
  }

  // Subscribe to token updates
  subscribeToToken(tokenAddress: string) {
    const room = `token:${tokenAddress}`;
    if (this.subscriptions.has(room)) return;

    this.eventsSocket?.emit('subscribe:token', { tokenAddress });
    this.subscriptions.add(room);
  }

  unsubscribeFromToken(tokenAddress: string) {
    const room = `token:${tokenAddress}`;
    this.eventsSocket?.emit('unsubscribe:token', { tokenAddress });
    this.subscriptions.delete(room);
  }

  // Subscribe to user's wallet events
  subscribeToWallet(walletAddress: string) {
    this.eventsSocket?.emit('subscribe:wallet', { walletAddress });
    this.subscriptions.add(`wallet:${walletAddress}`);
  }

  // Subscribe to recent trades for a token
  subscribeToTrades(tokenAddress: string) {
    this.tradesSocket?.emit('subscribe:recent', { tokenAddress });
    this.subscriptions.add(`trades:${tokenAddress}`);
  }

  // Event listeners
  onPriceUpdate(callback: (data: PriceUpdateEvent) => void) {
    this.eventsSocket?.on('price_update', callback);
  }

  onTrade(callback: (data: TradeEvent) => void) {
    this.eventsSocket?.on('trade', callback);
  }

  onTokenCreated(callback: (data: TokenCreatedEvent) => void) {
    this.eventsSocket?.on('token_created', callback);
  }

  onTokenGraduated(callback: (data: { tokenAddress: string }) => void) {
    this.eventsSocket?.on('token_graduated', callback);
  }

  // Graduation event (when curve locks before DEX listing)
  onGraduation(callback: (data: { tokenAddress: string; poolAddress?: string }) => void) {
    this.eventsSocket?.on('graduation', callback);
  }

  // Listing event (when token is listed on DEX)
  onListing(callback: (data: { tokenAddress: string; poolAddress: string }) => void) {
    this.eventsSocket?.on('listing', callback);
  }

  // Personal trade event (for wallet subscribers)
  onMyTrade(callback: (data: { type: string; tokenAddress: string; trade: TradeEvent }) => void) {
    this.eventsSocket?.on('my_trade', callback);
  }

  onNewTrade(callback: (data: TradeEvent) => void) {
    this.tradesSocket?.on('new_trade', callback);
  }

  onRecentTrades(callback: (data: { trades: Trade[] }) => void) {
    this.tradesSocket?.on('recent_trades', callback);
  }

  private resubscribeAll() {
    for (const room of this.subscriptions) {
      const [type, address] = room.split(':');
      switch (type) {
        case 'token':
          this.eventsSocket?.emit('subscribe:token', { tokenAddress: address });
          break;
        case 'wallet':
          this.eventsSocket?.emit('subscribe:wallet', { walletAddress: address });
          break;
        case 'trades':
          this.tradesSocket?.emit('subscribe:recent', { tokenAddress: address });
          break;
      }
    }
  }

  disconnect() {
    this.eventsSocket?.disconnect();
    this.tradesSocket?.disconnect();
    this.subscriptions.clear();
  }
}

export const socketManager = SocketManager.getInstance();
```

### 6.2 Socket Provider & Hook

```typescript
// src/providers/SocketProvider.tsx
import { createContext, useContext, useEffect, useRef } from 'react';
import { socketManager } from '@/lib/socket/client';
import { useTokenStore } from '@/stores/tokenStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useQueryClient } from '@tanstack/react-query';

const SocketContext = createContext<typeof socketManager | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const updatePrice = useTokenStore((s) => s.updatePrice);
  const addRecentTrade = useTradeStore((s) => s.addRecentTrade);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    socketManager.connect(wsUrl);

    // Handle price updates
    socketManager.onPriceUpdate(({ tokenAddress, price, marketCap }) => {
      // Update Zustand store (immediate UI update)
      updatePrice(tokenAddress, price, marketCap);

      // Update React Query cache
      queryClient.setQueryData(
        queryKeys.tokens.detail(tokenAddress),
        (old: Token | undefined) => old ? { ...old, currentPrice: price, marketCap } : old
      );
    });

    // Handle new trades
    socketManager.onTrade((trade) => {
      addRecentTrade(trade);

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.trades(trade.tokenAddress),
      });
    });

    // Handle new token created
    socketManager.onTokenCreated((data) => {
      // Invalidate token list to show new token
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.trending() });
    });

    // Handle graduation event
    socketManager.onGraduation(({ tokenAddress }) => {
      // Update token status in cache
      queryClient.setQueryData(
        queryKeys.tokens.detail(tokenAddress),
        (old: Token | undefined) => old ? { ...old, status: 'LOCKED' } : old
      );
      // Invalidate token list
      queryClient.invalidateQueries({ queryKey: queryKeys.tokens.lists() });
    });

    // Handle listing event (DEX listing after graduation)
    socketManager.onListing(({ tokenAddress, poolAddress }) => {
      queryClient.setQueryData(
        queryKeys.tokens.detail(tokenAddress),
        (old: Token | undefined) => old ? {
          ...old,
          status: 'LISTED',
          poolAddress
        } : old
      );
    });

    // Handle personal trade events (for wallet subscribers)
    socketManager.onMyTrade(({ tokenAddress, trade }) => {
      // Update user portfolio
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.portfolio(trade.trader)
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.holdings(trade.trader)
      });
    });

    return () => {
      socketManager.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketManager}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket must be used within SocketProvider');
  return socket;
}
```

### 6.3 Token Subscription Hook

```typescript
// src/hooks/useTokenSubscription.ts
import { useEffect } from 'react';
import { useSocket } from '@/providers/SocketProvider';

export function useTokenSubscription(tokenAddress: string | null) {
  const socket = useSocket();

  useEffect(() => {
    if (!tokenAddress) return;

    // Subscribe to token updates
    socket.subscribeToToken(tokenAddress);
    socket.subscribeToTrades(tokenAddress);

    return () => {
      // Unsubscribe when component unmounts or token changes
      socket.unsubscribeFromToken(tokenAddress);
    };
  }, [tokenAddress, socket]);
}
```

---

## 7. Performance Optimization

### 7.1 Bundle Optimization

```typescript
// next.config.ts
import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Optimize images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: '**.cloudflare-ipfs.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24 hours
  },

  // Transpile specific packages
  transpilePackages: ['lightweight-charts'],

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Tree-shaking for ethers.js (reduce bundle by ~50%)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'ethers': 'ethers/lib.esm',
      };
    }

    return config;
  },

  // Enable experimental features
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

export default withBundleAnalyzer(nextConfig);
```

### 7.2 Code Splitting Strategy

```typescript
// Dynamic imports for heavy components
import dynamic from 'next/dynamic';

// Chart component (heavy - ~150KB)
const PriceChart = dynamic(
  () => import('@/components/token/PriceChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Disable SSR for canvas-based charts
  }
);

// Trading panel (only needed on token pages)
const TradingPanel = dynamic(
  () => import('@/components/trading/TradingPanel'),
  { loading: () => <TradingPanelSkeleton /> }
);

// Wallet modal (only when connecting)
const WalletModal = dynamic(
  () => import('@/components/wallet/WalletModal'),
  { ssr: false }
);
```

### 7.3 Virtual Scrolling for Large Lists

```typescript
// src/components/token/TokenGrid/TokenGrid.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function TokenGrid({ tokens }: { tokens: Token[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(tokens.length / 4), // 4 columns
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated card height
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-200px)] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * 4;
          const rowTokens = tokens.slice(startIndex, startIndex + 4);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="grid grid-cols-4 gap-4"
            >
              {rowTokens.map((token) => (
                <TokenCard key={token.address} token={token} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 7.4 Image Optimization

```typescript
// src/components/shared/TokenImage/TokenImage.tsx
import Image from 'next/image';
import { useState } from 'react';

interface TokenImageProps {
  src: string;
  alt: string;
  size: 'sm' | 'md' | 'lg';
  priority?: boolean;
}

const sizes = {
  sm: 32,
  md: 48,
  lg: 72,
};

export function TokenImage({ src, alt, size, priority = false }: TokenImageProps) {
  const [error, setError] = useState(false);
  const dimension = sizes[size];

  // Convert IPFS URLs to gateway
  const imageUrl = src.startsWith('ipfs://')
    ? `https://gateway.pinata.cloud/ipfs/${src.replace('ipfs://', '')}`
    : src;

  if (error) {
    return (
      <div
        className="bg-surface-2 rounded-full flex items-center justify-center"
        style={{ width: dimension, height: dimension }}
      >
        <span className="text-text-muted text-xs">?</span>
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={dimension}
      height={dimension}
      className="rounded-full object-cover"
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Tiny blur placeholder
      onError={() => setError(true)}
    />
  );
}
```

### 7.5 Memory Management

```typescript
// src/hooks/useCleanup.ts
import { useEffect } from 'react';
import { useTokenStore } from '@/stores/tokenStore';

// Periodic cleanup of stale data
export function useMemoryCleanup() {
  const clearStaleData = useTokenStore((s) => s.clearStaleData);

  useEffect(() => {
    // Clean stale price data every minute
    const interval = setInterval(() => {
      clearStaleData();
    }, 60000);

    return () => clearInterval(interval);
  }, [clearStaleData]);
}

// Cleanup on page visibility change
export function useVisibilityCleanup() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched tabs - reduce memory usage
        // Don't disconnect WebSocket, but stop processing non-essential updates
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
