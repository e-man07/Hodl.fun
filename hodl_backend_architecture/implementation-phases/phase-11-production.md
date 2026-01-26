# Phase 11: Security & Production Readiness

## Objective
Implement authentication, rate limiting, security hardening, and complete go-live checklist.

## Prerequisites
- All previous phases completed

## Duration: 3-5 days

---

## 11.1 Wallet Authentication

### Auth Module

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { WalletAuthService } from './services/wallet-auth.service';
import { JwtAuthService } from './services/jwt-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [WalletAuthService, JwtAuthService, JwtStrategy],
  exports: [JwtAuthService],
})
export class AuthModule {}
```

### Auth Controller

```typescript
// apps/api/src/auth/auth.controller.ts
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { WalletAuthService } from './services/wallet-auth.service';
import { JwtAuthService } from './services/jwt-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private walletAuth: WalletAuthService,
    private jwtAuth: JwtAuthService,
  ) {}

  @Post('nonce')
  async getNonce(@Body('wallet') wallet: string) {
    return this.walletAuth.generateNonce(wallet);
  }

  @Post('verify')
  async verify(@Body() body: { wallet: string; signature: string }) {
    const isValid = await this.walletAuth.verifySignature(body.wallet, body.signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    return this.jwtAuth.generateTokenPair(body.wallet);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.jwtAuth.refreshTokens(refreshToken);
  }
}
```

### Wallet Auth Service

```typescript
// apps/api/src/auth/services/wallet-auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '@libs/redis';

@Injectable()
export class WalletAuthService {
  private readonly noncePrefix = 'auth:nonce:';
  private readonly nonceTtl = 300; // 5 minutes

  constructor(private redis: RedisService) {}

