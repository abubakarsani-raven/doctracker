/**
 * Capability vocabulary — the single source of truth for what a role can do.
 *
 * Two independent axes decide whether a user may act on a resource:
 *
 *   1. CAPABILITY — "is this user allowed to perform this kind of action at
 *      all?"  Derived from the user's role(s) and stored on `Role.permissionsJson`.
 *   2. DATA SCOPE — "which records does this user's reach extend over?"
 *      Derived from the user's role and their company/department/division
 *      membership.
 *
 * Both must pass. A Department Head has `documents.delete`, but their data
 * scope stops at their own department, so they cannot delete another
 * department's file. Per-resource ACLs (`permissionsJson` on folders and
 * file-folder links) can grant extra access beyond the data scope, or revoke
 * access that scope would otherwise allow.
 *
 * The role -> capability mapping lives here and ONLY here. The frontend never
 * recomputes it; it receives the resolved capability list from the API. That
 * is what stops the UI and the server from drifting apart.
 */

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export const CAPABILITIES = [
  // Documents
  'documents.view',
  'documents.create',
  'documents.edit',
  'documents.delete',
  'documents.share',
  'documents.manage_permissions',
  'documents.sign',
  'documents.request_signature',

  // Folders
  'folders.create',
  'folders.edit',
  'folders.delete',
  'folders.manage_permissions',

  // Workflows and actions
  'workflows.view',
  'workflows.create',
  'workflows.edit',
  'workflows.delete',
  'workflows.assign',
  'actions.assign',
  'actions.complete',

  // Requests
  'approvals.review',
  'access_requests.create',
  'access_requests.review',

  // Administration
  'users.view',
  'users.manage',
  'companies.view_all',
  'companies.manage',
  'reports.view',
  'storage.view',
  'activity.view_all',
  'manage_permissions',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL_CAPABILITIES = CAPABILITIES as readonly Capability[];

// ---------------------------------------------------------------------------
// Data scope
// ---------------------------------------------------------------------------

/**
 * How far a user's reach extends, widest first. Compared by rank, so a
 * `company`-scoped user automatically satisfies anything a `department`-scoped
 * user could reach within that company.
 */
export type DataScope = 'all' | 'company' | 'department' | 'division' | 'own';

export const DATA_SCOPE_RANK: Record<DataScope, number> = {
  all: 4,
  company: 3,
  department: 2,
  division: 1,
  own: 0,
};

/** Scope levels a resource can be published at (`Folder.scopeLevel`). */
export type ResourceScopeLevel = 'company' | 'department' | 'division';

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export interface RoleDefinition {
  name: string;
  description: string;
  dataScope: DataScope;
  canAssignDocuments: boolean;
  capabilities: readonly Capability[];
}

/** Capabilities every authenticated user has, regardless of role. */
const BASE_CAPABILITIES: readonly Capability[] = [
  'documents.view',
  'workflows.view',
  'actions.complete',
  'access_requests.create',
];

/** A contributor who can produce documents but not administer them. */
const CONTRIBUTOR_CAPABILITIES: readonly Capability[] = [
  ...BASE_CAPABILITIES,
  'documents.create',
  'documents.edit',
  'documents.sign',
  'folders.create',
  'workflows.create',
];

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    name: 'Master',
    description:
      'Platform owner. Unrestricted access across every company on the instance.',
    dataScope: 'all',
    canAssignDocuments: true,
    capabilities: ALL_CAPABILITIES,
  },
  {
    name: 'Group Secretary',
    description:
      'The main secretary. Works across every company: appoints company secretaries, grants them access to documents, and routes work between companies.',
    dataScope: 'all',
    canAssignDocuments: true,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.delete',
      'documents.share',
      'documents.manage_permissions',
      'documents.sign',
      'documents.request_signature',
      'folders.edit',
      'folders.delete',
      'folders.manage_permissions',
      'workflows.edit',
      'workflows.delete',
      'workflows.assign',
      'actions.assign',
      'approvals.review',
      'access_requests.review',
      'users.view',
      'users.manage',
      'companies.view_all',
      'reports.view',
      'storage.view',
      'activity.view_all',
      'manage_permissions',
    ],
  },
  {
    name: 'Company Secretary',
    description:
      'The secretary for one company. Assigns work internally and grants access to that company\u2019s documents.',
    dataScope: 'company',
    canAssignDocuments: true,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.share',
      'documents.manage_permissions',
      'documents.sign',
      'documents.request_signature',
      'folders.edit',
      'folders.manage_permissions',
      'workflows.edit',
      'workflows.assign',
      'actions.assign',
      'access_requests.review',
      'users.view',
      'reports.view',
      'activity.view_all',
    ],
  },
  {
    name: 'Company Admin',
    description:
      'Administers a single company: all of its documents, users and settings.',
    dataScope: 'company',
    canAssignDocuments: true,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.delete',
      'documents.share',
      'documents.manage_permissions',
      'documents.sign',
      'documents.request_signature',
      'folders.edit',
      'folders.delete',
      'folders.manage_permissions',
      'workflows.edit',
      'workflows.delete',
      'workflows.assign',
      'actions.assign',
      'approvals.review',
      'access_requests.review',
      'users.view',
      'users.manage',
      'reports.view',
      'storage.view',
      'activity.view_all',
      'manage_permissions',
    ],
  },
  {
    name: 'Department Head',
    description:
      'Leads a department. Full control of that department’s documents and workflows.',
    dataScope: 'department',
    canAssignDocuments: true,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.delete',
      'documents.share',
      'documents.manage_permissions',
      'documents.sign',
      'documents.request_signature',
      'folders.edit',
      'folders.delete',
      'folders.manage_permissions',
      'workflows.edit',
      'workflows.delete',
      'workflows.assign',
      'actions.assign',
      'approvals.review',
      'access_requests.review',
      'users.view',
      'reports.view',
      'activity.view_all',
    ],
  },
  {
    name: 'Department Secretary',
    description:
      'Routes and tracks documents on behalf of a department head, but cannot delete them.',
    dataScope: 'department',
    canAssignDocuments: true,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.share',
      'documents.sign',
      'folders.edit',
      'workflows.edit',
      'workflows.assign',
      'actions.assign',
      'access_requests.review',
      'users.view',
    ],
  },
  {
    name: 'Division Head',
    description:
      'Leads a division inside a department. Controls that division’s documents.',
    dataScope: 'division',
    canAssignDocuments: false,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.delete',
      'documents.share',
      'documents.manage_permissions',
      'documents.sign',
      'folders.edit',
      'folders.delete',
      'folders.manage_permissions',
      'workflows.edit',
      'access_requests.review',
      'users.view',
    ],
  },
  {
    name: 'Manager',
    description:
      'Manages work within a division. Can create and route, but not delete or re-permission.',
    dataScope: 'division',
    canAssignDocuments: false,
    capabilities: [
      ...CONTRIBUTOR_CAPABILITIES,
      'documents.share',
      'documents.sign',
      'workflows.edit',
      'users.view',
    ],
  },
  {
    name: 'Staff',
    description:
      'Standard contributor. Works on documents within their own division.',
    dataScope: 'division',
    canAssignDocuments: false,
    capabilities: CONTRIBUTOR_CAPABILITIES,
  },
  {
    name: 'Receptionist',
    description:
      'Logs incoming documents. Can create, but cannot edit or route existing ones.',
    dataScope: 'own',
    canAssignDocuments: false,
    capabilities: [...BASE_CAPABILITIES, 'documents.create'],
  },
];

