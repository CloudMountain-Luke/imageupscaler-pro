# Billing & Token Integration Guide

## Overview
This document outlines how to integrate token-based billing when payment processing is implemented.

## Current State
- ✅ UI displays "Tokens" instead of "Upscales"
- ✅ Token cost estimation is calculated before upscaling
- ✅ Database still uses `monthly_upscales_limit` and `current_month_upscales` fields
- ❌ Payment processing not yet implemented (Stripe integration needed)

## Token System Design

### Token Consumption
- **2x-10x upscales**: 1 token per upscale
- **12x-32x upscales**: Variable tokens based on tiling
  - Number of tokens = number of tiles processed
  - Example: 414×413 image at 32x = 25 tiles = 25 tokens

### Token Allocation by Plan
```typescript
const PLAN_TOKENS: Record<PlanTier, number> = {
  basic: 100,       // $7.99/month
  pro: 500,         // $19.99/month
  enterprise: 1250, // $39.99/month
  mega: 2750        // $79.99/month
};
```

## Implementation Steps

### 1. Database Schema (Optional - Current schema works)
The current `monthly_upscales_limit` can be treated as "monthly_tokens_limit" without schema changes.

Alternatively, for clarity, you could add:
```sql
-- Optional: Add explicit token columns
ALTER TABLE user_profiles 
  ADD COLUMN monthly_tokens_limit INTEGER,
  ADD COLUMN current_month_tokens_used INTEGER DEFAULT 0;

-- Migrate existing data
UPDATE user_profiles 
SET monthly_tokens_limit = monthly_upscales_limit,
    current_month_tokens_used = current_month_upscales;
```

### 2. Payment Processing Integration

When implementing Stripe (or other payment processor):

```typescript
// When user subscribes or renews
async function handleSuccessfulPayment(userId: string, planTier: PlanTier) {
  const tokenAllocation = PLAN_TOKENS[planTier];
  
  // Reset token count and set new limit
  await supabase
    .from('user_profiles')
    .update({
      monthly_upscales_limit: tokenAllocation, // Or monthly_tokens_limit
      current_month_upscales: 0,                // Or current_month_tokens_used
      subscription_tier_id: getTierId(planTier),
      current_period_start: new Date(),
      current_period_end: addMonths(new Date(), 1)
    })
    .eq('id', userId);
}
```

### 3. Token Deduction Logic

Update `UpscaleTrackingService.incrementUpscaleCounts()` to deduct actual tokens used:

```typescript
// In src/services/upscaleTrackingService.ts
static async decrementTokens(userId: string, tokensUsed: number): Promise<boolean> {
  try {
    // Get current count
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_month_upscales, monthly_upscales_limit')
      .eq('id', userId)
      .single();

    if (!profile) return false;

    const newUsed = (profile.current_month_upscales || 0) + tokensUsed;
    
    // Check if user has enough tokens
    if (newUsed > profile.monthly_upscales_limit) {
      throw new Error('Insufficient tokens');
    }

    // Deduct tokens
    const { error } = await supabase
      .from('user_profiles')
      .update({ current_month_upscales: newUsed })
      .eq('id', userId);

    return !error;
  } catch (error) {
    console.error('Error decrementing tokens:', error);
    return false;
  }
}
```

### 4. Pre-Flight Token Check

Before starting an upscale, check if user has sufficient tokens:

```typescript
// In ImageProcessingContext.tsx or upscale-init edge function
async function checkTokenAvailability(
  userId: string,
  imageWidth: number,
  imageHeight: number,
  targetScale: number
): Promise<{ hasEnough: boolean; required: number; available: number }> {
  // Estimate tokens needed
  const estimate = estimateTokenCost(imageWidth, imageHeight, targetScale);
  
  // Get user's available tokens
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('monthly_upscales_limit, current_month_upscales')
    .eq('id', userId)
    .single();

  const available = (profile.monthly_upscales_limit || 0) - (profile.current_month_upscales || 0);
  
  return {
    hasEnough: available >= estimate.tokens,
    required: estimate.tokens,
    available
  };
}
```

### 5. Monthly Reset

Set up a cron job or Supabase function to reset token counts monthly:

```sql
-- Supabase Edge Function or pg_cron job
UPDATE user_profiles
SET current_month_upscales = 0,
    current_period_start = CURRENT_DATE,
    current_period_end = CURRENT_DATE + INTERVAL '1 month'
WHERE current_period_end < CURRENT_DATE;
```

## Integration Checklist

- [ ] Implement Stripe payment processing
- [ ] Add webhook handler for successful payments
- [ ] Update token allocation on payment
- [ ] Implement pre-flight token check before upscaling
- [ ] Update token deduction to use actual tile count
- [ ] Add monthly reset cron job
- [ ] Update error messages to mention "tokens" not "upscales"
- [ ] Add token purchase/top-up option (optional)
- [ ] Implement token expiration policy (optional)

## Notes

- Current implementation tracks upscales 1:1, which is fine for simple upscales
- For tiled upscales (12x-32x), you'll need to track the actual tile count
- The Edge Function (upscale-init) has access to `tilingGrid.totalTiles` - this should be stored
  and used for token deduction
- Consider adding a `tokens_used` field to `upscale_jobs` table to track actual token consumption per job

## Example: Store Tile Count

```typescript
// In upscale-init Edge Function
const tilingGrid = calculateOptimalTiling(...);
const tokensRequired = tilingGrid ? tilingGrid.totalTiles : 1;

// Store in upscale_jobs
await supabase
  .from('upscale_jobs')
  .insert({
    // ... other fields
    tokens_used: tokensRequired  // Add this field to track actual cost
  });

// After job completes successfully, deduct tokens
await UpscaleTrackingService.decrementTokens(userId, tokensRequired);
```


