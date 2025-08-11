/*
  # User Signup Handler Edge Function

  This serverless function handles user registration post-processing,
  specifically for applying promo codes to new user accounts.
  
  ## Features
  - Validates promo codes against the promo_codes table
  - Applies subscription tier upgrades (e.g., Pro tier with 500 upscales)
  - Tracks promo code usage and enforces limits
  - Comprehensive error handling and validation
  - CORS support for web applications
*/

import { createClient } from 'npm:@supabase/supabase-js@2'

interface RequestPayload {
  userId: string;
  promoCode?: string;
}

interface ResponsePayload {
  success: boolean;
  message: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Supabase environment variables not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { userId, promoCode }: RequestPayload = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no promo code is provided, just return success (profile already created by AuthContext)
    if (!promoCode || promoCode.trim() === '') {
      return new Response(
        JSON.stringify({ success: true, message: "No promo code provided" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing promo code '${promoCode}' for user ${userId}`);

    // 1. Find the promo code
    const { data: promo, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode.trim().toUpperCase())
      .single();

    if (promoError || !promo) {
      console.warn(`Promo code '${promoCode}' not found or error:`, promoError?.message);
      return new Response(
        JSON.stringify({ success: false, message: "Invalid or expired promo code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate promo code
    const now = new Date();
    const isExpired = promo.expires_at && new Date(promo.expires_at) < now;
    const isOverLimit = promo.usage_limit !== null && promo.used_count >= promo.usage_limit;

    if (!promo.is_active) {
      return new Response(
        JSON.stringify({ success: false, message: "Promo code is inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isExpired) {
      return new Response(
        JSON.stringify({ success: false, message: "Promo code has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isOverLimit) {
      return new Response(
        JSON.stringify({ success: false, message: "Promo code usage limit exceeded" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Apply promo code effect based on type
    if (promo.type === 'subscription_tier_upgrade' && promo.value === 'pro') {
      // Find the Pro subscription tier
      const { data: proTier, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('id, monthly_upscales')
        .eq('name', 'Pro')
        .single();

      if (tierError || !proTier) {
        console.error('Pro tier not found in subscription_tiers table:', tierError?.message);
        return new Response(
          JSON.stringify({ success: false, message: "Configuration error: Pro tier not found" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user profile with Pro tier
      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier_id: proTier.id,
          monthly_upscales_limit: proTier.monthly_upscales || 500, // Use tier limit or fallback to 500
          current_month_upscales: 0, // Reset usage for new plan
          subscription_status: 'active'
        })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating user profile:', updateProfileError.message);
        return new Response(
          JSON.stringify({ success: false, message: "Failed to apply promo code to user profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Successfully upgraded user ${userId} to Pro tier with promo code ${promoCode}`);

    } else if (promo.type === 'credit_grant') {
      // Handle credit grants (e.g., "500_upscales", "100_credits")
      const creditAmount = parseInt(promo.value.replace(/\D/g, '')) || 0;
      
      if (creditAmount > 0) {
        const { error: updateCreditsError } = await supabase
          .from('user_profiles')
          .update({
            credits_remaining: supabase.sql`credits_remaining + ${creditAmount}`
          })
          .eq('id', userId);

        if (updateCreditsError) {
          console.error('Error updating user credits:', updateCreditsError.message);
          return new Response(
            JSON.stringify({ success: false, message: "Failed to apply credit grant" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Successfully granted ${creditAmount} credits to user ${userId} with promo code ${promoCode}`);
      }

    } else {
      return new Response(
        JSON.stringify({ success: false, message: "Promo code type not supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Increment used_count for the promo code
    const { error: incrementError } = await supabase
      .from('promo_codes')
      .update({ 
        used_count: promo.used_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', promo.id);

    if (incrementError) {
      console.warn('Failed to increment promo code usage count:', incrementError.message);
      // This is a warning, not a critical error for the user's request
    }

    // 5. Log the promo code usage for analytics
    try {
      await supabase
        .from('api_usage_logs')
        .insert({
          api_provider: 'internal',
          api_endpoint: '/functions/v1/handle-user-signup',
          request_payload: { userId, promoCode },
          response_data: { success: true, promoType: promo.type, promoValue: promo.value },
          http_status_code: 200,
          processing_time_ms: 0,
          api_cost: 0,
          credits_consumed: 0
        });
    } catch (logError) {
      console.warn('Failed to log promo code usage:', logError);
      // Non-critical error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Promo code applied successfully! ${promo.type === 'subscription_tier_upgrade' ? 'You now have Pro access with 500 upscales per month.' : 'Credits have been added to your account.'}` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in handle-user-signup function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});