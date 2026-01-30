# Hodl.fun V2 - Cloudflare Configuration

## Table of Contents
1. [Overview](#overview)
2. [How Cloudflare Works](#how-cloudflare-works)
3. [Features We Use](#features-we-use)
4. [Setup Guide](#setup-guide)
5. [NestJS Implementation](#nestjs-implementation)
6. [Traffic Flow](#traffic-flow)
7. [Configuration Recommendations](#configuration-recommendations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Cloudflare?

Cloudflare is a reverse proxy that sits between users and your servers. All traffic flows through Cloudflare first, providing security, performance, and reliability benefits.

### Our Plan

| Attribute | Value |
|-----------|-------|
| Plan | Free |
| Domain Registrar | Hostinger |
| DNS Provider | Cloudflare |
| Origin Server | GCP (GKE Autopilot) |

### What Cloudflare Handles for Us

| Feature | Description |
|---------|-------------|
| DDoS Protection | Absorbs attack traffic at edge |
| SSL/TLS | Free certificates, automatic renewal |
| CDN | Caches static content globally |
| DNS | Fast, reliable DNS resolution |
| Basic WAF | Filters common attack patterns |
| Analytics | Traffic insights and threat data |

---

## How Cloudflare Works

### Without Cloudflare

```
┌────────┐                                    ┌─────────────┐
│  User  │───────────────────────────────────►│ Your Server │
└────────┘                                    └─────────────┘
              Direct connection
              Server IP exposed
              No protection
```

### With Cloudflare

```
┌────────┐         ┌─────────────┐         ┌─────────────┐
│  User  │────────►│ Cloudflare  │────────►│ Your Server │
└────────┘         │    Edge     │         └─────────────┘
                   └─────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
         Server IP           Traffic filtered
         is hidden           and optimized
```

### DNS Proxy Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DNS RESOLUTION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: User requests api.hodlfun.io
                    │
                    ▼
Step 2: DNS lookup goes to Cloudflare nameservers
                    │
                    ▼
Step 3: Cloudflare returns CLOUDFLARE'S IP (not your server)
                    │
                    ▼
Step 4: User connects to Cloudflare edge (closest data center)
                    │
                    ▼
Step 5: Cloudflare forwards request to your GCP origin
                    │
                    ▼
Step 6: Response flows back: GCP → Cloudflare → User
```

### Key Concept: Orange Cloud vs Grey Cloud

In Cloudflare DNS settings, each record has a proxy toggle:

| Icon | Mode | Traffic Flow | Use For |
|------|------|--------------|---------|
| 🟠 Orange | Proxied | User → Cloudflare → Server | Web traffic (HTTP/HTTPS) |
| ⚪ Grey | DNS Only | User → Server directly | Non-HTTP (mail, SSH, etc.) |

**For Hodl.fun:** All web records (A, AAAA, CNAME) should be **proxied (orange cloud)**.

---

## Features We Use

### 1. DDoS Protection

**What is DDoS?**

Distributed Denial of Service - attackers flood your server with millions of requests to overwhelm it and take it offline.

**How Cloudflare Protects:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DDoS ATTACK MITIGATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

                    Attacker Botnet
                    (Millions of IPs)
                          │
                          │ Attack traffic
                          ▼
              ┌───────────────────────┐
              │     Cloudflare        │
              │  310+ Data Centers    │
              │                       │
              │  Attack distributed   │
              │  across global        │
              │  network              │
              │                       │
              │  ┌─────────────────┐  │
              │  │ Traffic Analysis│  │
              │  │ Bot Detection   │  │
              │  │ Rate Limiting   │  │
              │  └─────────────────┘  │
              │                       │
              │  Bad traffic dropped  │
              │  Good traffic passed  │
              └───────────┬───────────┘
                          │
                          │ Clean traffic only
                          ▼
              ┌───────────────────────┐
              │    Your GCP Server    │
              │    (Protected)        │
              └───────────────────────┘
```

**Attack Types Mitigated:**

| Layer | Attack Type | Cloudflare Response |
|-------|-------------|---------------------|
| Layer 3 | ICMP flood, UDP flood | Absorbed at edge |
| Layer 4 | SYN flood, TCP flood | Absorbed at edge |
| Layer 7 | HTTP flood, Slowloris | Rate limiting, challenges |
| Amplification | DNS amp, NTP amp | Filtered automatically |

**Why This Matters for Hodl.fun:**

During popular token launches, malicious actors might try to DDoS the platform. Cloudflare absorbs these attacks without any impact on your GCP infrastructure.

---

### 2. SSL/TLS (HTTPS)

**What Cloudflare Provides:**

- Free SSL certificates for your domain
- Automatic certificate renewal (no manual work)
- Support for modern TLS versions (1.2, 1.3)

**SSL Modes:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SSL/TLS MODES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

MODE: OFF (Not Secure)
─────────────────────────────────────────────────────────────────────────────
User ──HTTP──► Cloudflare ──HTTP──► Server
❌ No encryption anywhere


MODE: FLEXIBLE (Partial)
─────────────────────────────────────────────────────────────────────────────
User ──HTTPS──► Cloudflare ──HTTP──► Server
⚠️ Encrypted to Cloudflare, but NOT to your server
⚠️ Data exposed between Cloudflare and GCP


MODE: FULL
─────────────────────────────────────────────────────────────────────────────
User ──HTTPS──► Cloudflare ──HTTPS──► Server
✅ Encrypted everywhere
⚠️ Cloudflare doesn't verify server certificate


MODE: FULL (STRICT) ← RECOMMENDED
─────────────────────────────────────────────────────────────────────────────
User ──HTTPS──► Cloudflare ──HTTPS──► Server
✅ Encrypted everywhere
✅ Cloudflare verifies server certificate is valid
✅ Most secure option
```

**Our Configuration:**

| Setting | Value | Reason |
|---------|-------|--------|
| SSL Mode | Full (Strict) | Maximum security |
| Minimum TLS | 1.2 | Modern browsers only |
| Always Use HTTPS | On | Redirect HTTP to HTTPS |
| HSTS | Enabled | Force HTTPS in browsers |

---

### 3. CDN (Content Delivery Network)

**How CDN Works:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CDN CACHING                                     │
└─────────────────────────────────────────────────────────────────────────────┘

FIRST REQUEST (Cache Miss):
─────────────────────────────────────────────────────────────────────────────

User (Tokyo) ──► Cloudflare Edge (Tokyo) ──► GCP (US-Central)
                                                    │
                            Response travels across ocean
                            (Slow: ~200ms)
                                                    │
                        ◄───────────────────────────┘
                        │
                        ▼
                 Cache stored at Tokyo edge


SUBSEQUENT REQUESTS (Cache Hit):
─────────────────────────────────────────────────────────────────────────────

User (Tokyo) ──► Cloudflare Edge (Tokyo)
                        │
                        │ Response from local cache
                        │ (Fast: ~20ms)
                        │
                        ▼
                   User receives response
                   (No trip to US needed)
```

**What We Cache:**

| Content Type | Cache? | TTL | Reason |
|--------------|--------|-----|--------|
| Token images (from GCS) | ✅ Yes | 1 day | Static, rarely changes |
| Static assets (JS, CSS) | ✅ Yes | 1 week | Versioned, can cache long |
| API responses | ❌ No | - | Dynamic, handled by Redis |
| WebSocket | ❌ N/A | - | Real-time, can't cache |
| Health endpoints | ❌ No | - | Must always be fresh |

**Cache Control Headers:**

```
# Static assets (cache aggressively)
Cache-Control: public, max-age=604800

# Dynamic API (don't cache)
Cache-Control: no-store

# Token images (cache with revalidation)
Cache-Control: public, max-age=86400
```

---

### 4. Basic WAF (Web Application Firewall)

**What WAF Does:**

Inspects HTTP requests and blocks malicious patterns before they reach your server.

**Attacks Blocked (Free Plan):**

| Attack | Example | Protection |
|--------|---------|------------|
| SQL Injection | `?id=1; DROP TABLE users;--` | ✅ Blocked |
| Cross-Site Scripting (XSS) | `<script>steal()</script>` | ✅ Blocked |
| Path Traversal | `../../etc/passwd` | ✅ Blocked |
| Known CVEs | Log4j, Shellshock | ✅ Blocked |

**Note:** Free plan has limited WAF rules. Our backend also validates all input as defense in depth.

---

### 5. Analytics & Insights

**Metrics Available:**

| Metric | Description | Use Case |
|--------|-------------|----------|
| Total Requests | Requests over time | Traffic patterns |
| Bandwidth Saved | Cached vs uncached | CDN effectiveness |
| Threats Blocked | DDoS, bots, attacks | Security monitoring |
| Geographic Distribution | User locations | Regional insights |
| Response Codes | 200, 404, 500, etc. | Error tracking |

---

## Setup Guide

### Prerequisites

- Domain purchased on Hostinger
- GCP infrastructure deployed (Load Balancer IP ready)
- Cloudflare account (free)

### Step 1: Create Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com)
2. Sign up with email
3. Verify email

### Step 2: Add Domain to Cloudflare

1. Click "Add a Site"
2. Enter your domain: `hodlfun.io`
3. Select "Free" plan
4. Cloudflare scans existing DNS records

### Step 3: Get Cloudflare Nameservers

Cloudflare provides two nameservers:

```
Example:
anna.ns.cloudflare.com
bob.ns.cloudflare.com
```

**Save these - you'll need them for Hostinger.**

### Step 4: Update Nameservers in Hostinger

1. Login to Hostinger
2. Go to **Domains** → Select your domain
3. Click **DNS / Nameservers**
4. Select **Change nameservers**
5. Replace Hostinger nameservers with Cloudflare's:
   ```
   ns1.dns-parking.com  →  anna.ns.cloudflare.com
   ns2.dns-parking.com  →  bob.ns.cloudflare.com
   ```
6. Save changes

### Step 5: Wait for Propagation

- Usually takes 10 minutes to 24 hours
- Cloudflare dashboard shows "Active" when complete
- Check propagation: [dnschecker.org](https://dnschecker.org)

### Step 6: Configure DNS Records

Once active, add DNS records in Cloudflare:

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `@` | `<GCP-LB-IP>` | 🟠 Proxied | Auto |
| A | `api` | `<GCP-LB-IP>` | 🟠 Proxied | Auto |
| A | `ws` | `<GCP-LB-IP>` | 🟠 Proxied | Auto |
| CNAME | `www` | `hodlfun.io` | 🟠 Proxied | Auto |

### Step 7: Configure SSL/TLS

1. Go to **SSL/TLS** → **Overview**
2. Select **Full (strict)**
3. Go to **Edge Certificates**
4. Enable:
   - Always Use HTTPS: **On**
   - Minimum TLS Version: **1.2**
   - TLS 1.3: **On**

### Step 8: Configure Security Settings

1. Go to **Security** → **Settings**
2. Security Level: **Medium**
3. Challenge Passage: **30 minutes**
4. Browser Integrity Check: **On**

### Step 9: Enable WebSockets

1. Go to **Network**
2. WebSockets: **On** (should be on by default)

### Step 10: Verify Configuration

```bash
# Check DNS is pointing to Cloudflare
dig api.hodlfun.io

# Check SSL is working
curl -I https://api.hodlfun.io/health/ready

# Check Cloudflare headers
curl -I https://api.hodlfun.io/health/ready | grep -i cf-
```

---

## NestJS Implementation

### Overview

Cloudflare is primarily infrastructure-level, but your NestJS backend needs specific configurations to work correctly with it.

| Requirement | Why Needed |
|-------------|------------|
| Trust Proxy | Get real client IP |
| Real IP Middleware | Extract CF-Connecting-IP header |
| Rate Limiting | Use real IP, not Cloudflare IP |
| Firewall Rules | Only allow Cloudflare IPs |

### 1. Trust Proxy Configuration

**File: `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // ─────────────────────────────────────────────────────────────────────
    // CRITICAL: Trust Cloudflare proxy
    // Without this, req.ip returns Cloudflare's IP, not user's real IP
    // ─────────────────────────────────────────────────────────────────────
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', true);

    // Security headers
    app.use(helmet());

    // Validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // CORS
    app.enableCors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    });

    await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

### 2. Real IP Middleware

**File: `src/common/middleware/real-ip.middleware.ts`**

```typescript
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RealIpMiddleware implements NestMiddleware {
    private readonly logger = new Logger(RealIpMiddleware.name);

    use(req: Request, res: Response, next: NextFunction) {
        // ─────────────────────────────────────────────────────────────────
        // Cloudflare Headers:
        // - CF-Connecting-IP: User's real IP (most reliable)
        // - X-Forwarded-For: Chain of IPs (can be spoofed)
        // - CF-IPCountry: User's country code
        // - CF-Ray: Request ID for debugging
        // ─────────────────────────────────────────────────────────────────
        
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        
        if (cfConnectingIp) {
            // Store original IP for reference
            (req as any).originalIp = req.ip;
            
            // Override with Cloudflare's real IP
            (req as any).ip = Array.isArray(cfConnectingIp) 
                ? cfConnectingIp[0] 
                : cfConnectingIp;
        }

        next();
    }
}
```

**File: `src/app.module.ts`**

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RealIpMiddleware } from './common/middleware/real-ip.middleware';

@Module({
    imports: [
        // ... other imports
    ],
    controllers: [],
    providers: [],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Apply to all routes
        consumer
            .apply(RealIpMiddleware)
            .forRoutes('*');
    }
}
```

### 3. Rate Limiting with Real IP

**File: `src/common/guards/cloudflare-throttler.guard.ts`**

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CloudflareThrottlerGuard extends ThrottlerGuard {
    /**
     * Override to use Cloudflare's real IP header
     * Without this, all users appear as the same IP (Cloudflare's)
     */
    protected async getTracker(req: Record<string, any>): Promise<string> {
        // Priority: CF-Connecting-IP > X-Forwarded-For > req.ip
        const realIp = 
            req.headers['cf-connecting-ip'] ||
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.ip;
        
        return realIp;
    }
}
```

**File: `src/app.module.ts` (add throttler config)**

```typescript
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CloudflareThrottlerGuard } from './common/guards/cloudflare-throttler.guard';

@Module({
    imports: [
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 1000,      // 1 second
                limit: 10,      // 10 requests per second
            },
            {
                name: 'medium',
                ttl: 60000,     // 1 minute
                limit: 100,     // 100 requests per minute
            },
            {
                name: 'long',
                ttl: 3600000,   // 1 hour
                limit: 1000,    // 1000 requests per hour
            },
        ]),
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: CloudflareThrottlerGuard,
        },
    ],
})
export class AppModule {}
```

### 4. Cloudflare Headers Utility

**File: `src/common/utils/cloudflare.utils.ts`**

```typescript
import { Request } from 'express';

export interface CloudflareInfo {
    realIp: string;
    country: string | null;
    rayId: string | null;
    datacenter: string | null;
    isHttps: boolean;
}

/**
 * Extract Cloudflare information from request headers
 */
export function getCloudflareInfo(req: Request): CloudflareInfo {
    const rayId = req.headers['cf-ray']?.toString() || null;
    
    return {
        // User's real IP address
        realIp: req.headers['cf-connecting-ip']?.toString() || req.ip,
        
        // User's country (2-letter ISO code)
        country: req.headers['cf-ipcountry']?.toString() || null,
        
        // Cloudflare Ray ID (useful for debugging/support)
        rayId: rayId,
        
        // Cloudflare data center that handled request
        // Ray ID format: "7a1234567890abcd-SJC" → "SJC"
        datacenter: rayId ? rayId.split('-')[1] || null : null,
        
        // Whether connection to Cloudflare was HTTPS
        isHttps: req.headers['cf-visitor']?.toString().includes('https') || false,
    };
}

/**
 * Decorator to inject Cloudflare info into controller methods
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CloudflareHeaders = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): CloudflareInfo => {
        const request = ctx.switchToHttp().getRequest();
        return getCloudflareInfo(request);
    },
);
```

**Usage in Controller:**

```typescript
import { Controller, Get } from '@nestjs/common';
import { CloudflareHeaders, CloudflareInfo } from './common/utils/cloudflare.utils';

@Controller('debug')
export class DebugController {
    @Get('cf-info')
    getCloudflareInfo(@CloudflareHeaders() cf: CloudflareInfo) {
        return {
            yourIp: cf.realIp,
            country: cf.country,
            rayId: cf.rayId,
            datacenter: cf.datacenter,
        };
    }
}
```

### 5. WebSocket Gateway Configuration

**File: `src/websocket/websocket.gateway.ts`**

```typescript
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true,
    },
    // ─────────────────────────────────────────────────────────────────────
    // IMPORTANT: Enable both transports for Cloudflare compatibility
    // WebSocket is preferred, polling is fallback
    // ─────────────────────────────────────────────────────────────────────
    transports: ['websocket', 'polling'],
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WebsocketGateway.name);

    handleConnection(client: Socket) {
        // Get real IP from Cloudflare header
        const realIp = 
            client.handshake.headers['cf-connecting-ip']?.toString() ||
            client.handshake.address;
        
        const country = client.handshake.headers['cf-ipcountry']?.toString() || 'unknown';
        
        this.logger.log(`Client connected: ${realIp} (${country})`);
        
        // Store for later use
        client.data.realIp = realIp;
        client.data.country = country;
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.data.realIp}`);
    }
}
```

### 6. Health Check (Bypass Cache)

**File: `src/health/health.controller.ts`**

```typescript
import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle() // Don't rate limit health checks
export class HealthController {
    @Get('ready')
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
    @Header('Pragma', 'no-cache')
    async ready() {
        // These headers tell Cloudflare to never cache this response
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('live')
    @Header('Cache-Control', 'no-store')
    async live() {
        return { status: 'ok' };
    }
}
```

### 7. GCP Firewall Rules (Terraform)

**File: `terraform/cloudflare-firewall.tf`**

```hcl
# ─────────────────────────────────────────────────────────────────────────────
# Allow only Cloudflare IPs to reach your Load Balancer
# This prevents attackers from bypassing Cloudflare
# ─────────────────────────────────────────────────────────────────────────────

# Cloudflare IPv4 ranges
# Full list: https://www.cloudflare.com/ips-v4
variable "cloudflare_ipv4_ranges" {
    default = [
        "173.245.48.0/20",
        "103.21.244.0/22",
        "103.22.200.0/22",
        "103.31.4.0/22",
        "141.101.64.0/18",
        "108.162.192.0/18",
        "190.93.240.0/20",
        "188.114.96.0/20",
        "197.234.240.0/22",
        "198.41.128.0/17",
        "162.158.0.0/15",
        "104.16.0.0/13",
        "104.24.0.0/14",
        "172.64.0.0/13",
        "131.0.72.0/22",
    ]
}

# Cloudflare IPv6 ranges
# Full list: https://www.cloudflare.com/ips-v6
variable "cloudflare_ipv6_ranges" {
    default = [
        "2400:cb00::/32",
        "2606:4700::/32",
        "2803:f800::/32",
        "2405:b500::/32",
        "2405:8100::/32",
        "2a06:98c0::/29",
        "2c0f:f248::/32",
    ]
}

# Firewall rule: Allow Cloudflare IPv4
resource "google_compute_firewall" "allow_cloudflare_ipv4" {
    name    = "allow-cloudflare-ipv4"
    network = google_compute_network.main.name
    
    allow {
        protocol = "tcp"
        ports    = ["80", "443"]
    }
    
    source_ranges = var.cloudflare_ipv4_ranges
    target_tags   = ["web-server"]
    
    priority = 1000
}

# Firewall rule: Allow Cloudflare IPv6
resource "google_compute_firewall" "allow_cloudflare_ipv6" {
    name    = "allow-cloudflare-ipv6"
    network = google_compute_network.main.name
    
    allow {
        protocol = "tcp"
        ports    = ["80", "443"]
    }
    
    source_ranges = var.cloudflare_ipv6_ranges
    target_tags   = ["web-server"]
    
    priority = 1000
}

# Firewall rule: Deny all other HTTP/HTTPS traffic
resource "google_compute_firewall" "deny_non_cloudflare" {
    name    = "deny-non-cloudflare-http"
    network = google_compute_network.main.name
    
    deny {
        protocol = "tcp"
        ports    = ["80", "443"]
    }
    
    source_ranges = ["0.0.0.0/0"]
    target_tags   = ["web-server"]
    
    priority = 2000  # Lower priority than allow rules
}
```

---

## Traffic Flow

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE REQUEST FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Request: https://api.hodlfun.io/api/v1/tokens
                            │
                            ▼
                    ┌───────────────┐
                    │  DNS Lookup   │
                    │ (Cloudflare)  │
                    └───────┬───────┘
                            │ Returns Cloudflare IP
                            ▼
                    ┌───────────────┐
                    │  Cloudflare   │
                    │  Edge Server  │
                    │  (Nearest)    │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │  DDoS    │   │   WAF    │   │   SSL    │
      │  Check   │   │  Rules   │   │ Decrypt  │
      └────┬─────┘   └────┬─────┘   └────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
                      Pass all checks?
                            │
                    ┌───────┴───────┐
                    │               │
                   YES              NO
                    │               │
                    ▼               ▼
            ┌───────────────┐  ┌───────────────┐
            │   Is cached?  │  │    Block /    │
            │               │  │   Challenge   │
            └───────┬───────┘  └───────────────┘
                    │
            ┌───────┴───────┐
            │               │
           YES              NO
            │               │
            ▼               ▼
    ┌───────────────┐  ┌───────────────┐
    │ Return cached │  │ Add headers:  │
    │   response    │  │ CF-Connecting │
    └───────────────┘  │ CF-IPCountry  │
                       │ CF-Ray        │
                       └───────┬───────┘
                               │
                               ▼
                       ┌───────────────┐
                       │  GCP Load     │
                       │  Balancer     │
                       └───────┬───────┘
                               │
                               ▼
                       ┌───────────────┐
                       │  GKE Pod      │
                       │  (NestJS)     │
                       └───────┬───────┘
                               │
                               ▼
                       ┌───────────────┐
                       │  Response     │
                       │  (Cached at   │
                       │  edge if      │
                       │  cacheable)   │
                       └───────────────┘
```

### WebSocket Connection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WEBSOCKET CONNECTION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

Client: new WebSocket('wss://api.hodlfun.io')
                            │
                            ▼
                    ┌───────────────┐
                    │  Cloudflare   │
                    │  Edge Server  │
                    └───────┬───────┘
                            │
                            │ HTTP Upgrade Request
                            │ (101 Switching Protocols)
                            ▼
                    ┌───────────────┐
                    │  GCP Load     │
                    │  Balancer     │
                    └───────┬───────┘
                            │
                            │ Sticky Session
                            │ (Same pod for connection)
                            ▼
                    ┌───────────────┐
                    │  WebSocket    │
                    │  Pod (GKE)    │
                    └───────┬───────┘
                            │
                            │ Persistent Connection
                            │ (Bidirectional)
                            ▼
                    ┌───────────────┐
                    │  Real-time    │
                    │  Events       │
                    └───────────────┘

Note: Cloudflare has 100 concurrent connections per IP limit on Free plan.
This is per USER IP, not total - should be fine for 10K+ users.
```

---

## Configuration Recommendations

### Cloudflare Dashboard Settings

#### SSL/TLS

| Setting | Value | Location |
|---------|-------|----------|
| SSL Mode | Full (Strict) | SSL/TLS → Overview |
| Always Use HTTPS | On | SSL/TLS → Edge Certificates |
| Minimum TLS Version | 1.2 | SSL/TLS → Edge Certificates |
| TLS 1.3 | On | SSL/TLS → Edge Certificates |
| HSTS | Enable (optional) | SSL/TLS → Edge Certificates |

#### Security

| Setting | Value | Location |
|---------|-------|----------|
| Security Level | Medium | Security → Settings |
| Challenge Passage | 30 minutes | Security → Settings |
| Browser Integrity Check | On | Security → Settings |

#### Speed

| Setting | Value | Location |
|---------|-------|----------|
| Auto Minify | JS, CSS, HTML | Speed → Optimization |
| Brotli | On | Speed → Optimization |

#### Caching

| Setting | Value | Location |
|---------|-------|----------|
| Caching Level | Standard | Caching → Configuration |
| Browser Cache TTL | Respect Existing Headers | Caching → Configuration |

#### Network

| Setting | Value | Location |
|---------|-------|----------|
| WebSockets | On | Network |
| HTTP/2 | On | Network |
| HTTP/3 | On | Network |

### Page Rules (Optional)

Create rules for specific behaviors:

| URL Pattern | Setting | Value |
|-------------|---------|-------|
| `api.hodlfun.io/health/*` | Cache Level | Bypass |
| `api.hodlfun.io/api/*` | Cache Level | Bypass |
| `api.hodlfun.io/socket.io/*` | Cache Level | Bypass |

---

## Troubleshooting

### Common Issues

#### Issue: All users show same IP in logs

**Cause:** Not extracting real IP from Cloudflare headers

**Solution:** Implement RealIpMiddleware (see section 5.2)

#### Issue: Rate limiting not working

**Cause:** Rate limiting using Cloudflare's IP instead of user's IP

**Solution:** Use CloudflareThrottlerGuard (see section 5.3)

#### Issue: WebSocket connections failing

**Cause:** WebSockets not enabled in Cloudflare or wrong transport config

**Solution:**
1. Enable WebSockets in Cloudflare: Network → WebSockets → On
2. Use both transports in Socket.IO: `transports: ['websocket', 'polling']`

#### Issue: 521 Error (Web server is down)

**Cause:** Cloudflare can't reach your origin server

**Solution:**
1. Check GCP Load Balancer is running
2. Verify firewall allows Cloudflare IPs
3. Check GKE pods are healthy

#### Issue: 522 Error (Connection timed out)

**Cause:** Origin server too slow to respond

**Solution:**
1. Check API response times
2. Increase Cloudflare timeout (paid plan)
3. Optimize slow endpoints

#### Issue: 525 Error (SSL handshake failed)

**Cause:** SSL certificate issue on origin

**Solution:**
1. Verify GCP Load Balancer has valid SSL cert
2. Use Full (Strict) mode only with valid cert
3. Check certificate chain is complete

### Useful Commands

```bash
# Check if DNS is pointing to Cloudflare
dig api.hodlfun.io +short

# Check Cloudflare headers
curl -I https://api.hodlfun.io/health/ready

# Look for these headers:
# cf-ray: <ray-id>
# cf-cache-status: DYNAMIC (or HIT/MISS for cached content)
# server: cloudflare

# Check your real IP as seen by server
curl https://api.hodlfun.io/debug/cf-info

# Test WebSocket connection
wscat -c wss://api.hodlfun.io/socket.io/?EIO=4&transport=websocket
```

### Cloudflare IP Ranges Update

Cloudflare IPs change occasionally. Set up monitoring:

```bash
# Check current IPs
curl https://www.cloudflare.com/ips-v4
curl https://www.cloudflare.com/ips-v6

# Compare with your firewall rules
# Update if different
```

---

## Summary

### What Cloudflare Does (No Code Needed)

- ✅ DDoS protection
- ✅ SSL/TLS certificates
- ✅ CDN caching for static content
- ✅ DNS management
- ✅ Basic WAF protection
- ✅ Analytics

### What Your Backend Does (Code Required)

- ✅ Trust proxy setting
- ✅ Real IP middleware
- ✅ Rate limiting with real IP
- ✅ WebSocket configuration
- ✅ Cache-control headers
- ✅ GCP firewall rules

### Files to Create/Modify

| File | Purpose |
|------|---------|
| `src/main.ts` | Trust proxy |
| `src/common/middleware/real-ip.middleware.ts` | Extract real IP |
| `src/common/guards/cloudflare-throttler.guard.ts` | Rate limit with real IP |
| `src/common/utils/cloudflare.utils.ts` | Helper utilities |
| `src/websocket/websocket.gateway.ts` | WebSocket config |
| `terraform/cloudflare-firewall.tf` | GCP firewall rules |
