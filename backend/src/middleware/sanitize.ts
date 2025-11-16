// XSS Sanitization middleware

import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import logger from '../utils/logger';

/**
 * XSS Options Configuration
 */
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Sanitize string value
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeValue(value[key]);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * XSS Sanitization Middleware
 * Sanitizes request body, query params, and URL params
 */
export function sanitizeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params);
    }

    next();
  } catch (error) {
    logger.error('Sanitization error:', error);
    next(error);
  }
}

/**
 * Validate Ethereum Address
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Sanitize Ethereum Address Input
 */
export function sanitizeEthereumAddress(address: string): string {
  if (!isValidEthereumAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  return address.toLowerCase();
}
