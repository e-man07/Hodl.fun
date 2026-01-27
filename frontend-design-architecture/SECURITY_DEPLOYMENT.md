# Security & Deployment

## 12. Security Considerations

### 12.1 Frontend Security Best Practices

```typescript
// 1. Input Validation & Sanitization
// Always validate user input before processing

import { z } from 'zod';
import DOMPurify from 'dompurify';

// Token creation validation
const tokenCreationSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(32, 'Name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Name contains invalid characters'),

  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers'),

  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .transform(val => val ? DOMPurify.sanitize(val) : val),

  // URL validation
  website: z.string()
    .url('Invalid URL')
    .optional()
    .or(z.literal('')),
});

// Address validation
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Amount validation (prevent negative or invalid numbers)
const isValidAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < Number.MAX_SAFE_INTEGER;
};
```

### 12.2 XSS Prevention

```typescript
// 2. XSS Prevention
// Never render untrusted content directly

// BAD - dangerous
const BadComponent = ({ description }: { description: string }) => (
  <div dangerouslySetInnerHTML={{ __html: description }} />
);

// GOOD - sanitize first or use text content
const GoodComponent = ({ description }: { description: string }) => (
  <div>{DOMPurify.sanitize(description, { ALLOWED_TAGS: [] })}</div>
);

// For rich text (if needed)
const RichTextComponent = ({ html }: { html: string }) => (
  <div
    dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      }),
    }}
  />
);
```

### 12.3 Secure Wallet Interactions

```typescript
// 3. Wallet Security

// Always verify network before transactions
async function ensureCorrectNetwork(provider: BrowserProvider): Promise<boolean> {
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(CHAIN_CONFIG.id)) {
    try {
      await provider.send('wallet_switchEthereumChain', [
        { chainId: `0x${CHAIN_CONFIG.id.toString(16)}` },
      ]);
      return true;
    } catch (error) {
      console.error('Failed to switch network:', error);
      return false;
    }
  }
  return true;
}

// Always use checksummed addresses
import { getAddress } from 'ethers';

function validateAndChecksumAddress(address: string): string {
  try {
    return getAddress(address); // Returns checksummed address or throws
  } catch {
    throw new Error('Invalid address');
  }
}

// Set reasonable deadlines for transactions
const getDeadline = (minutes: number = 5): number => {
  return Math.floor(Date.now() / 1000) + minutes * 60;
};

// Always show transaction details before signing
interface TransactionPreview {
  action: 'buy' | 'sell' | 'create';
  tokenSymbol: string;
  amountIn: string;
  expectedOut: string;
  minOut: string;
  priceImpact: string;
  slippage: string;
  deadline: number;
  estimatedGas: string;
}

function TransactionConfirmModal({ preview, onConfirm, onCancel }: {
  preview: TransactionPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal>
      <h3>Confirm Transaction</h3>
      <div>
        <p>Action: {preview.action}</p>
        <p>You pay: {preview.amountIn}</p>
        <p>You receive (estimated): {preview.expectedOut}</p>
        <p>Minimum received: {preview.minOut}</p>
        <p>Price impact: {preview.priceImpact}</p>
        <p>Slippage tolerance: {preview.slippage}</p>
        <p>Transaction expires: {new Date(preview.deadline * 1000).toLocaleTimeString()}</p>
      </div>
      <Button onClick={onConfirm}>Confirm</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </Modal>
  );
}
```

### 12.4 Rate Limiting Awareness

```typescript
// 4. Client-side Rate Limiting Awareness

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limits = {
    short: { count: 10, windowMs: 1000 },   // 10 req/sec
    medium: { count: 50, windowMs: 10000 }, // 50 req/10sec
    long: { count: 200, windowMs: 60000 },  // 200 req/min
  };

  canMakeRequest(endpoint: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(endpoint) || [];

    // Clean old timestamps
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.limits.long.windowMs
    );

    // Check all limits
    const lastSecond = recentTimestamps.filter((t) => now - t < 1000).length;
    const last10Seconds = recentTimestamps.filter((t) => now - t < 10000).length;
    const lastMinute = recentTimestamps.length;

    if (
      lastSecond >= this.limits.short.count ||
      last10Seconds >= this.limits.medium.count ||
      lastMinute >= this.limits.long.count
    ) {
      return false;
    }

    return true;
  }

  recordRequest(endpoint: string) {
    const now = Date.now();
    const timestamps = this.requests.get(endpoint) || [];
    timestamps.push(now);
    this.requests.set(endpoint, timestamps.slice(-200)); // Keep last 200
  }
}

const rateLimiter = new RateLimiter();

// Wrap API calls with rate limiting
async function makeApiCall<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
  if (!rateLimiter.canMakeRequest(endpoint)) {
    throw new Error('Rate limit exceeded. Please wait before making more requests.');
  }

  rateLimiter.recordRequest(endpoint);
  return fn();
}
```

