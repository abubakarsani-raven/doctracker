# Frontend-Backend Connection ✅

## Configuration Complete

The frontend is now connected to the backend API.

### Environment Variables

Created `frontend/.env.local`:
```
NEXT_PUBLIC_USE_REAL_API=true
NEXT_PUBLIC_API_URL=http://localhost:4003
```

### What's Connected

✅ **Authentication** - Login endpoint  
✅ **Users** - Get users, current user  
✅ **Companies** - Get companies  
✅ **Workflows** - Get/create/update workflows  
✅ **Actions** - Get/create/update actions  
✅ **Notifications** - Get notifications, mark as read  

### What Still Uses Mock Data

The following features still use mock data (backend endpoints to be added):
- Documents & Folders
- External Documents
- Templates
- Archived Documents
- Dashboard Stats

## How It Works

1. The `api.ts` service checks `NEXT_PUBLIC_USE_REAL_API`
2. If enabled, it uses the `apiClient` from `api-client.ts`
3. If backend fails, it automatically falls back to mock data
4. All API calls include JWT token from localStorage

## Testing the Connection

1. **Start Backend:**
   ```bash
   cd backend
   npm run start:dev
   ```
   Should run on http://localhost:4003

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Should run on http://localhost:3000

3. **Test Login:**
   - Use any seeded user:
     - Email: `alice@example.com`
     - Password: `password123`

## API Endpoints Used

- `POST /auth/login` - User authentication
- `GET /users` - Get all users
- `GET /users/me` - Get current user
- `GET /companies` - Get all companies
- `GET /workflows` - Get all workflows
- `GET /workflows/:id` - Get workflow by ID
- `POST /workflows` - Create workflow
- `PUT /workflows/:id` - Update workflow
- `GET /actions` - Get all actions
- `GET /actions/:id` - Get action by ID
- `POST /actions` - Create action
- `PUT /actions/:id` - Update action
- `GET /notifications` - Get notifications
- `PUT /notifications/:id/read` - Mark notification as read



