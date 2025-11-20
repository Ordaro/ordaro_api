import { UnauthorizedException } from '@nestjs/common';

import type { UserPayload } from '../interfaces';

/**
 * Helper to ensure user has an organization
 * Throws UnauthorizedException if not
 */
export function requiresOrganization(
  user: UserPayload,
): asserts user is UserPayload & { organizationId: string } {
  console.log('user', user);
  if (!user.organizationId) {
    throw new UnauthorizedException(
      'You must create or join an organization first',
    );
  }
}
