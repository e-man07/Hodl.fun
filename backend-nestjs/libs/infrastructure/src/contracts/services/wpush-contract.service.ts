import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import WPUSHAbi from '../abis/WPUSH.json';

/**
 * WPUSHContractService
 *
 * Service for interacting with the Wrapped PUSH (WPUSH) ERC20 contract.
 * Provides read-only access to WPUSH state and balances.
 */
@Injectable()
export class WPUSHContractService implements OnModuleInit {
  private readonly logger = new Logger(WPUSHContractService.name);
  private provider!: JsonRpcProvider;
  private contract!: Contract;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    const wpushAddress = this.configService.get<string>(
      'smartContracts.wpushAddress',
    );

    if (!rpcUrl || !wpushAddress) {
      this.logger.warn('Missing RPC URL or WPUSH contract address');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(wpushAddress, WPUSHAbi, this.provider);

    this.logger.log(`Initialized WPUSH contract at ${wpushAddress}`);
  }

  /**
   * Get WPUSH balance for an account
   * @param account Account address
   * @returns Balance in wei
   */
  async balanceOf(account: string): Promise<bigint> {
    return this.contract.balanceOf(account);
  }

  /**
   * Get total supply of WPUSH
   * @returns Total supply in wei
   */
  async totalSupply(): Promise<bigint> {
    return this.contract.totalSupply();
  }

  /**
   * Get name of the token
   * @returns Token name
   */
  async name(): Promise<string> {
    return this.contract.name();
  }

  /**
   * Get symbol of the token
   * @returns Token symbol
   */
  async symbol(): Promise<string> {
    return this.contract.symbol();
  }

  /**
   * Get decimals of the token
   * @returns Token decimals
   */
  async decimals(): Promise<number> {
    return Number(await this.contract.decimals());
  }

  /**
   * Get allowance for spender
   * @param owner Owner address
   * @param spender Spender address
   * @returns Allowance amount
   */
  async allowance(owner: string, spender: string): Promise<bigint> {
    return this.contract.allowance(owner, spender);
  }

  /**
   * Get the contract's native PUSH balance
   * @returns Native PUSH balance in wei
   */
  async getContractBalance(): Promise<bigint> {
    return this.contract.getBalance();
  }

  /**
   * Get nonce for permit signatures
   * @param owner Owner address
   * @returns Current nonce
   */
  async nonces(owner: string): Promise<bigint> {
    return this.contract.nonces(owner);
  }

  /**
   * Get domain separator for EIP-712 signatures
   * @returns Domain separator bytes32
   */
  async getDomainSeparator(): Promise<string> {
    return this.contract.DOMAIN_SEPARATOR();
  }

  /**
   * Build deposit transaction data (wrap native PUSH to WPUSH)
   * @param amount Amount to deposit in wei
   * @returns Transaction data for frontend signing
   */
  buildDepositTransaction(amount: string): {
    to: string;
    data: string;
    value: string;
  } {
    const data = this.contract.interface.encodeFunctionData('deposit', []);
    return {
      to: this.address,
      data,
      value: amount,
    };
  }

  /**
   * Build withdraw transaction data (unwrap WPUSH to native PUSH)
   * @param amount Amount to withdraw in wei
   * @returns Transaction data for frontend signing
   */
  buildWithdrawTransaction(amount: string): {
    to: string;
    data: string;
    value: string;
  } {
    const data = this.contract.interface.encodeFunctionData('withdraw', [
      amount,
    ]);
    return {
      to: this.address,
      data,
      value: '0',
    };
  }

  /**
   * Build withdrawWithPermit transaction data (gasless unwrap)
   * @param owner Owner address
   * @param amount Amount to withdraw in wei
   * @param deadline Permit deadline timestamp
   * @param v Signature v component
   * @param r Signature r component
   * @param s Signature s component
   * @returns Transaction data for frontend signing
   */
  buildWithdrawWithPermitTransaction(
    owner: string,
    amount: string,
    deadline: number,
    v: number,
    r: string,
    s: string,
  ): {
    to: string;
    data: string;
    value: string;
  } {
    const data = this.contract.interface.encodeFunctionData(
      'withdrawWithPermit',
      [owner, amount, deadline, v, r, s],
    );
    return {
      to: this.address,
      data,
      value: '0',
    };
  }

  /**
   * Build approve transaction data
   * @param spender Spender address
   * @param amount Amount to approve in wei
   * @returns Transaction data for frontend signing
   */
  buildApproveTransaction(
    spender: string,
    amount: string,
  ): {
    to: string;
    data: string;
    value: string;
  } {
    const data = this.contract.interface.encodeFunctionData('approve', [
      spender,
      amount,
    ]);
    return {
      to: this.address,
      data,
      value: '0',
    };
  }

  /**
   * Get the WPUSH contract address
   */
  get address(): string {
    return (
      this.configService.get<string>('smartContracts.wpushAddress') || ''
    );
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}
