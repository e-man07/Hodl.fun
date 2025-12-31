/**
 * Phase 2: Contract Read Tests
 *
 * Tests reading data from deployed contracts.
 * This is a read-only test that doesn't require gas.
 *
 * Usage:
 *   npx ts-node test/integration/2-test-contract-reads.ts
 */

import { JsonRpcProvider, Contract, formatEther, formatUnits } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.testnet' });

const RPC_URL = process.env.PUSH_CHAIN_RPC_URL || 'https://rpc.push.org/testnet';
const CORE_ADDRESS = process.env.V2_CORE_ADDRESS;
const FACTORY_ADDRESS = process.env.V2_FACTORY_ADDRESS;
const FEE_VAULT_ADDRESS = process.env.V2_FEE_VAULT_ADDRESS;
const WPUSH_ADDRESS = process.env.V2_WPUSH_ADDRESS;

// ABIs (minimal for read operations)
const CORE_ABI = [
  'function factory() view returns (address)',
  'function wpush() view returns (address)',
  'function feeVault() view returns (address)',
  'function quoteExactInBuy(address curve, uint256 amountIn) view returns (uint256 amountOut, uint256 creatorFee, uint256 protocolFee, uint256 priceImpact)',
  'function quoteExactInSell(address curve, uint256 amountIn) view returns (uint256 amountOut, uint256 creatorFee, uint256 protocolFee, uint256 priceImpact)',
];

const FACTORY_ABI = [
  'function core() view returns (address)',
  'function feeVault() view returns (address)',
  'function tokenImplementation() view returns (address)',
  'function bondingCurveImplementation() view returns (address)',
  'function getCurve(address token) view returns (address)',
  'function getToken(address curve) view returns (address)',
  'function creatorFees(address creator) view returns (uint256)',
  'function creatorFeeRate() view returns (uint256)',
  'function protocolFeeRate() view returns (uint256)',
  'function graduationThreshold() view returns (uint256)',
];

const FEE_VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function asset() view returns (address)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
];

const WPUSH_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg: string, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

