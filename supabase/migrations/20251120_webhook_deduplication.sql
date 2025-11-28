-- Add webhook deduplication table for idempotency
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id TEXT NOT NULL UNIQUE,
  job_id UUID,
  status TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_prediction_id 
  ON processed_webhooks(prediction_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_job_id 
  ON processed_webhooks(job_id);

-- Add field to track webhook processing
ALTER TABLE upscale_jobs 
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

COMMENT ON TABLE processed_webhooks IS 'Tracks processed webhooks to prevent duplicate processing and ensure idempotency';
COMMENT ON COLUMN processed_webhooks.prediction_id IS 'Replicate prediction ID - unique key for idempotency';
COMMENT ON COLUMN upscale_jobs.last_webhook_at IS 'Timestamp of last webhook received for this job';


