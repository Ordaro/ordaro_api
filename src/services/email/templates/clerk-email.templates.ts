import type { ClerkEmailTemplateData } from '../dto/clerk-email.dto';
import { ClerkEmailType } from '../dto/clerk-email.dto';
import type { EmailTemplate } from '../email.service';

const DEFAULT_TEXT_COLOR = '#1A1A1A';
const DEFAULT_PRIMARY_COLOR = '#00387A';
const DEFAULT_ACCENT_COLOR = '#00B9E4';
const DEFAULT_BUTTON_TEXT = '#FFFFFF';
const PAGE_BACKGROUND = '#F7F9FC';
const CARD_BACKGROUND = '#FFFFFF';
const BORDER_COLOR = '#E2E8F0';
const MUTED_TEXT_COLOR = '#5F6B7A';

function wrapTemplate({
  title,
  body,
  subject,
  previewText,
  branding,
}: {
  title: string;
  body: string;
  subject: string;
  previewText?: string;
  branding: {
    textColor: string;
    primaryColor: string;
    accentColor: string;
    buttonTextColor: string;
    pageBg: string;
    cardBg: string;
    borderColor: string;
    mutedText: string;
  };
}): EmailTemplate {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: ${branding.pageBg};
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: ${branding.textColor};
          }
          .preview-text {
            display: none;
            color: transparent;
            height: 0;
            overflow: hidden;
            opacity: 0;
            visibility: hidden;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 32px 16px;
          }
          .card {
            background: ${branding.cardBg};
            border-radius: 20px;
            padding: 40px 32px;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
            border: 1px solid ${branding.borderColor};
          }
          .title {
            font-size: 26px;
            line-height: 34px;
            margin: 0;
            font-weight: 700;
            color: ${branding.primaryColor};
          }
          .text {
            font-size: 15px;
            line-height: 24px;
            margin: 16px 0 0 0;
          }
          .code {
            font-size: 36px;
            letter-spacing: 8px;
            font-weight: 700;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background: ${branding.accentColor};
            color: ${branding.buttonTextColor};
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
            margin-top: 24px;
          }
          .meta {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid ${branding.borderColor};
            font-size: 13px;
            color: ${branding.mutedText};
          }
          .footer {
            text-align: center;
            margin-top: 24px;
            font-size: 13px;
            color: ${branding.mutedText};
          }
        </style>
      </head>
      <body>
        <span class="preview-text">${previewText ?? ''}</span>
        <div class="container">
          <div class="card">
            <h1 class="title">${title}</h1>
            ${body}
          </div>
          <div class="footer">
            Sent securely by Ordaro · Do not share this email with anyone
          </div>
        </div>
      </body>
    </html>
  `;

  const text = previewText || subject;
  return { subject, html, text };
}

function verificationCodeTemplate(data: ClerkEmailTemplateData): EmailTemplate {
  const preview = `${data.otpCode ?? 'Your code'} is your Ordaro verification code`;
  const body = `
    <p class="text">Enter the code below to continue.</p>
    <p class="code">${data.otpCode ?? '••••••'}</p>
    <p class="text">Keep this code secure—never share it with anyone.</p>
    ${
      data.requestedAt || data.requestedBy
        ? `<div class="meta">
            <strong>Request details</strong><br/>
            ${data.requestedBy ?? ''}${data.requestedBy && data.requestedAt ? ' · ' : ''}${
              data.requestedAt ?? ''
            }<br/>
            ${data.clientIp ? `IP address: ${data.clientIp}` : ''}
          </div>`
        : ''
    }
  `;

  return wrapTemplate({
    title: 'Verification code',
    subject: data.subject || preview,
    body,
    previewText: preview,
    branding: normalizeBranding(data),
  });
}

function passwordResetTemplate(data: ClerkEmailTemplateData): EmailTemplate {
  const preview = 'Reset your Ordaro password';
  const body = `
    <p class="text">
      We received a request to reset the password for ${data.appName ?? 'your account'}.
      Use the link below to choose a new password. This link will expire shortly for security reasons.
    </p>
    ${
      data.resetUrl || data.verificationUrl
        ? `<a class="button" href="${
            data.resetUrl ?? data.verificationUrl
          }" target="_blank" rel="noopener noreferrer">Reset password</a>
           <p class="text">If the button doesn't work, copy this link into your browser:<br/>${
             data.resetUrl ?? data.verificationUrl
           }</p>`
        : ''
    }
    <div class="meta">
      ${
        data.requestedBy || data.requestedAt
          ? `<strong>Request details</strong><br/>
            ${data.requestedBy ?? ''}${data.requestedBy && data.requestedAt ? ' · ' : ''}${
              data.requestedAt ?? ''
            }<br/>`
          : ''
      }
      If you didn't make this request, you can safely ignore this email.
    </div>
  `;

  return wrapTemplate({
    title: 'Reset your password',
    subject: data.subject || preview,
    body,
    previewText: preview,
    branding: normalizeBranding(data),
  });
}

function magicLinkTemplate(data: ClerkEmailTemplateData): EmailTemplate {
  const preview = 'Sign in securely with this magic link';
  const body = `
    <p class="text">
      Use the secure link below to access your ${data.appName ?? 'Ordaro'} account instantly.
      This link expires after a short time or after it's used once.
    </p>
    ${
      data.magicLinkUrl || data.verificationUrl
        ? `<a class="button" href="${
            data.magicLinkUrl ?? data.verificationUrl
          }" target="_blank" rel="noopener noreferrer">Continue to dashboard</a>
           <p class="text">If the button doesn't work, copy this link into your browser:<br/>${
             data.magicLinkUrl ?? data.verificationUrl
           }</p>`
        : ''
    }
    <div class="meta">
      ${
        data.requestedBy || data.requestedAt
          ? `<strong>Request details</strong><br/>
            ${data.requestedBy ?? ''}${data.requestedBy && data.requestedAt ? ' · ' : ''}${
              data.requestedAt ?? ''
            }<br/>`
          : ''
      }
      If you didn't request this link, please ignore this email.
    </div>
  `;

  return wrapTemplate({
    title: 'Secure sign-in link',
    subject: data.subject || preview,
    body,
    previewText: preview,
    branding: normalizeBranding(data),
  });
}

function organizationInvitationTemplate(
  data: ClerkEmailTemplateData,
): EmailTemplate {
  const preview = `You're invited to join ${data.organizationName ?? 'a team'} on Ordaro`;
  const body = `
    <p class="text">
      You've been invited to join ${data.organizationName ?? 'a workspace'} on Ordaro.
      Click below to accept the invitation and get started.
    </p>
    ${
      data.invitationUrl || data.verificationUrl
        ? `<a class="button" href="${
            data.invitationUrl ?? data.verificationUrl
          }" target="_blank" rel="noopener noreferrer">Accept invitation</a>
           <p class="text">If the button doesn't work, copy this link into your browser:<br/>${
             data.invitationUrl ?? data.verificationUrl
           }</p>`
        : ''
    }
    <div class="meta">
      If you weren't expecting this, you can safely ignore this message.
    </div>
  `;

  return wrapTemplate({
    title: 'Invitation to collaborate',
    subject: data.subject || preview,
    body,
    previewText: preview,
    branding: normalizeBranding(data),
  });
}

