/**
 * Minimal seed — roles catalogue + one Master admin.
 *
 * Everything else (companies, users, folders, documents) is created via the
 * live HTTP API — see `scripts/bootstrap-contracts-api.sh`.
 *
 * Run after migrate reset: `npm run prisma:seed`
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';

import {
  ROLE_DEFINITIONS,
  toRolePermissionsJson,
} from '../src/permissions/capabilities';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is not set. Copy backend/.env.example to backend/.env first.',
  );
  process.exit(1);
}

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'aisha@example.com';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Aisha Yusuf';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log('🌱 Seeding roles + Master admin only\n');

  console.log('📋 Roles');
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
    console.log(`  ✓ ${definition.name}`);
  }

  if (!masterRoleId) {
    throw new Error('Master role missing from ROLE_DEFINITIONS');
  }

  console.log('\n👤 Admin');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      status: 'active',
      companyId: null,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      status: 'active',
      companyId: null,
    },
  });

  // Master UserRole needs a company key — placeholder org for the FK only.
  // Admin's home company stays null (dataScope: all).
  let anchor = await prisma.company.findFirst({
    where: { name: 'System' },
  });
  if (!anchor) {
    anchor = await prisma.company.create({ data: { name: 'System' } });
  }

  await prisma.userRole.deleteMany({ where: { userId: admin.id } });
  await prisma.userRole.create({
    data: {
      userId: admin.id,
      roleId: masterRoleId,
      companyId: anchor.id,
    },
  });

  console.log(`  ✓ ${ADMIN_EMAIL}  Master  ${ADMIN_NAME}`);
  console.log('\n✅ Seed complete\n');
  console.log(`   Sign in: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${SEED_PASSWORD}`);
  console.log(
    '   Then run: ./scripts/bootstrap-contracts-api.sh  (creates orgs, people, folders via API)\n',
  );
}

main()
  .catch((error) => {
    console.error('\n❌ Seed failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
