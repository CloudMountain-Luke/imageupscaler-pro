/*
  # User Upscale Tracking System

  This migration creates a comprehensive tracking system for user upscales,
  API usage monitoring, billing management, and failsafe mechanisms.

  ## New Tables
  1. **user_profiles** - Extended user information with subscription details
  2. **subscription_tiers** - Available subscription plans and limits
  3. **upscale_transactions** - Individual upscale operations tracking
  4. **api_usage_logs** - Replicate API usage and cost tracking
  5. **billing_cycles** - Monthly billing periods and usage resets
  6. **api_credit_monitoring** - Real-time API credit balance tracking
  7. **upscale_queue** - Queued requests during API outages
  8. **system_alerts** - Monitoring alerts and notifications

  ## Security
  - Enable RLS on all tables
  - Add policies for user data access
  - Service role access for system operations

  ## Features
  - Real-time usage tracking
  - Automatic credit monitoring
  - Billing cycle management
  - Queue system for outages
  - Comprehensive logging
*/

-- Subscription tiers configuration
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  monthly_price decimal(10,2) NOT NULL,
  yearly_price decimal(10,2) NOT NULL,
  monthly_upscales integer NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extended user profiles with subscription information
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  subscription_tier_id uuid REFERENCES subscription_tiers(id),
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT (now() + interval '1 month'),
  monthly_upscales_limit integer DEFAULT 100,
  current_month_upscales integer DEFAULT 0,
  total_upscales integer DEFAULT 0,
  account_credits decimal(10,2) DEFAULT 0.00,
  last_billing_date timestamptz,
  next_billing_date timestamptz DEFAULT (now() + interval '1 month'),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Individual upscale transaction tracking
CREATE TABLE IF NOT EXISTS upscale_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  original_image_url text,
  upscaled_image_url text,
  scale_factor integer NOT NULL CHECK (scale_factor IN (2, 4, 8)),
  quality_preset text NOT NULL CHECK (quality_preset IN ('photo', 'art', 'anime', 'text')),
  processing_time_seconds integer,
  api_cost decimal(8,4) DEFAULT 0.0055, -- Replicate cost per operation
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'queued')),
  replicate_prediction_id text,
  error_message text,
  billing_cycle_id uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- API usage and cost tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES upscale_transactions(id),
  api_provider text DEFAULT 'replicate',
  api_endpoint text,
  request_payload jsonb,
  response_data jsonb,
  http_status_code integer,
  processing_time_ms integer,
  api_cost decimal(8,4),
  credits_consumed decimal(8,4),
  created_at timestamptz DEFAULT now()
);

-- Monthly billing cycles
CREATE TABLE IF NOT EXISTS billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  upscales_included integer NOT NULL,
  upscales_used integer DEFAULT 0,
  overage_upscales integer DEFAULT 0,
  base_cost decimal(10,2) NOT NULL,
  overage_cost decimal(10,2) DEFAULT 0.00,
  total_api_cost decimal(10,2) DEFAULT 0.00,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Real-time API credit monitoring
CREATE TABLE IF NOT EXISTS api_credit_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text DEFAULT 'replicate',
  current_balance decimal(10,2) NOT NULL,
  threshold_warning decimal(10,2) DEFAULT 50.00,
  threshold_critical decimal(10,2) DEFAULT 10.00,
  auto_topup_enabled boolean DEFAULT true,
  auto_topup_amount decimal(10,2) DEFAULT 100.00,
  last_topup_date timestamptz,
  last_balance_check timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Queue system for API outages
CREATE TABLE IF NOT EXISTS upscale_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES upscale_transactions(id),
  priority integer DEFAULT 1,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  scheduled_for timestamptz DEFAULT now(),
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- System alerts and monitoring
CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('low_credits', 'api_outage', 'high_usage', 'billing_issue', 'system_error')),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE upscale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credit_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE upscale_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user data access
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read own transactions" ON upscale_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions" ON upscale_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own billing cycles" ON billing_cycles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own queue items" ON upscale_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role policies for system operations
CREATE POLICY "Service role full access to user_profiles" ON user_profiles
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to upscale_transactions" ON upscale_transactions
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to api_usage_logs" ON api_usage_logs
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to billing_cycles" ON billing_cycles
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to api_credit_monitoring" ON api_credit_monitoring
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to upscale_queue" ON upscale_queue
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role full access to system_alerts" ON system_alerts
  FOR ALL TO service_role
  USING (true);

-- Public read access to subscription tiers
CREATE POLICY "Anyone can read subscription tiers" ON subscription_tiers
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, monthly_price, yearly_price, monthly_upscales, features) VALUES
('basic', 7.99, 79.99, 100, '["2x, 4x, 8x scaling", "Photo & Art presets", "JPEG, PNG, WebP support", "Basic support"]'::jsonb),
('pro', 24.99, 249.99, 500, '["2x, 4x, 8x scaling", "All quality presets", "All formats + WebP conversion", "Priority support", "Batch processing", "API access"]'::jsonb),
('enterprise', 49.99, 499.99, 2000, '["All scaling options", "Custom presets", "All formats", "Dedicated support", "Unlimited batch processing", "Full API access", "Team management", "Usage analytics"]'::jsonb);

-- Insert initial API credit monitoring record
INSERT INTO api_credit_monitoring (provider, current_balance, threshold_warning, threshold_critical, auto_topup_enabled, auto_topup_amount)
VALUES ('replicate', 100.00, 50.00, 10.00, true, 100.00);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier_id);
CREATE INDEX IF NOT EXISTS idx_upscale_transactions_user ON upscale_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_upscale_transactions_status ON upscale_transactions(status);
CREATE INDEX IF NOT EXISTS idx_upscale_transactions_created ON upscale_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_user ON billing_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_period ON billing_cycles(cycle_start, cycle_end);
CREATE INDEX IF NOT EXISTS idx_upscale_queue_status ON upscale_queue(status);
CREATE INDEX IF NOT EXISTS idx_upscale_queue_scheduled ON upscale_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_credit_monitoring_updated_at BEFORE UPDATE ON api_credit_monitoring FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_upscale_queue_updated_at BEFORE UPDATE ON upscale_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();