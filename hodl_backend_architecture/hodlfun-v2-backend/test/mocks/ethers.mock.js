"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_TX_HASHES = exports.TEST_ADDRESSES = exports.mockEthersUtils = exports.MockWallet = exports.MockInterface = exports.MockContract = exports.MockJsonRpcProvider = void 0;
exports.createMockEventLog = createMockEventLog;
exports.createMockProvider = createMockProvider;
exports.createMockContract = createMockContract;
exports.createMockWallet = createMockWallet;
class MockJsonRpcProvider {
    constructor() {
        this.getBlockNumber = jest.fn().mockResolvedValue(1000);
        this.getBlock = jest.fn().mockResolvedValue({
            number: 1000,
            hash: '0x' + '1'.repeat(64),
            timestamp: Math.floor(Date.now() / 1000),
            transactions: [],
        });
        this.getLogs = jest.fn().mockResolvedValue([]);
        this.getTransaction = jest.fn().mockResolvedValue(null);
        this.getTransactionReceipt = jest.fn().mockResolvedValue(null);
        this.getBalance = jest.fn().mockResolvedValue(BigInt('1000000000000000000'));
        this.getCode = jest.fn().mockResolvedValue('0x');
        this.call = jest.fn().mockResolvedValue('0x');
        this.estimateGas = jest.fn().mockResolvedValue(BigInt(21000));
        this.send = jest.fn().mockResolvedValue(null);
        this.waitForTransaction = jest.fn().mockResolvedValue({
            status: 1,
            transactionHash: '0x' + '1'.repeat(64),
        });
        this.on = jest.fn();
        this.once = jest.fn();
        this.off = jest.fn();
        this.removeAllListeners = jest.fn();
        this.destroy = jest.fn();
    }
}
exports.MockJsonRpcProvider = MockJsonRpcProvider;
class MockContract {
    constructor(address) {
        this.getFunction = jest.fn().mockReturnValue(jest.fn().mockResolvedValue(null));
        this.queryFilter = jest.fn().mockResolvedValue([]);
        this.on = jest.fn();
        this.once = jest.fn();
        this.off = jest.fn();
        this.removeAllListeners = jest.fn();
        this.address = address;
        this.interface = new MockInterface();
        this.runner = new MockJsonRpcProvider();
    }
}
exports.MockContract = MockContract;
class MockInterface {
    constructor() {
        this.parseLog = jest.fn().mockReturnValue(null);
        this.parseError = jest.fn().mockReturnValue(null);
        this.parseTransaction = jest.fn().mockReturnValue(null);
        this.encodeFunctionData = jest.fn().mockReturnValue('0x');
        this.decodeFunctionData = jest.fn().mockReturnValue([]);
        this.decodeFunctionResult = jest.fn().mockReturnValue([]);
        this.encodeEventLog = jest.fn().mockReturnValue({ data: '0x', topics: [] });
        this.decodeEventLog = jest.fn().mockReturnValue({});
        this.getEvent = jest.fn().mockReturnValue(null);
        this.getFunction = jest.fn().mockReturnValue(null);
        this.forEachEvent = jest.fn();
        this.forEachFunction = jest.fn();
    }
}
exports.MockInterface = MockInterface;
class MockWallet {
    constructor(privateKey, provider) {
        this.privateKey = privateKey || '0x' + '1'.repeat(64);
        this.address = '0x' + 'a'.repeat(40);
        this.provider = provider || new MockJsonRpcProvider();
        this.signMessage = jest.fn().mockResolvedValue('0x' + '1'.repeat(130));
        this.signTransaction = jest.fn().mockResolvedValue('0x');
        this.signTypedData = jest.fn().mockResolvedValue('0x' + '1'.repeat(130));
        this.getAddress = jest.fn().mockResolvedValue(this.address);
        this.connect = jest.fn().mockReturnThis();
    }
}
exports.MockWallet = MockWallet;
exports.mockEthersUtils = {
    isAddress: jest.fn((address) => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }),
    getAddress: jest.fn((address) => {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new Error('invalid address');
        }
        return address.toLowerCase();
    }),
    parseEther: jest.fn((value) => {
        return BigInt(parseFloat(value) * 1e18);
    }),
    formatEther: jest.fn((value) => {
        return (Number(value) / 1e18).toString();
    }),
    parseUnits: jest.fn((value, decimals) => {
        return BigInt(parseFloat(value) * Math.pow(10, decimals));
    }),
    formatUnits: jest.fn((value, decimals) => {
        return (Number(value) / Math.pow(10, decimals)).toString();
    }),
    keccak256: jest.fn((data) => {
        return '0x' + '1'.repeat(64);
    }),
    id: jest.fn((text) => {
        return '0x' + '1'.repeat(64);
    }),
    solidityPackedKeccak256: jest.fn((_types, _values) => {
        return '0x' + '1'.repeat(64);
    }),
    verifyMessage: jest.fn((message, signature) => {
        return '0x' + 'a'.repeat(40);
    }),
    recoverAddress: jest.fn((_digest, _signature) => {
        return '0x' + 'a'.repeat(40);
    }),
    hashMessage: jest.fn((message) => {
        return '0x' + '1'.repeat(64);
    }),
    ZeroAddress: '0x' + '0'.repeat(40),
    MaxUint256: BigInt('0x' + 'f'.repeat(64)),
};
exports.TEST_ADDRESSES = {
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
exports.TEST_TX_HASHES = {
    tx1: '0x' + '1'.repeat(64),
    tx2: '0x' + '2'.repeat(64),
    tx3: '0x' + '3'.repeat(64),
};
function createMockEventLog(eventName, args, blockNumber = 1000, transactionHash = exports.TEST_TX_HASHES.tx1) {
    return {
        blockNumber,
        blockHash: '0x' + 'b'.repeat(64),
        transactionHash,
        transactionIndex: 0,
        logIndex: 0,
        address: exports.TEST_ADDRESSES.core,
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
function createMockProvider() {
    return new MockJsonRpcProvider();
}
function createMockContract(address = exports.TEST_ADDRESSES.token) {
    return new MockContract(address);
}
function createMockWallet() {
    return new MockWallet();
}
//# sourceMappingURL=ethers.mock.js.map