import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const wsConnections = new Counter('ws_connections');
const wsMessages = new Counter('ws_messages');
const tokenListLatency = new Trend('token_list_latency');
const tokenDetailLatency = new Trend('token_detail_latency');
const tradeLatency = new Trend('trade_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },
    // Load test - typical load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '30s',
      tags: { test_type: 'load' },
    },
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '3m', target: 300 },
        { duration: '3m', target: 400 },
        { duration: '3m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      startTime: '17m',
      tags: { test_type: 'stress' },
    },
    // Spike test - sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 }, // Instant spike
        { duration: '1m', target: 500 },  // Hold
        { duration: '10s', target: 0 },   // Instant drop
      ],
      startTime: '33m',
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],                  // Less than 1% failures
    errors: ['rate<0.05'],                           // Less than 5% errors
    token_list_latency: ['p(95)<300'],               // Token list under 300ms
    token_detail_latency: ['p(95)<200'],             // Token detail under 200ms
    trade_latency: ['p(95)<400'],                    // Trade history under 400ms
  },
};

// Sample token addresses for testing
const SAMPLE_TOKENS = [
  '0x1234567890123456789012345678901234567890',
  '0x2345678901234567890123456789012345678901',
  '0x3456789012345678901234567890123456789012',
];

// Sample wallet addresses
const SAMPLE_WALLETS = [
  '0xabcdef1234567890abcdef1234567890abcdef12',
  '0xbcdef1234567890abcdef1234567890abcdef123',
  '0xcdef1234567890abcdef1234567890abcdef1234',
];

// Health check
function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health check status 200': (r) => r.status === 200,
    'health check has status': (r) => r.json('status') === 'ok',
  }) || errorRate.add(1);
}

