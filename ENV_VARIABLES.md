# Environment Variables Reference

## Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/document_tracker

# Server
PORT=4003
NODE_ENV=development

# CORS - Frontend URL (comma-separated for multiple origins)
CORS_ORIGIN=http://localhost:3000

# Authentication - Generate secure random strings for production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Rate limiting / client IP behind Railway (or any reverse proxy)
# Trust this many proxy hops so X-Forwarded-For becomes req.ip.
# Without this, every user shares the proxy IP and login throttling hits everyone.
# Default in production: 1. Override with TRUST_PROXY=1|true|false|loopback
TRUST_PROXY=1

# Password hashing
BCRYPT_ROUNDS=12

# Object Storage (Optional)
# STORAGE_PROVIDER=local|cloudinary|r2|s3  (auto-detects if empty)
STORAGE_PROVIDER=

# Cloudinary (recommended for production)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=doctracker

# R2/S3 compatible (alternative)
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=doctracker-files
R2_PUBLIC_URL=https://your-domain.com/files

# Local Storage (when cloud storage is not configured)
LOCAL_STORAGE_PATH=uploads
```

### For Railway Deployment:
- `DATABASE_URL` - Automatically provided by Railway PostgreSQL service
- `PORT` - Railway sets this automatically (default: 4003)
- `NODE_ENV=production`
- `CORS_ORIGIN` - Your Vercel frontend URL (e.g., `https://your-app.vercel.app`)
- `JWT_SECRET` - Generate a secure random string (32+ characters)
- `JWT_REFRESH_SECRET` - Generate a different secure random string
- `BCRYPT_ROUNDS=12` - Higher for production
- Cloudinary (or R2) configuration for file storage

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

## Authentication Notes

DocTracker uses **cookie-based authentication** with JWT tokens:
- `dt_access` - Short-lived access token (15 minutes)
- `dt_refresh` - Long-lived refresh token (7 days)  
- `dt_csrf` - CSRF protection token

Cookies are httpOnly and secure in production, providing better security than localStorage-based auth.

## Object Storage Notes

DocTracker supports local disk, Cloudinary, and R2/S3:
- **Local Storage**: `uploads/` (default for development)
- **Cloudinary**: set `CLOUDINARY_*` (or `STORAGE_PROVIDER=cloudinary`) — recommended for production
- **R2/S3**: set `R2_*` / `S3_*` credentials
- Auto-select order when `STORAGE_PROVIDER` is empty: Cloudinary → R2/S3 → local

## General Notes

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser in Next.js
- Never commit `.env` or `.env.local` files to version control
- Update `CORS_ORIGIN` in backend after deploying frontend to allow cross-origin requests
- Use strong, unique secrets for JWT keys in production
- Generate secrets using: `openssl rand -base64 32`


