import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import {
  ROLE_DEFINITIONS_BY_NAME,
  toRolePermissionsJson,
} from './capabilities';
import { AclEntry } from './acl';

/**
 * These exercise `decide()` — the single function every read and write in the
 * API funnels through. The rules it encodes (company isolation, deny-wins,
 * capability-then-scope, need-to-know, creator fallback) are the ones a
 * regression would quietly hand one company's documents to another, so they
 * are pinned here rather than left to inspection.
 *
 * Prisma is replaced with an in-memory fixture rather than the whole service
 * being stubbed, so the real decision path runs end to end.
 */

interface Fixture {
  users: any[];
  folders: any[];
  files: any[];
  fileFolderLinks: any[];
  signatureParticipants?: any[];
  workflows?: Array<{
    documentId?: string | null;
    files?: Array<{ fileId: string }>;
    assignedBy: string;
    assignedToType: string | null;
    assignedToId: string | null;
    status?: string;
    actions?: Array<{
      assignedToType: string | null;
      assignedToId: string | null;
      status?: string;
    }>;
  }>;
}

const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';
const DEPT_LEGAL = 'dept-legal';
const DIV_CONTRACTS = 'div-contracts';

/** A user row shaped the way `getEffectivePermissions` expects to read it. */
function makeUser(
  id: string,
  roleName: string,
  {
    companyId = COMPANY_A,
    departmentIds = [] as string[],
    divisionIds = [] as string[],
  } = {},
) {
  const definition = ROLE_DEFINITIONS_BY_NAME.get(roleName);
  if (!definition) throw new Error(`Unknown role in fixture: ${roleName}`);

  return {
    id,
    companyId,
    userRoles: [
      {
        role: {
          name: definition.name,
          permissionsJson: toRolePermissionsJson(definition),
          canAssignDocuments: definition.canAssignDocuments,
        },
      },
    ],
    userDepartments: departmentIds.map((departmentId) => ({ departmentId })),
    userDivisions: divisionIds.map((divisionId) => ({ divisionId })),
  };
}

function makeFolder(
  id: string,
  {
    companyId = COMPANY_A,
    createdBy = 'someone-else',
    scopeLevel = 'company',
    departmentId = null as string | null,
    divisionId = null as string | null,
    parentFolderId = null as string | null,
    permissionsJson = null as AclEntry[] | null,
  } = {},
) {
  return {
    id,
    name: id,
    companyId,
    createdBy,
    scopeLevel,
    departmentId,
    divisionId,
    parentFolderId,
    permissionsJson,
  };
}

function makeFile(
  id: string,
  {
    companyId = COMPANY_A,
    createdBy = 'someone-else',
    accessRevokedAt = null as Date | null,
  } = {},
) {
  return {
    id,
    companyId,
    createdBy,
    scopeLevel: 'company',
    departmentId: null,
    divisionId: null,
    accessRevokedAt,
  };
}