// Token endpoints
function testTokenEndpoints() {
  group('Token Endpoints', function () {
    // List tokens
    const listStart = Date.now();
    const listRes = http.get(`${BASE_URL}/api/tokens?page=1&limit=20`);
    tokenListLatency.add(Date.now() - listStart);

    check(listRes, {
      'token list status 200': (r) => r.status === 200,
      'token list has data': (r) => r.json('data') !== undefined,
    }) || errorRate.add(1);

    // Get token detail
    const tokenAddress = SAMPLE_TOKENS[Math.floor(Math.random() * SAMPLE_TOKENS.length)];
    const detailStart = Date.now();
    const detailRes = http.get(`${BASE_URL}/api/tokens/${tokenAddress}`);
    tokenDetailLatency.add(Date.now() - detailStart);

    check(detailRes, {
      'token detail status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    // Get token trades
    const tradeStart = Date.now();
    const tradeRes = http.get(`${BASE_URL}/api/tokens/${tokenAddress}/trades?page=1&limit=50`);
    tradeLatency.add(Date.now() - tradeStart);

    check(tradeRes, {
      'token trades status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    // Get token holders
    const holdersRes = http.get(`${BASE_URL}/api/tokens/${tokenAddress}/holders?page=1&limit=50`);
    check(holdersRes, {
      'token holders status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    // Get token candles
    const candlesRes = http.get(`${BASE_URL}/api/tokens/${tokenAddress}/candles?interval=1h&limit=100`);
    check(candlesRes, {
      'token candles status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  });
}

// User endpoints
function testUserEndpoints() {
  group('User Endpoints', function () {
    const walletAddress = SAMPLE_WALLETS[Math.floor(Math.random() * SAMPLE_WALLETS.length)];

    // Get user profile
    const profileRes = http.get(`${BASE_URL}/api/users/${walletAddress}`);
    check(profileRes, {
      'user profile status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    // Get user tokens
    const tokensRes = http.get(`${BASE_URL}/api/users/${walletAddress}/tokens`);
    check(tokensRes, {
      'user tokens status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    // Get user trades
    const tradesRes = http.get(`${BASE_URL}/api/users/${walletAddress}/trades?page=1&limit=20`);
    check(tradesRes, {
      'user trades status ok': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  });
}

// Search and filter
function testSearchEndpoints() {
  group('Search Endpoints', function () {
    // Search tokens
    const searchTerms = ['meme', 'push', 'moon', 'doge', 'pepe'];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const searchRes = http.get(`${BASE_URL}/api/tokens/search?q=${term}`);
    check(searchRes, {
      'search status ok': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Filter by status
    const statuses = ['ACTIVE', 'LOCKED', 'LISTED'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    const filterRes = http.get(`${BASE_URL}/api/tokens?status=${status}&page=1&limit=20`);
    check(filterRes, {
      'filter status ok': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Sort options
    const sortOptions = ['createdAt', 'marketCap', 'volume24h', 'priceChange24h'];
    const sortBy = sortOptions[Math.floor(Math.random() * sortOptions.length)];

    const sortRes = http.get(`${BASE_URL}/api/tokens?sortBy=${sortBy}&sortOrder=desc&page=1&limit=20`);
    check(sortRes, {
      'sort status ok': (r) => r.status === 200,
    }) || errorRate.add(1);
  });
}

// WebSocket test
function testWebSocket() {
  group('WebSocket', function () {
    const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;

    const res = ws.connect(url, {}, function (socket) {
      wsConnections.add(1);

      socket.on('open', function () {
        // Subscribe to token updates
        const tokenAddress = SAMPLE_TOKENS[Math.floor(Math.random() * SAMPLE_TOKENS.length)];
        socket.send(JSON.stringify({
          type: 'subscribe',
          channel: `token:${tokenAddress}`,
        }));

        // Subscribe to global feed
        socket.send(JSON.stringify({
          type: 'subscribe',
          channel: 'trades',
        }));
      });

      socket.on('message', function (data) {
        wsMessages.add(1);
        const message = JSON.parse(data);
        check(message, {
          'ws message has type': (m) => m.type !== undefined,
        });
      });

      socket.on('error', function (e) {
        errorRate.add(1);
        console.error('WebSocket error:', e);
      });

      // Keep connection open for 10 seconds
      socket.setTimeout(function () {
        socket.close();
      }, 10000);
    });

    check(res, {
      'ws connected': (r) => r && r.status === 101,
    }) || errorRate.add(1);
  });
}

// Rate limit test
function testRateLimits() {
  group('Rate Limits', function () {
    // Make rapid requests to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 15; i++) {
      requests.push(['GET', `${BASE_URL}/api/tokens?page=1&limit=1&_t=${Date.now()}_${i}`]);
    }

    const responses = http.batch(requests);
    let rateLimited = false;

    responses.forEach((res) => {
      if (res.status === 429) {
        rateLimited = true;
      }
    });

    // We expect rate limiting to kick in after 10 requests/second
    check({ rateLimited }, {
      'rate limiting is working': (r) => r.rateLimited === true,
    });
  });
}

// Metrics endpoint
function testMetricsEndpoint() {
  group('Metrics', function () {
    const res = http.get(`${BASE_URL}/metrics`);
    check(res, {
      'metrics status 200': (r) => r.status === 200,
      'metrics has content': (r) => r.body.length > 0,
      'metrics is prometheus format': (r) => r.body.includes('# HELP') || r.body.includes('# TYPE'),
    }) || errorRate.add(1);
  });
}

// Main test function
export default function () {
  // Always run health check
  healthCheck();

  // Random selection of test groups
  const testGroups = [
    testTokenEndpoints,
    testUserEndpoints,
    testSearchEndpoints,
  ];

  // Run 2-3 random test groups per iteration
  const numGroups = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < numGroups; i++) {
    const group = testGroups[Math.floor(Math.random() * testGroups.length)];
    group();
    sleep(Math.random() * 2 + 0.5); // Sleep 0.5-2.5 seconds between groups
  }

  // Occasionally test WebSocket (10% of iterations)
  if (Math.random() < 0.1) {
    testWebSocket();
  }

  // Occasionally test metrics (5% of iterations)
  if (Math.random() < 0.05) {
    testMetricsEndpoint();
  }
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);

  // Verify the system is up
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`System health check failed: ${healthRes.status}`);
  }

  return { startTime: Date.now() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration} seconds`);
}

// Standalone rate limit scenario
export function rateLimitTest() {
  testRateLimits();
}
