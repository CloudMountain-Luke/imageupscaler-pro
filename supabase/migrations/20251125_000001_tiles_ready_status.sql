-- Add "tiles_ready" status for client-side stitching
-- This status indicates all tiles have completed upscaling and are ready to be stitched in the browser

-- Drop existing status constraint if it exists
ALTER TABLE upscale_jobs DROP CONSTRAINT IF EXISTS upscale_jobs_status_check;

-- Add new constraint with tiles_ready status
ALTER TABLE upscale_jobs ADD CONSTRAINT upscale_jobs_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial_success', 'tiles_ready'));

COMMENT ON CONSTRAINT upscale_jobs_status_check ON upscale_jobs IS 
'Valid job statuses: pending, processing, completed, failed, partial_success, tiles_ready (ready for client-side stitching)';