function buildService(fixture: Fixture) {
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) =>
        fixture.users.find((u) => u.id === where.id) ?? null,
    },
    folder: {
      findUnique: async ({ where }: any) =>
        fixture.folders.find((f) => f.id === where.id) ?? null,
    },
    file: {
      findUnique: async ({ where }: any) =>
        fixture.files.find((f) => f.id === where.id) ?? null,
    },
    fileFolderLink: {
      findMany: async ({ where }: any) =>
        fixture.fileFolderLinks.filter((l) => l.fileId === where.fileId),
    },
    workflow: {
      findMany: async ({ where, select }: any) => {
        const rows = fixture.workflows ?? [];
        const clauses = where?.OR ?? [where];
        const workflowStatusNotIn: string[] | undefined = where?.status?.notIn;
        const actionStatusNotIn: string[] | undefined =
          select?.actions?.where?.status?.notIn;

        return rows
          .filter((workflow) => {
            if (
              workflowStatusNotIn &&
              workflow.status &&
              workflowStatusNotIn.includes(workflow.status)
            ) {
              return false;
            }
            return clauses.some((clause: any) => {
              if (clause?.documentId) {
                return workflow.documentId === clause.documentId;
              }
              if (clause?.files?.some?.fileId) {
                return (workflow.files ?? []).some(
                  (link) => link.fileId === clause.files.some.fileId,
                );
              }
              return false;
            });
          })
          .map((workflow) => ({
            ...workflow,
            actions: (workflow.actions ?? []).filter((action) => {
              if (!actionStatusNotIn || !action.status) return true;
              return !actionStatusNotIn.includes(action.status);
            }),
          }));
      },
    },
    signatureParticipant: {
      findFirst: async ({ where }: any) => {
        const rows = fixture.signatureParticipants ?? [];

        const matchesIdentity = (row: any, identity: any) => {
          if (Array.isArray(identity?.OR)) {
            return identity.OR.some((clause: any) => {
              if (clause.userId) return row.userId === clause.userId;
              if (clause.email?.equals) {
                return (
                  String(row.email || '').toLowerCase() ===
                  String(clause.email.equals).toLowerCase()
                );
              }
              return false;
            });
          }
          if (identity?.userId) return row.userId === identity.userId;
          return true;
        };

        const matchesInviteClause = (row: any, clause: any) => {
          if (clause.status && row.status !== clause.status) return false;
          if (
            clause.status?.in &&
            !clause.status.in.includes(row.status)
          ) {
            return false;
          }
          if (
            clause.request?.fileId &&
            row.request?.fileId !== clause.request.fileId
          ) {
            return false;
          }
          if (
            clause.request?.status &&
            row.request?.status !== clause.request.status
          ) {
            return false;
          }
          return true;
        };

        return (
          rows.find((row) => {
            // Shape: { AND: [ identityFilter, { OR: [pending…, signed…] } ] }
            if (Array.isArray(where.AND) && where.AND.length >= 2) {
              const [identity, statusBlock] = where.AND;
              if (!matchesIdentity(row, identity)) return false;
              if (Array.isArray(statusBlock?.OR)) {
                return statusBlock.OR.some((clause: any) =>
                  matchesInviteClause(row, clause),
                );
              }
              return matchesInviteClause(row, statusBlock);
            }

            if (
              where.status?.in &&
              !where.status.in.includes(row.status)
            ) {
              return false;
            }
            if (
              where.request?.fileId &&
              row.request?.fileId !== where.request.fileId
            ) {
              return false;
            }
            if (
              where.request?.status &&
              row.request?.status !== where.request.status
            ) {
              return false;
            }
            // Legacy shape: OR [ { userId }, { email } ]
            if (Array.isArray(where.OR)) {
              return where.OR.some((clause: any) => {
                if (clause.userId) return row.userId === clause.userId;
                if (clause.email?.equals) {
                  return (
                    String(row.email || '').toLowerCase() ===
                    String(clause.email.equals).toLowerCase()
                  );
                }
                return false;
              });
            }
            if (where.userId && row.userId !== where.userId) return false;
            return true;
          }) ?? null
        );
      },
    },
  };

  const notifications: any = { create: jest.fn() };
  return new PermissionsService(prisma, notifications);
}

const allow = (
  subjectType: AclEntry['subjectType'],
  subjectId: string,
  permissions: AclEntry['permissions'],
): AclEntry => ({ subjectType, subjectId, permissions, effect: 'allow' });

const deny = (
  subjectType: AclEntry['subjectType'],
  subjectId: string,
  permissions: AclEntry['permissions'],
): AclEntry => ({ subjectType, subjectId, permissions, effect: 'deny' });

