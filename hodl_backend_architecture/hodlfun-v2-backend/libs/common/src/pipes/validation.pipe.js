"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strictValidationPipe = exports.customValidationPipe = void 0;
const common_1 = require("@nestjs/common");
exports.customValidationPipe = new common_1.ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
        enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => {
        const formatErrors = (errors, parentPath = '') => {
            const messages = [];
            for (const error of errors) {
                const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;
                if (error.constraints) {
                    const constraintMessages = Object.values(error.constraints);
                    messages.push(...constraintMessages.map((msg) => `${propertyPath}: ${msg}`));
                }
                if (error.children && error.children.length > 0) {
                    messages.push(...formatErrors(error.children, propertyPath));
                }
            }
            return messages;
        };
        const messages = formatErrors(errors);
        return new common_1.BadRequestException({
            statusCode: 400,
            error: 'Validation Error',
            message: messages.length === 1 ? messages[0] : messages,
        });
    },
});
exports.strictValidationPipe = new common_1.ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: {
        enableImplicitConversion: false,
    },
    exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
            if (error.constraints) {
                return Object.values(error.constraints).join(', ');
            }
            return `Invalid value for ${error.property}`;
        });
        return new common_1.BadRequestException({
            statusCode: 400,
            error: 'Validation Error',
            message: messages,
        });
    },
});
//# sourceMappingURL=validation.pipe.js.map