### 12.5 Content Security Policy

```typescript
// next.config.ts - Security Headers
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'", // Required for Tailwind
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.push.org wss://*.push.org https://gateway.pinata.cloud https://*.ipfs.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 12.6 Sensitive Data Handling

```typescript
// 5. Environment Variables & Sensitive Data

// Never expose sensitive keys in client-side code
// Use NEXT_PUBLIC_ prefix only for truly public values

// .env.local (NOT committed)
// PINATA_API_KEY=xxx           # Server-side only
// PINATA_SECRET_KEY=xxx        # Server-side only

// .env (committed)
// NEXT_PUBLIC_API_URL=https://api.hodl.fun
// NEXT_PUBLIC_WS_URL=wss://ws.hodl.fun
// NEXT_PUBLIC_CHAIN_ID=42101

// Access tokens should be stored securely
const secureStorage = {
  setToken: (token: string) => {
    // Use httpOnly cookies via API route, not localStorage
    // Or if localStorage is required, encrypt sensitive data
    sessionStorage.setItem('accessToken', token);
  },

  getToken: (): string | null => {
    return sessionStorage.getItem('accessToken');
  },

  clearToken: () => {
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
```

---

## 13. Deployment Strategy

### 13.1 Infrastructure Architecture

```
                                    ┌─────────────────┐
                                    │   CloudFlare    │
                                    │   (CDN + WAF)   │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
           │   Vercel      │        │   Backend     │        │   WebSocket   │
           │   (Frontend)  │        │   API         │        │   Server      │
           │               │        │   (3000)      │        │   (3001)      │
           └───────────────┘        └───────┬───────┘        └───────┬───────┘
                                            │                        │
                                            ▼                        │
                                    ┌───────────────┐                │
                                    │    Redis      │◄───────────────┘
                                    │   (Cache +    │
                                    │   Pub/Sub)    │
                                    └───────┬───────┘
                                            │
                                            ▼
                                    ┌───────────────┐
                                    │  PostgreSQL   │
                                    │  (Primary DB) │
                                    └───────────────┘
```

### 13.2 Vercel Deployment Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["iad1", "sfo1", "cdg1"], // US East, US West, Europe
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "https://api.hodl.fun/api/v1/:path*"
    }
  ]
}
```

### 13.3 Environment Configuration

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.hodl.fun/api/v1
NEXT_PUBLIC_WS_URL=wss://ws.hodl.fun
NEXT_PUBLIC_CHAIN_ID=42101
NEXT_PUBLIC_CORE_ADDRESS=0x592F8f0abbB9a3d3c425980Ac0263363C8405b03
NEXT_PUBLIC_FACTORY_ADDRESS=0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8
NEXT_PUBLIC_EXPLORER_URL=https://donut.push.network

# Server-side only (for API routes)
PINATA_API_KEY=xxx
PINATA_SECRET_KEY=xxx
```

### 13.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run type-check

      - name: Run tests
        run: npm run test

  build:
    runs-on: ubuntu-latest
    needs: lint-and-test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_WS_URL: ${{ secrets.NEXT_PUBLIC_WS_URL }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next

  deploy-preview:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Deploy to Preview
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }} > deployment-url.txt

      - name: Comment PR with Preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const url = fs.readFileSync('deployment-url.txt', 'utf8').trim();
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview deployed: ${url}`
            });

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Deploy to Production
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### 13.5 Performance Monitoring

```typescript
// src/lib/monitoring.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

// Report Web Vitals to analytics
export function reportWebVitals() {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}

function sendToAnalytics(metric: { name: string; value: number; id: string }) {
  // Send to your analytics service
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    page: window.location.pathname,
    timestamp: Date.now(),
  });

  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body);
  } else {
    fetch('/api/analytics', { body, method: 'POST', keepalive: true });
  }
}

// Error tracking
export function setupErrorTracking() {
  window.onerror = (message, source, lineno, colno, error) => {
    reportError({
      type: 'unhandled',
      message: String(message),
      source,
      lineno,
      colno,
      stack: error?.stack,
    });
  };

  window.onunhandledrejection = (event) => {
    reportError({
      type: 'unhandled-promise',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
  };
}

function reportError(error: object) {
  fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...error,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }),
    keepalive: true,
  }).catch(() => {}); // Silently fail
}
```

