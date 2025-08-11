# Add REPLICATE_API_TOKEN to Supabase Edge Functions

## Step 1: Add Environment Variable to Supabase Dashboard

### 1.1 Navigate to Your Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click on your project: `bnjggyfayfrrutlaijhl`

### 1.2 Access Edge Functions Settings
1. In the left sidebar, click **"Edge Functions"**
2. Click on the **"Settings"** tab at the top
3. Scroll down to find **"Environment Variables"** section

### 1.3 Add the Replicate API Token
1. Click **"Add Variable"** button
2. Fill in the details:
   - **Name**: `REPLICATE_API_TOKEN`
   - **Value**: `7a334a13-ab54-41dc-a585-64c7023f5915`
3. Click **"Save"** or **"Add Variable"**

### 1.4 Verify the Variable is Added
You should now see `REPLICATE_API_TOKEN` in your environment variables list alongside:
- SUPABASE_URL
- SUPABASE_ANON_KEY  
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL

## Step 2: Deploy the Updated Edge Function

### 2.1 Make Sure Supabase CLI is Installed
```bash
npm install -g supabase
```

### 2.2 Login to Supabase (if not already logged in)
```bash
supabase login
```

### 2.3 Link Your Project (if not already linked)
```bash
supabase link --project-ref bnjggyfayfrrutlaijhl
```

### 2.4 Deploy the Upscaler Function
```bash
supabase functions deploy upscaler
```

## Step 3: Verify Deployment

### 3.1 Check Function Status
1. Go back to **Edge Functions** in your Supabase dashboard
2. You should see the `upscaler` function listed
3. Click on it to see deployment status and logs
4. Status should show as **"Active"**

### 3.2 Test in Your Application
1. Go back to your running application at `http://localhost:5173`
2. Upload a test image
3. Look for successful AI processing without the "AI API URL not configured" error

## Troubleshooting

### If deployment fails:
- Make sure you're logged into Supabase CLI: `supabase login`
- Verify project is linked: `supabase projects list`
- Try redeploying: `supabase functions deploy upscaler --no-verify-jwt`

### If the error persists:
- Check Edge Function logs in Supabase dashboard
- Verify `REPLICATE_API_TOKEN` is correctly set in environment variables
- Make sure the token value is exactly: `7a334a13-ab54-41dc-a585-64c7023f5915`