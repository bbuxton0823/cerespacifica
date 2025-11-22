# Deployment Guide

Your application is split into two parts that need to be deployed separately:

## Part 1: Deploy Backend to Render

### Step 1: Create PostgreSQL Database
1. Go to https://render.com
2. Click "New +" → "PostgreSQL"
3. Name: `hqs-database`
4. Plan: **Free**
5. Click "Create Database"
6. Copy the **Internal Database URL** (starts with `postgresql://`)

### Step 2: Deploy Backend Service
1. Click "New +" → "Web Service"
2. Connect your GitHub: `bbuxton0823/cerespacifica`
3. Configure:
   - **Name**: `hqs-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run db:migrate`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Environment Variables** (click "Add Environment Variable"):
   ```
   NODE_ENV=production
   DATABASE_URL=[paste the Internal Database URL from Step 1]
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=3000
   FRONTEND_URL=https://cerespacifica-fsx2hqoia-bychas-projects.vercel.app
   ```

5. Click "Create Web Service"

6. **Copy the backend URL** (will be something like `https://hqs-backend.onrender.com`)

---

## Part 2: Update Vercel Frontend

### Step 1: Update Environment Variable in Vercel
1. Go to https://vercel.com/bychas-projects/cerespacifica
2. Click "Settings" → "Environment Variables"
3. Add:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://hqs-backend.onrender.com` (use URL from Part 1, Step 6)
   - **Environment**: Production

3. Click "Save"

### Step 2: Redeploy Frontend
1. Go to "Deployments" tab
2. Find the latest deployment
3. Click "..." → "Redeploy"
4. Check "Use existing Build Cache"
5. Click "Redeploy"

---

## Part 3: Test Your Application

1. Visit your Vercel URL: `https://cerespacifica-fsx2hqoia-bychas-projects.vercel.app`
2. Click "Import" and upload your CSV
3. Verify inspections appear on calendar
4. Click "Auto-Route" to assign inspectors
5. Click "Letters" to generate Word documents

---

## Troubleshooting

### Backend fails to start
- Check Render logs: Dashboard → `hqs-backend` → "Logs"
- Verify `DATABASE_URL` environment variable is set
- Verify migrations ran successfully (check build logs)

### Frontend can't reach backend
- Check browser console for CORS errors
- Verify `VITE_API_URL` is set in Vercel
- Verify backend is running (visit `https://hqs-backend.onrender.com/health`)

### CORS Errors
The backend already has CORS configured to accept requests from your frontend URL. If you change the Vercel URL, update the `FRONTEND_URL` environment variable in Render.

---

## Local Development

**Frontend**:
```bash
npm run dev  # Uses http://localhost:3000 (from .env.development)
```

**Backend**:
```bash
cd backend
npm run dev  # Runs on http://localhost:3000
```

---

## Environment Files

- **`.env.production`**: Used by Vercel (contains `VITE_API_URL`)
- **`.env.development`**: Used locally (points to localhost:3000)
- **Backend env vars**: Managed in Render dashboard

---

## Cost

Both Render and Vercel free tiers should be sufficient for development/testing:
- **Render Free**: 750 hours/month, spins down after 15 min of inactivity
- **Vercel Free**: Unlimited deployments, 100GB bandwidth/month

> [!NOTE]
> Render's free tier will "spin down" after 15 minutes of inactivity. The first request after spin-down may take 30-60 seconds to wake up the server.
