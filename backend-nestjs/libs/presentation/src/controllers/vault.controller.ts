import {
  Controller,
  Get,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  FeeVaultContractService,
  WPUSHContractService,
  TransactionBuilderService,
} from '@infrastructure';

/**
 * Vault stats response
 */
interface VaultStats {
  address: string;
  totalAssets: string;
  totalSupply: string;
  pricePerShare: string;
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
}

/**
 * User vault position
 */
interface UserVaultPosition {
  address: string;
  shares: string;
  assets: string;
  percentageOfVault: string;
}

/**
 * Vault Controller
 *
 * Provides endpoints for FeeVault and WPUSH operations.
 */
@ApiTags('Vault')
@Controller('vault')
export class VaultController {
  private readonly logger = new Logger(VaultController.name);

  constructor(
    private readonly feeVaultService: FeeVaultContractService,
    private readonly wpushService: WPUSHContractService,
    private readonly transactionBuilder: TransactionBuilderService,
  ) {}

  /**
   * Get FeeVault statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get FeeVault statistics' })
  @ApiResponse({ status: 200, description: 'Returns vault statistics' })
  async getVaultStats(): Promise<VaultStats> {
    try {
      const [vaultStats, assetSymbol, assetDecimals] = await Promise.all([
        this.feeVaultService.getVaultStats(),
        this.wpushService.symbol(),
        this.wpushService.decimals(),
      ]);

      return {
        address: this.feeVaultService.address,
        totalAssets: vaultStats.totalAssets.toString(),
        totalSupply: vaultStats.totalSupply.toString(),
        pricePerShare: vaultStats.pricePerShare.toString(),
        assetAddress: vaultStats.asset,
        assetSymbol,
        assetDecimals,
      };
    } catch (error) {
      this.logger.error(`Failed to get vault stats: ${error.message}`);
      throw new HttpException(
        'Failed to get vault stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user's vault position
   */
  @Get('position/:address')
  @ApiOperation({ summary: 'Get user vault position' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'Returns user vault position' })
  async getUserPosition(
    @Param('address') address: string,
  ): Promise<UserVaultPosition> {
    try {
      const [shares, totalSupply, vaultStats] = await Promise.all([
        this.feeVaultService.balanceOf(address),
        this.feeVaultService.totalSupply(),
        this.feeVaultService.getVaultStats(),
      ]);

      // Calculate assets from shares
      const assets =
        totalSupply > 0n
          ? (shares * vaultStats.totalAssets) / totalSupply
          : 0n;

      // Calculate percentage of vault
      const percentage =
        totalSupply > 0n
          ? ((shares * BigInt(10000)) / totalSupply).toString()
          : '0';

      return {
        address,
        shares: shares.toString(),
        assets: assets.toString(),
        percentageOfVault: (Number(percentage) / 100).toFixed(2),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get vault position for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to get vault position',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Preview deposit - get shares for deposit amount
   */
  @Get('preview-deposit/:amount')
  @ApiOperation({ summary: 'Preview deposit to get expected shares' })
  @ApiParam({ name: 'amount', description: 'Amount of assets to deposit (wei)' })
  @ApiResponse({ status: 200, description: 'Returns expected shares' })
  async previewDeposit(@Param('amount') amount: string): Promise<{
    assets: string;
    shares: string;
  }> {
    try {
      const assets = BigInt(amount);
      const shares = await this.feeVaultService.previewDeposit(assets);

      return {
        assets: assets.toString(),
        shares: shares.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to preview deposit: ${error.message}`);
      throw new HttpException(
        'Failed to preview deposit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Preview withdraw - get shares needed for withdrawal
   */
  @Get('preview-withdraw/:amount')
  @ApiOperation({ summary: 'Preview withdraw to get shares needed' })
  @ApiParam({ name: 'amount', description: 'Amount of assets to withdraw (wei)' })
  @ApiResponse({ status: 200, description: 'Returns shares needed' })
  async previewWithdraw(@Param('amount') amount: string): Promise<{
    assets: string;
    sharesNeeded: string;
  }> {
    try {
      const assets = BigInt(amount);
      const shares = await this.feeVaultService.previewWithdraw(assets);

      return {
        assets: assets.toString(),
        sharesNeeded: shares.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to preview withdraw: ${error.message}`);
      throw new HttpException(
        'Failed to preview withdraw',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Preview redeem - get assets for share amount
   */
  @Get('preview-redeem/:shares')
  @ApiOperation({ summary: 'Preview redeem to get expected assets' })
  @ApiParam({ name: 'shares', description: 'Amount of shares to redeem' })
  @ApiResponse({ status: 200, description: 'Returns expected assets' })
  async previewRedeem(@Param('shares') shares: string): Promise<{
    shares: string;
    assets: string;
  }> {
    try {
      const shareAmount = BigInt(shares);
      const assets = await this.feeVaultService.previewRedeem(shareAmount);

      return {
        shares: shareAmount.toString(),
        assets: assets.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to preview redeem: ${error.message}`);
      throw new HttpException(
        'Failed to preview redeem',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get WPUSH token info
   */
  @Get('wpush/info')
  @ApiOperation({ summary: 'Get WPUSH token information' })
  @ApiResponse({ status: 200, description: 'Returns WPUSH info' })
  async getWPUSHInfo(): Promise<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }> {
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.wpushService.name(),
        this.wpushService.symbol(),
        this.wpushService.decimals(),
        this.wpushService.totalSupply(),
      ]);

      return {
        address: this.wpushService.address,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get WPUSH info: ${error.message}`);
      throw new HttpException(
        'Failed to get WPUSH info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get WPUSH balance for an address
   */
  @Get('wpush/balance/:address')
  @ApiOperation({ summary: 'Get WPUSH balance for address' })
  @ApiParam({ name: 'address', description: 'Wallet address' })
  @ApiResponse({ status: 200, description: 'Returns WPUSH balance' })
  async getWPUSHBalance(@Param('address') address: string): Promise<{
    address: string;
    balance: string;
    formattedBalance: string;
  }> {
    try {
      const [balance, decimals] = await Promise.all([
        this.wpushService.balanceOf(address),
        this.wpushService.decimals(),
      ]);

      // Format balance with decimals
      const divisor = BigInt(10 ** decimals);
      const integerPart = balance / divisor;
      const decimalPart = balance % divisor;
      const formattedBalance = `${integerPart}.${decimalPart.toString().padStart(decimals, '0').slice(0, 6)}`;

      return {
        address,
        balance: balance.toString(),
        formattedBalance,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get WPUSH balance for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to get balance',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get transaction data to wrap PUSH to WPUSH
   */
  @Get('wpush/wrap/:amount')
  @ApiOperation({ summary: 'Get transaction data to wrap PUSH' })
  @ApiParam({ name: 'amount', description: 'Amount to wrap (wei)' })
  @ApiResponse({ status: 200, description: 'Returns transaction data' })
  async getWrapTransaction(@Param('amount') amount: string): Promise<{
    to: string;
    data: string;
    value: string;
    description: string;
  }> {
    try {
      const tx = this.transactionBuilder.encodeWPUSHDeposit(amount);

      return {
        ...tx,
        description: `Wrap ${amount} PUSH to WPUSH`,
      };
    } catch (error) {
      this.logger.error(`Failed to build wrap tx: ${error.message}`);
      throw new HttpException(
        'Failed to build transaction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get transaction data to unwrap WPUSH to PUSH
   */
  @Get('wpush/unwrap/:amount')
  @ApiOperation({ summary: 'Get transaction data to unwrap WPUSH' })
  @ApiParam({ name: 'amount', description: 'Amount to unwrap (wei)' })
  @ApiResponse({ status: 200, description: 'Returns transaction data' })
  async getUnwrapTransaction(@Param('amount') amount: string): Promise<{
    to: string;
    data: string;
    value: string;
    description: string;
  }> {
    try {
      const tx = this.transactionBuilder.encodeWPUSHWithdraw(amount);

      return {
        ...tx,
        description: `Unwrap ${amount} WPUSH to PUSH`,
      };
    } catch (error) {
      this.logger.error(`Failed to build unwrap tx: ${error.message}`);
      throw new HttpException(
        'Failed to build transaction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
