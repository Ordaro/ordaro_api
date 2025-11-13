#!/bin/bash

# Test Email Queue - Simple Example
# This script demonstrates how to send an email and track it using the job ID

BASE_URL="http://localhost:3000"

echo "=== Testing Email Queue ==="
echo ""

# Step 1: Queue an email
echo "1. Queueing email..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/emails/queue" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>"
  }')

echo "Response: $RESPONSE"
echo ""

# Step 2: Extract job ID
JOB_ID=$(echo $RESPONSE | jq -r '.jobId')

if [ "$JOB_ID" == "null" ] || [ -z "$JOB_ID" ]; then
  echo "ERROR: Failed to get job ID from response"
  exit 1
fi

echo "✓ Job ID: $JOB_ID"
echo ""

# Step 3: Monitor job status
echo "2. Monitoring job status..."
echo "Job ID to track: $JOB_ID"
echo ""

# Poll job status
for i in {1..10}; do
  STATUS_RESPONSE=$(curl -s "${BASE_URL}/emails/queue/${JOB_ID}")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  
  echo "Attempt $i: Status = $STATUS"
  
  if [ "$STATUS" == "completed" ]; then
    echo ""
    echo "✓ Email sent successfully!"
    echo "Full response:"
    echo $STATUS_RESPONSE | jq
    break
  elif [ "$STATUS" == "failed" ]; then
    echo ""
    echo "✗ Email failed to send"
    FAILED_REASON=$(echo $STATUS_RESPONSE | jq -r '.failedReason')
    echo "Reason: $FAILED_REASON"
    break
  fi
  
  sleep 2
done

echo ""
echo "=== Test Complete ==="
echo "Use this job ID to track: $JOB_ID"
echo "Check status: curl ${BASE_URL}/emails/queue/${JOB_ID}"





