"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimits = exports.RateLimit = exports.RATE_LIMIT_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.RATE_LIMIT_KEY = 'rateLimit';
const RateLimit = (limit, window = 60, keyPrefix) => (0, common_1.SetMetadata)(exports.RATE_LIMIT_KEY, { limit, window, keyPrefix });
exports.RateLimit = RateLimit;
exports.RateLimits = {
    Auth: () => (0, exports.RateLimit)(5, 60, 'auth'),
    Read: () => (0, exports.RateLimit)(100, 60, 'read'),
    Write: () => (0, exports.RateLimit)(30, 60, 'write'),
    Burst: () => (0, exports.RateLimit)(1000, 60, 'burst'),
    Strict: () => (0, exports.RateLimit)(3, 60, 'strict'),
};
//# sourceMappingURL=rate-limit.decorator.js.map