describe('PermissionsService.decide', () => {
  describe('company isolation', () => {
    it('refuses a folder belonging to another company', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Company Admin', { companyId: COMPANY_A })],
        folders: [makeFolder('f1', { companyId: COMPANY_B })],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'other_company' });
    });

    it('lets a signature invitee from another company read the file', async () => {
      const service = buildService({
        users: [
          makeUser('signer-b', 'Company Secretary', { companyId: COMPANY_B }),
        ],
        folders: [makeFolder('folder-a', { companyId: COMPANY_A })],
        files: [makeFile('file-a', { companyId: COMPANY_A })],
        fileFolderLinks: [
          {
            fileId: 'file-a',
            folderId: 'folder-a',
            permissionsJson: [
              {
                subjectType: 'user',
                subjectId: 'signer-b',
                userId: 'signer-b',
                permissions: ['read'],
                effect: 'allow',
                source: 'signature:req-1',
              },
            ],
          },
        ],
        signatureParticipants: [],
      });

      const decision = await service.decide('signer-b', 'file', 'file-a', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'explicit_grant' });
    });

    it('lets an active signature invitee read across companies without an ACL row', async () => {
      const service = buildService({
        users: [
          makeUser('signer-b', 'Division Head', { companyId: COMPANY_B }),
        ],
        folders: [makeFolder('folder-a', { companyId: COMPANY_A })],
        files: [makeFile('file-a', { companyId: COMPANY_A })],
        fileFolderLinks: [
          { fileId: 'file-a', folderId: 'folder-a', permissionsJson: [] },
        ],
        signatureParticipants: [
          {
            id: 'sp-1',
            userId: 'signer-b',
            status: 'pending',
            request: { fileId: 'file-a', status: 'pending' },
          },
        ],
      });

      const decision = await service.decide('signer-b', 'file', 'file-a', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'signature_invite' });
    });

    it('lets a same-company signature invitee read without an ACL row', async () => {
      const service = buildService({
        users: [
          makeUser('signer-a', 'Staff', {
            companyId: COMPANY_A,
            departmentIds: [DEPT_LEGAL],
          }),
        ],
        folders: [makeFolder('folder-a', { companyId: COMPANY_A })],
        files: [makeFile('file-a', { companyId: COMPANY_A })],
        fileFolderLinks: [
          { fileId: 'file-a', folderId: 'folder-a', permissionsJson: [] },
        ],
        signatureParticipants: [
          {
            id: 'sp-2',
            userId: 'signer-a',
            status: 'pending',
            request: { fileId: 'file-a', status: 'pending' },
          },
        ],
      });

      const decision = await service.decide('signer-a', 'file', 'file-a', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'signature_invite' });
    });

    it('lets a signer keep read access after the request completes', async () => {
      const service = buildService({
        users: [
          makeUser('signer-b', 'Division Head', { companyId: COMPANY_B }),
        ],
        folders: [makeFolder('folder-a', { companyId: COMPANY_A })],
        files: [makeFile('file-a', { companyId: COMPANY_A })],
        fileFolderLinks: [
          { fileId: 'file-a', folderId: 'folder-a', permissionsJson: [] },
        ],
        signatureParticipants: [
          {
            id: 'sp-3',
            userId: 'signer-b',
            status: 'signed',
            request: { fileId: 'file-a', status: 'completed' },
          },
        ],
      });

      const decision = await service.decide('signer-b', 'file', 'file-a', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'signature_invite' });
    });

    it('still refuses cross-company write even with a signature read grant', async () => {
      const service = buildService({
        users: [
          makeUser('signer-b', 'Company Secretary', { companyId: COMPANY_B }),
        ],
        folders: [makeFolder('folder-a', { companyId: COMPANY_A })],
        files: [makeFile('file-a', { companyId: COMPANY_A })],
        fileFolderLinks: [
          {
            fileId: 'file-a',
            folderId: 'folder-a',
            permissionsJson: [
              {
                subjectType: 'user',
                subjectId: 'signer-b',
                userId: 'signer-b',
                permissions: ['read'],
                effect: 'allow',
                source: 'signature:req-1',
              },
            ],
          },
        ],
        signatureParticipants: [],
      });

      const decision = await service.decide('signer-b', 'file', 'file-a', 'write');

      expect(decision).toEqual({ allowed: false, reason: 'other_company' });
    });

    it('lets an instance-wide role cross company boundaries', async () => {
      const service = buildService({
        users: [makeUser('master', 'Master', { companyId: COMPANY_A })],
        folders: [makeFolder('f1', { companyId: COMPANY_B })],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('master', 'folder', 'f1', 'delete');

      expect(decision).toEqual({ allowed: true, reason: 'instance_scope' });
    });

    it('an instance-wide role is not blocked by an explicit deny', async () => {
      const service = buildService({
        users: [makeUser('master', 'Master')],
        folders: [
          makeFolder('f1', {
            permissionsJson: [deny('user', 'master', ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('master', 'folder', 'f1', 'read');

      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBe('instance_scope');
    });
  });

  describe('deny precedence', () => {
    it('a deny beats a grant for the same user', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff', { divisionIds: [DIV_CONTRACTS] })],
        folders: [
          makeFolder('f1', {
            permissionsJson: [
              allow('user', 'u1', ['read']),
              deny('user', 'u1', ['read']),
            ],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'explicit_deny' });
    });

    it('a deny arriving via department beats a direct user grant', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff', { departmentIds: [DEPT_LEGAL] })],
        folders: [
          makeFolder('f1', {
            permissionsJson: [
              allow('user', 'u1', ['read']),
              deny('department', DEPT_LEGAL, ['read']),
            ],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'explicit_deny' });
    });

    it('a deny outranks the creator fallback', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('f1', {
            createdBy: 'u1',
            permissionsJson: [deny('user', 'u1', ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'explicit_deny' });
    });
  });

  describe('capability gate', () => {
    it('refuses a verb the role does not carry, even inside its own company', async () => {
      // Staff has documents.view but not folders.delete.
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [makeFolder('f1', { createdBy: 'u1' })],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'delete');

      expect(decision).toEqual({ allowed: false, reason: 'missing_capability' });
    });

    it('a company-scoped role reaches its own company without an ACL entry', async () => {
      const service = buildService({
        users: [makeUser('admin', 'Company Admin')],
        folders: [makeFolder('f1')],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('admin', 'folder', 'f1', 'delete');

      expect(decision).toEqual({ allowed: true, reason: 'company_scope' });
    });
  });

  describe('domain reach for department and division scopes', () => {
    it('department scope reaches resources filed under the user department', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Department Head', { departmentIds: [DEPT_LEGAL] }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'division',
            departmentId: DEPT_LEGAL,
            divisionId: DIV_CONTRACTS,
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'department_scope' });
    });

    it('department scope does not auto-open company-wide files', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Department Head', { departmentIds: [DEPT_LEGAL] }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'company',
            departmentId: DEPT_LEGAL,
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('department scope does not reach another department', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Department Head', { departmentIds: [DEPT_LEGAL] }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'department',
            departmentId: 'dept-other',
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('division scope reaches resources filed under the user division', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Division Head', { divisionIds: [DIV_CONTRACTS] }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'division',
            departmentId: DEPT_LEGAL,
            divisionId: DIV_CONTRACTS,
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'division_scope' });
    });

    it('an explicit department grant still allows access', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Department Head', { departmentIds: [DEPT_LEGAL] }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'department',
            departmentId: DEPT_LEGAL,
            permissionsJson: [allow('department', DEPT_LEGAL, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision.allowed).toBe(true);
      expect(['department_scope', 'explicit_grant']).toContain(decision.reason);
    });

    it('Division Head cannot use a parent-department opening grant', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Division Head', {
            departmentIds: [DEPT_LEGAL],
            divisionIds: [DIV_CONTRACTS],
          }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'department',
            departmentId: DEPT_LEGAL,
            permissionsJson: [allow('department', DEPT_LEGAL, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('Division Head can use a division opening grant', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Division Head', {
            departmentIds: [DEPT_LEGAL],
            divisionIds: [DIV_CONTRACTS],
          }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'company',
            departmentId: DEPT_LEGAL,
            divisionId: DIV_CONTRACTS,
            permissionsJson: [allow('division', DIV_CONTRACTS, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'explicit_grant' });
    });

    it('a grant to a division the user is not in does not apply', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff', { divisionIds: ['div-other'] })],
        folders: [
          makeFolder('f1', {
            permissionsJson: [allow('division', DIV_CONTRACTS, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('Staff cannot use division domain reach or division opening grants', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Staff', {
            departmentIds: [DEPT_LEGAL],
            divisionIds: [DIV_CONTRACTS],
          }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'division',
            departmentId: DEPT_LEGAL,
            divisionId: DIV_CONTRACTS,
            permissionsJson: [allow('division', DIV_CONTRACTS, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('Staff can open when named on a user ACL grant', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Staff', {
            departmentIds: [DEPT_LEGAL],
            divisionIds: [DIV_CONTRACTS],
          }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'division',
            departmentId: DEPT_LEGAL,
            divisionId: DIV_CONTRACTS,
            permissionsJson: [
              allow('division', DIV_CONTRACTS, ['read']),
              allow('user', 'u1', ['read']),
            ],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'explicit_grant' });
    });

    it('Manager cannot inherit department opening grants', async () => {
      const service = buildService({
        users: [
          makeUser('u1', 'Manager', {
            departmentIds: [DEPT_LEGAL],
            divisionIds: [DIV_CONTRACTS],
          }),
        ],
        folders: [
          makeFolder('f1', {
            scopeLevel: 'department',
            departmentId: DEPT_LEGAL,
            permissionsJson: [allow('department', DEPT_LEGAL, ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'no_grant' });
    });

    it('falls back to the creator when nothing else grants', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [makeFolder('f1', { createdBy: 'u1' })],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'creator' });
    });
  });

  describe('inheritance down the folder tree', () => {
    it('a grant on the parent reaches the child', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('parent', {
            permissionsJson: [allow('user', 'u1', ['read'])],
          }),
          makeFolder('child', { parentFolderId: 'parent' }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'child', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'explicit_grant' });
    });

    it('a child can revoke what the parent granted', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('parent', {
            permissionsJson: [allow('user', 'u1', ['read'])],
          }),
          makeFolder('child', {
            parentFolderId: 'parent',
            permissionsJson: [deny('user', 'u1', ['read'])],
          }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'child', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'explicit_deny' });
    });

    it('survives a cycle in the folder hierarchy', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('a', { parentFolderId: 'b' }),
          makeFolder('b', { parentFolderId: 'a' }),
        ],
        files: [],
        fileFolderLinks: [],
      });

      await expect(service.decide('u1', 'folder', 'a', 'read')).resolves.toEqual(
        { allowed: false, reason: 'no_grant' },
      );
    });
  });

  describe('files across multiple folders', () => {
    it('takes the union of grants from every folder the file sits in', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('f-open', {
            permissionsJson: [allow('user', 'u1', ['read'])],
          }),
          makeFolder('f-other'),
        ],
        files: [makeFile('file1')],
        fileFolderLinks: [
          { fileId: 'file1', folderId: 'f-open', permissionsJson: null },
          { fileId: 'file1', folderId: 'f-other', permissionsJson: null },
        ],
      });

      const decision = await service.decide('u1', 'file', 'file1', 'read');

      expect(decision).toEqual({ allowed: true, reason: 'explicit_grant' });
    });

    it('a deny in any one of those folders wins', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Staff')],
        folders: [
          makeFolder('f-open', {
            permissionsJson: [allow('user', 'u1', ['read'])],
          }),
          makeFolder('f-restricted', {
            permissionsJson: [deny('user', 'u1', ['read'])],
          }),
        ],
        files: [makeFile('file1')],
        fileFolderLinks: [
          { fileId: 'file1', folderId: 'f-open', permissionsJson: null },
          { fileId: 'file1', folderId: 'f-restricted', permissionsJson: null },
        ],
      });

      const decision = await service.decide('u1', 'file', 'file1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'explicit_deny' });
    });
  });

  describe('missing subjects', () => {
    it('reports not_found for an unknown user', async () => {
      const service = buildService({
        users: [],
        folders: [makeFolder('f1')],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('ghost', 'folder', 'f1', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'not_found' });
    });

    it('reports not_found for an unknown resource', async () => {
      const service = buildService({
        users: [makeUser('u1', 'Company Admin')],
        folders: [],
        files: [],
        fileFolderLinks: [],
      });

      const decision = await service.decide('u1', 'folder', 'nope', 'read');

      expect(decision).toEqual({ allowed: false, reason: 'not_found' });
    });
  });
});

