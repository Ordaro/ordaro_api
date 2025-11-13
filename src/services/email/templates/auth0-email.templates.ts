import type {
  Auth0UserDto,
  Auth0ApplicationDto,
  Auth0OrganizationDto,
} from '../dto/auth0-email.dto';
import { Auth0EmailType } from '../dto/auth0-email.dto';
import type { EmailTemplate } from '../email.service';

/**
 * Base email template styles and structure
 */
const BASE_STYLES = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #00387A 0%, #002C5F 100%);
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .content h2 {
      color: #333333;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      color: #666666;
      font-size: 16px;
      margin-bottom: 16px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #00387A 0%, #002C5F 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      opacity: 0.9;
    }
    .code-box {
      background-color: #f8f9fa;
      border: 2px dashed #dee2e6;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .code-box .code {
      font-size: 32px;
      font-weight: 700;
      color: #00387A;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      border-top: 1px solid #e9ecef;
    }
    .footer p {
      margin: 5px 0;
      font-size: 12px;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning p {
      margin: 0;
      color: #856404;
    }
    .link {
      color: #00387A;
      word-break: break-all;
    }
  </style>
`;

/**
 * Generate base HTML structure
 */
function generateBaseHtml(
  title: string,
  content: string,
  buttonText?: string,
  buttonUrl?: string,
  footerText?: string,
): string {
  const buttonHtml =
    buttonText && buttonUrl
      ? `<a href="${buttonUrl}" class="button">${buttonText}</a>`
      : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      ${BASE_STYLES}
    </head>
    <body>
      <div class="container">
       <div class="header">
    <img
      src="https://i.postimg.cc/7P2GGSqp/New-Project-76.png"
      alt="Ordaro Logo"
      width="120"
      height="auto"
    style="display:block;margin:0 auto 10px auto;"
    />
    <h1>Ordaro</h1>
    </div>
        <div class="content">
          ${content}
          ${buttonHtml}
        </div>
        <div class="footer">
          ${footerText ?? '<p>This is an automated message from Ordaro. Please do not reply to this email.</p>'}
          <p>&copy; ${String(new Date().getFullYear())} Ordaro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version from HTML (simple conversion)
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get user display name
 */
function getUserDisplayName(user?: Auth0UserDto): string {
  if (!user) return 'User';
  return user.name ?? user.nickname ?? user.email?.split('@')[0] ?? 'User';
}

/**
 * Get application name
 */
function getApplicationName(application?: Auth0ApplicationDto): string {
  return application?.name ?? 'Ordaro';
}

/**
 * Verification Email Template
 */
export function getVerificationEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
  url: string,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Verify Your Email Address</h2>
    <p>Hi ${userName},</p>
    <p>Thank you for signing up for ${appName}! To complete your registration, please verify your email address by clicking the button below.</p>
    <p>This verification link will expire in 24 hours.</p>
    <p>If you didn't create an account with ${appName}, you can safely ignore this email.</p>
  `;

  const html = generateBaseHtml(
    'Verify Your Email',
    content,
    'Verify Email Address',
    url,
    '<p>If the button above doesn\'t work, copy and paste this link into your browser:</p><p class="link">' +
      url +
      '</p>',
  );

  return {
    subject: `Verify your email address - ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * Password Reset Email Template
 */
export function getPasswordResetEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
  url: string,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${userName},</p>
    <p>We received a request to reset your password for your ${appName} account.</p>
    <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
    <div class="warning">
      <p><strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>
  `;

  const html = generateBaseHtml(
    'Reset Your Password',
    content,
    'Reset Password',
    url,
    '<p>If the button above doesn\'t work, copy and paste this link into your browser:</p><p class="link">' +
      url +
      '</p>',
  );

  return {
    subject: `Reset your password - ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * Welcome Email Template
 */
export function getWelcomeEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Welcome to ${appName}!</h2>
    <p>Hi ${userName},</p>
    <p>We're excited to have you on board! Your account has been successfully created.</p>
    <p>You can now start using all the features ${appName} has to offer. If you have any questions, feel free to reach out to our support team at support@ordaro.cloud</p>
    <p>Happy exploring!</p>
  `;

  const html = generateBaseHtml(
    `Welcome to ${appName}`,
    content,
    'Go to Dashboard',
    'https://ordaro.cloud/login',
  );

  return {
    subject: `Welcome to ${appName}!`,
    html,
    text: htmlToText(html),
  };
}

/**
 * User Invited Email Template
 */
export function getUserInvitedEmailTemplate(
  user: Auth0UserDto | undefined,
  inviter: Auth0UserDto | undefined,
  organization: Auth0OrganizationDto | undefined,
  application: Auth0ApplicationDto | undefined,
  url: string,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const inviterName = getUserDisplayName(inviter);
  const orgName =
    organization?.name ?? organization?.display_name ?? 'the organization';
  const appName = getApplicationName(application);

  const content = `
    <h2>You've Been Invited!</h2>
    <p>Hi ${userName},</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on ${appName}.</p>
    <p>Click the button below to accept the invitation and create your account. This invitation will expire in 7 days.</p>
    <p>If you didn't expect this invitation, you can safely ignore this email.</p>
  `;

  const html = generateBaseHtml(
    "You've Been Invited",
    content,
    'Accept Invitation',
    url,
    '<p>If the button above doesn\'t work, copy and paste this link into your browser:</p><p class="link">' +
      url +
      '</p>',
  );

  return {
    subject: `Invitation to join ${orgName} on ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * Change Password Email Template
 */
export function getChangePasswordEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Password Changed Successfully</h2>
    <p>Hi ${userName},</p>
    <p>Your password for your ${appName} account has been successfully changed.</p>
    <div class="warning">
      <p><strong>Security Notice:</strong> If you didn't make this change, please contact our support team immediately.</p>
    </div>
    <p>If you made this change, you can safely ignore this email.</p>
  `;

  const html = generateBaseHtml('Password Changed', content);

  return {
    subject: `Your password has been changed - ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * Block Account Email Template
 */
export function getBlockAccountEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
  reason?: string,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Account Access Restricted</h2>
    <p>Hi ${userName},</p>
    <p>Your ${appName} account has been temporarily blocked for security reasons.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you believe this is an error, please contact our support team to resolve this issue.</p>
    <p>We take account security seriously and may block accounts if we detect suspicious activity.</p>
  `;

  const html = generateBaseHtml(
    'Account Access Restricted',
    content,
    'Contact Support',
    'mailto:support@ordaro.cloud',
  );

  return {
    subject: `Account access restricted - ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * MFA Code Email Template
 */
export function getMFACodeEmailTemplate(
  user: Auth0UserDto | undefined,
  application: Auth0ApplicationDto | undefined,
  code: string,
): EmailTemplate {
  const userName = getUserDisplayName(user);
  const appName = getApplicationName(application);

  const content = `
    <h2>Your Verification Code</h2>
    <p>Hi ${userName},</p>
    <p>You requested a verification code for your ${appName} account.</p>
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    <p>Enter this code to complete your login. This code will expire in 10 minutes.</p>
    <div class="warning">
      <p><strong>Never share this code with anyone.</strong> ${appName} will never ask for your verification code.</p>
    </div>
  `;

  const html = generateBaseHtml('Your Verification Code', content);

  return {
    subject: `Your verification code - ${appName}`,
    html,
    text: htmlToText(html),
  };
}

/**
 * Get email template by type
 */
export function getAuth0EmailTemplate(
  type: Auth0EmailType,
  data: {
    user?: Auth0UserDto;
    application?: Auth0ApplicationDto;
    organization?: Auth0OrganizationDto;
    inviter?: Auth0UserDto;
    url?: string;
    code?: string;
    reason?: string;
  },
): EmailTemplate {
  switch (type) {
    case Auth0EmailType.VERIFICATION_EMAIL:
      if (!data.url) {
        throw new Error('URL is required for verification email');
      }
      return getVerificationEmailTemplate(
        data.user,
        data.application,
        data.url,
      );

    case Auth0EmailType.PASSWORD_RESET:
      if (!data.url) {
        throw new Error('URL is required for password reset email');
      }
      return getPasswordResetEmailTemplate(
        data.user,
        data.application,
        data.url,
      );

    case Auth0EmailType.WELCOME_EMAIL:
      return getWelcomeEmailTemplate(data.user, data.application);

    case Auth0EmailType.USER_INVITED:
      if (!data.url) {
        throw new Error('URL is required for user invited email');
      }
      return getUserInvitedEmailTemplate(
        data.user,
        data.inviter,
        data.organization,
        data.application,
        data.url,
      );

    case Auth0EmailType.CHANGE_PASSWORD:
      return getChangePasswordEmailTemplate(data.user, data.application);

    case Auth0EmailType.BLOCK_ACCOUNT:
      return getBlockAccountEmailTemplate(
        data.user,
        data.application,
        data.reason,
      );

    case Auth0EmailType.MFA_CODE:
      if (!data.code) {
        throw new Error('Code is required for MFA email');
      }
      return getMFACodeEmailTemplate(data.user, data.application, data.code);

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}
