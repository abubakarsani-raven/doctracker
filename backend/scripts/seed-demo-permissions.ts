/**
 * Clear documents and reseed companies / users / folders for permission demos.
 *
 * Run: npx ts-node --transpile-only scripts/seed-demo-permissions.ts
 *
 * Password for every seeded account: Password123! (or SEED_PASSWORD)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

import {
  ROLE_DEFINITIONS,
  toRolePermissionsJson,
} from '../src/permissions/capabilities';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
const BOSS_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'aisha@example.com')
  .trim()
  .toLowerCase();
const BOSS_NAME = process.env.SEED_ADMIN_NAME || 'Aisha Yusuf';
const MASTER_SECRETARY_EMAIL = 'group.secretary@example.com';
const MASTER_SECRETARY_NAME = 'Fatima Bello';

type CompanySpec = {
  name: string;
  slug: string;
  description: string;
};

/** Existing Arewa + Global, plus two new tenants. */
const COMPANIES: CompanySpec[] = [
  {
    name: 'Arewa Contract Services Ltd',
    slug: 'arewa',
    description: 'Primary demo tenant (Legal / Contracts)',
  },
  {
    name: 'Global Development Partners Nigeria',
    slug: 'gdp',
    description: 'Existing partner company',
  },
  {
    name: 'Horizon Logistics Ltd',
    slug: 'horizon',
    description: 'New company for cross-tenant demos',
  },
  {
    name: 'Sahel Energy Partners',
    slug: 'sahel',
    description: 'New company for cross-tenant demos',
  },
];

/** Company-bound roles — one user of each per company. */
const COMPANY_ROLES = [
  'Company Admin',
  'Company Secretary',
  'Department Head',
  'Department Secretary',
  'Division Head',
  'Manager',
  'Staff',
  'Receptionist',
] as const;

function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

function openingGrants(opts: {
  scopeLevel: string;
  departmentId?: string | null;
  divisionId?: string | null;
  createdBy: string;
}) {
  const grantedAt = new Date().toISOString();
  const base = {
    effect: 'allow' as const,
    grantedBy: opts.createdBy,
    grantedAt,
  };
  const grants: any[] = [];
  if (opts.scopeLevel === 'department' && opts.departmentId) {
    grants.push({
      ...base,
      subjectType: 'department',
      subjectId: opts.departmentId,
      permissions: ['read', 'write', 'share'],
    });
  } else if (opts.scopeLevel === 'division' && opts.divisionId) {
    grants.push({
      ...base,
      subjectType: 'division',
      subjectId: opts.divisionId,
      permissions: ['read', 'write', 'share'],
    });
    if (opts.departmentId) {
      grants.push({
        ...base,
        subjectType: 'department',
        subjectId: opts.departmentId,
        permissions: ['read', 'write', 'share'],
      });
    }
  }
  return grants;
}

function richTextPath(html: string) {
  return `rich-text-content://${Buffer.from(html, 'utf8').toString('base64')}`;
}

function roleSlug(role: string) {
  return role.toLowerCase().replace(/\s+/g, '.');
}

async function clearDocuments(prisma: PrismaClient) {
  log('🧹 Clearing documents and related records…');
  // Order respects FKs that are not always Cascade from File.
  await prisma.signatureParticipant.deleteMany({});
  await prisma.signatureEvent.deleteMany({});
  await prisma.signatureRequest.deleteMany({});
  await prisma.workflowFile.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.workflowRouting.deleteMany({});
  await prisma.workflowGoal.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.accessRequest.deleteMany({});
  await prisma.documentNote.deleteMany({});
  await prisma.fileTag.deleteMany({});
  await prisma.fileVersion.deleteMany({});
  await prisma.richTextDocument.deleteMany({});
  await prisma.fileFolderLink.deleteMany({});
  await prisma.file.deleteMany({});
  await prisma.folder.deleteMany({});
  log('  ✓ files, folders, workflows, access requests cleared');
}

async function upsertRoles(prisma: PrismaClient) {
  const byName = new Map<string, string>();
  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: definition.name },
      update: {
        permissionsJson: toRolePermissionsJson(definition) as any,
        canAssignDocuments: definition.canAssignDocuments,
      },
      create: {
        name: definition.name,
        permissionsJson: toRolePermissionsJson(definition) as any,
        canAssignDocuments: definition.canAssignDocuments,
      },
    });
    byName.set(role.name, role.id);
  }
  return byName;
}

