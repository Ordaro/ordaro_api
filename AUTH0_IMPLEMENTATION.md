# Auth0 B2B Authentication Implementation - POS System

## 🎉 Implementation Complete!

This document describes the Auth0 authentication system that has been implemented for the Ordaro POS restaurant chain system.

## 📋 What Has Been Implemented

### 1. **Prisma Database Schema** ✅

- **Organization Model**: Stores restaurant chain information
- **Branch Model**: Individual restaurant locations
- **User Model**: Staff members with roles
- **UserBranch Model**: Many-to-many relationship for multi-branch assignments
- **UserRole Enum**: OWNER, MANAGER, WAITER, CHEF

### 2. **Auth Module** ✅

Complete authentication and authorization system:

#### **JWT Strategy (`src/auth/strategies/auth0.strategy.ts`)**

- Validates JWT tokens using Auth0's JWKS
- Extracts custom claims (org_id, role, branch_ids)
- Just-In-Time (JIT) user provisioning to database

#### **Guards**

- `Auth0Guard`: JWT authentication
- `RolesGuard`: Role-based access control
- `BranchGuard`: Branch-level access control

#### **Decorators**

- `@CurrentUser()`: Get authenticated user
- `@Roles(...)`: Require specific roles
- `@CurrentBranch()`: Extract branch ID from request

#### **Auth0 Management Service**

Handles all Auth0 Management API operations:

- Create organizations
- Add members to organizations
- Assign roles to users
- Create and revoke invitations
- Remove users
- Update user roles

#### **Auth Controller (`/auth`)**

- `GET /auth/me`: Get current user profile with branches
- `GET /auth/users/:userId/branches`: Internal endpoint for Auth0 Action (returns branch IDs)

### 3. **Organizations Module** ✅

#### **Endpoints**

- `POST /organizations`: Create new organization (assigns creator as Owner)
- `GET /organizations/:id`: Get organization details
- `PATCH /organizations/:id`: Update organization (Owner only)

#### **Features**

- Automatic Auth0 organization creation
- Owner role assignment to creator
- Slug generation from name
- Duplicate prevention

### 4. **Branches Module** ✅

#### **Endpoints**

- `POST /branches`: Create branch (Owner/Manager)
- `GET /branches`: List user's accessible branches
- `GET /branches/:id`: Get branch details
- `PATCH /branches/:id`: Update branch (Owner/Manager)
- `DELETE /branches/:id`: Soft delete branch (Owner only)

#### **Features**

- Auto-assignment of Manager to created branch
- Role-based branch visibility (Owners see all, others see assigned)
- Unique branch names per organization

### 5. **Users Module** ✅

#### **Endpoints**

- `POST /users/invitations`: Invite user to branch with role
- `GET /users`: List organization members with branches
- `PATCH /users/:userId/branches`: Update user's branch assignments
- `DELETE /users/:userId`: Remove user from organization

#### **Features**

- Role-based invitation restrictions (Managers can only invite Waiters/Chefs)
- Auth0 invitation creation
- Branch assignment management
- Prevents self-removal

### 6. **Configuration** ✅

- Auth0 configuration in `src/config/configuration.ts`
- Environment validation in `src/config/environment.validation.ts`
- See `env.example.txt` for all required variables

## 🚀 Next Steps - Auth0 Setup

### Step 1: Complete Auth0 Configuration

#### A. Get M2M App Credentials

1. Go to **Auth0 Dashboard → Applications → Applications**
2. Find `ordaro_api (Test Application)`
3. Copy the **Client Secret**
4. Go to **Applications → APIs → Auth0 Management API → Machine to Machine Applications**
5. Find `ordaro_api` and authorize with these permissions:
   - `read:organizations`, `create:organizations`, `update:organizations`
   - `read:organization_members`, `create:organization_members`, `delete:organization_members`
   - `read:organization_member_roles`, `create:organization_member_roles`, `delete:organization_member_roles`
   - `create:organization_invitations`, `read:organization_invitations`, `delete:organization_invitations`
   - `read:roles`, `read:users`, `update:users`

#### B. Create Roles

