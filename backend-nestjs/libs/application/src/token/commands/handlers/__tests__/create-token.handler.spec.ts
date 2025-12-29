import { Test, TestingModule } from '@nestjs/testing';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateTokenHandler } from '../create-token.handler';
import { CreateTokenCommand } from '../../create-token.command';
import { Token, TokenAddress, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * CreateTokenHandler Test Suite
 *
 * Tests the command handler for creating new tokens with bonding curve initialization.
 * Covers: token creation, repository persistence, domain event publishing, error handling
 */
describe('CreateTokenHandler', () => {
  let handler: CreateTokenHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (id: string = 'token-1') => ({
    getId: jest.fn().mockReturnValue(id),
    getAddress: jest.fn().mockReturnValue(TokenAddress.create('0x' + 'a'.repeat(40))),
    getName: jest.fn().mockReturnValue('Test Token'),
    getSymbol: jest.fn().mockReturnValue('TEST'),
    getCreator: jest.fn().mockReturnValue('0x' + 'b'.repeat(40)),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(false),
    getIsListed: jest.fn().mockReturnValue(false),
    getATHPrice: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
    getATHMarketCap: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    addDomainEvent: jest.fn(),
    getDomainEvents: jest.fn().mockReturnValue([]),
    clearDomainEvents: jest.fn(),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = {
      findById: jest.fn(),
      findByAddressString: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findTrending: jest.fn(),
      findReadyForGraduation: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreateTokenHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    handler = module.get<CreateTokenHandler>(CreateTokenHandler);

    // Mock Token.create to return a mock token with all required methods
    jest.spyOn(Token, 'create').mockImplementation((id: string) => createMockToken(id) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    describe('Happy Path', () => {
      it('should create token with valid parameters', async () => {
        const command = new CreateTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          'Test Token',
          'TEST',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = createMockToken('token-1');
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result).toEqual(mockToken);
        expect(mockTokenRepository.save).toHaveBeenCalled();
      });

      it('should save token to repository', async () => {
        const command = new CreateTokenCommand(
          'token-2',
          '0x' + 'a'.repeat(40),
          'Another Token',
          'ANOT',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(2000000000000000000000000),
          BigInt(200000000000000000000),
          BigInt(2000000000000000000000000),
        );

        const mockToken = createMockToken('token-2');
        mockTokenRepository.save.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should return created token from repository', async () => {
        const command = new CreateTokenCommand(
          'token-3',
          '0x' + 'a'.repeat(40),
          'Token Three',
          'TT3',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(3000000000000000000000000),
          BigInt(300000000000000000000),
          BigInt(3000000000000000000000000),
        );

        const mockToken = createMockToken('token-3');
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getId()).toBe('token-3');
        expect(result.getName()).toBe('Test Token');
      });

      it('should initialize ATH price with initial price', async () => {
        const command = new CreateTokenCommand(
          'token-ath',
          '0x' + 'a'.repeat(40),
          'ATH Token',
          'ATH',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = {
          ...createMockToken('token-ath'),
          getPrice: jest.fn().mockReturnValue(BigInt(500000000000000000)),
          getATHPrice: jest.fn().mockReturnValue(BigInt(500000000000000000)),
        };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getATHPrice()).toBe(BigInt(500000000000000000));
      });
    });

    describe('Parameter Validation', () => {
      it('should accept standard decimals (18)', async () => {
        const command = new CreateTokenCommand(
          'token-decimals',
          '0x' + 'a'.repeat(40),
          'Token Decimals',
          'TDC',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = { ...createMockToken('token-decimals'), getDecimals: jest.fn().mockReturnValue(18) };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getDecimals()).toBe(18);
      });

      it('should accept different decimals (6)', async () => {
        const command = new CreateTokenCommand(
          'token-6decimals',
          '0x' + 'a'.repeat(40),
          'Token 6 Decimals',
          'T6D',
          '0x' + 'b'.repeat(40),
          6,
          BigInt(1000000000000),
          BigInt(100000000),
          BigInt(1000000000000),
        );

        const mockToken = { ...createMockToken('token-6decimals'), getDecimals: jest.fn().mockReturnValue(6) };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getDecimals()).toBe(6);
      });

      it('should accept zero decimals (0)', async () => {
        const command = new CreateTokenCommand(
          'token-0decimals',
          '0x' + 'a'.repeat(40),
          'Token Zero Decimals',
          'T0D',
          '0x' + 'b'.repeat(40),
          0,
          BigInt(1000000),
          BigInt(100),
          BigInt(1000000),
        );

        const mockToken = { ...createMockToken('token-0decimals'), getDecimals: jest.fn().mockReturnValue(0) };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getDecimals()).toBe(0);
      });

      it('should handle large total supply', async () => {
        const largeSupply = BigInt('9'.repeat(60));
        const command = new CreateTokenCommand(
          'token-large-supply',
          '0x' + 'a'.repeat(40),
          'Large Supply Token',
          'LST',
          '0x' + 'b'.repeat(40),
          18,
          largeSupply,
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = {
          ...createMockToken('token-large-supply'),
          getTotalSupply: jest.fn().mockReturnValue(largeSupply),
        };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getTotalSupply()).toBe(largeSupply);
      });

      it('should handle minimum total supply', async () => {
        const command = new CreateTokenCommand(
          'token-min-supply',
          '0x' + 'a'.repeat(40),
          'Min Supply Token',
          'MST',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1),
          BigInt(1),
          BigInt(1),
        );

        const mockToken = {
          ...createMockToken('token-min-supply'),
          getTotalSupply: jest.fn().mockReturnValue(BigInt(1)),
        };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getTotalSupply()).toBe(BigInt(1));
      });
    });

    describe('Token Naming', () => {
      it('should handle standard token names', async () => {
        const command = new CreateTokenCommand(
          'token-name',
          '0x' + 'a'.repeat(40),
          'Standard Token Name',
          'STN',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = { ...createMockToken('token-name'), getName: jest.fn().mockReturnValue('Standard Token Name') };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getName()).toBe('Standard Token Name');
      });

      it('should handle token names with special characters', async () => {
        const command = new CreateTokenCommand(
          'token-special',
          '0x' + 'a'.repeat(40),
          'Test & <Special> Token™',
          'TST',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = { ...createMockToken('token-special'), getName: jest.fn().mockReturnValue('Test & <Special> Token™') };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getName()).toBe('Test & <Special> Token™');
      });

      it('should handle very long token names', async () => {
        const longName = 'A'.repeat(200);
        const command = new CreateTokenCommand(
          'token-long-name',
          '0x' + 'a'.repeat(40),
          longName,
          'TLN',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = { ...createMockToken('token-long-name'), getName: jest.fn().mockReturnValue(longName) };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getName()).toBe(longName);
      });
    });

    describe('Error Handling', () => {
      it('should rethrow repository save errors', async () => {
        const command = new CreateTokenCommand(
          'token-error',
          '0x' + 'a'.repeat(40),
          'Error Token',
          'ERR',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const error = new Error('Database error');
        mockTokenRepository.save.mockRejectedValue(error);

        await expect(handler.execute(command)).rejects.toThrow('Database error');
      });

      it('should rethrow validation errors from domain', async () => {
        const command = new CreateTokenCommand(
          'token-invalid',
          '0x' + 'a'.repeat(40),
          'Invalid Token',
          'INV',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const error = new Error('Invalid reserve balance');
        mockTokenRepository.save.mockRejectedValue(error);

        await expect(handler.execute(command)).rejects.toThrow('Invalid reserve balance');
      });

      it('should handle connection errors', async () => {
        const command = new CreateTokenCommand(
          'token-conn',
          '0x' + 'a'.repeat(40),
          'Connection Token',
          'CON',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const error = new Error('Connection refused');
        mockTokenRepository.save.mockRejectedValue(error);

        await expect(handler.execute(command)).rejects.toThrow('Connection refused');
      });
    });

    describe('Edge Cases', () => {
      it('should handle creator with valid Ethereum address', async () => {
        const creator = '0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd';
        const command = new CreateTokenCommand(
          'token-creator',
          '0x' + 'a'.repeat(40),
          'Creator Token',
          'CRT',
          creator,
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = { ...createMockToken('token-creator'), getCreator: jest.fn().mockReturnValue(creator) };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getCreator()).toBe(creator);
      });

      it('should handle virtual reserves with identical values', async () => {
        const reserve = BigInt(1000000000000000000000000);
        const command = new CreateTokenCommand(
          'token-equal-reserves',
          '0x' + 'a'.repeat(40),
          'Equal Reserves Token',
          'ERT',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          reserve,
          reserve,
        );

        const mockToken = {
          ...createMockToken('token-equal-reserves'),
          getReserveBalance: jest.fn().mockReturnValue(reserve),
        };
        mockTokenRepository.save.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.getReserveBalance()).toBe(reserve);
      });

      it('should handle rapid token creation', async () => {
        const mockToken1 = createMockToken('token-1');
        const mockToken2 = createMockToken('token-2');
        const mockToken3 = createMockToken('token-3');

        mockTokenRepository.save.mockResolvedValueOnce(mockToken1).mockResolvedValueOnce(mockToken2).mockResolvedValueOnce(mockToken3);

        const command1 = new CreateTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          'Fast Token 1',
          'FT1',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const command2 = new CreateTokenCommand(
          'token-2',
          '0x' + 'a'.repeat(40),
          'Fast Token 2',
          'FT2',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const command3 = new CreateTokenCommand(
          'token-3',
          '0x' + 'a'.repeat(40),
          'Fast Token 3',
          'FT3',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const result1 = await handler.execute(command1);
        const result2 = await handler.execute(command2);
        const result3 = await handler.execute(command3);

        expect(result1.getId()).toBe('token-1');
        expect(result2.getId()).toBe('token-2');
        expect(result3.getId()).toBe('token-3');
        expect(mockTokenRepository.save).toHaveBeenCalledTimes(3);
      });
    });

    describe('Repository Interaction', () => {
      it('should pass command parameters correctly to domain', async () => {
        const command = new CreateTokenCommand(
          'token-id-123',
          '0x' + 'a'.repeat(40),
          'Precise Token',
          'PRC',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(5000000000000000000000000),
          BigInt(50000000000000000000),
          BigInt(5000000000000000000000000),
        );

        const mockToken = createMockToken('token-id-123');
        mockTokenRepository.save.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should only call save method', async () => {
        const command = new CreateTokenCommand(
          'token-save-only',
          '0x' + 'a'.repeat(40),
          'Save Only Token',
          'SOT',
          '0x' + 'b'.repeat(40),
          18,
          BigInt(1000000000000000000000000),
          BigInt(100000000000000000000),
          BigInt(1000000000000000000000000),
        );

        const mockToken = createMockToken('token-save-only');
        mockTokenRepository.save.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.save).toHaveBeenCalled();
        expect(mockTokenRepository.update).not.toHaveBeenCalled();
        expect(mockTokenRepository.findById).not.toHaveBeenCalled();
      });
    });
  });
});
