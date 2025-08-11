# Replicate API Setup Guide

## Step 1: Create Replicate Account

1. **Visit Replicate**: Go to [https://replicate.com](https://replicate.com)
2. **Sign Up**: Click "Sign up" and create an account using:
   - Email and password, OR
   - GitHub account, OR  
   - Google account

## Step 2: Get Your API Token

1. **Login** to your Replicate account
2. **Navigate to Account Settings**: 
   - Click your profile picture in the top right
   - Select "Account" from the dropdown menu
   - Or go directly to: [https://replicate.com/account](https://replicate.com/account)

3. **Find API Tokens Section**:
   - Look for the "API tokens" tab or section
   - You should see a section titled "API tokens"

4. **Create/Copy Token**:
   - If no token exists, click "Create token"
   - Give it a name like "Image Upscaler App"
   - Copy the token (it starts with `r8_` followed by random characters)
   - **IMPORTANT**: Save this token securely - you won't be able to see it again!

## Step 3: Add Token to Your Application

1. **Create Environment File**:
   - In your project root directory, create a file named `.env`
   - Add your token like this:
   ```env
   VITE_REPLICATE_API_TOKEN=r8_your_actual_token_here_replace_this_text
   ```

2. **Example**:
   ```env
   # Replace the token below with your actual token from Replicate
   VITE_REPLICATE_API_TOKEN=r8_AbCdEf123456789GhIjKlMnOpQrStUvWxYz
   ```

## Step 4: Restart Your Application

1. **Stop the development server** (Ctrl+C in terminal)
2. **Start it again**:
   ```bash
   npm run dev
   ```

## Step 5: Verify Setup

✅ **Success Indicators**:
- Green "AI Upscaling Ready" banner appears in the upload area
- Button text changes from "Basic Resize" to "AI Upscale"
- Processing time estimates show for uploaded files

❌ **If Not Working**:
- Check that `.env` file is in the root directory (same level as `package.json`)
- Verify token starts with `r8_` and has no extra spaces
- Make sure you restarted the development server
- Check browser console for error messages

## Replicate Pricing & Credits

### Free Tier
- **$10 free credits** for new accounts
- Enough for ~1,800 image upscaling operations

### Pricing
- **Real-ESRGAN**: ~$0.0055 per run
- **Processing time**: 10-30 seconds per image
- **No monthly fees** - pay only for what you use

### Cost Examples
- 100 images: ~$0.55
- 500 images: ~$2.75  
- 1,000 images: ~$5.50

## Troubleshooting

### Issue: "AI Upscaling Not Available"
**Solutions**:
1. Check `.env` file exists and contains token
2. Restart development server
3. Verify token is valid at replicate.com/account
4. Check for typos in environment variable name

### Issue: "Invalid API Token" 
**Solutions**:
1. Generate a new token at replicate.com/account
2. Make sure token starts with `r8_`
3. Check for extra spaces or characters

### Issue: "Insufficient Credits"
**Solutions**:
1. Add payment method at replicate.com/billing
2. Purchase additional credits
3. Check current balance at replicate.com/account

### Issue: Processing Fails
**Common Causes**:
- File too large (25MB limit)
- Unsupported format (only JPEG, PNG, WebP)
- Network connectivity issues
- Replicate service temporarily down

## Security Notes

⚠️ **Important Security Tips**:
- Never commit your `.env` file to version control
- Don't share your API token publicly
- Regenerate token if accidentally exposed
- Use different tokens for development and production

## Production Deployment

When deploying to production (Netlify, Vercel, etc.):

1. **Don't upload `.env` file**
2. **Set environment variable in hosting platform**:
   - Variable name: `VITE_REPLICATE_API_TOKEN`
   - Variable value: Your actual token

### Platform-Specific Instructions

**Netlify**:
1. Go to Site Settings → Environment Variables
2. Add `VITE_REPLICATE_API_TOKEN` with your token value

**Vercel**:
1. Go to Project Settings → Environment Variables  
2. Add `VITE_REPLICATE_API_TOKEN` with your token value

**Other Platforms**:
- Look for "Environment Variables" or "Config Vars" in settings
- Add the variable name and token value

## Need Help?

- **Replicate Documentation**: [https://replicate.com/docs](https://replicate.com/docs)
- **API Reference**: [https://replicate.com/docs/reference/http](https://replicate.com/docs/reference/http)
- **Account Issues**: Contact Replicate support through their website