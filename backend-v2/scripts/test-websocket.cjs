const ethers = require('ethers');

async function testWebSocket() {
  console.log('Testing Push Chain WebSocket connection...');
  console.log('Endpoint: wss://evm.rpc-testnet-donut-node1.push.org/');
  console.log('');

  try {
    const ws = new ethers.WebSocketProvider('wss://evm.rpc-testnet-donut-node1.push.org/');

    // Wait for connection
    await ws.ready;
    console.log('✅ WebSocket connected!');

    // Get current block
    const blockNumber = await ws.getBlockNumber();
    console.log('✅ Current block:', blockNumber);

    // Test getLogs capability
    const logs = await ws.getLogs({
      address: '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
      fromBlock: blockNumber - 100,
      toBlock: blockNumber
    });
    console.log('✅ getLogs works. Found', logs.length, 'logs in last 100 blocks');

    // Subscribe to new blocks
    console.log('');
    console.log('Listening for new blocks (15 seconds)...');
    let blocksReceived = 0;

    ws.on('block', (block) => {
      blocksReceived++;
      console.log('  📦 New block:', block);
    });

    // Wait 15 seconds for blocks
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('');
    console.log('✅ Received', blocksReceived, 'blocks in 15 seconds');

    // Cleanup
    await ws.destroy();
    console.log('');
    console.log('✅ WebSocket test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testWebSocket();
