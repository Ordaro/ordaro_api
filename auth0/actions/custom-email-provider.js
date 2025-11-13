/**
 * Auth0 Custom Email Provider Action
 * 
 * This action is triggered by Auth0 when a custom email provider is configured.
 * It calls the NestJS API endpoint to queue emails through the email service.
 * 
 * Important: For custom-email-provider actions, api.setResult() is NOT available.
 * Instead:
 * - If the action completes successfully (no errors), Auth0 assumes email was sent and won't send default
 * - If api.notification.drop() is called, Auth0 will send the default email (permanent failure)
 * - If api.notification.retry() is called, Auth0 will retry the action up to 5 times (temporary failure)
 * 
 * Event Structure:
 * - event.notification.message_type: The type of email (verify_email, reset_email, etc.)
 * - event.notification.to: Recipient email address
 * - event.notification.html/text: Rendered email templates (used to extract URLs/codes)
 * - event.user: User information
 * - event.client: Client/application information
 * - event.organization: Organization information (if applicable)
 * 
 * Setup Instructions:
 * 1. In Auth0 Dashboard, go to Actions > Flows > Custom Email Provider
 * 2. Create a new action and paste this code
 * 3. Add the following secrets:
 *    - ORDARO_API_URL: Your NestJS API base URL (e.g., https://api.ordaro.cloud)
 *    - ORDARO_API_KEY: Your AUTH0_EMAIL_API_KEY value
 * 4. Deploy the action
 * 5. In Branding > Email Provider, enable "Use my own email provider" and select this action
 * 
 * Note: This script extracts URLs and codes from Auth0's rendered email templates.
 * If extraction fails for required fields, the notification will be dropped and Auth0
 * will send the default email to ensure the user receives the email.
 */

/**
 * @param {Event} event - Auth0 event object
 * @param {API} api - Auth0 API object (custom-email-provider has api.notification, api.cache)
 */
