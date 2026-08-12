/**
 * Idempotent seed — roles catalogue + one Master admin.
 *
 * Compiled into `dist/seed/run-seed.js` and run on Railway start
 * (after migrate deploy). Safe to re-run: existing admin password is kept.
 *
 * Local: `npm run prisma:seed` (via prisma/seed.ts → ts-node)
 * Prod:  `node dist/seed/run-seed.js`
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';

import {
  ROLE_DEFINITIONS,
  toRolePermissionsJson,
} from '../permissions/capabilities';

// Local `.env` only — Railway already injects DATABASE_URL.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
// Lowercased to match how the API stores and looks up emails. Seeding
// "Admin@Company.com" while sign-in normalises to lowercase would create an
// account nobody can log into.
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'aisha@example.com')
  .trim()
  .toLowerCase();
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Aisha Yusuf';

function log(message: string): void {
  // Railway captures stdout as a pipe — force flush so hangs still leave a trail.
  process.stdout.write(`${message}\n`);
}

export async function runSeed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.',
    );
  }

  log('🌱 Seeding roles + Master admin only');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 5_000,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    log('📋 Roles');
    let masterRoleId: string | null = null;
    for (const definition of ROLE_DEFINITIONS) {
      const permissionsJson = toRolePermissionsJson(definition);
      const role = await prisma.role.upsert({
        where: { name: definition.name },
        update: {
          permissionsJson: permissionsJson as any,
          canAssignDocuments: definition.canAssignDocuments,
        },
        create: {
          name: definition.name,
          permissionsJson: permissionsJson as any,
          canAssignDocuments: definition.canAssignDocuments,
        },
      });
      if (definition.name === 'Master') masterRoleId = role.id;
      log(`  ✓ ${definition.name}`);
    }

    if (!masterRoleId) {
      throw new Error('Master role missing from ROLE_DEFINITIONS');
    }

    log('👤 Admin');
    // Matched case-insensitively so a re-run finds an admin seeded before
    // emails were normalised, rather than colliding on the unique index.
    let admin = await prisma.user.findFirst({
      where: { email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
    });
    let created = false;

    if (!admin) {
      const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
      admin = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          passwordHash,
          status: 'active',
          companyId: null,
        },
      });
      created = true;
    } else {
      // Keep existing password; only refresh name/status.
      admin = await prisma.user.update({
        where: { id: admin.id },
        data: {
          name: ADMIN_NAME,
          status: 'active',
          companyId: null,
        },
      });
    }

    // Master UserRole needs a company key — placeholder org for the FK only.
    // Admin's home company stays null (dataScope: all).
    let anchor = await prisma.company.findFirst({
      where: { name: 'System' },
    });
    if (!anchor) {
      anchor = await prisma.company.create({
        data: {
          name: 'System',
          description: 'Default organisation for Master role assignment',
          isActive: true,
        },
      });
    } else if (anchor.isActive === false) {
      anchor = await prisma.company.update({
        where: { id: anchor.id },
        data: { isActive: true },
      });
    }

    await prisma.userRole.deleteMany({ where: { userId: admin.id } });
    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: masterRoleId,
        companyId: anchor.id,
      },
    });

    log(
      `  ✓ ${ADMIN_EMAIL}  Master  ${ADMIN_NAME}${created ? ' (created)' : ' (exists)'}`,
    );
    log('✅ Seed complete');
    if (created) {
      log(`   Sign in: ${ADMIN_EMAIL}`);
      log(`   Password: ${SEED_PASSWORD}`);
    } else {
      log(`   Sign in: ${ADMIN_EMAIL} (password unchanged)`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Allow `node dist/seed/run-seed.js` as a standalone entrypoint.
if (require.main === module) {
  runSeed().catch((error) => {
    process.stderr.write(`\n❌ Seed failed:\n${error}\n`);
    process.exit(1);
  });
}
