/*
  # AI Image Upscaler Edge Function - URL Storage Only

  This serverless function handles AI-powered image upscaling using Replicate API
  and stores only the URLs (not the actual files) to avoid storage size limits.
  
  ## Features
  - Accepts image uploads via base64 encoding
  - Integrates with Replicate API for AI upscaling
  - Returns Replicate CDN URLs directly (no local storage)
  - Avoids file size limits by not re-uploading large upscaled images
  - Comprehensive error handling and validation
  - CORS support for web applications
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

interface UserProfile {
  id: string;
  current_month_upscales: number;
  monthly_upscales_limit: number;
  subscription_status: string;
}

interface UpscaleRequest {
  userId?: string;
  imageBase64: string;
  scale: number;
  quality?: 'photo' | 'art' | 'anime' | 'text';
}

interface UpscaleResponse {
  success: boolean;
  transactionId?: string;
  inputUrl?: string;
  outputUrl?: string;
  error?: string;
  processingTime?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests for upscaling
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Supabase configuration missing" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if userId is provided for tracking
    const userId = requestData.userId;
    let userProfile: UserProfile | null = null;
    
    if (userId) {
      // Get user profile and check limits
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, current_month_upscales, monthly_upscales_limit, subscription_status')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      } else {
        userProfile = profile;
        
        // Check if user has remaining upscales
        if (profile.current_month_upscales >= profile.monthly_upscales_limit) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Monthly upscale limit reached. Please upgrade your plan or wait for next billing cycle." 
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        if (profile.subscription_status !== 'active') {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Subscription not active. Please check your billing status." 
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Parse request body
    const requestData: UpscaleRequest = await req.json();
    
    // Validate required fields
    if (!requestData.imageBase64 || !requestData.scale) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: imageBase64, scale" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate scale factor
    if (![2, 4, 8].includes(requestData.scale)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid scale factor. Must be 2, 4, or 8" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startTime = Date.now();

    let transactionId: string | null = null;
    
    // Create transaction record if user is tracked
    if (userId && userProfile) {
      const { data: transaction, error: transactionError } = await supabase
        .from('upscale_transactions')
        .insert({
          user_id: userId,
          scale_factor: requestData.scale,
          quality_preset: requestData.quality || 'photo',
          api_cost: 0.0055,
          status: 'processing'
        })
        .select()
        .single();
      
      if (!transactionError && transaction) {
        transactionId = transaction.id;
      }
    }

    console.log('Starting AI upscaling process...', {
      scale: requestData.scale,
      quality: requestData.quality || 'photo',
      imageSize: requestData.imageBase64.length
    });

    // Get Replicate API token
    const replicateApiToken = Deno.env.get("REPLICATE_API_TOKEN");
    
    if (!replicateApiToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Replicate API token not configured" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare Replicate API request headers
    const replicateHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Token ${replicateApiToken}`,
    };

    // Call Replicate API to create prediction
    const prediction = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: replicateHeaders,
      body: JSON.stringify({
        version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa", // Specific Real-ESRGAN model
        input: {
          image: requestData.imageBase64,
          scale: requestData.scale
        }
      }),
    });

    if (!prediction.ok) {
      const errorText = await prediction.text();
      console.error('Replicate API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Replicate API failed: ${errorText}` 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const predictionData = await prediction.json();
    
    const maxAttempts = 120; // 10 minutes max for large images
    let result = predictionData;
    while (result.status === "starting" || result.status === "processing") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: replicateHeaders,
      });
      
      if (!statusResponse.ok) {
        throw new Error("Failed to check prediction status");
      }
      
      result = await statusResponse.json();
    }
    
    if (result.status === "failed") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AI processing failed: ${result.error}` 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate the result has output
    if (!result.output || typeof result.output !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Replicate API did not return valid output. Status: ${result.status}, Output: ${JSON.stringify(result.output)}` 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate the output URL
    const outputUrl = result.output;
    if (!outputUrl.startsWith('http')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid output URL from Replicate: ${outputUrl}` 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Replicate processing completed, output URL:', outputUrl);

    // Update transaction and user stats if tracking is enabled
    if (userId && userProfile && transactionId) {
      // Update transaction as completed
      await supabase
        .from('upscale_transactions')
        .update({
          status: 'completed',
          upscaled_image_url: outputUrl,
          processing_time_seconds: Math.round((Date.now() - startTime) / 1000),
          completed_at: new Date().toISOString()
        })
        .eq('id', transactionId);
      
      // Increment user's monthly upscale count
      await supabase
        .from('user_profiles')
        .update({
          current_month_upscales: userProfile.current_month_upscales + 1,
          total_upscales: supabase.sql`total_upscales + 1`
        })
        .eq('id', userId);
      
      // Log API usage
      await supabase
        .from('api_usage_logs')
        .insert({
          transaction_id: transactionId,
          api_provider: 'replicate',
          api_endpoint: '/v1/predictions',
          request_payload: { scale: requestData.scale, quality: requestData.quality },
          response_data: { output: outputUrl },
          http_status_code: 200,
          processing_time_ms: Date.now() - startTime,
          api_cost: 0.0055,
          credits_consumed: 0.0055
        });
    }

    // Test if the Replicate URL is accessible
    try {
      const testResponse = await fetch(outputUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.warn('Replicate URL not immediately accessible, but continuing...');
      }
    } catch (testError) {
      console.warn('Could not test Replicate URL accessibility:', testError);
    }

    // Store only the original image in Supabase Storage (small file)
    const timestamp = Date.now();
    const inPath = `images/input_${timestamp}.png`;
    
    console.log('Storing original image in Supabase Storage...');

    // Upload original image for comparison (this is small, so no size issues)
    const inBuf = Uint8Array.from(atob(requestData.imageBase64.split(",")[1]), c => c.charCodeAt(0));
    const { error: inError } = await supabase.storage
      .from("images")
      .upload(inPath, inBuf, {
        contentType: "image/png",
        upsert: false
      });

    let inputUrl = '';
    if (!inError) {
      // Get public URL for original image
      const { data: inUrl } = supabase.storage
        .from("images")
        .getPublicUrl(inPath);
      inputUrl = inUrl.publicUrl;
    }

    // Use Replicate's CDN URL directly for the upscaled image (no re-upload needed)
    const processingTime = Date.now() - startTime;

    console.log('AI upscaling completed successfully', {
      processingTime: `${processingTime}ms`,
      inputUrl: inputUrl,
      outputUrl: outputUrl
    });

    const response: UpscaleResponse = {
      success: true,
      transactionId: transactionId || undefined,
      inputUrl: inputUrl || requestData.imageBase64, // fallback to base64 if upload failed
      outputUrl: outputUrl, // Direct Replicate CDN URL
      processingTime
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error('Upscaler function error:', error);
    
    // Update transaction as failed if tracking is enabled
    if (transactionId) {
      await supabase
        .from('upscale_transactions')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', transactionId);
    }
    
    const errorResponse: UpscaleResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});