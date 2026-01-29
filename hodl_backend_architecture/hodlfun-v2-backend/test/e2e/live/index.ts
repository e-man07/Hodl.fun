/**
 * Live E2E Test Exports
 * Central export point for all live testing utilities
 */

// Configuration
export * from './config';

// Wallet management
export {
  getProvider,
  getWallet,
  getWalletAddress,
  getWalletBalance,
  hasSufficientBalance,
  signMessage,
  verifyLocalSignature,
  getWalletNonce,
  getGasPrice,
  waitForTransaction,
  getCurrentBlockNumber,
  getBlock,
  printWalletInfo,
  cleanup,
  getDeadline,
  ethers,
  parseEther,
  formatEther,
} from './wallet';

// Contract interactions
export {
  getCoreContract,
  getCoreContractReadOnly,
  getFactoryContract,
  getBondingCurveContract,
  getTokenContract,
  getTokenContractReadOnly,
  getWPUSHContract,
  wrapPUSH,
  approveWPUSHForCore,
  getWPUSHBalance,
  createToken,
  buyTokens,
  sellTokens,
  getTokenBalance,
  getCurveState,
  isValidToken,
  getCurveForToken,
  getFactoryConfig,
  getATHState,
  getTokenMetadata,
  getCreatorAccumulatedFees,
  claimCreatorFees,
  cleanupContracts,
} from './contracts';

export type { CreateTokenResult, BuyResult, SellResult, ClaimFeesResult } from './contracts';

// API client
export * from './api-client';

// WebSocket client
export * from './websocket-client';
