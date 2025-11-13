#!/bin/bash

# Email Queue Example Script
# This script demonstrates how to send emails to the queue and monitor them

BASE_URL="http://localhost:3000"
EMAIL_ENDPOINT="${BASE_URL}/emails/queue"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Email Queue Example ===${NC}\n"

# 1. Queue a single email
echo -e "${YELLOW}1. Queueing email...${NC}"
RESPONSE=$(curl -s -X POST "${EMAIL_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Test Email from Queue",
    "html": "<h1>Hello!</h1><p>This is a test email from the queue system.</p>",
    "text": "Hello! This is a test email from the queue system.",
    "options": {
      "priority": 5,
      "attempts": 3
    }
  }')

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
QUEUE_NAME=$(echo $RESPONSE | jq -r '.queueName')
STATUS=$(echo $RESPONSE | jq -r '.status')

echo -e "Job ID: ${GREEN}${JOB_ID}${NC}"
echo -e "Queue: ${GREEN}${QUEUE_NAME}${NC}"
echo -e "Status: ${GREEN}${STATUS}${NC}\n"

if [ "$JOB_ID" == "null" ] || [ -z "$JOB_ID" ]; then
  echo -e "${RED}Error: Failed to queue email${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

# 2. Monitor job status
echo -e "${YELLOW}2. Monitoring job status...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  JOB_STATUS=$(curl -s "${BASE_URL}/emails/queue/${JOB_ID}" | jq -r '.status')
  
  echo -e "Attempt $((ATTEMPT + 1)): Status = ${YELLOW}${JOB_STATUS}${NC}"
  
  if [ "$JOB_STATUS" == "completed" ]; then
    echo -e "${GREEN}✓ Email sent successfully!${NC}\n"
    
    # Get job details
    JOB_DETAILS=$(curl -s "${BASE_URL}/emails/queue/${JOB_ID}")
    echo "Job Details:"
    echo "$JOB_DETAILS" | jq
    break
  elif [ "$JOB_STATUS" == "failed" ]; then
    echo -e "${RED}✗ Email failed to send${NC}\n"
    
    # Get failure reason
    FAILED_REASON=$(curl -s "${BASE_URL}/emails/queue/${JOB_ID}" | jq -r '.failedReason')
    echo "Failure Reason: $FAILED_REASON"
    
    # Option to retry
    read -p "Do you want to retry this job? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}Retrying job...${NC}"
      RETRY_RESPONSE=$(curl -s -X POST "${BASE_URL}/emails/queue/${JOB_ID}/retry")
      echo "$RETRY_RESPONSE" | jq
    fi
    break
  elif [ "$JOB_STATUS" == "active" ]; then
    echo -e "${YELLOW}Job is being processed...${NC}"
  fi
  
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo -e "${RED}Timeout: Job did not complete within expected time${NC}"
fi

# 3. Get queue statistics
echo -e "\n${YELLOW}3. Queue Statistics:${NC}"
STATS=$(curl -s "${BASE_URL}/emails/queue/stats")
echo "$STATS" | jq

# 4. Example: Queue batch emails
echo -e "\n${YELLOW}4. Queueing batch emails...${NC}"
BATCH_RESPONSE=$(curl -s -X POST "${BASE_URL}/emails/queue/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "to": "user1@example.com",
        "subject": "Batch Email 1",
        "html": "<h1>Hello User 1!</h1>"
      },
      {
        "to": "user2@example.com",
        "subject": "Batch Email 2",
        "html": "<h1>Hello User 2!</h1>"
      }
    ],
    "options": {
      "priority": 5,
      "attempts": 3
    }
  }')

echo "Batch Job IDs:"
echo "$BATCH_RESPONSE" | jq -r '.[] | "  - \(.jobId) (\(.status))"'

echo -e "\n${GREEN}=== Example Complete ===${NC}"





