# GPU Host Configuration Guide

## What is YOUR_GPU_HOST?

The `YOUR_GPU_HOST` in the URL `https://YOUR_GPU_HOST:5000/predict` is a placeholder that needs to be replaced with your actual GPU server details.

## Option 1: If You Have Your Own GPU Server

### Finding Your GPU Host
If you're running your own Real-ESRGAN server, you need:

**Local Development:**
- `http://localhost:5000/predict` (if running locally)
- `http://127.0.0.1:5000/predict` (alternative local address)

**Remote Server:**
- `https://your-server-domain.com:5000/predict`
- `https://123.456.789.012:5000/predict` (IP address)
- `https://my-gpu-server.herokuapp.com/predict` (cloud hosting)

### Common GPU Server Setups
1. **Local GPU Server**: Running Real-ESRGAN on your local machine
2. **Cloud GPU Instance**: AWS EC2, Google Cloud, Azure with GPU
3. **Dedicated GPU Server**: Rented GPU server from providers like Vast.ai, RunPod
4. **Docker Container**: Real-ESRGAN running in Docker

## Option 2: Use Replicate API (Recommended)

Since you may not have a custom GPU server set up, I recommend using Replicate API instead:

### Benefits of Replicate
- ✅ **No Server Setup Required**: Fully managed AI API
- ✅ **Professional Models**: Real-ESRGAN, SwinIR, and specialized models
- ✅ **Pay-per-Use**: Only pay for what you process (~$0.0055/image)
- ✅ **High Reliability**: 99.9% uptime with automatic scaling
- ✅ **Free Credits**: $10 free credits for new accounts

### Replicate Setup (5 minutes)
1. **Sign up**: [replicate.com](https://replicate.com)
2. **Get API token**: Account → API Tokens
3. **Use in environment**: `VITE_REPLICATE_API_TOKEN=r8_your_token`

## Option 3: Alternative AI APIs

### Leonardo.ai
- **Endpoint**: `https://cloud.leonardo.ai/api/rest/v1/upscale`
- **Cost**: ~$0.003 per image
- **Setup**: Get API key from Leonardo.ai dashboard

### Stability.ai
- **Endpoint**: `https://api.stability.ai/v1/generation/esrgan-v1-x2plus/image-to-image/upscale`
- **Cost**: ~$0.004 per image
- **Setup**: Get API key from Stability.ai

## Current Configuration Issue

Your current environment has:
```
ESRGAN_API_URL=https://YOUR_GPU_HOST:5000/predict
ESRGAN_API_KEY=7a334a13-ab54-41dc-a585-64c7023f5915
```

This won't work because `YOUR_GPU_HOST` is not a real hostname.

## Recommended Solution

**Use Replicate API** (easiest and most reliable):

1. **Get Replicate Token**: [replicate.com/account](https://replicate.com/account)
2. **Update Environment Variables** in Supabase Dashboard:
   - Remove: `ESRGAN_API_URL` and `ESRGAN_API_KEY`
   - Add: `REPLICATE_API_TOKEN=r8_your_actual_token`

3. **Update Edge Function** to use Replicate API instead of custom GPU server

## Setting Up Your Own GPU Server (Advanced)

If you want to run your own Real-ESRGAN server:

### Requirements
- GPU with 8GB+ VRAM (RTX 3070 or better)
- Python 3.8+
- CUDA toolkit
- Real-ESRGAN dependencies

### Quick Setup
```bash
# Clone Real-ESRGAN
git clone https://github.com/xinntao/Real-ESRGAN.git
cd Real-ESRGAN

# Install dependencies
pip install -r requirements.txt

# Download models
python download_models.py

# Run server (example)
python app.py --port 5000
```

### Docker Setup
```bash
# Use existing Real-ESRGAN Docker image
docker run -p 5000:5000 --gpus all xinntao/realesrgan:latest
```

## Next Steps

**Recommended Path**:
1. Sign up for Replicate (free $10 credits)
2. Get your API token
3. Update Supabase environment variables to use Replicate
4. Deploy the edge function

This will give you a working AI upscaling service in minutes without needing to manage your own GPU infrastructure!