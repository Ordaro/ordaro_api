export interface ClerkJwtPayload {
  sub: string; // Clerk user ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  org_id?: string; // Organization ID from Clerk
  org_role?: string; // Role in organization (e.g., "org:admin", "org:member")
  org_slug?: string; // Organization slug
  org_permissions?: string[]; // Organization permissions
  aud?: string | string[]; // Audience
  iss?: string; // Issuer
  exp?: number; // Expiration time
  iat?: number; // Issued at
  [key: string]: unknown; // For custom claims (branch_ids, etc.)
}
