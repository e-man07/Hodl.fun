/**
 * Live E2E Test Contract Instances
 * Creates contract instances for interacting with deployed smart contracts
 */
import { Contract, Interface, parseEther, formatEther, ContractTransactionResponse } from 'ethers';
import { CONTRACT_ADDRESSES, testLog } from './config';
import { getProvider, getWallet, waitForTransaction, getDeadline } from './wallet';

// Core Contract ABI (minimal interface for testing)
const CORE_ABI = [
  // Events
  'event CreateCurve(address indexed creator, address indexed curve, address indexed token, string tokenUri, string name, string symbol)',
  'event Buy(address indexed token, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed token, address indexed from, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',

  // Functions - Note: createCurve has 6 params: creator, name, symbol, tokenURI, amountIn, fee
  'function createCurve(address creator, string name, string symbol, string tokenURI, uint256 amountIn, uint256 fee) external payable returns (address curve, address token)',
  'function exactInBuy(uint256 amountIn, uint256 amountOutMin, address token, address to, uint256 deadline) external payable returns (uint256 amountOut)',
  'function exactOutBuy(uint256 amountOut, uint256 amountInMax, address token, address to, uint256 deadline) external payable returns (uint256 amountIn)',
  'function exactInSell(uint256 amountIn, uint256 amountOutMin, address token, address from, address to, uint256 deadline) external returns (uint256 amountOut)',
  'function exactOutSell(uint256 amountOut, uint256 amountInMax, address token, address from, address to, uint256 deadline) external returns (uint256 amountIn)',
  'function wNative() external view returns (address)',
];

// WPUSH (Wrapped PUSH) Contract ABI
const WPUSH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];

// Factory Contract ABI (matches IBondingCurveFactory)
const FACTORY_ABI = [
  'event Create(address indexed creator, address indexed curve, address indexed token, string tokenUri, string name, string symbol, uint256 virtualNative, uint256 virtualToken)',
  'event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated)',
  'event CreatorFeesClaimed(address indexed creator, uint256 amount)',

  'function getCurve(address token) external view returns (address curve)',
  'function getCreator(address token) external view returns (address creator)',
  'function getConfig() external view returns (tuple(uint256 deployFee, uint256 listingFee, uint256 virtualNative, uint256 virtualToken, uint256 k, uint256 graduationMarketCap, uint8 feeDenominator, uint16 feeNumerator, uint24 dexFee, uint16 creatorFeeShare))',
  'function getDeployFee() external view returns (uint256)',
  'function getCreatorFees(address creator) external view returns (uint256)',
  'function claimCreatorFees() external',
];

// BondingCurve Contract ABI (matches IBondingCurve)
const BONDING_CURVE_ABI = [
  'event Buy(address indexed to, address indexed token, uint256 amountNativeIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed to, address indexed token, uint256 amountTokenIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sync(address indexed token, uint256 realNative, uint256 realToken, uint256 virtualNative, uint256 virtualToken, uint256 price, uint256 timestamp)',
  'event Lock(address indexed token)',
  'event Listing(address indexed curve, address indexed token, address pool, uint256 amount0, uint256 amount1, uint256 liquidity)',
  'event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp)',
  'event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp)',

  'function getReserves() external view returns (uint256 nativeReserves, uint256 tokenReserves)',
  'function getVirtualReserves() external view returns (uint256 virtualNativeReserve, uint256 virtualTokenReserve)',
  'function getK() external view returns (uint256 k)',
  'function getCurrentPrice() external view returns (uint256 price)',
  'function calculateMarketCap() external view returns (uint256 marketCap)',
  'function getLock() external view returns (bool lock)',
  'function getFeeConfig() external view returns (uint8 denominator, uint16 numerator)',
  'function getATHPrice() external view returns (uint256 price, uint256 timestamp)',
  'function getATHMarketCap() external view returns (uint256 marketCap, uint256 timestamp)',
];

