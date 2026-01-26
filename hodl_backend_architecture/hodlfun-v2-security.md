# Hodl.fun V2 - Security Deep Dive

## Table of Contents
1. [Overview](#overview)
2. [Security Architecture](#security-architecture)
3. [Authentication Flow](#authentication-flow)
4. [Wallet Signature Verification](#wallet-signature-verification)
5. [JWT Implementation](#jwt-implementation)
6. [Guards & Middleware](#guards--middleware)
7. [Input Validation](#input-validation)
8. [Rate Limiting](#rate-limiting)
9. [API Security](#api-security)
10. [Database Security](#database-security)
11. [Infrastructure Security](#infrastructure-security)
12. [Security Checklist](#security-checklist)

---

## Overview

### Security Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY PRINCIPLES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. DEFENSE IN DEPTH
   Multiple layers: Edge → Network → Application → Data

2. LEAST PRIVILEGE
   Minimal permissions for services and users

3. ZERO TRUST
   Verify every request, don't trust network alone

4. SECURE BY DEFAULT
   Private resources, explicit allowlisting
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                              INTERNET
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│ LAYER 1: CLOUDFLARE                                                         │
│   ✓ DDoS Protection    ✓ WAF Rules    ✓ Bot Detection    ✓ Rate Limiting   │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│ LAYER 2: GCP NETWORK                                                        │
│   ✓ VPC Isolation      ✓ Firewall     ✓ Private IPs     ✓ IAM             │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│ LAYER 3: APPLICATION (NestJS)                                               │
│   ✓ JWT Auth           ✓ Guards       ✓ Validation      ✓ Rate Limits     │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│ LAYER 4: DATA                                                               │
│   ✓ Encryption Rest    ✓ TLS Transit  ✓ Access Control  ✓ Audit Logs      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Web3 Wallet Authentication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WALLET AUTHENTICATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: Request Nonce
─────────────────────────────────────────────────────────────────────────────
POST /api/v1/auth/nonce
{ "wallet": "0xabc..." }

Response:
{ "nonce": "uuid-v4", "message": "Sign this...", "expiresAt": "..." }


STEP 2: User Signs Message (in wallet)
─────────────────────────────────────────────────────────────────────────────
Message: "Welcome to Hodl.fun!\n\nNonce: abc123\nTimestamp: 1706123456"
→ Wallet signs with private key
→ Returns signature


STEP 3: Verify & Get Token
─────────────────────────────────────────────────────────────────────────────
POST /api/v1/auth/verify
{ "wallet": "0xabc...", "signature": "0x..." }

Server:
1. Retrieve stored nonce from Redis
2. Reconstruct signed message
3. Recover address from signature (ecrecover)
4. Compare recovered vs claimed address
5. Delete nonce (one-time use)
6. Generate JWT tokens

Response:
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 3600 }


TOKEN LIFETIMES
─────────────────────────────────────────────────────────────────────────────
Access Token:   1 hour    (short, stateless)
Refresh Token:  7 days    (stored in Redis, revocable)
Nonce:          5 minutes (one-time use)
```

---

## Wallet Signature Verification

### Implementation

```typescript
// src/auth/services/wallet-auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class WalletAuthService {
  private readonly noncePrefix = 'auth:nonce:';
  private readonly nonceTtl = 300; // 5 minutes

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async generateNonce(walletAddress: string): Promise<{
    nonce: string;
    message: string;
    expiresAt: Date;
  }> {
    const wallet = walletAddress.toLowerCase();
    const nonce = uuidv4();
    const timestamp = Date.now();
    
    const message = this.createSignMessage(nonce, timestamp);
    
    // Store in Redis
    await this.redis.set(
      `${this.noncePrefix}${wallet}`,
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

  private createSignMessage(nonce: string, timestamp: number): string {
    return [
      'Welcome to Hodl.fun!',
      '',
      'Sign this message to verify your wallet.',
      'This will not trigger any blockchain transaction.',
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');
  }

  async verifySignature(walletAddress: string, signature: string): Promise<boolean> {
    const wallet = walletAddress.toLowerCase();
    const key = `${this.noncePrefix}${wallet}`;
    
    // Get stored nonce
    const storedData = await this.redis.get(key);
    if (!storedData) {
      throw new UnauthorizedException('Nonce expired or not found');
    }
    
    const { nonce, timestamp } = JSON.parse(storedData);
    const message = this.createSignMessage(nonce, timestamp);
    
    try {
      // Recover address from signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === wallet;
      
      if (isValid) {
        // Delete nonce (one-time use)
        await this.redis.del(key);
      }
      
      return isValid;
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
```

### Why This Is Secure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIGNATURE SECURITY                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. CANNOT FORGE SIGNATURE
   - Only private key holder can create valid signature
   - Private key never leaves the wallet

2. NONCE PREVENTS REPLAY ATTACKS
   - Each nonce is unique (UUID)
   - Deleted after use
   - Expires after 5 minutes

3. ADDRESS RECOVERY
   - Server recovers address from signature
   - Compares with claimed address
   - Cryptographically secure
```

---

## JWT Implementation

### Token Service

```typescript
// src/auth/services/jwt-auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JwtAuthService {
  private readonly accessTtl = 3600;      // 1 hour
  private readonly refreshTtl = 604800;   // 7 days
  private readonly refreshPrefix = 'auth:refresh:';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async generateTokenPair(wallet: string) {
    const normalizedWallet = wallet.toLowerCase();
    
    // Access token
    const accessToken = this.jwtService.sign(
      { sub: normalizedWallet, type: 'access' },
      { secret: this.configService.get('JWT_SECRET'), expiresIn: this.accessTtl },
    );
    
    // Refresh token with unique ID
    const jti = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: normalizedWallet, type: 'refresh', jti },
      { secret: this.configService.get('JWT_REFRESH_SECRET'), expiresIn: this.refreshTtl },
    );
    
    // Store refresh token ID for revocation
    await this.redis.set(
      `${this.refreshPrefix}${normalizedWallet}:${jti}`,
      '1',
      'EX',
      this.refreshTtl,
    );
    
    return { accessToken, refreshToken, expiresIn: this.accessTtl };
  }

  async refreshTokens(refreshToken: string) {
    const payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
    
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid token type');
    }
    
    // Check if token is revoked
    const key = `${this.refreshPrefix}${payload.sub}:${payload.jti}`;
    const exists = await this.redis.exists(key);
    
    if (!exists) {
      throw new UnauthorizedException('Token revoked or expired');
    }
    
    // Revoke old token (rotation)
    await this.redis.del(key);
    
    // Generate new pair
    return this.generateTokenPair(payload.sub);
  }

  async revokeAllTokens(wallet: string) {
    const pattern = `${this.refreshPrefix}${wallet.toLowerCase()}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### JWT Strategy

```typescript
// src/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; type: string }) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    return { wallet: payload.sub };
  }
}
```

---

## Guards & Middleware

### JWT Auth Guard

```typescript
// src/auth/guards/jwt-auth.guard.ts

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

### Resource Owner Guard

```typescript
// src/auth/guards/resource-owner.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const walletParam = request.params.wallet || request.params.walletAddress;
    
    if (walletParam && walletParam.toLowerCase() !== user?.wallet?.toLowerCase()) {
      throw new ForbiddenException('You can only access your own resources');
    }
    
    return true;
  }
}
```

### Real IP Middleware

```typescript
// src/common/middleware/real-ip.middleware.ts

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RealIpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const xForwardedFor = req.headers['x-forwarded-for'];
    
    if (cfConnectingIp) {
      req['realIp'] = Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    } else if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
      req['realIp'] = ips.trim();
    } else {
      req['realIp'] = req.ip;
    }
    
    next();
  }
}
```

### Decorators

```typescript
// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
```

---

## Input Validation

### Global Validation Pipe

```typescript
// src/main.ts

import { ValidationPipe, BadRequestException } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Error on unknown properties
    transform: true,           // Transform to DTO instances
    exceptionFactory: (errors) => {
      const messages = errors.map(e => ({
        field: e.property,
        errors: Object.values(e.constraints || {}),
      }));
      return new BadRequestException({ message: 'Validation failed', errors: messages });
    },
  }),
);
```

### DTO Examples

```typescript
// src/tokens/dto/create-token.dto.ts

import { IsString, IsNotEmpty, IsOptional, IsUrl, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  @Matches(/^[A-Z0-9]+$/, { message: 'Symbol: uppercase letters and numbers only' })
  @Transform(({ value }) => value?.toUpperCase().trim())
  symbol: string;

  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^temp\/.*\.webp$/, { message: 'Invalid image key format' })
  imageKey: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsUrl()
  @IsOptional()
  @Matches(/^https:\/\/(twitter\.com|x\.com)\//)
  twitter?: string;
}
```

---

## Rate Limiting

### Rate Limit Guard

```typescript
// src/common/guards/rate-limit.guard.ts

import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration?: number;
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, context.getHandler())
      || { points: 100, duration: 60 };

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const identifier = request.user?.wallet || request['realIp'] || request.ip;
    const endpoint = `${request.method}:${request.route?.path || request.path}`;
    const key = `ratelimit:${identifier}:${endpoint}`;
    
    const current = await this.redis.incr(key);
    if (current === 1) await this.redis.expire(key, config.duration);
    
    const ttl = await this.redis.ttl(key);
    const remaining = Math.max(0, config.points - current);
    
    response.header('X-RateLimit-Limit', config.points.toString());
    response.header('X-RateLimit-Remaining', remaining.toString());
    response.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + ttl).toString());
    
    if (current > config.points) {
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Rate limit exceeded',
        retryAfter: ttl,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    
    return true;
  }
}
```

### Rate Limit Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RATE LIMITS BY ENDPOINT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

ENDPOINT                          LIMIT              WINDOW
═══════════════════════════════════════════════════════════════════════════════

PUBLIC
GET  /api/v1/tokens               100/min            60s
GET  /api/v1/tokens/:address      200/min            60s
GET  /health/*                    Unlimited          -

AUTHENTICATED
POST /api/v1/tokens               10/min             60s
POST /api/v1/comments             30/min             60s
POST /api/v1/alerts               20/min             60s

SENSITIVE
POST /api/v1/auth/nonce           10/min             60s
POST /api/v1/auth/verify          10/min             60s
POST /api/v1/upload/image         5/min              60s
```

---

## API Security

### Helmet & CORS

```typescript
// src/main.ts

import helmet from 'helmet';

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.hodlfun.io'],
      connectSrc: ["'self'", 'https://api.hodlfun.io', 'wss://api.hodlfun.io'],
    },
  },
}));

// CORS
app.enableCors({
  origin: ['https://hodlfun.io', 'https://www.hodlfun.io'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
});
```

### SQL Injection Prevention

```typescript
// Always use parameterized queries (TypeORM does this)

// ✅ SAFE
const token = await this.tokenRepository.findOne({ where: { address: userInput } });

// ✅ SAFE
const tokens = await this.tokenRepository
  .createQueryBuilder('token')
  .where('token.name ILIKE :search', { search: `%${userInput}%` })
  .getMany();

// ❌ NEVER DO THIS
const tokens = await this.tokenRepository.query(
  `SELECT * FROM tokens WHERE name = '${userInput}'`  // SQL INJECTION!
);
```

---

## Database Security

```typescript
// Secure database connection

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST,      // Private IP only
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },  // For Cloud SQL
  extra: { max: 20, connectionTimeoutMillis: 10000 },
});
```

---

## Infrastructure Security

### Pod Security

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: api
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: gke-system
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - ipBlock:
            cidr: 10.10.0.0/16  # VPC internal
```

---

## Security Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY CHECKLIST                                        │
└─────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION
☐ Wallet signature verification
☐ JWT with appropriate expiration
☐ Refresh token rotation
☐ Nonce for replay prevention

AUTHORIZATION
☐ Route guards for protected endpoints
☐ Resource ownership verification
☐ Public decorator for open routes

INPUT VALIDATION
☐ class-validator on all DTOs
☐ Whitelist validation
☐ Input sanitization
☐ File upload validation

RATE LIMITING
☐ Per-IP rate limiting
☐ Per-user for authenticated routes
☐ Stricter for sensitive operations

API SECURITY
☐ Helmet middleware
☐ CORS configured
☐ HTTPS only
☐ Parameterized queries

INFRASTRUCTURE
☐ Private IPs for databases
☐ Network policies
☐ Pod security contexts
☐ Secrets in Secret Manager
```

---

## Summary

| Layer | Protection |
|-------|------------|
| Edge | Cloudflare DDoS, WAF, Bot detection |
| Network | VPC, Firewall, Private IPs |
| Application | JWT, Guards, Validation, Rate limits |
| Data | Encryption, Access control |

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access | 1 hour | Client memory |
| Refresh | 7 days | Redis (revocable) |
| Nonce | 5 minutes | Redis (one-time) |
