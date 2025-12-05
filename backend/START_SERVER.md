# Starting the Backend Server

## Quick Start

1. **Ensure database is connected:**
   ```bash
   cd backend
   cat .env | grep DATABASE_URL  # Should show your Railway connection string
   ```

2. **Start the development server:**
   ```bash
   npm run start:dev
   ```

   The server will run on `http://localhost:3001`

3. **Test the connection:**
   ```bash
   curl http://localhost:3001/health
   ```

## Database Migration Status

✅ **Database schema has been pushed** to Railway PostgreSQL
✅ All tables are created and ready

## Next Steps

1. **Create initial users** - You can either:
   - Use Prisma Studio: `npm run prisma:studio`
   - Create users via the API after starting the server
   - Manually insert via SQL

2. **Seed data** (optional - once seed script is fixed):
   ```bash
   npm run prisma:seed
   ```

3. **Connect frontend:**
   - Update `frontend/.env.local` with:
     ```
     NEXT_PUBLIC_USE_REAL_API=true
     NEXT_PUBLIC_API_URL=http://localhost:3001
     ```

## Troubleshooting

- **Database connection issues**: Make sure your Railway database is running and the connection string is correct
- **Port already in use**: Change PORT in `.env` or kill the process using port 3001
- **Module not found errors**: Run `npm install` in the backend directory