export const ROLE_DEFINITIONS_BY_NAME: ReadonlyMap<string, RoleDefinition> =
  new Map(ROLE_DEFINITIONS.map((role) => [role.name, role]));

/** Fallback for a user whose role row is missing or unrecognised. */
export const DEFAULT_ROLE_NAME = 'Staff';

// ---------------------------------------------------------------------------
// Persistence shape
// ---------------------------------------------------------------------------

/**
 * What gets written to `Role.permissionsJson`. Storing the scope alongside the
 * capabilities keeps the whole role definition editable at runtime without a
 * schema migration.
 */
export interface RolePermissionsJson {
  dataScope: DataScope;
  capabilities: Capability[];
  description?: string;
}

export function toRolePermissionsJson(role: RoleDefinition): RolePermissionsJson {
  return {
    dataScope: role.dataScope,
    capabilities: [...role.capabilities],
    description: role.description,
  };
}

/**
 * Read a stored `Role.permissionsJson` back into a usable shape, tolerating
 * rows written before this format existed (the original seed wrote `{}`).
 * Falls back to the compiled-in definition for that role name.
 */
export function parseRolePermissions(
  roleName: string,
  stored: unknown,
): RolePermissionsJson {
  const fallback = ROLE_DEFINITIONS_BY_NAME.get(roleName);
  const fallbackJson: RolePermissionsJson = fallback
    ? toRolePermissionsJson(fallback)
    : { dataScope: 'own', capabilities: [] };

  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return fallbackJson;
  }

  const record = stored as Record<string, unknown>;
  const capabilities = Array.isArray(record.capabilities)
    ? (record.capabilities.filter((c): c is Capability =>
        ALL_CAPABILITIES.includes(c as Capability),
      ) as Capability[])
    : fallbackJson.capabilities;

  const dataScope =
    typeof record.dataScope === 'string' &&
    record.dataScope in DATA_SCOPE_RANK
      ? (record.dataScope as DataScope)
      : fallbackJson.dataScope;

  // An empty capability list means the row predates this format — the legacy
  // seed wrote `{}` — so prefer the compiled-in definition over granting nothing.
  return {
    dataScope,
    capabilities: capabilities.length > 0 ? capabilities : fallbackJson.capabilities,
    description:
      typeof record.description === 'string'
        ? record.description
        : fallbackJson.description,
  };
}

// ---------------------------------------------------------------------------
// Resolved permissions for a signed-in user
// ---------------------------------------------------------------------------

export interface EffectivePermissions {
  /** Primary role name, kept for display and for legacy `user.role` checks. */
  role: string;
  /** Every role the user holds (a user may be assigned roles in more companies). */
  roles: string[];
  /** Widest data scope across all held roles. */
  dataScope: DataScope;
  /** Union of capabilities across all held roles. */
  capabilities: Capability[];
  canAssignDocuments: boolean;
  companyId: string | null;
  departmentIds: string[];
  divisionIds: string[];
}

export function hasCapability(
  permissions: Pick<EffectivePermissions, 'capabilities'> | null | undefined,
  capability: Capability,
): boolean {
  return !!permissions?.capabilities?.includes(capability);
}

export function scopeCovers(userScope: DataScope, required: DataScope): boolean {
  return DATA_SCOPE_RANK[userScope] >= DATA_SCOPE_RANK[required];
}
