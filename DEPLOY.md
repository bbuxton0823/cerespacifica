# Deployment Guide

## 1. Frontend (Vercel)
The frontend is a React + Vite application. The easiest way to deploy it is via **Vercel**.

### Steps:
1.  Push your code to GitHub.
2.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
3.  Click **Add New...** -> **Project**.
4.  Import your `cerespacifica` repository.
5.  **Build & Development Settings**:
    - Framework Preset: **Vite** (should be auto-detected).
    - Root Directory: `./` (default).
6.  **Environment Variables**:
    - Add `GEMINI_API_KEY` (value: your Google Gemini API Key).
7.  Click **Deploy**.

## 2. Backend (Render)
The backend is a Node.js/Express app with a PostgreSQL database. We use **Render** for this.

### Steps:
1.  Go to [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Blueprint**.
3.  Connect your GitHub repository.
4.  Render will detect the `render.yaml` file in the root.
5.  Click **Apply**.
6.  Render will automatically:
    - Create a PostgreSQL database.
    - Build the backend service.
    - Run migrations (`npm run db:migrate`).
    - Start the server.

## 3. Connecting Frontend to Backend
Once the backend is deployed, you will get a URL (e.g., `https://hqs-backend.onrender.com`).

1.  Go back to your **Vercel Project Settings**.
2.  Add a new Environment Variable:
    - `VITE_API_URL`: `https://hqs-backend.onrender.com`
3.  Redeploy the frontend.

**Note**: Currently, the Scheduling UI uses mock data for demonstration purposes, so it will work without the backend connection. However, for the full system (including mailing and real data persistence), the backend connection is required.
