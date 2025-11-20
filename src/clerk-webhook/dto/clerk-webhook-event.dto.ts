/**
 * Clerk Webhook Event DTOs
 * Based on Clerk's webhook event structure
 * @see https://clerk.com/docs/integrations/webhooks/overview
 */

export enum ClerkWebhookEventType {
  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',

  // Organization events
  ORGANIZATION_CREATED = 'organization.created',
  ORGANIZATION_UPDATED = 'organization.updated',
  ORGANIZATION_DELETED = 'organization.deleted',

  // Organization membership events
  ORGANIZATION_MEMBERSHIP_CREATED = 'organizationMembership.created',
  ORGANIZATION_MEMBERSHIP_UPDATED = 'organizationMembership.updated',
  ORGANIZATION_MEMBERSHIP_DELETED = 'organizationMembership.deleted',

  // Organization invitation events
  ORGANIZATION_INVITATION_CREATED = 'organizationInvitation.created',
  ORGANIZATION_INVITATION_ACCEPTED = 'organizationInvitation.accepted',
  ORGANIZATION_INVITATION_REVOKED = 'organizationInvitation.revoked',

  // Email events
  EMAIL_CREATED = 'email.created',
  EMAIL_UPDATED = 'email.updated',
  EMAIL_DELETED = 'email.deleted',

  // Session events
  SESSION_CREATED = 'session.created',
  SESSION_ENDED = 'session.ended',
  SESSION_REMOVED = 'session.removed',
  SESSION_REVOKED = 'session.revoked',
}

export interface ClerkUser {
  id: string;
  object: 'user';
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  has_image: boolean;
  primary_email_address_id: string | null;
  primary_phone_number_id: string | null;
  primary_web3_wallet_id: string | null;
  password_enabled: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  backup_code_enabled: boolean;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification: {
      status: string;
      strategy: string;
      attempts: number | null;
      expire_at: number | null;
    };
    linked_to: Array<unknown>;
  }>;
  phone_numbers: Array<{
    id: string;
    phone_number: string;
    reserved_for_second_factor: boolean;
    default_second_factor: boolean;
    reserved: boolean;
    verification: {
      status: string;
      strategy: string;
      attempts: number | null;
      expire_at: number | null;
    };
    linked_to: Array<unknown>;
  }>;
  web3_wallets: Array<unknown>;
  external_accounts: Array<unknown>;
  saml_accounts: Array<unknown>;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  unsafe_metadata: Record<string, unknown>;
  external_id: string | null;
  last_sign_in_at: number | null;
  banned: boolean;
  locked: boolean;
  lockout_expires_in_seconds: number | null;
  verification_attempts_remaining: number | null;
  created_at: number;
  updated_at: number;
  delete: boolean;
}

export interface ClerkOrganization {
  id: string;
  object: 'organization';
  name: string;
  slug: string | null;
  image_url: string;
  has_image: boolean;
  members_count: number;
  pending_invitations_count: number;
  admin_delete_enabled: boolean;
  max_allowed_memberships: number | null;
  created_at: number;
  updated_at: number;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  admin_metadata: Record<string, unknown>;
}

export interface ClerkOrganizationMembership {
  id: string;
  object: 'organization_membership';
  organization: ClerkOrganization;
  public_user_data: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    identifier: string;
  };
  role: string;
  permissions: string[];
  created_at: number;
  updated_at: number;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
}

export interface ClerkOrganizationInvitation {
  id: string;
  object: 'organization_invitation';
  email_address: string;
  organization: ClerkOrganization;
  role: string;
  status: 'pending' | 'accepted' | 'revoked';
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface ClerkWebhookEvent {
  object: 'event';
  type: ClerkWebhookEventType;
  data: {
    id: string;
    object: string;
    [key: string]: unknown;
  };
}

export interface ClerkUserEvent {
  object: 'event';
  type:
    | ClerkWebhookEventType.USER_CREATED
    | ClerkWebhookEventType.USER_UPDATED
    | ClerkWebhookEventType.USER_DELETED;
  data: ClerkUser;
}

export interface ClerkOrganizationEvent {
  object: 'event';
  type:
    | ClerkWebhookEventType.ORGANIZATION_CREATED
    | ClerkWebhookEventType.ORGANIZATION_UPDATED
    | ClerkWebhookEventType.ORGANIZATION_DELETED;
  data: ClerkOrganization;
}

export interface ClerkOrganizationMembershipEvent {
  object: 'event';
  type:
    | ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_CREATED
    | ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_UPDATED
    | ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_DELETED;
  data: ClerkOrganizationMembership;
}

export interface ClerkOrganizationInvitationEvent {
  object: 'event';
  type:
    | ClerkWebhookEventType.ORGANIZATION_INVITATION_CREATED
    | ClerkWebhookEventType.ORGANIZATION_INVITATION_ACCEPTED
    | ClerkWebhookEventType.ORGANIZATION_INVITATION_REVOKED;
  data: ClerkOrganizationInvitation;
}

export interface ClerkEmailAppData {
  domain_name?: string;
  logo_image_url?: string;
  logo_url?: string | null;
  name?: string;
  url?: string;
}

export interface ClerkEmailTheme {
  button_text_color?: string;
  primary_color?: string;
  show_clerk_branding?: boolean;
}

export interface ClerkEmailMetadata {
  app?: ClerkEmailAppData;
  otp_code?: string;
  verification_url?: string;
  reset_password_url?: string;
  magic_link_url?: string;
  invitation_url?: string;
  requested_at?: string;
  requested_by?: string;
  theme?: ClerkEmailTheme;
  organization?: {
    name?: string;
    slug?: string | null;
  };
  [key: string]: unknown;
}

export interface ClerkEmailEventData {
  id: string;
  object: 'email';
  slug: string;
  status: string;
  subject: string;
  body: string;
  body_plain?: string;
  to_email_address: string;
  email_address_id: string;
  user_id?: string;
  from_email_name?: string;
  delivered_by_clerk: boolean;
  data: ClerkEmailMetadata;
  event_attributes?: {
    http_request?: {
      client_ip?: string;
      user_agent?: string;
    };
    [key: string]: unknown;
  };
}

export interface ClerkEmailEvent {
  object: 'event';
  type: ClerkWebhookEventType.EMAIL_CREATED;
  data: ClerkEmailEventData;
  event_attributes?: {
    http_request?: {
      client_ip?: string;
      user_agent?: string;
    };
    [key: string]: unknown;
  };
}
