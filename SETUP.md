# AI Image Upscaling Setup Guide

## Quick Start

### 1. Get Your Replicate API Token
1. Visit [replicate.com](https://replicate.com) and create an account
2. Navigate to your [Account Settings](https://replicate.com/account)
3. Click on "API Tokens" tab
4. Copy your API token (starts with `r8_...`)

### 2. Configure Environment
Create a `.env` file in your project root:
```env
VITE_REPLICATE_API_TOKEN=r8_your_actual_token_here
```

### 3. Install and Run
```bash
npm install
npm run dev
```

## Verification

When properly configured, you should see:
- ✅ Green "AI Upscaling Ready" banner in the upload area
- ✅ "AI Upscale" button instead of "Basic Resize"
- ✅ Processing time estimates for uploaded files

## API Costs

### Replicate Pricing
- **Real-ESRGAN**: ~$0.0055 per image
- **Processing Time**: 15-60 seconds
- **Free Tier**: $10 credit for new accounts

### Example Costs
- 100 images: ~$0.55
- 1,000 images: ~$5.50
- 10,000 images: ~$55.00

## Troubleshooting

### Issue: "AI Upscaling Not Available"
**Solution**: 
1. Check your `.env` file exists and contains the token
2. Restart your development server (`npm run dev`)
3. Verify token is valid at [replicate.com/account](https://replicate.com/account)

### Issue: Processing Fails
**Common Causes**:
- File too large (>25MB limit)
- Unsupported format (only JPEG, PNG, WebP)
- Insufficient Replicate credits
- Network connectivity issues

### Issue: Slow Processing
**Expected Behavior**:
- 2x upscaling: 15-30 seconds
- 4x upscaling: 30-60 seconds  
- 8x upscaling: 60-120 seconds

Large images and higher scale factors naturally take longer.

## Advanced Configuration

### Multiple AI Providers (Optional)
You can add additional AI services by extending the environment variables:

```env
VITE_REPLICATE_API_TOKEN=your_replicate_token
VITE_LEONARDO_API_KEY=your_leonardo_key
VITE_STABILITY_API_KEY=your_stability_key
```

### Custom Models
The application uses these optimized models:
- **Photos**: Real-ESRGAN x4 (best for natural images)
- **Art**: SwinIR (optimized for illustrations)
- **Anime**: Real-ESRGAN Anime (specialized for anime/cartoon content)

## Production Deployment

### Environment Variables
Set these in your hosting platform:
```
VITE_REPLICATE_API_TOKEN=your_production_token
```

### Recommended Hosting
- **Netlify**: Supports environment variables
- **Vercel**: Built-in environment variable management
- **AWS S3 + CloudFront**: For high-traffic applications

## Support

### Getting Help
1. Check browser console for error messages
2. Verify API token at [replicate.com](https://replicate.com)
3. Test with small images first
4. Check Replicate service status

### Resources
- [Replicate Documentation](https://replicate.com/docs)
- [Real-ESRGAN Model](https://replicate.com/nightmareai/real-esrgan)
- [API Reference](https://replicate.com/docs/reference/http)