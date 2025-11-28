/*
  # Create upscale_jobs table for webhook-based async upscaling

  This table tracks multi-stage upscaling jobs that are orchestrated
  via Replicate webhooks. It stores the chain strategy and current state
  to enable async processing without holding images in Edge Function memory.
*/

-- Create upscale_jobs table
CREATE TABLE IF NOT EXISTS upscale_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  input_url TEXT NOT NULL,
  current_output_url TEXT,
  final_output_url TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('photo', 'art', 'text', 'anime')),
  target_scale INT NOT NULL CHECK (target_scale IN (2, 4, 8, 10, 12, 16, 24, 32)),
  current_stage INT DEFAULT 1,
  total_stages INT NOT NULL,
  prediction_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial_success')),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  chain_strategy JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Indexes for performance
  CONSTRAINT upscale_jobs_user_id_idx FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_upscale_jobs_user_id ON upscale_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_upscale_jobs_status ON upscale_jobs(status);
CREATE INDEX IF NOT EXISTS idx_upscale_jobs_prediction_id ON upscale_jobs(prediction_id);
CREATE INDEX IF NOT EXISTS idx_upscale_jobs_created_at ON upscale_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE upscale_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own jobs" ON upscale_jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON upscale_jobs;
DROP POLICY IF EXISTS "Service role can update jobs" ON upscale_jobs;

-- Policy: Users can only see their own jobs
CREATE POLICY "Users can view own jobs"
  ON upscale_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own jobs
CREATE POLICY "Users can insert own jobs"
  ON upscale_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can update any job (for webhooks)
-- This allows the webhook handler to update jobs without user context
CREATE POLICY "Service role can update jobs"
  ON upscale_jobs FOR UPDATE
  USING (true);

