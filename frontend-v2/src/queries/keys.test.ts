import { describe, it, expect } from 'vitest';
import { queryKeys } from './keys';

describe('queryKeys', () => {
  describe('tokens', () => {
    it('should generate all tokens key', () => {
      expect(queryKeys.tokens.all).toEqual(['tokens']);
    });

    it('should generate list key with filters', () => {
      const filters = { page: 1, status: 'TRADING' as const };
      expect(queryKeys.tokens.list(filters)).toEqual(['tokens', 'list', filters]);
    });

    it('should generate trending key', () => {
      expect(queryKeys.tokens.trending()).toEqual(['tokens', 'trending']);
    });

    it('should generate new key', () => {
      expect(queryKeys.tokens.new()).toEqual(['tokens', 'new']);
    });

    it('should generate search key', () => {
      expect(queryKeys.tokens.search('test')).toEqual(['tokens', 'search', 'test']);
    });

    it('should generate detail key', () => {
      const address = '0x123';
      expect(queryKeys.tokens.detail(address)).toEqual(['tokens', 'detail', '0x123']);
    });

    it('should generate trades key', () => {
      const address = '0x123';
      expect(queryKeys.tokens.trades(address, 1)).toEqual([
        'tokens',
        'detail',
        '0x123',
        'trades',
        1,
      ]);
    });

    it('should generate holders key', () => {
      const address = '0x123';
      expect(queryKeys.tokens.holders(address, 2)).toEqual([
        'tokens',
        'detail',
        '0x123',
        'holders',
        2,
      ]);
    });

    it('should generate priceHistory key', () => {
      const address = '0x123';
      expect(queryKeys.tokens.priceHistory(address, 'ONE_HOUR')).toEqual([
        'tokens',
        'detail',
        '0x123',
        'price',
        'ONE_HOUR',
      ]);
    });
  });

  describe('users', () => {
    it('should generate all users key', () => {
      expect(queryKeys.users.all).toEqual(['users']);
    });

    it('should generate portfolio key', () => {
      expect(queryKeys.users.portfolio('0x456')).toEqual(['users', '0x456', 'portfolio']);
    });

    it('should generate holdings key', () => {
      expect(queryKeys.users.holdings('0x456', 1)).toEqual(['users', '0x456', 'holdings', 1]);
    });

    it('should generate trades key', () => {
      expect(queryKeys.users.trades('0x456', 1)).toEqual(['users', '0x456', 'trades', 1]);
    });

    it('should generate createdTokens key', () => {
      expect(queryKeys.users.createdTokens('0x456', 1)).toEqual(['users', '0x456', 'created', 1]);
    });
  });

  describe('leaderboard', () => {
    it('should generate all leaderboard key', () => {
      expect(queryKeys.leaderboard.all).toEqual(['leaderboard']);
    });

    it('should generate type key', () => {
      expect(queryKeys.leaderboard.type('gainers')).toEqual(['leaderboard', 'gainers']);
    });
  });

  describe('alerts', () => {
    it('should generate all alerts key', () => {
      expect(queryKeys.alerts.all).toEqual(['alerts']);
    });

    it('should generate detail key', () => {
      expect(queryKeys.alerts.detail('alert-123')).toEqual(['alerts', 'alert-123']);
    });
  });

  describe('contracts', () => {
    it('should generate all contracts key', () => {
      expect(queryKeys.contracts.all).toEqual(['contracts']);
    });

    it('should generate price key', () => {
      expect(queryKeys.contracts.price('0x789')).toEqual(['contracts', 'price', '0x789']);
    });

    it('should generate marketCap key', () => {
      expect(queryKeys.contracts.marketCap('0x789')).toEqual(['contracts', 'marketCap', '0x789']);
    });

    it('should generate balance key', () => {
      expect(queryKeys.contracts.balance('0x789', '0xabc')).toEqual([
        'contracts',
        'balance',
        '0x789',
        '0xabc',
      ]);
    });

    it('should generate allowance key', () => {
      expect(queryKeys.contracts.allowance('0x789', '0xabc', '0xdef')).toEqual([
        'contracts',
        'allowance',
        '0x789',
        '0xabc',
        '0xdef',
      ]);
    });
  });
});
