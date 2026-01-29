"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsEthAddress = IsEthAddress;
exports.IsEthAddressOrEmpty = IsEthAddressOrEmpty;
const class_validator_1 = require("class-validator");
const ethers_1 = require("ethers");
function IsEthAddress(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isEthAddress',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value) {
                    return typeof value === 'string' && ethers_1.ethers.isAddress(value);
                },
                defaultMessage(args) {
                    return `${args.property} must be a valid Ethereum address`;
                },
            },
        });
    };
}
function IsEthAddressOrEmpty(validationOptions) {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            name: 'isEthAddressOrEmpty',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value) {
                    if (!value || value === '')
                        return true;
                    return typeof value === 'string' && ethers_1.ethers.isAddress(value);
                },
                defaultMessage(args) {
                    return `${args.property} must be a valid Ethereum address or empty`;
                },
            },
        });
    };
}
//# sourceMappingURL=address.validator.js.map