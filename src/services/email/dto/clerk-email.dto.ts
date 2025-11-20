export enum ClerkEmailType {
  VERIFICATION_CODE = 'verification_code',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  MAGIC_LINK = 'magic_link',
  ORGANIZATION_INVITATION = 'organization_invitation',
  WELCOME_EMAIL = 'welcome_email',
  UNKNOWN = 'unknown',
}

export interface ClerkEmailTemplateData {
  to: string;
  subject: string;
  slug: string;
  rawBody?: string;
  rawBodyPlain?: string;
  otpCode?: string;
  verificationUrl?: string;
  resetUrl?: string;
  magicLinkUrl?: string;
  invitationUrl?: string;
  requestedAt?: string;
  requestedBy?: string;
  organizationName?: string;
  appName?: string;
  appUrl?: string;
  appLogoUrl?: string;
  clientIp?: string;
  userAgent?: string;
}