describe('PermissionsService.decide — workflow file read', () => {
  const restrictedFile = () => ({
    users: [
      makeUser('staff', 'Staff', { departmentIds: [DEPT_LEGAL] }),
      makeUser('named', 'Staff', { departmentIds: [DEPT_LEGAL] }),
    ],
    folders: [makeFolder('f1')],
    files: [makeFile('board-paper')],
    fileFolderLinks: [
      { fileId: 'board-paper', folderId: 'f1', permissionsJson: null },
    ],
  });

  it('lets a named current assignee read the attached file', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'user',
          assignedToId: 'named',
          actions: [],
        },
      ],
    });

    await expect(
      service.decide('named', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'workflow_participant' });
  });

  it('lets the workflow creator read the attached file', async () => {
    const service = buildService({
      ...restrictedFile(),
      users: [makeUser('staff', 'Staff', { departmentIds: [DEPT_LEGAL] })],
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'staff',
          assignedToType: 'department',
          assignedToId: DEPT_LEGAL,
          actions: [],
        },
      ],
    });

    await expect(
      service.decide('staff', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'workflow_participant' });
  });

  it('lets a user named on an action read the attached file', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'department',
          assignedToId: DEPT_LEGAL,
          actions: [
            { assignedToType: 'user', assignedToId: 'named' },
          ],
        },
      ],
    });

    await expect(
      service.decide('named', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'workflow_participant' });
  });

  it('does not let Staff in the assigned department read a Restricted file', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'department',
          assignedToId: DEPT_LEGAL,
          actions: [],
        },
      ],
    });

    await expect(
      service.decide('staff', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'no_grant' });
  });

  it('does not let a named assignee keep reading after the workflow is closed', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'user',
          assignedToId: 'named',
          status: 'completed',
          actions: [],
        },
      ],
    });

    await expect(
      service.decide('named', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'no_grant' });
  });

  it('does not let the workflow creator keep reading after the workflow is filed', async () => {
    const service = buildService({
      ...restrictedFile(),
      users: [makeUser('staff', 'Staff', { departmentIds: [DEPT_LEGAL] })],
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'staff',
          assignedToType: 'department',
          assignedToId: DEPT_LEGAL,
          status: 'filed',
          actions: [],
        },
      ],
    });

    await expect(
      service.decide('staff', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'no_grant' });
  });

  it('does not let a past action assignee keep reading after that action is done', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'department',
          assignedToId: DEPT_LEGAL,
          status: 'in_progress',
          actions: [
            {
              assignedToType: 'user',
              assignedToId: 'named',
              status: 'completed',
            },
          ],
        },
      ],
    });

    await expect(
      service.decide('named', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'no_grant' });
  });

  it('still lets a current user assignee read while an old action is completed', async () => {
    const service = buildService({
      ...restrictedFile(),
      workflows: [
        {
          documentId: 'board-paper',
          assignedBy: 'someone-else',
          assignedToType: 'user',
          assignedToId: 'named',
          status: 'in_progress',
          actions: [
            {
              assignedToType: 'user',
              assignedToId: 'named',
              status: 'completed',
            },
          ],
        },
      ],
    });

    await expect(
      service.decide('named', 'file', 'board-paper', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'workflow_participant' });
  });
});

