# Hodl.fun V2 - GCP Load Balancer & Traffic Flow

## Table of Contents
1. [Overview](#overview)
2. [What is a Load Balancer](#what-is-a-load-balancer)
3. [GCP Load Balancer Types](#gcp-load-balancer-types)
4. [Load Balancer Components](#load-balancer-components)
5. [Traffic Flow: Cloudflare to Pods](#traffic-flow-cloudflare-to-pods)
6. [GKE Integration](#gke-integration)
7. [WebSocket Configuration](#websocket-configuration)
8. [Internal Service Communication](#internal-service-communication)
9. [Network Security](#network-security)
10. [Complete Request Examples](#complete-request-examples)
11. [Kubernetes Manifests](#kubernetes-manifests)
12. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Document Covers

This document explains how traffic flows from Cloudflare through the GCP Load Balancer into the GKE cluster, and how services communicate internally.

### Architecture Position

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           TRAFFIC FLOW                                      │
└────────────────────────────────────────────────────────────────────────────┘

User → Cloudflare → [GCP Load Balancer] → GKE Pods → Internal Services
                    └─────────────────┘
                     THIS DOCUMENT
```

### Key Components

| Component | Purpose |
|-----------|---------|
| Global Static IP | Single entry point for Cloudflare |
| Forwarding Rule | Routes port 443 to HTTPS proxy |
| Target HTTPS Proxy | SSL termination |
| URL Map | Path-based routing |
| Backend Services | Pod group configuration |
| NEG (Network Endpoint Group) | Direct pod IP routing |
| Health Checks | Pod health monitoring |

---

## What is a Load Balancer

### The Problem It Solves

Without a load balancer:

```
                    ┌─────────────┐
                    │   Pod 1     │ ← All traffic here
                    └─────────────┘
                    ┌─────────────┐
Cloudflare ───────► │   Pod 2     │ ← No traffic (unused)
                    └─────────────┘
                    ┌─────────────┐
                    │   Pod 3     │ ← No traffic (unused)
                    └─────────────┘

Problems:
- Single point of failure
- Pod 1 overloaded
- Can't scale horizontally
- If Pod 1 dies, everything dies
```

With a load balancer:

```
                                        ┌─────────────┐
                                   ┌───►│   Pod 1     │
                                   │    └─────────────┘
                    ┌──────────┐   │    ┌─────────────┐
Cloudflare ────────►│   Load   │───┼───►│   Pod 2     │
                    │ Balancer │   │    └─────────────┘
                    └──────────┘   │    ┌─────────────┐
                                   └───►│   Pod 3     │
                                        └─────────────┘

Benefits:
- Traffic distributed evenly
- High availability (pods can fail)
- Horizontal scaling
- Health monitoring
```

### Core Functions

| Function | Description |
|----------|-------------|
| **Traffic Distribution** | Spread requests across multiple pods |
| **High Availability** | Automatic failover when pods die |
| **SSL Termination** | Handle HTTPS encryption/decryption |
| **Health Checking** | Detect and avoid unhealthy pods |
| **Session Affinity** | Sticky sessions for WebSocket |
| **Path Routing** | Route different paths to different services |

---

## GCP Load Balancer Types

### Available Options

| Type | Layer | Protocol | Global | Use Case |
|------|-------|----------|--------|----------|
| **External HTTP(S)** | 7 | HTTP/HTTPS | ✅ Yes | Web apps, APIs |
| **External TCP Proxy** | 4 | TCP | ✅ Yes | Non-HTTP TCP |
| **External SSL Proxy** | 4 | SSL/TLS | ✅ Yes | SSL termination |
| **External Network** | 4 | TCP/UDP | ❌ Regional | High performance |
| **Internal HTTP(S)** | 7 | HTTP/HTTPS | ❌ Regional | Private services |
| **Internal TCP/UDP** | 4 | TCP/UDP | ❌ Regional | Internal apps |

### Our Choice: External HTTP(S) Load Balancer

**Why we use it:**

| Requirement | HTTP(S) LB Support |
|-------------|-------------------|
| Path-based routing (`/api/*`, `/socket.io/*`) | ✅ Yes (Layer 7) |
| Global anycast IP | ✅ Yes |
| WebSocket support | ✅ Yes |
| GKE integration | ✅ Native |
| SSL termination | ✅ Yes |
| Health checks | ✅ Yes |
| Session affinity | ✅ Yes |

### Layer 4 vs Layer 7

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 4 vs LAYER 7                                    │
└─────────────────────────────────────────────────────────────────────────────┘

LAYER 4 (Transport Layer):
─────────────────────────────────────────────────────────────────────────────
- Sees: IP addresses, ports, TCP/UDP
- Cannot see: HTTP headers, paths, cookies
- Routing: Based on IP:port only
- Example: "Send all traffic on port 443 to backend"

LAYER 7 (Application Layer):
─────────────────────────────────────────────────────────────────────────────
- Sees: Everything Layer 4 sees PLUS HTTP content
- Can see: Headers, paths, cookies, host
- Routing: Based on any HTTP attribute
- Example: "Send /api/* to API service, /socket.io/* to WS service"

For Hodl.fun: Layer 7 is required for path-based routing
```

---

## Load Balancer Components

### Complete Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GCP HTTP(S) LOAD BALANCER COMPONENTS                      │
└─────────────────────────────────────────────────────────────────────────────┘

                         From Cloudflare
                               │
                               ▼
              ┌────────────────────────────────┐
              │       GLOBAL STATIC IP         │
              │                                │
              │   Single anycast IP address    │
              │   Example: 34.120.123.45       │
              │                                │
              │   This IP is configured in     │
              │   Cloudflare DNS settings      │
              └───────────────┬────────────────┘
                              │
                              │ Port 443
                              ▼
              ┌────────────────────────────────┐
              │       FORWARDING RULE          │
              │                                │
              │   Maps: IP:Port → Target       │
              │                                │
              │   34.120.123.45:443            │
              │        ↓                       │
              │   target-https-proxy           │
              └───────────────┬────────────────┘
                              │
                              ▼
              ┌────────────────────────────────┐
              │     TARGET HTTPS PROXY         │
              │                                │
              │   1. SSL Termination           │
              │      - Decrypts HTTPS          │
              │      - Validates certificate   │
              │                                │
              │   2. References:               │
              │      - SSL Certificate         │
              │      - URL Map                 │
              └───────────────┬────────────────┘
                              │
                              │ Decrypted HTTP
                              ▼
              ┌────────────────────────────────┐
              │          URL MAP               │
              │                                │
              │   Routes by path:              │
              │                                │
              │   /socket.io/* → ws-backend    │
              │   /api/*       → api-backend   │
              │   /health/*    → api-backend   │
              │   /*           → api-backend   │
              └───────────────┬────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│   BACKEND SERVICE     │           │   BACKEND SERVICE     │
│      (API)            │           │    (WebSocket)        │
│                       │           │                       │
│ Protocol: HTTP        │           │ Protocol: HTTP        │
│ Port: 3000            │           │ Port: 3001            │
│ Timeout: 30s          │           │ Timeout: 3600s        │
│ Session: NONE         │           │ Session: COOKIE       │
│ Balancing: ROUND_ROBIN│           │ Balancing: ROUND_ROBIN│
└───────────┬───────────┘           └───────────┬───────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│    HEALTH CHECK       │           │    HEALTH CHECK       │
│                       │           │                       │
│ Path: /health/ready   │           │ Path: /health/ready   │
│ Port: 3000            │           │ Port: 3001            │
│ Interval: 10s         │           │ Interval: 10s         │
│ Timeout: 5s           │           │ Timeout: 5s           │
│ Healthy: 2 checks     │           │ Healthy: 2 checks     │
│ Unhealthy: 3 checks   │           │ Unhealthy: 3 checks   │
└───────────┬───────────┘           └───────────┬───────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│         NEG           │           │         NEG           │
│  (Network Endpoint    │           │  (Network Endpoint    │
│       Group)          │           │       Group)          │
│                       │           │                       │
│ Pod IPs:              │           │ Pod IPs:              │
│ - 10.0.1.15:3000      │           │ - 10.0.2.20:3001      │
│ - 10.0.1.16:3000      │           │ - 10.0.2.21:3001      │
│ - 10.0.1.17:3000      │           │ - 10.0.2.22:3001      │
└───────────┬───────────┘           └───────────┬───────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────┐
│      API PODS         │           │   WEBSOCKET PODS      │
│    ┌───┐ ┌───┐ ┌───┐  │           │   ┌───┐ ┌───┐ ┌───┐   │
│    │ 1 │ │ 2 │ │ 3 │  │           │   │ 1 │ │ 2 │ │ 3 │   │
│    └───┘ └───┘ └───┘  │           │   └───┘ └───┘ └───┘   │
└───────────────────────┘           └───────────────────────┘
```

### Component Details

#### 1. Global Static IP

A single IP address that Cloudflare connects to.

```
Properties:
─────────────────────────────────────────────────────────────────────────────
Type:           External, Global
Address:        34.120.xxx.xxx (assigned by GCP)
Anycast:        Yes (traffic routed to nearest GCP edge)
Cost:           ~$0.01/hour when not attached to resource
```

**Why Anycast Matters:**

```
Without Anycast (Regional IP):
─────────────────────────────────────────────────────────────────────────────
User (Tokyo) ──────────────────────────────────────────► GCP (US-Central)
                         Long distance = High latency


With Anycast (Global IP):
─────────────────────────────────────────────────────────────────────────────
User (Tokyo) ────► GCP Edge (Tokyo) ────► GCP (US-Central)
                   Enters GCP network     Fast internal network
                   closest to user
```

#### 2. Forwarding Rule

Maps the external IP and port to a target proxy.

```
Configuration:
─────────────────────────────────────────────────────────────────────────────
Name:           hodlfun-https-rule
IP Address:     34.120.xxx.xxx (references global IP)
Port Range:     443
Target:         hodlfun-https-proxy
Network Tier:   Premium (for global)
```

#### 3. Target HTTPS Proxy

Handles SSL/TLS termination.

```
Configuration:
─────────────────────────────────────────────────────────────────────────────
Name:           hodlfun-https-proxy
SSL Certificate: hodlfun-cert (Google-managed or Cloudflare origin)
URL Map:        hodlfun-url-map
```

**SSL Certificate Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Google-Managed** | Auto-renewal, free | Needs DNS validation |
| **Cloudflare Origin** | Works immediately, 15-year validity | Manual upload |
| **Self-Signed** | Quick setup | Only with Cloudflare Full (not Strict) |

**Recommendation:** Use Cloudflare Origin Certificate for simplicity.

#### 4. URL Map

Routes requests to different backend services based on path.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           URL MAP RULES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Priority    Path Match              Backend Service         Description
─────────────────────────────────────────────────────────────────────────────
1           /socket.io/*            websocket-backend       WebSocket/Socket.IO
2           /api/*                  api-backend             REST API endpoints
3           /health/*               api-backend             Health checks
4           /* (default)            api-backend             Catch-all
─────────────────────────────────────────────────────────────────────────────

Request: GET /api/v1/tokens
Match:   Rule 2 (/api/*)
Route:   api-backend

Request: GET /socket.io/?EIO=4&transport=websocket
Match:   Rule 1 (/socket.io/*)
Route:   websocket-backend
```

#### 5. Backend Service

Defines how traffic is handled for a group of pods.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICE CONFIGURATION                           │
└─────────────────────────────────────────────────────────────────────────────┘

                        API Backend              WebSocket Backend
─────────────────────────────────────────────────────────────────────────────
Name                    api-backend-service      websocket-backend-service
Protocol                HTTP                     HTTP
Port                    3000                     3001
Timeout                 30 seconds               3600 seconds (1 hour)
Session Affinity        NONE                     GENERATED_COOKIE
Affinity TTL            N/A                      3600 seconds
Balancing Mode          RATE                     RATE
Max Rate per Endpoint   100 RPS                  100 RPS
Connection Draining     300 seconds              300 seconds
─────────────────────────────────────────────────────────────────────────────
```

**Session Affinity Explained:**

```
Without Session Affinity (API):
─────────────────────────────────────────────────────────────────────────────
Request 1 from User A ──► Pod 1
Request 2 from User A ──► Pod 3  (different pod - OK for stateless API)
Request 3 from User A ──► Pod 2


With Session Affinity (WebSocket):
─────────────────────────────────────────────────────────────────────────────
Request 1 from User A ──► Pod 1 ──► Cookie: GCLB=abc123
Request 2 from User A ──► Pod 1  (same pod - required for WebSocket)
Request 3 from User A ──► Pod 1

Cookie ensures all requests from same client go to same pod.
Critical for WebSocket because connection is persistent.
```

#### 6. Health Check

Continuously monitors pod health.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HEALTH CHECK FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Every 10 seconds, Load Balancer sends:
─────────────────────────────────────────────────────────────────────────────

    GET /health/ready HTTP/1.1
    Host: <pod-ip>
    User-Agent: GoogleHC/1.0

                    │
                    ▼
            ┌───────────────┐
            │     Pod       │
            │               │
            │  Checks:      │
            │  - DB conn    │
            │  - Redis conn │
            │  - Memory     │
            └───────┬───────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   200 OK                  503 Error
   {"status":"ok"}         or Timeout
        │                       │
        ▼                       ▼
   Pod HEALTHY             Pod UNHEALTHY
   (receives traffic)      (no traffic)


Health Check Thresholds:
─────────────────────────────────────────────────────────────────────────────
Healthy Threshold:     2 consecutive successes → Mark as HEALTHY
Unhealthy Threshold:   3 consecutive failures → Mark as UNHEALTHY
Check Interval:        10 seconds
Timeout:               5 seconds per check
```

#### 7. NEG (Network Endpoint Group)

Links backend service directly to pod IPs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL vs CONTAINER-NATIVE LB                        │
└─────────────────────────────────────────────────────────────────────────────┘

TRADITIONAL (without NEG):
─────────────────────────────────────────────────────────────────────────────

Load Balancer
      │
      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    Node 1    │      │    Node 2    │      │    Node 3    │
│  NodePort    │      │  NodePort    │      │  NodePort    │
│   :30080     │      │   :30080     │      │   :30080     │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       ▼                     ▼                     ▼
   kube-proxy            kube-proxy            kube-proxy
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│    Pod       │      │    Pod       │      │    Pod       │
└──────────────┘      └──────────────┘      └──────────────┘

Problems:
- Extra network hop through kube-proxy
- Node can forward to pod on different node
- Double NAT
- Less efficient


CONTAINER-NATIVE (with NEG):
─────────────────────────────────────────────────────────────────────────────

Load Balancer
      │
      │  Direct to Pod IPs (bypasses kube-proxy)
      │
      ├─────────────────────────────────────────────────────────┐
      │                          │                              │
      ▼                          ▼                              ▼
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│    Pod 1     │          │    Pod 2     │          │    Pod 3     │
│  10.0.1.15   │          │  10.0.1.16   │          │  10.0.1.17   │
└──────────────┘          └──────────────┘          └──────────────┘

Benefits:
- Direct pod addressing
- No extra hops
- Better performance
- Accurate health checks per pod
- Required for GKE Autopilot
```

**How NEG Gets Pod IPs:**

```
1. You create a Kubernetes Service with NEG annotation
2. GKE controller watches for pod changes
3. When pods are created/deleted, NEG is automatically updated
4. Load balancer always has current pod IPs

Service Annotation:
  cloud.google.com/neg: '{"ingress": true}'
```

---

## Traffic Flow: Cloudflare to Pods

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE REQUEST FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: CLOUDFLARE SENDS REQUEST
═══════════════════════════════════════════════════════════════════════════════

Cloudflare Edge Server (Singapore)
        │
        │  HTTPS Request to: 34.120.xxx.xxx:443
        │
        │  Headers:
        │  ─────────────────────────────────────────────────────────
        │  Host: api.hodlfun.io
        │  CF-Connecting-IP: 103.45.67.89  (user's real IP)
        │  CF-IPCountry: SG                 (user's country)
        │  CF-Ray: 7a1234567890abcd-SIN     (request ID)
        │  X-Forwarded-For: 103.45.67.89
        │  X-Forwarded-Proto: https
        │  ─────────────────────────────────────────────────────────
        │
        │  Body: (depends on request)
        │
        ▼

STEP 2: GCP GLOBAL IP RECEIVES
═══════════════════════════════════════════════════════════════════════════════

Global Static IP: 34.120.xxx.xxx
        │
        │  Anycast routing: Traffic enters GCP at nearest edge
        │  In this case: GCP Singapore edge
        │
        ▼

STEP 3: FORWARDING RULE MATCHES
═══════════════════════════════════════════════════════════════════════════════

Forwarding Rule: hodlfun-https-rule
        │
        │  Match: IP=34.120.xxx.xxx, Port=443
        │  Action: Send to target-https-proxy
        │
        ▼

STEP 4: HTTPS PROXY TERMINATES SSL
═══════════════════════════════════════════════════════════════════════════════

Target HTTPS Proxy: hodlfun-https-proxy
        │
        │  1. TLS Handshake with Cloudflare
        │  2. Validate certificate
        │  3. Decrypt request
        │  4. Pass decrypted HTTP to URL Map
        │
        │  After this point: HTTP (not HTTPS)
        │  This is safe - it's inside GCP's network
        │
        ▼

STEP 5: URL MAP ROUTES BY PATH
═══════════════════════════════════════════════════════════════════════════════

URL Map: hodlfun-url-map
        │
        │  Request path: /api/v1/tokens
        │
        │  Evaluate rules:
        │  ┌─────────────────────────────────────────────────────────┐
        │  │ /socket.io/* ? NO                                      │
        │  │ /api/*       ? YES ← Match!                            │
        │  │ Route to: api-backend-service                          │
        │  └─────────────────────────────────────────────────────────┘
        │
        ▼

STEP 6: BACKEND SERVICE SELECTS POD
═══════════════════════════════════════════════════════════════════════════════

Backend Service: api-backend-service
        │
        │  1. Check session affinity: NONE (no sticky session)
        │  2. Get healthy endpoints from NEG
        │  3. Apply load balancing algorithm (round-robin)
        │
        │  Healthy pods in NEG:
        │  ┌─────────────────────────────────────────────────────────┐
        │  │ 10.0.1.15:3000 ✓ healthy                               │
        │  │ 10.0.1.16:3000 ✓ healthy ← Selected (round-robin)      │
        │  │ 10.0.1.17:3000 ✗ unhealthy (skipped)                   │
        │  └─────────────────────────────────────────────────────────┘
        │
        ▼

STEP 7: REQUEST SENT TO POD
═══════════════════════════════════════════════════════════════════════════════

Direct to Pod IP: 10.0.1.16:3000
        │
        │  HTTP Request (decrypted):
        │  ─────────────────────────────────────────────────────────
        │  GET /api/v1/tokens HTTP/1.1
        │  Host: api.hodlfun.io
        │  CF-Connecting-IP: 103.45.67.89
        │  CF-IPCountry: SG
        │  CF-Ray: 7a1234567890abcd-SIN
        │  X-Forwarded-For: 103.45.67.89
        │  X-Forwarded-Proto: https
        │  ─────────────────────────────────────────────────────────
        │
        ▼

STEP 8: POD PROCESSES REQUEST
═══════════════════════════════════════════════════════════════════════════════

API Pod (10.0.1.16)
        │
        │  NestJS Application:
        │  1. Real IP Middleware: Extract CF-Connecting-IP
        │  2. Rate Limit Guard: Check limits for 103.45.67.89
        │  3. Auth Guard: Validate JWT (if required)
        │  4. Controller: TokenController.findAll()
        │  5. Service: Query database/cache
        │  6. Return response
        │
        │  Response:
        │  ─────────────────────────────────────────────────────────
        │  HTTP/1.1 200 OK
        │  Content-Type: application/json
        │  Cache-Control: no-store
        │
        │  {"success":true,"data":[...],"meta":{...}}
        │  ─────────────────────────────────────────────────────────
        │
        ▼

STEP 9: RESPONSE RETURNS
═══════════════════════════════════════════════════════════════════════════════

Response flows back:
        │
        │  Pod → Load Balancer → Cloudflare → User
        │
        │  Cloudflare may:
        │  - Add headers (CF-Ray, etc.)
        │  - Cache (if Cache-Control allows)
        │  - Compress (if not already)
        │
        ▼

DONE ✓
```

### WebSocket Connection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET CONNECTION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: INITIAL HTTP REQUEST (Upgrade)
═══════════════════════════════════════════════════════════════════════════════

Client Browser
        │
        │  GET /socket.io/?EIO=4&transport=websocket HTTP/1.1
        │  Host: api.hodlfun.io
        │  Connection: Upgrade
        │  Upgrade: websocket
        │  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
        │  Sec-WebSocket-Version: 13
        │
        ▼

STEP 2: ROUTED TO WEBSOCKET BACKEND
═══════════════════════════════════════════════════════════════════════════════

URL Map matches: /socket.io/*
        │
        │  Route to: websocket-backend-service
        │
        ▼

STEP 3: STICKY SESSION COOKIE SET
═══════════════════════════════════════════════════════════════════════════════

Backend Service: websocket-backend-service
        │
        │  Session Affinity: GENERATED_COOKIE
        │  
        │  First request from this client:
        │  1. Select pod (e.g., 10.0.2.20)
        │  2. Generate cookie: GCLB=<encoded-pod-info>
        │  3. Set cookie in response
        │
        ▼

STEP 4: WEBSOCKET UPGRADE
═══════════════════════════════════════════════════════════════════════════════

WebSocket Pod (10.0.2.20)
        │
        │  Response:
        │  ─────────────────────────────────────────────────────────
        │  HTTP/1.1 101 Switching Protocols
        │  Upgrade: websocket
        │  Connection: Upgrade
        │  Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
        │  Set-Cookie: GCLB=abc123; Path=/; HttpOnly
        │  ─────────────────────────────────────────────────────────
        │
        │  Connection upgraded to WebSocket
        │
        ▼

STEP 5: PERSISTENT CONNECTION
═══════════════════════════════════════════════════════════════════════════════

        Client                              Pod 10.0.2.20
           │                                      │
           │◄────── WebSocket Connection ────────►│
           │         (Bidirectional)              │
           │                                      │
           │  subscribe: trade:0xabc123           │
           │─────────────────────────────────────►│
           │                                      │
           │         trade event                  │
           │◄─────────────────────────────────────│
           │                                      │
           │         trade event                  │
           │◄─────────────────────────────────────│
           │                                      │

All future requests with GCLB cookie go to same pod (10.0.2.20)


STEP 6: CONNECTION TIMEOUT
═══════════════════════════════════════════════════════════════════════════════

Backend service timeout: 3600 seconds (1 hour)
        │
        │  If no activity for 1 hour:
        │  - Load balancer closes connection
        │  - Client must reconnect
        │
        │  Socket.IO handles this with:
        │  - Ping/pong every 25 seconds
        │  - Automatic reconnection
        │
        ▼
```

---

## GKE Integration

### How GKE Creates Load Balancer Resources

When you deploy a Kubernetes Ingress, GKE automatically creates all load balancer components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GKE INGRESS → LOAD BALANCER MAPPING                       │
└─────────────────────────────────────────────────────────────────────────────┘

You Create (Kubernetes):                 GKE Creates (GCP):
─────────────────────────────────────────────────────────────────────────────

┌─────────────────────┐                 ┌─────────────────────┐
│      Ingress        │ ───────────────►│   URL Map           │
│                     │                 │   HTTPS Proxy       │
│  annotations:       │                 │   Forwarding Rule   │
│    static-ip: xxx   │                 │   SSL Certificate   │
│    managed-cert: xxx│                 │                     │
└─────────────────────┘                 └─────────────────────┘

┌─────────────────────┐                 ┌─────────────────────┐
│     Service         │ ───────────────►│   Backend Service   │
│                     │                 │   Health Check      │
│  annotations:       │                 │   NEG               │
│    neg: true        │                 │                     │
│    backend-config   │                 │                     │
└─────────────────────┘                 └─────────────────────┘

┌─────────────────────┐                 ┌─────────────────────┐
│   BackendConfig     │ ───────────────►│   Backend Service   │
│                     │                 │   Settings          │
│  sessionAffinity    │                 │   (timeout,         │
│  timeoutSec         │                 │    affinity, etc.)  │
│  healthCheck        │                 │                     │
└─────────────────────┘                 └─────────────────────┘

┌─────────────────────┐                 ┌─────────────────────┐
│ ManagedCertificate  │ ───────────────►│   SSL Certificate   │
│                     │                 │   (auto-provisioned │
│  domains:           │                 │    and renewed)     │
│    - api.hodlfun.io │                 │                     │
└─────────────────────┘                 └─────────────────────┘
```

### Resource Creation Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESOURCE CREATION TIMELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

Time 0:00 - Apply manifests
─────────────────────────────────────────────────────────────────────────────
kubectl apply -f ingress.yaml
kubectl apply -f services.yaml
kubectl apply -f backend-configs.yaml
kubectl apply -f managed-certificate.yaml


Time 0:01 - GKE controller starts
─────────────────────────────────────────────────────────────────────────────
GKE sees new Ingress resource
Begins creating GCP resources


Time 0:05 - Load balancer components created
─────────────────────────────────────────────────────────────────────────────
✓ URL Map created
✓ Backend Services created
✓ NEGs created and populated with pod IPs
✓ Health Checks created
✓ Forwarding Rule created


Time 5:00 - SSL certificate provisioning (if Google-managed)
─────────────────────────────────────────────────────────────────────────────
Certificate status: PROVISIONING
Google validates domain ownership
(This can take 10-60 minutes)


Time 15:00 - Certificate active
─────────────────────────────────────────────────────────────────────────────
Certificate status: ACTIVE
HTTPS traffic now works


Time 15:01 - Health checks pass
─────────────────────────────────────────────────────────────────────────────
Pods marked as HEALTHY
Load balancer starts sending traffic
```

---

## WebSocket Configuration

### Why WebSocket Needs Special Config

| Requirement | Standard HTTP | WebSocket |
|-------------|---------------|-----------|
| Connection Duration | Milliseconds | Hours |
| Session Affinity | Not needed | Required |
| Timeout | 30 seconds | 3600+ seconds |
| Protocol | Request-Response | Bidirectional |

### BackendConfig for WebSocket

```yaml
# backend-config-websocket.yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: websocket-backend-config
spec:
  # ─────────────────────────────────────────────────────────────────────────
  # STICKY SESSIONS
  # WebSocket connections must always go to the same pod
  # ─────────────────────────────────────────────────────────────────────────
  sessionAffinity:
    affinityType: "GENERATED_COOKIE"
    affinityCookieTtlSec: 3600  # Cookie valid for 1 hour
  
  # ─────────────────────────────────────────────────────────────────────────
  # TIMEOUT
  # WebSocket connections are long-lived
  # Default 30s would disconnect users constantly
  # ─────────────────────────────────────────────────────────────────────────
  timeoutSec: 3600  # 1 hour
  
  # ─────────────────────────────────────────────────────────────────────────
  # CONNECTION DRAINING
  # When pod is terminating, give time for graceful disconnect
  # ─────────────────────────────────────────────────────────────────────────
  connectionDraining:
    drainingTimeoutSec: 300  # 5 minutes
  
  # ─────────────────────────────────────────────────────────────────────────
  # HEALTH CHECK
  # Custom health check for WebSocket pods
  # ─────────────────────────────────────────────────────────────────────────
  healthCheck:
    checkIntervalSec: 10
    timeoutSec: 5
    healthyThreshold: 2
    unhealthyThreshold: 3
    type: HTTP
    requestPath: /health/ready
    port: 3001
```

### BackendConfig for API

```yaml
# backend-config-api.yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: api-backend-config
spec:
  # No session affinity - API is stateless
  
  # Standard timeout for REST API
  timeoutSec: 30
  
  # Connection draining
  connectionDraining:
    drainingTimeoutSec: 300
  
  # Health check
  healthCheck:
    checkIntervalSec: 10
    timeoutSec: 5
    healthyThreshold: 2
    unhealthyThreshold: 3
    type: HTTP
    requestPath: /health/ready
    port: 3000
```

---

## Internal Service Communication

### Service Types in Our Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SERVICE TYPES                                             │
└─────────────────────────────────────────────────────────────────────────────┘

EXTERNAL SERVICES (Receive traffic from Load Balancer):
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: api-service                                                       │
│  Type: ClusterIP (with NEG annotation)                                      │
│  Exposed to: Load Balancer via NEG                                          │
│  Port: 3000                                                                 │
│  Pods: api-deployment                                                       │
│                                                                             │
│  Handles:                                                                   │
│  - REST API requests                                                        │
│  - Health checks                                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: websocket-service                                                 │
│  Type: ClusterIP (with NEG annotation)                                      │
│  Exposed to: Load Balancer via NEG                                          │
│  Port: 3001                                                                 │
│  Pods: websocket-deployment                                                 │
│                                                                             │
│  Handles:                                                                   │
│  - Socket.IO connections                                                    │
│  - Real-time events                                                         │
└─────────────────────────────────────────────────────────────────────────────┘


INTERNAL SERVICES (No external access):
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: indexer-service (OPTIONAL)                                        │
│  Type: ClusterIP (NO NEG annotation)                                        │
│  Exposed to: Only internal cluster                                          │
│  Port: 3002                                                                 │
│  Pods: indexer-deployment                                                   │
│                                                                             │
│  Note: Indexer doesn't need a Service unless other pods need to call it.   │
│  It only connects OUTBOUND to RPC, Redis, PostgreSQL.                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Service: worker-service (OPTIONAL)                                         │
│  Type: ClusterIP (NO NEG annotation)                                        │
│  Exposed to: Only internal cluster                                          │
│  Port: 3003                                                                 │
│  Pods: worker-deployment                                                    │
│                                                                             │
│  Note: Worker doesn't need a Service. It only polls Redis for jobs          │
│  and connects OUTBOUND to Redis, PostgreSQL.                                │
└─────────────────────────────────────────────────────────────────────────────┘


MANAGED SERVICES (Outside GKE):
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  Cloud SQL (PostgreSQL)                                                     │
│  Connection: Private IP (10.x.x.x)                                          │
│  Port: 5432                                                                 │
│  Access: Any pod via Private Service Connect                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Memorystore (Redis)                                                        │
│  Connection: Private IP (10.x.x.x)                                          │
│  Port: 6379                                                                 │
│  Access: Any pod via VPC peering                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Communication Patterns

#### Pattern 1: API → Redis (Caching)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API → REDIS (CACHING)                                     │
└─────────────────────────────────────────────────────────────────────────────┘

User Request: GET /api/v1/tokens/0x123
        │
        ▼
┌─────────────────┐
│    API Pod      │
│                 │
│  1. Check cache │
│                 │
└────────┬────────┘
         │
         │ GET token:0x123
         ▼
┌─────────────────┐         ┌─────────────────┐
│  Memorystore    │         │  Cloud SQL      │
│  (Redis)        │         │  (PostgreSQL)   │
│                 │         │                 │
│  Cache HIT?     │         │                 │
│  ┌─────┬─────┐  │         │                 │
│  │ YES │ NO  │  │         │                 │
│  └──┬──┴──┬──┘  │         │                 │
│     │     │     │         │                 │
└─────┼─────┼─────┘         └────────┬────────┘
      │     │                        │
      │     │  SELECT * FROM tokens  │
      │     │  WHERE address = 0x123 │
      │     └────────────────────────►
      │                              │
      │     ◄────────────────────────┘
      │              Result
      │
      │  SET token:0x123 (TTL: 60s)
      │─────────────────────────────►
      │
      ▼
Return to user
```

#### Pattern 2: Indexer → Redis → WebSocket (Pub/Sub)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INDEXER → REDIS → WEBSOCKET (PUB/SUB)                     │
└─────────────────────────────────────────────────────────────────────────────┘

Blockchain Event: New trade on token 0x123
        │
        ▼
┌─────────────────┐
│  Indexer Pod    │
│                 │
│  1. Parse event │
│  2. Save to DB  │
│  3. Publish     │
│                 │
└────────┬────────┘
         │
         │ PUBLISH trade:0x123 {"price": 0.05, "amount": 100}
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEMORYSTORE (REDIS)                                  │
│                                                                             │
│   Channel: trade:0x123                                                      │
│                                                                             │
│   Subscribers:                                                              │
│   - websocket-pod-1 ✓                                                       │
│   - websocket-pod-2 ✓                                                       │
│   - websocket-pod-3 ✓                                                       │
│                                                                             │
│   Broadcast message to all subscribers                                      │
│                                                                             │
└──────────┬───────────────────┬───────────────────┬──────────────────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  WS Pod 1       │  │  WS Pod 2       │  │  WS Pod 3       │
│                 │  │                 │  │                 │
│  Clients:       │  │  Clients:       │  │  Clients:       │
│  - User A (sub) │  │  - User C       │  │  - User E (sub) │
│  - User B       │  │  - User D (sub) │  │  - User F       │
│                 │  │                 │  │                 │
│  Push to A only │  │  Push to D only │  │  Push to E only │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
      User A               User D               User E
   (subscribed)         (subscribed)         (subscribed)


Why This Pattern:
─────────────────────────────────────────────────────────────────────────────
- Indexer doesn't know which WS pod has which user
- Redis Pub/Sub broadcasts to ALL WS pods
- Each WS pod filters for its own connected clients
- Scales horizontally: add more WS pods, they auto-subscribe
```

#### Pattern 3: API → Redis → Worker (Job Queue)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API → REDIS → WORKER (JOB QUEUE)                          │
└─────────────────────────────────────────────────────────────────────────────┘

User Request: POST /api/v1/alerts (create price alert)
        │
        ▼
┌─────────────────┐
│    API Pod      │
│                 │
│  1. Validate    │
│  2. Save to DB  │
│  3. Queue job   │
│                 │
└────────┬────────┘
         │
         │ LPUSH bull:alerts:waiting {alertId: 123, price: 0.05}
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEMORYSTORE (REDIS)                                  │
│                                                                             │
│   BullMQ Queue: alerts                                                      │
│                                                                             │
│   Jobs waiting:                                                             │
│   1. {alertId: 120, price: 0.03} ← oldest                                   │
│   2. {alertId: 121, price: 0.04}                                            │
│   3. {alertId: 122, price: 0.05}                                            │
│   4. {alertId: 123, price: 0.05} ← newest (just added)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         │ Workers poll for jobs (BRPOPLPUSH)
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────┐                      ┌─────────────────┐
│  Worker Pod 1   │                      │  Worker Pod 2   │
│                 │                      │                 │
│  Process job:   │                      │  Process job:   │
│  1. Get price   │                      │  1. Get price   │
│  2. Compare     │                      │  2. Compare     │
│  3. Send alert  │                      │  3. Send alert  │
│     if matched  │                      │     if matched  │
└─────────────────┘                      └─────────────────┘


BullMQ ensures:
─────────────────────────────────────────────────────────────────────────────
- Each job processed exactly once
- Failed jobs can be retried
- Jobs can be delayed or scheduled
- Progress tracking
- Concurrency control
```

---

## Network Security

### Firewall Rules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NETWORK SECURITY LAYERS                                   │
└─────────────────────────────────────────────────────────────────────────────┘

LAYER 1: CLOUDFLARE (Edge)
═══════════════════════════════════════════════════════════════════════════════
- DDoS protection
- WAF rules
- Rate limiting
- Bot detection


LAYER 2: GCP FIREWALL
═══════════════════════════════════════════════════════════════════════════════

Rule: allow-cloudflare-only
─────────────────────────────────────────────────────────────────────────────
Direction:      INGRESS
Priority:       1000
Source:         Cloudflare IP ranges only
                173.245.48.0/20
                103.21.244.0/22
                103.22.200.0/22
                ... (see Cloudflare doc)
Destination:    Load Balancer IP
Ports:          443
Action:         ALLOW


Rule: deny-all-other-ingress
─────────────────────────────────────────────────────────────────────────────
Direction:      INGRESS
Priority:       2000
Source:         0.0.0.0/0
Destination:    Load Balancer IP
Ports:          80, 443
Action:         DENY

Result: Only Cloudflare can reach the load balancer.
        Direct attacks to GCP IP are blocked.


LAYER 3: GKE NETWORK POLICY
═══════════════════════════════════════════════════════════════════════════════

Policy: api-network-policy
─────────────────────────────────────────────────────────────────────────────
Allow:
- Ingress from Load Balancer health checks
- Egress to Redis (10.x.x.x:6379)
- Egress to PostgreSQL (10.x.x.x:5432)
- Egress to DNS (kube-dns)

Deny:
- All other ingress
- All other egress


Policy: indexer-network-policy
─────────────────────────────────────────────────────────────────────────────
Allow:
- Egress to Redis (10.x.x.x:6379)
- Egress to PostgreSQL (10.x.x.x:5432)
- Egress to Push Chain RPC (internet via Cloud NAT)
- Egress to DNS (kube-dns)

Deny:
- ALL ingress (indexer receives no incoming traffic)
- All other egress


LAYER 4: APPLICATION (NestJS)
═══════════════════════════════════════════════════════════════════════════════
- Rate limiting (per IP via CF-Connecting-IP)
- Authentication (JWT)
- Authorization (guards)
- Input validation (DTOs)
```

### What Can Talk to What

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALLOWED COMMUNICATION MATRIX                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    │ API   WS    Indexer Worker Redis  PG    Internet
────────────────────┼──────────────────────────────────────────────────
Load Balancer  →    │  ✓     ✓      ✗      ✗      ✗     ✗      ─
API Pod        →    │  ─     ✗      ✗      ✗      ✓     ✓      ✗
WebSocket Pod  →    │  ✗     ─      ✗      ✗      ✓     ✓      ✗
Indexer Pod    →    │  ✗     ✗      ─      ✗      ✓     ✓      ✓*
Worker Pod     →    │  ✗     ✗      ✗      ─      ✓     ✓      ✗
────────────────────┼──────────────────────────────────────────────────

✓  = Allowed
✗  = Blocked
─  = Self (N/A)
✓* = Only to Push Chain RPC endpoints (via Cloud NAT)


Key Points:
─────────────────────────────────────────────────────────────────────────────
- Pods do NOT talk to each other directly
- All inter-service communication goes through Redis
- Only Indexer needs internet access (for RPC)
- PostgreSQL and Redis are on private IPs
```

---

## Complete Request Examples

### Example 1: User Fetches Token List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            REQUEST: GET /api/v1/tokens?page=1&limit=20                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: USER'S BROWSER                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
User clicks "View Tokens"
Browser: GET https://api.hodlfun.io/api/v1/tokens?page=1&limit=20

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CLOUDFLARE                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
- DDoS check: ✓ Pass
- WAF check: ✓ Pass
- Cache check: ✗ Miss (API not cached)
- Add headers: CF-Connecting-IP, CF-Ray
- Forward to: 34.120.xxx.xxx:443

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: GCP LOAD BALANCER                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
- SSL termination: Decrypt HTTPS
- URL Map: /api/* → api-backend-service
- Health check: 3 pods healthy
- Select pod: 10.0.1.16 (round-robin)
- Forward request

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: API POD (NestJS)                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
RealIpMiddleware:
  - Extract CF-Connecting-IP: 103.45.67.89

RateLimitGuard:
  - Check: 103.45.67.89 has 5/100 requests this minute
  - Result: ✓ Pass

TokenController.findAll():
  - Parse query: page=1, limit=20
  - Call TokenService

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: REDIS (Cache Check)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
GET tokens:list:page:1:limit:20

Result: NULL (cache miss)

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: POSTGRESQL (Database Query)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
SELECT 
  t.address, t.name, t.symbol, t.image_url,
  t.market_cap, t.price, t.volume_24h
FROM tokens t
WHERE t.is_active = true
ORDER BY t.created_at DESC
LIMIT 20 OFFSET 0

Result: 20 token records

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: REDIS (Cache Store)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
SET tokens:list:page:1:limit:20 
    '{"data":[...]}'
    EX 30  (expire in 30 seconds)

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 8: RESPONSE                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "success": true,
  "data": [
    { "address": "0x123...", "name": "Token A", "price": 0.05 },
    { "address": "0x456...", "name": "Token B", "price": 0.12 },
    ...
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

┌─────────────────────────────────────────────────────────────────────────────┐
│ TOTAL TIME: ~50ms                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
- Cloudflare: 5ms
- Load Balancer: 5ms
- API Pod: 10ms
- Redis check: 2ms
- PostgreSQL: 25ms
- Redis store: 2ms
- Response: 1ms
```

### Example 2: Real-Time Trade Update

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            EVENT: New trade on blockchain                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: PUSH CHAIN (Blockchain)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
Block #12345 contains transaction:
- Token: 0xabc123
- Buyer: 0xuser456
- Amount: 1000 tokens
- Price: 0.00005 ETH per token

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: INDEXER POD (Blockchain Watcher)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
WebSocket connection to RPC receives event:
{
  "type": "Trade",
  "token": "0xabc123",
  "buyer": "0xuser456",
  "amount": 1000,
  "price": 0.00005
}

IndexerService.processTrade():
1. Validate event data
2. Calculate new price, market cap
3. Save to PostgreSQL

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: POSTGRESQL (Save Trade)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
BEGIN;

INSERT INTO trades (token_address, buyer, amount, price, tx_hash, block_number)
VALUES ('0xabc123', '0xuser456', 1000, 0.00005, '0xtx...', 12345);

UPDATE tokens 
SET price = 0.00005,
    market_cap = total_supply * 0.00005,
    volume_24h = volume_24h + (1000 * 0.00005),
    last_trade_at = NOW()
WHERE address = '0xabc123';

COMMIT;

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: REDIS (Publish Event)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
PUBLISH channel:trade:0xabc123 
'{
  "type": "trade",
  "token": "0xabc123",
  "price": 0.00005,
  "amount": 1000,
  "buyer": "0xuser456",
  "timestamp": 1706123456789
}'

Subscribers notified:
- websocket-pod-1 ✓
- websocket-pod-2 ✓
- websocket-pod-3 ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: WEBSOCKET PODS (Receive Pub/Sub)                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Each WebSocket pod receives the message:

websocket-pod-1:
  Connected clients: [UserA, UserB, UserC]
  Subscribed to 0xabc123: [UserA, UserC]
  → Push to UserA, UserC

websocket-pod-2:
  Connected clients: [UserD, UserE]
  Subscribed to 0xabc123: [UserE]
  → Push to UserE

websocket-pod-3:
  Connected clients: [UserF, UserG, UserH]
  Subscribed to 0xabc123: []
  → No action (no subscribers)

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: USER BROWSERS (Receive Update)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

UserA, UserC, UserE receive via WebSocket:
{
  "event": "trade",
  "data": {
    "token": "0xabc123",
    "price": 0.00005,
    "amount": 1000,
    "buyer": "0xuser456",
    "timestamp": 1706123456789
  }
}

Frontend updates:
- Price chart adds new data point
- Trade history shows new trade
- Token card shows updated price

┌─────────────────────────────────────────────────────────────────────────────┐
│ TOTAL TIME: ~200ms                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
- Blockchain → Indexer: 100ms (depends on RPC)
- Indexer processing: 20ms
- PostgreSQL write: 30ms
- Redis publish: 5ms
- WebSocket delivery: 40ms
- Frontend render: 5ms
```

### Example 3: WebSocket Connection Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            WEBSOCKET: Full Connection Lifecycle                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CONNECTION                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Browser:
  const socket = io('wss://api.hodlfun.io', {
    transports: ['websocket', 'polling']
  });

Request:
  GET /socket.io/?EIO=4&transport=websocket HTTP/1.1
  Host: api.hodlfun.io
  Connection: Upgrade
  Upgrade: websocket

Load Balancer:
  - URL Map: /socket.io/* → websocket-backend-service
  - Session affinity: Generate cookie GCLB=xyz789
  - Select pod: 10.0.2.20

WebSocket Pod:
  - Accept upgrade
  - Create Socket instance
  - Store in memory: connections.set(socketId, socket)

Response:
  HTTP/1.1 101 Switching Protocols
  Upgrade: websocket
  Connection: Upgrade
  Set-Cookie: GCLB=xyz789; Path=/; HttpOnly

Status: Connected ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: SUBSCRIBE TO TOKEN                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Browser:
  socket.emit('subscribe', { token: '0xabc123' });

WebSocket Pod:
  handleSubscribe(client, { token: '0xabc123' }):
    - Validate token exists
    - Add client to room: 'token:0xabc123'
    - Store subscription: subscriptions.add(socketId, '0xabc123')

Response:
  socket.emit('subscribed', { token: '0xabc123', status: 'ok' });

Status: Subscribed to 0xabc123 ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: RECEIVE EVENTS                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Redis Pub/Sub → WebSocket Pod:
  Message on channel 'trade:0xabc123'

WebSocket Pod:
  handleRedisMessage('trade:0xabc123', data):
    - Get all clients in room 'token:0xabc123'
    - For each client: socket.emit('trade', data)

Browser:
  socket.on('trade', (data) => {
    updateChart(data);
    showNotification(`New trade: ${data.amount} tokens`);
  });

Status: Receiving real-time updates ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: KEEPALIVE (Every 25s)                                               │
└─────────────────────────────────────────────────────────────────────────────┘

Socket.IO Ping/Pong:
  Server → Client: ping
  Client → Server: pong

Purpose:
  - Detect dead connections
  - Keep load balancer connection alive
  - Prevent idle timeout

Status: Connection alive ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: UNSUBSCRIBE                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Browser:
  socket.emit('unsubscribe', { token: '0xabc123' });

WebSocket Pod:
  handleUnsubscribe(client, { token: '0xabc123' }):
    - Remove client from room 'token:0xabc123'
    - Remove from subscriptions

Response:
  socket.emit('unsubscribed', { token: '0xabc123' });

Status: Unsubscribed ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: DISCONNECT                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Browser:
  socket.disconnect();

WebSocket Pod:
  handleDisconnect(client):
    - Remove from all rooms
    - Clear all subscriptions
    - connections.delete(socketId)
    - Log: "Client disconnected: 103.45.67.89"

Status: Disconnected ✓

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: RECONNECTION (If connection drops)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Network issue → Connection lost

Socket.IO client (automatic):
  - Detect disconnect
  - Wait 1s, attempt reconnect
  - Cookie GCLB=xyz789 ensures same pod
  - If pod dead, new cookie, new pod
  - Re-subscribe to previous topics

Status: Reconnected ✓
```

---

## Kubernetes Manifests

### Global Static IP

```yaml
# global-ip.yaml
# Note: This is created via gcloud, not kubectl
# gcloud compute addresses create hodlfun-ip --global

# Reference in Ingress:
# kubernetes.io/ingress.global-static-ip-name: "hodlfun-ip"
```

### Managed Certificate

```yaml
# managed-certificate.yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: hodlfun-cert
  namespace: default
spec:
  domains:
    - api.hodlfun.io
```

### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hodlfun-ingress
  namespace: default
  annotations:
    # Use global static IP
    kubernetes.io/ingress.global-static-ip-name: "hodlfun-ip"
    # Use managed certificate
    networking.gke.io/managed-certificates: "hodlfun-cert"
    # Use GCE ingress controller
    kubernetes.io/ingress.class: "gce"
    # Enable HTTPS redirect (optional, Cloudflare does this)
    kubernetes.io/ingress.allow-http: "false"
spec:
  rules:
    - host: api.hodlfun.io
      http:
        paths:
          # WebSocket route (must be first - more specific)
          - path: /socket.io/*
            pathType: ImplementationSpecific
            backend:
              service:
                name: websocket-service
                port:
                  number: 3001
          # API routes
          - path: /api/*
            pathType: ImplementationSpecific
            backend:
              service:
                name: api-service
                port:
                  number: 3000
          # Health check routes
          - path: /health/*
            pathType: ImplementationSpecific
            backend:
              service:
                name: api-service
                port:
                  number: 3000
          # Default catch-all
          - path: /*
            pathType: ImplementationSpecific
            backend:
              service:
                name: api-service
                port:
                  number: 3000
```

### Backend Configs

```yaml
# backend-config-api.yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: api-backend-config
  namespace: default
spec:
  timeoutSec: 30
  connectionDraining:
    drainingTimeoutSec: 300
  healthCheck:
    checkIntervalSec: 10
    timeoutSec: 5
    healthyThreshold: 2
    unhealthyThreshold: 3
    type: HTTP
    requestPath: /health/ready
    port: 3000
---
# backend-config-websocket.yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: websocket-backend-config
  namespace: default
spec:
  timeoutSec: 3600
  sessionAffinity:
    affinityType: "GENERATED_COOKIE"
    affinityCookieTtlSec: 3600
  connectionDraining:
    drainingTimeoutSec: 300
  healthCheck:
    checkIntervalSec: 10
    timeoutSec: 5
    healthyThreshold: 2
    unhealthyThreshold: 3
    type: HTTP
    requestPath: /health/ready
    port: 3001
```

### Services

```yaml
# api-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: default
  annotations:
    # Enable container-native load balancing
    cloud.google.com/neg: '{"ingress": true}'
    # Reference backend config
    cloud.google.com/backend-config: '{"default": "api-backend-config"}'
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - name: http
      port: 3000
      targetPort: 3000
---
# websocket-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: websocket-service
  namespace: default
  annotations:
    cloud.google.com/neg: '{"ingress": true}'
    cloud.google.com/backend-config: '{"default": "websocket-backend-config"}'
spec:
  type: ClusterIP
  selector:
    app: websocket
  ports:
    - name: http
      port: 3001
      targetPort: 3001
```

---

## Troubleshooting

### Common Issues

#### Issue: 502 Bad Gateway

```
Symptoms:
- Intermittent 502 errors
- Happens during deployments

Causes:
1. Health check failing
2. Pod not ready
3. Backend timeout too short

Solutions:

1. Check health check status:
   kubectl describe ingress hodlfun-ingress
   Look for: "backends" section, should show "HEALTHY"

2. Check pod readiness:
   kubectl get pods -l app=api
   All should be "Running" and "Ready"

3. Check backend service:
   gcloud compute backend-services describe <backend-name> --global
   Look for: healthStatus

4. Increase timeout if needed:
   In BackendConfig: timeoutSec: 60
```

#### Issue: WebSocket Disconnects Frequently

```
Symptoms:
- Users disconnected every 30 seconds
- "transport close" errors

Causes:
1. Backend timeout too short (default 30s)
2. Missing session affinity
3. Pod restarts

Solutions:

1. Check BackendConfig timeout:
   Should be 3600 (1 hour) for WebSocket

2. Verify session affinity:
   kubectl describe backendconfig websocket-backend-config
   Should show: affinityType: GENERATED_COOKIE

3. Check pod stability:
   kubectl get pods -l app=websocket -w
   Watch for restarts
```

#### Issue: Load Balancer Not Created

```
Symptoms:
- Ingress shows no IP address
- kubectl describe ingress shows errors

Causes:
1. Missing static IP
2. Certificate provisioning failed
3. Invalid Ingress spec

Solutions:

1. Check static IP exists:
   gcloud compute addresses list --global
   Should show: hodlfun-ip

2. Check certificate status:
   kubectl describe managedcertificate hodlfun-cert
   Status should be: Active (not Provisioning)

3. Check Ingress events:
   kubectl describe ingress hodlfun-ingress
   Look for error events at bottom
```

#### Issue: Uneven Traffic Distribution

```
Symptoms:
- One pod gets 90% traffic
- Other pods idle

Causes:
1. Session affinity on API (shouldn't be)
2. Health check failing on some pods
3. Capacity imbalance

Solutions:

1. API should NOT have session affinity:
   Check BackendConfig - sessionAffinity should be absent

2. Check all pods healthy:
   kubectl get pods -l app=api
   All should be Ready

3. Check NEG endpoints:
   gcloud compute network-endpoint-groups list
   gcloud compute network-endpoint-groups list-network-endpoints <neg-name> --zone=<zone>
```

### Useful Commands

```bash
# ─────────────────────────────────────────────────────────────────────────────
# INGRESS & LOAD BALANCER
# ─────────────────────────────────────────────────────────────────────────────

# Check Ingress status
kubectl describe ingress hodlfun-ingress

# Get Ingress IP
kubectl get ingress hodlfun-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# List all GCP load balancer components
gcloud compute url-maps list
gcloud compute target-https-proxies list
gcloud compute forwarding-rules list --global
gcloud compute backend-services list --global

# Check backend health
gcloud compute backend-services get-health <backend-service-name> --global


# ─────────────────────────────────────────────────────────────────────────────
# CERTIFICATES
# ─────────────────────────────────────────────────────────────────────────────

# Check managed certificate status
kubectl describe managedcertificate hodlfun-cert

# List SSL certificates
gcloud compute ssl-certificates list


# ─────────────────────────────────────────────────────────────────────────────
# NEGS
# ─────────────────────────────────────────────────────────────────────────────

# List NEGs
gcloud compute network-endpoint-groups list

# Check NEG endpoints (pod IPs)
gcloud compute network-endpoint-groups list-network-endpoints <neg-name> --zone=<zone>


# ─────────────────────────────────────────────────────────────────────────────
# TESTING
# ─────────────────────────────────────────────────────────────────────────────

# Test API endpoint
curl -I https://api.hodlfun.io/health/ready

# Test with verbose SSL
curl -v https://api.hodlfun.io/health/ready

# Test WebSocket
wscat -c wss://api.hodlfun.io/socket.io/?EIO=4&transport=websocket

# Check Cloudflare headers are preserved
curl -s https://api.hodlfun.io/debug/headers | jq
```

---

## Summary

### Load Balancer Components

| Component | Purpose |
|-----------|---------|
| Global Static IP | Single entry point for Cloudflare |
| Forwarding Rule | Routes port 443 to HTTPS proxy |
| HTTPS Proxy | SSL termination |
| URL Map | Path-based routing |
| Backend Services | Pod group configuration |
| NEG | Direct pod IP routing |
| Health Checks | Pod health monitoring |

### Service Configuration

| Service | Port | Timeout | Session Affinity | External |
|---------|------|---------|------------------|----------|
| API | 3000 | 30s | None | Yes (via NEG) |
| WebSocket | 3001 | 3600s | Cookie | Yes (via NEG) |
| Indexer | 3002 | N/A | N/A | No |
| Worker | 3003 | N/A | N/A | No |

### Traffic Flow

```
Cloudflare → Global IP → Forwarding Rule → HTTPS Proxy → URL Map → Backend Service → NEG → Pod
```

### Internal Communication

```
Pods ←→ Redis (Pub/Sub, Cache, Queues)
Pods ←→ PostgreSQL (Data persistence)
Indexer → Internet (Push Chain RPC)
```

### Files to Create

| File | Purpose |
|------|---------|
| `k8s/ingress.yaml` | Ingress resource |
| `k8s/managed-certificate.yaml` | SSL certificate |
| `k8s/backend-config-api.yaml` | API backend settings |
| `k8s/backend-config-websocket.yaml` | WebSocket backend settings |
| `k8s/api-service.yaml` | API service with NEG |
| `k8s/websocket-service.yaml` | WebSocket service with NEG |

### Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Forwarding Rule | ~$18 |
| Data Processing | ~$5-20 (depends on traffic) |
| **Total** | **~$25-40/month** |
