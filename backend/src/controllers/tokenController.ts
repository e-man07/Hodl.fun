// Token controller - Handles HTTP requests for tokens

import { Request, Response } from 'express';
import { tokenService } from '../services/tokenService';
import { contractService } from '../services/contractService';
import { sendSuccess, sendPaginated } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { TokenQueryParams, ValidationError } from '../types';
import { ethers } from 'ethers';

export class TokenController {
  /**
   * GET /api/v1/tokens
   * List all tokens with pagination, filtering, and sorting
   */
  getTokens = asyncHandler(async (req: Request, res: Response) => {
    // Parse and validate query parameters
    const params: TokenQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 24, 100), // Max 100 per page
      sort: (req.query.sort as any) || 'marketCap',
      order: (req.query.order as 'asc' | 'desc') || 'desc',
      search: req.query.search as string,
      creator: req.query.creator as string,
      minMarketCap: req.query.minMarketCap ? parseFloat(req.query.minMarketCap as string) : undefined,
      maxMarketCap: req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap as string) : undefined,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
    };

    // Validate parameters
    if (params.page! < 1) {
      throw new ValidationError('Page must be >= 1');
    }

    if (params.limit! < 1 || params.limit! > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    const validSorts = ['marketCap', 'volume', 'holders', 'created', 'price'];
    if (!validSorts.includes(params.sort!)) {
      throw new ValidationError(`Sort must be one of: ${validSorts.join(', ')}`);
    }

    // Get tokens
    const { tokens, total } = await tokenService.getTokens(params);

    // Send paginated response
    sendPaginated(res, tokens, params.page!, params.limit!, total);
  });

  /**
   * GET /api/v1/tokens/:address
   * Get token details by address
   */
  getTokenByAddress = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    // Validate address format
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    const token = await tokenService.getTokenByAddress(address);

    sendSuccess(res, token);
  });

  /**
   * GET /api/v1/tokens/:address/metrics
   * Get token price history and metrics
   */
  getTokenMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const period = (req.query.period as '1h' | '24h' | '7d' | '30d' | 'all') || '24h';

    // Validate address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate period
    const validPeriods = ['1h', '24h', '7d', '30d', 'all'];
    if (!validPeriods.includes(period)) {
      throw new ValidationError(`Period must be one of: ${validPeriods.join(', ')}`);
    }

    const metrics = await tokenService.getTokenMetrics(address, period);

    sendSuccess(res, {
      tokenAddress: address,
      period,
      metrics,
      count: Array.isArray(metrics) ? metrics.length : 0,
    });
  });

  /**
   * GET /api/v1/tokens/:address/holders
   * Get token holders list
   */
  getTokenHolders = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Validate address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate pagination
    if (page < 1) {
      throw new ValidationError('Page must be >= 1');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    const { holders, total } = await tokenService.getTokenHolders(address, page, limit);

    sendPaginated(res, holders, page, limit, total);
  });

  /**
   * GET /api/v1/tokens/:address/trades
   * Get token trade history
   */
  getTokenTrades = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Validate address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate pagination
    if (page < 1) {
      throw new ValidationError('Page must be >= 1');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    const { trades, total } = await tokenService.getTokenTrades(address, page, limit);

    sendPaginated(res, trades, page, limit, total);
  });

  /**
   * GET /api/v1/tokens/trending
   * Get trending tokens
   */
  getTrendingTokens = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Get tokens sorted by volume and price change
    const { tokens } = await tokenService.getTokens({
      page: 1,
      limit,
      sort: 'volume',
      order: 'desc',
    });

    // Calculate trending score (volume * price change)
    const trending = tokens
      .map((token) => ({
        ...token,
        score: token.volume24h * (1 + token.priceChange24h / 100),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    sendSuccess(res, {
      trending,
      count: trending.length,
    });
  });

  /**
   * GET /api/v1/tokens/new
   * Get recently launched tokens
   */
  getNewTokens = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const { tokens } = await tokenService.getTokens({
      page: 1,
      limit,
      sort: 'created',
      order: 'desc',
    });

    sendSuccess(res, {
      newTokens: tokens,
      count: tokens.length,
    });
  });

  /**
   * POST /api/v1/tokens/batch
   * Get multiple tokens by addresses in a single request
   */
  getTokensBatch = asyncHandler(async (req: Request, res: Response) => {
    const { addresses } = req.body;

    // Validate addresses array
    if (!addresses || !Array.isArray(addresses)) {
      throw new ValidationError('addresses must be an array');
    }

    if (addresses.length === 0) {
      sendSuccess(res, { tokens: [] });
      return;
    }

    if (addresses.length > 100) {
      throw new ValidationError('Maximum 100 addresses per request');
    }

    // Validate each address format
    for (const address of addresses) {
      if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new ValidationError(`Invalid token address format: ${address}`);
      }
    }

    // Fetch all tokens in parallel
    const tokens = await Promise.all(
      addresses.map(async (address: string) => {
        try {
          return await tokenService.getTokenByAddress(address);
        } catch {
          // Return null for tokens that don't exist
          return null;
        }
      })
    );

    // Filter out null values (non-existent tokens)
    const validTokens = tokens.filter(token => token !== null);

    sendSuccess(res, {
      tokens: validTokens,
      requested: addresses.length,
      found: validTokens.length,
    });
  });

  /**
   * POST /api/v1/tokens/:address/calculate-buy
   * Calculate how many tokens user will receive for given ETH amount
   */
  calculateBuyQuote = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const { ethAmount } = req.body;

    // Validate token address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate ETH amount
    if (!ethAmount || isNaN(parseFloat(ethAmount))) {
      throw new ValidationError('Invalid ETH amount');
    }

    const ethAmountFloat = parseFloat(ethAmount);
    if (ethAmountFloat <= 0) {
      throw new ValidationError('ETH amount must be greater than 0');
    }

    // Convert to wei and call contract
    const ethAmountWei = ethers.parseEther(ethAmount.toString());
    const tokenAmountWei = await contractService.calculatePurchaseReturn(
      address.toLowerCase(),
      ethAmountWei
    );

    // Format response
    const tokenAmountFormatted = ethers.formatEther(tokenAmountWei);
    const price = ethAmountFloat / parseFloat(tokenAmountFormatted);

    sendSuccess(res, {
      ethAmount: ethAmount.toString(),
      tokenAmount: tokenAmountFormatted,
      tokenAmountRaw: tokenAmountWei.toString(),
      price,
    });
  });

  /**
   * POST /api/v1/tokens/:address/calculate-sell
   * Calculate how much ETH user will receive for given token amount
   */
  calculateSellQuote = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const { tokenAmount } = req.body;

    // Validate token address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate token amount
    if (!tokenAmount || isNaN(parseFloat(tokenAmount))) {
      throw new ValidationError('Invalid token amount');
    }

    const tokenAmountFloat = parseFloat(tokenAmount);
    if (tokenAmountFloat <= 0) {
      throw new ValidationError('Token amount must be greater than 0');
    }

    // Convert to wei and call contract
    const tokenAmountWei = ethers.parseEther(tokenAmount.toString());
    const ethAmountWei = await contractService.calculateSaleReturn(
      address.toLowerCase(),
      tokenAmountWei
    );

    // Format response
    const ethAmountFormatted = ethers.formatEther(ethAmountWei);
    const price = parseFloat(ethAmountFormatted) / tokenAmountFloat;

    sendSuccess(res, {
      tokenAmount: tokenAmount.toString(),
      ethAmount: ethAmountFormatted,
      ethAmountRaw: ethAmountWei.toString(),
      price,
    });
  });

  /**
   * GET /api/v1/tokens/:address/balance/:userAddress
   * Get token balance for a specific user address
   */
  getTokenBalance = asyncHandler(async (req: Request, res: Response) => {
    const { address, userAddress } = req.params;

    // Validate token address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    // Validate user address
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid user address format');
    }

    // Get balance from contract
    const balanceWei = await contractService.getTokenBalance(
      address.toLowerCase(),
      userAddress.toLowerCase()
    );

    sendSuccess(res, {
      tokenAddress: address.toLowerCase(),
      userAddress: userAddress.toLowerCase(),
      balance: balanceWei.toString(),
      formatted: ethers.formatEther(balanceWei),
    });
  });

  /**
   * GET /api/v1/tokens/:address/allowance/:owner/:spender
   * Get token allowance for owner/spender pair
   */
  getAllowance = asyncHandler(async (req: Request, res: Response) => {
    const { address, owner, spender } = req.params;

    // Validate addresses
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }
    if (!owner || !owner.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid owner address format');
    }
    if (!spender || !spender.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid spender address format');
    }

    // Get token contract and check allowance
    const tokenContract = contractService.getTokenContract(address.toLowerCase());
    const allowanceWei = await tokenContract.allowance(
      owner.toLowerCase(),
      spender.toLowerCase()
    );

    sendSuccess(res, {
      tokenAddress: address.toLowerCase(),
      owner: owner.toLowerCase(),
      spender: spender.toLowerCase(),
      allowance: allowanceWei.toString(),
      formatted: ethers.formatEther(allowanceWei),
    });
  });

  /**
   * GET /api/v1/tokens/:address/holder-count
   * Get total number of holders for a token
   */
  getHolderCount = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    // Validate address
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid token address format');
    }

    const count = await tokenService.getHolderCount(address.toLowerCase());

    sendSuccess(res, {
      tokenAddress: address.toLowerCase(),
      holderCount: count,
    });
  });
}

// Export singleton instance
export const tokenController = new TokenController();
