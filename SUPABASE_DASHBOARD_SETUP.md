# Complete Supabase Dashboard Setup Guide

## Step 1: Access Your Supabase Project

1. **Go to Supabase Dashboard**: Visit [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **Login**: Use your Supabase account credentials
3. **Select Your Project**: Click on your project `bnjggyfayfrrutlaijhl`

## Step 2: Configure Environment Variables for Edge Functions

### 2.1 Navigate to Edge Functions Settings
1. In your project dashboard, click on **"Edge Functions"** in the left sidebar
2. Click on **"Settings"** tab at the top
3. Look for **"Environment Variables"** section

### 2.2 Add Required Environment Variables
Click **"Add Variable"** and add each of these one by one:

✅ **Already Configured** (these are automatically set by Supabase):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

**RECOMMENDED: Use Replicate API**
- **Name**: `REPLICATE_API_TOKEN`
- **Value**: Your Replicate API token (get from replicate.com/account)

**ALTERNATIVE: Custom GPU Server (Advanced)**
- **Name**: `ESRGAN_API_URL`
- **Value**: `https://your-actual-gpu-server.com:5000/predict` (replace with real hostname)
- **Name**: `ESRGAN_API_KEY`
- **Value**: `7a334a13-ab54-41dc-a585-64c7023f5915`

**FALLBACK (Optional):**
- **Name**: `REPLICATE_API_TOKEN`
- **Value**: Your Replicate API token for fallback processing

### 2.3 Save Environment Variables

## Step 3: Create Storage Bucket

### 3.1 Navigate to Storage
1. Click on **"Storage"** in the left sidebar
2. Click on **"Create a new bucket"** button

### 3.2 Configure Bucket Settings
- **Bucket Name**: `images`
- **Public bucket**: ✅ **Check this box** (important for public access to processed images)
- **File size limit**: Set to `50MB` (or higher if needed)
- **Allowed MIME types**: Leave empty (allows all image types)

### 3.3 Create the Bucket
- Click **"Create bucket"**
- Verify the `images` bucket appears in your storage list

### 3.4 Configure Bucket Policies (Important!)
1. Click on the `images` bucket
2. Go to **"Policies"** tab
3. Click **"New Policy"**
4. Use this template for **public read access**:

```sql
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'images');
```

5. Click **"Review"** then **"Save policy"**

## Step 4: Get Your Service Role Key

### 4.1 Navigate to API Settings
1. Click on **"Settings"** in the left sidebar
2. Click on **"API"** in the settings menu

### 4.2 Copy Service Role Key
1. Scroll down to **"Project API keys"** section
2. Find the **"service_role"** key (NOT the anon key)
3. Click the **copy button** next to the service_role key
4. **IMPORTANT**: This is a secret key - keep it secure!

### 4.3 Add Service Role Key to Environment Variables
1. Go back to **Edge Functions** → **Settings** → **Environment Variables**
2. Find the `SUPABASE_SERVICE_ROLE_KEY` variable you created earlier
3. Click **"Edit"** and paste the service_role key as the value
4. Click **"Save"**

## Step 5: Deploy the Edge Function

### 5.1 Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 5.2 Login to Supabase CLI
```bash
supabase login
```
- This will open a browser window to authenticate

### 5.3 Link Your Project
```bash
supabase link --project-ref bnjggyfayfrrutlaijhl
```

### 5.4 Deploy the Upscaler Function
```bash
supabase functions deploy upscaler
```

### 5.5 Verify Deployment
1. Go back to **Edge Functions** in your Supabase dashboard
2. You should see the `upscaler` function listed
3. Click on it to see deployment status and logs

## Step 6: Test the Setup

### 6.1 Check Function Status
1. In Edge Functions dashboard, click on your `upscaler` function
2. Check the **"Logs"** tab for any errors
3. Status should show as **"Active"**

### 6.2 Test in Your Application
1. Go back to your running application
2. Upload a test image
3. Look for:
   - ✅ Green "AI Upscaling Ready" banner
   - ✅ Processing time estimates
   - ✅ "AI Upscale" button (not "Basic Resize")

## Step 7: Verify Complete Setup

### ✅ Checklist - All items should be complete:
- [ ] Environment variables added to Edge Functions settings
- [ ] `images` storage bucket created and set to public
- [ ] Storage bucket policies configured for public read access
- [ ] Service role key copied and added to environment variables
- [ ] Edge function deployed successfully
- [ ] Function shows as "Active" in dashboard
- [ ] Application shows "AI Upscaling Ready" status

## Troubleshooting

### Issue: "Function deployment failed"
**Solution**: 
- Check that all environment variables are set correctly
- Verify you're logged into Supabase CLI: `supabase login`
- Try redeploying: `supabase functions deploy upscaler --no-verify-jwt`

### Issue: "Storage upload failed"
**Solution**:
- Verify the `images` bucket exists and is public
- Check bucket policies allow public read access
- Ensure service_role key is correct in environment variables

### Issue: "AI processing not working"
**Solution**:
- Check Edge Function logs in Supabase dashboard
- Verify ESRGAN_API_URL and ESRGAN_API_KEY are correct
- Test the ESRGAN API endpoint directly

### Issue: "Environment variables not found"
**Solution**:
- Environment variables are set in Edge Functions → Settings, not Project Settings
- Redeploy the function after adding environment variables
- Check variable names match exactly (case-sensitive)

## Security Notes

⚠️ **Important Security Reminders**:
- Never share your service_role key publicly
- The service_role key has admin access to your entire Supabase project
- Environment variables in Edge Functions are secure and not exposed to clients
- The anon key is safe to use in frontend applications

## Support

If you encounter issues:
1. Check the Edge Function logs in Supabase dashboard
2. Verify all environment variables are set correctly
3. Test each component individually (storage, function deployment, API endpoints)
4. Check Supabase status page for any service issues

Your AI-powered image upscaling service should now be fully operational! 🚀