  async generateNonce(wallet: string): Promise<{ nonce: string; message: string; expiresAt: Date }> {
    const normalizedWallet = wallet.toLowerCase();
    const nonce = uuidv4();
    const timestamp = Date.now();

    const message = [
      'Welcome to Hodl.fun!',
      '',
      'Sign this message to verify your wallet.',
      'This will not trigger any blockchain transaction.',
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    await this.redis.set(
      `${this.noncePrefix}${normalizedWallet}`,
      JSON.stringify({ nonce, timestamp }),
      'EX',
      this.nonceTtl,
    );

    return {
      nonce,
      message,
      expiresAt: new Date(Date.now() + this.nonceTtl * 1000),
    };
  }

  async verifySignature(wallet: string, signature: string): Promise<boolean> {
    const normalizedWallet = wallet.toLowerCase();
    const key = `${this.noncePrefix}${normalizedWallet}`;

    const storedData = await this.redis.get(key);
    if (!storedData) {
      throw new UnauthorizedException('Nonce expired or not found');
    }

    const { nonce, timestamp } = JSON.parse(storedData);
    const message = [
      'Welcome to Hodl.fun!',
      '',
      'Sign this message to verify your wallet.',
      'This will not trigger any blockchain transaction.',
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === normalizedWallet;

      if (isValid) {
        await this.redis.del(key); // One-time use
      }

      return isValid;
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
```

### JWT Auth Guard

```typescript
// apps/api/src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
```

---

## 11.2 Rate Limiting

### Rate Limit Guard

```typescript
// apps/api/src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '@libs/redis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private redis: RedisService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    // Get rate limit config from decorator
    const rateLimit = this.reflector.get<{ limit: number; window: number }>('rateLimit', handler);
    const limit = rateLimit?.limit || 100;
    const window = rateLimit?.window || 60;

    // Get real IP (Cloudflare)
    const ip = request.headers['cf-connecting-ip'] || request.ip;
    const key = `rate-limit:${ip}:${request.route?.path || request.url}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, window);
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

    if (count > limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
```

### Rate Limit Decorator

```typescript
// apps/api/src/common/decorators/rate-limit.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RateLimit = (limit: number, window: number = 60) =>
  SetMetadata('rateLimit', { limit, window });
```

### Usage

```typescript
@Controller('auth')
export class AuthController {
  @Post('nonce')
  @RateLimit(10, 60) // 10 requests per minute
  async getNonce(@Body('wallet') wallet: string) {
    // ...
  }
}
```

---

## 11.3 Security Headers

```typescript
// apps/api/src/main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['https://hodlfun.io'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  });

  await app.listen(3000);
}
```

---

## 11.4 Input Validation

```typescript
// apps/api/src/common/pipes/validation.pipe.ts
import { ValidationPipe, BadRequestException } from '@nestjs/common';

export const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => {
    const messages = errors.map(err =>
      Object.values(err.constraints || {}).join(', ')
    );
    return new BadRequestException({
      statusCode: 400,
      message: messages,
      error: 'Validation Error',
    });
  },
});
```

### Address Validation

```typescript
// apps/api/src/common/validators/address.validator.ts
import { registerDecorator, ValidationOptions } from 'class-validator';
import { ethers } from 'ethers';

export function IsEthAddress(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEthAddress',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && ethers.isAddress(value);
        },
        defaultMessage() {
          return '$property must be a valid Ethereum address';
        },
      },
    });
  };
}
```

---

## 11.5 Production Kubernetes Config

### Pod Security Context

```yaml
# k8s/base/api/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: hodlfun
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      serviceAccountName: backend
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001

      containers:
        - name: api
          image: api:latest
          ports:
            - containerPort: 3000

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]

          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"

          env:
            - name: NODE_ENV
              value: "production"

          envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: backend-secrets

          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10

          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}
```

### Network Policies

```yaml
# k8s/base/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: hodlfun
spec:
  podSelector: {}
  policyTypes:
    - Ingress

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress
  namespace: hodlfun
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: gke-system
      ports:
        - protocol: TCP
          port: 3000

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-internal
  namespace: hodlfun
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}
```

---

## 11.6 Go-Live Checklist

### Pre-Launch

- [ ] **Security Audit**
  - [ ] All endpoints require appropriate authentication
  - [ ] Rate limiting configured on all public endpoints
  - [ ] Input validation on all endpoints
  - [ ] SQL injection protection (Prisma)
  - [ ] XSS protection (sanitization)

- [ ] **Infrastructure**
  - [ ] Production database provisioned (HA)
  - [ ] Redis with persistence enabled
  - [ ] SSL certificates valid
  - [ ] Backups configured and tested
  - [ ] Secrets in Secret Manager

- [ ] **Monitoring**
  - [ ] All alerts configured
  - [ ] Notification channels verified
  - [ ] Dashboards created
  - [ ] Log retention configured

- [ ] **Performance**
  - [ ] Load test completed (target: 10K concurrent users)
  - [ ] Response times under SLA (P95 < 500ms)
  - [ ] Database query optimization
  - [ ] Cache hit rates acceptable (>80%)

- [ ] **Disaster Recovery**
  - [ ] Backup restoration tested
  - [ ] Failover procedure documented
  - [ ] Rollback procedure tested

### Launch Day

- [ ] All services deployed to production
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Monitoring dashboards live
- [ ] On-call rotation scheduled
- [ ] Communication channels ready

### Post-Launch (First Week)

- [ ] Monitor error rates
- [ ] Monitor latency P95
- [ ] Check indexer lag
- [ ] Review alert frequency
- [ ] Gather user feedback
- [ ] Optimize based on real traffic

---

## 11.7 Performance Testing

### k6 Load Test Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 1000 },  // Peak load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
  },
};

export default function () {
  // Get tokens list
  const tokensRes = http.get('https://api.hodlfun.io/api/v1/tokens?limit=20');
  check(tokensRes, { 'tokens status 200': (r) => r.status === 200 });

  // Get specific token
  const tokenRes = http.get('https://api.hodlfun.io/api/v1/tokens/0x...');
  check(tokenRes, { 'token status 200': (r) => r.status === 200 });

  // Get leaderboard
  const leaderboardRes = http.get('https://api.hodlfun.io/api/v1/leaderboard/gainers');
  check(leaderboardRes, { 'leaderboard status 200': (r) => r.status === 200 });

  sleep(1);
}
```

```bash
# Run load test
k6 run load-test.js
```

---

## 11.8 Final Verification

```bash
# Health check
curl https://api.hodlfun.io/api/v1/health/ready

# WebSocket test
wscat -c 'wss://ws.hodlfun.io/events'

# Rate limit test
for i in {1..20}; do curl -s -o /dev/null -w "%{http_code}\n" https://api.hodlfun.io/api/v1/auth/nonce -X POST -d '{"wallet":"0x..."}'; done

# SSL verification
openssl s_client -connect api.hodlfun.io:443 -servername api.hodlfun.io

# DNS propagation
dig api.hodlfun.io
```

---

## Congratulations!

The Hodl.fun V2 backend is now production-ready. Continue monitoring and iterating based on real-world usage patterns.
