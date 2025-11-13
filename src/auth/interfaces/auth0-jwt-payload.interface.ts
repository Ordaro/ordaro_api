export interface Auth0JwtPayload {
  sub: string; // auth0 user ID
  email?: string;
  name?: string;
  org_id?: string;
  aud?: string | string[]; // Audience
  iss?: string; // Issuer
  exp?: number; // Expiration time
  iat?: number; // Issued at
  [key: string]: unknown; // For custom claims
}
