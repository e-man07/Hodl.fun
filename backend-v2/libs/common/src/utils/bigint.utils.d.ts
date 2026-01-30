export declare function safeParseBigInt(value: string | number | bigint | null | undefined): bigint;
export declare function formatBigInt(value: bigint, decimals?: number): string;
export declare function parseToBigInt(value: string, decimals?: number): bigint;
export declare function calculatePercentageChange(oldValue: bigint, newValue: bigint): number;
export declare function compareBigIntStrings(a: string, b: string): number;
export declare function serializeBigInts<T>(obj: T): T;
