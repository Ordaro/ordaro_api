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
  rawBody: string;

  rawBodyPlain?: string | undefined; // optional
  otpCode?: string | undefined;
  verificationUrl?: string | undefined;
  resetUrl?: string | undefined;
  magicLinkUrl?: string | undefined;
  invitationUrl?: string | undefined;
  requestedAt?: string | undefined;
  requestedBy?: string | undefined;
  organizationName?: string | undefined;
  appName?: string | undefined;
  appUrl?: string | undefined;
  appLogoUrl?: string | undefined;
  clientIp?: string | undefined;
  userAgent?: string | undefined;
}
