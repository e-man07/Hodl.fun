import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interface } from 'ethers';
import {
  TransactionData,
  CreateCurveParams,
  ExactInBuyParams,
  ExactOutBuyParams,
  ExactInSellParams,
  ExactOutSellParams,
} from '../types';
import CoreAbi from '../abis/Core.json';
import BondingCurveAbi from '../abis/BondingCurve.json';
import BondingCurveFactoryAbi from '../abis/BondingCurveFactory.json';

// ERC20 approve ABI fragment
const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
];

// WPUSH deposit/withdraw ABI fragments
const WPUSH_ABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
];

// Maximum uint256 for unlimited approvals
const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

/**
 * TransactionBuilderService
 *
 * Builds transaction calldata for smart contract interactions.
 * Returns {to, data, value} objects for frontend wallet signing.
 */
@Injectable()
export class TransactionBuilderService {
  private readonly coreInterface: Interface;
  private readonly bondingCurveInterface: Interface;
  private readonly factoryInterface: Interface;
  private readonly erc20Interface: Interface;
  private readonly wpushInterface: Interface;

  constructor(private readonly configService: ConfigService) {
    this.coreInterface = new Interface(CoreAbi);
    this.bondingCurveInterface = new Interface(BondingCurveAbi);
    this.factoryInterface = new Interface(BondingCurveFactoryAbi);
    this.erc20Interface = new Interface(ERC20_APPROVE_ABI);
    this.wpushInterface = new Interface(WPUSH_ABI);
  }

  /**
   * Encode createCurve transaction
   * @param params Create curve parameters
   * @returns Transaction data for frontend signing
   */
  encodeCreateCurve(params: CreateCurveParams): TransactionData {
    const data = this.coreInterface.encodeFunctionData('createCurve', [
      params.creator,
      params.name,
      params.symbol,
      params.tokenURI,
      BigInt(params.amountIn),
      BigInt(params.fee),
    ]);

    const value = (BigInt(params.amountIn) + BigInt(params.fee)).toString();

    return {
      to: this.getCoreAddress(),
      data,
      value,
    };
  }

  /**
   * Encode exactInBuy transaction
   * @param params Buy parameters with exact input amount
   * @returns Transaction data for frontend signing
   */
  encodeExactInBuy(params: ExactInBuyParams): TransactionData {
    const data = this.coreInterface.encodeFunctionData('exactInBuy', [
      BigInt(params.amountIn),
      BigInt(params.amountOutMin),
      params.token,
      params.to,
      BigInt(params.deadline),
    ]);

    return {
      to: this.getCoreAddress(),
      data,
      value: params.amountIn,
    };
  }

  /**
   * Encode exactOutBuy transaction
   * @param params Buy parameters with exact output amount
   * @returns Transaction data for frontend signing
   */
  encodeExactOutBuy(params: ExactOutBuyParams): TransactionData {
    const data = this.coreInterface.encodeFunctionData('exactOutBuy', [
      BigInt(params.amountOut),
      BigInt(params.amountInMax),
      params.token,
      params.to,
      BigInt(params.deadline),
    ]);

    return {
      to: this.getCoreAddress(),
      data,
      value: params.amountInMax,
    };
  }

  /**
   * Encode exactInSell transaction
   * @param params Sell parameters with exact input amount
   * @returns Transaction data for frontend signing
   */
  encodeExactInSell(params: ExactInSellParams): TransactionData {
    const data = this.coreInterface.encodeFunctionData('exactInSell', [
      BigInt(params.amountIn),
      BigInt(params.amountOutMin),
      params.token,
      params.from,
      params.to,
      BigInt(params.deadline),
    ]);

    return {
      to: this.getCoreAddress(),
      data,
      value: '0', // Sell doesn't require sending ETH
    };
  }

  /**
   * Encode exactOutSell transaction
   * @param params Sell parameters with exact output amount
   * @returns Transaction data for frontend signing
   */
  encodeExactOutSell(params: ExactOutSellParams): TransactionData {
    const data = this.coreInterface.encodeFunctionData('exactOutSell', [
      BigInt(params.amountOut),
      BigInt(params.amountInMax),
      params.token,
      params.from,
      params.to,
      BigInt(params.deadline),
    ]);

    return {
      to: this.getCoreAddress(),
      data,
      value: '0', // Sell doesn't require sending ETH
    };
  }

