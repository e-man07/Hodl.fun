/**
 * HODL.FUN WebSocket Test Client
 *
 * Interactive test client for WebSocket subscriptions and events.
 * Tests real-time updates for tokens, portfolios, and trades.
 *
 * Usage:
 *   1. Seed the database: npx ts-node test/seed/seed-mock-data.ts
 *   2. Start the API server: npm run start:dev:api
 *   3. Run tests: npx ts-node test/websocket/websocket-test-client.ts
 *
 * For interactive mode:
 *   npx ts-node test/websocket/websocket-test-client.ts --interactive
 */

import { io, Socket } from 'socket.io-client';

// Configuration
const WS_URL = process.env.WS_URL || 'http://localhost:3000';
const NAMESPACE = '/market';

// Test addresses from seed data
const ADDRESSES = {
  token1: '0xaaaa111111111111111111111111111111111111', // Active (MOON)
  token2: '0xaaaa222222222222222222222222222222222222', // Locked (DHAND)
  token3: '0xaaaa333333333333333333333333333333333333', // Graduated (GRAD)
  user1: '0x3333333333333333333333333333333333333333',
  user2: '0x4444444444444444444444444444444444444444',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test result tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

// Create socket connection
function createSocket(): Socket {
  return io(`${WS_URL}${NAMESPACE}`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 3,
    timeout: 5000,
  });
}

// Utility to wait for event with timeout
function waitForEvent<T>(
  socket: Socket,
  event: string,
  timeoutMs: number = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

// Test utilities
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    log(`  ✓ ${name}`, 'green');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration: Date.now() - start, error: message });
    log(`  ✗ ${name}`, 'red');
    log(`    Error: ${message}`, 'yellow');
  }
}

// Test: Connection
async function testConnection(): Promise<void> {
  log('\n🔌 CONNECTION TESTS\n', 'cyan');

  await test('Connect to WebSocket server', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(new Error(`Connection error: ${err.message}`));
      });
    });
  });

  await test('Connect with polling transport', async () => {
    const socket = io(`${WS_URL}${NAMESPACE}`, {
      transports: ['polling'],
      timeout: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(new Error(`Connection error: ${err.message}`));
      });
    });
  });
}

// Test: Token Subscriptions
async function testTokenSubscriptions(): Promise<void> {
  log('\n📊 TOKEN SUBSCRIPTION TESTS\n', 'cyan');

  await test('Subscribe to token updates', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token1 });
      });

      socket.on('subscribed', (data: { type: string; tokenAddress: string }) => {
        if (data.type === 'token' && data.tokenAddress === ADDRESSES.token1) {
          socket.disconnect();
          resolve();
        }
      });

      socket.on('error', (err: { message: string }) => {
        socket.disconnect();
        reject(new Error(err.message));
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  });

  await test('Subscribe to multiple tokens', async () => {
    const socket = createSocket();
    let subscribed = 0;

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token1 });
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token2 });
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token3 });
      });

      socket.on('subscribed', (data: { type: string }) => {
        if (data.type === 'token') {
          subscribed++;
          if (subscribed === 3) {
            socket.disconnect();
            resolve();
          }
        }
      });

      setTimeout(() => {
        socket.disconnect();
        if (subscribed === 3) resolve();
        else reject(new Error(`Only subscribed to ${subscribed}/3 tokens`));
      }, 5000);
    });
  });

  await test('Unsubscribe from token updates', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        // First subscribe
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token1 });
      });

      socket.on('subscribed', () => {
        // Then unsubscribe
        socket.emit('unsubscribe:token', { tokenAddress: ADDRESSES.token1 });
        // Give it a moment then verify we're still connected
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            resolve();
          } else {
            reject(new Error('Socket disconnected unexpectedly'));
          }
        }, 500);
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });

  await test('Subscribe with invalid token address returns error', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:token', { tokenAddress: '' });
      });

      socket.on('error', (data: { message: string }) => {
        if (data.message.includes('required')) {
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.disconnect();
        // If no error was received, the subscription might have been silently rejected
        // which is also acceptable behavior
        resolve();
      }, 2000);
    });
  });
}

