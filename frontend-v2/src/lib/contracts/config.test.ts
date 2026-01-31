import { describe, it, expect } from 'vitest';
import { CONTRACTS, NETWORK, FEES, TOKEN_CONSTANTS } from './config';

describe('Contract Config', () => {
  describe('CONTRACTS', () => {
    it('should have valid contract addresses', () => {
      expect(CONTRACTS.CORE).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(CONTRACTS.FACTORY).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(CONTRACTS.FEE_VAULT).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(CONTRACTS.WPUSH).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should have all required contract addresses', () => {
      expect(CONTRACTS).toHaveProperty('CORE');
      expect(CONTRACTS).toHaveProperty('FACTORY');
      expect(CONTRACTS).toHaveProperty('FEE_VAULT');
      expect(CONTRACTS).toHaveProperty('WPUSH');
    });
  });

  describe('NETWORK', () => {
    it('should have Push Chain testnet configuration', () => {
      expect(NETWORK.chainId).toBe(42101);
      expect(NETWORK.name).toBe('Push Chain Testnet');
      expect(NETWORK.rpcUrl).toContain('push.org');
      expect(NETWORK.blockExplorer).toContain('push.network');
    });

    it('should have valid chainIdHex', () => {
      expect(NETWORK.chainIdHex).toBe('0xa475');
      expect(parseInt(NETWORK.chainIdHex, 16)).toBe(42101);
    });

    it('should have native currency configuration', () => {
      expect(NETWORK.nativeCurrency).toEqual({
        name: 'PUSH',
        symbol: 'PUSH',
        decimals: 18,
      });
    });
  });

  describe('FEES', () => {
    it('should have deploy fee in wei', () => {
      expect(FEES.DEPLOY_FEE).toBe('10000000000000000'); // 0.01 PUSH
      expect(BigInt(FEES.DEPLOY_FEE)).toBe(BigInt(10000000000000000));
    });

    it('should have listing fee in wei', () => {
      expect(FEES.LISTING_FEE).toBe('100000000000000000'); // 0.1 PUSH
      expect(BigInt(FEES.LISTING_FEE)).toBe(BigInt(100000000000000000));
    });
  });

  describe('TOKEN_CONSTANTS', () => {
    it('should have DEX_FEE_TIER of 3000 (0.3%)', () => {
      expect(TOKEN_CONSTANTS.DEX_FEE_TIER).toBe(3000);
    });

    it('should have default slippage of 100 bps (1%)', () => {
      expect(TOKEN_CONSTANTS.DEFAULT_SLIPPAGE_BPS).toBe(100);
    });
  });
});
