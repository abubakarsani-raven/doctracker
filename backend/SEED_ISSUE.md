# Seed Script Issue

## Current Status
⚠️ **Seed script has Prisma 7 initialization issue**

The Prisma 7 client requires explicit configuration that isn't working in standalone seed scripts.

## Workaround Options

### Option 1: Use Prisma Studio (Recommended for now)
```bash
npm run prisma:studio
```
Manually add:
- Roles (Master, Company Admin, Department Head, etc.)
- Companies (Acme Corporation, Tech Solutions Ltd, etc.)
- Departments (Legal, HR, Finance, Marketing, IT)
- Users (john@example.com, jane@example.com, etc. - password: `password123`)

### Option 2: Create Users via API
Once the backend server is running, you can create users via the API endpoints.

### Option 3: Direct SQL Insert
You can use a PostgreSQL client or Railway dashboard to insert data directly.

## Test Users to Create
- `alice@example.com` - Master (password: `password123`)
- `charlie@example.com` - Company Admin (password: `password123`)
- `bob@example.com` - Department Head (password: `password123`)
- `jane@example.com` - Manager (password: `password123`)
- `john@example.com` - Staff (password: `password123`)

## Next Steps
Once Prisma 7 seed issues are resolved, the seed script will automatically populate all demo data.