exports.onExecuteCustomEmailProvider = async (event, api) => {
  const { ORDARO_API_URL, ORDARO_API_KEY } = event.secrets;

  // Validate required secrets
  if (!ORDARO_API_URL || !ORDARO_API_KEY) {
    const errorMsg = 'Missing required secrets: ORDARO_API_URL or ORDARO_API_KEY';
    console.error(errorMsg);
    // Drop notification - configuration error is permanent, Auth0 will send default email
    api.notification.drop(errorMsg);
    return;
  }

  try {
    // Extract email data from event.notification (the actual event structure)
    const notification = event.notification;
    if (!notification) {
      const errorMsg = 'No notification object found in event';
      console.error(errorMsg);
      api.notification.drop(errorMsg);
      return;
    }

    // Get email type from notification.message_type
    const messageType = notification.message_type;
    const recipient = notification.to || event.user?.email;
    
    if (!recipient) {
      const errorMsg = 'No recipient email address found in event';
      console.error(errorMsg);
      // Drop notification - invalid data is permanent, Auth0 will send default email
      api.notification.drop(errorMsg);
      return;
    }

    // Map Auth0 message_type values to our email types
    // Auth0 message types: verify_email, verify_email_by_code, reset_email, reset_email_by_code,
    // welcome_email, verification_code, mfa_oob_code, enrollment_email, blocked_account,
    // stolen_credentials, try_provider_configuration_email, organization_invitation
    const emailTypeMap = {
      'verify_email': 'verification_email',
      'verify_email_by_code': 'verification_email',
      'reset_email': 'password_reset',
      'reset_email_by_code': 'password_reset',
      'welcome_email': 'welcome_email',
      'verification_code': 'mfa_code',
      'mfa_oob_code': 'mfa_code',
      'enrollment_email': 'welcome_email',
      'blocked_account': 'block_account',
      'stolen_credentials': 'block_account',
      'try_provider_configuration_email': 'welcome_email',
      'organization_invitation': 'user_invited',
    };

    const mappedType = emailTypeMap[messageType] || 'verification_email';

    // Validate that we have a valid message type
    if (!messageType) {
      const errorMsg = 'No message_type found in notification';
      console.error(errorMsg);
      api.notification.drop(errorMsg);
      return;
    }

    // Extract URL and code from notification HTML/text
    // Auth0 provides rendered templates with URLs and codes embedded
    // We extract them to use in our own templates
    let url = undefined;
    let code = undefined;
    
    const text = notification.text || '';
    const html = notification.html || '';
    const combinedContent = text + html;

    // Extract URL for verification and password reset emails
    if (messageType === 'verify_email' || messageType === 'verify_email_by_code' || 
        messageType === 'reset_email' || messageType === 'reset_email_by_code' ||
        messageType === 'organization_invitation') {
      // Look for URLs in the content (common patterns)
      // Auth0 typically includes URLs like: https://.../continue?token=... or https://.../verify?token=...
      const urlMatch = combinedContent.match(/https?:\/\/[^\s<>"']+/);
      if (urlMatch) {
        url = urlMatch[0];
        // Clean up URL (remove trailing punctuation that might have been included)
        url = url.replace(/[.,;:!?]+$/, '');
      }
    }

    // Extract code for verification codes and MFA
    if (messageType === 'verification_code' || messageType === 'mfa_oob_code' || 
        messageType === 'verify_email_by_code' || messageType === 'reset_email_by_code') {
      // Look for common code patterns (4-8 digit codes)
      // Codes are often displayed prominently, might be in bold or large text
      const codeMatch = combinedContent.match(/\b(\d{4,8})\b/);
      if (codeMatch) {
        code = codeMatch[1];
      }
    }

    // Validate required fields based on email type
    if ((mappedType === 'verification_email' || mappedType === 'password_reset' || mappedType === 'user_invited') && !url) {
      const errorMsg = `Required URL not found for ${mappedType} email type`;
      console.error(errorMsg);
      // Drop notification - we can't send without the required URL
      api.notification.drop(errorMsg);
      return;
    }

    if (mappedType === 'mfa_code' && !code) {
      const errorMsg = 'Required code not found for MFA email type';
      console.error(errorMsg);
      // Drop notification - we can't send without the required code
      api.notification.drop(errorMsg);
      return;
    }

    // Map client to application (for backward compatibility with our DTO)
    const application = event.client ? {
      id: event.client.client_id,
      name: event.client.name,
      logo: event.client.metadata?.logo,
    } : undefined;

    // Map client data
    const client = event.client ? {
      id: event.client.client_id,
      name: event.client.name,
    } : undefined;

    // Construct request payload
    const payload = {
      type: mappedType,
      to: recipient,
      user: event.user ? {
        id: event.user.user_id,
        email: event.user.email,
        name: event.user.name,
        nickname: event.user.nickname,
        picture: event.user.picture,
        user_metadata: event.user.user_metadata,
        app_metadata: event.user.app_metadata,
      } : undefined,
      application: application,
      client: client,
      organization: event.organization ? {
        id: event.organization.id,
        name: event.organization.name,
        display_name: event.organization.display_name,
      } : undefined,
      // URL and code extracted from Auth0's notification templates
      url: url,
      code: code,
      inviter: undefined, // Not directly in event, might be in organization context
      reason: undefined, // Not directly in event for blocked_account
      context: {
        ip: event.request?.ip,
        userAgent: event.request?.user_agent,
        locale: notification.locale,
        messageType: messageType,
        ...(event.request || {}),
      },
    };

    // Call NestJS API endpoint
    const apiUrl = `${ORDARO_API_URL}/emails/auth0`;
    console.log(`Calling Ordaro API: ${apiUrl}`, {
      messageType: messageType,
      mappedType: mappedType,
      to: recipient,
      userId: event.user?.user_id,
    });

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ORDARO_API_KEY,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      // Network errors are retryable
      const errorMsg = `Network error calling Ordaro API: ${fetchError.message || String(fetchError)}`;
      console.error(errorMsg);
      api.notification.retry(errorMsg);
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Ordaro API error: ${response.status} - ${errorText}`;
      console.error(errorMsg);
      
      // Determine if error is retryable or permanent
      // 4xx errors (except 401) are usually permanent, 5xx and 401 are retryable
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        // Client errors (bad request, validation, etc.) - drop notification
        api.notification.drop(errorMsg);
      } else {
        // Server errors or auth errors - retry notification
        api.notification.retry(errorMsg);
      }
      return;
    }

    const result = await response.json();
    console.log('Email queued successfully:', result);

    // Success! If we reach here without errors, Auth0 assumes email was sent
    // and won't send the default email. No need to call any API methods.
    // The function will complete normally.
  } catch (error) {
    // Unexpected errors - retry in case it's temporary
    const errorMsg = `Unexpected error in custom email provider: ${error.message || String(error)}`;
    console.error(errorMsg);
    api.notification.retry(errorMsg);
  }
};

