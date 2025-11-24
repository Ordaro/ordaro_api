import type { UserRole } from '../enums/user-role.enum';

export interface UserPayload {
  clerkUserId: string;
  email: string;
  name?: string;
  organizationId?: string; // Optional to allow org creation flow
  role: UserRole;
  branchIds: string[];
  // Legacy support
  auth0Id?: string;
}