  /**
   * Encode ERC20 approve transaction
   * @param tokenAddress Token contract address
   * @param spender Spender address (usually Core contract)
   * @param amount Amount to approve
   * @returns Transaction data for frontend signing
   */
  encodeApprove(
    tokenAddress: string,
    spender: string,
    amount: string,
  ): TransactionData {
    const data = this.erc20Interface.encodeFunctionData('approve', [
      spender,
      BigInt(amount),
    ]);

    return {
      to: tokenAddress,
      data,
      value: '0',
    };
  }

  /**
   * Encode unlimited ERC20 approval
   * @param tokenAddress Token contract address
   * @param spender Spender address (usually Core contract)
   * @returns Transaction data for frontend signing
   */
  encodeUnlimitedApprove(
    tokenAddress: string,
    spender: string,
  ): TransactionData {
    return this.encodeApprove(tokenAddress, spender, MAX_UINT256);
  }

  /**
   * Encode approve for Core contract
   * @param tokenAddress Token contract address
   * @param amount Amount to approve
   * @returns Transaction data for frontend signing
   */
  encodeApproveForCore(tokenAddress: string, amount: string): TransactionData {
    return this.encodeApprove(tokenAddress, this.getCoreAddress(), amount);
  }

  /**
   * Get Core contract address
   * @returns Core contract address
   */
  getCoreAddress(): string {
    return (
      this.configService.get<string>('smartContracts.coreAddress') ||
      '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03'
    );
  }

  /**
   * Get Factory contract address
   * @returns Factory contract address
   */
  getFactoryAddress(): string {
    return (
      this.configService.get<string>('smartContracts.factoryAddress') ||
      '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8'
    );
  }

  /**
   * Decode error data from a failed transaction
   * @param errorData Error data from transaction
   * @returns Decoded error or null
   */
  decodeError(errorData: string): { name: string; args: unknown[] } | null {
    try {
      const decoded = this.coreInterface.parseError(errorData);
      if (decoded) {
        return {
          name: decoded.name,
          args: [...decoded.args],
        };
      }
    } catch {
      // Error selector not found in Core ABI
    }

    // Try to decode standard Error(string) revert
    if (errorData.startsWith('0x08c379a0')) {
      try {
        const errorInterface = new Interface([
          'error Error(string message)',
        ]);
        const decoded = errorInterface.parseError(errorData);
        if (decoded) {
          return {
            name: 'Error',
            args: [...decoded.args],
          };
        }
      } catch {
        // Not a standard Error
      }
    }

    // Try to decode Panic(uint256)
    if (errorData.startsWith('0x4e487b71')) {
      try {
        const panicInterface = new Interface(['error Panic(uint256 code)']);
        const decoded = panicInterface.parseError(errorData);
        if (decoded) {
          return {
            name: 'Panic',
            args: [...decoded.args],
          };
        }
      } catch {
        // Not a Panic
      }
    }

    return null;
  }

  /**
   * Build a deadline timestamp
   * @param minutes Minutes from now
   * @returns Unix timestamp
   */
  buildDeadline(minutes: number = 20): number {
    return Math.floor(Date.now() / 1000) + minutes * 60;
  }

  // ========================================
  // WPUSH (Wrapped PUSH) Operations
  // ========================================

  /**
   * Encode WPUSH deposit (wrap native PUSH)
   * @param amount Amount of native PUSH to wrap
   * @returns Transaction data for frontend signing
   */
  encodeWPUSHDeposit(amount: string): TransactionData {
    const data = this.wpushInterface.encodeFunctionData('deposit', []);

    return {
      to: this.getWPUSHAddress(),
      data,
      value: amount,
    };
  }

  /**
   * Encode WPUSH withdraw (unwrap to native PUSH)
   * @param amount Amount of WPUSH to unwrap
   * @returns Transaction data for frontend signing
   */
  encodeWPUSHWithdraw(amount: string): TransactionData {
    const data = this.wpushInterface.encodeFunctionData('withdraw', [
      BigInt(amount),
    ]);

    return {
      to: this.getWPUSHAddress(),
      data,
      value: '0',
    };
  }

  // ========================================
  // BondingCurve Operations
  // ========================================

