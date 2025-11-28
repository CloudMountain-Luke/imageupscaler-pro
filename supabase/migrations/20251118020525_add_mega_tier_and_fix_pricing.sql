/*
  # Add Mega Tier and Fix Pricing
  
  This migration:
  1. Adds the 'mega' subscription tier that was missing
  2. Updates pricing for 'pro' and 'enterprise' to match homepage pricing
  3. Ensures all tiers are properly configured
*/

-- Add the mega tier if it doesn't exist
INSERT INTO subscription_tiers (name, monthly_price, yearly_price, monthly_upscales, features) 
VALUES (
  'mega', 
  79.99, 
  799.99, 
  2750, 
  '["2x, 4x, 8x, 10x, 16x, 32x scaling", "All quality presets", "All formats", "Priority support", "Unlimited batch processing", "Full API access"]'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET 
  monthly_price = 79.99,
  yearly_price = 799.99,
  monthly_upscales = 2750,
  features = '["2x, 4x, 8x, 10x, 16x, 32x scaling", "All quality presets", "All formats", "Priority support", "Unlimited batch processing", "Full API access"]'::jsonb;

-- Update pro tier pricing to match homepage ($19.99/month)
UPDATE subscription_tiers 
SET 
  monthly_price = 19.99,
  yearly_price = 199.99
WHERE name = 'pro';

-- Update enterprise tier pricing and upscales to match homepage ($39.99/month, 1250 upscales)
UPDATE subscription_tiers 
SET 
  monthly_price = 39.99,
  yearly_price = 399.99,
  monthly_upscales = 1250
WHERE name = 'enterprise';

-- Ensure basic tier has correct pricing (should already be correct, but just in case)
UPDATE subscription_tiers 
SET 
  monthly_price = 7.99,
  yearly_price = 79.99
WHERE name = 'basic';

