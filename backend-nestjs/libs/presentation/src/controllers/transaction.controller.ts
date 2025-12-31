import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TransactionBuilderService } from '../../../infrastructure/src/contracts/services/transaction-builder.service';
import { CoreContractService } from '../../../infrastructure/src/contracts/services/core-contract.service';
import { FactoryContractService } from '../../../infrastructure/src/contracts/services/factory-contract.service';
import {
  BuildCreateTokenTxDto,
  BuildBuyTxDto,
  BuildSellTxDto,
  QuoteBuyQueryDto,
  QuoteSellQueryDto,
} from '../dtos/requests/transaction.dto';
import {
  TransactionDataResponseDto,
  QuoteResponseDto,
  ApproveTransactionResponseDto,
} from '../dtos/responses/transaction.response';

/**
 * Transaction Controller
 *
 * Provides endpoints for building transaction calldata.
 * Frontend signs and broadcasts these transactions.
 */
@Controller('transactions')
export class TransactionController {
  private readonly logger = new Logger(TransactionController.name);

  constructor(
    private readonly transactionBuilderService: TransactionBuilderService,
    private readonly coreContractService: CoreContractService,
    private readonly factoryContractService: FactoryContractService,
  ) {}

  /**
   * Build create token transaction calldata
   *
   * @param dto Create token parameters
   * @returns Transaction data for frontend signing
   */
  @Post('build/create-token')
  async buildCreateToken(
    @Body() dto: BuildCreateTokenTxDto,
  ): Promise<TransactionDataResponseDto> {
    this.logger.log(
      `Building create token tx: ${dto.name} (${dto.symbol}) by ${dto.creator}`,
    );

    const txData = this.transactionBuilderService.encodeCreateCurve({
      creator: dto.creator,
      name: dto.name,
      symbol: dto.symbol,
      tokenURI: dto.tokenURI || '',
      amountIn: dto.amountIn,
      fee: dto.fee || '0',
    });

    return {
      to: txData.to,
      data: txData.data,
      value: txData.value,
    };
  }

  /**
   * Build buy transaction calldata
   *
   * @param dto Buy parameters
   * @returns Transaction data for frontend signing
   */
  @Post('build/buy')
  async buildBuy(@Body() dto: BuildBuyTxDto): Promise<TransactionDataResponseDto> {
    this.logger.log(
      `Building buy tx: ${dto.amountIn} PUSH for token ${dto.token}`,
    );

    const deadline = dto.deadline
      ? parseInt(dto.deadline, 10)
      : this.transactionBuilderService.buildDeadline(20);

    const txData = this.transactionBuilderService.encodeExactInBuy({
      amountIn: dto.amountIn,
      amountOutMin: dto.amountOutMin || '0',
      token: dto.token,
      to: dto.to,
      deadline,
    });

    return {
      to: txData.to,
      data: txData.data,
      value: txData.value,
    };
  }

  /**
   * Build sell transaction calldata
   *
   * @param dto Sell parameters
   * @returns Transaction data for frontend signing
   */
  @Post('build/sell')
  async buildSell(@Body() dto: BuildSellTxDto): Promise<TransactionDataResponseDto> {
    this.logger.log(
      `Building sell tx: ${dto.amountIn} tokens of ${dto.token}`,
    );

    const deadline = dto.deadline
      ? parseInt(dto.deadline, 10)
      : this.transactionBuilderService.buildDeadline(20);

    const txData = this.transactionBuilderService.encodeExactInSell({
      amountIn: dto.amountIn,
      amountOutMin: dto.amountOutMin || '0',
      token: dto.token,
      from: dto.from,
      to: dto.to,
      deadline,
    });

    return {
      to: txData.to,
      data: txData.data,
      value: txData.value,
    };
  }

  /**
   * Get quote for buy operation
   *
   * @param query Quote parameters
   * @returns Quote with amount out and price impact
   */
  @Get('quote/buy')
  async quoteBuy(@Query() query: QuoteBuyQueryDto): Promise<QuoteResponseDto> {
    this.logger.debug(
      `Quoting buy: ${query.amountIn} PUSH for token ${query.token}`,
    );

    // Get curve address from factory
    const curveAddress = await this.factoryContractService.getCurve(query.token);

    if (
      !curveAddress ||
      curveAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new NotFoundException(
        `No bonding curve found for token ${query.token}`,
      );
    }

    try {
      const quote = await this.coreContractService.quoteExactInBuy(
        curveAddress,
        BigInt(query.amountIn),
      );

      return quote;
    } catch (error) {
      this.logger.error(`Quote buy failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `Failed to quote buy: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get quote for sell operation
   *
   * @param query Quote parameters
   * @returns Quote with amount out and price impact
   */
  @Get('quote/sell')
  async quoteSell(@Query() query: QuoteSellQueryDto): Promise<QuoteResponseDto> {
    this.logger.debug(
      `Quoting sell: ${query.amountIn} tokens of ${query.token}`,
    );

    // Get curve address from factory
    const curveAddress = await this.factoryContractService.getCurve(query.token);

    if (
      !curveAddress ||
      curveAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new NotFoundException(
        `No bonding curve found for token ${query.token}`,
      );
    }

    try {
      const quote = await this.coreContractService.quoteExactInSell(
        curveAddress,
        BigInt(query.amountIn),
      );

      return quote;
    } catch (error) {
      this.logger.error(`Quote sell failed: ${(error as Error).message}`);
      throw new BadRequestException(
        `Failed to quote sell: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Build ERC20 approval transaction for Core contract
   *
   * @param body Token and amount to approve
   * @returns Transaction data for frontend signing
   */
  @Post('build/approve')
  async buildApprove(
    @Body() body: { token: string; amount: string },
  ): Promise<ApproveTransactionResponseDto> {
    this.logger.log(`Building approve tx: ${body.amount} of ${body.token}`);

    const txData = this.transactionBuilderService.encodeApproveForCore(
      body.token,
      body.amount,
    );

    return {
      to: txData.to,
      data: txData.data,
      value: txData.value,
    };
  }

  /**
   * Get contract addresses
   *
   * @returns Core and Factory contract addresses
   */
  @Get('contracts')
  async getContractAddresses(): Promise<{
    core: string;
    factory: string;
  }> {
    return {
      core: this.transactionBuilderService.getCoreAddress(),
      factory: this.transactionBuilderService.getFactoryAddress(),
    };
  }
}
