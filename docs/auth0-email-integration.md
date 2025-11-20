# Auth0 Email Integration Guide

This guide explains how to integrate Auth0's email system with the Ordaro NestJS email service and queue system.

## Overview

The integration uses Auth0 Actions (Custom Email Provider) to route all Auth0 emails through the NestJS email queue system. This provides:

- Full control over email templates
- Email delivery tracking and monitoring
- Automatic retry on failure
- Consistent branding across all emails
- Queue-based processing for reliability

## Architecture

```
Auth0 Event → Auth0 Action → NestJS API → Email Queue → Resend API
```

1. Auth0 triggers an email event (verification, password reset, etc.)
2. Auth0 Action intercepts the event and calls the NestJS API
3. NestJS queues the email job
4. Background worker processes the job and sends via Resend
5. Email is delivered to the user

## Prerequisites

1. **NestJS API deployed** and accessible from Auth0
2. **Resend account** with verified domain (`notifications.ordaro.cloud`)
3. **Auth0 account** with Actions enabled
4. **API key** configured in environment variables

## Setup Steps

### 1. Configure Environment Variables

Add the following to your NestJS environment:

```bash
AUTH0_EMAIL_API_KEY=your-secure-api-key-here
```

Generate a secure random API key (e.g., using `openssl rand -hex 32`).

### 2. Deploy NestJS Changes

Ensure all code changes are deployed:

- Auth0 email DTOs
- Email templates
- Auth0 endpoint (`POST /emails/auth0`)
- Queue worker handler
- API key guard

### 3. Create Auth0 Action

1. **Navigate to Auth0 Dashboard**
   - Go to **Actions** → **Flows** → **Custom Email Provider**

2. **Create New Action**
   - Click **"Create Action"**
   - Name it: `Ordaro Custom Email Provider`
   - Select trigger: **Custom Email Provider**
   - Click **"Create"**

3. **Add Action Code**
   - Copy the contents of `auth0/actions/custom-email-provider.js`
   - Paste into the code editor
   - Click **"Deploy"**

4. **Configure Secrets**
   - In the action settings, go to **Secrets**
   - Add the following secrets:
     - **ORDARO_API_URL**: Your NestJS API base URL
       - Example: `https://api.ordaro.cloud`
       - For local testing: `http://localhost:3000` (not recommended for production)
     - **ORDARO_API_KEY**: Your `AUTH0_EMAIL_API_KEY` value
   - Click **"Save"**

5. **Test the Action**
   - Click **"Test"** tab
   - Use the test event to verify the action works
   - Check that it calls your API successfully

**Important Notes about Custom Email Provider Actions:**

- The `api.setResult()` method is **NOT available** for custom-email-provider actions
- If the action completes successfully (no errors thrown), Auth0 assumes the email was sent and won't send the default email
- Use `api.notification.drop(reason)` for permanent failures (Auth0 will send default email)
- Use `api.notification.retry(reason)` for temporary failures (Auth0 will retry up to 5 times)
- The action script handles this automatically based on error types

### 4. Configure Auth0 Email Provider

1. **Navigate to Email Provider Settings**
   - Go to **Branding** → **Email Provider**

2. **Enable Custom Email Provider**
   - Toggle **"Use my own email provider"** to ON
   - Select **"Custom Provider"**
   - Choose your action: `Ordaro Custom Email Provider`
   - Click **"Save"**

3. **Test Email Delivery**
   - Click **"Send Test Email"**
   - Enter a test email address
   - Verify the email is received
   - Check NestJS logs to confirm the email was queued

### 5. Verify Integration

1. **Test Each Email Type**
   - Create a test user and trigger verification email
   - Request password reset
   - Invite a user to organization
   - Test MFA code delivery
   - Verify each email type works correctly

2. **Monitor Queue**
   - Check queue statistics: `GET /emails/queue/stats`
   - Monitor job status: `GET /emails/queue/:jobId`
   - Verify emails are being processed

3. **Check Logs**
   - Monitor NestJS logs for email queue events
   - Check Auth0 Action logs for any errors
   - Verify Resend delivery status

## Supported Email Types

The integration supports the following Auth0 email types:

1. **Verification Email** (`verification_email`)
   - Sent when user needs to verify their email address
   - Requires: `url` (verification link)

2. **Password Reset** (`password_reset`)
   - Sent when user requests password reset
   - Requires: `url` (reset link)

3. **Welcome Email** (`welcome_email`)
   - Sent after user successfully signs up
   - Optional: `user`, `application`

4. **User Invited** (`user_invited`)
   - Sent when user is invited to organization
   - Requires: `url` (invitation link)
   - Optional: `inviter`, `organization`

5. **Change Password** (`change_password`)
   - Sent when user changes their password
   - Optional: `user`, `application`

6. **Block Account** (`block_account`)
   - Sent when account is blocked
   - Optional: `user`, `application`, `reason`