1. Go to **User Management → Roles**
2. Create 4 roles:
   - **Owner**: "Restaurant chain owner with full system access"
   - **Manager**: "Branch manager responsible for daily operations"
   - **Waiter**: "Front-of-house staff member"
   - **Chef**: "Kitchen staff member"
3. Note each Role ID (e.g., `rol_xyz123`)

#### C. Deploy Auth0 Action

1. Go to **Actions → Flows → Login**
2. Create a new Action: **Add Branch Claims to Token**
3. Paste this code:

\`\`\`javascript
exports.onExecutePostLogin = async (event, api) => {
const namespace = event.secrets.CUSTOM_CLAIMS_NAMESPACE;

if (!event.organization) return;

// Add organization role to token
if (event.authorization?.roles) {
api.idToken.setCustomClaim(\`\${namespace}/role\`, event.authorization.roles[0]);
api.accessToken.setCustomClaim(\`\${namespace}/role\`, event.authorization.roles[0]);
}

// Fetch user's branch assignments from your API
const axios = require("axios");

try {
const response = await axios.get(
\`\${event.secrets.API_BASE_URL}/api/auth/users/\${event.user.user_id}/branches\`,
{ headers: { Authorization: \`Bearer \${event.secrets.API_INTERNAL_TOKEN}\` } }
);

    const branchIds = response.data.branchIds || [];
    api.idToken.setCustomClaim(\`\${namespace}/branch_ids\`, branchIds);
    api.accessToken.setCustomClaim(\`\${namespace}/branch_ids\`, branchIds);

} catch (error) {
console.error("Failed to fetch branch assignments", error);
}
};
\`\`\`

4. Add Dependencies: `axios`
5. Add Secrets:
   - `CUSTOM_CLAIMS_NAMESPACE`: `https://chainpos.live`
   - `API_BASE_URL`: Your API URL (e.g., `http://localhost:4000` for dev)
   - `API_INTERNAL_TOKEN`: Generate a secure random string
6. Deploy the action
7. Add it to the Login flow

### Step 2: Configure Environment Variables

1. Copy `env.example.txt` to `.env.development`
2. Fill in the Auth0 values:
   - `AUTH0_MANAGEMENT_CLIENT_ID`: From Step 1A
   - `AUTH0_MANAGEMENT_CLIENT_SECRET`: From Step 1A
   - `AUTH0_OWNER_ROLE_ID`: From Step 1B
   - `AUTH0_MANAGER_ROLE_ID`: From Step 1B
   - `AUTH0_WAITER_ROLE_ID`: From Step 1B
   - `AUTH0_CHEF_ROLE_ID`: From Step 1B
   - `API_INTERNAL_TOKEN`: Same as Auth0 Action secret from Step 1C
3. Configure database URL and other services

### Step 3: Run Database Migrations

\`\`\`bash

# Generate Prisma client (already done)

pnpm db:generate

# Push schema to database

pnpm db:push

# Or create a migration

pnpm db:migrate
\`\`\`

### Step 4: Start the API

\`\`\`bash
pnpm start:dev
\`\`\`

The API will run on `http://localhost:4000` (or your configured PORT).

## 📡 API Endpoints

### Authentication

- `GET /api/auth/me` - Get current user profile

### Organizations

- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization
- `PATCH /api/organizations/:id` - Update organization (Owner)

### Branches

- `POST /api/branches` - Create branch (Owner/Manager)
- `GET /api/branches` - List accessible branches
- `GET /api/branches/:id` - Get branch details
- `PATCH /api/branches/:id` - Update branch (Owner/Manager)
- `DELETE /api/branches/:id` - Delete branch (Owner)

### Users

- `POST /api/users/invitations` - Invite user to branch
- `GET /api/users` - List organization members
- `PATCH /api/users/:userId/branches` - Update branch assignments
- `DELETE /api/users/:userId` - Remove user (Owner)

## 🔐 Authorization Patterns

### Role-Based Access

