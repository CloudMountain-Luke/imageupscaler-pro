-- Manual job recovery for stuck job
-- Check the current state
SELECT 
  id,
  status,
  current_stage,
  total_stages,
  prediction_id,
  current_output_url,
  error_message,
  chain_strategy->'stages' as stages,
  created_at
FROM upscale_jobs 
WHERE id = '34136e92-99e4-4b4e-84ad-6b07ad496346';

-- Mark as failed with partial success so user can retry
UPDATE upscale_jobs 
SET 
  status = 'failed',
  error_message = 'Webhook timeout - Replicate prediction for stage 2 did not complete. This appears to be a Replicate API issue. Please try again.',
  completed_at = NOW()
WHERE id = '34136e92-99e4-4b4e-84ad-6b07ad496346'
  AND status = 'processing';

-- Verify the update
SELECT id, status, error_message FROM upscale_jobs 
WHERE id = '34136e92-99e4-4b4e-84ad-6b07ad496346';


