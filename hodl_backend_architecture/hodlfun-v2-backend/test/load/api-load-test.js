import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const tokenListTrend = new Trend('token_list_duration');
const tokenDetailTrend = new Trend('token_detail_duration');
const portfolioTrend = new Trend('portfolio_duration');

// Test configuration
export const options = {
  // Ramping stages for realistic load pattern
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

// Environment configuration
const BASE_URL = __ENV.K6_API_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// Test data - use real addresses from your test environment
const TEST_TOKEN_ADDRESS = __ENV.K6_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000001';
const TEST_WALLET_ADDRESS = __ENV.K6_WALLET_ADDRESS || '0x0000000000000000000000000000000000000002';

// Helper function to make API requests with proper error handling
function apiRequest(endpoint, name) {
  const url = `${BASE_URL}${API_PREFIX}${endpoint}`;
  const response = http.get(url, {
    tags: { name },
    timeout: '10s',
  });

  return response;
}

// Main test function
export default function () {
  // Health check (lightweight, frequent)
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}${API_PREFIX}/health`);
    check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // Token list (most common endpoint)
  group('Token List', function () {
    const params = {
      page: Math.floor(Math.random() * 5) + 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const res = apiRequest(`/tokens?${queryString}`, 'token_list');

    const success = check(res, {
      'token list status is 200': (r) => r.status === 200,
      'token list has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data !== undefined || Array.isArray(body);
        } catch {
          return false;
        }
      },
    });

    tokenListTrend.add(res.timings.duration);
    errorRate.add(!success);
  });

  sleep(0.5);

  // Trending tokens
  group('Trending Tokens', function () {
    const res = apiRequest('/tokens/trending?limit=10', 'trending_tokens');

    check(res, {
      'trending status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // Token detail (specific token)
  group('Token Detail', function () {
    const res = apiRequest(`/tokens/${TEST_TOKEN_ADDRESS}`, 'token_detail');

    const success = check(res, {
      'token detail status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    tokenDetailTrend.add(res.timings.duration);
    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // Token trades
  group('Token Trades', function () {
    const res = apiRequest(`/tokens/${TEST_TOKEN_ADDRESS}/trades?page=1&limit=50`, 'token_trades');

    check(res, {
      'token trades status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // Token holders
  group('Token Holders', function () {
    const res = apiRequest(`/tokens/${TEST_TOKEN_ADDRESS}/holders?page=1&limit=50`, 'token_holders');

    check(res, {
      'token holders status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);

  // User portfolio
  group('User Portfolio', function () {
    const res = apiRequest(`/users/${TEST_WALLET_ADDRESS}/portfolio`, 'user_portfolio');

    const success = check(res, {
      'portfolio status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    portfolioTrend.add(res.timings.duration);
    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // User holdings
  group('User Holdings', function () {
    const res = apiRequest(`/users/${TEST_WALLET_ADDRESS}/holdings?page=1&limit=20`, 'user_holdings');

    check(res, {
      'holdings status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);

  // New tokens
  group('New Tokens', function () {
    const res = apiRequest('/tokens/new?limit=10', 'new_tokens');

    check(res, {
      'new tokens status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Random sleep to simulate realistic user behavior
  sleep(Math.random() * 2 + 1);
}

// Teardown function - runs once after all VUs complete
export function teardown(data) {
  console.log('Load test completed');
}
