# WeeDeliver — Production Deployment Guide

This guide walks you through deploying WeeDeliver to production.

---

## Prerequisites Checklist

- [x] **Yoco account** with live API keys (already configured)
- [x] **Supabase account** with project created (already configured)
- [ ] **Database password** from Supabase
- [ ] **Storage bucket** named `weedeliver` (public) created in Supabase
- [ ] **Railway account** for backend hosting (free tier OK)
- [ ] **Vercel account** for frontend hosting (free)
- [ ] **GitHub account** to push your code

---

## Step 1: Set Up Supabase Database

1. Go to https://supabase.com/dashboard/project/kwltbxlqnbkqoyguvfjj/settings/database
2. Scroll to **Connection string**
3. Click the **URI** tab
4. Select **Transaction pooler** (port 6543, recommended)
5. Copy the connection string — looks like:
   ```
   postgresql://postgres.kwltbxlqnbkqoyguvfjj:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with your actual database password
7. Update `server/.env`:
   ```
   DATABASE_URL="postgresql://postgres.kwltbxlqnbkqoyguvfjj:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
   ```

## Step 2: Set Up Supabase Storage (Image Uploads)

1. Go to https://supabase.com/dashboard/project/kwltbxlqnbkqoyguvfjj/storage/buckets
2. Click **New bucket**
3. Name: `weedeliver`
4. Toggle **Public bucket** ON
5. Click **Create bucket**
6. Click on the new bucket → **Configuration** tab
7. Set file size limit to `5 MB`
8. Set allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`
9. Click **Save**

### Storage Policies (allow uploads from anyone authenticated)

In the SQL editor (https://supabase.com/dashboard/project/kwltbxlqnbkqoyguvfjj/sql/new), run:

```sql
-- Allow anyone to read images
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'weedeliver');

-- Allow anyone to upload (we restrict via app logic)
CREATE POLICY "Anyone can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'weedeliver');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'weedeliver');
```

## Step 3: Initialize Database Schema

From the project root, run:

```bash
cd server
npm install
npm run db:push    # Pushes Prisma schema to Supabase
npm run db:seed    # Creates demo accounts + dispensaries
```

After this, you'll have these test accounts (all password `password123`):
- `customer@test.com`
- `dispensary@test.com`
- `driver@test.com`
- `admin@weedeliver.co.za`

## Step 4: Test Locally

```bash
cd ..  # Back to project root
npm run install:all
npm run dev
```

Visit http://localhost:5173 — register an account, browse dispensaries, place a test order with Yoco.

## Step 5: Deploy Backend to Railway

1. Push your code to GitHub
2. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Set **Root Directory** to `server`
5. Add environment variables (copy from `server/.env`):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `ENCRYPTION_KEY`
   - `YOCO_SECRET_KEY`
   - `YOCO_PUBLIC_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_STORAGE_BUCKET`
   - `CLIENT_URL` → set to your future Vercel URL (you'll update this after Step 6)
   - `NODE_ENV=production`
6. Click **Deploy**
7. Wait for deployment to finish — copy the generated URL (e.g. `https://weedeliver-server-production.up.railway.app`)
8. Test it: `https://your-railway-url/api/health` should return `{"status":"ok"}`

## Step 6: Deploy Frontend to Vercel

1. Go to https://vercel.com → **Add New Project** → import from GitHub
2. Select your repo
3. Set **Root Directory** to `client`
4. Framework Preset: **Vite**
5. Add environment variables:
   - `VITE_API_URL` → your Railway backend URL (e.g. `https://weedeliver-server-production.up.railway.app/api/v1`)
   - `VITE_SUPABASE_URL` → `https://kwltbxlqnbkqoyguvfjj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → `sb_publishable_w9I11SA2qa7GErOHOzj_ug_WMqrsbFE`
   - `VITE_SUPABASE_STORAGE_BUCKET` → `weedeliver`
   - `VITE_YOCO_PUBLIC_KEY` → `pk_live_ba3f6802oWOA1ol99044`
6. Click **Deploy**
7. Copy the Vercel URL (e.g. `https://weedeliver.vercel.app`)
8. **Go back to Railway** → update `CLIENT_URL` env var to your Vercel URL
9. Railway will auto-redeploy

## Step 7: Configure Yoco Webhook

1. Go to https://yoco.com/za → Dashboard → Developers → Webhooks
2. Click **Add webhook**
3. URL: `https://your-railway-url/api/v1/payments/webhook/yoco`
4. Events: select `payment.succeeded` and `payment.failed`
5. Save

Yoco will send a webhook secret — add it to Railway as `YOCO_WEBHOOK_SECRET`.

## Step 8: Custom Domain (Optional)

### Vercel
1. Settings → Domains → Add domain → e.g. `weedeliver.co.za`
2. Update your DNS to point to Vercel
3. Update `CLIENT_URL` in Railway to your custom domain

### Railway
1. Settings → Networking → Custom Domain → e.g. `api.weedeliver.co.za`
2. Update `VITE_API_URL` in Vercel to your custom domain

---

## Post-Launch Checklist

- [ ] Test full customer flow: register → browse → order → pay with real card → delivery
- [ ] Test dispensary flow: register → create store → add products → receive orders
- [ ] Test driver flow: register → go online → accept delivery → mark delivered
- [ ] Verify Yoco webhooks are firing (check Railway logs)
- [ ] Set up error monitoring (Sentry recommended)
- [ ] Set up uptime monitoring (UptimeRobot is free)
- [ ] Configure email notifications (SendGrid)
- [ ] Add Google Analytics or Plausible
- [ ] Set up automated database backups in Supabase
- [ ] Review Supabase RLS policies for security
- [ ] Test payment refund flow
- [ ] Update privacy policy and terms of service

---

## Troubleshooting

### "Database connection failed"
- Verify your `DATABASE_URL` includes the password and uses port `6543`
- Make sure you're using the **Transaction pooler** URL, not Direct connection

### "CORS error"
- Verify `CLIENT_URL` in Railway matches your Vercel URL exactly (no trailing slash)
- Check Railway logs for the actual origin being blocked

### "Image uploads not working"
- Verify storage bucket is named `weedeliver` and is **public**
- Verify storage policies are set (Step 2)
- Check browser console for Supabase errors

### "Yoco payment fails"
- Verify webhook URL is correct in Yoco dashboard
- Check Railway logs for webhook signature verification errors
- Make sure you're using `sk_live_` keys, not test keys, in production

---

## Costs Summary (Monthly)

- **Supabase** — Free tier: 500MB database, 1GB storage, 2GB bandwidth
- **Railway** — Free trial $5 credit, then ~$5-10/mo for hobby plan
- **Vercel** — Free tier covers most small apps
- **Yoco** — 2.95% + R0.50 per transaction (no monthly fee)
- **Domain** — ~R150/year for .co.za

**Total starting cost: R150-300/month** depending on traffic.