  /**
   * Encode BondingCurve listing transaction (graduation to Uniswap V3)
   * @param curveAddress Bonding curve contract address
   * @returns Transaction data for frontend signing
   */
  encodeListing(curveAddress: string): TransactionData {
    const data = this.bondingCurveInterface.encodeFunctionData('listing', []);

    return {
      to: curveAddress,
      data,
      value: '0',
    };
  }

  /**
   * Encode claim creator fees from bonding curve
   * @param curveAddress Bonding curve contract address
   * @returns Transaction data for frontend signing
   */
  encodeClaimCreatorFees(curveAddress: string): TransactionData {
    const data = this.bondingCurveInterface.encodeFunctionData(
      'claimCreatorFees',
      [],
    );

    return {
      to: curveAddress,
      data,
      value: '0',
    };
  }

  // ========================================
  // Factory Admin Operations
  // ========================================

  /**
   * Encode accumulate creator fees (admin/internal)
   * @param creator Creator address
   * @param amount Amount to accumulate
   * @returns Transaction data for frontend signing
   */
  encodeAccumulateCreatorFees(creator: string, amount: string): TransactionData {
    const data = this.factoryInterface.encodeFunctionData(
      'accumulateCreatorFees',
      [creator, BigInt(amount)],
    );

    return {
      to: this.getFactoryAddress(),
      data,
      value: '0',
    };
  }

  /**
   * Encode set graduation market cap (admin)
   * @param newMarketCap New graduation market cap threshold
   * @returns Transaction data for frontend signing
   */
  encodeSetGraduationMarketCap(newMarketCap: string): TransactionData {
    const data = this.factoryInterface.encodeFunctionData(
      'setGraduationMarketCap',
      [BigInt(newMarketCap)],
    );

    return {
      to: this.getFactoryAddress(),
      data,
      value: '0',
    };
  }

  // ========================================
  // Address Getters
  // ========================================

  /**
   * Get WPUSH contract address
   * @returns WPUSH contract address
   */
  getWPUSHAddress(): string {
    return (
      this.configService.get<string>('smartContracts.wpushAddress') ||
      '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7'
    );
  }

  /**
   * Get FeeVault contract address
   * @returns FeeVault contract address
   */
  getFeeVaultAddress(): string {
    return (
      this.configService.get<string>('smartContracts.feeVaultAddress') ||
      '0xbe2fd9b720d1d7fac7208523376d2a3332019928'
    );
  }

  /**
   * Get Uniswap V3 Factory address
   * @returns Uniswap V3 Factory address
   */
  getUniswapV3FactoryAddress(): string {
    return (
      this.configService.get<string>('smartContracts.uniswapV3FactoryAddress') ||
      '0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7'
    );
  }

  // ========================================
  // Validation Helpers
  // ========================================

  /**
   * Validate Ethereum address format
   * @param address Address to validate
   * @returns True if valid
   */
  isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate and checksum an Ethereum address
   * @param address Address to validate
   * @throws Error if address is invalid
   * @returns Checksummed address
   */
  validateAddress(address: string): string {
    if (!this.isValidAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
    return address; // In a full implementation, would return checksummed version
  }

  /**
   * Validate amount is positive and not zero
   * @param amount Amount to validate
   * @throws Error if amount is invalid
   */
  validateAmount(amount: string): void {
    const value = BigInt(amount);
    if (value <= 0n) {
      throw new Error('Amount must be greater than zero');
    }
  }

  /**
   * Validate transaction parameters
   * @param params Parameters to validate
   */
  validateBuyParams(params: ExactInBuyParams | ExactOutBuyParams): void {
    this.validateAddress(params.token);
    this.validateAddress(params.to);
    if ('amountIn' in params) {
      this.validateAmount(params.amountIn);
    }
    if ('amountOut' in params) {
      this.validateAmount(params.amountOut);
    }
  }

  /**
   * Validate sell parameters
   * @param params Parameters to validate
   */
  validateSellParams(params: ExactInSellParams | ExactOutSellParams): void {
    this.validateAddress(params.token);
    this.validateAddress(params.from);
    this.validateAddress(params.to);
    if ('amountIn' in params) {
      this.validateAmount(params.amountIn);
    }
    if ('amountOut' in params) {
      this.validateAmount(params.amountOut);
    }
  }
}