async function main() {
  log('\n═══════════════════════════════════════', CYAN);
  log('  Phase 2: Contract Read Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  // Check required addresses
  const missing: string[] = [];
  if (!CORE_ADDRESS) missing.push('V2_CORE_ADDRESS');
  if (!FACTORY_ADDRESS) missing.push('V2_FACTORY_ADDRESS');
  if (!FEE_VAULT_ADDRESS) missing.push('V2_FEE_VAULT_ADDRESS');
  if (!WPUSH_ADDRESS) missing.push('V2_WPUSH_ADDRESS');

  if (missing.length > 0) {
    log(`Missing environment variables: ${missing.join(', ')}`, RED);
    log('Please configure .env.testnet with contract addresses', YELLOW);
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC_URL);

  // Create contract instances
  const core = new Contract(CORE_ADDRESS!, CORE_ABI, provider);
  const factory = new Contract(FACTORY_ADDRESS!, FACTORY_ABI, provider);
  const feeVault = new Contract(FEE_VAULT_ADDRESS!, FEE_VAULT_ABI, provider);
  const wpush = new Contract(WPUSH_ADDRESS!, WPUSH_ABI, provider);

  // Test Core Contract
  log('═══════════════════════════════════════', CYAN);
  log('  Core Contract Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  try {
    log('Reading Core contract state...');

    const [factoryAddr, wpushAddr, feeVaultAddr] = await Promise.all([
      core.factory(),
      core.wpush(),
      core.feeVault(),
    ]);

    log(`  ✓ factory(): ${factoryAddr}`, GREEN);
    log(`  ✓ wpush(): ${wpushAddr}`, GREEN);
    log(`  ✓ feeVault(): ${feeVaultAddr}`, GREEN);

    // Verify addresses match config
    if (factoryAddr.toLowerCase() !== FACTORY_ADDRESS!.toLowerCase()) {
      log(`  ⚠ Factory address mismatch with config`, YELLOW);
    }
    if (wpushAddr.toLowerCase() !== WPUSH_ADDRESS!.toLowerCase()) {
      log(`  ⚠ WPUSH address mismatch with config`, YELLOW);
    }
    if (feeVaultAddr.toLowerCase() !== FEE_VAULT_ADDRESS!.toLowerCase()) {
      log(`  ⚠ FeeVault address mismatch with config`, YELLOW);
    }
  } catch (error) {
    log(`  ✗ Failed to read Core: ${(error as Error).message}`, RED);
  }

  // Test Factory Contract
  log('\n═══════════════════════════════════════', CYAN);
  log('  Factory Contract Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  try {
    log('Reading Factory contract state...');

    const [
      coreAddr,
      tokenImpl,
      curveImpl,
      creatorFeeRate,
      protocolFeeRate,
      graduationThreshold,
    ] = await Promise.all([
      factory.core(),
      factory.tokenImplementation(),
      factory.bondingCurveImplementation(),
      factory.creatorFeeRate(),
      factory.protocolFeeRate(),
      factory.graduationThreshold(),
    ]);

    log(`  ✓ core(): ${coreAddr}`, GREEN);
    log(`  ✓ tokenImplementation(): ${tokenImpl}`, GREEN);
    log(`  ✓ bondingCurveImplementation(): ${curveImpl}`, GREEN);
    log(`  ✓ creatorFeeRate(): ${creatorFeeRate.toString()} (${Number(creatorFeeRate) / 100}%)`, GREEN);
    log(`  ✓ protocolFeeRate(): ${protocolFeeRate.toString()} (${Number(protocolFeeRate) / 100}%)`, GREEN);
    log(`  ✓ graduationThreshold(): ${formatEther(graduationThreshold)} PUSH`, GREEN);
  } catch (error) {
    log(`  ✗ Failed to read Factory: ${(error as Error).message}`, RED);
  }

  // Test FeeVault Contract
  log('\n═══════════════════════════════════════', CYAN);
  log('  FeeVault Contract Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  try {
    log('Reading FeeVault contract state...');

    const [totalAssets, totalSupply, asset] = await Promise.all([
      feeVault.totalAssets(),
      feeVault.totalSupply(),
      feeVault.asset(),
    ]);

    log(`  ✓ totalAssets(): ${formatEther(totalAssets)} WPUSH`, GREEN);
    log(`  ✓ totalSupply(): ${formatEther(totalSupply)} shares`, GREEN);
    log(`  ✓ asset(): ${asset}`, GREEN);

    // Calculate price per share
    if (totalSupply > 0n) {
      const pricePerShare = await feeVault.convertToAssets(BigInt(10) ** BigInt(18));
      log(`  ✓ pricePerShare: ${formatEther(pricePerShare)} WPUSH per share`, GREEN);
    }
  } catch (error) {
    log(`  ✗ Failed to read FeeVault: ${(error as Error).message}`, RED);
  }

  // Test WPUSH Contract
  log('\n═══════════════════════════════════════', CYAN);
  log('  WPUSH Contract Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  try {
    log('Reading WPUSH contract state...');

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      wpush.name(),
      wpush.symbol(),
      wpush.decimals(),
      wpush.totalSupply(),
    ]);

    log(`  ✓ name(): ${name}`, GREEN);
    log(`  ✓ symbol(): ${symbol}`, GREEN);
    log(`  ✓ decimals(): ${decimals}`, GREEN);
    log(`  ✓ totalSupply(): ${formatUnits(totalSupply, decimals)} ${symbol}`, GREEN);
  } catch (error) {
    log(`  ✗ Failed to read WPUSH: ${(error as Error).message}`, RED);
  }

  // Test quote functions (if any tokens exist)
  log('\n═══════════════════════════════════════', CYAN);
  log('  Quote Function Tests', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  const testTokenAddress = process.env.TEST_TOKEN_ADDRESS;
  if (testTokenAddress) {
    try {
      log(`Testing quotes for token: ${testTokenAddress}`);

      const curveAddress = await factory.getCurve(testTokenAddress);
      log(`  ✓ getCurve(): ${curveAddress}`, GREEN);

      if (curveAddress !== '0x0000000000000000000000000000000000000000') {
        // Test buy quote
        const buyAmount = BigInt(10) ** BigInt(18); // 1 PUSH
        const buyQuote = await core.quoteExactInBuy(curveAddress, buyAmount);
        log(`  ✓ quoteExactInBuy(1 PUSH):`, GREEN);
        log(`      amountOut: ${formatEther(buyQuote.amountOut)} tokens`);
        log(`      creatorFee: ${formatEther(buyQuote.creatorFee)} PUSH`);
        log(`      protocolFee: ${formatEther(buyQuote.protocolFee)} PUSH`);
        log(`      priceImpact: ${Number(buyQuote.priceImpact) / 100}%`);

        // Test sell quote
        const sellAmount = buyQuote.amountOut; // Use the tokens from buy
        const sellQuote = await core.quoteExactInSell(curveAddress, sellAmount);
        log(`  ✓ quoteExactInSell(${formatEther(sellAmount)} tokens):`, GREEN);
        log(`      amountOut: ${formatEther(sellQuote.amountOut)} PUSH`);
        log(`      creatorFee: ${formatEther(sellQuote.creatorFee)} tokens`);
        log(`      protocolFee: ${formatEther(sellQuote.protocolFee)} tokens`);
        log(`      priceImpact: ${Number(sellQuote.priceImpact) / 100}%`);
      } else {
        log(`  ⚠ No curve found for token - skipping quote tests`, YELLOW);
      }
    } catch (error) {
      log(`  ✗ Quote test failed: ${(error as Error).message}`, RED);
    }
  } else {
    log('  ⚠ TEST_TOKEN_ADDRESS not set - skipping quote tests', YELLOW);
    log('  Set TEST_TOKEN_ADDRESS in .env.testnet to test quotes', YELLOW);
  }

  log('\n═══════════════════════════════════════', CYAN);
  log('  Contract Read Tests Complete', CYAN);
  log('═══════════════════════════════════════\n', CYAN);
}

main().catch(console.error);
