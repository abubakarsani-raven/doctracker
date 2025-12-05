const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
  process.exit(1);
}

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter (required for Prisma 7)
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Create roles (system data only - no demo data)
    console.log('📋 Creating roles...');
    const roles = [
      { name: 'Master', permissionsJson: {}, canAssignDocuments: true },
      { name: 'Company Admin', permissionsJson: {}, canAssignDocuments: true },
      { name: 'Department Head', permissionsJson: {}, canAssignDocuments: true },
      { name: 'Department Secretary', permissionsJson: {}, canAssignDocuments: true },
      { name: 'Division Head', permissionsJson: {}, canAssignDocuments: false },
      { name: 'Manager', permissionsJson: {}, canAssignDocuments: false },
      { name: 'Staff', permissionsJson: {}, canAssignDocuments: false },
      { name: 'Receptionist', permissionsJson: {}, canAssignDocuments: false },
    ];

    const createdRoles = {};
    for (const role of roles) {
      const existing = await prisma.role.findUnique({ where: { name: role.name } });
      if (!existing) {
        const created = await prisma.role.create({ data: role });
        createdRoles[role.name] = created;
        console.log(`  ✓ Created role: ${role.name}`);
      } else {
        createdRoles[role.name] = existing;
        console.log(`  ⊘ Role already exists: ${role.name}`);
      }
    }

    console.log('\n✅ Seed completed successfully! (Only system roles created - no demo data)');
  } catch (error) {
    console.error('\n❌ Seed failed:');
    console.error(error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
