# Supabase Edge Function Setup Guide

## Overview

The upscaler edge function provides serverless AI image processing with better performance and cost control compared to direct API calls from the frontend.

## Setup Instructions

### 1. Create Supabase Project

1. **Visit Supabase**: Go to [https://supabase.com](https://supabase.com)
2. **Create Account**: Sign up or log in
3. **New Project**: Click "New Project" and fill in details
4. **Get Credentials**: Copy your project URL and anon key

### 2. Install Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize in your project
supabase init
```

### 3. Configure Environment Variables

Add these environment variables to your Supabase project:

1. **Go to Project Settings** → **API** → **Environment Variables**
2. **Add Variables**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from API settings)
   - `ESRGAN_API_URL`: https://YOUR_GPU_HOST:5000/predict
   - `ESRGAN_API_KEY`: 7a334a13-ab54-41dc-a585-64c7023f5915
   - `REPLICATE_API_TOKEN`: Your Replicate API token (fallback)

3. **Create Storage Bucket**:
   - Go to **Storage** in Supabase dashboard
   - Create a new bucket named `images`
   - Set it to **Public** for easy access to processed images

### 4. Deploy Edge Function

```bash
# Deploy the upscaler function
supabase functions deploy upscaler

# Verify deployment
supabase functions list
```

### 5. Update Local Environment

Add to your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_REPLICATE_API_TOKEN=your-replicate-token-here
```

## Function Architecture

### Input Format
```typescript
{
  imageBase64: string,  // base64 encoded image
  scale: number,        // 2, 4, or 8
  quality?: string      // 'photo', 'art', 'anime', 'text' (optional)
}
```

### Response Format
```typescript
{
  success: boolean,
  inputUrl?: string,    // URL to original image in Supabase Storage
  outputUrl?: string,   // URL to upscaled image in Supabase Storage
  error?: string,
  processingTime?: number
}
```

## Benefits of Edge Functions

### Performance
- **Faster Processing**: Server-side execution
- **Better Error Handling**: Comprehensive retry logic
- **Resource Management**: Optimized memory usage

### Security
- **API Key Protection**: All API keys stored securely on server
- **Image Storage**: Secure Supabase Storage with public URLs
- **Rate Limiting**: Built-in abuse prevention
- **Input Validation**: Server-side validation

### Cost Control
- **Usage Monitoring**: Track API calls and costs
- **Storage Management**: Organized image storage with timestamps
- **Batch Processing**: Optimize multiple requests

## Troubleshooting

### Function Not Found
```bash
# Check function deployment
supabase functions list

# Redeploy if needed
supabase functions deploy upscaler
```

### Environment Variables
```bash
# Check environment variables in Supabase dashboard
# Project Settings → API → Environment Variables
```

### CORS Issues
The function includes proper CORS headers for web applications.

### Processing Timeouts
- Default timeout: 5 minutes
- Large images may need optimization
- Consider image compression before processing

## Local Development

### Run Functions Locally
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve upscaler

# Test function
curl -X POST http://localhost:54321/functions/v1/upscaler \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,...","scale":2,"quality":"photo"}'
```

## Production Deployment

### Automatic Deployment
Functions are automatically deployed when you push to your connected Git repository.

### Manual Deployment
```bash
supabase functions deploy upscaler --project-ref your-project-ref
```

### Monitoring
- **Logs**: View in Supabase dashboard → Functions → Logs
- **Metrics**: Monitor usage and performance
- **Alerts**: Set up notifications for errors

## Cost Optimization

### Replicate Usage
- **Monitor Costs**: Track API usage in Replicate dashboard
- **Optimize Images**: Compress before processing
- **Batch Processing**: Group similar requests

### Supabase Usage
- **Function Invocations**: Monitor edge function calls
- **Bandwidth**: Track data transfer
- **Storage**: Temporary file handling

The edge function provides a robust, scalable solution for AI image upscaling with better security and performance than direct client-side API calls.