// Token Contract ABI
const TOKEN_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function tokenURI() external view returns (string)',
];

// Contract instances cache
let coreContract: Contract | null = null;
let factoryContract: Contract | null = null;
let wpushContract: Contract | null = null;

/**
 * Get Core contract instance (connected to wallet for write operations)
 */
export function getCoreContract(): Contract {
  if (!coreContract) {
    const wallet = getWallet();
    coreContract = new Contract(CONTRACT_ADDRESSES.core, CORE_ABI, wallet);
    testLog('Core contract initialized', { address: CONTRACT_ADDRESSES.core });
  }
  return coreContract;
}

/**
 * Get Core contract instance (read-only, connected to provider)
 */
export function getCoreContractReadOnly(): Contract {
  const provider = getProvider();
  return new Contract(CONTRACT_ADDRESSES.core, CORE_ABI, provider);
}

/**
 * Get Factory contract instance
 */
export function getFactoryContract(): Contract {
  if (!factoryContract) {
    const provider = getProvider();
    factoryContract = new Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, provider);
    testLog('Factory contract initialized', { address: CONTRACT_ADDRESSES.factory });
  }
  return factoryContract;
}

/**
 * Get WPUSH contract instance (connected to wallet for write operations)
 */
export function getWPUSHContract(): Contract {
  if (!wpushContract) {
    const wallet = getWallet();
    wpushContract = new Contract(CONTRACT_ADDRESSES.wpush, WPUSH_ABI, wallet);
    testLog('WPUSH contract initialized', { address: CONTRACT_ADDRESSES.wpush });
  }
  return wpushContract;
}

/**
 * Wrap native PUSH to WPUSH
 */
export async function wrapPUSH(amountPush: string): Promise<string> {
  const wpush = getWPUSHContract();
  const amountWei = parseEther(amountPush);

  testLog('Wrapping PUSH to WPUSH...', { amount: amountPush });

  const tx = await wpush.deposit({ value: amountWei });
  const receipt = await waitForTransaction(tx.hash);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`WPUSH wrap failed: ${tx.hash}`);
  }

  testLog('WPUSH wrap complete', { txHash: tx.hash });
  return tx.hash;
}

/**
 * Approve Core contract to spend WPUSH
 */
export async function approveWPUSHForCore(amountPush: string): Promise<string> {
  const wpush = getWPUSHContract();
  const amountWei = parseEther(amountPush);
  const wallet = getWallet();

  // Check current allowance
  const currentAllowance = await wpush.allowance(wallet.address, CONTRACT_ADDRESSES.core);
  if (currentAllowance >= amountWei) {
    testLog('WPUSH already approved for Core', { allowance: formatEther(currentAllowance) });
    return '';
  }

  testLog('Approving WPUSH for Core contract...', { amount: amountPush });

  const tx = await wpush.approve(CONTRACT_ADDRESSES.core, parseEther('1000000000')); // Approve large amount
  const receipt = await waitForTransaction(tx.hash);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`WPUSH approval failed: ${tx.hash}`);
  }

  testLog('WPUSH approval complete', { txHash: tx.hash });
  return tx.hash;
}

/**
 * Get WPUSH balance for an address
 */
export async function getWPUSHBalance(address: string): Promise<bigint> {
  const wpush = getWPUSHContract();
  return wpush.balanceOf(address);
}

/**
 * Get BondingCurve contract instance for a specific curve
 */
export function getBondingCurveContract(curveAddress: string): Contract {
  const provider = getProvider();
  return new Contract(curveAddress, BONDING_CURVE_ABI, provider);
}

/**
 * Get Token contract instance
 */
export function getTokenContract(tokenAddress: string): Contract {
  const wallet = getWallet();
  return new Contract(tokenAddress, TOKEN_ABI, wallet);
}

/**
 * Get Token contract instance (read-only)
 */
