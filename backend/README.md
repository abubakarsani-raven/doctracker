# Document Tracker Backend

NestJS backend API for the Document Tracker system.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Update `.env` file with your database connection string:

**Important:** For local development, use the **public/external** connection string from Railway, not the internal one.

The internal connection string (`postgres.railway.internal`) only works within Railway's network. For local development, you need the public connection string which typically looks like:

```
DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Migrations

```bash
npm run prisma:migrate
```

This will create all database tables based on the Prisma schema.

### 5. Start Development Server

```bash
npm run start:dev
```

The server will run on `http://localhost:3001` (or the port specified in `.env`).

## API Endpoints

### Authentication
- `POST /auth/login` - User login

### Users
- `GET /users` - Get all users
- `GET /users/me` - Get current user

### Companies
- `GET /companies` - Get all companies

### Workflows
- `GET /workflows` - Get all workflows
- `GET /workflows/:id` - Get workflow by ID
- `POST /workflows` - Create workflow
- `PUT /workflows/:id` - Update workflow

### Actions
- `GET /actions` - Get all actions
- `GET /actions/:id` - Get action by ID
- `POST /actions` - Create action
- `PUT /actions/:id` - Update action

### Notifications
- `GET /notifications` - Get user notifications
- `PUT /notifications/:id/read` - Mark notification as read

## Database Management

- View database in Prisma Studio: `npm run prisma:studio`
- Create new migration: `npm run prisma:migrate`
- Reset database (dev only): `npx prisma migrate reset`
