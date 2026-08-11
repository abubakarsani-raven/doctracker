/**
 * Frontend permission helpers.
 *
 * The role -> capability mapping deliberately does NOT live here. The API
 * resolves it and ships the result on the session (`user.permissions`), so the
 * UI and the server can never disagree about what a role can do. This file only
 * reads that answer and turns it into something a component can render.
 *
 * Anything here decides what the interface *shows*. It is not a security
 * boundary — the API enforces the same rules again on every request.
 */

// ---------------------------------------------------------------------------
// Types — mirrors backend/src/permissions/capabilities.ts
// ---------------------------------------------------------------------------

export const CAPABILITIES = [
  'documents.view',
  'documents.create',
  'documents.edit',
  'documents.delete',
  'documents.share',
  'documents.manage_permissions',
  'documents.sign',
  'documents.request_signature',
  'folders.create',
  'folders.edit',
  'folders.delete',
  'folders.manage_permissions',
  'workflows.view',
  'workflows.create',
  'workflows.edit',
  'workflows.delete',
  'workflows.assign',
  'actions.assign',
  'actions.complete',
  'approvals.review',
  'access_requests.create',
  'access_requests.review',
  'users.view',
  'users.manage',
  'companies.view_all',
  'companies.manage',
  'reports.view',
  'storage.view',
  'activity.view_all',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type DataScope = 'all' | 'company' | 'department' | 'division' | 'own';

export type ResourceScopeLevel = 'company' | 'department' | 'division';

export type ResourcePermission =
  | 'read'
  | 'write'
  | 'delete'
  | 'share'
  | 'manage';

export interface EffectivePermissions {
  role: string;
  roles: string[];
  dataScope: DataScope;
  capabilities: Capability[];
  canAssignDocuments: boolean;
  companyId: string | null;
  departmentIds: string[];
  divisionIds: string[];
}

export type SubjectType = 'user' | 'department' | 'division';

/**
 * One entry in a folder's or document's access-control list.
 *
 * An entry names a person, a department or a division. `userId` mirrors
 * `subjectId` for user entries so older callers keep working.
 */
export interface AclEntry {
  subjectType: SubjectType;
  subjectId: string;
  userId?: string;
  subjectName?: string;
  permissions: ResourcePermission[];
  effect?: 'allow' | 'deny';
  grantedBy?: string;
  grantedAt?: string;
}

const DATA_SCOPE_RANK: Record<DataScope, number> = {
  all: 4,
  company: 3,
  department: 2,
  division: 1,
  own: 0,
};

/**
 * What a signed-in user with no resolved permissions can do: nothing. Used
 * while the session is still loading so the UI starts locked down and opens up,
 * rather than flashing controls the user cannot actually use.
 */
export const NO_PERMISSIONS: EffectivePermissions = {
  role: 'Unknown',
  roles: [],
  dataScope: 'own',
  capabilities: [],
  canAssignDocuments: false,
  companyId: null,
  departmentIds: [],
  divisionIds: [],
};

// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

/**
 * Pull effective permissions off a user object.
 *
 * Older sessions (and any endpoint that has not been updated) return a bare
 * `role` string with no `permissions` block. Rather than guessing at
 * capabilities from the role name — the drift this module exists to prevent —
 * such a session is treated as having none, and the UI falls back to asking the
 * API. Signing in again produces a full session.
 */
export function getPermissions(user: any): EffectivePermissions {
  const raw = user?.permissions;
  if (!raw || !Array.isArray(raw.capabilities)) {
    return { ...NO_PERMISSIONS, role: user?.role ?? NO_PERMISSIONS.role };
  }

  return {
    role: raw.role ?? user?.role ?? 'Unknown',
    roles: raw.roles ?? [],
    dataScope: raw.dataScope ?? 'own',
    capabilities: raw.capabilities,
    canAssignDocuments: !!raw.canAssignDocuments,
    companyId: raw.companyId ?? user?.companyId ?? null,
    departmentIds: raw.departmentIds ?? [],
    divisionIds: raw.divisionIds ?? [],
  };
}

export function can(user: any, capability: Capability): boolean {
  return getPermissions(user).capabilities.includes(capability);
}

/** True when the user holds every one of the given capabilities. */
export function canAll(user: any, ...capabilities: Capability[]): boolean {
  const held = getPermissions(user).capabilities;
  return capabilities.every((capability) => held.includes(capability));
}

/** True when the user holds at least one of the given capabilities. */
export function canAny(user: any, ...capabilities: Capability[]): boolean {
  const held = getPermissions(user).capabilities;
  return capabilities.some((capability) => held.includes(capability));
}

/** Whether the user's reach spans every company on the instance. */
export function seesAllCompanies(user: any): boolean {
  return getPermissions(user).dataScope === 'all';
}

// ---------------------------------------------------------------------------
// Resource access
// ---------------------------------------------------------------------------

/** The subset of a folder or document this module needs to make a decision. */
export interface ScopedResource {
  /**
   * The server's decision, when the endpoint provides one. Always preferred:
   * the client-side rules below are a mirror for rendering, and the server is
   * the authority.
   */
  access?: { canRead?: boolean; reason?: string } | null;
  companyId?: string | null;
  scopeLevel?: string | null;
  /** Some endpoints still return the legacy `scope` field. */
  scope?: string | null;
  departmentId?: string | null;
  divisionId?: string | null;
  createdBy?: string | null;
  permissionsJson?: unknown;
}

/** Normalise whatever shape `permissionsJson` arrives in into ACL entries. */
export function parseAcl(raw: unknown): AclEntry[] {
  if (!raw) return [];

  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((raw: any) => {
      if (!raw) return [];
      const subjectId =
        typeof raw.subjectId === 'string'
          ? raw.subjectId
          : typeof raw.userId === 'string'
            ? raw.userId
            : null;
      if (!subjectId) return [];

      const subjectType: SubjectType =
        raw.subjectType === 'department' || raw.subjectType === 'division'
          ? raw.subjectType
          : 'user';

      return [
        {
          ...raw,
          subjectType,
          subjectId,
          ...(subjectType === 'user' ? { userId: subjectId } : {}),
          permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
          effect: raw.effect === 'deny' ? 'deny' : 'allow',
        } as AclEntry,
      ];
    });
  }

  // Legacy `{ denied: [userId] }` shape.
  if (typeof value === 'object' && Array.isArray((value as any).denied)) {
    return (value as any).denied.map((userId: string) => ({
      subjectType: 'user' as const,
      subjectId: userId,
      userId,
      permissions: ['read', 'write', 'delete', 'share', 'manage'],
      effect: 'deny' as const,
    })) as AclEntry[];
  }

  return [];
}