async function upsertUser(
  prisma: PrismaClient,
  opts: {
    email: string;
    name: string;
    companyId: string | null;
    roleId: string;
    roleCompanyId: string;
    departmentIds?: string[];
    divisionIds?: string[];
    passwordHash: string;
  },
) {
  const email = opts.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: opts.name,
        passwordHash: opts.passwordHash,
        status: 'active',
        companyId: opts.companyId,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: opts.name,
        status: 'active',
        companyId: opts.companyId,
        passwordHash: opts.passwordHash,
      },
    });
  }

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: opts.roleId,
      companyId: opts.roleCompanyId,
    },
  });

  await prisma.userDepartment.deleteMany({ where: { userId: user.id } });
  await prisma.userDivision.deleteMany({ where: { userId: user.id } });
  for (const departmentId of opts.departmentIds ?? []) {
    await prisma.userDepartment.create({
      data: { userId: user.id, departmentId },
    });
  }
  for (const divisionId of opts.divisionIds ?? []) {
    await prisma.userDivision.create({
      data: { userId: user.id, divisionId },
    });
  }

  return user;
}

async function seedCompanyTree(
  prisma: PrismaClient,
  company: { id: string; name: string; slug: string },
  roleIds: Map<string, string>,
  passwordHash: string,
  creatorId: string,
) {
  // Departments / divisions
  let legal = await prisma.department.findFirst({
    where: { companyId: company.id, name: 'Legal' },
  });
  if (!legal) {
    legal = await prisma.department.create({
      data: {
        companyId: company.id,
        name: 'Legal',
        description: 'Legal department',
      },
    });
  }

  let ops = await prisma.department.findFirst({
    where: { companyId: company.id, name: 'Operations' },
  });
  if (!ops) {
    ops = await prisma.department.create({
      data: {
        companyId: company.id,
        name: 'Operations',
        description: 'Operations department',
      },
    });
  }

  let contracts = await prisma.division.findFirst({
    where: { departmentId: legal.id, name: 'Contracts' },
  });
  if (!contracts) {
    contracts = await prisma.division.create({
      data: {
        departmentId: legal.id,
        name: 'Contracts',
        description: 'Contracts division',
      },
    });
  }

  const users: Record<string, { id: string; email: string; name: string }> = {};

  for (const roleName of COMPANY_ROLES) {
    const email = `${roleSlug(roleName)}@${company.slug}.example.com`;
    const name = `${roleName} (${company.slug.toUpperCase()})`;
    const departmentIds =
      roleName === 'Company Admin' ||
      roleName === 'Company Secretary' ||
      roleName === 'Receptionist'
        ? []
        : roleName.startsWith('Department') ||
            roleName === 'Division Head' ||
            roleName === 'Manager' ||
            roleName === 'Staff'
          ? [legal.id]
          : [];
    const divisionIds =
      roleName === 'Division Head' ||
      roleName === 'Manager' ||
      roleName === 'Staff'
        ? [contracts.id]
        : [];

    const user = await upsertUser(prisma, {
      email,
      name,
      companyId: company.id,
      roleId: roleIds.get(roleName)!,
      roleCompanyId: company.id,
      departmentIds,
      divisionIds,
      passwordHash,
    });
    users[roleName] = { id: user.id, email, name };
  }

  const adminId = users['Company Admin'].id;

  const board = await prisma.folder.create({
    data: {
      name: `${company.name.split(' ')[0]} Board`,
      description: 'Company-wide — Company Admin / Secretary only',
      companyId: company.id,
      scopeLevel: 'company',
      departmentId: null,
      divisionId: null,
      createdBy: adminId,
      permissionsJson: [],
    },
  });

  const legalFolder = await prisma.folder.create({
    data: {
      name: 'Legal Shared',
      description: 'Department-wide Legal',
      companyId: company.id,
      scopeLevel: 'department',
      departmentId: legal.id,
      divisionId: null,
      createdBy: adminId,
      permissionsJson: openingGrants({
        scopeLevel: 'department',
        departmentId: legal.id,
        createdBy: adminId,
      }),
    },
  });

  const contractsFolder = await prisma.folder.create({
    data: {
      name: 'Contracts Desk',
      description: 'Division-wide Contracts',
      companyId: company.id,
      scopeLevel: 'division',
      departmentId: legal.id,
      divisionId: contracts.id,
      createdBy: adminId,
      permissionsJson: openingGrants({
        scopeLevel: 'division',
        departmentId: legal.id,
        divisionId: contracts.id,
        createdBy: adminId,
      }),
    },
  });

  const docs = [
    {
      fileName: `${company.slug.toUpperCase()}-BOARD-POLICY.html`,
      scopeLevel: 'company',
      departmentId: null as string | null,
      divisionId: null as string | null,
      folderId: board.id,
      blurb: 'Company board policy — company scope only.',
    },
    {
      fileName: `${company.slug.toUpperCase()}-LEGAL-MEMO.html`,
      scopeLevel: 'department',
      departmentId: legal.id,
      divisionId: null,
      folderId: legalFolder.id,
      blurb: 'Legal department memo — Legal department domain.',
    },
    {
      fileName: `${company.slug.toUpperCase()}-CONTRACT-DRAFT.html`,
      scopeLevel: 'division',
      departmentId: legal.id,
      divisionId: contracts.id,
      folderId: contractsFolder.id,
      blurb: 'Contracts division draft — Contracts division (+ Legal dept).',
    },
  ];

  for (const doc of docs) {
    const fileId = randomUUID();
    const html = `<h1>${doc.fileName}</h1><p>${doc.blurb}</p><p>Company: ${company.name}</p>`;
    await prisma.file.create({
      data: {
        id: fileId,
        companyId: company.id,
        fileName: doc.fileName,
        fileType: 'text/html',
        storagePath: richTextPath(html),
        fileSize: BigInt(Buffer.byteLength(html)),
        scopeLevel: doc.scopeLevel,
        departmentId: doc.departmentId,
        divisionId: doc.divisionId,
        createdBy: adminId,
      },
    });
    await prisma.richTextDocument.create({
      data: {
        fileId,
        htmlContent: html,
        createdBy: adminId,
      },
    });
    await prisma.fileFolderLink.create({
      data: {
        fileId,
        folderId: doc.folderId,
      },
    });
  }

  return { users, legal, contracts, board, legalFolder, contractsFolder };
}

