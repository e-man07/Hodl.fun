import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';

// Minimal UniswapV3Factory ABI
const UNISWAP_V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
    stateMutability: 'view',
  },
];

// Minimal UniswapV3Pool ABI
const UNISWAP_V3_POOL_ABI = [
  {
    type: 'function',
    name: 'slot0',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token0',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token1',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fee',
    inputs: [],
    outputs: [{ name: '', type: 'uint24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
  },
];

/**
 * Pool slot0 data
 */
export interface Slot0Data {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

/**
 * Pool info
 */
export interface PoolInfo {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: bigint;
  slot0: Slot0Data;
  currentPrice: bigint; // Price of token0 in terms of token1 (scaled by 1e18)
}

/**
 * UniswapV3PoolService
 *
 * Service for interacting with Uniswap V3 pools.
 * Used for querying graduated token pool data.
 */
@Injectable()
export class UniswapV3PoolService implements OnModuleInit {
  private readonly logger = new Logger(UniswapV3PoolService.name);
  private provider!: JsonRpcProvider;
  private factoryContract!: Contract;
  private poolCache: Map<string, Contract> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    const factoryAddress = this.configService.get<string>(
      'smartContracts.uniswapV3FactoryAddress',
    );

    if (!rpcUrl || !factoryAddress) {
      this.logger.warn('Missing RPC URL or UniswapV3Factory address');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.factoryContract = new Contract(
      factoryAddress,
      UNISWAP_V3_FACTORY_ABI,
      this.provider,
    );

    this.logger.log(`Initialized UniswapV3 Factory at ${factoryAddress}`);
  }

  /**
   * Get or create a pool contract instance
   * @param poolAddress Pool address
   * @returns Contract instance
   */
  private getPoolContract(poolAddress: string): Contract {
    let contract = this.poolCache.get(poolAddress);
    if (!contract) {
      contract = new Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider);
      this.poolCache.set(poolAddress, contract);
    }
    return contract;
  }

  /**
   * Get pool address for a token pair
   * @param tokenA First token address
   * @param tokenB Second token address
   * @param fee Fee tier (500, 3000, or 10000)
   * @returns Pool address or zero address if not found
   */
  async getPool(
    tokenA: string,
    tokenB: string,
    fee: number = 3000,
  ): Promise<string> {
    return this.factoryContract.getPool(tokenA, tokenB, fee);
  }

  /**
   * Get slot0 data for a pool
   * @param poolAddress Pool address
   * @returns Slot0 data
   */
  async getSlot0(poolAddress: string): Promise<Slot0Data> {
    const contract = this.getPoolContract(poolAddress);
    const slot0 = await contract.slot0();
    return {
      sqrtPriceX96: slot0[0],
      tick: Number(slot0[1]),
      observationIndex: Number(slot0[2]),
      observationCardinality: Number(slot0[3]),
      observationCardinalityNext: Number(slot0[4]),
      feeProtocol: Number(slot0[5]),
      unlocked: slot0[6],
    };
  }

  /**
   * Get token0 address for a pool
   * @param poolAddress Pool address
   * @returns Token0 address
   */
  async getToken0(poolAddress: string): Promise<string> {
    const contract = this.getPoolContract(poolAddress);
    return contract.token0();
  }

  /**
   * Get token1 address for a pool
   * @param poolAddress Pool address
   * @returns Token1 address
   */
  async getToken1(poolAddress: string): Promise<string> {
    const contract = this.getPoolContract(poolAddress);
    return contract.token1();
  }

  /**
   * Get fee tier for a pool
   * @param poolAddress Pool address
   * @returns Fee tier
   */
  async getFee(poolAddress: string): Promise<number> {
    const contract = this.getPoolContract(poolAddress);
    return Number(await contract.fee());
  }

  /**
   * Get liquidity for a pool
   * @param poolAddress Pool address
   * @returns Liquidity
   */
  async getLiquidity(poolAddress: string): Promise<bigint> {
    const contract = this.getPoolContract(poolAddress);
    return contract.liquidity();
  }

  /**
   * Calculate price from sqrtPriceX96
   * @param sqrtPriceX96 Square root price from slot0
   * @returns Price scaled by 1e18
   */
  calculatePriceFromSqrtPrice(sqrtPriceX96: bigint): bigint {
    // price = (sqrtPriceX96 / 2^96)^2
    // To maintain precision, we calculate: (sqrtPriceX96^2 * 1e18) / 2^192
    const Q192 = BigInt(2) ** BigInt(192);
    const price = (sqrtPriceX96 * sqrtPriceX96 * BigInt(10 ** 18)) / Q192;
    return price;
  }

  /**
   * Get comprehensive pool info
   * @param poolAddress Pool address
   * @returns Pool information
   */
  async getPoolInfo(poolAddress: string): Promise<PoolInfo> {
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
      this.getToken0(poolAddress),
      this.getToken1(poolAddress),
      this.getFee(poolAddress),
      this.getLiquidity(poolAddress),
      this.getSlot0(poolAddress),
    ]);

    const currentPrice = this.calculatePriceFromSqrtPrice(slot0.sqrtPriceX96);

    return {
      poolAddress,
      token0,
      token1,
      fee,
      liquidity,
      slot0,
      currentPrice,
    };
  }

  /**
   * Check if a pool exists (address is not zero)
   * @param poolAddress Pool address to check
   * @returns True if pool exists
   */
  isValidPool(poolAddress: string): boolean {
    return (
      poolAddress !== '0x0000000000000000000000000000000000000000' &&
      /^0x[a-fA-F0-9]{40}$/.test(poolAddress)
    );
  }

  /**
   * Get factory address
   */
  get factoryAddress(): string {
    return (
      this.configService.get<string>('smartContracts.uniswapV3FactoryAddress') ||
      ''
    );
  }

  /**
   * Clear pool cache
   */
  clearCache(): void {
    this.poolCache.clear();
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}