describe('PermissionsService.decide — revoke all access', () => {
  it('lets Master still open a locked file', async () => {
    const service = buildService({
      users: [makeUser('master', 'Master')],
      folders: [makeFolder('f1')],
      files: [makeFile('locked', { accessRevokedAt: new Date('2026-08-13') })],
      fileFolderLinks: [
        { fileId: 'locked', folderId: 'f1', permissionsJson: null },
      ],
    });

    await expect(
      service.decide('master', 'file', 'locked', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'instance_scope' });
  });

  it('lets Group Secretary still open a locked file', async () => {
    const service = buildService({
      users: [makeUser('gs', 'Group Secretary')],
      folders: [makeFolder('f1')],
      files: [makeFile('locked', { accessRevokedAt: new Date('2026-08-13') })],
      fileFolderLinks: [
        { fileId: 'locked', folderId: 'f1', permissionsJson: null },
      ],
    });

    await expect(
      service.decide('gs', 'file', 'locked', 'read'),
    ).resolves.toEqual({ allowed: true, reason: 'instance_scope' });
  });

  it('blocks Company Admin even though they have company_scope', async () => {
    const service = buildService({
      users: [makeUser('admin', 'Company Admin')],
      folders: [makeFolder('f1')],
      files: [makeFile('locked', { accessRevokedAt: new Date('2026-08-13') })],
      fileFolderLinks: [
        { fileId: 'locked', folderId: 'f1', permissionsJson: null },
      ],
    });

    await expect(
      service.decide('admin', 'file', 'locked', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'access_revoked' });
  });

  it('blocks the creator and named ACL grants', async () => {
    const service = buildService({
      users: [makeUser('staff', 'Staff')],
      folders: [
        makeFolder('f1', {
          permissionsJson: [allow('user', 'staff', ['read'])],
        }),
      ],
      files: [
        makeFile('locked', {
          createdBy: 'staff',
          accessRevokedAt: new Date('2026-08-13'),
        }),
      ],
      fileFolderLinks: [
        { fileId: 'locked', folderId: 'f1', permissionsJson: null },
      ],
    });

    await expect(
      service.decide('staff', 'file', 'locked', 'read'),
    ).resolves.toEqual({ allowed: false, reason: 'access_revoked' });
  });
});