\`\`\`typescript
// Owner only
@UseGuards(Auth0Guard, RolesGuard)
@Roles(UserRole.OWNER)
@Post()
createOrganization() {}

// Owner or Manager
@UseGuards(Auth0Guard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
@Post('branches')
createBranch() {}
\`\`\`

### Branch-Based Access

\`\`\`typescript
@UseGuards(Auth0Guard, BranchGuard)
@Get('branches/:branchId/orders')
getOrders(@Param('branchId') branchId: string) {}
// Owners: access all branches
// Others: only assigned branches
\`\`\`

## 🔄 Typical User Flows

### Organization Creation

1. User signs up via Auth0 Universal Login
2. User gets JWT token
3. User calls `POST /api/organizations { name: "Pizza Palace" }`
4. API creates Auth0 org + Prisma org + assigns Owner role
5. User logs out and back in → JWT now includes org_id + owner role

### Staff Invitation

1. Owner calls `POST /api/users/invitations { email, role: "WAITER", branchId }`
2. API creates Auth0 invitation
3. Invitee receives email → accepts
4. Invitee logs in → JWT includes role + branch_ids

### Multi-Branch Login

1. User logs in → JWT contains `branch_ids: ["branch_1", "branch_2"]`
2. Frontend calls `GET /api/auth/me`
3. If multiple branches → show branch selector
4. User selects branch → frontend uses in requests

## 🎨 Frontend Integration

### Authentication

Use Auth0 SPA SDK (`@auth0/auth0-react` or `@auth0/auth0-spa-js`):

\`\`\`typescript
// Initialize Auth0
const auth0 = createAuth0Client({
domain: 'auth.chainpos.live',
clientId: 'your-spa-client-id',
authorizationParams: {
audience: 'https://api.chainpos.live',
redirect_uri: window.location.origin
}
});

// Login
await auth0.loginWithRedirect();

// Get access token
const token = await auth0.getAccessTokenSilently();

// Call API
fetch('http://localhost:4000/api/auth/me', {
headers: { Authorization: \`Bearer \${token}\` }
});
\`\`\`

### Branch Context

\`\`\`typescript
// After login, get user with branches
const user = await fetch('/api/auth/me', {
headers: { Authorization: \`Bearer \${token}\` }
}).then(res => res.json());

// If user has multiple branches
if (user.branches.length > 1) {
// Show branch selector UI
const selectedBranch = await showBranchSelector(user.branches);
// Store in context/state
setBranchId(selectedBranch.id);
}

// Include in API requests
fetch(\`/api/branches/\${branchId}/orders\`, {
headers: {
Authorization: \`Bearer \${token}\`,
'X-Branch-Id': branchId
}
});
\`\`\`

## 🐛 Troubleshooting

### JWT Validation Fails

- Check `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER_URL` match your Auth0 configuration
- Ensure JWKS endpoint is accessible: `https://auth.chainpos.live/.well-known/jwks.json`

### User Not Synced to Database

- Check Auth0Strategy logs for JIT provisioning errors
- Ensure organization exists in Prisma before user login

### Branch IDs Not in JWT

- Verify Auth0 Action is deployed and added to Login flow
- Check Action logs in Auth0 dashboard
- Ensure API_INTERNAL_TOKEN matches between .env and Auth0 Action

### M2M API Calls Fail

- Verify M2M app has correct permissions
- Check CLIENT_ID and CLIENT_SECRET are correct
- Ensure `AUTH0_MANAGEMENT_AUDIENCE` ends with `/api/v2/`

## 📚 Additional Resources

- [Auth0 Organizations Documentation](https://auth0.com/docs/manage-users/organizations)
- [Auth0 Actions Documentation](https://auth0.com/docs/customize/actions)
- [NestJS Passport Documentation](https://docs.nestjs.com/security/authentication)
- [Prisma Documentation](https://www.prisma.io/docs/)

## ✅ Testing Checklist

- [ ] Auth0 roles created and role IDs configured
- [ ] M2M app authorized with Management API permissions
- [ ] Auth0 Action deployed and added to Login flow
- [ ] Environment variables configured in `.env.development`
- [ ] Database migrated with Prisma
- [ ] API starts without errors
- [ ] Can create organization
- [ ] Owner role assigned correctly
- [ ] Can create branch
- [ ] Can invite users
- [ ] JWT contains org_id, role, branch_ids
- [ ] Branch guard works correctly
- [ ] Multi-branch users can access assigned branches only

---

**Implementation completed on:** $(Get-Date -Format "yyyy-MM-dd")

**Next:** Complete Auth0 setup following steps above, then test the authentication flow!