/** Does an ACL entry apply to this user? */
function entryApplies(
  entry: AclEntry,
  userId: string,
  permissions: EffectivePermissions,
): boolean {
  switch (entry.subjectType) {
    case 'user':
      return entry.subjectId === userId;
    case 'department':
      return permissions.departmentIds.includes(entry.subjectId);
    case 'division':
      return permissions.divisionIds.includes(entry.subjectId);
    default:
      return false;
  }
}

/**
 * Mirror of `PermissionsService.decide` on the server, used to decide what to
 * render. Access is need-to-know — nothing is implied by where a resource sits:
 *
 *   1. An instance-wide scope reaches everything.
 *   2. Another company's resource is always refused.
 *   3. A matching deny beats any grant.
 *   4. The role must carry the capability for this verb.
 *   5. Company-wide roles reach their own company; everyone else needs an ACL
 *      entry naming them, their department or their division.
 *   6. Failing that, the creator keeps access to what they created.
 */
export function checkResourceAccess(
  user: any,
  resource: ScopedResource | null | undefined,
  permission: ResourcePermission,
  resourceType: 'folder' | 'document' = 'document',
): boolean {
  return explainAccess(user, resource, permission, resourceType).allowed;
}

export type DenialReason =
  | 'allowed'
  | 'no_session'
  | 'not_loaded'
  | 'explicit_deny'
  | 'missing_capability'
  | 'other_company'
  | 'no_grant';

export interface AccessResult {
  allowed: boolean;
  reason: DenialReason;
}

