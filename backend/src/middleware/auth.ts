// Authentication and authorization middleware

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import logger from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        address: string;
        role?: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      sendError(res, 'No authorization token provided', 401);
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      sendError(res, 'Invalid authorization format', 401);
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      sendError(res, 'Server configuration error', 500);
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as {
      address: string;
      role?: string;
      iat?: number;
      exp?: number;
    };

    // Attach user to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token has expired', 401);
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      sendError(res, 'Invalid token', 401);
      return;
    }

    logger.error('Authentication error:', error);
    sendError(res, 'Authentication failed', 401);
  }
}

/**
 * Admin Role Authorization Middleware
 * Checks if authenticated user has admin role
 * Must be used after authMiddleware
 */
export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',').map((addr) =>
    addr.trim().toLowerCase()
  ) || [];

  const isAdmin =
    req.user.role === 'admin' ||
    adminAddresses.includes(req.user.address.toLowerCase());

  if (!isAdmin) {
    logger.warn(`Unauthorized admin access attempt by ${req.user.address}`);
    sendError(res, 'Admin access required', 403);
    return;
  }

  next();
}

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is present, but doesn't fail if missing
 */
export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      address: string;
      role?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(
  address: string,
  role?: string,
  expiresIn: string = '7d'
): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const payload: any = {
    address: address.toLowerCase(),
    ...(role && { role }),
  };

  // @ts-ignore - JWT types
  return jwt.sign(payload, jwtSecret, { expiresIn });
}