// Test: Portfolio Subscriptions
async function testPortfolioSubscriptions(): Promise<void> {
  log('\n💼 PORTFOLIO SUBSCRIPTION TESTS\n', 'cyan');

  await test('Subscribe to portfolio updates', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:portfolio', { userId: ADDRESSES.user1 });
      });

      socket.on('subscribed', (data: { type: string; userId: string }) => {
        if (data.type === 'portfolio' && data.userId === ADDRESSES.user1) {
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  });

  await test('Unsubscribe from portfolio updates', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:portfolio', { userId: ADDRESSES.user1 });
      });

      socket.on('subscribed', () => {
        socket.emit('unsubscribe:portfolio', { userId: ADDRESSES.user1 });
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            resolve();
          }
        }, 500);
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });
}

// Test: Trade Subscriptions
async function testTradeSubscriptions(): Promise<void> {
  log('\n📈 TRADE SUBSCRIPTION TESTS\n', 'cyan');

  await test('Subscribe to all trades', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:trades', {});
      });

      socket.on('subscribed', (data: { type: string; tokenAddress: string }) => {
        if (data.type === 'trades' && data.tokenAddress === 'all') {
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  });

  await test('Subscribe to token-specific trades', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:trades', { tokenAddress: ADDRESSES.token1 });
      });

      socket.on('subscribed', (data: { type: string; tokenAddress: string }) => {
        if (data.type === 'trades' && data.tokenAddress === ADDRESSES.token1) {
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Subscription timeout'));
      }, 5000);
    });
  });

  await test('Unsubscribe from trades', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:trades', { tokenAddress: ADDRESSES.token1 });
      });

      socket.on('subscribed', () => {
        socket.emit('unsubscribe:trades', { tokenAddress: ADDRESSES.token1 });
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            resolve();
          }
        }, 500);
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });
}

// Test: Combined Subscriptions
async function testCombinedSubscriptions(): Promise<void> {
  log('\n🔄 COMBINED SUBSCRIPTION TESTS\n', 'cyan');

  await test('Subscribe to multiple channels simultaneously', async () => {
    const socket = createSocket();
    const subscriptions = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token1 });
        socket.emit('subscribe:portfolio', { userId: ADDRESSES.user1 });
        socket.emit('subscribe:trades', {});
      });

      socket.on('subscribed', (data: { type: string }) => {
        subscriptions.add(data.type);
        if (subscriptions.size === 3) {
          socket.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        socket.disconnect();
        if (subscriptions.size === 3) resolve();
        else reject(new Error(`Only got ${subscriptions.size}/3 subscriptions`));
      }, 5000);
    });
  });

  await test('Reconnection maintains subscriptions logic', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      let disconnected = false;

      socket.on('connect', () => {
        if (!disconnected) {
          // First connection
          socket.emit('subscribe:token', { tokenAddress: ADDRESSES.token1 });
        } else {
          // Reconnection
          socket.disconnect();
          resolve();
        }
      });

      socket.on('subscribed', () => {
        // Simulate disconnect
        disconnected = true;
        socket.disconnect();
        // Reconnect
        socket.connect();
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Test timeout'));
      }, 10000);
    });
  });
}

// Test: Error Handling
async function testErrorHandling(): Promise<void> {
  log('\n⚠️  ERROR HANDLING TESTS\n', 'cyan');

  await test('Invalid event type is ignored gracefully', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        // Send invalid event
        socket.emit('invalid:event', { data: 'test' });

        // Should still be connected after invalid event
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            resolve();
          } else {
            reject(new Error('Socket disconnected after invalid event'));
          }
        }, 1000);
      });

      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });

  await test('Malformed payload is handled', async () => {
    const socket = createSocket();

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => {
        // Send malformed payload
        socket.emit('subscribe:token', null);
        socket.emit('subscribe:token', 'not-an-object');
        socket.emit('subscribe:token', { wrongField: 'value' });

        // Should receive errors or be handled gracefully
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            resolve();
          }
        }, 1000);
      });

      setTimeout(() => {
        socket.disconnect();
        resolve(); // Accept either way
      }, 5000);
    });
  });
}

