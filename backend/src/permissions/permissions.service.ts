import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Capability,
  DataScope,
  DEFAULT_ROLE_NAME,
  DATA_SCOPE_RANK,
  EffectivePermissions,
  parseRolePermissions,
} from './capabilities';
import {
  AclEntry,
  ResourcePermission,
  SubjectContext,
  VALID_PERMISSIONS,
  diffAcl,
  entryApplies,
  entryKey,
  normaliseAcl,
  signatureAclSource,
  stampAcl,
} from './acl';

export type { ResourcePermission, AclEntry } from './acl';
export { signatureAclSource } from './acl';

export type ResourceType = 'folder' | 'file';

/** Caller's choices about the side effects of a permission change. */
export interface PermissionUpdateOptions {
  /**
   * What to do about work already assigned to someone whose access is being
   * removed. `leave` (the default) touches nothing; `flag` marks their open
   * actions on this resource as blocked and tells the action's owner.
   */
  onRevoke?: 'leave' | 'flag';
  /**
   * When false, skip in-app notifications for this ACL change.
   * Used by signature temporary grants, which send their own richer notices.
   * Default true.
   */
  notify?: boolean;
}

/** Which capability each verb requires, per resource type. */
const REQUIRED_CAPABILITY: Record<
  ResourceType,
  Record<ResourcePermission, Capability>
> = {
  folder: {
    read: 'documents.view',
    write: 'folders.edit',
    delete: 'folders.delete',
    share: 'documents.share',
    manage: 'folders.manage_permissions',
  },
  file: {
    read: 'documents.view',
    write: 'documents.edit',
    delete: 'documents.delete',
    share: 'documents.share',
    manage: 'documents.manage_permissions',
  },
};

interface ResourceDescriptor {
  id: string;
  companyId: string | null;
  scopeLevel: string | null;
  departmentId: string | null;
  divisionId: string | null;
  createdBy: string | null;
}

