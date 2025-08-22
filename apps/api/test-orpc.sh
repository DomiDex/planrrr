#!/bin/bash
# ORPC API Testing Script

API_URL="${API_URL:-http://localhost:4000}"
ORPC_URL="$API_URL/api/orpc"

echo "=== ORPC API Test ==="
echo "Testing against: $ORPC_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -e "${YELLOW}Testing:${NC} $description"
    echo "Endpoint: $endpoint"
    echo "Data: $data"
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$ORPC_URL/$endpoint")
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} Status: $status_code (expected)"
    else
        echo -e "${RED}✗${NC} Status: $status_code (expected: $expected_status)"
    fi
    
    echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
    echo "---"
    echo ""
}

# 1. Health check
test_endpoint "POST" "health" "{}" "200" "Health Check"

# 2. Auth endpoints
test_endpoint "POST" "auth.login" \
    '{"email":"test@example.com","password":"password123"}' \
    "401" \
    "Login (should fail - user not found)"

test_endpoint "POST" "auth.register" \
    '{"email":"invalid-email","password":"123","name":"Test"}' \
    "400" \
    "Register (should fail - validation error)"

# 3. Protected endpoints (without auth)
test_endpoint "POST" "posts.list" \
    '{"teamId":"123","page":1,"limit":10}' \
    "401" \
    "List Posts (should fail - no auth)"

test_endpoint "POST" "team.current" \
    '{}' \
    "401" \
    "Get Current Team (should fail - no auth)"

# 4. AI endpoints (without auth)
test_endpoint "POST" "ai.generateContent" \
    '{"prompt":"Test","platforms":["FACEBOOK"]}' \
    "401" \
    "Generate AI Content (should fail - no auth)"

# 5. Non-existent endpoint
test_endpoint "POST" "nonexistent.endpoint" \
    '{}' \
    "404" \
    "Non-existent Endpoint"

echo ""
echo "=== Test Summary ==="
echo "If all tests show expected status codes, ORPC is working correctly!"
echo ""
echo "To test with authentication:"
echo "1. First register a user:"
echo "   curl -X POST $ORPC_URL/auth.register -H 'Content-Type: application/json' \\"
echo "   -d '{\"email\":\"user@example.com\",\"password\":\"SecurePass123!\",\"name\":\"Test User\"}'"
echo ""
echo "2. Login to get a token:"
echo "   curl -X POST $ORPC_URL/auth.login -H 'Content-Type: application/json' \\"
echo "   -d '{\"email\":\"user@example.com\",\"password\":\"SecurePass123!\"}'"
echo ""
echo "3. Use the token for protected endpoints:"
echo "   curl -X POST $ORPC_URL/posts.list -H 'Content-Type: application/json' \\"
echo "   -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "   -d '{\"teamId\":\"YOUR_TEAM_ID\",\"page\":1,\"limit\":10}'"