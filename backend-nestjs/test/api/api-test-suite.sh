#!/bin/bash

#########################################################
# HODL.FUN API TEST SUITE
#
# Tests all READ-ONLY endpoints without contract calls
# Requires: curl, jq (for JSON parsing)
#
# Usage:
#   1. Seed the database: npx ts-node test/seed/seed-mock-data.ts
#   2. Start the API server: npm run start:dev:api
#   3. Run tests: ./test/api/api-test-suite.sh
#########################################################

set -e

# Configuration
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

# Test addresses from seed data
TOKEN1="0xaaaa111111111111111111111111111111111111"        # Active token (MOON)
TOKEN2="0xaaaa222222222222222222222222222222222222"        # Locked token (DHAND)
TOKEN3="0xaaaa333333333333333333333333333333333333"        # Graduated token (GRAD)
TOKEN4="0xaaaa444444444444444444444444444444444444"        # New token (NEW)
TOKEN5="0xaaaa555555555555555555555555555555555555"        # Near graduation (ALMST)
USER1="0x3333333333333333333333333333333333333333"
USER2="0x4444444444444444444444444444444444444444"
CREATOR1="0x1111111111111111111111111111111111111111"
CREATOR2="0x2222222222222222222222222222222222222222"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED++))
}

# Test function
# $1: Test name
# $2: HTTP method (GET/POST)
# $3: Endpoint
# $4: Expected status code
# $5: Expected response check (optional, jq expression)
# $6: Request body (for POST, optional)
run_test() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local check_expr="$5"
    local body="$6"

    local url="${BASE_URL}${endpoint}"
    local response
    local status_code

    if [ "$VERBOSE" = "true" ]; then
        log_info "Testing: $name"
        log_info "  $method $url"
    fi

    # Make request
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo -e "\n000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$body" 2>/dev/null || echo -e "\n000")
    fi

    # Extract status code (last line) and body (everything else)
    status_code=$(echo "$response" | tail -n1)
    local body_response=$(echo "$response" | sed '$d')

    # Check status code
    if [ "$status_code" != "$expected_status" ]; then
        log_error "$name - Expected $expected_status, got $status_code"
        if [ "$VERBOSE" = "true" ]; then
            echo "  Response: $body_response"
        fi
        return 1
    fi

    # Check response content if expression provided
    if [ -n "$check_expr" ]; then
        local check_result=$(echo "$body_response" | jq -r "$check_expr" 2>/dev/null)
        if [ "$check_result" = "null" ] || [ -z "$check_result" ]; then
            log_error "$name - Response check failed: $check_expr"
            if [ "$VERBOSE" = "true" ]; then
                echo "  Response: $body_response"
            fi
            return 1
        fi
    fi

    log_success "$name"
    return 0
}

# Print header
echo ""
echo "========================================================"
echo "         HODL.FUN API TEST SUITE"
echo "========================================================"
echo "Base URL: $BASE_URL"
echo "========================================================"
echo ""

# Check if server is running
log_info "Checking if API server is running..."
if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    if ! curl -s "${BASE_URL}/api" > /dev/null 2>&1; then
        log_error "API server is not running at $BASE_URL"
        echo "Please start the server with: npm run start:dev:api"
        exit 1
    fi
fi
log_success "API server is running"
echo ""

#########################################################
# TOKEN ENDPOINTS
#########################################################
echo "=========================================="
echo "TOKEN ENDPOINTS"
echo "=========================================="

run_test "GET /tokens - List all tokens" \
    "GET" "/tokens" "200" ".items | length > 0"

run_test "GET /tokens?limit=2 - Paginated list" \
    "GET" "/tokens?limit=2" "200" ".limit == 2"

run_test "GET /tokens?sortBy=marketCap&sortOrder=desc - Sorted list" \
    "GET" "/tokens?sortBy=marketCap&sortOrder=desc" "200" ".items[0].marketCap"

run_test "GET /tokens?isListed=true - Filter graduated tokens" \
    "GET" "/tokens?isListed=true" "200" ".items"

run_test "GET /tokens?creator=$CREATOR1 - Filter by creator" \
    "GET" "/tokens?creator=$CREATOR1" "200" ".items"

run_test "GET /tokens/:address - Get token by address" \
    "GET" "/tokens/$TOKEN1" "200" ".address"

run_test "GET /tokens/:address - Non-existent token (404)" \
    "GET" "/tokens/0x0000000000000000000000000000000000000000" "404" ""

run_test "GET /tokens/search?q=MOON - Search by symbol" \
    "GET" "/tokens/search?q=MOON" "200" ".tokens"

run_test "GET /tokens/search?q=Diamond - Search by name" \
    "GET" "/tokens/search?q=Diamond" "200" ".tokens"

run_test "GET /tokens/new - Get new tokens" \
    "GET" "/tokens/new" "200" ".tokens"

run_test "GET /tokens/new?limit=5 - New tokens with limit" \
    "GET" "/tokens/new?limit=5" "200" ".tokens"

run_test "GET /tokens/graduating - Get graduating tokens" \
    "GET" "/tokens/graduating" "200" ".tokens"

run_test "GET /tokens/graduating?threshold=50 - Custom threshold" \
    "GET" "/tokens/graduating?threshold=50" "200" ".tokens"

run_test "GET /tokens/graduated - Get graduated tokens" \
    "GET" "/tokens/graduated" "200" ".tokens"

run_test "GET /tokens/top/volume - Top by volume (24h)" \
    "GET" "/tokens/top/volume" "200" ".tokens"

run_test "GET /tokens/top/volume?period=7d - Top by volume (7d)" \
    "GET" "/tokens/top/volume?period=7d" "200" ".tokens"

