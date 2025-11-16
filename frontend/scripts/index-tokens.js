/**
 * Simple token indexer script
 * Queries TokenCreated events and saves to JSON file
 * Run this periodically (e.g., every 5 minutes) to keep token list updated
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://evm.donut.rpc.push.org/';
const TOKEN_FACTORY_ADDRESS = '0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0';
const MARKETPLACE_ADDRESS = '0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f';
const OUTPUT_FILE = path.join(__dirname, '../public/token-addresses.json');

// Minimal ABI for events
const TOKEN_FACTORY_ABI = [
  {
    "type": "event",
    "name": "TokenCreated",
    "inputs": [
      { "name": "tokenAddress", "type": "address", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "name", "type": "string", "indexed": false },
      { "name": "symbol", "type": "string", "indexed": false },
      { "name": "totalSupply", "type": "uint256", "indexed": false },
      { "name": "metadataURI", "type": "string", "indexed": false }
    ]
  }
];

const MARKETPLACE_ABI = [
  {
    "type": "event",
    "name": "TokenListed",
    "inputs": [
      { "name": "tokenAddress", "type": "address", "indexed": true },
      { "name": "creator", "type": "address", "indexed": true },
      { "name": "metadataURI", "type": "string", "indexed": false },
      { "name": "totalSupply", "type": "uint256", "indexed": false },
      { "name": "reserveRatio", "type": "uint256", "indexed": false }
    ]
  }
];

async function indexTokens() {
  console.log('🚀 Starting token indexing...');
  console.log('RPC:', RPC_URL);
  console.log('Factory:', TOKEN_FACTORY_ADDRESS);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const factoryInterface = new ethers.Interface(TOKEN_FACTORY_ABI);
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);
  const tokenCreatedEvent = factoryInterface.getEvent('TokenCreated');
  const tokenListedEvent = marketplaceInterface.getEvent('TokenListed');
  
  // Get latest block
  const latestBlock = await provider.getBlockNumber();
  console.log(`📊 Latest block: ${latestBlock}`);
  
  // RPC limit is 10,000 blocks, so we'll query in chunks
  const BLOCK_CHUNK_SIZE = 10000;
  let currentBlock = 0;
  const allTokenAddresses = new Set();
  let totalEvents = 0;
  const failedChunks = []; // Track failed chunks for retry
  
  // Force full rescan - ignore cache to get all tokens
  // Set FORCE_FULL_RESCAN=true or use --full flag to force full rescan
  const FORCE_FULL_RESCAN = process.env.FORCE_FULL_RESCAN === 'true' || process.argv.includes('--full');
  
  // If forcing full rescan, delete cache file first
  if (FORCE_FULL_RESCAN && fs.existsSync(OUTPUT_FILE)) {
    console.log('🔄 FORCE FULL RESCAN: Deleting cache file to start fresh...');
    fs.unlinkSync(OUTPUT_FILE);
  }
  
  // If we have a cached file and NOT forcing full rescan, try to get the last indexed block
  let lastIndexedBlock = 0;
  if (!FORCE_FULL_RESCAN) {
    try {
      const cached = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
      if (cached.lastIndexedBlock) {
        lastIndexedBlock = cached.lastIndexedBlock;
        console.log(`📝 Found previous index, last indexed block: ${lastIndexedBlock}`);
        // Start from last indexed block (only query new blocks)
        currentBlock = lastIndexedBlock + 1;
        
        // Also load existing tokens
        if (cached.tokens && Array.isArray(cached.tokens)) {
          cached.tokens.forEach(addr => allTokenAddresses.add(addr.toLowerCase()));
          console.log(`📋 Loaded ${allTokenAddresses.size} existing tokens from cache`);
        }
      }
    } catch (err) {
      console.log('📝 No previous index found, starting from block 0');
    }
  } else {
    console.log('🔄 FORCE FULL RESCAN: Starting from block 0 (ignoring cache)');
    currentBlock = 0; // Ensure we start from 0
  }
  
  // Query events in chunks
  const startTime = Date.now();
  let chunkCount = 0;
  
  console.log(`\n📋 STEP 1: Querying ALL TokenCreated events from factory...`);
  console.log(`   Starting from block ${currentBlock} to ${latestBlock}`);
  console.log(`   This will query all blocks to ensure we get all tokens.\n`);
  
  // Query TokenCreated events from factory - COMPLETE ALL CHUNKS FIRST
  while (currentBlock <= latestBlock) {
    const toBlock = Math.min(currentBlock + BLOCK_CHUNK_SIZE - 1, latestBlock);
    chunkCount++;
    
    try {
      console.log(`\n🔍 Querying chunk ${chunkCount}: blocks ${currentBlock} to ${toBlock}...`);
      
      const events = await provider.getLogs({
        address: TOKEN_FACTORY_ADDRESS,
        topics: [tokenCreatedEvent.topicHash],
        fromBlock: currentBlock,
        toBlock: toBlock
      });
      
      console.log(`✅ Found ${events.length} TokenCreated events in this chunk`);
      
      // Decode events and extract token addresses
      for (const event of events) {
        try {
          const decoded = factoryInterface.decodeEventLog('TokenCreated', event.data, event.topics);
          allTokenAddresses.add(decoded.tokenAddress.toLowerCase());
          totalEvents++;
        } catch (err) {
          console.warn('⚠️ Failed to decode event:', err.message);
        }
      }
      
      currentBlock = toBlock + 1;
      
      // Small delay to avoid rate limiting
      if (currentBlock <= latestBlock) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } catch (err) {
      console.error(`❌ Error querying chunk ${currentBlock}-${toBlock}:`, err.message);
      // Store failed chunk for retry
      failedChunks.push({ from: currentBlock, to: toBlock });
      // Continue with next chunk
      currentBlock = toBlock + 1;
    }
  }
  
  console.log(`\n✅ Completed all TokenCreated event queries`);
  console.log(`   Found ${totalEvents} TokenCreated events`);
  console.log(`   Unique tokens so far: ${allTokenAddresses.size}`);
  
  // Retry failed chunks with smaller block ranges
  if (failedChunks.length > 0) {
    console.log(`\n🔄 STEP 2: Retrying ${failedChunks.length} failed chunks with smaller ranges...`);
    for (const chunk of failedChunks) {
      const chunkSize = Math.min(1000, chunk.to - chunk.from + 1); // Use 1000 block chunks for retries
      let retryBlock = chunk.from;
      
      while (retryBlock <= chunk.to) {
        const retryToBlock = Math.min(retryBlock + chunkSize - 1, chunk.to);
        
        try {
          console.log(`  🔄 Retrying blocks ${retryBlock} to ${retryToBlock}...`);
          const events = await provider.getLogs({
            address: TOKEN_FACTORY_ADDRESS,
            topics: [tokenCreatedEvent.topicHash],
            fromBlock: retryBlock,
            toBlock: retryToBlock
          });
          
          if (events.length > 0) {
            console.log(`  ✅ Found ${events.length} events in retry`);
            for (const event of events) {
              try {
                const decoded = factoryInterface.decodeEventLog('TokenCreated', event.data, event.topics);
                allTokenAddresses.add(decoded.tokenAddress.toLowerCase());
                totalEvents++;
              } catch (err) {
                console.warn('  ⚠️ Failed to decode event:', err.message);
              }
            }
          }
          
          retryBlock = retryToBlock + 1;
          await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay for retries
        } catch (retryErr) {
          console.error(`  ❌ Retry failed for ${retryBlock}-${retryToBlock}:`, retryErr.message);
          retryBlock = retryToBlock + 1;
        }
      }
    }
    console.log(`✅ Completed retries. Total TokenCreated events: ${totalEvents}`);
    
    // Save progress after retries
    const elapsedSoFar = ((Date.now() - startTime) / 1000).toFixed(2);
    const tempOutput = {
      tokens: Array.from(allTokenAddresses),
      totalTokens: allTokenAddresses.size,
      lastIndexedBlock: latestBlock,
      indexedAt: new Date().toISOString(),
      indexedInSeconds: elapsedSoFar,
      status: 'in_progress',
      tokenCreatedEvents: totalEvents,
      note: 'Partial index - marketplace events still being queried'
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tempOutput, null, 2));
    console.log(`\n💾 Saved progress: ${allTokenAddresses.size} tokens found so far`);
  }
  
  // Also query TokenListed events from marketplace as backup - ONLY AFTER COMPLETING ALL FACTORY QUERIES
  console.log(`\n📋 STEP 3: Querying TokenListed events from marketplace as backup...`);
  console.log(`   This ensures we catch any tokens that might have been missed.\n`);
  currentBlock = 0;
  let marketplaceEvents = 0;
  
  while (currentBlock <= latestBlock) {
    const toBlock = Math.min(currentBlock + BLOCK_CHUNK_SIZE - 1, latestBlock);
    
    try {
      const events = await provider.getLogs({
        address: MARKETPLACE_ADDRESS,
        topics: [tokenListedEvent.topicHash],
        fromBlock: currentBlock,
        toBlock: toBlock
      });
      
      if (events.length > 0) {
        console.log(`  📋 Found ${events.length} TokenListed events in blocks ${currentBlock}-${toBlock}`);
        for (const event of events) {
          try {
            const decoded = marketplaceInterface.decodeEventLog('TokenListed', event.data, event.topics);
            allTokenAddresses.add(decoded.tokenAddress.toLowerCase());
            marketplaceEvents++;
          } catch (err) {
            // Ignore decode errors
          }
        }
      }
      
      currentBlock = toBlock + 1;
      if (currentBlock <= latestBlock) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err) {
      // Continue on error
      currentBlock = toBlock + 1;
    }
  }
  
  if (marketplaceEvents > 0) {
    console.log(`✅ Added ${marketplaceEvents} additional tokens from TokenListed events`);
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Indexing complete!`);
  console.log(`📊 Processed ${totalEvents} TokenCreated events`);
  console.log(`📊 Processed ${marketplaceEvents} TokenListed events`);
  console.log(`🎯 Found ${allTokenAddresses.size} unique tokens`);
  console.log(`⏱️  Time taken: ${elapsed}s`);
  if (failedChunks.length > 0) {
    console.log(`⚠️  Note: ${failedChunks.length} chunks had errors but were retried`);
  }
  
  // Save to JSON file
  const output = {
    tokens: Array.from(allTokenAddresses),
    totalTokens: allTokenAddresses.size,
    lastIndexedBlock: latestBlock,
    indexedAt: new Date().toISOString(),
    indexedInSeconds: elapsed
  };
  
  // Ensure public directory exists
  const publicDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
  console.log(`\n🎉 Done! Token list is ready for the frontend.`);
}

// Run the indexer
indexTokens().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

