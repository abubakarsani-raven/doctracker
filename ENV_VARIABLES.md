# Environment Variables Reference

## Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/document_tracker

# Server
PORT=4003
NODE_ENV=development

# CORS - Frontend URL
CORS_ORIGIN=http://localhost:3000
```

### For Railway Deployment:
- `DATABASE_URL` - Automatically provided by Railway PostgreSQL service
- `PORT` - Railway sets this automatically (default: 4003)
- `NODE_ENV=production`
- `CORS_ORIGIN` - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)

## Frontend Environment Variables

Create a `.env.local` file in the `frontend` directory with the following variables:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:4003

# Optional: Force use of real API instead of mock data
# NEXT_PUBLIC_USE_REAL_API=true
```

### For Vercel Deployment:
- `NEXT_PUBLIC_API_URL` - Your Railway backend URL (e.g., `https://your-backend.up.railway.app`)

## Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser in Next.js
- Never commit `.env` or `.env.local` files to version control
- Update `CORS_ORIGIN` in backend after deploying frontend to allow cross-origin requests


