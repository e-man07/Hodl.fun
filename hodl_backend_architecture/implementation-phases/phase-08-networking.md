# Phase 8: Networking & Traffic

## Objective
Configure GCP Load Balancer and Cloudflare for production traffic routing.

## Prerequisites
- Phase 3 completed (GKE cluster)

## Duration: 2-3 days

---

## 8.1 GCP Load Balancer

### Global Static IP

```hcl
# terraform/load-balancer.tf

resource "google_compute_global_address" "main" {
  name = "hodlfun-lb-ip"
}

output "load_balancer_ip" {
  value = google_compute_global_address.main.address
}
```

### Managed SSL Certificate

```hcl
resource "google_compute_managed_ssl_certificate" "main" {
  name = "hodlfun-cert"

  managed {
    domains = [
      "api.hodlfun.io",
      "ws.hodlfun.io",
    ]
  }
}
```

### Kubernetes Ingress

```yaml
# k8s/base/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hodlfun-ingress
  namespace: hodlfun
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "hodlfun-lb-ip"
    networking.gke.io/managed-certificates: "hodlfun-cert"
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.allow-http: "false"
spec:
  rules:
    # API traffic
    - host: api.hodlfun.io
      http:
        paths:
          - path: /api/*
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /health/*
            pathType: ImplementationSpecific
            backend:
              service:
                name: api
                port:
                  number: 80

    # WebSocket traffic
    - host: ws.hodlfun.io
      http:
        paths:
          - path: /*
            pathType: ImplementationSpecific
            backend:
              service:
                name: websocket
                port:
                  number: 80
```

### Backend Configuration for WebSocket

```yaml
# k8s/base/websocket/backend-config.yaml
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: websocket-backend-config
  namespace: hodlfun
spec:
  # Enable WebSocket support
  timeoutSec: 86400  # 24 hours for long-lived connections

  # Session affinity for WebSocket
  sessionAffinity:
    affinityType: "GENERATED_COOKIE"
    affinityCookieTtlSec: 3600

  # Health check
  healthCheck:
    type: HTTP
    requestPath: /health/ready
    port: 3001

  # Connection draining
  connectionDraining:
    drainingTimeoutSec: 60
```

### Services with Backend Config

```yaml
# k8s/base/api/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: hodlfun
  annotations:
    cloud.google.com/neg: '{"ingress": true}'
    cloud.google.com/backend-config: '{"default": "api-backend-config"}'
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
  selector:
    app: api
---
# k8s/base/websocket/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: websocket
  namespace: hodlfun
  annotations:
    cloud.google.com/neg: '{"ingress": true}'
    cloud.google.com/backend-config: '{"default": "websocket-backend-config"}'
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3001
      protocol: TCP
  selector:
    app: websocket
```

---

## 8.2 Cloudflare Configuration

### DNS Records

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | api | (GCP Load Balancer IP) | Proxied |
| A | ws | (GCP Load Balancer IP) | Proxied |
| A | @ | (Frontend hosting IP) | Proxied |

### SSL/TLS Settings

```
SSL/TLS encryption mode: Full (strict)

- Requires valid certificate at origin
- GCP Managed Certificate satisfies this
```

### Page Rules

```yaml
# WebSocket upgrade rule
URL: ws.hodlfun.io/*
Settings:
  - WebSockets: On
  - Rocket Loader: Off
  - Auto Minify: Off

# API caching rule
URL: api.hodlfun.io/api/v1/tokens*
Settings:
  - Cache Level: Bypass
  - Browser Cache TTL: Respect Existing Headers

# Static assets (if applicable)
URL: cdn.hodlfun.io/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
```

### Security Settings

```yaml
# WAF Rules (Free Plan)
Security Level: Medium
Challenge Passage: 30 minutes

# Bot Fight Mode
Enable: Yes

# Rate Limiting (if on paid plan)
Rules:
  - Path: /api/v1/auth/*
    Threshold: 10 requests per minute
    Action: Challenge

  - Path: /api/v1/*
    Threshold: 100 requests per minute
    Action: Challenge
```

