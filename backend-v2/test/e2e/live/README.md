# Live End-to-End Testing Guide

This directory contains live E2E tests that interact with real smart contracts on Push Chain testnet and verify all backend services work correctly together.

## Prerequisites

### 1. Running Services

All four services must be running:

```bash
# Terminal 1 - API
pnpm start:dev:api

# Terminal 2 - WebSocket
pnpm start:dev:websocket

# Terminal 3 - Indexer
pnpm start:dev:indexer

# Terminal 4 - Worker
pnpm start:dev:worker
```

Or use Docker:

```bash
docker-compose -f docker/docker-compose.dev.yml up
```

### 2. Test Wallet

You need a wallet with PUSH tokens on Push Chain testnet:

1. Get testnet PUSH from the faucet: https://faucet.push.org/
2. Transfer at least 1-5 PUSH to your test wallet
3. Set the private key as an environment variable

**Expected Wallet Address:** `0x99F909737751215151572E90b46A2cC6f03A6fb0`

### 3. Environment Variables

Create a `.env.test` file or export the following:

```bash
# Required
TEST_WALLET_PRIVATE_KEY=0x...your_private_key_here...

# Optional - Override service URLs
API_URL=http://localhost:3000
WS_URL=http://localhost:3001
INDEXER_URL=http://localhost:3002
WORKER_URL=http://localhost:3003

# Optional - Override RPC
RPC_URL=https://evm.rpc-testnet-donut-node1.push.org/

# Optional - Enable verbose logging
TEST_LOG_ENABLED=true
TEST_LOG_LEVEL=debug
```

## Running the Tests

### Run All Live Tests

```bash
TEST_WALLET_PRIVATE_KEY=0x... pnpm test:e2e:live
```

### Run Specific Test Phase

```bash
# Run only authentication tests
TEST_WALLET_PRIVATE_KEY=0x... pnpm test:e2e:live -- --testNamePattern="Phase 2"

# Run only token creation tests
TEST_WALLET_PRIVATE_KEY=0x... pnpm test:e2e:live -- --testNamePattern="Phase 3"
```

### Run with Verbose Output

```bash
TEST_WALLET_PRIVATE_KEY=0x... TEST_LOG_ENABLED=true pnpm test:e2e:live
```

## Test Phases

### Phase 1: Pre-Flight Checks
- Verifies all services are healthy
- Checks wallet balance
- Establishes WebSocket connection

### Phase 2: Authentication Flow
- Tests nonce request
- Tests signature verification
- Tests JWT token refresh
- Tests protected endpoint access

### Phase 3: Token Creation & Indexing
- Creates a new token via smart contract
- Verifies indexer picks up the event
- Checks token appears in API
- Verifies holder is created

### Phase 4: Buy Trade Testing
- Executes buy trades
- Verifies trade indexed correctly
- Checks holder balance updated
- Verifies price updated

### Phase 5: Sell Trade Testing
- Approves tokens for Core contract
- Executes sell trades
- Verifies trade indexed
- Checks balance decreased

### Phase 6: API Endpoint Testing
- Tests all token endpoints
- Tests all user endpoints
- Tests pagination
- Tests filtering

### Phase 7: WebSocket Real-Time Testing
- Tests WebSocket connections
- Verifies trade events broadcast
- Verifies price update events

### Phase 8: Worker Service Testing
- Waits for candle aggregation
- Checks price history available

### Phase 9: Error Handling
- Tests 404 for non-existent resources
- Tests 401 for invalid auth
- Tests validation errors

### Phase 10: Cross-Service Integration
- Verifies complete data flow
- Checks on-chain/API consistency

## Contract Addresses (Push Chain Testnet)

| Contract | Address |
|----------|---------|
| Core | `0x592F8f0abbB9a3d3c425980Ac0263363C8405b03` |
| Factory | `0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8` |
| FeeVault | `0xbe2fd9b720d1d7fac7208523376d2a3332019928` |
| WPUSH | `0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7` |

## Troubleshooting

### "Services not healthy"

Ensure all services are running and accessible on their default ports:
- API: 3000
- WebSocket: 3001
- Indexer: 3002
- Worker: 3003

### "Insufficient balance"

Get more testnet PUSH from the faucet or transfer from another wallet.

### "Token not indexed"

The indexer runs every 5 seconds. Wait and retry, or check indexer logs for errors.

### "Transaction failed"

Check:
- Sufficient gas (PUSH for fees)
- Correct contract addresses
- Network connectivity

### "WebSocket not connected"

Ensure the WebSocket service is running and CORS is configured correctly.

## Files Structure

```
test/e2e/live/
├── config.ts           # Configuration and constants
├── wallet.ts           # Wallet management
├── contracts.ts        # Smart contract interactions
├── api-client.ts       # HTTP client for API
├── websocket-client.ts # WebSocket event handling
├── index.ts            # Central exports
├── setup.ts            # Jest setup
├── jest.config.js      # Jest configuration
├── live-test.e2e-spec.ts # Main test file
└── README.md           # This file
```

## Cost Estimate

Running the full test suite costs approximately:
- Token creation: ~0.12 PUSH (deploy fee + initial buy)
- Buy trades: ~0.35 PUSH (3 trades)
- Sell trades: ~0 PUSH (only gas)
- **Total: ~0.5-1 PUSH per full test run**

## Notes

- Tests are designed to be idempotent - each run creates new tokens
- Token addresses from previous runs remain in the database
- WebSocket events may not arrive if the service isn't fully implemented
- Candle aggregation requires waiting for the worker job (runs every minute)