7. **MFA Code** (`mfa_code`)
   - Sent when MFA code is required
   - Requires: `code` (verification code)

## API Endpoint

### POST /emails/auth0

**Authentication**: API Key (header: `X-API-Key`)

**Request Body**:

```json
{
  "type": "verification_email",
  "to": "user@example.com",
  "user": {
    "id": "auth0|123456789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "application": {
    "id": "abc123",
    "name": "My App"
  },
  "url": "https://app.example.com/verify?token=abc123"
}
```

**Response**:

```json
{
  "jobId": "123",
  "jobType": "SEND_AUTH0_EMAIL",
  "queueName": "notifications",
  "status": "waiting",
  "emailType": "verification_email",
  "recipient": "user@example.com"
}
```

## Troubleshooting

### Emails Not Being Sent

1. **Check API Key**
   - Verify `AUTH0_EMAIL_API_KEY` is set correctly
   - Ensure API key matches in both NestJS and Auth0 Action secrets

2. **Check API URL**
   - Verify `ORDARO_API_URL` is correct and accessible
   - Test API endpoint manually with curl/Postman

3. **Check Auth0 Action Logs**
   - Go to Actions → Your Action → Logs
   - Look for errors or failed requests
   - Check if `api.notification.drop()` or `api.notification.retry()` was called
   - If `drop()` was called, Auth0 will send the default email
   - If `retry()` was called, Auth0 will retry the action

4. **Check NestJS Logs**
   - Look for authentication errors (401)
   - Check for validation errors (400)
   - Verify queue jobs are being created

5. **Verify Action Completion**
   - If the action completes without errors, Auth0 assumes email was sent
   - If the action calls `api.notification.drop()`, Auth0 sends default email
   - If the action calls `api.notification.retry()`, Auth0 retries the action

### Emails Going to Spam

1. **Verify Domain Configuration**
   - Ensure Resend domain is verified
   - Check SPF, DKIM, DMARC records

2. **Review Email Content**
   - Avoid spam trigger words
   - Include proper unsubscribe links
   - Use proper email headers

3. **Check Sender Reputation**
   - Monitor bounce rates
   - Check complaint rates
   - Verify sender score

### Queue Jobs Failing

1. **Check Worker Logs**
   - Look for processing errors
   - Verify email service is working
   - Check Resend API status

2. **Check Job Status**
   - Use `GET /emails/queue/:jobId` to check status
   - Review failed reason
   - Retry failed jobs if needed

3. **Verify Email Service**
   - Test email sending directly
   - Check Resend API key
   - Verify domain configuration

## Security Considerations

1. **API Key Security**
   - Use strong, random API keys
   - Rotate keys periodically
   - Never commit keys to version control
   - Use environment variables or secrets management

2. **Network Security**
   - Use HTTPS for API calls
   - Restrict API access if possible (IP whitelist)
   - Monitor API usage for anomalies

3. **Rate Limiting**
   - Implement rate limiting on Auth0 endpoint
   - Monitor for abuse
   - Set appropriate limits

## Monitoring

### Key Metrics to Monitor

1. **Queue Statistics**
   - Jobs waiting
   - Jobs processing
   - Jobs completed
   - Jobs failed

2. **Email Delivery**
   - Delivery rate
   - Bounce rate
   - Complaint rate
   - Open rate (if tracking enabled)

3. **API Performance**
   - Response times
   - Error rates
   - Request volume

### Monitoring Endpoints

- `GET /emails/queue/stats` - Queue statistics
- `GET /emails/queue/:jobId` - Job status
- Auth0 Dashboard → Actions → Logs

## Rollback Plan

If you need to rollback the integration:

1. **Disable Custom Email Provider**
   - Go to Branding → Email Provider
   - Toggle "Use my own email provider" to OFF
   - Auth0 will use default email provider

2. **Keep Action for Future Use**
   - Don't delete the action
   - You can re-enable it later

3. **Monitor Default Emails**
   - Verify Auth0 default emails are working
   - Check email delivery

## Best Practices

1. **Test Thoroughly**
   - Test all email types before production
   - Verify templates render correctly
   - Check email delivery

2. **Monitor Continuously**
   - Set up alerts for failed jobs
   - Monitor email delivery rates
   - Track API errors

3. **Keep Templates Updated**
   - Maintain consistent branding
   - Update templates as needed
   - Test template changes

4. **Document Changes**
   - Document any customizations
   - Keep integration guide updated
   - Share knowledge with team

## Support

For issues or questions:

1. Check logs (NestJS and Auth0)
2. Review this guide
3. Check Auth0 documentation
4. Contact development team

## Additional Resources

- [Auth0 Custom Email Provider Docs](https://auth0.com/docs/customize/email/configure-a-custom-email-provider)
- [Auth0 Actions Docs](https://auth0.com/docs/customize/actions)
- [Resend Documentation](https://resend.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
