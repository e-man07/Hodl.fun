export declare class MockJsonRpcProvider {
    getBlockNumber: jest.Mock<any, any, any>;
    getBlock: jest.Mock<any, any, any>;
    getLogs: jest.Mock<any, any, any>;
    getTransaction: jest.Mock<any, any, any>;
    getTransactionReceipt: jest.Mock<any, any, any>;
    getBalance: jest.Mock<any, any, any>;
    getCode: jest.Mock<any, any, any>;
    call: jest.Mock<any, any, any>;
    estimateGas: jest.Mock<any, any, any>;
    send: jest.Mock<any, any, any>;
    waitForTransaction: jest.Mock<any, any, any>;
    on: jest.Mock<any, any, any>;
    once: jest.Mock<any, any, any>;
    off: jest.Mock<any, any, any>;
    removeAllListeners: jest.Mock<any, any, any>;
    destroy: jest.Mock<any, any, any>;
}
export declare class MockContract {
    address: string;
    interface: MockInterface;
    runner: MockJsonRpcProvider;
    constructor(address: string);
    getFunction: jest.Mock<any, any, any>;
    queryFilter: jest.Mock<any, any, any>;
    on: jest.Mock<any, any, any>;
    once: jest.Mock<any, any, any>;
    off: jest.Mock<any, any, any>;
    removeAllListeners: jest.Mock<any, any, any>;
    [key: string]: unknown;
}
export declare class MockInterface {
    parseLog: jest.Mock<any, any, any>;
    parseError: jest.Mock<any, any, any>;
    parseTransaction: jest.Mock<any, any, any>;
    encodeFunctionData: jest.Mock<any, any, any>;
    decodeFunctionData: jest.Mock<any, any, any>;
    decodeFunctionResult: jest.Mock<any, any, any>;
    encodeEventLog: jest.Mock<any, any, any>;
    decodeEventLog: jest.Mock<any, any, any>;
    getEvent: jest.Mock<any, any, any>;
    getFunction: jest.Mock<any, any, any>;
    forEachEvent: jest.Mock<any, any, any>;
    forEachFunction: jest.Mock<any, any, any>;
}
export declare class MockWallet {
    address: string;
    privateKey: string;
    provider: MockJsonRpcProvider;
    signMessage: jest.Mock;
    signTransaction: jest.Mock;
    signTypedData: jest.Mock;
    getAddress: jest.Mock;
    connect: jest.Mock;
    constructor(privateKey?: string, provider?: MockJsonRpcProvider);
}
export declare const mockEthersUtils: {
    isAddress: jest.Mock<boolean, [address: string], any>;
    getAddress: jest.Mock<string, [address: string], any>;
    parseEther: jest.Mock<bigint, [value: string], any>;
    formatEther: jest.Mock<string, [value: bigint], any>;
    parseUnits: jest.Mock<bigint, [value: string, decimals: number], any>;
    formatUnits: jest.Mock<string, [value: bigint, decimals: number], any>;
    keccak256: jest.Mock<string, [data: string], any>;
    id: jest.Mock<string, [text: string], any>;
    solidityPackedKeccak256: jest.Mock<string, [_types: string[], _values: unknown[]], any>;
    verifyMessage: jest.Mock<string, [message: string, signature: string], any>;
    recoverAddress: jest.Mock<string, [_digest: string, _signature: string], any>;
    hashMessage: jest.Mock<string, [message: string], any>;
    ZeroAddress: string;
    MaxUint256: bigint;
};
export declare const TEST_ADDRESSES: {
    user1: string;
    user2: string;
    user3: string;
    token: string;
    curve: string;
    pool: string;
    core: string;
    factory: string;
    zero: string;
};
export declare const TEST_TX_HASHES: {
    tx1: string;
    tx2: string;
    tx3: string;
};
export declare function createMockEventLog(eventName: string, args: Record<string, unknown>, blockNumber?: number, transactionHash?: string): {
    blockNumber: number;
    blockHash: string;
    transactionHash: string;
    transactionIndex: number;
    logIndex: number;
    address: string;
    data: string;
    topics: string[];
    args: Record<string, unknown>;
    eventName: string;
    fragment: {
        name: string;
        anonymous: boolean;
        inputs: never[];
    };
};
export declare function createMockProvider(): MockJsonRpcProvider;
export declare function createMockContract(address?: string): MockContract;
export declare function createMockWallet(): MockWallet;
