"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    static success(data) {
        return {
            success: true,
            data,
        };
    }
    static error(statusCode, message, path) {
        return {
            success: false,
            error: {
                statusCode,
                message,
                timestamp: new Date().toISOString(),
                path,
            },
        };
    }
}
exports.ApiResponse = ApiResponse;
//# sourceMappingURL=api-response.dto.js.map