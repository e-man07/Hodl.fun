"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseBigInt = safeParseBigInt;
exports.formatBigInt = formatBigInt;
exports.parseToBigInt = parseToBigInt;
exports.calculatePercentageChange = calculatePercentageChange;
exports.compareBigIntStrings = compareBigIntStrings;
exports.serializeBigInts = serializeBigInts;
function safeParseBigInt(value) {
    if (value === null || value === undefined || value === '') {
        return 0n;
    }
    if (typeof value === 'bigint') {
        return value;
    }
    try {
        return BigInt(value);
    }
    catch {
        return 0n;
    }
}
function formatBigInt(value, decimals = 18) {
    const str = value.toString().padStart(decimals + 1, '0');
    const integerPart = str.slice(0, -decimals) || '0';
    const fractionalPart = str.slice(-decimals);
    return `${integerPart}.${fractionalPart}`.replace(/\.?0+$/, '');
}
function parseToBigInt(value, decimals = 18) {
    const [integer, fraction = ''] = value.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(integer + paddedFraction);
}
function calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0n) {
        return newValue > 0n ? 100 : 0;
    }
    const change = ((newValue - oldValue) * 10000n) / oldValue;
    return Number(change) / 100;
}
function compareBigIntStrings(a, b) {
    const bigA = safeParseBigInt(a);
    const bigB = safeParseBigInt(b);
    if (bigA < bigB)
        return -1;
    if (bigA > bigB)
        return 1;
    return 0;
}
function serializeBigInts(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInts);
    }
    if (typeof obj === 'object') {
        if (obj instanceof Date) {
            return obj;
        }
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = serializeBigInts(value);
        }
        return result;
    }
    return obj;
}
//# sourceMappingURL=bigint.utils.js.map