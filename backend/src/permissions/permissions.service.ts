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
  hasCapability,
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
  isSignatureAclSource,
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
  /**
   * Allow `source: signature:<requestId>` entries. Only the server-side
   * signature grant/revoke paths should set this — never the public Share UI.
   */
  allowSignatureSources?: boolean;
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
  /** Files only. When set, only instance-scoped roles may open the file. */
  accessRevokedAt?: Date | null;
}

/** Why a request was allowed or refused — drives audit entries and tooltips. */
export interface AccessDecision {
  allowed: boolean;
  reason:
    | 'instance_scope'
    | 'company_scope'
    | 'department_scope'
    | 'division_scope'
    | 'explicit_grant'
    | 'signature_invite'
    | 'workflow_participant'
    | 'creator'
    | 'explicit_deny'
    | 'missing_capability'
    | 'no_grant'
    | 'other_company'
    | 'access_revoked'
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
        accessRevokedAt: true,
        accessRevokedBy: true,
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
      accessRevokedAt: file.accessRevokedAt,
      accessRevokedBy: file.accessRevokedBy,
      explicitPermissions,
      inheritedPermissions,
    };
  }

  /**
   * Lock or unlock a file for everyone except Master / Group Secretary.
   * ACL rows stay in place so restoring access brings the previous grants
   * back; the lock sits above them in decide().
   */
  async setFileAccessRevoked(
    fileId: string,
    revoked: boolean,
    currentUser: { id: string; name?: string },
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        fileName: true,
        companyId: true,
        accessRevokedAt: true,
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: revoked
        ? { accessRevokedAt: new Date(), accessRevokedBy: currentUser.id }
        : { accessRevokedAt: null, accessRevokedBy: null },
      select: {
        id: true,
        fileName: true,
        accessRevokedAt: true,
        accessRevokedBy: true,
      },
    });

    if (revoked) {
      await this.rejectPendingAccessRequestsForFile(
        fileId,
        currentUser.id,
        currentUser.name || 'Group administrator',
      );
    }

    return updated;
  }

  async isFileAccessRevoked(fileId: string): Promise<boolean> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { accessRevokedAt: true },
    });
    return !!file?.accessRevokedAt;
  }

  private async rejectPendingAccessRequestsForFile(
    fileId: string,
    rejectedBy: string,
    rejectedByName: string,
  ) {
    const pending = await this.prisma.accessRequest.findMany({
      where: {
        resourceId: fileId,
        resourceType: { in: ['file', 'document'] },
        status: 'pending',
      },
      select: { id: true, requestedBy: true, companyId: true, resourceName: true },
    });
    if (pending.length === 0) return;

    const now = new Date();
    await this.prisma.accessRequest.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: {
        status: 'rejected',
        rejectedBy,
        rejectedByName,
        rejectedAt: now,
        rejectionReason:
          'Access to this file was revoked by a group administrator.',
      },
    });

    for (const request of pending) {
      try {
        await this.notificationsService.create({
          userId: request.requestedBy,
          companyId: request.companyId,
          type: 'access_request_rejected',
          title: 'Access request closed',
          message: `Access to "${request.resourceName}" was revoked by a group administrator, so this request was closed.`,
          resourceType: 'file',
          resourceId: fileId,
          read: false,
        });
      } catch {
        // A missed notice must not roll back the lock.
      }
    }
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
    const acl = await this.validateAcl(
      permissions,
      link.file?.companyId ?? null,
      { allowSignatureSources: options.allowSignatureSources },
    );

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
      allowSignatureSources: !!options.source && isSignatureAclSource(options.source),
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
      allowSignatureSources:
        !!options.source && isSignatureAclSource(options.source),
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
        allowSignatureSources: true,
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
    const acl = await this.validateAcl(permissions, folder.companyId, {
      allowSignatureSources: options.allowSignatureSources,
    });

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
   * must exist and belong to the same company as the resource — except temporary
   * signature invites created by the signing flow (`allowSignatureSources`).
   */
  private async validateAcl(
    permissions: unknown,
    companyId: string | null,
    options: { allowSignatureSources?: boolean } = {},
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
      if (
        isSignatureAclSource(entry.source) &&
        !options.allowSignatureSources
      ) {
        throw new BadRequestException(
          'Signature access grants can only be created by the signing flow.',
        );
      }
    }

    if (companyId) {
      await this.assertSubjectsInCompany(acl, companyId, options);
    }

    return acl;
  }

  private async assertSubjectsInCompany(
    acl: AclEntry[],
    companyId: string,
    options: { allowSignatureSources?: boolean } = {},
  ) {
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
          // Signature invites are the one intentional cross-company share,
          // and only when the server-side signing flow opts in.
          const entriesForUser = acl.filter(
            (e) => e.subjectType === 'user' && e.subjectId === id,
          );
          const allSignatureInvites =
            !!options.allowSignatureSources &&
            entriesForUser.every((e) => isSignatureAclSource(e.source));
          if (!allSignatureInvites) {
            throw new ForbiddenException(
              'You cannot grant access to someone in another company.',
            );
          }
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
   *   1. Master reaches everything — there must always be a way back in.
   *   2. Another company's resource is refused, except temporary signature
   *      invites (ACL source `signature:<requestId>`) and active invitees.
   *   3. A matching deny beats any grant.
   *   4. The role must carry the capability for this verb. Named workflow
   *      assignees and signature invitees may then read that one file.
   *   5. Scope reach: company roles reach their company; roles with
   *      `documents.inherit_domain` reach resources published into their
   *      department or division. Staff / Manager do not inherit that way.
   *   6. Otherwise an ACL entry must name them. Domain inheritors also honour
   *      collective ACL, except a division-scoped inheritor ignores parent
   *      department opening grants.
   *   7. Failing that, the creator keeps access to what they created.
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

    // 1b. A group-level lock beats every other grant: company scope, domain
    //     inherit, named ACL, creator, workflow, and signature invites.
    //     Instance-scoped roles already returned above, so they can still
    //     recover the file and restore access.
    if (resourceType === 'file' && resource.accessRevokedAt) {
      return { allowed: false, reason: 'access_revoked' };
    }

    const subject: SubjectContext = {
      userId,
      departmentIds: permissions.departmentIds,
      divisionIds: permissions.divisionIds,
    };

    const acl = await this.resolveAclFor(resourceType, resource);
    const applicable = acl.filter((entry) => entryApplies(entry, subject));

    const crossCompany =
      !resource.companyId || resource.companyId !== permissions.companyId;

    const hasSignatureAclGrant =
      crossCompany &&
      applicable.some(
        (entry) =>
          entry.effect !== 'deny' &&
          entry.permissions.includes(permission) &&
          isSignatureAclSource(entry.source),
      );

    // 2. Company isolation — signature invites are the deliberate exception so
    //    a company can request sign-off from someone in another company.
    if (crossCompany && !hasSignatureAclGrant) {
      if (
        resourceType === 'file' &&
        permission === 'read' &&
        (await this.isActiveSignatureInvitee(userId, resourceId))
      ) {
        const capability = REQUIRED_CAPABILITY[resourceType][permission];
        if (!permissions.capabilities.includes(capability)) {
          return { allowed: false, reason: 'missing_capability' };
        }
        return { allowed: true, reason: 'signature_invite' };
      }
      return { allowed: false, reason: 'other_company' };
    }

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

    // 4b. Anyone invited to sign this file may open it (same company or not).
    //     Temporary ACL grants are best-effort; this covers missed grants and
    //     files that are not linked to a folder yet.
    if (
      resourceType === 'file' &&
      permission === 'read' &&
      (await this.isActiveSignatureInvitee(userId, resourceId))
    ) {
      return { allowed: true, reason: 'signature_invite' };
    }

    // 4c. A named user currently on a workflow may read files attached to
    //     (or primary on) that workflow — so an assignee can work without a
    //     separate folder ACL. Department assignment and routing-history
    //     hops are not a file-read grant: membership in Legal must not open
    //     a Restricted board paper. Non-assignees still need an explicit
    //     grant.
    if (
      resourceType === 'file' &&
      permission === 'read' &&
      (await this.isActiveWorkflowFileParticipant(userId, resourceId))
    ) {
      return { allowed: true, reason: 'workflow_participant' };
    }

    // 5a. A company-wide administrative scope reaches its own company. Someone
    //     has to be able to administer the company's records. Never apply this
    //     across companies — signature invites stay limited to the granted verbs.
    if (!crossCompany && permissions.dataScope === 'company') {
      return { allowed: true, reason: 'company_scope' };
    }

    // 5b. Roles with `documents.inherit_domain` reach resources published
    //     into their domain. Staff / Manager do not — they need a user-named
    //     ACL grant or an approved access request.
    const inheritsDomain = hasCapability(
      permissions,
      'documents.inherit_domain',
    );
    if (
      inheritsDomain &&
      !crossCompany &&
      permissions.dataScope === 'department' &&
      (resource.scopeLevel === 'department' ||
        resource.scopeLevel === 'division') &&
      resource.departmentId &&
      permissions.departmentIds.includes(resource.departmentId)
    ) {
      return { allowed: true, reason: 'department_scope' };
    }
    if (
      inheritsDomain &&
      !crossCompany &&
      permissions.dataScope === 'division' &&
      resource.scopeLevel === 'division' &&
      resource.divisionId &&
      permissions.divisionIds.includes(resource.divisionId)
    ) {
      return { allowed: true, reason: 'division_scope' };
    }

    // 5c. Explicit grants. Without inherit_domain, only a user-named ACL
    //     counts. Division-scoped inheritors honour user + division grants,
    //     not parent-department opening grants (Legal memos stay Restricted
    //     for a Contracts Division Head).
    const grantEntries = this.grantEntriesFor(permissions, applicable);
    if (
      grantEntries.some(
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

  /**
   * Which ACL entries this role may use as an explicit grant.
   * Staff / Manager / Receptionist: user subjects only.
   * Division-scoped domain inheritors: user + division (not department).
   * Department-scoped inheritors: every applicable subject.
   */
  private grantEntriesFor(
    permissions: EffectivePermissions,
    applicable: AclEntry[],
  ): AclEntry[] {
    if (!hasCapability(permissions, 'documents.inherit_domain')) {
      return applicable.filter((entry) => entry.subjectType === 'user');
    }
    if (permissions.dataScope === 'division') {
      return applicable.filter(
        (entry) =>
          entry.subjectType === 'user' || entry.subjectType === 'division',
      );
    }
    return applicable;
  }

  /**
   * True when this user may open a file because of a signature invite:
   * - pending invitee on an open request, or
   * - anyone who already signed that file (keeps access after completion
   *   when temporary ACL grants are revoked).
   */
  private async isActiveSignatureInvitee(
    userId: string,
    fileId: string,
  ): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      const identityFilter = {
        OR: [
          { userId },
          ...(user?.email
            ? [
                {
                  email: {
                    equals: user.email,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      };

      const row = await this.prisma.signatureParticipant.findFirst({
        where: {
          AND: [
            identityFilter,
            {
              OR: [
                {
                  status: 'pending',
                  request: { fileId, status: 'pending' },
                },
                {
                  status: 'signed',
                  request: { fileId },
                },
              ],
            },
          ],
        },
        select: { id: true },
      });
      return !!row;
    } catch {
      return false;
    }
  }

  /**
   * True when this user is a named assignee on a workflow that lists the
   * file as its primary document or an attached WorkflowFile.
   *
   * Named: workflow creator, current user assignee, or an action assigned
   * to them as a user. Department assignment, department actions, and
   * routing-history hops (user or department) do not count — those would
   * reopen Restricted files to everyone in the department, including after
   * the hop has passed.
   */
  private async isActiveWorkflowFileParticipant(
    userId: string,
    fileId: string,
  ): Promise<boolean> {
    try {
      const workflows = await this.prisma.workflow.findMany({
        where: {
          OR: [
            { documentId: fileId },
            { files: { some: { fileId } } },
          ],
        },
        select: {
          assignedBy: true,
          assignedToType: true,
          assignedToId: true,
          actions: {
            select: {
              assignedToType: true,
              assignedToId: true,
            },
          },
        },
      });

      return workflows.some((workflow) =>
        this.isNamedWorkflowFileAssignee(userId, workflow),
      );
    } catch {
      return false;
    }
  }

  private isNamedWorkflowFileAssignee(
    userId: string,
    workflow: {
      assignedBy: string;
      assignedToType: string | null;
      assignedToId: string | null;
      actions: Array<{
        assignedToType: string | null;
        assignedToId: string | null;
      }>;
    },
  ): boolean {
    if (workflow.assignedBy === userId) return true;
    if (
      workflow.assignedToType === 'user' &&
      workflow.assignedToId === userId
    ) {
      return true;
    }
    return workflow.actions.some(
      (action) =>
        action.assignedToType === 'user' && action.assignedToId === userId,
    );
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

    if (resourceType === 'folder') {
      return this.prisma.folder.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          companyId: true,
          scopeLevel: true,
          departmentId: true,
          divisionId: true,
          createdBy: true,
        },
      });
    }
    return this.prisma.file.findUnique({
      where: { id: resourceId },
      select: {
        id: true,
        companyId: true,
        scopeLevel: true,
        departmentId: true,
        divisionId: true,
        createdBy: true,
        accessRevokedAt: true,
      },
    });
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
  access_revoked: (t) =>
    `Access to this ${t} has been revoked by a group administrator.`,
  missing_capability: (t) => `Your role cannot perform this action on a ${t}.`,
  other_company: (t) => `This ${t} belongs to another company.`,
  no_grant: (t) =>
    `You have not been granted access to this ${t}. You can request it.`,
};
