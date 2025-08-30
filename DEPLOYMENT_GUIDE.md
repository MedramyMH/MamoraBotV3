# Vercel Deployment Guide for Mamorabot Trading App

## ✅ Issues Fixed
- ✅ Environment variables configured
- ✅ Supabase client properly set up
- ✅ Error boundary added to prevent white page
- ✅ Build optimization completed
- ✅ Vercel configuration added
- ✅ Production WebSocket URL configured

## 🚀 Deployment Steps

### 1. Prerequisites
- Supabase project set up with the provided schema
- Railway WebSocket server running at: `wss://mamora-ws-server.up.railway.app`
- Vercel account

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY  
vercel env add VITE_WEBSOCKET_URL
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository or upload the project folder
4. Vercel will auto-detect it as a Vite project
5. Add environment variables in the dashboard:
   - `VITE_SUPABASE_URL`: `https://fugfokszkmedwfommgae.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `VITE_WEBSOCKET_URL`: `wss://mamora-ws-server.up.railway.app`
6. Click "Deploy"

### 3. Database Setup
Apply the schema to your Supabase project:
```sql
-- Run the contents of supabase-schema.sql in your Supabase SQL editor
```

### 4. Post-Deployment Checklist
- [ ] App loads without white page
- [ ] Login/signup functionality works
- [ ] Supabase authentication works
- [ ] WebSocket connection establishes
- [ ] Trading dashboard accessible
- [ ] Admin panel accessible (for admin users)

## 🔧 Configuration Files Created
- `.env` - Local development environment
- `.env.production` - Production environment
- `vercel.json` - Vercel deployment configuration
- Updated `vite.config.js` - Optimized build settings
- Enhanced `src/App.jsx` - Added error boundary and better error handling

## 🐛 Troubleshooting
If you encounter issues:
1. Check browser console for errors
2. Verify environment variables are set correctly in Vercel dashboard
3. Ensure Supabase project is active and schema is applied
4. Check WebSocket server is running on Railway

## 📱 Features
- User authentication with Supabase
- Role-based access (admin/trader)
- Real-time market data via WebSocket
- Trading dashboard
- Admin panel
- Responsive Material-UI design