### 13.6 Performance Budgets

```javascript
// next.config.js - Bundle size warnings
const nextConfig = {
  experimental: {
    // Warn if pages exceed size limits
    largePageDataBytes: 128 * 1024, // 128KB
  },
};

// Performance budgets (enforced in CI)
const PERFORMANCE_BUDGETS = {
  // Bundle sizes (gzipped)
  'First Load JS': 100 * 1024,  // 100KB
  'Page JS': 50 * 1024,         // 50KB per page
  'Total CSS': 30 * 1024,       // 30KB

  // Web Vitals thresholds
  LCP: 2500,   // Largest Contentful Paint < 2.5s
  FID: 100,    // First Input Delay < 100ms
  CLS: 0.1,    // Cumulative Layout Shift < 0.1
  TTFB: 800,   // Time to First Byte < 800ms
  FCP: 1800,   // First Contentful Paint < 1.8s
};
```

### 13.7 Scaling Checklist

```markdown
## Pre-Launch Checklist for 10K Concurrent Users

### Infrastructure
- [ ] CDN configured (CloudFlare/Vercel Edge)
- [ ] Multiple regions enabled
- [ ] Redis cluster for WebSocket scaling
- [ ] Database connection pooling
- [ ] Load balancer health checks

### Frontend
- [ ] Bundle size < 100KB gzipped
- [ ] Images optimized (WebP/AVIF)
- [ ] Lazy loading for below-fold content
- [ ] Virtual scrolling for long lists
- [ ] Service worker for offline support

### Caching
- [ ] React Query stale times configured
- [ ] Static pages pre-rendered (ISR)
- [ ] API responses cached at edge
- [ ] WebSocket reduces API polling

### Monitoring
- [ ] Web Vitals tracking
- [ ] Error tracking (Sentry)
- [ ] Real User Monitoring
- [ ] Uptime monitoring
- [ ] Performance alerts

### Security
- [ ] CSP headers configured
- [ ] Rate limiting on API
- [ ] Input validation on all forms
- [ ] Wallet interaction confirmations
- [ ] HTTPS everywhere

### Testing
- [ ] Load tested to 15K concurrent (50% buffer)
- [ ] Stress tested WebSocket connections
- [ ] Mobile performance tested
- [ ] Cross-browser testing
- [ ] Accessibility audit (WCAG 2.1 AA)
```

---

## 14. Summary & Next Steps

### 14.1 Architecture Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **CDN** | CloudFlare/Vercel Edge | Global distribution, caching, WAF |
| **Frontend** | Next.js 15 + React 19 | SSR, App Router, optimized bundles |
| **State** | Zustand + React Query | Client state + server state cache |
| **Real-time** | Socket.io | Live price updates, trade feeds |
| **Styling** | TailwindCSS 4 | Dark theme, purple brand, responsive |
| **Charts** | Lightweight Charts | Candlestick trading charts |
| **Web3** | ethers.js 6 | Contract interactions |
| **Wallet** | Push Universal Wallet | Email, Google, wallet login |

### 14.2 Implementation Priority

**Phase 1: Core Infrastructure (Week 1-2)**
1. Set up project structure
2. Implement design system (colors, typography, components)
3. Build layout components (Sidebar, Header, Mobile Nav)
4. Implement wallet connection
5. Set up React Query + Zustand

**Phase 2: Main Features (Week 3-4)**
1. Token grid with virtualization
2. Token detail page with chart
3. Trading panel (buy/sell)
4. WebSocket integration
5. Real-time price updates

**Phase 3: User Features (Week 5-6)**
1. Portfolio page
2. Token creation flow
3. Trade history
4. Leaderboards
5. User authentication

**Phase 4: Polish & Scale (Week 7-8)**
1. Performance optimization
2. Mobile responsiveness
3. Error handling
4. Analytics & monitoring
5. Load testing

### 14.3 Key Files to Create First

```
1. src/app/globals.css          # Design tokens
2. src/config/contracts.ts      # Contract addresses
3. src/config/abis.ts           # Contract ABIs
4. src/providers/               # All providers
5. src/components/ui/           # Button, Card, Input, etc.
6. src/components/layout/       # Sidebar, Header
7. src/hooks/useContracts.ts    # Contract hooks
8. src/lib/socket/client.ts     # WebSocket manager
9. src/lib/api/client.ts        # API client
```

This architecture is designed to support 10,000+ concurrent users with:
- Sub-100ms UI updates via WebSocket
- Optimistic updates for instant feedback
- Virtual scrolling for large lists
- Aggressive caching at all layers
- Progressive enhancement and graceful degradation
