# AI-Powered Image Upscaling Application

A professional-grade web application for AI-powered image upscaling using Real-ESRGAN and other state-of-the-art AI models.

## Features

- **AI-Powered Upscaling**: Uses Real-ESRGAN for superior image enhancement
- **Multiple Quality Presets**: Photo, Art/Illustration, Anime, and Text optimization
- **Batch Processing**: Upload and process multiple images simultaneously
- **Real-time Comparison**: Before/after slider with zoom controls
- **Processing Queue**: Track progress of multiple upscaling jobs
- **History Management**: Access and re-download previously processed images
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## AI Integration

### Serverless Functions (Primary)
- **Edge Function**: Custom Supabase edge function for AI processing
- **Benefits**: Better performance, cost control, custom logic
- **Fallback**: Direct Replicate API integration

### Replicate API (Primary)
- **Model**: Real-ESRGAN x4 for photos, SwinIR for art, specialized anime model
- **Quality**: Professional-grade results with detail preservation
- **Cost**: ~$0.0055 per image
- **Processing Time**: 15-60 seconds depending on image size and scale

### Supported Features
- **Formats**: JPEG, PNG, WebP
- **Max File Size**: 25MB per image
- **Scale Factors**: 2x, 4x, 8x upscaling
- **Quality Presets**: Optimized for different image types

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure AI API
Create a `.env` file in the root directory:
```env
# Supabase Configuration (for frontend)
VITE_SUPABASE_URL=https://bnjggyfayfrrutlaijhl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuamdneWZheWZycnV0bGFpamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjU2ODcsImV4cCI6MjA3MDI0MTY4N30.OjY3VoIRQmYBwqki0p7fAEt9wULsT49qEnMkn0bu9KU

# Direct Replicate API (fallback)
VITE_REPLICATE_API_TOKEN=your_replicate_api_token_here
```

### 3. Add AI API Credentials to Supabase
In your Supabase Dashboard → Edge Functions → Settings → Environment Variables, add:
- `ESRGAN_API_URL`: `https://YOUR_GPU_HOST:5000/predict`
- `ESRGAN_API_KEY`: `7a334a13-ab54-41dc-a585-64c7023f5915`

### 4. Get Replicate API Token (Optional Fallback)
1. Sign up at [Replicate.com](https://replicate.com)
2. Go to your [Account Settings](https://replicate.com/account)
3. Copy your API token
4. Add it to your `.env` file

### 5. Deploy Edge Function and Start Server
```bash
supabase functions deploy upscaler
npm run dev
```
```bash
npm run dev
```

## API Configuration

### Replicate Setup
1. **Create Account**: Visit [replicate.com](https://replicate.com) and sign up
2. **Get API Token**: Navigate to Account → API Tokens
3. **Add to Environment**: Copy token to `VITE_REPLICATE_API_TOKEN` in `.env`
4. **Verify Setup**: The app will show "AI Upscaling Ready" when configured

### Cost Estimation
- **Replicate**: ~$0.0055 per image
- **Processing Time**: 15-60 seconds per image
- **Monthly Limits**: Based on your Replicate plan

## Technical Architecture

### AI Service Layer (`src/services/replicateService.ts`)
- Handles API communication with Replicate
- Manages different AI models for various image types
- Provides error handling and retry logic
- Estimates processing time and costs

### Image Processing Pipeline
1. **Upload & Validation**: File format and size validation
2. **Preprocessing**: Image dimension analysis and optimization
3. **AI Processing**: Real-ESRGAN model execution via Replicate API
4. **Post-processing**: Format conversion and quality optimization
5. **Delivery**: Secure download links with format options

### Queue Management
- Concurrent processing support
- Progress tracking and status updates
- Error handling and retry mechanisms
- Processing history and statistics

## Quality Comparison

### Before AI Integration (Basic Resizing)
- ❌ Pixelated enlargements
- ❌ Loss of detail and sharpness
- ❌ Artifacts and blurriness
- ❌ Poor text readability

### After AI Integration (Real-ESRGAN)
- ✅ Sharp, detailed upscaling
- ✅ Preserved textures and fine details
- ✅ Enhanced edge definition
- ✅ Improved text clarity
- ✅ Natural-looking results

## Performance Optimization

### Client-Side
- Image compression before upload
- Progressive loading and caching
- Efficient memory management
- Responsive image delivery

### Server-Side
- Queue-based processing
- Automatic retry mechanisms
- Rate limiting and abuse prevention
- Optimized API usage

## Error Handling

### API Failures
- Automatic fallback to alternative models
- Graceful degradation to basic resizing
- Clear error messages and recovery options
- Processing retry mechanisms

### File Handling
- Format validation and conversion
- Size limit enforcement
- Corrupt file detection
- Secure temporary storage

## Security & Privacy

### Data Protection
- Temporary file storage only
- Automatic cleanup after processing
- No permanent image storage
- GDPR-compliant data handling

### API Security
- Secure token management
- Rate limiting implementation
- Input validation and sanitization
- Error message sanitization

## Deployment

### Environment Variables
```env
VITE_REPLICATE_API_TOKEN=your_token_here
```

### Build for Production
```bash
npm run build
```

### Deploy
The application can be deployed to any static hosting service (Netlify, Vercel, etc.) with environment variable support.

## Troubleshooting

### Common Issues

1. **"AI Upscaling Not Available"**
   - Check if `VITE_REPLICATE_API_TOKEN` is set in `.env`
   - Verify the token is valid and has sufficient credits
   - Restart the development server after adding the token

2. **Processing Failures**
   - Check file format (must be JPEG, PNG, or WebP)
   - Verify file size is under 25MB
   - Ensure stable internet connection

3. **Slow Processing**
   - Large images take longer to process
   - High scale factors (8x) require more processing time
   - Check Replicate service status

### Support
For technical issues or questions about the AI integration, please check:
- [Replicate Documentation](https://replicate.com/docs)
- [Real-ESRGAN Model Details](https://replicate.com/nightmareai/real-esrgan)
- Application logs in browser developer tools

## License

This project is licensed under the MIT License. See LICENSE file for details.