import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const wsConnectErrors = new Rate('ws_connect_errors');
const wsMessageErrors = new Rate('ws_message_errors');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsConnectTime = new Trend('ws_connect_time');
const wsSubscribeTime = new Trend('ws_subscribe_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },    // Ramp up to 50 connections
    { duration: '2m', target: 100 },    // Ramp up to 100 connections
    { duration: '3m', target: 100 },    // Stay at 100 connections
    { duration: '30s', target: 200 },   // Spike to 200 connections
    { duration: '1m', target: 200 },    // Stay at 200 connections
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    ws_connect_errors: ['rate<0.05'],
    ws_message_errors: ['rate<0.01'],
    ws_connect_time: ['p(95)<1000'],
  },
};

// Environment configuration
const WS_URL = __ENV.K6_WS_URL || 'ws://localhost:3001';
const EVENTS_NAMESPACE = '/events';
const TRADES_NAMESPACE = '/trades';

// Test data
const TEST_TOKEN_ADDRESS = __ENV.K6_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000001';
const TEST_WALLET_ADDRESS = __ENV.K6_WALLET_ADDRESS || '0x0000000000000000000000000000000000000002';

// Generate a random wallet address for variety
function randomWallet() {
  const hex = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(Math.random() * 16)];
  }
  return addr;
}

export default function () {
  const vuId = __VU;
  const iteration = __ITER;

  // Decide which namespace to connect to (mix of events and trades)
  const useTradesNamespace = Math.random() < 0.3;
  const namespace = useTradesNamespace ? TRADES_NAMESPACE : EVENTS_NAMESPACE;
  const url = `${WS_URL}${namespace}`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    const connectDuration = Date.now() - startTime;
    wsConnectTime.add(connectDuration);

    socket.on('open', function () {
      check(connectDuration, {
        'WebSocket connected within 1s': (d) => d < 1000,
      });

      // Subscribe to events based on namespace
      if (useTradesNamespace) {
        // Subscribe to recent trades
        const subscribeStart = Date.now();
        socket.send(
          JSON.stringify({
            event: 'subscribe:recent',
            data: { tokenAddress: TEST_TOKEN_ADDRESS },
          })
        );

        // Wait for subscription confirmation
        socket.setTimeout(function () {
          wsSubscribeTime.add(Date.now() - subscribeStart);
        }, 100);
      } else {
        // Subscribe to token events
        socket.send(
          JSON.stringify({
            event: 'subscribe:token',
            data: { tokenAddress: TEST_TOKEN_ADDRESS },
          })
        );

        // Also subscribe to wallet events (random wallet for variety)
        socket.send(
          JSON.stringify({
            event: 'subscribe:wallet',
            data: { walletAddress: randomWallet() },
          })
        );
      }
    });

    socket.on('message', function (msg) {
      wsMessagesReceived.add(1);

      try {
        const data = JSON.parse(msg);
        const success = check(data, {
          'message has valid structure': (d) => d !== null && typeof d === 'object',
        });
        wsMessageErrors.add(!success);
      } catch (e) {
        // Some messages may not be JSON (heartbeats, etc.)
        // This is not necessarily an error
      }
    });

    socket.on('error', function (e) {
      wsConnectErrors.add(1);
      console.error(`WebSocket error for VU ${vuId}: ${e}`);
    });

    socket.on('close', function () {
      // Normal close, not an error
    });

    // Keep connection alive for a random duration (30-90 seconds)
    const connectionDuration = Math.floor(Math.random() * 60 + 30) * 1000;

    // Periodically send heartbeat/ping
    const heartbeatInterval = setInterval(function () {
      if (socket.readyState === 1) {
        // OPEN state
        socket.send(JSON.stringify({ event: 'ping' }));
      }
    }, 25000);

    socket.setTimeout(function () {
      clearInterval(heartbeatInterval);

      // Unsubscribe before closing
      if (useTradesNamespace) {
        socket.send(
          JSON.stringify({
            event: 'unsubscribe:recent',
            data: { tokenAddress: TEST_TOKEN_ADDRESS },
          })
        );
      } else {
        socket.send(
          JSON.stringify({
            event: 'unsubscribe:token',
            data: { tokenAddress: TEST_TOKEN_ADDRESS },
          })
        );
      }

      // Small delay before closing
      socket.setTimeout(function () {
        socket.close();
      }, 500);
    }, connectionDuration);
  });

  check(res, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });

  wsConnectErrors.add(!res || res.status !== 101);

  // Small sleep between iterations
  sleep(1);
}

export function teardown() {
  console.log('WebSocket load test completed');
}
