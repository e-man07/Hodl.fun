/**
 * Phase 1: RPC Connection Test
 *
 * Tests connectivity to Push Chain Testnet RPC endpoint.
 * This is a read-only test that doesn't require gas.
 *
 * Usage:
 *   npx ts-node test/integration/1-test-rpc-connection.ts
 */

import { JsonRpcProvider } from 'ethers';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.testnet' });

const RPC_URL = process.env.PUSH_CHAIN_RPC_URL || 'https://rpc.push.org/testnet';
const CHAIN_ID = parseInt(process.env.PUSH_CHAIN_ID || '42101');

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg: string, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

async function main() {
  log('\n═══════════════════════════════════════', CYAN);
  log('  Phase 1: RPC Connection Test', CYAN);
  log('═══════════════════════════════════════\n', CYAN);

  log(`RPC URL: ${RPC_URL}`);
  log(`Expected Chain ID: ${CHAIN_ID}\n`);

  const provider = new JsonRpcProvider(RPC_URL);

  // Test 1: Get network
  log('Test 1: Getting network info...');
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId === CHAIN_ID) {
      log(`  ✓ Chain ID: ${chainId} (Push Chain Testnet)`, GREEN);
    } else {
      log(`  ✗ Unexpected Chain ID: ${chainId}, expected ${CHAIN_ID}`, RED);
    }
  } catch (error) {
    log(`  ✗ Failed to get network: ${(error as Error).message}`, RED);
    process.exit(1);
  }

  // Test 2: Get block number
  log('\nTest 2: Getting latest block...');
  try {
    const blockNumber = await provider.getBlockNumber();
    log(`  ✓ Latest block: ${blockNumber}`, GREEN);
  } catch (error) {
    log(`  ✗ Failed to get block number: ${(error as Error).message}`, RED);
    process.exit(1);
  }

  // Test 3: Get gas price
  log('\nTest 3: Getting gas price...');
  try {
    const feeData = await provider.getFeeData();
    log(`  ✓ Gas price: ${feeData.gasPrice?.toString() || 'N/A'} wei`, GREEN);
    log(`  ✓ Max fee per gas: ${feeData.maxFeePerGas?.toString() || 'N/A'} wei`, GREEN);
  } catch (error) {
    log(`  ✗ Failed to get gas price: ${(error as Error).message}`, RED);
  }

  // Test 4: Get block
  log('\nTest 4: Getting latest block details...');
  try {
    const block = await provider.getBlock('latest');
    if (block) {
      log(`  ✓ Block hash: ${block.hash}`, GREEN);
      log(`  ✓ Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}`, GREEN);
      log(`  ✓ Transactions: ${block.transactions.length}`, GREEN);
    }
  } catch (error) {
    log(`  ✗ Failed to get block: ${(error as Error).message}`, RED);
  }

  // Test 5: Verify contract addresses (if set)
  const contracts = {
    CORE: process.env.V2_CORE_ADDRESS,
    FACTORY: process.env.V2_FACTORY_ADDRESS,
    FEE_VAULT: process.env.V2_FEE_VAULT_ADDRESS,
    WPUSH: process.env.V2_WPUSH_ADDRESS,
  };

  log('\nTest 5: Checking contract deployments...');
  for (const [name, address] of Object.entries(contracts)) {
    if (!address) {
      log(`  - ${name}: Not configured`, RED);
      continue;
    }

    try {
      const code = await provider.getCode(address);
      if (code !== '0x') {
        log(`  ✓ ${name}: ${address.slice(0, 10)}...${address.slice(-8)} (has code)`, GREEN);
      } else {
        log(`  ✗ ${name}: ${address} (no code - not deployed)`, RED);
      }
    } catch (error) {
      log(`  ✗ ${name}: Failed to check - ${(error as Error).message}`, RED);
    }
  }

  log('\n═══════════════════════════════════════', CYAN);
  log('  RPC Connection Test Complete', CYAN);
  log('═══════════════════════════════════════\n', CYAN);
}

main().catch(console.error);
