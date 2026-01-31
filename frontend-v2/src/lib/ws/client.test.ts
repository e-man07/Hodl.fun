import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

describe('WebSocket Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should export getEventsSocket function', async () => {
    const { getEventsSocket } = await import('./client');
    expect(getEventsSocket).toBeDefined();
    expect(typeof getEventsSocket).toBe('function');
  });

  it('should export getTradesSocket function', async () => {
    const { getTradesSocket } = await import('./client');
    expect(getTradesSocket).toBeDefined();
    expect(typeof getTradesSocket).toBe('function');
  });

  it('should export subscribeToToken function', async () => {
    const { subscribeToToken } = await import('./client');
    expect(subscribeToToken).toBeDefined();
    expect(typeof subscribeToToken).toBe('function');
  });

  it('should export subscribeToTrades function', async () => {
    const { subscribeToTrades } = await import('./client');
    expect(subscribeToTrades).toBeDefined();
    expect(typeof subscribeToTrades).toBe('function');
  });

  it('should export subscribeToWallet function', async () => {
    const { subscribeToWallet } = await import('./client');
    expect(subscribeToWallet).toBeDefined();
    expect(typeof subscribeToWallet).toBe('function');
  });

  it('subscribeToToken should return unsubscribe function', async () => {
    const { subscribeToToken } = await import('./client');
    const unsubscribe = subscribeToToken('0x123', {});
    expect(typeof unsubscribe).toBe('function');
  });

  it('should export disconnectAll function', async () => {
    const { disconnectAll } = await import('./client');
    expect(disconnectAll).toBeDefined();
    expect(typeof disconnectAll).toBe('function');
  });
});
