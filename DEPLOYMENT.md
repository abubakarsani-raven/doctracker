# Deployment Guide

This guide explains how to deploy the Document Tracker application to Railway (backend) and Vercel (frontend).

## Prerequisites

- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- GitHub repository (recommended for easy deployment)

## Backend Deployment (Railway)

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo" (recommended) or "Empty Project"

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create a PostgreSQL database
4. Note the connection details (you'll need `DATABASE_URL`)

### Step 3: Deploy Backend Service

1. In your Railway project, click "+ New"
2. Select "GitHub Repo" and choose your repository
3. Select the `backend` directory as the root directory
4. Railway will auto-detect the Node.js project

### Step 4: Configure Environment Variables

In the Railway service settings, add the following environment variables:

```
DATABASE_URL=<your-postgresql-connection-string>
PORT=4003
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

**Important Notes:**
- `DATABASE_URL` is automatically provided by Railway when you link the PostgreSQL service
- `CORS_ORIGIN` should be your Vercel frontend URL (update after frontend deployment)
- Railway will automatically set `PORT`, but you can override it if needed

### Step 5: Run Database Migrations

After the first deployment, you need to run Prisma migrations:

1. In Railway, go to your backend service
2. Open the "Deployments" tab
3. Click on the latest deployment
4. Open the "Shell" tab
5. Run the following commands:

```bash
npx prisma migrate deploy
npx prisma db seed
```

Alternatively, you can add a custom build command in Railway settings:
- Build Command: `npm install && npm run build && npx prisma generate`
- Start Command: `npm run start:prod`

### Step 6: Get Backend URL

After deployment, Railway will provide a public URL for your backend (e.g., `https://your-backend.up.railway.app`). Save this URL for the frontend configuration.

---

## Frontend Deployment (Vercel)

### Step 1: Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### Step 2: Configure Environment Variables

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

**Important:**
- Replace `https://your-backend.up.railway.app` with your actual Railway backend URL
- The `NEXT_PUBLIC_` prefix makes this variable available in the browser
- You can also set this for different environments (Production, Preview, Development)

### Step 3: Deploy

1. Click "Deploy"
2. Vercel will build and deploy your frontend
3. You'll get a URL like `https://your-project.vercel.app`

### Step 4: Update Backend CORS

After getting your Vercel frontend URL, update the backend CORS_ORIGIN:

1. Go back to Railway backend service
2. Update the `CORS_ORIGIN` environment variable to your Vercel URL
3. Redeploy the backend service

---

## Post-Deployment Checklist

- [ ] Backend is accessible at Railway URL
- [ ] Frontend is accessible at Vercel URL
- [ ] Database migrations have been run
- [ ] Database seed has been executed
- [ ] CORS_ORIGIN is set correctly in backend
- [ ] NEXT_PUBLIC_API_URL is set correctly in frontend
- [ ] Test API connection from frontend to backend
- [ ] Test authentication flow
- [ ] Test file upload functionality (if applicable)

## Troubleshooting

### Backend Issues

**Database Connection Errors:**
- Verify `DATABASE_URL` is set correctly in Railway
- Ensure PostgreSQL service is running
- Check if migrations have been run

**CORS Errors:**
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Include protocol (https://) in CORS_ORIGIN
- Check browser console for specific CORS error messages

**Build Failures:**
- Check Railway build logs
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### Frontend Issues

**API Connection Errors:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check that backend is accessible
- Verify CORS is configured correctly on backend
- Check browser network tab for failed requests

**Build Failures:**
- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Verify Next.js version compatibility

## Environment Variables Summary

### Backend (Railway)
```
DATABASE_URL          - PostgreSQL connection string (auto-provided by Railway)
PORT                  - Server port (default: 4003)
NODE_ENV              - Environment (production)
CORS_ORIGIN           - Frontend URL for CORS
```

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL   - Backend API URL
```

## Continuous Deployment

Both Railway and Vercel support automatic deployments:

- **Railway**: Automatically deploys on push to the connected branch
- **Vercel**: Automatically deploys on push to main/master branch

To enable:
1. Connect your GitHub repository
2. Configure deployment settings
3. Push changes to trigger automatic deployments

## Custom Domains

### Railway (Backend)
1. Go to service settings
2. Click "Settings" → "Networking"
3. Add custom domain

### Vercel (Frontend)
1. Go to project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

