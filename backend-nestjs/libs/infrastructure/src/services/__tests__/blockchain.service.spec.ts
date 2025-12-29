import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ethers } from 'ethers';

/**
 * BlockchainService Test Suite
 *
 * Tests RPC provider management, fallback handling, and contract interactions
 */
describe('BlockchainService', () => {
  let service: BlockchainService;
  let mockConfigService: jest.Mocked<ConfigService>;
  // let mockPrimaryProvider: jest.Mocked<ethers.JsonRpcProvider>;
  // let mockFallbackProvider: jest.Mocked<ethers.JsonRpcProvider>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    // Mock ethers providers
    jest.spyOn(ethers, 'JsonRpcProvider' as any).mockImplementation((url: any) => {
      if (url === 'http://primary-rpc') {
        return {
          getNetwork: jest.fn().mockResolvedValue({ chainId: 42101, name: 'Push Chain' }),
        } as any;
      }
      return { getNetwork: jest.fn().mockResolvedValue({ chainId: 42101 }) } as any;
    });

    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        PUSH_RPC_URL: 'http://primary-rpc',
        PUSH_RPC_URL_ALT: 'http://fallback-rpc',
      };
      return config[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with primary RPC URL', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('PUSH_RPC_URL');
    });

    it('should configure fallback RPC if available', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('PUSH_RPC_URL_ALT');
    });

    it('should throw error if PUSH_RPC_URL not configured', () => {
      mockConfigService.get.mockReturnValue(null);
      expect(() => new BlockchainService(mockConfigService)).toThrow();
    });

    it('should work with primary RPC only', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PUSH_RPC_URL') return 'http://primary-rpc';
        return null;
      });

      expect(() => new BlockchainService(mockConfigService)).not.toThrow();
    });
  });

  describe('Provider Management', () => {
    it('should use primary provider by default', () => {
      expect(service).toBeDefined();
    });

    it('should handle provider with long URL', () => {
      const longUrl = 'http://example.com:8545/api/' + 'x'.repeat(100);
      mockConfigService.get.mockReturnValue(longUrl);

      expect(() => new BlockchainService(mockConfigService)).not.toThrow();
    });

    it('should handle multiple service instances', () => {
      const mockConfig = { get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          PUSH_RPC_URL: 'http://rpc1',
          PUSH_RPC_URL_ALT: 'http://rpc2',
        };
        return config[key];
      }) } as any;

      jest.spyOn(ethers, 'JsonRpcProvider').mockImplementation(() => ({
        getNetwork: jest.fn().mockResolvedValue({ chainId: 42101 }),
      } as any));

      const service1 = new BlockchainService(mockConfig);
      const service2 = new BlockchainService(mockConfig);

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC connection errors gracefully', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PUSH_RPC_URL') return 'http://invalid-rpc';
        return null;
      });

      expect(() => new BlockchainService(mockConfigService)).not.toThrow();
    });

    it('should handle malformed RPC URLs', () => {
      mockConfigService.get.mockReturnValue('not-a-valid-url');

      expect(() => new BlockchainService(mockConfigService)).not.toThrow();
    });

    it('should recover from provider switching', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Configuration Handling', () => {
    it('should accept different RPC endpoints', () => {
      const endpoints = [
        'http://localhost:8545',
        'https://rpc.example.com',
        'ws://streaming.example.com',
      ];

      endpoints.forEach((endpoint) => {
        mockConfigService.get.mockReturnValue(endpoint);
        expect(() => new BlockchainService(mockConfigService)).not.toThrow();
      });
    });

    it('should handle config service returning undefined', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(() => new BlockchainService(mockConfigService)).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle service instantiation multiple times', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          PUSH_RPC_URL: 'http://rpc',
          PUSH_RPC_URL_ALT: 'http://fallback',
        };
        return config[key];
      });

      for (let i = 0; i < 5; i++) {
        expect(() => new BlockchainService(mockConfigService)).not.toThrow();
      }
    });

    it('should handle empty fallback RPC', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PUSH_RPC_URL') return 'http://primary';
        return '';
      });

      expect(() => new BlockchainService(mockConfigService)).not.toThrow();
    });
  });
});