export function getTokenContractReadOnly(tokenAddress: string): Contract {
  const provider = getProvider();
  return new Contract(tokenAddress, TOKEN_ABI, provider);
}

// =============================================================================
// High-Level Contract Interaction Functions
// =============================================================================

export interface CreateTokenResult {
  txHash: string;
  tokenAddress: string;
  curveAddress: string;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Create a new token via Core.createCurve()
 *
 * The Core contract requires:
 * 1. WPUSH approval before calling createCurve
 * 2. The fee parameter to be passed (6th param)
 *
 * Flow: Wrap PUSH → Approve WPUSH → Call createCurve
 */
export async function createToken(
  name: string,
  symbol: string,
  tokenUri: string,
  initialBuyAmountPush: string,
  deployFeePush = '0.01',
): Promise<CreateTokenResult> {
  const core = getCoreContract();
  const wallet = getWallet();

  const initialBuyWei = parseEther(initialBuyAmountPush);
  const deployFeeWei = parseEther(deployFeePush);
  const totalNeeded = initialBuyWei + deployFeeWei;

  testLog('Creating token...', {
    name,
    symbol,
    tokenUri,
    initialBuy: initialBuyAmountPush,
    deployFee: deployFeePush,
    totalNeeded: formatEther(totalNeeded),
  });

  // Step 1: Wrap native PUSH to WPUSH
  testLog('Step 1: Wrapping PUSH to WPUSH...');
  await wrapPUSH(formatEther(totalNeeded));

  // Step 2: Approve Core contract to spend WPUSH
  testLog('Step 2: Approving Core to spend WPUSH...');
  await approveWPUSHForCore(formatEther(totalNeeded));

  // Step 3: Call createCurve (with 6 parameters, no msg.value since we're using WPUSH)
  testLog('Step 3: Calling createCurve...');
  const tx: ContractTransactionResponse = await core.createCurve(
    wallet.address,
    name,
    symbol,
    tokenUri,
    initialBuyWei,
    deployFeeWei,
    // No value - we're using pre-approved WPUSH
  );

  testLog('Transaction submitted', { txHash: tx.hash });

  const receipt = await waitForTransaction(tx.hash);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Token creation transaction failed: ${tx.hash}`);
  }

  // Parse the CreateCurve event to get token and curve addresses
  const coreInterface = new Interface(CORE_ABI);
  let tokenAddress = '';
  let curveAddress = '';

  for (const log of receipt.logs) {
    try {
      const parsed = coreInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'CreateCurve') {
        curveAddress = parsed.args.curve;
        tokenAddress = parsed.args.token;
        break;
      }
    } catch {
      // Not a Core contract event, skip
    }
  }

  if (!tokenAddress || !curveAddress) {
    throw new Error('Could not find CreateCurve event in transaction receipt');
  }

  testLog('Token created successfully', {
    tokenAddress,
    curveAddress,
    blockNumber: receipt.blockNumber,
  });

  return {
    txHash: tx.hash,
    tokenAddress,
    curveAddress,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

export interface BuyResult {
  txHash: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Buy tokens via Core.exactInBuy()
 *
 * The Core contract requires WPUSH approval before buying.
 * Flow: Wrap PUSH → Approve WPUSH → Call exactInBuy
 */
export async function buyTokens(
  tokenAddress: string,
  amountInPush: string,
  slippageTolerance = 0.05,
  deadlineSeconds = 300,
): Promise<BuyResult> {
  const core = getCoreContract();
  const wallet = getWallet();

  const amountInWei = parseEther(amountInPush);

  // Get expected output for slippage calculation using Core's getAmountOut
  const factory = getFactoryContract();
  const curveAddress = await factory.getCurve(tokenAddress);
  const curve = getBondingCurveContract(curveAddress);

  // Get curve data for calculation
  const virtualReserves = await curve.getVirtualReserves();
  const virtualNative = BigInt(virtualReserves[0]);
  const virtualToken = BigInt(virtualReserves[1]);
  const k = BigInt(await curve.getK());

  // Use Core's getAmountOut helper (or calculate directly)
  // For buy: input is native (PUSH), output is token
  // newReserveIn = virtualNative + amountIn
  // newReserveOut = k / newReserveIn
  // amountOut = virtualToken - newReserveOut
  const newReserveIn = virtualNative + amountInWei;
  const newReserveOut = k / newReserveIn;
  const expectedOut = virtualToken - newReserveOut;
  const slippageMultiplier = BigInt(Math.floor((1 - slippageTolerance) * 10000));
  const minAmountOut = (expectedOut * slippageMultiplier) / 10000n;

  const deadline = getDeadline(deadlineSeconds);

  testLog('Buying tokens...', {
    tokenAddress,
    amountIn: amountInPush,
    expectedOut: formatEther(expectedOut),
    minAmountOut: formatEther(minAmountOut),
    deadline,
  });

  // Step 1: Wrap native PUSH to WPUSH
  testLog('Wrapping PUSH to WPUSH for buy...');
  await wrapPUSH(amountInPush);

  // Step 2: Approve Core contract to spend WPUSH
  testLog('Approving Core to spend WPUSH...');
  await approveWPUSHForCore(amountInPush);

  // Step 3: Call exactInBuy (no msg.value, using pre-approved WPUSH)
  const tx: ContractTransactionResponse = await core.exactInBuy(
    amountInWei,
    minAmountOut,
    tokenAddress,
    wallet.address,
    deadline,
    // No value - we're using pre-approved WPUSH
  );

  testLog('Buy transaction submitted', { txHash: tx.hash });

  const receipt = await waitForTransaction(tx.hash);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Buy transaction failed: ${tx.hash}`);
  }

  // Parse the Buy event
  const coreInterface = new Interface(CORE_ABI);
  let amountOut = 0n;
  let price = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = coreInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'Buy') {
        amountOut = parsed.args.amountOut;
        price = parsed.args.price;
        break;
      }
    } catch {
      // Not a Core contract event, skip
    }
  }

  testLog('Buy completed', {
    amountIn: amountInPush,
    amountOut: formatEther(amountOut),
    price: formatEther(price),
    blockNumber: receipt.blockNumber,
  });

  return {
    txHash: tx.hash,
    amountIn: amountInWei,
    amountOut,
    price,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

export interface SellResult {
  txHash: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Sell tokens via Core.exactInSell()
 */
export async function sellTokens(
  tokenAddress: string,
  amountInTokens: string,
  slippageTolerance = 0.05,
  deadlineSeconds = 300,
): Promise<SellResult> {
  const core = getCoreContract();
  const wallet = getWallet();

  const amountInWei = parseEther(amountInTokens);

  // First approve the Core contract to spend tokens
  const token = getTokenContract(tokenAddress);
  const allowance = await token.allowance(wallet.address, CONTRACT_ADDRESSES.core);

  if (allowance < amountInWei) {
    testLog('Approving tokens for Core contract...');
    const approveTx = await token.approve(
      CONTRACT_ADDRESSES.core,
      parseEther('1000000000'), // Approve max amount
    );
    await waitForTransaction(approveTx.hash);
    testLog('Approval complete');
  }

  // Get expected output for slippage calculation using curve data
  const factory = getFactoryContract();
  const curveAddress = await factory.getCurve(tokenAddress);
  const curve = getBondingCurveContract(curveAddress);

  // Get curve data for calculation
  const virtualReserves = await curve.getVirtualReserves();
  const virtualNative = BigInt(virtualReserves[0]);
  const virtualToken = BigInt(virtualReserves[1]);
  const k = BigInt(await curve.getK());

  // For sell: input is token, output is native (PUSH)
  // newReserveIn = virtualToken + amountIn
  // newReserveOut = k / newReserveIn
  // amountOut = virtualNative - newReserveOut
  const newReserveIn = virtualToken + amountInWei;
  const newReserveOut = k / newReserveIn;
  const expectedOut = virtualNative - newReserveOut;
  const slippageMultiplier = BigInt(Math.floor((1 - slippageTolerance) * 10000));
  const minAmountOut = (expectedOut * slippageMultiplier) / 10000n;

  const deadline = getDeadline(deadlineSeconds);

  testLog('Selling tokens...', {
    tokenAddress,
    amountIn: amountInTokens,
    expectedOut: formatEther(expectedOut),
    minAmountOut: formatEther(minAmountOut),
    deadline,
  });

  const tx: ContractTransactionResponse = await core.exactInSell(
    amountInWei,
    minAmountOut,
    tokenAddress,
    wallet.address,
    wallet.address,
    deadline,
  );

  testLog('Sell transaction submitted', { txHash: tx.hash });

  const receipt = await waitForTransaction(tx.hash);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Sell transaction failed: ${tx.hash}`);
  }

  // Parse the Sell event
  const coreInterface = new Interface(CORE_ABI);
  let amountOut = 0n;
  let price = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = coreInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'Sell') {
        amountOut = parsed.args.amountOut;
        price = parsed.args.price;
        break;
      }
    } catch {
      // Not a Core contract event, skip
    }
  }

  testLog('Sell completed', {
    amountIn: amountInTokens,
    amountOut: formatEther(amountOut),
    price: formatEther(price),
    blockNumber: receipt.blockNumber,
  });

  return {
    txHash: tx.hash,
    amountIn: amountInWei,
    amountOut,
    price,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(tokenAddress: string, holderAddress: string): Promise<bigint> {
  const token = getTokenContractReadOnly(tokenAddress);
  return token.balanceOf(holderAddress);
}

/**
 * Get bonding curve state
 */
export async function getCurveState(curveAddress: string): Promise<{
  realNative: bigint;
  realToken: bigint;
  virtualNative: bigint;
  virtualToken: bigint;
  price: bigint;
  marketCap: bigint;
  locked: boolean;
}> {
  const curve = getBondingCurveContract(curveAddress);

  const [reserves, virtualReserves, price, marketCap, locked] = await Promise.all([
    curve.getReserves(),
    curve.getVirtualReserves(),
    curve.getCurrentPrice(),
    curve.calculateMarketCap(),
    curve.getLock(),
  ]);

  return {
    realNative: reserves[0],
    realToken: reserves[1],
    virtualNative: virtualReserves[0],
    virtualToken: virtualReserves[1],
    price,
    marketCap,
    locked,
  };
}

/**
 * Check if an address is a valid token created by the factory
 * by checking if getCurve returns a non-zero address
 */
export async function isValidToken(tokenAddress: string): Promise<boolean> {
  try {
    const factory = getFactoryContract();
    const curveAddress = await factory.getCurve(tokenAddress);
    return curveAddress !== '0x0000000000000000000000000000000000000000';
  } catch {
    return false;
  }
}

/**
 * Get curve address for a token
 */
export async function getCurveForToken(tokenAddress: string): Promise<string> {
  const factory = getFactoryContract();
  return factory.getCurve(tokenAddress);
}

/**
 * Get factory configuration (global bonding curve parameters)
 */
export async function getFactoryConfig(): Promise<{
  deployFee: bigint;
  listingFee: bigint;
  virtualNative: bigint;
  virtualToken: bigint;
  k: bigint;
  graduationMarketCap: bigint;
  feeDenominator: number;
  feeNumerator: number;
  dexFee: number;
  creatorFeeShare: number;
}> {
  const factory = getFactoryContract();
  const config = await factory.getConfig();

  return {
    deployFee: config.deployFee,
    listingFee: config.listingFee,
    virtualNative: config.virtualNative,
    virtualToken: config.virtualToken,
    k: config.k,
    graduationMarketCap: config.graduationMarketCap,
    feeDenominator: Number(config.feeDenominator),
    feeNumerator: Number(config.feeNumerator),
    dexFee: Number(config.dexFee),
    creatorFeeShare: Number(config.creatorFeeShare),
  };
}

/**
 * Get ATH (All-Time High) state for a bonding curve
 */
export async function getATHState(curveAddress: string): Promise<{
  athPrice: bigint;
  athPriceTimestamp: bigint;
  athMarketCap: bigint;
  athMarketCapTimestamp: bigint;
}> {
  const curve = getBondingCurveContract(curveAddress);
  const [athPrice, athMarketCap] = await Promise.all([
    curve.getATHPrice(),
    curve.getATHMarketCap(),
  ]);

  return {
    athPrice: athPrice[0],
    athPriceTimestamp: athPrice[1],
    athMarketCap: athMarketCap[0],
    athMarketCapTimestamp: athMarketCap[1],
  };
}

/**
 * Get token metadata from on-chain contract
 */
export async function getTokenMetadata(tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  tokenURI: string;
}> {
  const token = getTokenContractReadOnly(tokenAddress);
  const [name, symbol, decimals, totalSupply, tokenURI] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
    token.tokenURI(),
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply,
    tokenURI,
  };
}

/**
 * Get accumulated creator fees from Factory events
 */
export async function getCreatorAccumulatedFees(creatorAddress: string): Promise<bigint> {
  const provider = getProvider();
  const factoryInterface = new Interface(FACTORY_ABI);
  const topic = factoryInterface.getEvent('CreatorFeesAccumulated')!.topicHash;
  const creatorTopic = '0x' + creatorAddress.toLowerCase().slice(2).padStart(64, '0');

  // Get current block and query last 9000 blocks (under 10000 RPC limit)
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 9000);

  const logs = await provider.getLogs({
    address: CONTRACT_ADDRESSES.factory,
    topics: [topic, creatorTopic],
    fromBlock,
    toBlock: 'latest',
  });

  if (logs.length === 0) {
    return 0n;
  }

  // The most recent event has the cumulative totalAccumulated
  const lastLog = logs[logs.length - 1];
  const parsed = factoryInterface.parseLog({
    topics: lastLog.topics as string[],
    data: lastLog.data,
  });

  return BigInt(parsed!.args.totalAccumulated);
}

export interface ClaimFeesResult {
  txHash: string;
  amountClaimed: bigint;
  blockNumber: number;
  gasUsed: bigint;
}

/**
 * Claim creator fees via Factory.claimCreatorFees()
 * Note: This may not be available on all contract versions
 */
export async function claimCreatorFees(): Promise<ClaimFeesResult> {
  const wallet = getWallet();
  const factory = new Contract(CONTRACT_ADDRESSES.factory, FACTORY_ABI, wallet);

  testLog('Claiming creator fees...');

  const tx: ContractTransactionResponse = await factory.claimCreatorFees();
  testLog('Claim transaction submitted', { txHash: tx.hash });

  const receipt = await waitForTransaction(tx.hash);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`Claim transaction failed: ${tx.hash}`);
  }

  // Parse the CreatorFeesClaimed event
  const factoryInterface = new Interface(FACTORY_ABI);
  let amountClaimed = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = factoryInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'CreatorFeesClaimed') {
        amountClaimed = BigInt(parsed.args.amount);
        break;
      }
    } catch {
      // Not a Factory contract event, skip
    }
  }

  testLog('Creator fees claimed', {
    amountClaimed: formatEther(amountClaimed),
    blockNumber: receipt.blockNumber,
    txHash: tx.hash,
  });

  return {
    txHash: tx.hash,
    amountClaimed,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  };
}

/**
 * Cleanup contract instances
 */
export function cleanupContracts(): void {
  coreContract = null;
  factoryContract = null;
  wpushContract = null;
  testLog('Contract instances cleanup complete');
}
