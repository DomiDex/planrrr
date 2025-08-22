#!/bin/bash

# API Test Script for planrrr.io
API_URL="http://localhost:4000"

echo "🧪 Testing planrrr.io API Endpoints"
echo "===================================="

# Test health endpoint (regular HTTP GET)
echo -e "\n1. Testing Health Check (GET /health):"
curl -s $API_URL/health | jq '.'

# Test ORPC health (requires POST)
echo -e "\n2. Testing ORPC Health (POST /api/orpc/health):"
curl -s -X POST $API_URL/api/orpc/health \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

# Test user registration
echo -e "\n3. Testing User Registration (POST /api/orpc/auth.register):"
TIMESTAMP=$(date +%s)
curl -s -X POST $API_URL/api/orpc/auth.register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"password\": \"SecurePass123!\",
    \"name\": \"Test User\"
  }" | jq '.'

# Test user login
echo -e "\n4. Testing User Login (POST /api/orpc/auth.login):"
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/api/orpc/auth.login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"password\": \"SecurePass123!\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

# Extract token if login successful
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -n "$TOKEN" ]; then
  echo -e "\n✅ Login successful! Token received."
  
  # Test authenticated endpoint
  echo -e "\n5. Testing Get Current User (POST /api/orpc/auth.me):"
  curl -s -X POST $API_URL/api/orpc/auth.me \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' | jq '.'
else
  echo -e "\n❌ Login failed or token not received"
fi

echo -e "\n===================================="
echo "✨ API Test Complete!"