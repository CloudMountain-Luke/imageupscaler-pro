-- Update target_scale constraint to allow up to 32x (Mega plan limit)
-- Previously limited to 16x, now supports full Mega plan capabilities

ALTER TABLE upscale_jobs DROP CONSTRAINT IF EXISTS upscale_jobs_target_scale_check;

ALTER TABLE upscale_jobs ADD CONSTRAINT upscale_jobs_target_scale_check 
CHECK (target_scale >= 2 AND target_scale <= 32);

