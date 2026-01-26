/**
 * Ethers.js Mock Factory
 * Creates mocked ethers providers and utilities for unit tests
 */

/**
 * Mock JsonRpcProvider
 */
export class MockJsonRpcProvider {
  getBlockNumber = jest.fn().mockResolvedValue(1000);
  getBlock = jest.fn().mockResolvedValue({
    number: 1000,
    hash: '0x' + '1'.repeat(64),
    timestamp: Math.floor(Date.now() / 1000),
    transactions: [],
  });
  getLogs = jest.fn().mockResolvedValue([]);
  getTransaction = jest.fn().mockResolvedValue(null);
  getTransactionReceipt = jest.fn().mockResolvedValue(null);
  getBalance = jest.fn().mockResolvedValue(BigInt('1000000000000000000'));
  getCode = jest.fn().mockResolvedValue('0x');
  call = jest.fn().mockResolvedValue('0x');
  estimateGas = jest.fn().mockResolvedValue(BigInt(21000));
  send = jest.fn().mockResolvedValue(null);
  waitForTransaction = jest.fn().mockResolvedValue({
    status: 1,
    transactionHash: '0x' + '1'.repeat(64),
  });
  on = jest.fn();
  once = jest.fn();
  off = jest.fn();
  removeAllListeners = jest.fn();
  destroy = jest.fn();
}

/**
 * Mock Contract
 */
export class MockContract {
  address: string;
  interface: MockInterface;
  runner: MockJsonRpcProvider;

  constructor(address: string) {
    this.address = address;
    this.interface = new MockInterface();
    this.runner = new MockJsonRpcProvider();
  }

  // Common contract method mocks
  getFunction = jest.fn().mockReturnValue(jest.fn().mockResolvedValue(null));
  queryFilter = jest.fn().mockResolvedValue([]);
  on = jest.fn();
  once = jest.fn();
  off = jest.fn();
  removeAllListeners = jest.fn();

  // Allow dynamic method access for contract calls
  [key: string]: unknown;
}

/**
 * Mock Interface
 */
export class MockInterface {
  parseLog = jest.fn().mockReturnValue(null);
  parseError = jest.fn().mockReturnValue(null);
  parseTransaction = jest.fn().mockReturnValue(null);
  encodeFunctionData = jest.fn().mockReturnValue('0x');
  decodeFunctionData = jest.fn().mockReturnValue([]);
  decodeFunctionResult = jest.fn().mockReturnValue([]);
  encodeEventLog = jest.fn().mockReturnValue({ data: '0x', topics: [] });
  decodeEventLog = jest.fn().mockReturnValue({});
  getEvent = jest.fn().mockReturnValue(null);
  getFunction = jest.fn().mockReturnValue(null);
  forEachEvent = jest.fn();
  forEachFunction = jest.fn();
}

/**
 * Mock Wallet
 */
export class MockWallet {
  address: string;
  privateKey: string;
  provider: MockJsonRpcProvider;

  constructor(privateKey?: string, provider?: MockJsonRpcProvider) {
    this.privateKey = privateKey || '0x' + '1'.repeat(64);
    this.address = '0x' + 'a'.repeat(40);
    this.provider = provider || new MockJsonRpcProvider();
  }

  signMessage = jest.fn().mockResolvedValue('0x' + '1'.repeat(130));
  signTransaction = jest.fn().mockResolvedValue('0x');
  signTypedData = jest.fn().mockResolvedValue('0x' + '1'.repeat(130));
  getAddress = jest.fn().mockResolvedValue(this.address);
  connect = jest.fn().mockReturnThis();
}

/**
 * Mock ethers utility functions
 */
export const mockEthersUtils = {
  isAddress: jest.fn((address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }),

  getAddress: jest.fn((address: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('invalid address');
    }
    return address.toLowerCase();
  }),

  parseEther: jest.fn((value: string) => {
    return BigInt(parseFloat(value) * 1e18);
  }),

  formatEther: jest.fn((value: bigint) => {
    return (Number(value) / 1e18).toString();
  }),

  parseUnits: jest.fn((value: string, decimals: number) => {
    return BigInt(parseFloat(value) * Math.pow(10, decimals));
  }),

  formatUnits: jest.fn((value: bigint, decimals: number) => {
    return (Number(value) / Math.pow(10, decimals)).toString();
  }),

  keccak256: jest.fn((data: string) => {
    return '0x' + '1'.repeat(64);
  }),

  id: jest.fn((text: string) => {
    return '0x' + '1'.repeat(64);
  }),

  solidityPackedKeccak256: jest.fn((_types: string[], _values: unknown[]) => {
    return '0x' + '1'.repeat(64);
  }),

  verifyMessage: jest.fn((message: string, signature: string) => {
    // Return a mock address
    return '0x' + 'a'.repeat(40);
  }),

  recoverAddress: jest.fn((_digest: string, _signature: string) => {
    return '0x' + 'a'.repeat(40);
  }),

  hashMessage: jest.fn((message: string) => {
    return '0x' + '1'.repeat(64);
  }),

  ZeroAddress: '0x' + '0'.repeat(40),
  MaxUint256: BigInt('0x' + 'f'.repeat(64)),
};

/**
 * Sample valid Ethereum addresses for testing
 */
export const TEST_ADDRESSES = {
  user1: '0x1111111111111111111111111111111111111111',
  user2: '0x2222222222222222222222222222222222222222',
  user3: '0x3333333333333333333333333333333333333333',
  token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  curve: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  pool: '0xcccccccccccccccccccccccccccccccccccccccc',
  core: '0xdddddddddddddddddddddddddddddddddddddddd',
  factory: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  zero: '0x0000000000000000000000000000000000000000',
};

/**
 * Sample transaction hashes for testing
 */
export const TEST_TX_HASHES = {
  tx1: '0x' + '1'.repeat(64),
  tx2: '0x' + '2'.repeat(64),
  tx3: '0x' + '3'.repeat(64),
};

/**
 * Create mock event log
 */
export function createMockEventLog(
  eventName: string,
  args: Record<string, unknown>,
  blockNumber = 1000,
  transactionHash = TEST_TX_HASHES.tx1,
) {
  return {
    blockNumber,
    blockHash: '0x' + 'b'.repeat(64),
    transactionHash,
    transactionIndex: 0,
    logIndex: 0,
    address: TEST_ADDRESSES.core,
    data: '0x',
    topics: ['0x' + '1'.repeat(64)],
    args,
    eventName,
    fragment: {
      name: eventName,
      anonymous: false,
      inputs: [],
    },
  };
}

/**
 * Factory functions
 */
export function createMockProvider(): MockJsonRpcProvider {
  return new MockJsonRpcProvider();
}

export function createMockContract(address = TEST_ADDRESSES.token): MockContract {
  return new MockContract(address);
}

export function createMockWallet(): MockWallet {
  return new MockWallet();
}
