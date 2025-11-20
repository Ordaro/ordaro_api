# Resend Email Service Implementation

## Overview

The email service has been migrated from a generic REST API (Mailgun-style) to **Resend**, a modern email API service designed for developers. The service now uses the custom domain **`notifications.ordaro.cloud`** for sending emails.

## Changes Made

### 1. Package Dependencies

- **Removed**: `axios` (no longer needed for email service)
- **Added**: `resend` (needs to be installed)

### 2. Service Implementation

- Replaced `AxiosInstance` client with `Resend` client
- Updated `sendEmail()` method to use Resend's API
- Maintained backward compatibility with existing `EmailOptions` interface
- Added support for `replyTo`, `tags`, and `headers` fields
- **Fixed attachment handling**: Now uses base64 strings (Resend requirement) or remote file URLs
- **Added batch email sending**: `sendBatchEmails()` method
- **Added email management**: `getEmail()`, `updateEmail()`, `cancelEmail()`, `listEmails()`
- **Added attachment management**: `listAttachments()`, `getAttachment()`
- **Custom domain support**: Uses `notifications.ordaro.cloud` by default

### 3. Configuration

The service now supports the following environment variables:

- `RESEND_API_KEY` (primary) or `EMAIL_SERVICE_API_KEY` (fallback)
- `RESEND_DOMAIN` or `EMAIL_DOMAIN` (defaults to `notifications.ordaro.cloud`)
- `RESEND_FROM_EMAIL` or `EMAIL_FROM` (defaults to `noreply@notifications.ordaro.cloud`)
- `RESEND_FROM_NAME` or `EMAIL_FROM_NAME` (defaults to `Ordaro`)

Or via ConfigService:

- `app.email.apiKey`
- `app.email.domain`
- `app.email.fromEmail`
- `app.email.fromName`

## Installation

### Step 1: Install Resend Package

```bash
cd C:\Users\user\Desktop\work\ordaro\ordaro-api
pnpm add resend
```

### Step 2: Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (required for sending emails)
3. Get your API key from the dashboard

### Step 3: Configure Environment Variables

Add to your `.env` files:

```env
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_DOMAIN=notifications.ordaro.cloud
RESEND_FROM_EMAIL=noreply@notifications.ordaro.cloud
RESEND_FROM_NAME=Ordaro
```

Or use the existing variables (for backward compatibility):

```env
EMAIL_SERVICE_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_DOMAIN=notifications.ordaro.cloud
EMAIL_FROM=noreply@notifications.ordaro.cloud
EMAIL_FROM_NAME=Ordaro
```

**Important**: Make sure the domain `notifications.ordaro.cloud` is verified in your Resend dashboard before sending emails.

## Features

### ✅ Supported Features

- HTML and plain text emails
- Multiple recipients (to, cc, bcc)
- **Attachments**: base64 strings, Buffer (auto-converted), or remote file URLs
- Reply-to addresses
- Email tags and custom headers
- Template-based emails
- **Batch email sending**: Send multiple emails in a single API call
- **Email management**: Retrieve, update, cancel, and list emails
- **Attachment management**: List and retrieve email attachments
- **Email scheduling**: Schedule emails for future delivery
- Error handling and logging
- **Custom domain**: Uses `notifications.ordaro.cloud` by default

### 📧 Email Templates

All existing email templates are preserved:

- `sendInvitationEmail()` - Organization invitations
- `sendWelcomeEmail()` - Welcome messages
- `sendOrderConfirmationEmail()` - Order confirmations
- `sendTemplateEmail()` - Generic template support

## API Compatibility

The service maintains **100% backward compatibility** with existing code. No changes are required in:

- `NotificationWorker`
- Any controllers or services using `EmailService`
- Email template methods

## Resend API Benefits

1. **Developer-Friendly**: Modern API with excellent TypeScript support
2. **Fast**: Low latency and high deliverability
3. **Simple**: Clean API design, easy to use
4. **Reliable**: Built for production use
5. **React Email Support**: Can use React components for email templates (optional)

## New Features

### Batch Email Sending

```typescript
await this.emailService.sendBatchEmails({
  emails: [
    {
      from: 'Ordaro <noreply@notifications.ordaro.cloud>',
      to: 'user1@example.com',
      subject: 'Welcome',
      html: '<h1>Welcome!</h1>',
    },
    {
      from: 'Ordaro <noreply@notifications.ordaro.cloud>',
      to: 'user2@example.com',
      subject: 'Welcome',
      html: '<h1>Welcome!</h1>',
    },
  ],
});
```

### Email Management

```typescript
// Retrieve email
const email = await this.emailService.getEmail('email-id');

// Update email (schedule)
await this.emailService.updateEmail('email-id', {
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour from now
});

// Cancel scheduled email
await this.emailService.cancelEmail('email-id');

// List emails
const emails = await this.emailService.listEmails({ limit: 10 });
```

### Attachment Management

```typescript
// List attachments
const attachments = await this.emailService.listAttachments('email-id');

// Get attachment
const attachment = await this.emailService.getAttachment(
  'email-id',
  'attachment-id',
);
```

### Attachments with Remote Files

```typescript
await this.emailService.sendEmail({
  to: 'test@example.com',
  subject: 'Document',
  html: '<p>Please find attached.</p>',
  attachments: [
    {
      filename: 'document.pdf',
      path: 'https://example.com/document.pdf', // Remote file URL
    },
  ],
});
```

## Testing

After installation, test the service:

```typescript
// Example usage (in a controller or service)
await this.emailService.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Hello from Resend!</h1>',
  text: 'Hello from Resend!',
  from: 'Ordaro <noreply@notifications.ordaro.cloud>', // Uses custom domain
});
```

## Migration Notes

- The `from` field format is now: `"Name <email@domain.com>"` or `"email@domain.com"`
- **Attachments**: Must be base64 encoded strings (Buffer is auto-converted) or use remote file URLs with `path` property
- Error responses follow Resend's error format
- Message IDs are returned in Resend's format
- **Custom domain**: All emails are sent from `notifications.ordaro.cloud` by default
- The domain must be verified in Resend dashboard before sending emails

## Next Steps

1. ✅ Install `resend` package: `pnpm add resend`
2. ✅ Get Resend API key from [resend.com](https://resend.com)
3. ✅ Verify your sending domain in Resend dashboard
4. ✅ Add environment variables to `.env` files
5. ✅ Test email sending functionality
6. ✅ Update production environment variables

## Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs)
- [Resend API Reference](https://resend.com/docs/api-reference)
