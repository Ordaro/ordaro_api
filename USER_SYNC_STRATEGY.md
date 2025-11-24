# User Sync Strategy for Clerk Integration

## Overview

This document explains the best approach for syncing users from Clerk to the database when they're created.

## The Problem

When a user is created in Clerk, we need to sync them to our database. However, our `User` model requires an `organizationId`, which might not be available immediately when a user is first created.

## Best Approach: Sync on Organization Membership

**The best place to sync users is when they get an organization membership** (`organizationMembership.created` webhook event).

### Why This Works Best:

1. ✅ **User has an organization** - Required field is available
2. ✅ **User has a role** - We know their role in the organization
3. ✅ **User has email** - Available in membership data
4. ✅ **Complete data** - All required fields are present

### Implementation

The `handleMembershipCreated` method in `clerk-webhook.controller.ts` now:

1. **Checks if user exists** - If not, creates them
2. **Updates if exists** - Updates organization, role, email, name if changed
3. **Maps Clerk roles** - Converts Clerk roles to our `UserRole` enum
4. **Handles errors gracefully** - Logs errors without breaking webhook processing

## Alternative: JIT Provisioning (Fallback)

If a user logs in before getting a membership webhook, the `ClerkStrategy` will:

1. Validate the JWT token
2. Check if user exists in database
3. If not, create user with organization from JWT claims
4. Sync branches and roles

This ensures users are always synced, even if webhooks are delayed.

## User Creation Flow

```
1. User signs up in Clerk
   └─> user.created webhook (logs only, doesn't create in DB)

2. User gets organization membership (via invite or org creation)
   └─> organizationMembership.created webhook
       └─> ✅ CREATE USER IN DATABASE (best time!)

3. User logs in
   └─> JIT provisioning in ClerkStrategy
       └─> ✅ CREATE/UPDATE USER (fallback if webhook missed)
```

## Database Migration Required

Before this works, you need to run the Prisma migration:

```bash
cd ordaro-api
npx prisma migrate dev
```

This will:

- Add `clerkUserId` column to `users` table
- Add `clerkOrgId` column to `organizations` table
- Update all related foreign keys

## Webhook Events Handled

1. **`user.created`** - Logs only (user doesn't have org yet)
2. **`user.updated`** - Updates user email, name, profile picture
3. **`user.deleted`** - Logs deletion (soft delete recommended)
4. **`organizationMembership.created`** - ✅ **CREATES USER** (best sync point)
5. **`organizationMembership.updated`** - Updates user role
6. **`organizationMembership.deleted`** - Handles user removal from org

## Testing

To test user sync:

1. Create a user in Clerk Dashboard
2. Add them to an organization
3. Check database - user should be created automatically
4. Or log in - JIT provisioning will create user if webhook missed

## Troubleshooting

### User not syncing?

1. Check webhook logs in Clerk Dashboard
2. Verify `CLERK_SIGNING_SECRET` is set correctly
3. Check backend logs for webhook processing errors
4. Verify database migration has been run

### User created but missing organization?

- This shouldn't happen with the new flow
- If it does, check that `organizationMembership.created` webhook is firing
- Fallback: User will be synced on first login via JIT provisioning

### Role not mapping correctly?

- Check `mapClerkRoleToUserRole` method
- Verify Clerk role names match expected values
- Defaults to `OWNER` if role is unknown