run_test "GET /tokens/trending/24h - Trending 24h" \
    "GET" "/tokens/trending/24h" "200" ".tokens"

run_test "GET /tokens/trending/7d - Trending 7d" \
    "GET" "/tokens/trending/7d" "200" ".tokens"

run_test "GET /tokens/:address/price-history - Price history" \
    "GET" "/tokens/$TOKEN1/price-history" "200" ".data"

run_test "GET /tokens/:address/price-history?limit=50 - Limited history" \
    "GET" "/tokens/$TOKEN1/price-history?limit=50" "200" ".data"

run_test "GET /tokens/:address/holders - Get holders" \
    "GET" "/tokens/$TOKEN1/holders" "200" ".holders"

run_test "GET /tokens/:address/holders?limit=10 - Paginated holders" \
    "GET" "/tokens/$TOKEN1/holders?limit=10" "200" ".holders"

echo ""

#########################################################
# PORTFOLIO ENDPOINTS
#########################################################
echo "=========================================="
echo "PORTFOLIO ENDPOINTS"
echo "=========================================="

run_test "GET /portfolios/:userId - Get portfolio" \
    "GET" "/portfolios/$USER1" "200" ".userId"

run_test "GET /portfolios/:userId/summary - Portfolio summary" \
    "GET" "/portfolios/$USER1/summary" "200" ".holdingsCount"

run_test "GET /portfolios/:userId - Non-existent user (404)" \
    "GET" "/portfolios/0x0000000000000000000000000000000000000000" "404" ""

run_test "GET /portfolios/leaderboard/top - Top portfolios" \
    "GET" "/portfolios/leaderboard/top" "200" ".portfolios"

echo ""

#########################################################
# TRADE ENDPOINTS
#########################################################
echo "=========================================="
echo "TRADE ENDPOINTS"
echo "=========================================="

run_test "GET /trades/token/:tokenId - Trades by token" \
    "GET" "/trades/token/$TOKEN1" "200" ".items"

run_test "GET /trades/token/:tokenId?limit=10 - Paginated trades" \
    "GET" "/trades/token/$TOKEN1?limit=10" "200" ".items"

run_test "GET /trades/user/:userAddress - Trades by user" \
    "GET" "/trades/user/$USER1" "200" ".items"

run_test "GET /trades/user/:userAddress?orderBy=totalValue - Sorted trades" \
    "GET" "/trades/user/$USER1?orderBy=totalValue&orderDirection=desc" "200" ".items"

run_test "GET /trades/stats - Global trade stats" \
    "GET" "/trades/stats" "200" ".totalTrades"

run_test "GET /trades/stats?tokenId= - Token trade stats" \
    "GET" "/trades/stats?tokenId=$TOKEN1" "200" ".tokenId"

run_test "GET /trades/stats?user= - User trade stats" \
    "GET" "/trades/stats?user=$USER1" "200" ".user"

echo ""

#########################################################
# TRANSACTION ENDPOINTS (Build-only, no contract calls)
#########################################################
echo "=========================================="
echo "TRANSACTION ENDPOINTS (Build)"
echo "=========================================="

run_test "GET /transactions/contracts - Get contract addresses" \
    "GET" "/transactions/contracts" "200" ".core"

run_test "POST /transactions/build/create-token - Build create tx" \
    "POST" "/transactions/build/create-token" "201" ".to" \
    '{"creator":"0x1234567890123456789012345678901234567890","name":"Test","symbol":"TEST","tokenURI":"ipfs://test","amountIn":"1000000000000000000"}'

run_test "POST /transactions/build/buy - Build buy tx" \
    "POST" "/transactions/build/buy" "201" ".to" \
    '{"token":"'$TOKEN1'","to":"'$USER1'","amountIn":"1000000000000000000","amountOutMin":"0"}'

run_test "POST /transactions/build/sell - Build sell tx" \
    "POST" "/transactions/build/sell" "201" ".to" \
    '{"token":"'$TOKEN1'","from":"'$USER1'","to":"'$USER1'","amountIn":"1000000000000000000000","amountOutMin":"0"}'

run_test "POST /transactions/build/approve - Build approve tx" \
    "POST" "/transactions/build/approve" "201" ".to" \
    '{"token":"'$TOKEN1'","amount":"115792089237316195423570985008687907853269984665640564039457584007913129639935"}'

echo ""

#########################################################
# EDGE CASES & ERROR HANDLING
#########################################################
echo "=========================================="
echo "EDGE CASES & ERROR HANDLING"
echo "=========================================="

run_test "Invalid address format handling" \
    "GET" "/tokens/invalid-address" "404" ""

run_test "Large pagination limit (capped at 100)" \
    "GET" "/tokens?limit=1000" "200" ".limit <= 100"

run_test "Negative offset (defaults to 0)" \
    "GET" "/tokens?offset=-10" "200" ".offset >= 0"

run_test "Empty search query" \
    "GET" "/tokens/search?q=" "200" ".tokens"

run_test "Special characters in search" \
    "GET" "/tokens/search?q=%24%25%5E" "200" ".tokens"

echo ""

#########################################################
# SUMMARY
#########################################################
echo "========================================================"
echo "                    TEST SUMMARY"
echo "========================================================"
echo -e "  ${GREEN}PASSED:${NC}  $PASSED"
echo -e "  ${RED}FAILED:${NC}  $FAILED"
echo -e "  ${YELLOW}SKIPPED:${NC} $SKIPPED"
echo "========================================================"

TOTAL=$((PASSED + FAILED + SKIPPED))
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC} ($PASSED/$TOTAL)"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC} ($PASSED/$TOTAL passed)"
    exit 1
fi