/** Why a request was allowed or refused — drives audit entries and tooltips. */
export interface AccessDecision {
  allowed: boolean;
  reason:
    | 'instance_scope'
    | 'company_scope'
    | 'explicit_grant'
    | 'creator'
    | 'explicit_deny'
    | 'missing_capability'
    | 'no_grant'
    | 'other_company'
    | 'not_found';
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Effective permissions
  // -------------------------------------------------------------------------

  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: true,
        userDivisions: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.buildEffectivePermissions(user);
  }

  /**
   * Build effective permissions from an already-loaded user, so a request does
   * not re-query what it just fetched. The user must have been loaded with
   * `userRoles.role`, `userDepartments` and `userDivisions`.
   */
  buildEffectivePermissions(user: {
    id: string;
    companyId?: string | null;
    userRoles?: Array<{
      role?: {
        name: string;
        permissionsJson: unknown;
        canAssignDocuments: boolean;
      } | null;
    }>;
    userDepartments?: Array<{ departmentId: string }>;
    userDivisions?: Array<{ divisionId: string }>;
  }): EffectivePermissions {
    const assignedRoles = (user.userRoles ?? [])
      .map((ur) => ur.role)
      .filter((role): role is NonNullable<typeof role> => !!role);

    // A user with no role row still gets the default role's abilities rather
    // than being locked out entirely.
    const roleNames =
      assignedRoles.length > 0
        ? assignedRoles.map((role) => role.name)
        : [DEFAULT_ROLE_NAME];

    const capabilities = new Set<Capability>();
    let widestScope: DataScope = 'own';
    let canAssignDocuments = false;

    for (const roleName of roleNames) {
      const stored = assignedRoles.find((r) => r.name === roleName);
      const parsed = parseRolePermissions(roleName, stored?.permissionsJson);

      for (const capability of parsed.capabilities) capabilities.add(capability);
      if (DATA_SCOPE_RANK[parsed.dataScope] > DATA_SCOPE_RANK[widestScope]) {
        widestScope = parsed.dataScope;
      }
      if (stored?.canAssignDocuments) canAssignDocuments = true;
    }

    return {
      role: roleNames[0],
      roles: roleNames,
      dataScope: widestScope,
      capabilities: [...capabilities],
      canAssignDocuments,
      companyId: user.companyId ?? null,
      departmentIds: (user.userDepartments ?? []).map((ud) => ud.departmentId),
      divisionIds: (user.userDivisions ?? []).map((ud) => ud.divisionId),
    };
  }

  // -------------------------------------------------------------------------
  // Reading ACLs
  // -------------------------------------------------------------------------

  async getFolderPermissions(
    folderId: string,
    visitedFolders: Set<string> = new Set(),
  ): Promise<any> {
    // Guard against a cycle in the folder hierarchy.
    if (visitedFolders.has(folderId)) {
      return { folderId, explicitPermissions: [], inheritedPermissions: [] };
    }
    visitedFolders.add(folderId);

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        name: true,
        scopeLevel: true,
        departmentId: true,
        divisionId: true,
        companyId: true,
        parentFolderId: true,
        permissionsJson: true,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    let inheritedPermissions: AclEntry[] = [];
    if (folder.parentFolderId) {
      const parent = await this.getFolderPermissions(
        folder.parentFolderId,
        visitedFolders,
      );
      // The parent's effective set cascades, so a grant at the top of the tree
      // reaches every descendant.
      inheritedPermissions = (parent.explicitPermissions ?? []) as AclEntry[];
    }

    const ownPermissions = normaliseAcl(folder.permissionsJson);

    // An entry set here overrides the inherited one for the same subject, so a
    // subfolder can narrow — or revoke — what a parent granted.
    const merged = new Map<string, AclEntry>();
    for (const entry of inheritedPermissions) merged.set(entryKey(entry), entry);
    for (const entry of ownPermissions) merged.set(entryKey(entry), entry);

    return {
      folderId,
      name: folder.name,
      scopeLevel: folder.scopeLevel,
      departmentId: folder.departmentId,
      divisionId: folder.divisionId,
      companyId: folder.companyId,
      parentFolderId: folder.parentFolderId,
      explicitPermissions: [...merged.values()],
      inheritedPermissions,
      ownPermissions,
    };
  }

  async getFilePermissions(fileId: string, folderId?: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        fileName: true,
        scopeLevel: true,
        departmentId: true,
        divisionId: true,
        companyId: true,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    let explicitPermissions: AclEntry[] = [];
    let inheritedPermissions: AclEntry[] = [];

    if (folderId) {
      const link = await this.prisma.fileFolderLink.findUnique({
        where: { fileId_folderId: { fileId, folderId } },
        select: { permissionsJson: true },
      });
      explicitPermissions = normaliseAcl(link?.permissionsJson);

      // A file also inherits whatever the containing folder grants.
      const folderPermissions = await this.getFolderPermissions(folderId);
      inheritedPermissions = (folderPermissions.explicitPermissions ??
        []) as AclEntry[];
    }

    return {
      fileId,
      name: file.fileName,
      folderId: folderId ?? null,
      scopeLevel: file.scopeLevel,
      departmentId: file.departmentId,
      divisionId: file.divisionId,
      companyId: file.companyId,
      explicitPermissions,
      inheritedPermissions,
    };
  }

  // -------------------------------------------------------------------------
  // Writing ACLs
  // -------------------------------------------------------------------------

  async updateFilePermissions(
    fileId: string,
    folderId: string,
    permissions: unknown,
    currentUser: { id: string; name?: string; email?: string },
    options: PermissionUpdateOptions = {},
  ) {
    const link = await this.prisma.fileFolderLink.findUnique({
      where: { fileId_folderId: { fileId, folderId } },
      include: { file: { select: { fileName: true, companyId: true } } },
    });

    if (!link) {
      throw new NotFoundException('File is not linked to this folder');
    }

    const before = normaliseAcl(link.permissionsJson);
    const acl = await this.validateAcl(permissions, link.file?.companyId ?? null);

    const updated = await this.prisma.fileFolderLink.update({
      where: { fileId_folderId: { fileId, folderId } },
      data: { permissionsJson: stampAcl(acl, currentUser.id) as any },
    });

    await this.applyPermissionChangeEffects({
      resourceType: 'file',
      resourceId: fileId,
      resourceName: link.file?.fileName ?? 'this document',
      companyId: link.file?.companyId ?? null,
      actor: currentUser,
      before,
      after: acl,
      options,
    });

    return updated;
  }

  /**
   * Merge a user allow-entry onto every folder link for a file.
   * Skips when the user already has the requested permission (e.g. creator /
   * company secretary via dataScope) so we do not replace permanent grants with
   * temporary signature ones.
   */
  async grantUserFileAccess(
    fileId: string,
    userId: string,
    permissions: ResourcePermission[],
    actor: { id: string; name?: string; email?: string },
    options: {
      source?: string;
      subjectName?: string;
      notify?: boolean;
    } = {},
  ): Promise<boolean> {
    if (!permissions.length) return false;

    const needsGrant: ResourcePermission[] = [];
    for (const permission of permissions) {
      const has = await this.checkPermission(userId, 'file', fileId, permission);
      if (!has) needsGrant.push(permission);
    }
    if (!needsGrant.length) return false;

    const links = await this.prisma.fileFolderLink.findMany({
      where: { fileId },
      select: { folderId: true, permissionsJson: true },
    });
    if (!links.length) {
      this.logger.warn(
        `Cannot grant file access for ${fileId}: file is not linked to any folder`,
      );
      return false;
    }

    let subjectName = options.subjectName;
    if (!subjectName) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      subjectName = user?.name || user?.email || userId;
    }

    const updateOptions: PermissionUpdateOptions = {
      notify: options.notify,
    };

    let changed = false;
    for (const link of links) {
      const before = normaliseAcl(link.permissionsJson);
      const existingIdx = before.findIndex(
        (e) =>
          e.subjectType === 'user' &&
          e.subjectId === userId &&
          e.effect === 'allow',
      );

      if (existingIdx >= 0) {
        const existing = before[existingIdx];
        const merged = Array.from(
          new Set([...existing.permissions, ...needsGrant]),
        );
        if (
          merged.length === existing.permissions.length &&
          merged.every((p) => existing.permissions.includes(p))
        ) {
          continue;
        }
        // Keep any pre-existing entry (and its source) — only top up permissions.
        const next = [...before];
        next[existingIdx] = {
          ...existing,
          permissions: merged,
          subjectName: existing.subjectName || subjectName,
        };
        await this.updateFilePermissions(
          fileId,
          link.folderId,
          next,
          actor,
          updateOptions,
        );
        changed = true;
        continue;
      }

      const next: AclEntry[] = [
        ...before,
        {
          subjectType: 'user',
          subjectId: userId,
          userId,
          subjectName,
          permissions: [...needsGrant],
          effect: 'allow',
          ...(options.source ? { source: options.source } : {}),
        },
      ];

      await this.updateFilePermissions(
        fileId,
        link.folderId,
        next,
        actor,
        updateOptions,
      );
      changed = true;
    }

    return changed;
  }

  /**
   * Merge a user allow-entry onto a folder ACL (same pattern as grantUserFileAccess).
   */
  async grantUserFolderAccess(
    folderId: string,
    userId: string,
    permissions: ResourcePermission[],
    actor: { id: string; name?: string; email?: string },
    options: {
      source?: string;
      subjectName?: string;
      notify?: boolean;
    } = {},
  ): Promise<boolean> {
    if (!permissions.length) return false;

    const needsGrant: ResourcePermission[] = [];
    for (const permission of permissions) {
      const has = await this.checkPermission(
        userId,
        'folder',
        folderId,
        permission,
      );
      if (!has) needsGrant.push(permission);
    }
    if (!needsGrant.length) return false;

    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, permissionsJson: true },
    });
    if (!folder) {
      this.logger.warn(`Cannot grant folder access: folder ${folderId} not found`);
      return false;
    }

    let subjectName = options.subjectName;
    if (!subjectName) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      subjectName = user?.name || user?.email || userId;
    }

    const before = normaliseAcl(folder.permissionsJson);
    const existingIdx = before.findIndex(
      (e) =>
        e.subjectType === 'user' &&
        e.subjectId === userId &&
        e.effect === 'allow',
    );

    let next: AclEntry[];
    if (existingIdx >= 0) {
      const existing = before[existingIdx];
      const merged = Array.from(
        new Set([...existing.permissions, ...needsGrant]),
      );
      if (
        merged.length === existing.permissions.length &&
        merged.every((p) => existing.permissions.includes(p))
      ) {
        return false;
      }
      next = [...before];
      next[existingIdx] = {
        ...existing,
        permissions: merged,
        subjectName: existing.subjectName || subjectName,
      };
    } else {
      next = [
        ...before,
        {
          subjectType: 'user',
          subjectId: userId,
          userId,
          subjectName,
          permissions: [...needsGrant],
          effect: 'allow',
          ...(options.source ? { source: options.source } : {}),
        },
      ];
    }

    await this.updateFolderPermissions(folderId, next, actor, {
      notify: options.notify,
    });
    return true;
  }

  /**
   * Remove ACL entries that were granted for a specific signature request
   * (`source: signature:<requestId>`), leaving any other shares intact.
   */
  async revokeSignatureFileAccess(
    fileId: string,
    requestId: string,
    actor: { id: string; name?: string; email?: string },
  ): Promise<void> {
    const source = signatureAclSource(requestId);
    const links = await this.prisma.fileFolderLink.findMany({
      where: { fileId },
      select: { folderId: true, permissionsJson: true },
    });

    for (const link of links) {
      const before = normaliseAcl(link.permissionsJson);
      const next = before.filter((e) => e.source !== source);
      if (next.length === before.length) continue;
      await this.updateFilePermissions(fileId, link.folderId, next, actor, {
        onRevoke: 'leave',
        notify: false,
      });
    }
  }

  async updateFolderPermissions(
    folderId: string,
    permissions: unknown,
    currentUser: { id: string; name?: string; email?: string },
    options: PermissionUpdateOptions = {},
  ) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const before = normaliseAcl(folder.permissionsJson);
    const acl = await this.validateAcl(permissions, folder.companyId);

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { permissionsJson: stampAcl(acl, currentUser.id) as any },
    });

    await this.applyPermissionChangeEffects({
      resourceType: 'folder',
      resourceId: folderId,
      resourceName: folder.name,
      companyId: folder.companyId,
      actor: currentUser,
      before,
      after: acl,
      options,
    });

    return updated;
  }

  /**
   * Check a client-supplied ACL: entries must be well formed, and every subject
   * must exist and belong to the same company as the resource. Without that
   * check an administrator could grant access to an outsider.
   */
  private async validateAcl(
    permissions: unknown,
    companyId: string | null,
  ): Promise<AclEntry[]> {
    if (permissions === null || permissions === undefined) return [];
    if (!Array.isArray(permissions)) {
      throw new BadRequestException(
        'Permissions must be an array of access entries.',
      );
    }

    const acl = normaliseAcl(permissions);
    if (acl.length !== permissions.length) {
      throw new BadRequestException(
        'Every entry needs a subjectId (or userId) and a subjectType of user, department or division.',
      );
    }

    for (const entry of acl) {
      if (entry.permissions.length === 0) {
        throw new BadRequestException(
          `Entry for ${entry.subjectType} ${entry.subjectId} lists no permissions. Valid values: ${VALID_PERMISSIONS.join(', ')}.`,
        );
      }
    }

    if (companyId) {
      await this.assertSubjectsInCompany(acl, companyId);
    }

    return acl;
  }

  private async assertSubjectsInCompany(acl: AclEntry[], companyId: string) {
    const userIds = acl
      .filter((e) => e.subjectType === 'user')
      .map((e) => e.subjectId);
    const departmentIds = acl
      .filter((e) => e.subjectType === 'department')
      .map((e) => e.subjectId);
    const divisionIds = acl
      .filter((e) => e.subjectType === 'division')
      .map((e) => e.subjectId);

    if (userIds.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, companyId: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const id of userIds) {
        const user = byId.get(id);
        if (!user) {
          throw new BadRequestException(`No such user: ${id}`);
        }
        // Group-level staff have no home company and may legitimately be named.
        if (user.companyId && user.companyId !== companyId) {
          throw new ForbiddenException(
            'You cannot grant access to someone in another company.',
          );
        }
      }
    }

    if (departmentIds.length) {
      const count = await this.prisma.department.count({
        where: { id: { in: departmentIds }, companyId },
      });
      if (count !== new Set(departmentIds).size) {
        throw new ForbiddenException(
          'One or more departments do not belong to this company.',
        );
      }
    }

    if (divisionIds.length) {
      const count = await this.prisma.division.count({
        where: { id: { in: divisionIds }, department: { companyId } },
      });
      if (count !== new Set(divisionIds).size) {
        throw new ForbiddenException(
          'One or more divisions do not belong to this company.',
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Side effects of a permission change
  // -------------------------------------------------------------------------

  /**
   * Audit entry, notices to the people affected, and — when asked for —
   * flagging work those people can no longer reach.
   *
   * All best-effort: the permission change is already committed and was
   * authorised, so a failure to send a notice must not undo it.
   */
  private async applyPermissionChangeEffects(input: {
    resourceType: ResourceType;
    resourceId: string;
    resourceName: string;
    companyId: string | null;
    actor: { id: string; name?: string; email?: string };
    before: AclEntry[];
    after: AclEntry[];
    options: PermissionUpdateOptions;
  }) {
    const {
      resourceType,
      resourceId,
      resourceName,
      companyId,
      actor,
      before,
      after,
      options,
    } = input;

    const { granted, revoked } = diffAcl(before, after);

    await this.recordPermissionChange(resourceType, resourceId, actor.id, after);

    const actorName = actor.name || actor.email || 'An administrator';
    const noun = resourceType === 'folder' ? 'folder' : 'document';

    const grantedUsers = await this.expandSubjects(granted);
    const revokedUsers = await this.expandSubjects(revoked);

    if (options.notify !== false) {
      for (const userId of grantedUsers) {
        await this.notifyQuietly({
          userId,
          companyId,
          type: 'permission_granted',
          title: 'You were given access',
          message: `${actorName} gave you access to the ${noun} "${resourceName}".`,
          resourceType,
          resourceId,
        });
      }

      for (const userId of revokedUsers) {
        await this.notifyQuietly({
          userId,
          companyId,
          type: 'permission_revoked',
          title: 'Your access was removed',
          message: `${actorName} removed your access to the ${noun} "${resourceName}".`,
          resourceType,
          resourceId,
        });
      }
    }

    if (options.onRevoke === 'flag' && revokedUsers.length > 0) {
      await this.flagOrphanedAssignments({
        resourceType,
        resourceId,
        resourceName,
        userIds: revokedUsers,
        actorName,
      });
    }
  }

  /** Resolve department and division entries down to the people they cover. */
  private async expandSubjects(entries: AclEntry[]): Promise<string[]> {
    const userIds = new Set<string>();

    for (const entry of entries) {
      if (entry.subjectType === 'user') userIds.add(entry.subjectId);
    }

    const departmentIds = entries
      .filter((e) => e.subjectType === 'department')
      .map((e) => e.subjectId);
    const divisionIds = entries
      .filter((e) => e.subjectType === 'division')
      .map((e) => e.subjectId);

    try {
      if (departmentIds.length) {
        const members = await this.prisma.userDepartment.findMany({
          where: { departmentId: { in: departmentIds } },
          select: { userId: true },
        });
        for (const m of members) userIds.add(m.userId);
      }
      if (divisionIds.length) {
        const members = await this.prisma.userDivision.findMany({
          where: { divisionId: { in: divisionIds } },
          select: { userId: true },
        });
        for (const m of members) userIds.add(m.userId);
      }
    } catch (error) {
      this.logger.warn(
        `Could not expand ACL subjects: ${(error as Error).message}`,
      );
    }

    return [...userIds];
  }

  /**
   * Mark open actions a newly-revoked user can no longer reach, and tell the
   * action's owner so they can reassign.
   *
   * The action stays assigned rather than being cleared: silently dropping work
   * somebody is part-way through loses more than it fixes.
   */
  private async flagOrphanedAssignments(input: {
    resourceType: ResourceType;
    resourceId: string;
    resourceName: string;
    userIds: string[];
    actorName: string;
  }) {
    const { resourceType, resourceId, resourceName, userIds, actorName } = input;

    try {
      const actions = await this.prisma.action.findMany({
        where: {
          status: { notIn: ['completed', 'cancelled', 'blocked'] },
          assignedToType: 'user',
          assignedToId: { in: userIds },
          ...(resourceType === 'folder'
            ? { OR: [{ folderId: resourceId }, { targetFolderId: resourceId }] }
            : { documentId: resourceId }),
        },
        select: { id: true, title: true, createdBy: true, companyId: true },
      });

      for (const action of actions) {
        await this.prisma.action.update({
          where: { id: action.id },
          data: {
            status: 'blocked',
            resolutionNotes: `Assignee lost access to "${resourceName}" when ${actorName} changed its permissions. Reassign to continue.`,
          },
        });

        await this.notifyQuietly({
          userId: action.createdBy,
          companyId: action.companyId,
          type: 'action_blocked',
          title: 'An action needs reassigning',
          message: `"${action.title}" is blocked: its assignee no longer has access to "${resourceName}".`,
          resourceType: 'action',
          resourceId: action.id,
        });
      }

      if (actions.length > 0) {
        this.logger.log(
          `Flagged ${actions.length} action(s) after access to ${resourceType} ${resourceId} was revoked`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not flag orphaned assignments for ${resourceType} ${resourceId}: ${(error as Error).message}`,
      );
    }
  }

  /** Send a notification, swallowing failures so they cannot fail the request. */
  private async notifyQuietly(data: {
    userId: string;
    companyId: string | null;
    type: string;
    title: string;
    message: string;
    resourceType: string;
    resourceId: string;
  }) {
    try {
      await this.notificationsService.create({ ...data, read: false });
    } catch (error) {
      this.logger.warn(
        `Could not notify ${data.userId} about ${data.type}: ${(error as Error).message}`,
      );
    }
  }

  /** Best-effort audit entry. */
  private async recordPermissionChange(
    resourceType: ResourceType,
    resourceId: string,
    actorId: string,
    acl: AclEntry[],
  ) {
    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { companyId: true },
      });
      if (!actor?.companyId) return;

      const denied = acl.filter((entry) => entry.effect === 'deny').length;
      const granted = acl.length - denied;

      await this.prisma.activity.create({
        data: {
          companyId: actor.companyId,
          userId: actorId,
          activityType: 'permissions_updated',
          resourceType,
          resourceId,
          description: `Updated ${resourceType} permissions: ${granted} granted, ${denied} denied`,
          metadata: {
            granted,
            denied,
            subjects: acl.map((entry) => ({
              type: entry.subjectType,
              id: entry.subjectId,
              effect: entry.effect,
            })),
          } as any,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record permission-change activity for ${resourceType} ${resourceId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // The access decision
  // -------------------------------------------------------------------------

  /**
   * Decide whether `userId` may perform `permission` on a folder or file.
   *
   * Access is need-to-know: nothing is implied by where a resource sits in the
   * hierarchy. Filing a folder under a department records where it belongs; it
   * does not by itself let that department in.
   *
   *   1. Master reaches everything — there must always be a way back in.
   *   2. Another company's resource is always refused.
   *   3. A matching deny beats any grant.
   *   4. The role must carry the capability for this verb.
   *   5. Company-wide roles reach their own company; everyone else needs an ACL
   *      entry naming them, their department or their division.
   *   6. Failing that, the creator keeps access to what they created.
   */
  async checkPermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: ResourcePermission,
  ): Promise<boolean> {
    const decision = await this.decide(
      userId,
      resourceType,
      resourceId,
      permission,
    );
    return decision.allowed;
  }

  async decide(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: ResourcePermission,
  ): Promise<AccessDecision> {
    const permissions = await this.getEffectivePermissions(userId).catch(
      () => null,
    );
    if (!permissions) return { allowed: false, reason: 'not_found' };

    const resource = await this.loadResource(resourceType, resourceId);
    if (!resource) return { allowed: false, reason: 'not_found' };

    // 1. An instance-wide scope is not subject to ACLs. This guarantees a
    //    resource can always be recovered — without it, an administrator who
    //    denied themselves `manage` would lock the folder permanently. Someone
    //    at that level can read the database regardless, so a deny here would
    //    be a false assurance rather than a real control.
    if (permissions.dataScope === 'all') {
      return { allowed: true, reason: 'instance_scope' };
    }

    // 2. Company isolation is absolute below that level.
    if (!resource.companyId || resource.companyId !== permissions.companyId) {
      return { allowed: false, reason: 'other_company' };
    }

    const subject: SubjectContext = {
      userId,
      departmentIds: permissions.departmentIds,
      divisionIds: permissions.divisionIds,
    };

    const acl = await this.resolveAclFor(resourceType, resource);
    const applicable = acl.filter((entry) => entryApplies(entry, subject));

    // 3. Any matching deny wins, whichever subject it arrived through.
    if (
      applicable.some(
        (entry) =>
          entry.effect === 'deny' && entry.permissions.includes(permission),
      )
    ) {
      return { allowed: false, reason: 'explicit_deny' };
    }

    // 4. The role must carry the capability for this verb.
    const capability = REQUIRED_CAPABILITY[resourceType][permission];
    if (!permissions.capabilities.includes(capability)) {
      return { allowed: false, reason: 'missing_capability' };
    }

    // 5a. A company-wide administrative scope reaches its own company. Someone
    //     has to be able to administer the company's records.
    if (permissions.dataScope === 'company') {
      return { allowed: true, reason: 'company_scope' };
    }

    // 5b. Otherwise an explicit grant is required. This is the need-to-know
    //     rule: being in the department a folder is filed under is not enough,
    //     the folder has to name that department.
    if (
      applicable.some(
        (entry) =>
          entry.effect !== 'deny' && entry.permissions.includes(permission),
      )
    ) {
      return { allowed: true, reason: 'explicit_grant' };
    }

    // 6. Creators keep access to their own records.
    if (resource.createdBy === userId) {
      return { allowed: true, reason: 'creator' };
    }

    return { allowed: false, reason: 'no_grant' };
  }

  /** Assert a permission, raising 403/404 rather than returning false. */
  async assertPermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: ResourcePermission,
  ): Promise<void> {
    const decision = await this.decide(
      userId,
      resourceType,
      resourceId,
      permission,
    );

    if (decision.allowed) return;

    if (decision.reason === 'not_found') {
      throw new NotFoundException(`That ${resourceType} does not exist.`);
    }

    const build = DENIAL_MESSAGE[decision.reason];
    throw new ForbiddenException(
      build
        ? build(resourceType)
        : `You do not have permission to ${permission} this ${resourceType}.`,
    );
  }

  /**
   * Can the user open this folder at all?
   *
   * Broader than `read`: someone granted a single file inside a folder needs to
   * be able to open the folder to reach it. They see only the files they were
   * granted — the folder's other contents stay hidden — so this reveals the
   * folder's name and nothing more.
   */
  async canOpenFolder(userId: string, folderId: string): Promise<boolean> {
    if (await this.checkPermission(userId, 'folder', folderId, 'read')) {
      return true;
    }

    const links = await this.prisma.fileFolderLink.findMany({
      where: { folderId },
      select: { fileId: true },
    });

    for (const link of links) {
      if (await this.checkPermission(userId, 'file', link.fileId, 'read')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Attach an `access` block to each item so the UI renders from the same
   * decision the API enforces, instead of re-deriving it.
   *
   * Items the user cannot read are annotated, not removed: they still need to
   * see that something exists in order to request access to it.
   */
  async annotateAccess<T extends { id: string }>(
    userId: string,
    resourceType: ResourceType,
    items: T[],
  ): Promise<Array<T & { access: { canRead: boolean; reason: AccessDecision['reason'] } }>> {
    return Promise.all(
      items.map(async (item) => {
        const decision = await this.decide(userId, resourceType, item.id, 'read');
        return {
          ...item,
          access: { canRead: decision.allowed, reason: decision.reason },
        };
      }),
    );
  }

  /** Narrow a list of resources to those the user may read. */
  async filterReadable<T extends { id: string }>(
    userId: string,
    resourceType: ResourceType,
    resources: T[],
  ): Promise<T[]> {
    const results = await Promise.all(
      resources.map(async (resource) => ({
        resource,
        allowed: await this.checkPermission(
          userId,
          resourceType,
          resource.id,
          'read',
        ),
      })),
    );
    return results.filter((r) => r.allowed).map((r) => r.resource);
  }

  private async loadResource(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceDescriptor | null> {
    if (!resourceId) return null;

    const select = {
      id: true,
      companyId: true,
      scopeLevel: true,
      departmentId: true,
      divisionId: true,
      createdBy: true,
    };

    if (resourceType === 'folder') {
      return this.prisma.folder.findUnique({
        where: { id: resourceId },
        select,
      });
    }
    return this.prisma.file.findUnique({ where: { id: resourceId }, select });
  }

  /** Every ACL entry that applies to a resource, inheritance included. */
  private async resolveAclFor(
    resourceType: ResourceType,
    resource: ResourceDescriptor,
  ): Promise<AclEntry[]> {
    if (resourceType === 'folder') {
      const permissions = await this.getFolderPermissions(resource.id).catch(
        () => null,
      );
      return (permissions?.explicitPermissions ?? []) as AclEntry[];
    }

    // A file can sit in several folders; take the union, and let any deny win.
    const links = await this.prisma.fileFolderLink.findMany({
      where: { fileId: resource.id },
      select: { folderId: true, permissionsJson: true },
    });

    const merged = new Map<string, AclEntry>();
    for (const link of links) {
      const folderPermissions = await this.getFolderPermissions(
        link.folderId,
      ).catch(() => null);
      const entries = [
        ...((folderPermissions?.explicitPermissions ?? []) as AclEntry[]),
        ...normaliseAcl(link.permissionsJson),
      ];
      for (const entry of entries) {
        const existing = merged.get(entryKey(entry));
        if (!existing || entry.effect === 'deny') {
          merged.set(entryKey(entry), entry);
        }
      }
    }

    return [...merged.values()];
  }
}

/** Wording for each refusal, so the UI can show something specific. */
const DENIAL_MESSAGE: Partial<
  Record<AccessDecision['reason'], (resourceType: ResourceType) => string>
> = {
  explicit_deny: (t) => `Your access to this ${t} has been revoked.`,
  missing_capability: (t) => `Your role cannot perform this action on a ${t}.`,
  other_company: (t) => `This ${t} belongs to another company.`,
  no_grant: (t) =>
    `You have not been granted access to this ${t}. You can request it.`,
};