export function explainAccess(
  user: any,
  resource: ScopedResource | null | undefined,
  permission: ResourcePermission,
  resourceType: 'folder' | 'document' = 'document',
): AccessResult {
  if (!user || !resource) return { allowed: false, reason: 'no_session' };

  const permissions = getPermissions(user);

  // Defer to the server whenever it has already decided, for `read`. Other
  // verbs still use the mirror, since listings only carry the read decision.
  if (permission === 'read' && typeof resource.access?.canRead === 'boolean') {
    return resource.access.canRead
      ? { allowed: true, reason: 'allowed' }
      : { allowed: false, reason: (resource.access.reason as DenialReason) ?? 'no_grant' };
  }

  // Capabilities have not arrived yet: report "not loaded" rather than a
  // denial, so the UI can show a skeleton instead of a padlock.
  if (permissions.capabilities.length === 0) {
    return { allowed: false, reason: 'not_loaded' };
  }

  if (permissions.dataScope === 'all') return { allowed: true, reason: 'allowed' };

  if (!resource.companyId || resource.companyId !== permissions.companyId) {
    return { allowed: false, reason: 'other_company' };
  }

  const acl = parseAcl(resource.permissionsJson);
  const applicable = acl.filter((entry) =>
    entryApplies(entry, user.id, permissions),
  );

  if (
    applicable.some(
      (entry) =>
        entry.effect === 'deny' && entry.permissions.includes(permission),
    )
  ) {
    return { allowed: false, reason: 'explicit_deny' };
  }

  const capability = REQUIRED_CAPABILITY[resourceType][permission];
  if (!permissions.capabilities.includes(capability)) {
    return { allowed: false, reason: 'missing_capability' };
  }

  if (permissions.dataScope === 'company') {
    return { allowed: true, reason: 'allowed' };
  }

  if (
    applicable.some(
      (entry) =>
        entry.effect !== 'deny' && entry.permissions.includes(permission),
    )
  ) {
    return { allowed: true, reason: 'allowed' };
  }

  if (resource.createdBy === user.id) return { allowed: true, reason: 'allowed' };

  return { allowed: false, reason: 'no_grant' };
}

const REQUIRED_CAPABILITY: Record<
  'folder' | 'document',
  Record<ResourcePermission, Capability>
> = {
  folder: {
    read: 'documents.view',
    write: 'folders.edit',
    delete: 'folders.delete',
    share: 'documents.share',
    manage: 'folders.manage_permissions',
  },
  document: {
    read: 'documents.view',
    write: 'documents.edit',
    delete: 'documents.delete',
    share: 'documents.share',
    manage: 'documents.manage_permissions',
  },
};

// ---------------------------------------------------------------------------
// Explaining a denial
// ---------------------------------------------------------------------------

/**
 * A short sentence saying why an action is unavailable, for a tooltip on a
 * disabled control. A greyed-out button with no explanation is the thing users
 * file bugs about.
 */
export function explainDenial(
  user: any,
  resource: ScopedResource | null | undefined,
  permission: ResourcePermission,
  resourceType: 'folder' | 'document' = 'document',
): string | null {
  const { allowed, reason } = explainAccess(
    user,
    resource,
    permission,
    resourceType,
  );
  if (allowed) return null;

  const permissions = getPermissions(user);
  const noun = resourceType === 'folder' ? 'folder' : 'document';

  switch (reason) {
    case 'not_loaded':
      return 'Your permissions are still loading.';
    case 'no_session':
      return 'Sign in to continue.';
    case 'explicit_deny':
      return `Your access to this ${noun} has been revoked by an administrator.`;
    case 'missing_capability':
      return `The ${permissions.role} role cannot ${VERB_LABEL[permission]} ${noun}s.`;
    case 'other_company':
      return `This ${noun} belongs to another company.`;
    case 'no_grant':
    default:
      return `You have not been given access to this ${noun}. You can request it.`;
  }
}

const VERB_LABEL: Record<ResourcePermission, string> = {
  read: 'open',
  write: 'edit',
  delete: 'delete',
  share: 'share',
  manage: 'manage permissions on',
};

/** Human-readable label for a capability, for role/permission editors. */
export function capabilityLabel(capability: Capability): string {
  const [group, action] = capability.split('.');
  const readableAction = action.replace(/_/g, ' ');
  const readableGroup = group.replace(/_/g, ' ');
  return `${readableAction.charAt(0).toUpperCase()}${readableAction.slice(1)} ${readableGroup}`;
}

/**
 * One-line description of how far a user's reach extends.
 *
 * Access is need-to-know, so for everyone below company scope the honest answer
 * is "whatever has been shared with you" — nothing is implied by where a
 * document is filed. Saying otherwise would set the wrong expectation and send
 * people hunting for documents they were never granted.
 */
export function describeScope(permissions: EffectivePermissions): string {
  switch (permissions.dataScope) {
    case 'all':
      return 'Every company on this instance';
    case 'company':
      return 'Everything in your company';
    case 'department':
      return 'Anything shared with you or with your departments';
    case 'division':
      return 'Anything shared with you, your division or your department';
    case 'own':
    default:
      return 'Only what has been shared with you directly';
  }
}
