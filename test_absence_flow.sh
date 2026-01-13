#!/bin/bash

BACKEND="https://timeclock-backend.marcusray.workers.dev"

echo "=== TESTING ABSENCE REQUEST FLOW ==="
echo ""

# Test 1: Check the backend is alive
echo "1️⃣ Health check..."
curl -s "$BACKEND/api/status" | jq . || echo "❌ Backend unreachable"
echo ""

# Test 2: Submit an absence (POST /api/absence)
echo "2️⃣ Submitting absence request..."
SUBMIT_RESPONSE=$(curl -s -X POST "$BACKEND/api/absence" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestUser",
    "startDate": "2026-01-20",
    "endDate": "2026-01-22",
    "reason": "Personal Leave",
    "comment": "Test absence request",
    "discordId": "123456789"
  }')
echo "$SUBMIT_RESPONSE" | jq . 
echo ""

# Test 3: Check for approved absences (should be empty - none approved yet)
echo "3️⃣ Checking for approved absences (should be empty)..."
CHECK_RESPONSE=$(curl -s -X POST "$BACKEND/api/absence/check-approved" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestUser",
    "discordId": "123456789"
  }')
echo "$CHECK_RESPONSE" | jq .
echo ""

# Test 4: Simulate admin approval (POST /api/admin/absence/update-status)
echo "4️⃣ Admin approving absence (row 2)..."
APPROVE_RESPONSE=$(curl -s -X POST "$BACKEND/api/admin/absence/update-status" \
  -H "Content-Type: application/json" \
  -d '{
    "rowIndex": 2,
    "status": "Approved"
  }')
echo "$APPROVE_RESPONSE" | jq .
echo ""

# Test 5: Check for approved absences again (should now return the approved one)
echo "5️⃣ Checking for approved absences again (should return approved)..."
CHECK_RESPONSE2=$(curl -s -X POST "$BACKEND/api/absence/check-approved" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestUser",
    "discordId": "123456789"
  }')
echo "$CHECK_RESPONSE2" | jq .
echo ""

# Test 6: Acknowledge the absence (POST /api/absence/acknowledge)
echo "6️⃣ Acknowledging absence notification..."
ACK_RESPONSE=$(curl -s -X POST "$BACKEND/api/absence/acknowledge" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-01-20",
    "endDate": "2026-01-22",
    "discordId": "123456789"
  }')
echo "$ACK_RESPONSE" | jq .
echo ""

# Test 7: Check again - should return empty (already acknowledged)
echo "7️⃣ Checking again (should be empty - already acknowledged)..."
CHECK_RESPONSE3=$(curl -s -X POST "$BACKEND/api/absence/check-approved" \
  -H "Content-Type": application/json" \
  -d '{
    "name": "TestUser",
    "discordId": "123456789"
  }')
echo "$CHECK_RESPONSE3" | jq .
echo ""

echo "✅ FLOW TEST COMPLETE"