/** Lightweight mirror of decide() for the printed matrix (read only). */
function canSee(
  role: string,
  dataScope: string,
  deptIds: string[],
  divIds: string[],
  companyId: string | null,
  file: {
    companyId: string;
    scopeLevel: string;
    departmentId: string | null;
    divisionId: string | null;
    createdBy: string;
  },
  folderAcls: Array<{
    subjectType: string;
    subjectId: string;
    effect?: string;
    permissions?: string[];
  }>,
) {
  if (dataScope === 'all') return '✓ all';
  if (!companyId || file.companyId !== companyId) return '✗ other co.';
  if (dataScope === 'company') return '✓ company';

  const inheritsDomain =
    ROLE_DEFINITIONS.find((r) => r.name === role)?.capabilities.includes(
      'documents.inherit_domain',
    ) ?? false;

  if (
    inheritsDomain &&
    dataScope === 'department' &&
    (file.scopeLevel === 'department' || file.scopeLevel === 'division') &&
    file.departmentId &&
    deptIds.includes(file.departmentId)
  ) {
    return '✓ dept';
  }
  if (
    inheritsDomain &&
    dataScope === 'division' &&
    file.scopeLevel === 'division' &&
    file.divisionId &&
    divIds.includes(file.divisionId)
  ) {
    return '✓ division';
  }

  const applicable = folderAcls.filter((e) => {
    if (!inheritsDomain) {
      return false; // matrix seed has no user-named grants
    }
    // Division-scoped inheritors ignore parent-department opening grants.
    if (dataScope === 'division' && e.subjectType === 'department') {
      return false;
    }
    if (e.subjectType === 'department') return deptIds.includes(e.subjectId);
    if (e.subjectType === 'division') return divIds.includes(e.subjectId);
    return false;
  });
  if (
    applicable.some(
      (e) => e.effect !== 'deny' && (e.permissions ?? []).includes('read'),
    )
  ) {
    return '✓ ACL';
  }

  return '✗';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  try {
    log('🌱 Demo permission seed\n');
    const roleIds = await upsertRoles(prisma);
    await clearDocuments(prisma);

    // System company for Master / Group Secretary role FK
    let system = await prisma.company.findFirst({ where: { name: 'System' } });
    if (!system) {
      system = await prisma.company.create({
        data: {
          name: 'System',
          description: 'Anchor for instance-wide roles',
          isActive: true,
        },
      });
    }

    // Boss = Master
    const boss = await upsertUser(prisma, {
      email: BOSS_EMAIL,
      name: `${BOSS_NAME} (Boss / Master)`,
      companyId: null,
      roleId: roleIds.get('Master')!,
      roleCompanyId: system.id,
      passwordHash,
    });
    log(`👤 Boss (Master): ${BOSS_EMAIL}`);

    // Master Secretary = Group Secretary
    await upsertUser(prisma, {
      email: MASTER_SECRETARY_EMAIL,
      name: `${MASTER_SECRETARY_NAME} (Master Secretary)`,
      companyId: null,
      roleId: roleIds.get('Group Secretary')!,
      roleCompanyId: system.id,
      passwordHash,
    });
    log(`👤 Master Secretary (Group Secretary): ${MASTER_SECRETARY_EMAIL}`);

    const companyRows: Array<{
      id: string;
      name: string;
      slug: string;
    }> = [];

    for (const spec of COMPANIES) {
      let company = await prisma.company.findFirst({
        where: { name: spec.name },
      });
      if (!company) {
        company = await prisma.company.create({
          data: {
            name: spec.name,
            description: spec.description,
            isActive: true,
          },
        });
        log(`🏢 Created company: ${spec.name}`);
      } else {
        company = await prisma.company.update({
          where: { id: company.id },
          data: { description: spec.description, isActive: true },
        });
        log(`🏢 Using company: ${spec.name}`);
      }
      companyRows.push({ id: company.id, name: company.name, slug: spec.slug });
    }

    const matrixBlocks: string[] = [];

    for (const company of companyRows) {
      log(`\n📁 Seeding ${company.name}…`);
      const tree = await seedCompanyTree(
        prisma,
        company,
        roleIds,
        passwordHash,
        boss.id,
      );

      const files = await prisma.file.findMany({
        where: { companyId: company.id, deletedAt: null },
        select: {
          fileName: true,
          companyId: true,
          scopeLevel: true,
          departmentId: true,
          divisionId: true,
          createdBy: true,
          fileFolderLinks: {
            select: {
              folder: { select: { permissionsJson: true, name: true } },
            },
          },
        },
        orderBy: { fileName: 'asc' },
      });

      const short = (n: string) =>
        n
          .replace(`${company.slug.toUpperCase()}-`, '')
          .replace('.html', '');

      const header =
        `| User | Role | ${files.map((f) => short(f.fileName)).join(' | ')} |`;
      const sep = `| --- | --- | ${files.map(() => '---').join(' | ')} |`;
      const rows: string[] = [
        `\n### ${company.name}`,
        header,
        sep,
        `| ${BOSS_EMAIL} | Master (Boss) | ${files.map(() => '✓ all').join(' | ')} |`,
        `| ${MASTER_SECRETARY_EMAIL} | Group Secretary | ${files.map(() => '✓ all').join(' | ')} |`,
      ];

      for (const roleName of COMPANY_ROLES) {
        const u = tree.users[roleName];
        const def = ROLE_DEFINITIONS.find((r) => r.name === roleName)!;
        const deptIds =
          roleName === 'Company Admin' ||
          roleName === 'Company Secretary' ||
          roleName === 'Receptionist'
            ? []
            : [tree.legal.id];
        const divIds =
          roleName === 'Division Head' ||
          roleName === 'Manager' ||
          roleName === 'Staff'
            ? [tree.contracts.id]
            : [];

        const cells = files.map((f) => {
          const acls = (f.fileFolderLinks ?? []).flatMap((l) => {
            const raw = l.folder?.permissionsJson;
            return Array.isArray(raw) ? (raw as any[]) : [];
          });
          return canSee(
            roleName,
            def.dataScope,
            deptIds,
            divIds,
            company.id,
            f,
            acls,
          );
        });
        rows.push(
          `| ${u.email} | ${roleName} | ${cells.join(' | ')} |`,
        );
      }

      matrixBlocks.push(rows.join('\n'));
      log(`  ✓ 8 users + 3 folders + 3 documents`);
    }

    log('\n\n========== PERMISSION MATRIX ==========');
    log('Password for all accounts: ' + SEED_PASSWORD);
    log(
      'Legend: ✓ all / ✓ company / ✓ dept / ✓ division / ✓ ACL / ✗ / ✗ other co.',
    );
    for (const block of matrixBlocks) log(block);

    log('\n✅ Demo seed complete');
    log(`   Boss: ${BOSS_EMAIL}`);
    log(`   Master Secretary: ${MASTER_SECRETARY_EMAIL}`);
    log(
      `   Per company: ${COMPANY_ROLES.map((r) => roleSlug(r) + '@<slug>.example.com').join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
