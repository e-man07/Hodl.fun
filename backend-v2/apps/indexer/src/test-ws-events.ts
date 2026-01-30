import { ethers } from 'ethers';
import { CORE_ABI, FACTORY_ABI } from './blockchain/abis';

const CORE_ADDRESS = '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03';
const FACTORY_ADDRESS = '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8';

async function testEventSubscription() {
  console.log('Testing Push Chain Event Subscription...');
  console.log('WebSocket: wss://evm.rpc-testnet-donut-node1.push.org/');
  console.log('Core:', CORE_ADDRESS);
  console.log('Factory:', FACTORY_ADDRESS);
  console.log('');

  try {
    const ws = new ethers.WebSocketProvider('wss://evm.rpc-testnet-donut-node1.push.org/');
    await ws.ready;
    console.log('✅ WebSocket connected!');

    const blockNumber = await ws.getBlockNumber();
    console.log('✅ Current block:', blockNumber);

    // Create contract instances
    const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, ws);
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, ws);

    console.log('');
    console.log('Setting up event listeners...');

    // Listen for Core events
    coreContract.on('CreateCurve', (creator: string, curve: string, token: string, tokenUri: string, name: string, symbol: string, event: ethers.EventLog) => {
      console.log('');
      console.log('🎉 CreateCurve event detected!');
      console.log('  Block:', event.blockNumber);
      console.log('  Creator:', creator);
      console.log('  Token:', token);
      console.log('  Curve:', curve);
      console.log('  Name:', name);
      console.log('  Symbol:', symbol);
    });

    coreContract.on('Buy', (token: string, to: string, amountIn: bigint, amountOut: bigint, price: bigint, timestamp: bigint, event: ethers.EventLog) => {
      console.log('');
      console.log('💰 Buy event detected!');
      console.log('  Block:', event.blockNumber);
      console.log('  Token:', token);
      console.log('  Buyer:', to);
      console.log('  AmountIn:', ethers.formatEther(amountIn), 'PUSH');
      console.log('  AmountOut:', ethers.formatEther(amountOut), 'tokens');
    });

    coreContract.on('Sell', (token: string, from: string, to: string, amountIn: bigint, amountOut: bigint, price: bigint, timestamp: bigint, event: ethers.EventLog) => {
      console.log('');
      console.log('💸 Sell event detected!');
      console.log('  Block:', event.blockNumber);
      console.log('  Token:', token);
      console.log('  Seller:', from);
      console.log('  AmountIn:', ethers.formatEther(amountIn), 'tokens');
      console.log('  AmountOut:', ethers.formatEther(amountOut), 'PUSH');
    });

    // Listen for Factory events
    factoryContract.on('Create', (creator: string, curve: string, token: string, tokenUri: string, name: string, symbol: string, virtualNative: bigint, virtualToken: bigint, event: ethers.EventLog) => {
      console.log('');
      console.log('🏭 Factory Create event detected!');
      console.log('  Block:', event.blockNumber);
      console.log('  Creator:', creator);
      console.log('  Token:', token);
      console.log('  Name:', name, '(', symbol, ')');
    });

    // Also listen for new blocks to show activity
    let blockCount = 0;
    ws.on('block', (block: number) => {
      blockCount++;
      if (blockCount % 10 === 0) {
        console.log(`  ... processed ${blockCount} blocks (current: ${block})`);
      }
    });

    console.log('✅ Event listeners set up!');
    console.log('');
    console.log('='.repeat(60));
    console.log('Waiting for events... (Press Ctrl+C to stop)');
    console.log('Create a token or make a trade on testnet to see events!');
    console.log('='.repeat(60));
    console.log('');

    // Keep running for 5 minutes
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

    await ws.destroy();
    console.log('Test complete!');
  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

testEventSubscription();