### Firewall Rules

```yaml
# Block known bad actors (example)
Rule 1:
  Expression: (ip.geoip.country in {"CN" "RU"}) and (http.request.uri.path contains "/admin")
  Action: Block

# Allow only HTTPS
Rule 2:
  Expression: not ssl
  Action: Block
```

---

## 8.3 Traffic Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE TRAFFIC FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Request: https://api.hodlfun.io/api/v1/tokens
                            │
                            ▼
              ┌─────────────────────────┐
              │      CLOUDFLARE         │
              │                         │
              │  1. DNS Resolution      │
              │  2. DDoS Protection     │
              │  3. WAF Rules           │
              │  4. SSL Termination     │
              │  5. CDN (if applicable) │
              │                         │
              │  Origin: 34.120.x.x     │
              └───────────┬─────────────┘
                          │
                          │ HTTPS (Full Strict)
                          ▼
              ┌─────────────────────────┐
              │   GCP LOAD BALANCER     │
              │                         │
              │  1. SSL Termination     │
              │  2. URL Map Routing     │
              │     /api/* → API        │
              │     /socket.io/* → WS   │
              │  3. Health Checks       │
              │  4. NEG Routing         │
              └───────────┬─────────────┘
                          │
                          │ HTTP (internal)
                          ▼
              ┌─────────────────────────┐
              │      GKE CLUSTER        │
              │                         │
              │  ┌───────────────────┐  │
              │  │   API Service     │  │
              │  │   (3 pods)        │  │
              │  └───────────────────┘  │
              │                         │
              │  ┌───────────────────┐  │
              │  │ WebSocket Service │  │
              │  │   (3 pods)        │  │
              │  └───────────────────┘  │
              │                         │
              └─────────────────────────┘
```

---

## 8.4 NestJS Cloudflare Configuration

### Trust Proxy Headers

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust Cloudflare proxy
  app.set('trust proxy', true);

  // Get real IP from Cloudflare header
  app.use((req, res, next) => {
    req.ip = req.headers['cf-connecting-ip'] || req.ip;
    next();
  });

  await app.listen(3000);
}
```

### Rate Limiting with Real IP

```typescript
// apps/api/src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RedisService } from '@libs/redis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get real IP from Cloudflare
    const ip = request.headers['cf-connecting-ip'] || request.ip;
    const key = `rate-limit:${ip}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    if (count > 100) {
      return false;
    }

    return true;
  }
}
```

---

## 8.5 Verification Checklist

### GCP Load Balancer
- [ ] Global static IP provisioned
- [ ] Managed SSL certificate issued
- [ ] Ingress routing correctly
- [ ] Backend health checks passing
- [ ] WebSocket connections working

### Cloudflare
- [ ] DNS records configured
- [ ] SSL mode set to Full (strict)
- [ ] Page rules active
- [ ] WebSocket support enabled
- [ ] Security settings configured

### End-to-End
- [ ] HTTPS working: `https://api.hodlfun.io/api/v1/health/ready`
- [ ] WebSocket working: `wss://ws.hodlfun.io/events`
- [ ] Real IP extraction working
- [ ] Rate limiting using real IPs

## Testing Commands

```bash
# Check Load Balancer IP
gcloud compute addresses describe hodlfun-lb-ip --global

# Check SSL certificate status
gcloud compute ssl-certificates describe hodlfun-cert

# Check ingress status
kubectl get ingress -n hodlfun

# Check backend health
gcloud compute backend-services get-health hodlfun-api-backend --global

# Test from external
curl -I https://api.hodlfun.io/api/v1/health/ready

# Test WebSocket
wscat -c 'wss://ws.hodlfun.io/events'
```

## Next Phase
Proceed to **Phase 9: CI/CD** to configure GitHub Actions pipelines.
