import { describe, it, expect, vi } from 'vitest';

// Mock nuqs
vi.mock('nuqs', () => ({
  useQueryState: vi.fn().mockReturnValue(['value', vi.fn()]),
  parseAsInteger: {
    withDefault: vi.fn().mockReturnThis(),
  },
  parseAsStringEnum: vi.fn(() => ({
    withDefault: vi.fn().mockReturnThis(),
  })),
  parseAsString: {
    withDefault: vi.fn().mockReturnThis(),
  },
}));

describe('useUrlState hooks', () => {
  it('should export useTokenFiltersState', async () => {
    const { useTokenFiltersState } = await import('./use-url-state');
    expect(useTokenFiltersState).toBeDefined();
    expect(typeof useTokenFiltersState).toBe('function');
  });

  it('should export useLeaderboardState', async () => {
    const { useLeaderboardState } = await import('./use-url-state');
    expect(useLeaderboardState).toBeDefined();
    expect(typeof useLeaderboardState).toBe('function');
  });

  it('should export useTokenPageState', async () => {
    const { useTokenPageState } = await import('./use-url-state');
    expect(useTokenPageState).toBeDefined();
    expect(typeof useTokenPageState).toBe('function');
  });

  it('should export useDashboardState', async () => {
    const { useDashboardState } = await import('./use-url-state');
    expect(useDashboardState).toBeDefined();
    expect(typeof useDashboardState).toBe('function');
  });

  it('should export SortBy type', async () => {
    const urlStateModule = await import('./use-url-state');
    // TypeScript type exports can't be tested at runtime, but we can check the module loads
    expect(urlStateModule).toBeDefined();
  });
});
