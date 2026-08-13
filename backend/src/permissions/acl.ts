/**
 * Access-control lists.
 *
 * Reaching a folder or document requires one of:
 *   - Master (`dataScope: 'all'`) — instance-wide recovery
 *   - Company Admin / Company Secretary (`dataScope: 'company'`) — own company
 *   - Department / Division roles whose domain matches the resource filing
 *     (`departmentId` / `divisionId`)
 *   - An ACL entry naming the user, their department, or their division
 *   - Creator access to their own records
 *
 * Publishing a folder at "department" or "division" scope also writes opening
 * ACL grants for that subject (and the parent department for division scope).
 */

export type ResourcePermission = 'read' | 'write' | 'delete' | 'share' | 'manage';

export type SubjectType = 'user' | 'department' | 'division';

export const VALID_PERMISSIONS: ResourcePermission[] = [
  'read',
  'write',
  'delete',
  'share',
  'manage',
];

/**
 * One grant or revocation.
 *
 * `subjectType` + `subjectId` is the canonical form. `userId` is kept populated
 * for user entries so existing clients that read it keep working.
 */
export interface AclEntry {
  subjectType: SubjectType;
  subjectId: string;
  /** Mirror of `subjectId` when `subjectType` is 'user'. */
  userId?: string;
  /** Display name of the subject, stored so an ACL reads without extra lookups. */
  subjectName?: string;
  permissions: ResourcePermission[];
  effect: 'allow' | 'deny';
  grantedBy?: string;
  grantedAt?: string;
  /**
   * Optional provenance so temporary grants (e.g. signature participants) can be
   * revoked without removing a pre-existing permanent share for the same user.
   * Example: `signature:<requestId>`.
   */
  source?: string;
}

/** Prefix used when a signature request temporarily grants file read access. */
export const SIGNATURE_ACL_SOURCE_PREFIX = 'signature:';

export function signatureAclSource(requestId: string): string {
  return `${SIGNATURE_ACL_SOURCE_PREFIX}${requestId}`;
}

/** Temporary signature invites are allowed to name users in another company. */
export function isSignatureAclSource(source: string | undefined | null): boolean {
  return (
    typeof source === 'string' && source.startsWith(SIGNATURE_ACL_SOURCE_PREFIX)
  );
}

/** The membership facts needed to decide whether an entry applies to someone. */
export interface SubjectContext {
  userId: string;
  departmentIds: string[];
  divisionIds: string[];
}

/** Does this entry apply to the given person? */
export function entryApplies(entry: AclEntry, subject: SubjectContext): boolean {
  switch (entry.subjectType) {
    case 'user':
      return entry.subjectId === subject.userId;
    case 'department':
      return subject.departmentIds.includes(entry.subjectId);
    case 'division':
      return subject.divisionIds.includes(entry.subjectId);
    default:
      return false;
  }
}

/**
 * Coerce whatever is stored in a `permissions_json` column into `AclEntry[]`.
 *
 * Tolerates the shapes that predate this format: entries keyed by `userId` with
 * no subject type, a bare `{ denied: [userId] }` object, and a `permissions`
 * value that is a string rather than an array.
 */
export function normaliseAcl(stored: unknown): AclEntry[] {
  if (!stored) return [];

  let value = stored;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.flatMap((raw) => {
      const entry = normaliseEntry(raw);
      return entry ? [entry] : [];
    });
  }

  // Legacy `{ denied: [userId, ...] }`.
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.denied)) {
      return record.denied
        .filter((id): id is string => typeof id === 'string')
        .map((userId) => ({
          subjectType: 'user' as const,
          subjectId: userId,
          userId,
          permissions: [...VALID_PERMISSIONS],
          effect: 'deny' as const,
        }));
    }
  }

  return [];
}

function normaliseEntry(raw: unknown): AclEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const subjectType: SubjectType =
    record.subjectType === 'department' || record.subjectType === 'division'
      ? record.subjectType
      : 'user';

  const subjectId =
    typeof record.subjectId === 'string'
      ? record.subjectId
      : typeof record.userId === 'string'
        ? record.userId
        : null;

  if (!subjectId) return null;

  const rawPermissions = Array.isArray(record.permissions)
    ? record.permissions
    : typeof record.permissions === 'string'
      ? [record.permissions]
      : [];

  const permissions = rawPermissions.filter(
    (p): p is ResourcePermission =>
      typeof p === 'string' &&
      VALID_PERMISSIONS.includes(p as ResourcePermission),
  );

  return {
    subjectType,
    subjectId,
    ...(subjectType === 'user' ? { userId: subjectId } : {}),
    ...(typeof record.subjectName === 'string'
      ? { subjectName: record.subjectName }
      : {}),
    permissions,
    effect: record.effect === 'deny' ? 'deny' : 'allow',
    ...(typeof record.grantedBy === 'string'
      ? { grantedBy: record.grantedBy }
      : {}),
    ...(typeof record.grantedAt === 'string'
      ? { grantedAt: record.grantedAt }
      : {}),
    ...(typeof record.source === 'string' ? { source: record.source } : {}),
  };
}

/** A stable key for deduplicating entries across inheritance. */
export function entryKey(entry: AclEntry): string {
  return `${entry.subjectType}:${entry.subjectId}`;
}

/** Record who made each entry and when, for the audit trail. */
export function stampAcl(acl: AclEntry[], actorId: string): AclEntry[] {
  const now = new Date().toISOString();
  return acl.map((entry) => ({
    ...entry,
    grantedBy: entry.grantedBy ?? actorId,
    grantedAt: entry.grantedAt ?? now,
  }));
}

/**
 * Who gained and who lost access between two versions of an ACL.
 *
 * "Revoked" covers both things people experience as losing access: an allow
 * disappearing, and an allow being replaced by a deny.
 */
export function diffAcl(before: AclEntry[], after: AclEntry[]) {
  const allowKeys = (entries: AclEntry[]) =>
    new Set(entries.filter((e) => e.effect !== 'deny').map(entryKey));
  const denyKeys = (entries: AclEntry[]) =>
    new Set(entries.filter((e) => e.effect === 'deny').map(entryKey));

  const allowedBefore = allowKeys(before);
  const allowedAfter = allowKeys(after);
  const deniedBefore = denyKeys(before);
  const deniedAfter = denyKeys(after);

  const byKey = new Map(after.concat(before).map((e) => [entryKey(e), e]));

  const granted = [...allowedAfter]
    .filter((key) => !allowedBefore.has(key))
    .map((key) => byKey.get(key)!)
    .filter(Boolean);

  const revoked = [
    ...new Set([
      ...[...allowedBefore].filter((key) => !allowedAfter.has(key)),
      ...[...deniedAfter].filter((key) => !deniedBefore.has(key)),
    ]),
  ]
    .map((key) => byKey.get(key)!)
    .filter(Boolean);

  return { granted, revoked };
}