function welcomeTemplate(data: ClerkEmailTemplateData): EmailTemplate {
  const preview = `Welcome to ${data.organizationName ?? data.appName ?? 'Ordaro'}`;
  const body = `
    <p class="text">
      We're excited to have you on board. Use the link below to explore your new workspace
      and start collaborating with your team.
    </p>
    ${
      data.verificationUrl || data.magicLinkUrl
        ? `<a class="button" href="${
            data.verificationUrl ?? data.magicLinkUrl
          }" target="_blank" rel="noopener noreferrer">Open dashboard</a>`
        : ''
    }
    <div class="meta">
      Need help getting started? Reach out to your workspace admin or Ordaro support.
    </div>
  `;

  return wrapTemplate({
    title: 'Welcome aboard',
    subject: data.subject || preview,
    body,
    previewText: preview,
    branding: normalizeBranding(data),
  });
}

function fallbackTemplate(data: ClerkEmailTemplateData): EmailTemplate {
  if (data.rawBody) {
    return {
      subject: data.subject,
      html: data.rawBody,
      text: data.rawBodyPlain ?? data.subject,
    };
  }

  const body = `
    <p class="text">
      ${data.subject}
    </p>
    <div class="meta">
      This message was generated automatically by Ordaro.
    </div>
  `;

  return wrapTemplate({
    title: data.subject,
    subject: data.subject,
    body,
    previewText: data.subject,
    branding: normalizeBranding(data),
  });
}

export function getClerkEmailTemplate(
  type: ClerkEmailType,
  data: ClerkEmailTemplateData,
): EmailTemplate {
  switch (type) {
    case ClerkEmailType.VERIFICATION_CODE:
    case ClerkEmailType.EMAIL_VERIFICATION:
      return verificationCodeTemplate(data);
    case ClerkEmailType.PASSWORD_RESET:
      return passwordResetTemplate(data);
    case ClerkEmailType.MAGIC_LINK:
      return magicLinkTemplate(data);
    case ClerkEmailType.ORGANIZATION_INVITATION:
      return organizationInvitationTemplate(data);
    case ClerkEmailType.WELCOME_EMAIL:
      return welcomeTemplate(data);
    default:
      return fallbackTemplate(data);
  }
}

function normalizeBranding(_data: ClerkEmailTemplateData): {
  textColor: string;
  primaryColor: string;
  accentColor: string;
  buttonTextColor: string;
  pageBg: string;
  cardBg: string;
  borderColor: string;
  mutedText: string;
} {
  return {
    textColor: DEFAULT_TEXT_COLOR,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    accentColor: DEFAULT_ACCENT_COLOR,
    buttonTextColor: DEFAULT_BUTTON_TEXT,
    pageBg: PAGE_BACKGROUND,
    cardBg: CARD_BACKGROUND,
    borderColor: BORDER_COLOR,
    mutedText: MUTED_TEXT_COLOR,
  };
}