describe('PermissionsService.assertPermission', () => {
  it('resolves silently when allowed', async () => {
    const service = buildService({
      users: [makeUser('admin', 'Company Admin')],
      folders: [makeFolder('f1')],
      files: [],
      fileFolderLinks: [],
    });

    await expect(
      service.assertPermission('admin', 'folder', 'f1', 'read'),
    ).resolves.toBeUndefined();
  });

  it('raises 404 rather than 403 when the resource does not exist', async () => {
    const service = buildService({
      users: [makeUser('admin', 'Company Admin')],
      folders: [],
      files: [],
      fileFolderLinks: [],
    });

    await expect(
      service.assertPermission('admin', 'folder', 'missing', 'read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('raises 403 when the resource belongs to another company', async () => {
    const service = buildService({
      users: [makeUser('u1', 'Company Admin', { companyId: COMPANY_A })],
      folders: [makeFolder('f1', { companyId: COMPANY_B })],
      files: [],
      fileFolderLinks: [],
    });

    await expect(
      service.assertPermission('u1', 'folder', 'f1', 'read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('PermissionsService.filterReadable', () => {
  it('drops resources the user cannot read', async () => {
    const service = buildService({
      users: [makeUser('u1', 'Staff')],
      folders: [
        makeFolder('visible', {
          permissionsJson: [allow('user', 'u1', ['read'])],
        }),
        makeFolder('hidden'),
        makeFolder('other-company', { companyId: COMPANY_B }),
      ],
      files: [],
      fileFolderLinks: [],
    });

    const readable = await service.filterReadable('u1', 'folder', [
      { id: 'visible' },
      { id: 'hidden' },
      { id: 'other-company' },
    ]);

    expect(readable.map((r) => r.id)).toEqual(['visible']);
  });
});
