// Test utility functions
import { Request, Response } from 'express';

/**
 * Create mock Express request
 */
export function createMockRequest(options: {
  params?: any;
  query?: any;
  body?: any;
  headers?: any;
} = {}): Partial<Request> {
  return {
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
  };
}

/**
 * Create mock Express response
 */
export function createMockResponse(): Partial<Response> {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Create mock next function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Wait for a promise to resolve
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear all mocks
 */
export function clearAllMocks(): void {
  jest.clearAllMocks();
}
