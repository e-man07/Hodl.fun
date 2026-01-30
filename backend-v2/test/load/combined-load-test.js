import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiRequests = new Counter('api_requests');
const wsMessages = new Counter('ws_messages');
const apiLatency = new Trend('api_latency');
const wsLatency = new Trend('ws_latency');

// Test configuration - simulates realistic traffic patterns
export const options = {
  scenarios: {
    // Scenario 1: Browser users (API + WebSocket)
    browser_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'browserUser',
    },
    // Scenario 2: API clients (high-frequency polling)
    api_clients: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'apiClient',
    },
    // Scenario 3: WebSocket only (real-time subscribers)
    ws_subscribers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '4m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'wsSubscriber',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.02'],
    api_latency: ['p(95)<400'],
    ws_latency: ['p(95)<200'],
  },
};

// Environment configuration
const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3000';
const WS_URL = __ENV.K6_WS_URL || 'ws://localhost:3001';
const API_PREFIX = '/api/v1';

// Test data
const TEST_TOKENS = [
  __ENV.K6_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  '0x0000000000000000000000000000000000000003',
];

// Helper: Random element from array
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: Random hex address
function randomAddress() {
  const hex = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) {
    addr += hex[Math.floor(Math.random() * 16)];
  }
  return addr;
}

// Scenario 1: Browser User - Full experience with API and WebSocket
export function browserUser() {
  const tokenAddress = randomElement(TEST_TOKENS);
  const walletAddress = randomAddress();

  // Step 1: Load token list
  group('Browse Tokens', function () {
    const res = http.get(`${BASE_URL}${API_PREFIX}/tokens?page=1&limit=20`);
    apiRequests.add(1);
    apiLatency.add(res.timings.duration);

    check(res, {
      'token list loaded': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(1 + Math.random());

  // Step 2: View token detail
  group('View Token', function () {
    const res = http.get(`${BASE_URL}${API_PREFIX}/tokens/${tokenAddress}`);
    apiRequests.add(1);
    apiLatency.add(res.timings.duration);

    check(res, {
      'token detail loaded': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);

  // Step 3: Connect to WebSocket and subscribe
  group('Real-time Updates', function () {
    const wsUrl = `${WS_URL}/events`;

    ws.connect(wsUrl, {}, function (socket) {
      socket.on('open', function () {
        // Subscribe to token events
        socket.send(
          JSON.stringify({
            event: 'subscribe:token',
            data: { tokenAddress },
          })
        );

        // Subscribe to wallet events
        socket.send(
          JSON.stringify({
            event: 'subscribe:wallet',
            data: { walletAddress },
          })
        );
      });

      socket.on('message', function (msg) {
        wsMessages.add(1);
        try {
          const data = JSON.parse(msg);
          wsLatency.add(Date.now() - (data.timestamp || Date.now()));
        } catch (e) {
          // Ignore non-JSON messages
        }
      });

      // Simulate user viewing page for 30-60 seconds
      const viewDuration = 30000 + Math.random() * 30000;

      // Meanwhile, make periodic API requests (like polling for updated data)
      const pollInterval = setInterval(function () {
        const pollRes = http.get(`${BASE_URL}${API_PREFIX}/tokens/${tokenAddress}/trades?page=1&limit=10`);
        apiRequests.add(1);

        check(pollRes, {
          'poll successful': (r) => r.status === 200 || r.status === 404,
        });
      }, 5000);

      socket.setTimeout(function () {
        clearInterval(pollInterval);

        // Unsubscribe
        socket.send(
          JSON.stringify({
            event: 'unsubscribe:token',
            data: { tokenAddress },
          })
        );

        socket.close();
      }, viewDuration);
    });
  });

  sleep(2 + Math.random() * 3);
}

// Scenario 2: API Client - High-frequency API polling
export function apiClient() {
  const endpoints = [
    '/tokens?page=1&limit=20',
    '/tokens/trending?limit=10',
    '/tokens/new?limit=10',
    `/tokens/${randomElement(TEST_TOKENS)}`,
    `/users/${randomAddress()}/portfolio`,
    '/health',
  ];

  const endpoint = randomElement(endpoints);
  const res = http.get(`${BASE_URL}${API_PREFIX}${endpoint}`, {
    timeout: '5s',
  });

  apiRequests.add(1);
  apiLatency.add(res.timings.duration);

  const success = check(res, {
    'API response valid': (r) => r.status === 200 || r.status === 404,
    'API response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
}

// Scenario 3: WebSocket Subscriber - Long-lived connection
export function wsSubscriber() {
  const tokenAddress = randomElement(TEST_TOKENS);
  const wsUrl = `${WS_URL}/trades`;

  const res = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', function () {
      // Subscribe to recent trades
      socket.send(
        JSON.stringify({
          event: 'subscribe:recent',
          data: { tokenAddress },
        })
      );
    });

    socket.on('message', function (msg) {
      wsMessages.add(1);
      try {
        JSON.parse(msg);
      } catch (e) {
        // Ignore parse errors
      }
    });

    // Keep connection alive for 2-5 minutes
    const connectionDuration = 120000 + Math.random() * 180000;

    // Heartbeat every 25 seconds
    const heartbeat = setInterval(function () {
      socket.send(JSON.stringify({ event: 'ping' }));
    }, 25000);

    socket.setTimeout(function () {
      clearInterval(heartbeat);

      socket.send(
        JSON.stringify({
          event: 'unsubscribe:recent',
          data: { tokenAddress },
        })
      );

      socket.close();
    }, connectionDuration);
  });

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });

  errorRate.add(!res || res.status !== 101);
}

export function teardown() {
  console.log('Combined load test completed');
  console.log(`Total API requests: ${apiRequests.count || 'N/A'}`);
  console.log(`Total WS messages: ${wsMessages.count || 'N/A'}`);
}
