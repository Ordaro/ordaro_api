# Email Queue Examples

This directory contains example scripts for using the email queue system.

## Files

- **email-queue-example.sh** - Bash script demonstrating queue and monitor workflow
- **email-queue-monitor.js** - Node.js script for monitoring email queue jobs

## Usage

### Bash Example (email-queue-example.sh)

```bash
# Make executable (Linux/Mac)
chmod +x email-queue-example.sh

# Run
./email-queue-example.sh
```

**Note:** On Windows, you can use Git Bash or WSL to run this script.

### Node.js Monitor (email-queue-monitor.js)

```bash
# Install dependencies
npm install axios

# Run
node email-queue-monitor.js
```

## Example Output

### Queue Email

```
✓ Email queued: Job ID 123
  Queue: notifications
  Status: waiting
```

### Monitor Job

```
[Attempt 1] Job 123: waiting
[Attempt 2] Job 123: active
[Attempt 3] Job 123: completed
✓ Email sent successfully!
```

### Queue Statistics

```
Queue Statistics:
  Waiting: 10
  Active: 2
  Completed: 1000
  Failed: 5
  Delayed: 3
```

## Configuration

Update the `BASE_URL` or `API_URL` environment variable to point to your API:

```bash
# Bash
export BASE_URL="http://localhost:3000"

# Node.js
export API_URL="http://localhost:3000"
```

## Documentation

For more information, see:

- [EMAIL_QUEUE_GUIDE.md](../EMAIL_QUEUE_GUIDE.md)
- [EMAIL_QUEUE_QUICK_START.md](../EMAIL_QUEUE_QUICK_START.md)
- [EMAIL_RETRY_FLOW.md](../EMAIL_RETRY_FLOW.md)