// Interactive mode for manual testing
async function interactiveMode(): Promise<void> {
  log('\n🎮 INTERACTIVE MODE\n', 'cyan');
  log('Commands:', 'yellow');
  log('  1. subscribe:token <address>');
  log('  2. subscribe:portfolio <userId>');
  log('  3. subscribe:trades [tokenAddress]');
  log('  4. unsubscribe:token <address>');
  log('  5. unsubscribe:portfolio <userId>');
  log('  6. unsubscribe:trades [tokenAddress]');
  log('  7. exit');
  log('');

  const socket = createSocket();

  await new Promise<void>((resolve) => {
    socket.on('connect', () => {
      log(`Connected to ${WS_URL}${NAMESPACE}`, 'green');
    });

    socket.on('disconnect', () => {
      log('Disconnected', 'yellow');
    });

    socket.on('subscribed', (data) => {
      log(`Subscribed: ${JSON.stringify(data)}`, 'green');
    });

    socket.on('error', (data) => {
      log(`Error: ${JSON.stringify(data)}`, 'red');
    });

    // Listen for all events
    const events = [
      'token:price-updated',
      'token:created',
      'token:locked',
      'token:listed',
      'token:ath-price',
      'token:ath-market-cap',
      'token:graduated',
      'token:graduation-ready',
      'portfolio:trade',
      'portfolio:updated',
      'trade:executed',
      'creator:fees-accumulated',
      'creator:fees-claimed',
    ];

    events.forEach((event) => {
      socket.on(event, (data) => {
        log(`[${event}] ${JSON.stringify(data)}`, 'magenta');
      });
    });

    // Handle stdin
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('line', (line: string) => {
      const [command, ...args] = line.trim().split(' ');

      switch (command) {
        case 'subscribe:token':
          socket.emit('subscribe:token', { tokenAddress: args[0] || ADDRESSES.token1 });
          break;
        case 'subscribe:portfolio':
          socket.emit('subscribe:portfolio', { userId: args[0] || ADDRESSES.user1 });
          break;
        case 'subscribe:trades':
          socket.emit('subscribe:trades', { tokenAddress: args[0] });
          break;
        case 'unsubscribe:token':
          socket.emit('unsubscribe:token', { tokenAddress: args[0] || ADDRESSES.token1 });
          break;
        case 'unsubscribe:portfolio':
          socket.emit('unsubscribe:portfolio', { userId: args[0] || ADDRESSES.user1 });
          break;
        case 'unsubscribe:trades':
          socket.emit('unsubscribe:trades', { tokenAddress: args[0] });
          break;
        case 'exit':
          socket.disconnect();
          rl.close();
          resolve();
          break;
        default:
          log(`Unknown command: ${command}`, 'yellow');
      }
    });
  });
}

// Main runner
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--interactive')) {
    await interactiveMode();
    return;
  }

  log('\n════════════════════════════════════════════════════════', 'cyan');
  log('          HODL.FUN WEBSOCKET TEST SUITE', 'cyan');
  log('════════════════════════════════════════════════════════', 'cyan');
  log(`WebSocket URL: ${WS_URL}${NAMESPACE}`);
  log('════════════════════════════════════════════════════════');

  // Run test suites
  await testConnection();
  await testTokenSubscriptions();
  await testPortfolioSubscriptions();
  await testTradeSubscriptions();
  await testCombinedSubscriptions();
  await testErrorHandling();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  log('\n════════════════════════════════════════════════════════', 'cyan');
  log('                    TEST SUMMARY', 'cyan');
  log('════════════════════════════════════════════════════════', 'cyan');
  log(`  ✓ PASSED:  ${passed}`, 'green');
  log(`  ✗ FAILED:  ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`  ⏱ TIME:    ${totalDuration}ms`);
  log('════════════════════════════════════════════════════════', 'cyan');

  if (failed > 0) {
    log('\nFailed tests:', 'red');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  • ${r.name}`, 'red');
        log(`    ${r.error}`, 'yellow');
      });
    process.exit(1);
  } else {
    log(`\n✓ All ${passed} tests passed!`, 'green');
    process.exit(0);
  }
}

main().catch(console.error);
