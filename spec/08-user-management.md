# v2 — User Management Specification

This document defines the user management engine: role model, lifecycle flows, SSO auto-provisioning, coordinator group scoping, and permission boundaries.

Cross-references:
- [02-data-model.md](02-data-model.md) — `users`, `groups`, `user_groups`, `coordinator_group_assignments`, `sso_providers`
- [04-api-spec.md §9](04-api-spec.md#9-users-admin) — User CRUD and group endpoints
- [07-system-config.md §3](07-system-config.md#3-sso-configuration) — SSO provider configuration

---

## 1. Role Model

### 1.1 Global Roles

Every user has one or more global roles stored in `users.roles TEXT[]`. The four built-in roles are:

| Role constant | Abbreviation | Display label | Purpose |
|---|---|---|---|
| `admin` | ADM | Administrator | Full system access; user administration; system configuration |
| `coordinator` | CRD | Coordinator | Manages submissions for their assigned user groups; assigns reviewers |
| `reviewer` | RVW | Reviewer | Reviews assigned submissions; issues decisions |
| `student` | STU | Student / Researcher | Submits work; views own submissions and decisions |

**Multi-role:** A single user may hold multiple roles simultaneously (e.g. a faculty member who is both `coordinator` and `reviewer`). Permissions are the **union** of all assigned roles.

**Stage-level labels** (Chair, Committee Member, IRB Reviewer, etc.) are configured in `stage_definitions.stage_role_label`. They are display labels only and are **not** global roles. Any user with `reviewer` may be assigned to any stage regardless of its label.

---

### 1.2 Permission Matrix

The table below defines what each role can do at the global API level. Row = capability, column = role. ✅ = allowed, ❌ = blocked (403), `own` = only their own records.

| Capability | ADM | CRD | RVW | STU |
|---|---|---|---|---|
| **Submissions** | | | | |
| View all submissions | ✅ | group-scoped ¹ | ✅ assigned only | own only |
| Create submission | ✅ | ✅ | ✅ | ✅ |
| Edit / version submission | ✅ | ✅ | ❌ | own + `DRAFT`/`REVISION_REQUIRED` |
| Delete / cancel submission | ✅ | group-scoped | ❌ | own + `DRAFT` only |
| **Reviewer Assignment** | | | | |
| Assign reviewer to stage | ✅ | group-scoped | ❌ | ❌ |
| View reviewer pool | ✅ | ✅ | ❌ | ❌ |
| Manage reviewer pool | ✅ | ✅ | ❌ | ❌ |
| **Review Decisions** | | | | |
| Issue decision on assigned stage | ✅ | ❌ | ✅ assigned | ❌ |
| View decisions (per visibility config) | ✅ | ✅ | own | per stage config |
| **Gated Releases** | | | | |
| Issue gated release decision | ✅ | ❌ | ✅ (gatekeeper role) | ❌ |
| **User Administration** | | | | |
| View user list | ✅ | ❌ ² | ❌ | ❌ |
| Create / invite user | ✅ | ❌ | ❌ | ❌ |
| Edit user roles / groups | ✅ | ❌ | ❌ | ❌ |
| Deactivate / reactivate user | ✅ | ❌ | ❌ | ❌ |
| Reset user password | ✅ | ❌ | ❌ | ❌ |
| Unlock locked account | ✅ | ❌ | ❌ | ❌ |
| View / manage groups | ✅ | ❌ | ❌ | ❌ |
| **Programs** | | | | |
| View programs | ✅ | ✅ | ❌ | ❌ |
| Create / edit programs | ✅ | ✅ | ❌ | ❌ |
| **System Configuration** | | | | |
| All system config (SSO, email, etc.) | ✅ | ❌ | ❌ | ❌ |
| **Analytics / Audit** | | | | |
| Analytics dashboard | ✅ | ✅ (group-scoped) | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |

> ¹ **Group-scoped**: Coordinator sees only submissions where `submitter.user_groups` intersects their own `coordinator_group_assignments`. See §3.  
> ² Coordinators do **not** have access to the `/admin/users` management interface. They can see the list of users **within their groups** only through `GET /groups/{id}/members` for the purpose of reviewer assignment lookup.

---

## 2. User Lifecycle

### 2.1 Provisioning Methods

A user account can be created in four ways:

| Method | Flow | Default role | Requires password |
|---|---|---|---|
| **Admin-created** | Admin fills create-user form → account active immediately | configurable | Yes (or invite email to set) |
| **Admin-invited** | Admin sends invite email → user clicks link → sets password | configurable | Set on first login |
| **SSO auto-provisioned** | User logs in via SSO and no local account exists → auto-created | per SSO provider config | No (SSO-only) |
| **Public self-registered** | User visits `/register` (requires `enable_public_registration = true`) | `organization_settings.public_submission_default_role` | Yes |

---

### 2.2 Admin-Created User Flow

```
Admin → POST /users (name, email, password, roles[], group_ids[])
  ├── Validation: email unique, password meets policy, roles valid
  ├── User created with is_active = true
  ├── User added to specified groups (user_groups rows inserted)
  ├── Welcome email sent (notification template: user_created)
  └── Audit log: user_created
```

---

### 2.3 Admin-Invite Flow

```
Admin → POST /users/invite (name, email, roles[], group_ids[])
  ├── User created with is_active = false, password_hash = null
  ├── invite_token generated (SHA-256, 64 hex chars)
  ├── invite_token_expires_at = now() + 72 hours
  ├── Invite email sent with link: {APP_URL}/accept-invite?token={invite_token}
  └── Audit log: user_invited

User → clicks link → GET /auth/accept-invite?token={invite_token}
  ├── Token valid and not expired → redirect to set-password form
  ├── POST /auth/accept-invite { token, password, password_confirmation }
  ├── Password set, is_active = true, invite_token cleared
  └── Audit log: user_invite_accepted
```

Expired invite: Admin can resend via `POST /users/{id}/resend-invite`. This regenerates the token and extends expiry 72 hours.

---

### 2.4 SSO Auto-Provisioning Flow

Defined fully in §4. Summary:

```
SSO Login attempt
  ├── Email matches existing user → link SSO identity, log in
  ├── No match + auto_provision_users = true → create user, assign default group/role
  └── No match + auto_provision_users = false → reject (403 + "Account not found" message)
```

---

### 2.5 User Deactivation

- `PATCH /users/{id}` with `{ "is_active": false }` — soft deactivate
- Deactivated users cannot log in (401)
- Existing sessions/tokens invalidated immediately (Sanctum token purge)
- Submissions remain visible; audit records preserved
- Reactivated by setting `is_active = true` — user must log in again

---

## 3. Coordinator Group Scoping

### 3.1 Concept

A coordinator's **visibility scope** is determined entirely by which groups they are assigned to coordinate. This is stored in a dedicated table `coordinator_group_assignments` (separate from `user_groups`, which is the table of which users *belong to* a group).

```
coordinator_group_assignments
  coordinator_id  → users.id  (must have role 'coordinator')
  group_id        → groups.id
  assigned_at     TIMESTAMPTZ
  assigned_by     → users.id  (admin who made the assignment)
```

A coordinator can be assigned to **multiple groups**. Their scope is the union of all their assigned groups.

---

### 3.2 Scope Filtering Rule

When a coordinator calls any scoped endpoint, the API applies:

```sql
-- Submissions visible to coordinator with ID :crd_id
SELECT s.*
FROM submissions s
JOIN user_groups ug ON ug.user_id = s.submitter_id
WHERE ug.group_id IN (
    SELECT group_id FROM coordinator_group_assignments WHERE coordinator_id = :crd_id
)
```

This filter applies to:
- `GET /submissions` (submission list)
- `GET /submissions/{id}` (single submission — 404 if out of scope)
- `POST /stages/{id}/assign` (reviewer assignment — 403 if submission out of scope)
- `GET /admin/analytics` (statistics scoped to visible submissions only)

---

### 3.3 Groups vs Coordinator Assignments

Two distinct concepts:

| Concept | Table | Meaning |
|---|---|---|
| User's group membership | `user_groups` | The group(s) a user (student/researcher) belongs to |
| Coordinator's scope | `coordinator_group_assignments` | The group(s) a coordinator is responsible for managing |

A coordinator can be assigned to manage groups they do not themselves belong to. A student in Group A is visible to any coordinator who has a `coordinator_group_assignments` row for Group A.

---

### 3.4 Coordinator Permitted Actions (Summary)

| Action | Allowed | Constraint |
|---|---|---|
| View submissions | ✅ | Group-scoped only |
| Filter/search submissions | ✅ | Within scoped results |
| Assign reviewer to stage | ✅ | Submission must be in scope |
| Remove reviewer assignment | ✅ | Submission must be in scope |
| Manage reviewer pool | ✅ | Global (not group-scoped) |
| View programs | ✅ | All programs |
| Create/edit programs | ✅ | All programs |
| View analytics | ✅ | Group-scoped metrics |
| View user list (admin) | ❌ | Admin-only |
| Create/edit/deactivate users | ❌ | Admin-only |
| Manage groups | ❌ | Admin-only |
| System configuration | ❌ | Admin-only |
| Audit log | ❌ | Admin-only |

---

### 3.5 Unassigned Coordinator

A coordinator with **no entries** in `coordinator_group_assignments` sees **zero submissions**. This is intentional — an improperly configured coordinator has no access rather than accidental broad access.

The admin dashboard shows a warning badge on coordinators with no group assignments.

---

## 4. SSO Auto-Provisioning

### 4.1 Configuration

SSO providers are configured in the `sso_providers` table (one row per provider). Each provider has its own auto-provisioning settings:

| Field | Type | Default | Notes |
|---|---|---|---|
| `auto_provision_users` | boolean | `false` | If true: create account automatically on first SSO login |
| `default_role` | string | `student` | Role assigned to auto-provisioned users |
| `default_group_id` | UUID | null | Group that auto-provisioned users are added to |
| `provision_name_claim` | string | `name` | JWT/SAML claim to use as display name |
| `provision_email_claim` | string | `email` | JWT/SAML claim to use as email |

These are configured via `PATCH /system/sso/{id}` (Admin only).

---

### 4.2 Login Decision Tree

```
User submits SSO callback (SAML assertion or OIDC token)
│
├── Extract email from claim (provision_email_claim)
│
├── CASE: email matches existing user (users.email)
│   ├── user.is_active = false → 401 "Account deactivated"
│   └── user.is_active = true → link sso_identity if not yet linked → log in
│
├── CASE: email not found + auto_provision_users = false
│   └── 403 "Account not found. Contact your administrator."
│
└── CASE: email not found + auto_provision_users = true
    ├── Validate: default_group_id must be set (else: 500 + admin alert)
    ├── Create user:
    │   ├── email from claim
    │   ├── name from provision_name_claim (fallback: email prefix)
    │   ├── password_hash = null (SSO-only; cannot use local login)
    │   ├── roles = [default_role]
    │   ├── is_active = true
    │   └── sso_only = true
    ├── Add to default_group_id (insert into user_groups)
    ├── Audit log: user_sso_provisioned
    ├── Notification: welcome email (template: user_sso_provisioned)
    └── Issue Sanctum token → log in
```

---

### 4.3 SSO Identity Linking

The `sso_identities` table links a local user to their external identity:

```sql
CREATE TABLE sso_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id     UUID NOT NULL REFERENCES sso_providers(id),
    external_id     VARCHAR(512) NOT NULL,  -- subject/nameID from IdP
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ,
    UNIQUE (provider_id, external_id)
);
```

On every SSO login, `last_login_at` is updated.

---

### 4.4 SSO-Only Users

Users created via SSO auto-provisioning have `password_hash = null`. They:
- Cannot log in via the local password form (rejected with "Please use SSO login")
- Cannot reset their password
- Can have their account deactivated by an admin
- Can be merged with an existing local account by an admin via `POST /users/{id}/link-sso`

---

### 4.5 Configurable Auto-Provisioning Checklist

Before enabling `auto_provision_users` on a provider, the admin must configure:

| Required setting | Where | Consequence if missing |
|---|---|---|
| `default_group_id` | `sso_providers.default_group_id` | Provisioning fails — user sees 500 error |
| `default_role` | `sso_providers.default_role` | Defaults to `student` (safe) |
| Group must exist | `groups` table | Provisioning fails if group was deleted |

The System Configuration UI enforces this with inline validation: the "Save" button for SSO is disabled if `auto_provision_users = true` and `default_group_id` is null.

---

## 5. Group Management

### 5.1 Groups

Groups are organizational units (departments, faculties, cohorts) used to:
1. Scope coordinator visibility (§3)
2. Bucket public registrants and SSO-provisioned users into the right department
3. Optionally link programs to a department

```sql
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 5.2 User–Group Membership

```sql
CREATE TABLE user_groups (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, group_id)
);
```

A user may belong to multiple groups. Group membership is managed exclusively by admins.

---

### 5.3 Coordinator–Group Scope Assignment

```sql
CREATE TABLE coordinator_group_assignments (
    coordinator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (coordinator_id, group_id)
);
```

Managed via `POST /users/{id}/coordinator-groups` and `DELETE /users/{id}/coordinator-groups/{group_id}`.

---

## 6. Admin User Management Operations

All operations in this section require the `admin` role. Coordinator role is **explicitly blocked** even if they somehow reach these endpoints.

### 6.1 Create User

`POST /users`

```json
{
  "email": "john.doe@university.edu",
  "name": "John Doe",
  "password": "SecurePass1!",
  "roles": ["student"],
  "group_ids": ["uuid-of-group"],
  "program_id": "uuid-or-null",
  "send_welcome_email": true
}
```

Response `201` with created user. Password must satisfy the global `password_policy`.

---

### 6.2 Invite User

`POST /users/invite`

```json
{
  "email": "jane.smith@university.edu",
  "name": "Jane Smith",
  "roles": ["reviewer"],
  "group_ids": [],
  "program_id": null
}
```

Response `201`. Sends invite email with 72-hour expiry link. User is `is_active = false` until they accept.

---

### 6.3 Edit User

`PATCH /users/{id}`

Editable fields:

| Field | Notes |
|---|---|
| `name` | Display name |
| `roles` | Full replacement array — must include at least one valid role |
| `program_id` | May be set to null |
| `is_active` | Set false to deactivate; true to reactivate |

---

### 6.4 Group Membership Management

`POST /users/{id}/groups` — add user to groups  
`DELETE /users/{id}/groups/{group_id}` — remove user from group  
`GET /users/{id}/groups` — list user's current groups

---

### 6.5 Coordinator Scope Management

`POST /users/{id}/coordinator-groups` — assign group to coordinator's scope  
`DELETE /users/{id}/coordinator-groups/{group_id}` — remove group from coordinator's scope  
`GET /users/{id}/coordinator-groups` — list coordinator's scoped groups

Only valid when `users.roles` contains `coordinator`. Returns `422` otherwise.

---

### 6.6 Password Reset (Admin)

`POST /users/{id}/reset-password`

```json
{ "new_password": "NewSecurePass1!" }
```

Admin can reset any local (non-SSO-only) user's password. The user's existing Sanctum tokens are invalidated, forcing re-login.

---

### 6.7 Account Unlock

`POST /users/{id}/unlock`

Clears the Redis lockout key `login_attempts:{email}:{ip}` for all IPs. Used when a user is locked out due to failed login attempts.

---

### 6.8 Resend Invite

`POST /users/{id}/resend-invite`

Regenerates `invite_token` and `invite_token_expires_at` (+72h). Sends invite email again. Only valid for users with `is_active = false` and a null `password_hash`.

---

### 6.9 Link SSO Identity (Manual)

`POST /users/{id}/link-sso`

```json
{
  "provider_id": "uuid-of-sso-provider",
  "external_id": "nameID-or-subject-from-idp"
}
```

Manually links an existing local user to an external SSO identity. Useful when migrating from local accounts to SSO after initial setup.

---

## 7. User Profile (Self-Service)

These endpoints are available to the authenticated user for their own account.

| Endpoint | Description |
|---|---|
| `GET /auth/me` | Current user profile + roles + group memberships |
| `PATCH /auth/profile` | Update own name only (email/role changes require admin) |
| `PATCH /auth/password` | Change own password (requires current password; policy enforced) |
| `POST /auth/2fa/enable` | Initiate TOTP 2FA setup |
| `POST /auth/2fa/verify` | Confirm TOTP code and activate 2FA |
| `GET /auth/2fa/recovery-codes` | Show remaining recovery codes |
| `POST /auth/2fa/regenerate` | Re-generate recovery codes (invalidates old ones) |

---

## 8. User List & Search (Admin)

`GET /users`

Query parameters:

| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text on name/email |
| `role` | string | Filter by role (`admin`, `coordinator`, `reviewer`, `student`) |
| `group_id` | UUID | Filter by group membership |
| `is_active` | boolean | Filter active/deactivated |
| `has_sso` | boolean | Filter SSO-linked vs local-only |
| `no_coordinator_groups` | boolean | Show coordinators with no group assignments (admin warning) |
| `per_page` | int | Default 25, max 100 |
| `sort` | string | `name`, `email`, `last_login_at`, `created_at` |
| `order` | string | `asc` (default) \| `desc` |

Response: paginated list of users with:
- `id`, `name`, `email`, `roles`, `is_active`, `last_login_at`
- `groups[]` — group memberships
- `coordinator_groups[]` — scope assignments (only when `roles` contains `coordinator`)
- `sso_linked` — boolean
- `is_sso_only` — boolean (no local password)

---

## 9. Audit Trail for User Events

All user management actions are written to `audit_logs`. User-related event types:

| Event | Trigger |
|---|---|
| `user_created` | Admin creates user |
| `user_invited` | Admin sends invite |
| `user_invite_accepted` | User sets password via invite link |
| `user_sso_provisioned` | SSO auto-creates account |
| `user_sso_linked` | Admin manually links SSO identity |
| `user_updated` | Admin edits name/roles |
| `user_deactivated` | Admin sets `is_active = false` |
| `user_reactivated` | Admin sets `is_active = true` |
| `user_password_reset` | Admin resets password |
| `user_unlocked` | Admin clears lockout |
| `user_group_added` | User added to group |
| `user_group_removed` | User removed from group |
| `coordinator_group_assigned` | Coordinator assigned to group scope |
| `coordinator_group_removed` | Coordinator scope removed |
| `user_login` | Successful login (any method) |
| `user_login_failed` | Failed login attempt |
| `user_locked` | Account locked after max attempts |
| `user_2fa_enabled` | User activates TOTP |
| `user_2fa_disabled` | Admin or user disables TOTP |

---

## 10. Implementation Notes

### 10.1 Policy Classes

Each permission check is implemented as a Laravel Policy:

| Policy class | Model | Key methods |
|---|---|---|
| `SubmissionPolicy` | `Submission` | `view()` — enforces coordinator group scope filter |
| `UserPolicy` | `User` | `viewAny()`, `create()`, `update()`, `delete()` — admin-only |
| `GroupPolicy` | `Group` | `viewAny()`, `manageMembers()` — admin-only |
| `CoordinatorScopePolicy` | — | `manageCoordinatorGroups()` — admin-only |

### 10.2 Coordinator Scope as Query Scope

Implement as an Eloquent global scope injected by middleware:

```php
// App\Http\Middleware\ApplyCoordinatorScope
if ($user->hasRole('coordinator') && !$user->hasRole('admin')) {
    Submission::addGlobalScope(new CoordinatorGroupScope($user));
}
```

`CoordinatorGroupScope` adds the JOIN to `user_groups` and `coordinator_group_assignments` described in §3.2. This ensures the scope is applied consistently across all query paths without per-controller boilerplate.

### 10.3 SSO Provider Driver Pattern

SSO providers are implemented as driver classes behind a `SsoProviderInterface`:

```php
interface SsoProviderInterface {
    public function buildRedirectUrl(): string;
    public function handleCallback(Request $request): SsoUserData;
}
```

Implementations: `SamlProviderDriver`, `OidcProviderDriver`. The `SsoUserData` DTO carries `email`, `name`, `external_id`. The `SsoAuthController` receives this DTO and applies the decision tree from §4.2.

### 10.4 Migrations Required

New migrations needed for this spec:

| Migration | Changes |
|---|---|
| `add_sso_fields_to_users` | Add `sso_only BOOLEAN DEFAULT false` |
| `create_sso_identities_table` | Full table per §4.3 |
| `create_coordinator_group_assignments_table` | Full table per §5.3 |
| `add_auto_provision_fields_to_sso_providers` | Add `auto_provision_users`, `default_role`, `default_group_id`, `provision_name_claim`, `provision_email_claim` |
| `add_invite_fields_to_users` | Add `invite_token`, `invite_token_expires_at` |
